#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * doorHold — R47: the always-held 7141 brain door as ONE supervisable process.
 *
 * Bundles `doorServerMain.ts` with the repo's own esbuild (exactly what organism-ctl did) and then runs it
 * IN-PROCESS, so the PID the supervisor records is the PID that holds the port. The door's resilience law is
 * unchanged: bind first, answer 502 per request while the backend is unreachable, never die with the backend.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHECKOUT = resolve(APP_DIR, '..', '..');
const OUT_DIR = join(APP_DIR, '.local', 'organism');
const OUT = join(OUT_DIR, 'door-server.mjs');

mkdirSync(OUT_DIR, { recursive: true });
execFileSync('npx', ['esbuild', 'apps/brain/scripts/doorServerMain.ts', '--bundle', '--platform=node', '--format=esm', '--target=node20', `--outfile=${OUT}`], { cwd: CHECKOUT, env: process.env, stdio: 'pipe' });
await import(pathToFileURL(OUT).href);
