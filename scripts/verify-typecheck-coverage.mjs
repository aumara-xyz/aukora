#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
//
// R56 Sam 1 — escape-regression verifier for the root typecheck gate.
//
// Invariant: EVERY workspace that declares a `typecheck` script MUST be executed by the root
// `typecheck:all` gate, and `typecheck:all` MUST be part of `test:all`. The escape-proof mechanism
// is `npm run typecheck --workspaces --if-present` (runs typecheck in ALL workspaces that have it,
// so a future workspace cannot declare a typecheck and silently escape the gate). This verifier
// fails if that mechanism is replaced by a hand-maintained allow-list, or if a workspace's typecheck
// would otherwise be dropped from the gate. Pure/offline; reads package.json manifests only.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = JSON.parse(readFileSync('package.json', 'utf8'));
const failures = [];

// 1. Enumerate every workspace (packages/*, apps/*) that declares a `typecheck` script.
const workspaceDirs = [];
for (const globRoot of ['packages', 'apps']) {
  if (!existsSync(globRoot)) continue;
  for (const name of readdirSync(globRoot)) {
    const pkgPath = join(globRoot, name, 'package.json');
    if (existsSync(pkgPath)) workspaceDirs.push({ dir: `${globRoot}/${name}`, pkgPath });
  }
}
const withTypecheck = workspaceDirs
  .map(({ dir, pkgPath }) => ({ dir, pkg: JSON.parse(readFileSync(pkgPath, 'utf8')) }))
  .filter(({ pkg }) => pkg.scripts && typeof pkg.scripts.typecheck === 'string')
  .map(({ dir, pkg }) => ({ dir, name: pkg.name || dir }));

// 2. `typecheck:all` must exist and use the escape-proof --workspaces --if-present form.
const tcAll = root.scripts?.['typecheck:all'];
if (!tcAll) {
  failures.push('root script `typecheck:all` is missing — the root typecheck gate does not exist.');
} else if (!(tcAll.includes('--workspaces') && tcAll.includes('--if-present') && tcAll.includes('typecheck'))) {
  failures.push(
    `\`typecheck:all\` must run \`npm run typecheck --workspaces --if-present\` (escape-proof: covers ALL workspaces with a typecheck). ` +
    `A hand-maintained list lets a new workspace escape the gate. Got: ${tcAll}`,
  );
}

// 3. `typecheck:all` must be part of `test:all`.
const testAll = root.scripts?.['test:all'] || '';
if (!testAll.includes('typecheck:all')) {
  failures.push('`test:all` does not run `typecheck:all` — the typecheck gate is not enforced by the root gate.');
}

if (failures.length > 0) {
  console.error('typecheck-coverage: FAIL');
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(
  `typecheck-coverage: verified — ${withTypecheck.length} workspaces declare a typecheck ` +
  `(${withTypecheck.map((w) => w.name).join(', ')}); the escape-proof \`typecheck:all\` (--workspaces --if-present) covers them all and runs inside test:all.`,
);
