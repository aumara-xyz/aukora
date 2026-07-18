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
 *   - upstream = the spatial launcher (which already holds the mind-door token law server-side). The
 *     active upstream port comes from the supervisor's state PROJECTION (a CLAIM) and is TRUSTED ONLY
 *     after it survives, before first use each boot (R56 brick 3): (1) shape + policy — an allowed
 *     spatial-shell port, never a refused/AUMLOK port; (2) supervisor-owned child identity — a live pid
 *     record whose owned process group is the ACTUAL listener on that port (a foreign listener or a
 *     stale/unowned claim refuses); (3) the identity PROBE the docblock promised — the port answers the
 *     shell's `probePath` with its `identityMarker`. An unverified upstream is REFUSED, never proxied —
 *     the gateway trusts probes, not files;
 *   - /aukora/status + /aukora/receipts expose the supervisor's receipt/status surface (read-only,
 *     content-free receipts; grantsAuthority:false pinned on every payload this gateway originates).
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readPidRecord, listenerPidOnPort, isAlive, pgidOf } from './supervisor.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..');
const policy = JSON.parse(readFileSync(join(APP, 'policy.json'), 'utf8'));
const PORT = Number(process.env.AUKORA_GATEWAY_PORT ?? policy.gateway.port);
const STATE = join(APP, 'state', 'state.json');
const RECEIPTS = join(APP, 'state', 'receipts.jsonl');

const shell = policy.services.find((s) => s.name === 'spatial-shell');

/** The claimed active shell port from the state projection — a CLAIM, shown but never trusted for proxying. */
function claimedShellPort() {
  try { const st = JSON.parse(readFileSync(STATE, 'utf8')); return st.services?.['spatial-shell']?.activePort ?? shell.port; }
  catch { return shell.port; }
}

/** The real identity probe: does `port` answer the shell's probePath with its identityMarker? Matches the
 *  supervisor's probe law (portOpen + identity substring). Injectable so the resolver is testable offline. */
async function httpProbe(port, path, marker) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, { signal: AbortSignal.timeout(policy.probe?.timeoutMs ?? 2000) });
    const text = await res.text();
    return { portOpen: true, identityOk: typeof marker === 'string' && marker.length > 0 ? text.includes(marker) : true };
  } catch { return { portOpen: false, identityOk: null }; }
}

/**
 * Resolve the upstream shell port from an UNTRUSTED state projection through policy + owned-identity + a live
 * probe. Pure over injected dependencies (no ambient fs/net), so every refusal path is deterministically
 * testable. Returns `{ ok:true, port }` for a verified upstream, else `{ ok:false, reason }`.
 */
export async function resolveUpstreamShellPort(deps) {
  const { policy: pol, readState, readPidRecord: readRec, listenerPidOnPort: listenerOn, isAlive: alive, pgidOf: pgidFn, probe } = deps;
  const svc = pol.services.find((s) => s.name === 'spatial-shell');
  const allowed = new Set([svc.port, svc.candidatePort].filter((p) => Number.isInteger(p)));
  const refused = new Set(pol.gateway.refusedUpstreams ?? []);

  // (0) the CLAIM — read from the state projection, defaulting to the policy port. Never trusted as-is.
  let claimed;
  try { claimed = readState()?.services?.['spatial-shell']?.activePort ?? svc.port; }
  catch { return { ok: false, reason: 'gateway:upstream-state-unreadable' }; }

  // (1) SHAPE + POLICY: an integer port in the spatial-shell's allowed set; never a refused/AUMLOK port.
  if (!Number.isInteger(claimed) || claimed <= 0 || claimed > 65535) return { ok: false, reason: 'gateway:upstream-port-malformed' };
  if (refused.has(claimed)) return { ok: false, reason: 'gateway:upstream-refused-port' };       // AUMLOK is never fronted
  if (!allowed.has(claimed)) return { ok: false, reason: 'gateway:upstream-port-not-in-policy' }; // a foreign/arbitrary port

  // (2) SUPERVISOR-OWNED CHILD IDENTITY: a live pid record whose owned group is the ACTUAL listener.
  const rec = readRec('spatial-shell', claimed);
  if (rec === null) return { ok: false, reason: 'gateway:upstream-unowned' };                     // no supervisor record → not ours
  const listener = listenerOn(claimed);
  if (listener === null) return { ok: false, reason: 'gateway:upstream-not-listening' };           // nothing bound
  const ownedPids = new Set([rec.listenerPid, rec.wrapperPid, rec.pgid].filter((p) => Number.isInteger(p) && p > 0));
  const listenerOwned = ownedPids.has(listener) || (Number.isInteger(rec.pgid) && pgidFn(listener) === rec.pgid);
  if (!listenerOwned) return { ok: false, reason: 'gateway:upstream-foreign-listener' };           // someone else on our port
  if (!alive(listener)) return { ok: false, reason: 'gateway:upstream-owner-dead' };                // stale

  // (3) the identity PROBE the header promises — trust probes, not files.
  const p = await probe(claimed, svc.probePath, svc.identityMarker);
  if (!p.portOpen) return { ok: false, reason: 'gateway:upstream-not-listening' };
  if (p.identityOk !== true) return { ok: false, reason: 'gateway:upstream-identity-mismatch' };

  return { ok: true, port: claimed };
}

/** Real dependencies for `resolveUpstreamShellPort` (ambient fs/net/supervisor helpers). */
function liveDeps() {
  return {
    policy,
    readState: () => (existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : { services: {} }),
    readPidRecord, listenerPidOnPort, isAlive, pgidOf, probe: httpProbe,
  };
}

const DECLARED_EXACT = new Set(policy.gateway.declaredRoutes.filter((r) => !r.endsWith('*')));
const DECLARED_PREFIX = policy.gateway.declaredRoutes.filter((r) => r.endsWith('*')).map((r) => r.slice(0, -1));
const JSON_HEAD = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };

function declared(pathname) {
  if (pathname === '/') return true;
  if (DECLARED_EXACT.has(pathname)) return true;
  return DECLARED_PREFIX.some((p) => pathname.startsWith(p));
}

/** Build the gateway http server. The verified upstream is resolved+cached once (before first use each boot);
 *  an unverified upstream refuses proxying. `deps` is injectable for tests; omitted → the live ambient deps. */
export function createGatewayServer(deps = liveDeps()) {
  let verifiedUpstream = null; // { ok, port } | { ok:false, reason } — cached after the first proxy attempt this boot
  async function upstream() {
    if (verifiedUpstream === null) verifiedUpstream = await resolveUpstreamShellPort(deps);
    return verifiedUpstream;
  }
  return createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
    const pathname = url.pathname;

    // the one status/receipt surface
    if (pathname === '/aukora/status') {
      const st = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : { services: {} };
      const up = await upstream();
      res.writeHead(200, JSON_HEAD);
      return res.end(JSON.stringify({ schema: 'aukora-gateway-status-v1', gateway: PORT, upstreamShellClaimed: claimedShellPort(), upstreamShellVerified: up.ok ? up.port : null, upstreamVerification: up.ok ? 'verified' : up.reason, supervisorState: st, grantsAuthority: false }));
    }
    if (pathname === '/aukora/receipts') {
      const lines = existsSync(RECEIPTS) ? readFileSync(RECEIPTS, 'utf8').trim().split('\n').slice(-100) : [];
      res.writeHead(200, JSON_HEAD);
      return res.end(JSON.stringify({ schema: 'aukora-gateway-receipts-v1', count: lines.length, receipts: lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean), grantsAuthority: false }));
    }

    // AUMLOK is NEVER fronted — routing must not become authority.
    if (/aumlok|ceremony|bind|approve/i.test(pathname) || (policy.gateway.refusedUpstreams ?? []).some((p) => url.href.includes(':' + p))) {
      res.writeHead(403, JSON_HEAD);
      return res.end(JSON.stringify({ refused: true, law: 'the gateway never sits in front of AUMLOK (7094/7095) — ceremony stays on its own local doors; routing is not authority', grantsAuthority: false }));
    }

    if (!declared(pathname)) {
      res.writeHead(404, JSON_HEAD);
      return res.end(JSON.stringify({ error: 'undeclared interface', declared: policy.gateway.declaredRoutes, grantsAuthority: false }));
    }

    // VERIFIED upstream only — a malformed/foreign/stale/non-listening/identity-mismatched projection is refused,
    // never proxied. The gateway trusts the probe, not the state file.
    const up = await upstream();
    if (!up.ok) {
      res.writeHead(503, JSON_HEAD);
      return res.end(JSON.stringify({ offline: true, reason: up.reason, law: 'the gateway proxies only a supervisor-owned, identity-probed spatial shell; an unverified upstream is refused', grantsAuthority: false }));
    }

    // proxy the declared interface to the VERIFIED shell launcher (which holds the mind-door token law).
    const target = `http://127.0.0.1:${up.port}${pathname}${url.search}`;
    try {
      const headers = { ...req.headers };
      delete headers.host; delete headers.connection;
      const body = (req.method === 'GET' || req.method === 'HEAD') ? undefined : await new Promise((resolveBody) => {
        const chunks = []; req.on('data', (c) => chunks.push(c)); req.on('end', () => resolveBody(Buffer.concat(chunks)));
      });
      const upRes = await fetch(target, { method: req.method, headers, body, signal: AbortSignal.timeout(30000) });
      res.writeHead(upRes.status, Object.fromEntries([...upRes.headers.entries()].filter(([k]) => !['transfer-encoding', 'connection'].includes(k))));
      if (upRes.body) { for await (const chunk of upRes.body) res.write(chunk); }
      return res.end();
    } catch (e) {
      verifiedUpstream = null; // a proxy failure invalidates the cached verification → re-probe next request
      res.writeHead(502, JSON_HEAD);
      return res.end(JSON.stringify({ offline: true, upstream: 'spatial-shell :' + up.port, detail: String(e && e.message ? e.message : e).slice(0, 120), grantsAuthority: false }));
    }
  });
}

const isDirect = process.argv[1] && fileURLToPath(import.meta.url) === (await import('node:path')).resolve(process.argv[1]);
if (isDirect) {
  createGatewayServer().listen(PORT, '127.0.0.1', () => {
    console.log(`Aukora — one gateway → http://127.0.0.1:${PORT}/ (upstream: supervisor-owned + identity-probed spatial shell; AUMLOK never fronted; declared interfaces only)`);
  });
}
