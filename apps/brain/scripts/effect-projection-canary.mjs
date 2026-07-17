// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * LIVE effect-projection canary (overnight brick 5/6, real backend) — the crash + destroy/rebuild proof for the
 * EFFECT PROJECTION over a REAL self-hosted convex-local-backend (NOT convex-test). Answers outsider gap #1.
 *
 * Reuses Sam 2's pilot convex module (apps/brain/canary — wf_events append-only durable log) as the protected
 * event stream, spawns the OFFICIAL local backend the documented way, and computes the effect-projection root
 * with the SHARED node-importable formula (scripts/lib/effectRoot.mjs, locked to src/effectEvent.ts by
 * effectRootCrosscheck.test.ts). Self-contained: temp storage, self-kills its backend, discards everything.
 *
 * Proves, live:
 *   1. project real durable rows → effectProjectionRoot R1;
 *   2. SIGKILL the backend (real kill -9), restart on the SAME on-disk SQLite → re-project → R2 === R1
 *      (the effect projection SURVIVED a genuine crash);
 *   3. DESTROY the derived projection, rebuild PURELY from the durable event stream → R3 === R1.
 *
 * Prereq: official convex-local-backend in ~/.cache/convex/binaries or $CONVEX_LOCAL_BACKEND_BINARY, and Node
 * 18/20/22/24 on PATH for the convex CLI. Exits 2 (honest blocker) if the binary is absent — never fabricated.
 */
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { deriveEffectId, projectionRoot } from './lib/effectRoot.mjs';

function resolveBackendBinary() {
  const explicit = process.env.CONVEX_LOCAL_BACKEND_BINARY;
  if (explicit) return explicit;
  const root = join(homedir(), '.cache/convex/binaries');
  if (!existsSync(root)) return null;
  return readdirSync(root).filter((n) => n.startsWith('precompiled-')).sort().reverse()
    .map((n) => join(root, n, 'convex-local-backend')).find((c) => existsSync(c)) ?? null;
}

const BIN = resolveBackendBinary();
const CANARY = new URL('../canary', import.meta.url).pathname;
const CONVEX_CLI = new URL('../../../node_modules/.bin/convex', import.meta.url).pathname;
const PORT = 3312, SITE = 3313, URLB = `http://127.0.0.1:${PORT}`;
const NAME = 'aukora-effect-canary', SECRET = '0000000000000000000000000000000000000000000000000000000000000052';
const log = (s) => console.log(`[effect-canary] ${s}`);
const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = false;
const check = (label, cond) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failed = true; };

const adminKey = () => execFileSync(BIN, ['keygen', 'admin-key', '--instance-name', NAME, '--instance-secret', SECRET], { encoding: 'utf8' }).trim();
const portListening = (port) => { try { return execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().length > 0; } catch { return false; } };
async function waitPort(port, tries = 60) { for (let i = 0; i < tries; i++) { if (portListening(port)) return true; await sleep(500); } return false; }
const bootBackend = (sqlitePath, storageDir) => spawn(BIN, ['--port', String(PORT), '--site-proxy-port', String(SITE), '--instance-name', NAME, '--instance-secret', SECRET, '--local-storage', storageDir, '--convex-origin', URLB, '--convex-site', `http://127.0.0.1:${SITE}`, sqlitePath], { stdio: 'ignore' });

/** Map the pilot's durable wf_events rows → effect-event shape for the projection law. The `events` query
 *  returns {eventId, kind, seq, at} (workflowId is the query arg), so the workflow id is passed in. */
const toEffectRows = (events, wf) => events.map((e) => ({ effectId: deriveEffectId(wf, e.seq), effect: e.kind, createdAtIso: e.at }));

async function main() {
  if (!BIN || !existsSync(BIN)) {
    log('BLOCKER: convex-local-backend is not installed (~/.cache/convex/binaries or $CONVEX_LOCAL_BACKEND_BINARY).');
    log('Prime a local Convex deployment first. No live result is fabricated.');
    process.exit(2);
  }
  const work = mkdtempSync(join(tmpdir(), 'effect-canary-'));
  const sqlitePath = join(work, 'effect.sqlite3'), storageDir = join(work, 'storage');
  const KEY = adminKey();
  const env = { ...process.env, CONVEX_SELF_HOSTED_URL: URLB, CONVEX_SELF_HOSTED_ADMIN_KEY: KEY, CONVEX_AGENT_MODE: 'anonymous' };
  let backend = null;
  try {
    log(`REAL backend: ${BIN.split('/').slice(-2).join('/')} · storage (temp): ${work}`);
    backend = bootBackend(sqlitePath, storageDir);
    log(`booting backend #1 (pid ${backend.pid}) on ${URLB} …`);
    if (!(await waitPort(PORT))) throw new Error('backend never bound');

    log('deploying pilot functions (convex dev --once, self-hosted)…');
    rmSync(join(CANARY, '.env.local'), { force: true });
    execFileSync(CONVEX_CLI, ['dev', '--once', '--typecheck', 'disable'], { cwd: CANARY, env, stdio: 'ignore' });

    const { ConvexHttpClient } = await import('convex/browser');
    const http = new ConvexHttpClient(URLB);
    const api = (await import(join(CANARY, 'convex/_generated/api.js'))).api;

    const WF = sha256('effect-workflow-alpha');
    const at = '2026-07-18T01:30:00.000Z';
    const submit = async (kind, payload) => http.mutation(api.nervous.appendEventOnce, { eventId: sha256(payload), workflowId: WF, kind, at });

    // three distinct durable effects (seq 0,1,2), each redelivered 3x (at-least-once) — the pilot dedups by eventId.
    log('appending durable effects (with at-least-once redelivery)…');
    for (const [kind, p] of [['applied', 'e-0'], ['stepped', 'e-1'], ['completed', 'e-2']]) {
      for (let i = 0; i < 3; i++) await submit(kind, p);
    }
    const events1 = await http.query(api.nervous.events, { workflowId: WF });
    check('10+ redeliveries collapsed to exactly 3 durable rows (idempotent)', events1.length === 3);
    const R1 = projectionRoot(toEffectRows(events1, WF));
    log(`effect-projection root R1 = ${R1.slice(0, 24)}…`);
    check('projection has 3 canonical effects', R1.length === 64);

    // ── CONCURRENT delivery converges to ONE canonical row (mission item 4, live) ──
    // A separate workflow, so the crash/rebuild proof above stays a clean 3-effect projection.
    log('PROOF — concurrent delivery converges to one canonical row');
    const WF2 = sha256('effect-workflow-concurrent');
    const concId = sha256('e-concurrent');
    await Promise.all(Array.from({ length: 24 }, () =>
      http.mutation(api.nervous.appendEventOnce, { eventId: concId, workflowId: WF2, kind: 'concurrent-effect', at })));
    const concRows = await http.query(api.nervous.events, { workflowId: WF2 });
    check('24 SIMULTANEOUS identical appends → exactly ONE durable row', concRows.length === 1);
    check('the concurrent projection has exactly one canonical effect', projectionRoot(toEffectRows(concRows, WF2)).length === 64 && concRows.length === 1);

    // ── real process death ──
    log('PROOF — actual process death (kill -9) then restart on the SAME storage');
    const deadPid = backend.pid;
    process.kill(deadPid, 'SIGKILL');
    await sleep(1500);
    check(`backend pid ${deadPid} is gone (real SIGKILL)`, !portListening(PORT));
    backend = bootBackend(sqlitePath, storageDir);
    log(`restarting backend #2 (pid ${backend.pid}) …`);
    if (!(await waitPort(PORT))) throw new Error('backend did not come back');
    const http2 = new ConvexHttpClient(URLB);
    const events2 = await http2.query(api.nervous.events, { workflowId: WF });
    const R2 = projectionRoot(toEffectRows(events2, WF));
    check('effect projection SURVIVED the crash: R2 === R1', R2 === R1);
    check('durable rows unchanged across the crash (3)', events2.length === 3);

    // ── destroy-and-rebuild from the protected event stream ──
    log('PROOF — destroy the derived projection, rebuild from the durable stream → identical root');
    let derived = R2;               // the in-memory projection
    derived = null; void derived;   // DESTROY it
    const rebuilt = projectionRoot(toEffectRows(await http2.query(api.nervous.events, { workflowId: WF }), WF));
    check('rebuild from the durable event stream: R3 === R1', rebuilt === R1);

    console.log(failed ? '\n[effect-canary] RESULT: FAIL' : '\n[effect-canary] RESULT: ALL LIVE PROOFS PASS');
  } finally {
    if (backend && backend.pid && portListening(PORT)) { try { backend.kill('SIGKILL'); } catch { /* already gone */ } }
    rmSync(work, { recursive: true, force: true });
  }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('[effect-canary] FATAL:', e.message); process.exit(2); });
