#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
//
// R56 Sam 1 — README/CLAIMS test-total equality guard (runs inside test:all).
// Asserts the README badge number and the CLAIMS.md "Test totals: … N passing" both equal the ONE
// measured source docs/generated/test-totals.json. A stale hand-written number fails the gate.
// It does NOT re-run the suites (that is measure-test-totals.mjs' job) — it enforces that the three
// published surfaces agree, so no doc can drift from the measured reality.

import { readFileSync } from 'node:fs';

const src = JSON.parse(readFileSync('docs/generated/test-totals.json', 'utf8'));
const measured = src.passed;
const failures = [];

// README badge: [![Tests: N passing](…tests-N%20passing…)]
const readme = readFileSync('README.md', 'utf8');
const badge = readme.match(/tests-(\d+)%20passing/);
if (!badge) failures.push('README.md: no `tests-<N>%20passing` badge found.');
else if (Number(badge[1]) !== measured) failures.push(`README.md badge says ${badge[1]} but measured is ${measured}.`);

// CLAIMS.md: "… = **N passing**" on the Test totals line.
const claims = readFileSync('CLAIMS.md', 'utf8');
const line = claims.split('\n').find((l) => /Test totals/i.test(l));
if (!line) failures.push('CLAIMS.md: no "Test totals" line found.');
else {
  const n = line.match(/\*\*(\d+) passing\*\*/);
  if (!n) failures.push('CLAIMS.md: Test totals line has no `**N passing**`.');
  else if (Number(n[1]) !== measured) failures.push(`CLAIMS.md says ${n[1]} but measured is ${measured}.`);
}

if (failures.length > 0) {
  console.error('test-totals: FAIL — published totals drifted from the measured source (run `npm run measure:test-totals` then update README badge + CLAIMS.md):');
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`test-totals: verified — README badge + CLAIMS.md both equal the measured ${measured} passing (+${src.gatedSkips} gated skips, reported separately).`);
