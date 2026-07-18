#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
//
// R56 Sam 1 — the ONE deterministic measured source for the repo's test total.
// Runs the full `test:all` gate, parses every "Tests N passed | M skipped" line, and writes the
// summed measured total to docs/generated/test-totals.json. README badge + CLAIMS.md consume THIS
// number; scripts/verify-test-totals.mjs enforces their equality with it inside test:all.
//
// Run: `npm run measure:test-totals` (NOT part of test:all — it *runs* test:all). Regenerate whenever
// the suite count changes, then update the README badge + CLAIMS.md total to match (or verify fails).

import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const OUT = 'docs/generated/test-totals.json';

let log = '';
try {
  log = execSync('npm run test:all', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
} catch (e) {
  // test:all may exit non-zero; we still want whatever it printed to measure honestly.
  log = `${e.stdout || ''}${e.stderr || ''}`;
  if (!log) { console.error('measure-test-totals: test:all produced no output'); process.exit(1); }
}

const passed = [...log.matchAll(/Tests\s+(\d+) passed/g)].reduce((s, m) => s + Number(m[1]), 0);
const gatedSkips = [...log.matchAll(/(\d+) skipped/g)].reduce((s, m) => s + Number(m[1]), 0);

if (passed === 0) { console.error('measure-test-totals: parsed 0 passing tests — refusing to write a false measurement'); process.exit(1); }

const payload = {
  schema: 'aukora-test-totals-v1',
  note: 'MEASURED by scripts/measure-test-totals.mjs from a full `npm run test:all` run. The README badge and CLAIMS.md consume this number; scripts/verify-test-totals.mjs enforces equality in test:all. Do not hand-edit — regenerate.',
  passed,
  gatedSkips,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n');
console.log(`measure-test-totals: ${passed} passed, ${gatedSkips} gated-skipped -> ${OUT}`);
