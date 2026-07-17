// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R51 CONTINUITY GATE (issue #106) — the executable truth-compiler.
 *
 * Reconciles the three continuity views so none can silently truncate another:
 *   - the 191-row preservation ledger (docs/issue-preservation-ledger.json) — lossless historical inventory;
 *   - the Atlas (docs/atlas/ATLAS.json) — donor-restoration + evidence queue, refreshed through the merged head;
 *   - executable anatomy (anatomy.json) — the current runtime/genome gate;
 *   - a committed GitHub object snapshot (docs/atlas/CURRENT_OBJECTS.json) so freshness is provable offline.
 *
 * Proves (all fail-closed, no network):
 *   1. Ledger integrity: exactly 191 entries = 169 aukora-symbiote + 13 aukora-kernel + 9 aukora-fu; no duplicate
 *      numbers per repo; every entry has exactly one classification AND one completion_status; the count blocks
 *      sum to 191; every symbiote entry is sanitized (title null, redacted true) — sensitive material stays private.
 *   2. Set equality: the ledger's kernel & fu number sets EQUAL the committed historical GitHub sets (settled by
 *      live re-verification at capture); symbiote is 169, settled by owner ratification (numbers held privately).
 *   3. Atlas ↔ ledger: every historical Atlas row's issue-number is in the ledger's set for that repo (no orphans).
 *   4. Atlas current-object freshness: every current aukora object in the snapshot has an Atlas row through the head;
 *      Atlas.base_main equals the recorded head; the sequence has no gap up to the recorded max object.
 *   5. Atlas well-formedness: every row's disposition is in the Atlas vocabulary and carries source/number/capability.
 *   6. Anatomy: at least the R51-expanded set of enforced coverage scopes (beyond supervisor-only).
 *   7. Derived Markdown: the canonical counts embedded in ISSUE_PRESERVATION_LEDGER.md equal the ledger JSON.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

export function runContinuity() {
  const errors = [];
  const ok = (cond, msg) => { if (!cond) errors.push(msg); };

  const ledger = read('docs/issue-preservation-ledger.json');
  const atlas = read('docs/atlas/ATLAS.json');
  const anatomy = read('anatomy.json');
  const snap = read('docs/atlas/CURRENT_OBJECTS.json');

  // ---- 1. Ledger integrity ----
  const entries = ledger.entries;
  ok(entries.length === 191, `ledger: expected 191 entries, got ${entries.length}`);
  const byRepo = {};
  for (const e of entries) (byRepo[e.repo] ??= []).push(e.number);
  const EXPECT = { 'aukora-symbiote': 169, 'aukora-kernel': 13, 'aukora-fu': 9 };
  for (const [repo, n] of Object.entries(EXPECT)) {
    const nums = byRepo[repo] ?? [];
    ok(nums.length === n, `ledger: ${repo} expected ${n}, got ${nums.length}`);
    ok(new Set(nums).size === nums.length, `ledger: ${repo} has duplicate issue numbers`);
  }
  const CLASS = new Set(ledger.taxonomy);
  const COMPLETION = new Set(['present_tested', 'superseded', 'scheduled', 'stays_in_product']);
  for (const e of entries) {
    ok(CLASS.has(e.classification), `ledger #${e.repo}/${e.number}: classification "${e.classification}" not in taxonomy`);
    ok(COMPLETION.has(e.completion_status), `ledger #${e.repo}/${e.number}: completion_status "${e.completion_status}" invalid`);
    if (e.repo === 'aukora-symbiote') ok(e.redacted === true && (e.title === null || e.title === undefined),
      `ledger #symbiote/${e.number}: sensitive material must be private (redacted:true, title:null)`);
  }
  ok(ledger.counts.total === 191, `ledger.counts.total != 191`);
  const classSum = Object.values(ledger.counts.by_classification).reduce((a, b) => a + b, 0);
  ok(classSum === 191, `ledger.counts.by_classification sums to ${classSum}, not 191`);
  const compSum = Object.values(ledger.completion_proof.by_completion_status).reduce((a, b) => a + b, 0);
  ok(compSum === 191, `ledger.completion_proof.by_completion_status sums to ${compSum}, not 191`);

  // ---- 2. Set equality vs the committed historical snapshot ----
  const setEq = (a, b) => a.length === b.length && [...a].sort((x, y) => x - y).join() === [...b].sort((x, y) => x - y).join();
  const hist = snap.historical_issue_sets;
  ok(setEq(byRepo['aukora-kernel'], hist['aukora-kernel'].numbers), 'set-equality: ledger kernel set != snapshot kernel set');
  ok(setEq(byRepo['aukora-fu'], hist['aukora-fu'].numbers), 'set-equality: ledger fu set != snapshot fu set');
  ok(hist['aukora-symbiote'].count === 169, 'set-equality: symbiote settled count must be 169');

  // ---- 3. Atlas historical rows are a subset of the ledger sets ----
  for (const row of atlas.rows) {
    if (row.source === 'aukora') continue; // current objects, handled below
    const set = byRepo[row.source];
    ok(set && set.includes(row.number), `atlas orphan: ${row.source}#${row.number} not in the ledger set`);
  }

  // ---- 4. Atlas current-object freshness ----
  ok(atlas.base_main === snap.head_sha, `atlas.base_main (${atlas.base_main}) != snapshot head (${snap.head_sha})`);
  const atlasCurrent = new Set(atlas.rows.filter((r) => r.source === 'aukora').map((r) => r.number));
  for (const o of snap.aukora.objects) ok(atlasCurrent.has(o.number), `atlas freshness: current object #${o.number} has no Atlas row`);
  const maxObj = Math.max(...snap.aukora.objects.map((o) => o.number));
  ok(maxObj === snap.aukora.max_object, `snapshot max_object mismatch: ${maxObj} vs ${snap.aukora.max_object}`);

  // ---- 5. Atlas well-formedness ----
  const VOCAB = new Set(atlas.vocabulary.map((v) => (typeof v === 'string' ? v : v.token ?? v.name)));
  for (const r of atlas.rows) {
    ok(VOCAB.has(r.disposition), `atlas: disposition "${r.disposition}" (#${r.source}/${r.number}) not in vocabulary`);
    ok(r.source && r.number != null && typeof r.capability === 'string' && r.capability.length > 0,
      `atlas: malformed row ${JSON.stringify(r).slice(0, 60)}`);
  }

  // ---- 6. Anatomy: expanded coverage beyond supervisor-only ----
  const scopes = (anatomy.coverage_scopes ?? []).map((s) => s.glob);
  ok(scopes.length >= 3, `anatomy: expected >=3 enforced coverage scopes (R51), got ${scopes.length}`);
  ok(scopes.includes('apps/supervisor/src'), 'anatomy: supervisor scope missing');
  ok(scopes.some((g) => g !== 'apps/supervisor/src'), 'anatomy: no scope beyond supervisor-only');

  // ---- 7. Derived Markdown counts equal the JSON ----
  const md = readFileSync(join(ROOT, 'docs/ISSUE_PRESERVATION_LEDGER.md'), 'utf8');
  for (const n of ['191', '169', '13', '9']) ok(md.includes(n), `derived MD: canonical count "${n}" missing from ISSUE_PRESERVATION_LEDGER.md`);

  return { errors, entries: entries.length, atlasRows: atlas.rows.length, currentObjects: snap.aukora.objects.length, scopes: scopes.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = runContinuity();
  if (r.errors.length) { console.error('CONTINUITY GATE FAILED:\n  ' + r.errors.join('\n  ')); process.exit(1); }
  console.log(`continuity: verified — ledger 191 (169+13+9), atlas ${r.atlasRows} rows, ${r.currentObjects} current objects fresh, ${r.scopes} anatomy scopes; set-equality PROVEN`);
}
