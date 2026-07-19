#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
//
// R57A Sam 3 — current-object capture refresh (NETWORK; not part of test:all).
//
// Re-captures the canonical aukora GitHub object sequence into
// docs/atlas/CURRENT_OBJECTS_R57A.json with fresh explicit anchors (public main head via
// git ls-remote, ISO-8601 UTC captured_at) and recomputes every derived field:
// counts, gaps, duplicates, the reconciliation against the preserved R51 committed capture
// (docs/atlas/CURRENT_OBJECTS.json — never rewritten), and the pending-qualification set
// (captured objects minus the Atlas-qualified set, derived from ATLAS.json, never hardcoded).
// Pending-intake donor entries are re-captured by number/state/created timestamp ONLY — the
// jq filter never materializes donor-private titles, bodies, or labels.
//
// The prose strata/privacy/method notes of the existing capture are preserved verbatim; only
// measured fields change. Offline agreement of the result is enforced by
// scripts/verify-continuity.mjs section 8 and test/continuityGuards.test.ts.
//
// Run: node scripts/capture-current-objects.mjs   (requires gh auth + network)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CAPTURE_PATH = join(ROOT, 'docs/atlas/CURRENT_OBJECTS_R57A.json');
const REPO = 'aumara-xyz/aukora';

const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' });
const gh = (args) => JSON.parse(sh('gh', args));

const capturedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const mainHead = sh('git', ['ls-remote', `https://github.com/${REPO}`, 'main']).split('\t')[0];
if (!/^[0-9a-f]{40}$/.test(mainHead)) throw new Error(`bad main head anchor: ${mainHead}`);

const issues = gh(['issue', 'list', '--repo', REPO, '--state', 'all', '--limit', '500', '--json', 'number,state'])
  .map((o) => ({ number: o.number, type: 'issue', state: o.state }));
const prs = gh(['pr', 'list', '--repo', REPO, '--state', 'all', '--limit', '500', '--json', 'number,state'])
  .map((o) => ({ number: o.number, type: 'pr', state: o.state }));
const objects = [...issues, ...prs].sort((a, b) => a.number - b.number);

const cap = JSON.parse(readFileSync(CAPTURE_PATH, 'utf8'));
const r51 = JSON.parse(readFileSync(join(ROOT, 'docs/atlas/CURRENT_OBJECTS.json'), 'utf8'));
const atlas = JSON.parse(readFileSync(join(ROOT, 'docs/atlas/ATLAS.json'), 'utf8'));

const nums = objects.map((o) => o.number);
const max = Math.max(...nums);
const gaps = [];
for (let n = 1; n <= max; n++) if (!nums.includes(n)) gaps.push(n);
const duplicates = nums.filter((n, i) => nums.indexOf(n) !== i);

const liveBy = new Map(objects.map((o) => [o.number, o]));
const transitions = [];
const missing = [];
const typeChanges = [];
for (const o of r51.aukora.objects) {
  const l = liveBy.get(o.number);
  if (!l) { missing.push(o.number); continue; }
  if (l.type !== o.type) typeChanges.push({ number: o.number, r51_type: o.type, r57a_type: l.type });
  if (l.state !== o.state) {
    const legal = o.state !== 'MERGED' && !(o.type === 'issue' && l.state === 'MERGED');
    transitions.push({ number: o.number, type: o.type, from: o.state, to: l.state, legal });
  }
}

const qualified = new Set(atlas.rows.filter((r) => r.source === 'aukora').map((r) => r.number));
const pending = nums.filter((n) => !qualified.has(n));

// Re-capture pending-intake donor entries: number/state/created ONLY — titles/bodies/labels are
// never requested, so they cannot leak even transiently.
for (const e of cap.pending_intake.entries) {
  const d = gh(['api', `repos/aumara-xyz/${e.repo}/issues/${e.number}`, '--jq',
    '{number: .number, state: .state, created: .created_at}']);
  e.state = d.state;
  e.created_at_source = d.created;
  e.captured_at = capturedAt;
}

cap.capture.captured_at = capturedAt;
cap.capture.anchors.public_main_head = mainHead;
cap.aukora = {
  max_object: max,
  count: objects.length,
  issues: objects.filter((o) => o.type === 'issue').length,
  prs: objects.filter((o) => o.type === 'pr').length,
  gaps,
  duplicates,
  objects,
};
cap.reconciliation_vs_r51.missing_objects = missing;
cap.reconciliation_vs_r51.type_changes = typeChanges;
cap.reconciliation_vs_r51.state_transitions = transitions;
cap.reconciliation_vs_r51.objects_pending_atlas_qualification = pending;

writeFileSync(CAPTURE_PATH, JSON.stringify(cap, null, 2) + '\n');
console.log(`capture refreshed @ ${capturedAt} anchor ${mainHead.slice(0, 9)} — ` +
  `${objects.length} objects (${cap.aukora.issues} issues + ${cap.aukora.prs} prs), ` +
  `${gaps.length} gaps, ${duplicates.length} dups, ${transitions.length} drifts vs R51, ` +
  `${pending.length} pending qualification, ${cap.pending_intake.entries.length} intake re-captured`);
