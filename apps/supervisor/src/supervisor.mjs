// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * The supervisor node adapter (WAVE 2). Observes the world, asks the PURE engine for a bounded plan,
 * executes it, and RECEIPTS every transition (content-free JSONL). It owns lifecycle and nothing else:
 * it cannot sign, promote, widen authority, or change kernel law — those verbs do not exist here, and
 * the engine's closed envelope refuses them structurally.
 *
 * Protected class: boot re-verifies protected.sha256 over src/ + policy.json and REFUSES to run on a
 * mismatch (receipted 'integrity-refused'). Proposal paths must not edit these files (PROTECTED.md).
 *
 * Restart-safe: no in-memory truth. Every invocation re-observes ports + identity probes; receipts are
 * append-only evidence, state.json is a rebuildable projection for the gateway (claim, not authority).
 */
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { planUp, planDown, planSwap, deriveStatus } from './engine.mjs';
// R47 convergence: the ONE custody module (R44 law) — the lifecycle owner MINTS the per-boot mind-door token
// and preserves it in exactly two places: the child env and ONE 0600 file under the gitignored organism dir.
import {
  DOOR_TOKEN_ENV, TOKEN_LOG_LAW, mintDoorToken, writeTokenFile, clearTokenFile,
} from '../../brain/scripts/doorCustody.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..');
const REPO = resolve(APP, '..', '..');
const STATE_DIR = join(APP, 'state');
const RECEIPTS = join(STATE_DIR, 'receipts.jsonl');
const STATE = join(STATE_DIR, 'state.json');
const policy = JSON.parse(readFileSync(join(APP, 'policy.json'), 'utf8'));

// R44c PID-file law: only a real positive-integer PID may ever be recorded. A failed optional
// spawn (child.pid === undefined) must leave NO pid file, so bounded teardown stays bounded.
export const validPid = (pid) => Number.isInteger(pid) && pid > 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── process-group custody (R51 · issue #107) ───────────────────────────────────────────────────────
// Twice-witnessed at R50: the supervisor recorded the `npx` WRAPPER pid while the actual listening child
// (mind-door) survived wrapper death, and the local Convex backend outlived its wrapper at teardown. The
// fix is to OWN THE PROCESS GROUP. Every service is spawned `detached`, so the child is a session/group
// leader (child.pid === pgid) and the whole tree beneath it shares that pgid; teardown signals the GROUP
// (`kill(-pgid)`). A port-verified belt then reaps any listener that escaped the group into its own session
// (Convex daemonizes its backend) — but ONLY when it is provably ours: the boot listener we recorded still
// holding our owned port, or a pid still in our recorded group. A foreign listener is in neither, so it is
// reported, never killed. No authority, signer, or owner key exists anywhere in this path.
const PID_SCHEMA = 'aukora-supervisor-pidrec-v1';
const pidPath = (name, port) => join(STATE_DIR, `${name}.${port}.pid`);

/** True process-group id of a live pid (`ps -o pgid=`), or null if the pid is gone/unreadable. */
export function pgidOf(pid) {
  if (!validPid(pid)) return null;
  try {
    const pgid = Number(execFileSync('ps', ['-o', 'pgid=', '-p', String(pid)], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim());
    return validPid(pgid) ? pgid : null;
  } catch { return null; }
}

/** The pid currently LISTENING on a loopback TCP port (`lsof`), or null when the port is free. */
export function listenerPidOnPort(port) {
  try {
    const pid = Number(execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().split('\n')[0]);
    return validPid(pid) ? pid : null;
  } catch { return null; }
}

/** Liveness of a single pid with no side effect (signal 0). */
export function isAlive(pid) {
  if (!validPid(pid)) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

/** Signal an entire process GROUP (negative pid). Idempotent — a gone group is a success, never a throw. */
export function killGroup(pgid, signal) {
  if (!validPid(pgid)) return false;
  try { process.kill(-pgid, signal); return true; } catch { return false; }
}

/** True if any process in the group still exists (signal 0 to the group). */
export function groupAlive(pgid) {
  return killGroup(pgid, 0);
}

/** Read a pid record; tolerant of the legacy bare-integer file (R44c) — a poisoned/legacy file degrades to
 *  a wrapper-only record or null, and never throws. */
export function readPidRecord(name, port) {
  const p = pidPath(name, port);
  if (!existsSync(p)) return null;
  const raw = readFileSync(p, 'utf8').trim();
  try {
    const rec = JSON.parse(raw);
    if (rec && typeof rec === 'object' && rec.schema === PID_SCHEMA) return rec;
  } catch { /* fall through to the legacy bare-integer format */ }
  const legacy = Number(raw);
  return validPid(legacy) ? { schema: PID_SCHEMA, name, port, wrapperPid: legacy, pgid: legacy, listenerPid: null } : null;
}

// ── protected-class integrity: refuse to run if the pinned surface drifted ─────────────────────────
export function verifyProtected() {
  const pins = readFileSync(join(APP, 'protected.sha256'), 'utf8').trim().split('\n').map((l) => l.split(/\s{2,}| /));
  const bad = [];
  for (const [sha, rel] of pins) {
    if (!rel) continue;
    const actual = createHash('sha256').update(readFileSync(join(APP, rel))).digest('hex');
    if (actual !== sha) bad.push(rel);
  }
  return bad;
}

function receipt(kind, detail = {}) {
  mkdirSync(STATE_DIR, { recursive: true });
  const entry = { at: new Date().toISOString(), kind, ...detail, grantsAuthority: false };
  appendFileSync(RECEIPTS, JSON.stringify(entry) + '\n');
  console.log(`▸ ${kind}${detail.service ? ' · ' + detail.service : ''}${detail.reason ? ' — ' + detail.reason : ''}${detail.port ? ' :' + detail.port : ''}`);
  return entry;
}

// ── observation: ports + identity probes + squat defense ───────────────────────────────────────────
async function probe(port, path, marker) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, { signal: AbortSignal.timeout(policy.probe.timeoutMs) });
    const text = await res.text();
    return { portOpen: true, identityOk: text.includes(marker) };
  } catch { return { portOpen: await portOpen(port), identityOk: null }; }
}
function portOpen(port) {
  try { return execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().length > 0; }
  catch { return false; }
}
// After a verified swap the ACTIVE port differs from the policy claim; the state projection carries it.
// It is still only a claim — observation happens against it, and probes decide the truth.
function effectivePolicy() {
  let st = {};
  try { st = JSON.parse(readFileSync(STATE, 'utf8')).services ?? {}; } catch { /* no state yet */ }
  return { ...policy, services: policy.services.map((s) => st[s.name]?.activePort ? { ...s, port: st[s.name].activePort } : s) };
}
async function observeAll(pol) {
  const out = {};
  for (const svc of pol.services) out[svc.name] = await probe(svc.port, svc.probePath, svc.identityMarker);
  return out;
}

// ── execution of the bounded plan ──────────────────────────────────────────────────────────────────
// R47 (R44 law): the lifecycle owner MINTS the per-boot token BEFORE the mind door starts and hands it to
// the mind-door child AND the shell launcher via env (`AUKORA_DOOR_TOKEN`), plus ONE 0600 file under the
// gitignored apps/brain/.local/organism dir for local operator tools. The value is never logged, never in a
// receipt, never served. Stdout capture below remains only as a FALLBACK for a pre-R44b runner that mints
// its own token and prints it.
const BRAIN_ORG_DIR = join(REPO, 'apps', 'brain', '.local', 'organism');
const capturedEnv = {};
function startService(svc, port) {
  const [cmd, ...args] = svc.workspaceCmd;
  const wantsToken = svc.name === 'mind-door';
  const child = spawn(cmd.startsWith('apps/') ? join(REPO, cmd) : cmd, args, {
    cwd: REPO, detached: true, stdio: ['ignore', wantsToken ? 'pipe' : 'ignore', 'ignore'],
    env: { ...process.env, PORT: String(port), AUKORA_VOICE_PORT: String(port), ...capturedEnv },
  });
  // A missing binary (e.g. an optional service's venv not present on this tree) emits an async 'error'
  // event; unhandled it would kill the WHOLE plan. Catch → the readiness probe then reports not-ready
  // and optional services degrade LOUDLY instead of crashing the lifecycle owner (R44 live catch).
  child.on('error', () => { /* receipted as not-ready by waitReady */ });
  if (wantsToken && child.stdout) {
    let buf = '';
    child.stdout.on('data', (c) => {
      buf += c.toString();
      const m = buf.match(/local POST token[^:]*:\s*([0-9a-f]{32,})/);
      // FALLBACK only (pre-R44b runner): the supervisor-minted token always wins; never overwrite it.
      if (m) { if (!capturedEnv[DOOR_TOKEN_ENV]) capturedEnv[DOOR_TOKEN_ENV] = m[1]; child.stdout.destroy(); }
    });
    // R51: unref the capture pipe so it never keeps the event loop alive. Since R44b the supervisor MINTS and
    // injects the token, this stdout read is a legacy fallback only; without the unref the retained pipe kept the
    // one-shot `up`/`down` CLI process from ever exiting (the detached child owns its own lifecycle regardless).
    child.stdout.unref();
  }
  child.unref();
  // R44c: a failed spawn leaves child.pid undefined — a PID file may only ever hold a real positive
  // integer, or bounded teardown could act on the literal string "undefined". R51: `detached` makes
  // child.pid a group leader, so pgid === child.pid — the whole tree under this service is one group.
  const record = JSON.stringify({ schema: PID_SCHEMA, name: svc.name, port, wrapperPid: child.pid, pgid: child.pid, listenerPid: null });
  if (validPid(child.pid)) {
    writeFileSync(pidPath(svc.name, port), record);
  }
  return child.pid;
}
/** After readiness, record the ACTUAL listener pid on the port — the value R50 proved diverges from the
 *  wrapper — so teardown can reap a listener that escaped the group into its own session. Returns it. */
function recordListener(svc, port) {
  const rec = readPidRecord(svc.name, port);
  if (rec === null) return null;
  const listenerPid = listenerPidOnPort(port);
  writeFileSync(pidPath(svc.name, port), JSON.stringify({ ...rec, listenerPid }));
  return listenerPid;
}
async function waitReady(svc, port) {
  for (let i = 0; i < policy.probe.retries; i++) {
    const o = await probe(port, svc.probePath, svc.identityMarker);
    if (o.identityOk === true) return true;
    await new Promise((r) => setTimeout(r, policy.probe.intervalMs));
  }
  return false;
}
/**
 * Terminate a service WE started by signalling the whole owned GROUP (SIGTERM → grace → SIGKILL), then a
 * port-verified belt for a listener that escaped the group into its own session (Convex daemonizes). The
 * belt kills ONLY a listener that is provably ours — still in our recorded group, or the exact boot listener
 * we recorded still holding our owned port. A listener that is neither is FOREIGN: reported, never killed
 * (the R50 squat-defense law, now at pid granularity). Idempotent; removes the pid record on success.
 */
async function stopOurs(svc, port, gracefulStopMs = 1500) {
  const rec = readPidRecord(svc.name, port);
  const pgid = rec?.pgid ?? (rec?.wrapperPid ? pgidOf(rec.wrapperPid) : null) ?? pgidOf(listenerPidOnPort(port));
  const wrapperPid = rec?.wrapperPid ?? null;
  const recordedListener = rec?.listenerPid ?? null;

  // 1) signal the whole group (falls back to the lone wrapper only if no group is resolvable)
  if (validPid(pgid)) killGroup(pgid, 'SIGTERM');
  else if (isAlive(wrapperPid)) { try { process.kill(wrapperPid, 'SIGTERM'); } catch { /* gone */ } }

  // 2) bounded grace, then SIGKILL the group if the leader survived or the port is still held
  await sleep(Math.max(0, gracefulStopMs));
  if ((validPid(pgid) && groupAlive(pgid)) || portOpen(port)) {
    if (validPid(pgid)) killGroup(pgid, 'SIGKILL');
    await sleep(200);
  }

  // 3) port-verified belt: an escaped listener is reaped ONLY when provably ours; a foreign one is reported
  let residueForeign = false;
  const stillPid = listenerPidOnPort(port);
  if (validPid(stillPid)) {
    const oursByGroup = validPid(pgid) && pgidOf(stillPid) === pgid;
    const oursByRecord = validPid(recordedListener) && stillPid === recordedListener;
    if (oursByGroup || oursByRecord) {
      try { process.kill(stillPid, 'SIGTERM'); } catch { /* gone */ }
      await sleep(200);
      if (isAlive(stillPid)) { try { process.kill(stillPid, 'SIGKILL'); } catch { /* gone */ } await sleep(150); }
    } else {
      residueForeign = true; // neither in our group nor our recorded boot listener — NEVER killed
    }
  }

  const portEmpty = !portOpen(port);
  if (portEmpty) { try { if (existsSync(pidPath(svc.name, port))) rmSync(pidPath(svc.name, port)); } catch { /* best-effort */ } }
  return { pgid, wrapperPid, listenerPid: recordedListener, portEmpty, residueForeign };
}

/** After a full `down`, re-observe every OWNED port. Any still-open owned port is residue; a port left open
 *  by a foreign occupant we correctly refused to kill is flagged foreign (expected), not a teardown failure. */
function verifyOwnedPortsEmpty(pol, obs) {
  const residue = [];
  for (const svc of pol.services) {
    if (svc.external) continue;
    if (!portOpen(svc.port)) continue;
    const wasForeign = obs[svc.name]?.identityOk === false;
    residue.push({ service: svc.name, port: svc.port, listenerPid: listenerPidOnPort(svc.port), foreign: wasForeign });
  }
  return residue;
}

async function executePlan(plan, observations) {
  for (const stepItem of plan) {
    const svc = policy.services.find((s) => s.name === stepItem.service);
    if (stepItem.action === 'isolate') { receipt('isolated', { service: svc.name, port: stepItem.port, reason: stepItem.reason }); continue; }
    if (stepItem.action === 'probe') {
      const o = await probe(stepItem.port ?? svc.port, svc.probePath, svc.identityMarker);
      receipt('probed', { service: svc.name, port: stepItem.port ?? svc.port, state: o.identityOk === true ? 'UP-OURS' : (o.portOpen ? 'UNVERIFIED' : 'DOWN'), external: svc.external === true });
      continue;
    }
    if (stepItem.action === 'start') {
      const port = stepItem.port ?? svc.port;
      const pid = startService(svc, port);
      receipt('started', { service: svc.name, port, wrapperPid: pid, pgid: pid, candidate: stepItem.candidate === true });
      const ok = await waitReady(svc, port);
      // R51: record + receipt the ACTUAL listener pid; wrapperIsListener:false is the exact R50 divergence.
      const listenerPid = ok ? recordListener(svc, port) : null;
      receipt(ok ? 'ready' : 'not-ready', { service: svc.name, port, wrapperPid: pid, listenerPid, wrapperIsListener: listenerPid === pid, candidate: stepItem.candidate === true });
      if (!ok && !svc.optional && !stepItem.candidate) receipt('boot-degraded', { service: svc.name, port, reason: 'readiness probe never verified identity' });
      continue;
    }
    if (stepItem.action === 'stop') {
      if (stepItem.afterGraceMs) await new Promise((r) => setTimeout(r, stepItem.afterGraceMs));
      const r = await stopOurs(svc, stepItem.port, stepItem.gracefulStopMs);
      receipt('stopped', { service: svc.name, port: stepItem.port, pgid: r.pgid, wrapperPid: r.wrapperPid, listenerPid: r.listenerPid, portEmpty: r.portEmpty, residueForeign: r.residueForeign, reason: stepItem.reason, candidate: stepItem.candidate === true });
      continue;
    }
    if (stepItem.action === 'swap') {
      writeGatewayState({ [svc.name]: { activePort: stepItem.to } });
      receipt('swapped', { service: svc.name, from: stepItem.from, to: stepItem.to, graceMs: stepItem.graceMs });
      continue;
    }
    if (stepItem.action === 'rollback') { receipt('rollback', { service: svc.name, keep: stepItem.keep, reason: stepItem.reason }); continue; }
    if (stepItem.action === 'contract') { receipt('contracted', { service: svc.name, port: stepItem.port }); continue; }
    if (stepItem.action === 'status') { receipt('status', stepItem); continue; }
  }
}

function writeGatewayState(overrides = {}) {
  mkdirSync(STATE_DIR, { recursive: true });
  const prev = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : { schema: 'aukora-supervisor-state-v1', services: {} };
  for (const [k, v] of Object.entries(overrides)) prev.services[k] = { ...(prev.services[k] ?? {}), ...v };
  prev.updatedAt = new Date().toISOString();
  prev.grantsAuthority = false;
  writeFileSync(STATE, JSON.stringify(prev, null, 2) + '\n');
}

// ── commands (owner CLI — the supervisor has NO network control surface) ───────────────────────────
async function main() {
  const cmd = process.argv[2] ?? 'status';
  const bad = verifyProtected();
  if (bad.length) { receipt('integrity-refused', { files: bad, reason: 'protected surface drifted from protected.sha256 — refusing to act' }); process.exit(3); }

  const pol = effectivePolicy();
  const obs = await observeAll(pol);
  if (cmd === 'status' || cmd === 'doctor') {
    const status = deriveStatus(pol, obs);
    if (cmd === 'doctor') {
      // read-only preflight in the donor doctor.ts spirit: never-throw probes, no keys/paths/contents.
      status.custodyHome = { present: existsSync(join(process.env.HOME ?? '', '.aukora-symbiote')), note: 'existence boolean only — contents never read' };
      status.gatewayPort = policy.gateway.port;
    }
    console.log(JSON.stringify(status, null, 2));
    receipt('status-read', { services: status.services.map((s) => s.name + '=' + s.state).join(' ') });
    return;
  }
  if (cmd === 'up') {
    receipt('up-requested', {});
    // R47 (R44 law): mint the per-boot token FIRST — env for the mind-door + shell children, one 0600 file
    // under the gitignored organism dir. The receipt names the LAW, never the value.
    capturedEnv[DOOR_TOKEN_ENV] = mintDoorToken();
    writeTokenFile(BRAIN_ORG_DIR, capturedEnv[DOOR_TOKEN_ENV]);
    receipt('token-custody', { law: TOKEN_LOG_LAW });
    await executePlan(planUp(pol, obs), obs);
    writeGatewayState();
    return;
  }
  if (cmd === 'down') {
    receipt('down-requested', {});
    await executePlan(planDown(pol, obs), obs);
    clearTokenFile(BRAIN_ORG_DIR); // the per-boot token dies with the boot (R44)
    receipt('token-cleared', {});
    // R51: prove every OWNED port is released. A foreign occupant we refused to kill is flagged, not a failure.
    const residue = verifyOwnedPortsEmpty(pol, obs);
    const ourResidue = residue.filter((r) => !r.foreign);
    receipt(ourResidue.length === 0 ? 'teardown-verified' : 'teardown-residue', {
      ownedPorts: pol.services.filter((s) => !s.external).map((s) => `${s.name}:${s.port}`).join(' '),
      residue,
    });
    console.log(JSON.stringify({ teardown: ourResidue.length === 0 ? 'clean' : 'residue', ownedPortsEmpty: ourResidue.length === 0, residue }, null, 2));
    if (ourResidue.length) process.exitCode = 4; // loud, non-silent: an owned port outlived down
    return;
  }
  if (cmd === 'swap') {
    const name = process.argv[3];
    receipt('swap-requested', { service: name });
    await executePlan(planSwap(pol, name, null), obs);                          // candidate boot + probe
    const svc = pol.services.find((s) => s.name === name);
    const candObs = await probe(svc.candidatePort, svc.probePath, svc.identityMarker);
    await executePlan(planSwap(pol, name, candObs), obs);                       // verified → swap+grace-stop · failed → kill candidate + rollback
    return;
  }
  console.error(`unknown command '${cmd}' — envelope: up · down · status · doctor · swap <service>`);
  process.exit(2);
}

const isDirect = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) main().catch((e) => { receipt('supervisor-error', { reason: String(e && e.message ? e.message : e).slice(0, 160) }); process.exit(1); });
