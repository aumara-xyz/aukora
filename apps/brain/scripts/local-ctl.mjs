#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * local-ctl — SAFE orchestration of the LOCAL self-hosted Convex backend, scoped to THIS checkout (R38).
 *
 * Commands: up · hold · health · status · down
 *
 * Ownership law: the held process's PID is recorded in `.local/brain.pid` with a lockfile naming THIS checkout;
 * `down` signals ONLY that recorded PID, and only after verifying the live process's command line belongs to
 * this checkout — NEVER a global pkill, so concurrent Aukora checkouts cannot kill each other.
 *
 * Node preflight: Convex "use node" actions require Node 18/20/22/24. If neither the running Node nor a known
 * side-install qualifies, `up`/`hold` REFUSE LOUDLY with instructions (no silent degradation).
 */
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHECKOUT = resolve(APP_DIR, '..', '..');
const LOCAL_DIR = join(APP_DIR, '.local');
const PID_FILE = join(LOCAL_DIR, 'brain.pid');
const LOCK_FILE = join(LOCAL_DIR, 'brain.lock');
const SUPPORTED_NODE = [18, 20, 22, 24];
const NODE22 = '/opt/homebrew/opt/node@22/bin';

function log(line) { console.log(`[local-ctl] ${line}`); }
function fail(line, code = 1) { console.error(`[local-ctl] REFUSED: ${line}`); process.exit(code); }

function preflightNodePath() {
  const major = Number(process.versions.node.split('.')[0]);
  if (SUPPORTED_NODE.includes(major)) return process.env.PATH ?? '';
  if (existsSync(join(NODE22, 'node'))) {
    log(`node ${process.versions.node} cannot run Convex "use node" actions — using the side-installed Node 22 at ${NODE22}`);
    return `${NODE22}:${process.env.PATH ?? ''}`;
  }
  fail(
    `unsupported Node ${process.versions.node} for Convex node actions (need 18/20/22/24) and no side-install found.\n` +
    `  Install one alongside your Node:  brew install node@22\n` +
    `  Then re-run. Nothing was started.`,
  );
}

function readOwnedPid() {
  if (!existsSync(PID_FILE) || !existsSync(LOCK_FILE)) return null;
  const lock = readFileSync(LOCK_FILE, 'utf8').trim();
  if (lock !== CHECKOUT) fail(`lockfile names a different checkout (${lock}) — refusing to touch its processes`);
  const pid = Number(readFileSync(PID_FILE, 'utf8').trim());
  return Number.isInteger(pid) && pid > 1 ? pid : null;
}

function pidAlive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

/** The live process must visibly belong to THIS checkout before we may signal it: its command line names the
 * checkout, OR its working directory (lsof cwd) resolves inside it. */
function pidBelongsToCheckout(pid) {
  try {
    const args = execFileSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' });
    if (args.includes(CHECKOUT)) return true;
  } catch {
    return false;
  }
  try {
    const cwdLine = execFileSync('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], { encoding: 'utf8' });
    return cwdLine.split('\n').some((l) => l.startsWith('n') && l.slice(1).startsWith(CHECKOUT));
  } catch {
    return false;
  }
}

function backendListening() {
  try {
    const out = execFileSync('lsof', ['-nP', '-iTCP:3210', '-sTCP:LISTEN', '-t'], { encoding: 'utf8' }).trim();
    return out.length > 0;
  } catch {
    return false;
  }
}

function env() {
  return { ...process.env, PATH: preflightNodePath(), CONVEX_AGENT_MODE: 'anonymous' };
}

const command = process.argv[2];

switch (command) {
  case 'up': {
    log('deploying to the anonymous LOCAL deployment (convex dev --once)…');
    const r = spawn('npx', ['convex', 'dev', '--once', '--codegen', 'disable', '--typecheck', 'disable'], { cwd: APP_DIR, env: env(), stdio: 'inherit' });
    r.on('exit', (code) => process.exit(code ?? 1));
    break;
  }
  case 'hold': {
    const existing = readOwnedPid();
    if (existing && pidAlive(existing)) fail(`already holding (pid ${existing}) — run status or down first`);
    mkdirSync(LOCAL_DIR, { recursive: true });
    const child = spawn('npx', ['convex', 'dev', '--tail-logs', 'disable', '--codegen', 'disable', '--typecheck', 'disable'], {
      cwd: APP_DIR, env: env(), stdio: 'ignore', detached: true,
    });
    child.unref();
    writeFileSync(PID_FILE, String(child.pid));
    writeFileSync(LOCK_FILE, CHECKOUT);
    log(`holding backend (cli pid ${child.pid}); pidfile ${PID_FILE}`);
    break;
  }
  case 'health': {
    const r = spawn('npx', ['convex', 'run', 'memory:health'], { cwd: APP_DIR, env: env(), stdio: 'inherit' });
    r.on('exit', (code) => process.exit(code ?? 1));
    break;
  }
  case 'status': {
    const pid = readOwnedPid();
    const held = pid !== null && pidAlive(pid);
    log(`checkout: ${CHECKOUT}`);
    log(`held cli pid: ${held ? pid : 'none'}${held && !pidBelongsToCheckout(pid) ? ' (WARNING: cmdline not verifiable)' : ''}`);
    log(`backend listening on 3210: ${backendListening()}`);
    process.exit(held || backendListening() ? 0 : 1);
  }
  case 'down': {
    const pid = readOwnedPid();
    if (pid === null) { log('nothing recorded for this checkout; nothing to stop (no global kill will ever run)'); process.exit(0); }
    if (pidAlive(pid)) {
      if (!pidBelongsToCheckout(pid)) fail(`pid ${pid} no longer looks like this checkout's process — refusing to signal it`);
      try { process.kill(-pid, 'SIGTERM'); } catch { process.kill(pid, 'SIGTERM'); } // the detached group holds cli+backend
      log(`sent SIGTERM to owned pid group ${pid}`);
    } else {
      log(`recorded pid ${pid} already gone`);
    }
    // backend children the group signal may have missed: only PIDs listening on OUR port whose cmdline verifies.
    try {
      const pids = execFileSync('lsof', ['-nP', '-iTCP:3210', '-sTCP:LISTEN', '-t'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
      for (const p of pids) {
        const n = Number(p);
        if (pidBelongsToCheckout(n)) { process.kill(n, 'SIGTERM'); log(`stopped verified backend pid ${n}`); }
        else log(`pid ${n} on 3210 does NOT verify as ours — left running`);
      }
    } catch { /* nothing listening */ }
    rmSync(PID_FILE, { force: true });
    rmSync(LOCK_FILE, { force: true });
    log('pidfile + lockfile cleared');
    break;
  }
  default:
    fail(`unknown command "${command ?? ''}" — use: up | hold | health | status | down`);
}
