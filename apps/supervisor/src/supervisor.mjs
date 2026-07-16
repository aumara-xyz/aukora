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
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { planUp, planDown, planSwap, deriveStatus } from './engine.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..');
const REPO = resolve(APP, '..', '..');
const STATE_DIR = join(APP, 'state');
const RECEIPTS = join(STATE_DIR, 'receipts.jsonl');
const STATE = join(STATE_DIR, 'state.json');
const policy = JSON.parse(readFileSync(join(APP, 'policy.json'), 'utf8'));

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
// The mind door prints a one-time POST token to ITS stdout. As lifecycle owner we capture it in
// process memory only (never a file, never a receipt) and hand it to the shell launcher's env — the
// same custody path as the manual flow, with zero disk exposure.
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
      if (m) { capturedEnv.AUKORA_DOOR_TOKEN = m[1]; child.stdout.destroy(); }
    });
  }
  child.unref();
  writeFileSync(join(STATE_DIR, `${svc.name}.${port}.pid`), String(child.pid));
  return child.pid;
}
async function waitReady(svc, port) {
  for (let i = 0; i < policy.probe.retries; i++) {
    const o = await probe(port, svc.probePath, svc.identityMarker);
    if (o.identityOk === true) return true;
    await new Promise((r) => setTimeout(r, policy.probe.intervalMs));
  }
  return false;
}
function stopOurs(svc, port) {
  // squat defense: only a PID we recorded, and only after the identity probe said UP-OURS.
  const pidFile = join(STATE_DIR, `${svc.name}.${port}.pid`);
  let pid = existsSync(pidFile) ? Number(readFileSync(pidFile, 'utf8').trim()) : null;
  if (!pid) { // fall back to port PID, but ONLY because identity was verified ours by the caller
    try { pid = Number(execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t']).toString().trim().split('\n')[0]); } catch { pid = null; }
  }
  if (pid) { try { process.kill(pid); } catch { /* already gone — idempotent */ } }
  return pid;
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
      receipt('started', { service: svc.name, port, pid, candidate: stepItem.candidate === true });
      const ok = await waitReady(svc, port);
      receipt(ok ? 'ready' : 'not-ready', { service: svc.name, port, candidate: stepItem.candidate === true });
      if (!ok && !svc.optional && !stepItem.candidate) receipt('boot-degraded', { service: svc.name, port, reason: 'readiness probe never verified identity' });
      continue;
    }
    if (stepItem.action === 'stop') {
      if (stepItem.afterGraceMs) await new Promise((r) => setTimeout(r, stepItem.afterGraceMs));
      const pid = stopOurs(svc, stepItem.port);
      receipt('stopped', { service: svc.name, port: stepItem.port, pid, reason: stepItem.reason, candidate: stepItem.candidate === true });
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
  if (cmd === 'up') { receipt('up-requested', {}); await executePlan(planUp(pol, obs), obs); writeGatewayState(); return; }
  if (cmd === 'down') { receipt('down-requested', {}); await executePlan(planDown(pol, obs), obs); return; }
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
