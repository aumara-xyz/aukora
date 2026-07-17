// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * readSpine — R47: the donor GET/HEAD-only read spine for the workbench, ported/adapted from the donor
 * `spatial/serve.ts` projection server (aukora-symbiote@ed1824a). One module, injected dependencies, mounted
 * by the Spatial launcher. LAWS:
 *   - GET/HEAD ONLY: any other method refuses 405 with a loud reason class (donor line: serve.ts:749).
 *   - ADVISORY ONLY: every response carries `x-aukora-grants-authority: false`; nothing here mutates anything.
 *   - REPO SIGHT IS CONFINED: repo-relative paths only; escapes, dotfiles, custody/key/token/seed material,
 *     state/, .local/, .git/, node_modules/ all refuse with a NAMED reason class — never silent.
 *   - NO TOKEN: this spine never reads AUKORA_DOOR_TOKEN — it proxies only the tokenless GET projections of
 *     the canonical 7141 brain door. The mind-door token path stays the launcher's separate governed proxy.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, normalize, extname } from 'node:path';

export const REASONS = Object.freeze({
  METHOD: 'method-not-allowed',
  OUTSIDE: 'outside-repo',
  DOTFILE: 'dotfile-denied',
  CUSTODY: 'custody-path-denied',
  KEY_MATERIAL: 'key-material-denied',
  STATE: 'state-path-denied',
  TOO_LARGE: 'file-too-large',
  BINARY: 'binary-denied',
  NOT_FOUND: 'not-found',
  BAD_QUERY: 'bad-query',
  DOOR_DOWN: 'door-unreachable',
});

const DENY_SEGMENTS = new Set(['.git', 'node_modules', '.local', 'state', 'dist', '.venv']);
const KEY_EXT = new Set(['.pem', '.key', '.p12', '.der', '.seed', '.keystore']);
const CUSTODY_NAME = /(custody|secret|token|seed|credential|password)/i;

/** Confinement classifier — pure. Returns {ok:true, rel} or {ok:false, reason}. */
export function classifyRepoPath(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return { ok: false, reason: REASONS.BAD_QUERY };
  const rel = normalize(raw).replace(/^\.\/+/, '');
  if (rel.startsWith('..') || rel.startsWith('/') || rel.includes('\0')) return { ok: false, reason: REASONS.OUTSIDE };
  const segs = rel.split('/');
  for (const s of segs) {
    if (DENY_SEGMENTS.has(s)) return { ok: false, reason: s === 'state' ? REASONS.STATE : REASONS.CUSTODY };
    if (s.startsWith('.') && s !== '.') return { ok: false, reason: REASONS.DOTFILE };
  }
  const base = segs[segs.length - 1] ?? '';
  if (KEY_EXT.has(extname(base).toLowerCase())) return { ok: false, reason: REASONS.KEY_MATERIAL };
  if (CUSTODY_NAME.test(base)) return { ok: false, reason: REASONS.CUSTODY };
  return { ok: true, rel };
}

const looksBinary = (buf) => buf.subarray(0, 1024).includes(0);

export function makeReadSpine({ repoRoot, doorBase = 'http://127.0.0.1:7141', fetchImpl = fetch, maxBytes = 262144, maxResults = 200 }) {
  const HEADERS = { 'content-type': 'application/json; charset=utf-8', 'x-aukora-source': 'live', 'x-aukora-grants-authority': 'false' };
  const send = (res, status, body) => { res.writeHead(status, HEADERS); res.end(JSON.stringify(body)); };
  const refuse = (res, status, reason, extra = {}) => send(res, status, { refused: true, reason, ...extra });

  async function door(path) {
    const r = await fetchImpl(`${doorBase}${path}`);
    return await r.json();
  }

  const ROUTES = new Set(['/api/fingerprint', '/api/repo/list', '/api/repo/read', '/api/repo/search', '/api/loop', '/api/kira/recall', '/api/workflows', '/api/receipts', '/api/events', '/api/tests']);

  return {
    canHandle: (p) => ROUTES.has(p),
    async handle(req, res, url) {
      if (req.method !== 'GET' && req.method !== 'HEAD') return refuse(res, 405, REASONS.METHOD);
      const p = url.pathname;
      try {
        if (p === '/api/fingerprint') {
          const head = execFileSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
          const branch = execFileSync('git', ['-C', repoRoot, 'rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim();
          const dirty = execFileSync('git', ['-C', repoRoot, 'status', '--porcelain'], { encoding: 'utf8' }).trim().length > 0;
          return send(res, 200, { head, branch, dirty, grantsAuthority: false });
        }
        if (p === '/api/repo/list') {
          const v = classifyRepoPath(url.searchParams.get('dir') ?? '.');
          if (!v.ok) return refuse(res, 403, v.reason);
          const abs = join(repoRoot, v.rel);
          if (!existsSync(abs)) return refuse(res, 404, REASONS.NOT_FOUND);
          const entries = readdirSync(abs, { withFileTypes: true })
            .filter((e) => classifyRepoPath(join(v.rel, e.name)).ok)
            .slice(0, maxResults)
            .map((e) => ({ name: e.name, dir: e.isDirectory() }));
          return send(res, 200, { dir: v.rel, entries });
        }
        if (p === '/api/repo/read') {
          const v = classifyRepoPath(url.searchParams.get('path') ?? '');
          if (!v.ok) return refuse(res, 403, v.reason);
          const abs = join(repoRoot, v.rel);
          if (!existsSync(abs) || statSync(abs).isDirectory()) return refuse(res, 404, REASONS.NOT_FOUND);
          if (statSync(abs).size > maxBytes) return refuse(res, 413, REASONS.TOO_LARGE, { maxBytes });
          const buf = readFileSync(abs);
          if (looksBinary(buf)) return refuse(res, 415, REASONS.BINARY);
          return send(res, 200, { path: v.rel, content: buf.toString('utf8') });
        }
        if (p === '/api/repo/search') {
          const q = url.searchParams.get('q') ?? '';
          if (q.length < 2) return refuse(res, 400, REASONS.BAD_QUERY, { note: 'q must be >= 2 chars' });
          const root = classifyRepoPath(url.searchParams.get('dir') ?? '.');
          if (!root.ok) return refuse(res, 403, root.reason);
          const hits = [];
          const walk = (rel) => {
            if (hits.length >= maxResults) return;
            const abs = join(repoRoot, rel);
            for (const e of readdirSync(abs, { withFileTypes: true })) {
              if (hits.length >= maxResults) return;
              const childRel = rel === '.' ? e.name : join(rel, e.name);
              if (!classifyRepoPath(childRel).ok) continue;
              if (e.isDirectory()) { walk(childRel); continue; }
              try {
                if (statSync(join(repoRoot, childRel)).size > maxBytes) continue;
                const buf = readFileSync(join(repoRoot, childRel));
                if (looksBinary(buf)) continue;
                const lines = buf.toString('utf8').split('\n');
                for (let i = 0; i < lines.length && hits.length < maxResults; i++) {
                  if (lines[i].includes(q)) hits.push({ path: childRel, line: i + 1, text: lines[i].slice(0, 200) });
                }
              } catch { /* unreadable file: skip, confinement already reasoned */ }
            }
          };
          walk(root.rel);
          return send(res, 200, { q, hits, truncated: hits.length >= maxResults });
        }
        if (p === '/api/loop') {
          const [pending, receipts] = await Promise.all([door('/workflows?phase=awaiting-owner'), door('/receipts')]);
          return send(res, 200, { pending, rehearsalReceipts: receipts, grantsAuthority: false });
        }
        if (p === '/api/kira/recall') {
          const q = url.searchParams.get('q') ?? '';
          const hits = await door(`/memory/recall?text=${encodeURIComponent(q)}`);
          // citations: content-addressed recordId + createdAt — verifiable against the receipt chain.
          const cited = (Array.isArray(hits) ? hits : []).map((h) => ({ citation: { recordId: h.recordId, createdAt: h.createdAt }, content: h.content }));
          return send(res, 200, { q, hits: cited, advisoryOnly: true, grantsAuthority: false });
        }
        if (p === '/api/workflows') return send(res, 200, await door(`/workflows${url.search ?? ''}`));
        if (p === '/api/receipts') return send(res, 200, await door(`/receipts${url.search ?? ''}`));
        if (p === '/api/events') {
          // SSE pipe from the door's reactive seam (server-to-server; the browser stays same-origin).
          const upstream = await fetchImpl(`${doorBase}/events`);
          if (!upstream.ok || !upstream.body) return refuse(res, 502, REASONS.DOOR_DOWN);
          res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', 'x-aukora-source': 'live', 'x-aukora-grants-authority': 'false' });
          const reader = upstream.body.getReader();
          const pump = () => reader.read().then(({ done, value }) => { if (done) return res.end(); res.write(value); pump(); }).catch(() => res.end());
          req.on('close', () => reader.cancel().catch(() => {}));
          return pump();
        }
        if (p === '/api/tests') {
          // HONEST degraded projection: test results are not persisted on this tree; refusing beats faking.
          return send(res, 200, { available: false, reason: 'test-results-not-persisted-on-this-tree', grantsAuthority: false });
        }
        return refuse(res, 404, REASONS.NOT_FOUND);
      } catch (err) {
        return refuse(res, 502, REASONS.DOOR_DOWN, { detail: String(err).slice(0, 160) });
      }
    },
  };
}
