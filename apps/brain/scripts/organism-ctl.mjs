#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * organism-ctl — R47: a DELEGATING SHIM. The ONE lifecycle owner is `apps/supervisor` (WAVE 2 protected
 * class, donor #71/#26 law); this command keeps Sam 1's runbook verbs (`up | status | down`) and the R39
 * Node preflight, then hands the whole lifecycle to the supervisor. It starts NOTHING itself anymore —
 * two owners meant duplicate/zombie ownership of the mind door and the Spatial shell (R47 finding).
 *
 * What the supervisor now owns (policy.json, protected): convex-backend (3210, via convexHold.mjs) →
 * brain door 7141 (doorHold.mjs, bind-first resilience law) → mind door 7097 (+ R44 token custody:
 * supervisor-minted per-boot token in child env + one 0600 gitignored file) → voice sidecar 7098
 * (optional, loud degraded mode) → Spatial shell 7096 (receives the same token env for its governed proxy).
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHECKOUT = resolve(APP_DIR, '..', '..');
const SUPERVISOR = join(CHECKOUT, 'apps', 'supervisor', 'src', 'supervisor.mjs');
const NODE22 = '/opt/homebrew/opt/node@22/bin';
const SUPPORTED_NODE = [18, 20, 22, 24];

const log = (s) => console.log(`[organism] ${s}`);
const fail = (s, code = 1) => { console.error(`[organism] !! REFUSED: ${s}`); process.exit(code); };

// R39 Node preflight (kept here so runbooks fail LOUDLY before any lifecycle work): Convex node actions
// need Node 18/20/22/24; engage the side-installed Node 22 automatically when the ambient Node cannot.
function nodePath() {
  const major = Number(process.versions.node.split('.')[0]);
  if (SUPPORTED_NODE.includes(major)) return process.env.PATH ?? '';
  if (existsSync(join(NODE22, 'node'))) return `${NODE22}:${process.env.PATH ?? ''}`;
  fail(`Node ${process.versions.node} cannot run Convex node actions and no side-install found.\n  Fix: brew install node@22   (nothing was started)`);
}

const cmd = process.argv[2];
if (!['up', 'status', 'down', 'doctor'].includes(cmd ?? '')) fail(`unknown command "${cmd ?? ''}" — use: up | status | down | doctor`);
log(`delegating "${cmd}" to the ONE lifecycle owner: apps/supervisor (R47 convergence)`);
const r = spawnSync('node', [SUPERVISOR, cmd], {
  cwd: CHECKOUT,
  env: { ...process.env, PATH: nodePath() },
  stdio: 'inherit',
});
process.exit(r.status ?? 1);
