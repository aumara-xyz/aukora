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
//
// R57 (#176 finding 1 + adversarial bypass): every rule matches EXACT executable command segments,
// never substrings. The script string is split on the shell operators (&&, ||, ;) and each segment is
// compared whole, so `echo build:kernel && …` or `test:all: "echo typecheck:all"` can no longer
// satisfy a gate they do not actually execute.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Split an npm script into its executable command segments (exact, trimmed). Splitting on the shell
// chain operators is intentionally simple: aukora root scripts are flat `a && b && c` chains; if a
// future script embeds quoted operators it must be restructured rather than weakening this gate.
export function splitCommandSegments(script) {
  return String(script ?? '').split(/&&|\|\||;/).map((s) => s.trim()).filter((s) => s.length > 0);
}

// Pure rule evaluation over the root package.json `scripts` map → array of failure strings.
export function verifyRootScripts(scripts) {
  const failures = [];
  const tcAll = scripts?.['typecheck:all'];
  const TYPECHECK_SEGMENT = 'npm run typecheck --workspaces --if-present';
  const BUILD_SEGMENT = 'npm run build:kernel';
  if (!tcAll) {
    failures.push('root script `typecheck:all` is missing — the root typecheck gate does not exist.');
  } else {
    const segs = splitCommandSegments(tcAll);
    const tc = segs.indexOf(TYPECHECK_SEGMENT);
    if (tc === -1) {
      failures.push(
        `\`typecheck:all\` must run the exact command \`${TYPECHECK_SEGMENT}\` (escape-proof: covers ALL workspaces with a typecheck; ` +
        `exact-segment match so an echo/lookalike cannot satisfy the gate). Got: ${tcAll}`,
      );
    } else {
      // R57 build-order P0: @aukora/kernel exports its types from ./dist, so its declarations must be BUILT
      // before any dependent workspace typechecks. In a clean clone (npm ci, no dist) `typecheck:all` must
      // therefore build the kernel first, or dependents fail `TS2307: Cannot find module '@aukora/kernel'`.
      const bk = segs.indexOf(BUILD_SEGMENT);
      if (bk === -1 || bk > tc) {
        failures.push(
          `\`typecheck:all\` must run the exact command \`${BUILD_SEGMENT}\` BEFORE \`${TYPECHECK_SEGMENT}\`. ` +
          `@aukora/kernel exports its .d.ts from ./dist; without a prior build a clean clone fails TS2307 on Node 20/22. ` +
          `Exact segments only — \`echo build:kernel\` does not count. Got: ${tcAll}`,
        );
      }
    }
  }

  // `typecheck:all` must be part of `test:all` — as an exact executed command, not a substring.
  const testAllSegs = splitCommandSegments(scripts?.['test:all']);
  if (!testAllSegs.includes('npm run typecheck:all')) {
    failures.push('`test:all` does not execute the exact command `npm run typecheck:all` — the typecheck gate is not enforced by the root gate (a mention/echo of "typecheck:all" does not count).');
  }
  return failures;
}

export function runVerifier() {
  const root = JSON.parse(readFileSync('package.json', 'utf8'));

  // Enumerate every workspace (packages/*, apps/*) that declares a `typecheck` script.
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

  const failures = verifyRootScripts(root.scripts);
  if (failures.length > 0) {
    console.error('typecheck-coverage: FAIL');
    for (const f of failures) console.error(`  ✗ ${f}`);
    process.exit(1);
  }
  console.log(
    `typecheck-coverage: verified — ${withTypecheck.length} workspaces declare a typecheck ` +
    `(${withTypecheck.map((w) => w.name).join(', ')}); the escape-proof \`typecheck:all\` (exact-segment: build:kernel → --workspaces --if-present) covers them all and runs inside test:all.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runVerifier();
