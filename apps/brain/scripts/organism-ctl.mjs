#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * organism-ctl — the ROOT ORGANISM SUPERVISOR (R39), checkout-scoped, used by Sam 1.
 *
 * ONE command owns the whole local organism:
 *   up      deploy + start/own: local Convex (3210/3211) · brain door 7141 (ALWAYS HELD) · governed mind door
 *           7097 · voice 7098 (optional) · Spatial 7096 — each recorded as a PID group under
 *           apps/brain/.local/organism/ with a lockfile naming THIS checkout.
 *   status  per-service: recorded pid alive+verified, port listening. Exit 0 iff core (convex+door) healthy.
 *   down    reverse-order SIGTERM to RECORDED pid groups only, after per-pid ownership verification.
 *
 * Laws: NO global process matching (never pkill/killall); a port held by a process we cannot verify as ours is
 * REFUSED loudly — never killed, never reused. Node preflight: Convex node actions need Node 18/20/22/24; a
 * side-installed Node 22 is engaged automatically or `up` refuses loudly. Missing optional services degrade
 * LOUDLY, never silently.
 */
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHECKOUT = resolve(APP_DIR, '..', '..');
const ORG_DIR = join(APP_DIR, '.local', 'organism');
const LOCK_FILE = join(ORG_DIR, 'organism.lock');
const NODE22 = '/opt/homebrew/opt/node@22/bin';
const SUPPORTED_NODE = [18, 20, 22, 24];

const PORTS = { convex: 3210, convexSite: 3211, door: 7141, mind: 7097, voice: 7098, spatial: 7096 };
const log = (s) => console.log(`[organism] ${s}`);
const loud = (s) => console.error(`[organism] !! ${s}`);
const fail = (s, code = 1) => { loud(`REFUSED: ${s}`); process.exit(code); };

function nodePath() {
  const major = Number(process.versions.node.split('.')[0]);
  if (SUPPORTED_NODE.includes(major)) return process.env.PATH ?? '';
  if (existsSync(join(NODE22, 'node'))) return `${NODE22}:${process.env.PATH ?? ''}`;
  fail(`Node ${process.versions.node} cannot run Convex node actions and no side-install found.\n  Fix: brew install node@22   (nothing was started)`);
}

const env = () => ({ ...process.env, PATH: nodePath(), CONVEX_AGENT_MODE: 'anonymous', AUKORA_BRAIN_DOOR: `http://127.0.0.1:${PORTS.door}` });

const pidFile = (name) => join(ORG_DIR, `${name}.pid`);

function readPid(name) {
  if (!existsSync(pidFile(name))) return null;
  const pid = Number(readFileSync(pidFile(name), 'utf8').trim());
  return Number.isInteger(pid) && pid > 1 ? pid : null;
}

const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

function belongsToCheckout(pid) {
  try {
    if (execFileSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' }).includes(CHECKOUT)) return true;
  } catch { return false; }
  try {
    const cwd = execFileSync('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], { encoding: 'utf8' });
    return cwd.split('\n').some((l) => l.startsWith('n') && l.slice(1).startsWith(CHECKOUT));
  } catch { return false; }
}

function portOwner(port) {
  try {
    const out = execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' }).trim();
    return out ? Number(out.split('\n')[0]) : null;
  } catch { return null; }
}

function checkLock() {
  if (existsSync(LOCK_FILE)) {
    const lock = readFileSync(LOCK_FILE, 'utf8').trim();
    if (lock !== CHECKOUT) fail(`organism lock names a different checkout (${lock}) — refusing to touch it`);
  }
}

/** A port may be (re)used only if free, or held by a pid we can verify as this checkout's. */
function assertPortUsable(name, port) {
  const owner = portOwner(port);
  if (owner === null) return true;
  if (belongsToCheckout(owner)) { log(`${name}: port ${port} already held by this checkout (pid ${owner})`); return false; }
  loud(`${name}: port ${port} is held by pid ${owner} which does NOT verify as this checkout — refusing to kill or reuse it (service skipped, DEGRADED)`);
  return null; // foreign — skip service
}

function record(name, child) {
  writeFileSync(pidFile(name), String(child.pid));
  log(`${name}: started (pid ${child.pid})`);
}

function startDetached(name, cmd, args, extraEnv = {}, cwd = APP_DIR) {
  const child = spawn(cmd, args, { cwd, env: { ...env(), ...extraEnv }, stdio: 'ignore', detached: true });
  child.unref();
  record(name, child);
}

async function waitForPort(port, tries = 40) {
  for (let i = 0; i < tries; i++) {
    if (portOwner(port) !== null) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function bundle(entry, outfile) {
  execFileSync('npx', ['esbuild', entry, '--bundle', '--platform=node', '--format=esm', '--target=node20',
    `--outfile=${outfile}`], { cwd: CHECKOUT, env: env(), stdio: 'pipe' });
}

async function up() {
  checkLock();
  mkdirSync(ORG_DIR, { recursive: true });
  writeFileSync(LOCK_FILE, CHECKOUT);
  const degraded = [];

  // 1. local Convex backend (deploy once, then hold)
  const convexUsable = assertPortUsable('convex', PORTS.convex);
  if (convexUsable === null) fail('cannot own the Convex backend port — another checkout holds it; nothing else was started');
  if (convexUsable === true) {
    log('deploying functions to the anonymous LOCAL deployment…');
    execFileSync('npx', ['convex', 'dev', '--once', '--codegen', 'disable', '--typecheck', 'disable'], { cwd: APP_DIR, env: env(), stdio: 'pipe' });
    startDetached('convex', 'npx', ['convex', 'dev', '--tail-logs', 'disable', '--codegen', 'disable', '--typecheck', 'disable']);
    if (!(await waitForPort(PORTS.convex))) fail('convex backend never came up on 3210');
  }
  log(`convex: healthy on ${PORTS.convex}/${PORTS.convexSite}`);

  // 2. brain door 7141 — ALWAYS HELD, backed by the real store, reactive seam wired
  if (assertPortUsable('door', PORTS.door) === true) {
    const out = join(ORG_DIR, 'door-server.mjs');
    bundle('apps/brain/scripts/doorServerMain.ts', out);
    startDetached('door', 'node', [out]);
    if (!(await waitForPort(PORTS.door))) fail('brain door never came up on 7141');
  }
  log(`door: HELD on ${PORTS.door} (canonical brain projection/control door)`);

  // 3. governed mind door 7097 (Sam 3's) — degrade loudly if unavailable
  const mindEntry = join(CHECKOUT, 'apps/seed/scripts/mind-door-7097.ts');
  if (!existsSync(mindEntry)) { degraded.push('mind: entry not found on this tree'); loud('mind: not present — DEGRADED'); }
  else if (assertPortUsable('mind', PORTS.mind) === true) {
    try {
      const out = join(ORG_DIR, 'mind-door.mjs');
      bundle('apps/seed/scripts/mind-door-7097.ts', out);
      startDetached('mind', 'node', [out], {}, join(CHECKOUT, 'apps/seed'));
      if (!(await waitForPort(PORTS.mind, 20))) { degraded.push('mind: started but never bound 7097'); loud('mind: did not bind 7097 — DEGRADED'); }
      else log(`mind: healthy on ${PORTS.mind}`);
    } catch (err) {
      degraded.push(`mind: bundle/start failed (${String(err).slice(0, 120)})`);
      loud('mind: bundle/start failed — DEGRADED');
    }
  }

  // 4. voice 7098 — OPTIONAL; no standalone voice server exists on this tree yet
  degraded.push('voice: optional; no standalone voice sidecar on this tree (client-side audio lives in the Spatial app)');
  loud('voice: optional, not present — DEGRADED(optional)');

  // 5. Spatial shell 7096 — reads the brain door, never the raw backend
  const spatialEntry = join(CHECKOUT, 'apps/spatial/scripts/launch.mjs');
  if (!existsSync(spatialEntry)) { degraded.push('spatial: launcher not found'); loud('spatial: not present — DEGRADED'); }
  else if (assertPortUsable('spatial', PORTS.spatial) === true) {
    startDetached('spatial', 'node', [spatialEntry], { PORT: String(PORTS.spatial) }, join(CHECKOUT, 'apps/spatial'));
    if (!(await waitForPort(PORTS.spatial, 20))) { degraded.push('spatial: started but never bound 7096'); loud('spatial: did not bind 7096 — DEGRADED'); }
    else log(`spatial: healthy on ${PORTS.spatial} (projections via the 7141 door)`);
  }

  log(degraded.length ? `UP with ${degraded.length} degradation(s):` : 'UP: all services healthy');
  for (const d of degraded) loud(`  DEGRADED — ${d}`);
}

function status() {
  checkLock();
  let coreOk = true;
  log(`checkout: ${CHECKOUT}`);
  for (const [name, port] of Object.entries({ convex: PORTS.convex, door: PORTS.door, mind: PORTS.mind, spatial: PORTS.spatial })) {
    const pid = readPid(name);
    const held = pid !== null && alive(pid);
    const verified = held && belongsToCheckout(pid);
    const listening = portOwner(port) !== null;
    log(`${name}: pid=${held ? pid : 'none'}${held ? (verified ? ' (verified)' : ' (UNVERIFIED)') : ''} · port ${port} listening=${listening}`);
    if ((name === 'convex' || name === 'door') && !(listening)) coreOk = false;
  }
  process.exit(coreOk ? 0 : 1);
}

function down() {
  checkLock();
  if (!existsSync(ORG_DIR)) { log('nothing recorded; nothing to stop (no global matching will ever run)'); return; }
  for (const name of ['spatial', 'mind', 'voice', 'door', 'convex']) {
    const pid = readPid(name);
    if (pid === null) continue;
    if (alive(pid)) {
      if (!belongsToCheckout(pid)) { loud(`${name}: pid ${pid} does not verify as this checkout — LEFT RUNNING`); continue; }
      try { process.kill(-pid, 'SIGTERM'); } catch { try { process.kill(pid, 'SIGTERM'); } catch { /* gone */ } }
      log(`${name}: SIGTERM sent to owned pid group ${pid}`);
    } else {
      log(`${name}: recorded pid ${pid} already gone`);
    }
    rmSync(pidFile(name), { force: true });
  }
  // verified-only sweep of OUR ports (never a name match): a listener must verify as ours to be signalled.
  for (const [name, port] of Object.entries({ convex: PORTS.convex, door: PORTS.door, mind: PORTS.mind, spatial: PORTS.spatial })) {
    const owner = portOwner(port);
    if (owner !== null && belongsToCheckout(owner)) { try { process.kill(owner, 'SIGTERM'); log(`${name}: stopped verified straggler pid ${owner}`); } catch { /* gone */ } }
    else if (owner !== null) loud(`${name}: pid ${owner} on ${port} does NOT verify as ours — left running`);
  }
  rmSync(LOCK_FILE, { force: true });
  log('organism down; pidfiles + lock cleared');
}

const cmd = process.argv[2];
if (cmd === 'up') await up();
else if (cmd === 'status') status();
else if (cmd === 'down') down();
else fail(`unknown command "${cmd ?? ''}" — use: up | status | down`);
