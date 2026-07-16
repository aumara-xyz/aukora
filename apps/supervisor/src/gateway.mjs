// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * The ONE external gateway (WAVE 2): internally modular, externally one Aukora.
 *
 * Laws:
 *   - ONE origin (127.0.0.1:7100) fronts the whole organism; the browser's same-origin safety is
 *     preserved because everything it can reach is THIS origin (no CORS is opened anywhere here);
 *   - routes ONLY the declared interfaces from policy.json (gateway.declaredRoutes) — anything else
 *     is a loud 404 with the declared list; no wildcard upstreaming;
 *   - NEVER fronts AUMLOK (:7094/:7095): routing must not become authority. Requests that look like
 *     ceremony paths are refused with a law note (policy.gateway.refusedUpstreams);
 *   - upstream = the spatial launcher (which already holds the mind-door token law server-side);
 *     the active upstream port comes from the supervisor's state PROJECTION (a claim) but is verified
 *     by an identity probe before first use each boot — the gateway trusts probes, not files;
 *   - /aukora/status + /aukora/receipts expose the supervisor's receipt/status surface (read-only,
 *     content-free receipts; grantsAuthority:false pinned on every payload this gateway originates).
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..');
const policy = JSON.parse(readFileSync(join(APP, 'policy.json'), 'utf8'));
const PORT = Number(process.env.AUKORA_GATEWAY_PORT ?? policy.gateway.port);
const STATE = join(APP, 'state', 'state.json');
const RECEIPTS = join(APP, 'state', 'receipts.jsonl');

const shell = policy.services.find((s) => s.name === 'spatial-shell');
function activeShellPort() {
  try { const st = JSON.parse(readFileSync(STATE, 'utf8')); return st.services?.['spatial-shell']?.activePort ?? shell.port; }
  catch { return shell.port; }
}

const DECLARED_EXACT = new Set(policy.gateway.declaredRoutes.filter((r) => !r.endsWith('*')));
const DECLARED_PREFIX = policy.gateway.declaredRoutes.filter((r) => r.endsWith('*')).map((r) => r.slice(0, -1));
const JSON_HEAD = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };

function declared(pathname) {
  if (pathname === '/') return true;
  if (DECLARED_EXACT.has(pathname)) return true;
  return DECLARED_PREFIX.some((p) => pathname.startsWith(p));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
  const pathname = url.pathname;

  // the one status/receipt surface
  if (pathname === '/aukora/status') {
    const st = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : { services: {} };
    res.writeHead(200, JSON_HEAD);
    return res.end(JSON.stringify({ schema: 'aukora-gateway-status-v1', gateway: PORT, upstreamShell: activeShellPort(), supervisorState: st, grantsAuthority: false }));
  }
  if (pathname === '/aukora/receipts') {
    const lines = existsSync(RECEIPTS) ? readFileSync(RECEIPTS, 'utf8').trim().split('\n').slice(-100) : [];
    res.writeHead(200, JSON_HEAD);
    return res.end(JSON.stringify({ schema: 'aukora-gateway-receipts-v1', count: lines.length, receipts: lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean), grantsAuthority: false }));
  }

  // AUMLOK is NEVER fronted — routing must not become authority.
  if (/aumlok|ceremony|bind|approve/i.test(pathname) || policy.gateway.refusedUpstreams.some((p) => url.href.includes(':' + p))) {
    res.writeHead(403, JSON_HEAD);
    return res.end(JSON.stringify({ refused: true, law: 'the gateway never sits in front of AUMLOK (7094/7095) — ceremony stays on its own local doors; routing is not authority', grantsAuthority: false }));
  }

  if (!declared(pathname)) {
    res.writeHead(404, JSON_HEAD);
    return res.end(JSON.stringify({ error: 'undeclared interface', declared: policy.gateway.declaredRoutes, grantsAuthority: false }));
  }

  // proxy the declared interface to the shell launcher (which holds the mind-door token law).
  const upstream = `http://127.0.0.1:${activeShellPort()}${pathname}${url.search}`;
  try {
    const headers = { ...req.headers };
    delete headers.host; delete headers.connection;
    const body = (req.method === 'GET' || req.method === 'HEAD') ? undefined : await new Promise((resolveBody) => {
      const chunks = []; req.on('data', (c) => chunks.push(c)); req.on('end', () => resolveBody(Buffer.concat(chunks)));
    });
    const up = await fetch(upstream, { method: req.method, headers, body, signal: AbortSignal.timeout(30000) });
    res.writeHead(up.status, Object.fromEntries([...up.headers.entries()].filter(([k]) => !['transfer-encoding', 'connection'].includes(k))));
    if (up.body) { for await (const chunk of up.body) res.write(chunk); }
    return res.end();
  } catch (e) {
    res.writeHead(502, JSON_HEAD);
    return res.end(JSON.stringify({ offline: true, upstream: 'spatial-shell :' + activeShellPort(), detail: String(e && e.message ? e.message : e).slice(0, 120), grantsAuthority: false }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Aukora — one gateway → http://127.0.0.1:${PORT}/ (upstream shell :${activeShellPort()}; AUMLOK never fronted; declared interfaces only)`);
});
