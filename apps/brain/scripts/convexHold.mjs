#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * convexHold — R47: the local self-hosted Convex backend as ONE supervisable process.
 *
 * The R39 organism-ctl ran "deploy once, then hold" as two child invocations it managed itself. Under the ONE
 * lifecycle owner (apps/supervisor), each service is a single PID — this wrapper IS that PID: it deploys the
 * functions once (`convex dev --once`) and then holds the anonymous LOCAL deployment in the foreground. SIGTERM
 * to this process tears the backend down with it (no detach, no orphan). LOCAL ONLY — anonymous agent mode,
 * loopback 3210/3211; no cloud, no managed Convex, no keys.
 */
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NODE22 = '/opt/homebrew/opt/node@22/bin';
const SUPPORTED = [18, 20, 22, 24];

const major = Number(process.versions.node.split('.')[0]);
const PATH = SUPPORTED.includes(major) ? (process.env.PATH ?? '')
  : existsSync(join(NODE22, 'node')) ? `${NODE22}:${process.env.PATH ?? ''}`
  : null;
if (PATH === null) {
  console.error(`[convex-hold] REFUSED: Node ${process.versions.node} cannot run Convex node actions and no side-install found`);
  process.exit(1);
}
const env = { ...process.env, PATH, CONVEX_AGENT_MODE: 'anonymous' };

console.log('[convex-hold] deploying functions to the anonymous LOCAL deployment…');
execFileSync('npx', ['convex', 'dev', '--once', '--codegen', 'disable', '--typecheck', 'disable'], { cwd: APP_DIR, env, stdio: 'pipe' });
console.log('[convex-hold] holding the local backend (3210/3211) in the foreground');
const child = spawn('npx', ['convex', 'dev', '--tail-logs', 'disable', '--codegen', 'disable', '--typecheck', 'disable'], { cwd: APP_DIR, env, stdio: 'ignore' });
const stop = (sig) => { try { child.kill(sig); } catch { /* gone */ } };
process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT', () => stop('SIGINT'));
child.on('exit', (code) => process.exit(code ?? 0));
