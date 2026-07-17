// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
//
// Minimum executable ANATOMY verifier (issue #53, R46). Fail-closed on ILLEGAL entries;
// honest MISSING/RUNTIME_UNPROVEN entries are legal in a truth round but are printed as
// profile blockers. Checks: schema, declared-scope source coverage, cited tests exist,
// disposition legality, donor commit+path+blob format, and byte-identity (git hash-object)
// wherever an entry states a current blob.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const anatomy = JSON.parse(readFileSync('anatomy.json', 'utf8'));
const errors = [];
const blockers = [];
const VOCAB = new Set(anatomy.vocabulary);
const HEX40 = /^[0-9a-f]{40}$/;

// 1 + 4. schema + disposition legality
for (const e of anatomy.entries) {
  if (!e.id || !e.disposition || e.source_continuity === undefined || e.runtime_reachability === undefined)
    errors.push(`${e.id ?? '(no id)'}: missing required field (id/disposition/source_continuity/runtime_reachability)`);
  if (!VOCAB.has(e.disposition)) errors.push(`${e.id}: illegal disposition "${e.disposition}"`);
  if (['MISSING', 'RUNTIME_UNPROVEN'].includes(e.disposition)) blockers.push(`${e.id}: ${e.disposition}`);
  if (e.donor) {
    if (!HEX40.test(e.donor.commit ?? '')) errors.push(`${e.id}: donor.commit is not a full 40-hex SHA`);
    if (!HEX40.test(e.donor.blob ?? '')) errors.push(`${e.id}: donor.blob is not a full 40-hex SHA`);
    if (!e.donor.path) errors.push(`${e.id}: donor.path missing`);
  }
  // 3. cited tests exist
  for (const t of e.tests ?? []) if (!existsSync(t)) errors.push(`${e.id}: cited test does not exist: ${t}`);
  // files exist + 5. byte-identity where a blob is stated
  for (const f of e.files ?? []) {
    if (!existsSync(f.path)) { errors.push(`${e.id}: listed file does not exist: ${f.path}`); continue; }
    if (f.blob) {
      const actual = execFileSync('git', ['hash-object', f.path], { encoding: 'utf8' }).trim();
      if (actual !== f.blob) errors.push(`${e.id}: blob drift — ${f.path} is ${actual.slice(0, 12)}…, anatomy states ${f.blob.slice(0, 12)}…`);
    }
  }
}

// 2. declared-scope coverage: every file under each scope maps to exactly one entry
for (const scope of anatomy.coverage_scopes ?? []) {
  const owned = new Map();
  for (const e of anatomy.entries) for (const f of e.files ?? [])
    if (f.path.startsWith(scope.glob)) owned.set(f.path, (owned.get(f.path) ?? 0) + 1);
  // anatomy paths are always forward-slash; normalize walked paths so prefix matching is
  // correct on every platform (join() emits backslashes on Windows).
  const walk = (d) => readdirSync(d).flatMap((n) => {
    const p = join(d, n).split('\\').join('/');
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
  for (const p of walk(scope.glob)) {
    const n = owned.get(p) ?? 0;
    if (n === 0) errors.push(`coverage: ${p} (scope ${scope.glob}) maps to NO anatomy entry`);
    if (n > 1) errors.push(`coverage: ${p} maps to ${n} entries (must be exactly one)`);
  }
}

if (blockers.length) {
  console.log(`anatomy: ${blockers.length} honest gap(s) — legal this round, BLOCK the next feature profile:`);
  for (const b of blockers) console.log('  ▸ ' + b);
}
if (errors.length) {
  console.error(`anatomy: FAIL — ${errors.length} illegal entr${errors.length === 1 ? 'y' : 'ies'}:`);
  for (const e of errors) console.error('  ✗ ' + e);
  process.exit(1);
}
console.log(`anatomy: verified — ${anatomy.entries.length} entries, ${anatomy.coverage_scopes.length} coverage scope(s), schema/coverage/tests/dispositions/blob-identity all legal`);
