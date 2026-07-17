#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R51 CORE TRUTH FREEZE — REAL local self-hosted Convex canary (issue #108). NOT convex-test.
 *
 * Owns the whole backend lifecycle so the SIGKILL is a genuine `kill -9` of the running convex-local-backend
 * process (FSL-1.1 official binary, run externally as a dev runtime — use, not source incorporation), then
 * restarts it on the SAME on-disk SQLite. Proves the five nervous-system laws against the append-only-events +
 * atomic-snapshot pilot (apps/brain/canary/convex):
 *   1. typed event accepted once
 *   2. 10 identical submissions produce ONE canonical effect/receipt
 *   3. actual process death (kill -9) loses no settled state
 *   4. restart produces no duplicate effect
 *   5. one narrow reactive projection changes (snapshot query + a live subscription push)
 *
 * Local/self-hosted only (127.0.0.1). No managed Convex, no cloud, no keys/authority in the data. Emits a
 * sanitized transcript to stdout (the caller tees it to apps/brain/docs/r51/).
 */
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';

function resolveBackendBinary() {
  const explicit = process.env.CONVEX_LOCAL_BACKEND_BINARY;
  if (explicit) return explicit;
  const root = join(homedir(), '.cache/convex/binaries');
  if (!existsSync(root)) return null;
  const candidates = readdirSync(root)
    .filter((name) => name.startsWith('precompiled-'))
    .sort()
    .reverse()
    .map((name) => join(root, name, 'convex-local-backend'));
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

const BIN = resolveBackendBinary();
const CANARY = new URL('../canary', import.meta.url).pathname;
const CONVEX_CLI = new URL('../../../node_modules/.bin/convex', import.meta.url).pathname;
const PORT = 3310, SITE = 3311;
const URLB = `http://127.0.0.1:${PORT}`;
const NAME = 'aukora-r51-canary';
const SECRET = '0000000000000000000000000000000000000000000000000000000000000051';

const log = (s) => console.log(`[r51-canary] ${s}`);
const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = false;
const check = (label, cond) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failed = true; };

function adminKey() {
  if (!BIN) throw new Error('convex-local-backend unavailable');
  return execFileSync(BIN, ['keygen', 'admin-key', '--instance-name', NAME, '--instance-secret', SECRET], { encoding: 'utf8' }).trim();
}
function portListening(port) {
  try { return execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().length > 0; }
  catch { return false; }
}
async function waitPort(port, tries = 60) { for (let i = 0; i < tries; i++) { if (portListening(port)) return true; await sleep(500); } return false; }

function bootBackend(sqlitePath, storageDir) {
  if (!BIN) throw new Error('convex-local-backend unavailable');
  const child = spawn(BIN, [
    '--port', String(PORT), '--site-proxy-port', String(SITE),
    '--instance-name', NAME, '--instance-secret', SECRET,
    '--local-storage', storageDir, '--convex-origin', URLB, '--convex-site', `http://127.0.0.1:${SITE}`,
    sqlitePath,
  ], { stdio: 'ignore', detached: false });
  return child;
}

async function main() {
  if (!BIN || !existsSync(BIN)) {
    log('FATAL: convex-local-backend is not installed in the Convex cache.');
    log('Prime a local Convex deployment first, or set CONVEX_LOCAL_BACKEND_BINARY to an official binary.');
    process.exit(2);
  }
  const work = mkdtempSync(join(tmpdir(), 'r51-canary-'));
  const sqlitePath = join(work, 'r51.sqlite3');
  const storageDir = join(work, 'storage');
  const KEY = adminKey();
  const env = { ...process.env, CONVEX_SELF_HOSTED_URL: URLB, CONVEX_SELF_HOSTED_ADMIN_KEY: KEY, CONVEX_AGENT_MODE: 'anonymous' };

  log(`REAL backend: ${BIN.split('/').slice(-2).join('/')}`);
  log(`storage (temp, discarded): ${work}`);

  // ── boot #1 ──────────────────────────────────────────────────────────────────────────────────────
  let backend = bootBackend(sqlitePath, storageDir);
  log(`booting backend #1 (pid ${backend.pid}) on ${URLB} …`);
  if (!(await waitPort(PORT))) { log('FATAL: backend never bound'); backend.kill('SIGKILL'); process.exit(2); }
  log('backend #1 UP');

  // deploy the canary functions to the REAL backend (self-hosted env only; clear any stale deployment pointer)
  log('deploying canary functions (convex dev --once, self-hosted)…');
  rmSync(join(CANARY, '.env.local'), { force: true });
  execFileSync(CONVEX_CLI, ['dev', '--once', '--typecheck', 'disable'], { cwd: CANARY, env, stdio: 'ignore' });
  log('functions deployed');

  const { ConvexHttpClient, ConvexClient } = await import('convex/browser');
  const http = new ConvexHttpClient(URLB);
  const api = (await import(join(CANARY, 'convex/_generated/api.js'))).api;

  const WF = sha256('r51-workflow-alpha');
  const mkEvent = (payload) => ({ eventId: sha256(payload), workflowId: WF, kind: 'accepted', at: '2026-07-17T00:00:00.000Z' });

  // ── PROOF 1: typed event accepted once ───────────────────────────────────────────────────────────
  log('PROOF 1 — typed event accepted once');
  const e1 = mkEvent('canonical-event-1');
  const r1 = await http.mutation(api.nervous.appendEventOnce, e1);
  check('accepted, not deduplicated, seq 0', r1.ok === true && r1.deduplicated === false && r1.seq === 0);
  check('durable log has exactly 1 row', (await http.query(api.nervous.events, { workflowId: WF })).length === 1);

  // ── PROOF 2: 10 identical submissions → ONE canonical effect/receipt ──────────────────────────────
  log('PROOF 2 — 10 identical submissions produce one canonical effect');
  let firstNew = 0, dedup = 0;
  for (let i = 0; i < 10; i++) { const r = await http.mutation(api.nervous.appendEventOnce, e1); if (r.deduplicated) dedup += 1; else firstNew += 1; }
  check('all 10 acknowledged; 10 deduplicated (the first commit was proof 1)', dedup === 10 && firstNew === 0);
  check('durable log STILL exactly 1 row (one canonical effect)', (await http.query(api.nervous.events, { workflowId: WF })).length === 1);
  const snapAfter2 = await http.query(api.nervous.snapshot, { workflowId: WF });
  check('atomic snapshot eventCount === 1 (agrees with the log)', snapAfter2.eventCount === 1 && snapAfter2.grantsAuthority === false);

  // ── PROOF 5a: reactive projection PUSHES a change on a new distinct event ─────────────────────────
  log('PROOF 5 — one narrow reactive projection changes');
  const sub = new ConvexClient(URLB);
  const pushes = [];
  const unsub = sub.onUpdate(api.nervous.snapshot, { workflowId: WF }, (s) => pushes.push(s?.eventCount ?? null));
  await sleep(500); // receive the initial snapshot (eventCount 1)
  const e2 = mkEvent('canonical-event-2');
  await http.mutation(api.nervous.appendEventOnce, e2); // a genuinely new event → snapshot advances 1→2
  await sleep(800); // let the reactive push arrive
  await unsub(); await sub.close();
  check('reactive subscription pushed an eventCount change (…→2)', pushes.includes(2));
  const settledCount = (await http.query(api.nervous.events, { workflowId: WF })).length; // = 2
  const settledSnap = await http.query(api.nervous.snapshot, { workflowId: WF });
  check('pre-crash SETTLED state: 2 events, snapshot eventCount 2', settledCount === 2 && settledSnap.eventCount === 2);
  const total = await http.query(api.nervous.totalEvents, {});

  // ── PROOF 3: actual process death loses no settled state ──────────────────────────────────────────
  log('PROOF 3 — actual process death (kill -9) then restart');
  const deadPid = backend.pid;
  process.kill(deadPid, 'SIGKILL'); // REAL crash — no graceful shutdown, no flush
  await sleep(1500);
  check(`backend pid ${deadPid} is gone (real SIGKILL)`, !portListening(PORT));

  // ── restart on the SAME sqlite + storage ─────────────────────────────────────────────────────────
  backend = bootBackend(sqlitePath, storageDir);
  log(`restarting backend #2 (pid ${backend.pid}) on the SAME storage …`);
  if (!(await waitPort(PORT))) { log('FATAL: backend did not come back'); backend.kill('SIGKILL'); process.exit(2); }
  log('backend #2 UP (restarted on the same on-disk SQLite)');
  const http2 = new ConvexHttpClient(URLB);
  const afterEvents = await http2.query(api.nervous.events, { workflowId: WF });
  const afterSnap = await http2.query(api.nervous.snapshot, { workflowId: WF });
  const afterTotal = await http2.query(api.nervous.totalEvents, {});
  check('SETTLED state SURVIVED the crash: 2 durable events', afterEvents.length === 2);
  check('atomic snapshot survived and still agrees: eventCount 2', afterSnap.eventCount === 2);
  check('global durable count unchanged across the crash', afterTotal === total);

  // ── PROOF 4: restart produces no duplicate effect ────────────────────────────────────────────────
  log('PROOF 4 — restart produces no duplicate effect');
  const replay1 = await http2.mutation(api.nervous.appendEventOnce, e1); // at-least-once redelivery post-crash
  const replay2 = await http2.mutation(api.nervous.appendEventOnce, e2);
  check('both redeliveries deduplicate (no new effect)', replay1.deduplicated === true && replay2.deduplicated === true);
  check('durable log STILL exactly 2 rows — no duplicate effect after restart', (await http2.query(api.nervous.events, { workflowId: WF })).length === 2);

  // ── authority refusal (boundary) ─────────────────────────────────────────────────────────────────
  const authEvt = { ...mkEvent('authority-claim'), grantsAuthority: true };
  const refused = await http2.mutation(api.nervous.appendEventOnce, authEvt);
  check('authority-claiming event REFUSED, not persisted', refused.ok === false && refused.reason === 'refused-authority');
  check('durable log unchanged by the refused authority event', (await http2.query(api.nervous.events, { workflowId: WF })).length === 2);

  backend.kill('SIGKILL');
  log('');
  log(failed ? 'RESULT: FAIL (a real-backend law did not hold)' : 'RESULT: ALL REAL-BACKEND LAWS HELD');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('[r51-canary] FATAL', e); process.exit(2); });
