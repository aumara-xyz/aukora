// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R51 CONTINUITY GATE (issue #106) — the executable truth-compiler.
 *
 * Reconciles the three continuity views so none can silently truncate another:
 *   - the 191-row preservation ledger (docs/issue-preservation-ledger.json) — lossless historical inventory;
 *   - the Atlas (docs/atlas/ATLAS.json) — donor-restoration + evidence queue, refreshed through the merged head;
 *   - executable anatomy (anatomy.json) — the current runtime/genome gate;
 *   - a committed GitHub object snapshot (docs/atlas/CURRENT_OBJECTS.json) so the capture basis is provable offline.
 *
 * Proves (all fail-closed, no network):
 *   1. Ledger integrity: exactly 191 entries = 169 aukora-symbiote + 13 aukora-kernel + 9 aukora-fu; no duplicate
 *      numbers per repo; every entry has exactly one classification AND one completion_status; the count blocks
 *      sum to 191; every symbiote entry is sanitized (title null, redacted true) — sensitive material stays private.
 *   2. Set equality: the ledger's kernel & fu number sets EQUAL the committed historical GitHub sets (settled by
 *      live re-verification at capture); symbiote is 169, settled by owner ratification (numbers/URLs appear in the
 *      sanitized public rows; donor-private titles, bodies, and labels are withheld).
 *   3. Atlas ↔ ledger: every historical Atlas row's issue-number is in the ledger's set for that repo (no orphans).
 *   4. Atlas capture completeness: every Aukora object in the committed snapshot has an Atlas row through the
 *      captured input base; Atlas.base_main equals that recorded base; the capture has no sequence gap.
 *   5. Atlas well-formedness: every row's disposition is in the Atlas vocabulary and carries source/number/capability.
 *   6. Anatomy: at least the R51-expanded set of enforced coverage scopes (beyond supervisor-only).
 *   7. Derived Markdown: the canonical counts embedded in ISSUE_PRESERVATION_LEDGER.md equal the ledger JSON.
 *   8. R57A capture layer (docs/atlas/CURRENT_OBJECTS_R57A.json): the newer capture is internally sound
 *      (contiguous, duplicate-free, typed, legally-stated, anchored with head SHA + ISO timestamp), is a strict
 *      superset of the R51 capture with only LEGAL state transitions (type never changes; MERGED is terminal;
 *      issues never merge), its recorded drift equals the recomputed drift (both directions), its pending-
 *      qualification set plus the Atlas-qualified set exactly tiles the captured set (both directions, disjoint),
 *      and every pending-intake donor entry is sanitized (title/body/labels null) and absent from the frozen
 *      191-row ledger — proving the ratified freeze is preserved and intake is additive-pending only.
 *
 * Truth class: every capture here is CAPTURE-CONSISTENT — equality with live GitHub was demonstrated only at the
 * recorded captured_at anchors, and is not claimed afterwards. This gate proves the committed views agree with
 * each other offline; it does not (and cannot) prove live freshness.
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

  // ---- 4. Atlas committed-capture completeness ----
  ok(atlas.base_main === snap.head_sha, `atlas.base_main (${atlas.base_main}) != snapshot head (${snap.head_sha})`);
  const atlasCurrent = new Set(atlas.rows.filter((r) => r.source === 'aukora').map((r) => r.number));
  for (const o of snap.aukora.objects) ok(atlasCurrent.has(o.number), `atlas capture-coverage: R51 object #${o.number} has no Atlas row`);
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

  // ---- 8. R57A capture layer: internal soundness, legal drift, exact tiling, sanitized additive intake ----
  const cap = read('docs/atlas/CURRENT_OBJECTS_R57A.json');
  const objs = cap.aukora.objects;
  ok(cap.capture.truth_class === 'CAPTURE_CONSISTENT', 'r57a: truth_class must be CAPTURE_CONSISTENT — live freshness is never claimed');
  ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(cap.capture.captured_at) && !Number.isNaN(Date.parse(cap.capture.captured_at)),
    `r57a: captured_at "${cap.capture.captured_at}" is not an ISO-8601 UTC instant`);
  ok(/^[0-9a-f]{40}$/.test(cap.capture.anchors.public_main_head), 'r57a: public_main_head anchor is not a 40-hex SHA');
  ok(cap.capture.anchors.r51_capture_head === snap.head_sha,
    `r57a: r51_capture_head anchor (${cap.capture.anchors.r51_capture_head}) != R51 snapshot head (${snap.head_sha})`);
  // Internal soundness: contiguous 1..max, duplicate-free, typed, legally-stated.
  ok(objs.length === cap.aukora.count, `r57a: count field ${cap.aukora.count} != objects length ${objs.length}`);
  const capNums = objs.map((o) => o.number);
  ok(new Set(capNums).size === capNums.length, 'r57a: duplicate object numbers in capture');
  ok(Math.max(...capNums) === cap.aukora.max_object, `r57a: max_object mismatch`);
  const holes = []; for (let n = 1; n <= cap.aukora.max_object; n++) if (!capNums.includes(n)) holes.push(n);
  ok(holes.length === 0 && cap.aukora.gaps.length === 0, `r57a: sequence gaps ${JSON.stringify(holes)} (recorded: ${JSON.stringify(cap.aukora.gaps)})`);
  ok(cap.aukora.duplicates.length === 0, 'r57a: recorded duplicates must be empty');
  for (const o of objs) {
    ok(o.type === 'issue' || o.type === 'pr', `r57a #${o.number}: bad type "${o.type}"`);
    ok(['OPEN', 'CLOSED', 'MERGED'].includes(o.state), `r57a #${o.number}: bad state "${o.state}"`);
    ok(!(o.type === 'issue' && o.state === 'MERGED'), `r57a #${o.number}: an issue can never be MERGED`);
  }
  ok(objs.filter((o) => o.type === 'issue').length === cap.aukora.issues && objs.filter((o) => o.type === 'pr').length === cap.aukora.prs,
    'r57a: issue/pr counts disagree with objects');
  // Superset of R51 with only legal transitions; recorded drift == recomputed drift (both directions).
  const capBy = new Map(objs.map((o) => [o.number, o]));
  const recomputed = [];
  for (const o of snap.aukora.objects) {
    const c = capBy.get(o.number);
    ok(!!c, `r57a: R51 object #${o.number} missing from the newer capture`);
    if (!c) continue;
    ok(c.type === o.type, `r57a #${o.number}: type changed ${o.type} -> ${c.type} (illegal)`);
    if (c.state !== o.state) {
      ok(o.state !== 'MERGED', `r57a #${o.number}: MERGED is terminal, cannot become ${c.state}`);
      recomputed.push(`${o.number}:${o.state}>${c.state}`);
    }
  }
  const recorded = cap.reconciliation_vs_r51.state_transitions.map((t) => `${t.number}:${t.from}>${t.to}`);
  ok(recomputed.length === recorded.length && [...recomputed].sort().join() === [...recorded].sort().join(),
    `r57a: recorded drift ${JSON.stringify(recorded)} != recomputed drift ${JSON.stringify(recomputed)}`);
  for (const t of cap.reconciliation_vs_r51.state_transitions) ok(t.legal === true, `r57a drift #${t.number}: transition marked illegal`);
  ok(cap.reconciliation_vs_r51.missing_objects.length === 0 && cap.reconciliation_vs_r51.type_changes.length === 0,
    'r57a: recorded missing/type-change lists must be empty when none recomputed');
  // Exact tiling: pending set ∪ Atlas-qualified set == captured set, disjoint, both directions.
  const pending = new Set(cap.reconciliation_vs_r51.objects_pending_atlas_qualification);
  for (const n of pending) ok(!atlasCurrent.has(n), `r57a: #${n} is both Atlas-qualified and pending-qualification`);
  for (const n of capNums) ok(atlasCurrent.has(n) || pending.has(n), `r57a: captured #${n} is neither Atlas-qualified nor recorded pending`);
  for (const n of [...atlasCurrent, ...pending]) ok(capBy.has(n), `r57a: qualified/pending #${n} is not in the capture`);
  // Sanitized additive-only intake: never in the frozen ledger, never with donor-private text.
  const ledgerKeys = new Set(entries.map((e) => `${e.repo}#${e.number}`));
  for (const p of cap.pending_intake.entries) {
    ok(p.sanitized === true && p.title === null && p.body === null && p.labels === null,
      `intake ${p.repo}#${p.number}: donor-private title/body/labels must be withheld (null) and sanitized:true`);
    ok(p.status === 'PENDING_OWNER_RATIFICATION', `intake ${p.repo}#${p.number}: status must be PENDING_OWNER_RATIFICATION`);
    ok(!ledgerKeys.has(`${p.repo}#${p.number}`),
      `intake ${p.repo}#${p.number}: already in the ratified 191-row ledger — intake must be additive-pending, never a rewrite`);
    ok(typeof p.url === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(p.captured_at),
      `intake ${p.repo}#${p.number}: missing url or ISO captured_at anchor`);
  }

  // ---- 9. R58/R59 branch-intake ledger: inspected classifications, no blind merge, no result claims,
  //         per-classification evidence requirements (M3 repair-forward). The offline gate proves
  //         structure and internal consistency ONLY — external truth rests on the recorded
  //         re-executable evidence commands, and the ledger must say so itself. ----
  const intake = read('docs/atlas/BRANCH_INTAKE_R58.json');
  ok(intake.schema === 'aukora-branch-intake-ledger-v2', 'intake: wrong schema');
  ok(intake.verification_scope && intake.verification_scope.external_truth_not_provable_offline === true
    && typeof intake.verification_scope.external_truth_rests_on === 'string'
    && intake.verification_scope.external_truth_rests_on.length > 0,
    'intake: ledger must honestly declare that the offline gate cannot prove external truth');
  ok(intake.law.no_blind_merge === true, 'intake: the no-blind-merge law must be asserted');
  ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(intake.capture.captured_at), 'intake: captured_at is not an ISO-8601 UTC instant');
  ok(/^[0-9a-f]{40}$/.test(intake.capture.anchors.public_main_head), 'intake: public_main_head anchor is not a 40-hex SHA');
  ok(intake.capture.truth_class === 'CAPTURE_CONSISTENT', 'intake: truth_class must be CAPTURE_CONSISTENT');
  const IVOCAB = new Set(intake.classification_vocabulary);
  ok(IVOCAB.size === 5 && ['ALREADY_INTEGRATED', 'RESEARCH_CANDIDATE', 'ADAPT', 'REJECT', 'MISSING_EVIDENCE'].every((v) => IVOCAB.has(v)),
    'intake: classification vocabulary must be exactly the five directive terms');
  ok(intake.entries.length === intake.source_survey.unique_content_branches_in_scope,
    `intake: ${intake.entries.length} entries != declared scope ${intake.source_survey.unique_content_branches_in_scope}`);
  const inames = intake.entries.map((e) => e.branch);
  ok(new Set(inames).size === inames.length, 'intake: duplicate branch entries');
  const EPISTEMIC = ['VERIFIED', 'FALSIFIED', 'UNPROVEN', 'STALE', 'EXTERNAL_RESEARCH', 'INFERENCE'];
  for (const e of intake.entries) {
    ok(/^[0-9a-f]{40}$/.test(e.head_sha), `intake ${e.branch}: head_sha is not a 40-hex SHA`);
    ok(IVOCAB.has(e.classification), `intake ${e.branch}: classification "${e.classification}" not in vocabulary`);
    ok(Array.isArray(e.evidence) && e.evidence.length > 0 && e.evidence.every((x) => typeof x === 'string' && x.length > 0),
      `intake ${e.branch}: classification without recorded inspection evidence`);
    ok(typeof e.rationale === 'string' && e.rationale.length > 0, `intake ${e.branch}: missing rationale`);
    ok(e.no_result_claims_adopted === true, `intake ${e.branch}: must assert no result claims are adopted from branch presence`);
    ok(e.unique_vs_main && e.unique_vs_main.files >= 1, `intake ${e.branch}: a unique-content entry must record >=1 unique file`);
    if (e.narrow_extraction) ok(!!e.narrow_extraction.target && !!e.narrow_extraction.detail,
      `intake ${e.branch}: narrow_extraction must name target and detail`);
    if (e.per_file_exception) for (const [f, v] of Object.entries(e.per_file_exception))
      ok([...IVOCAB].some((t) => String(v).includes(t)), `intake ${e.branch}: per-file exception "${f}" cites no vocabulary term`);
    // v2: every evidence line carries a machine-checkable epistemic label prefix.
    for (const line of e.evidence) ok(EPISTEMIC.some((t) => line.startsWith(t + ':') || line.startsWith(t + ' ')),
      `intake ${e.branch}: evidence line lacks an epistemic prefix (${EPISTEMIC.join('/')}): "${String(line).slice(0, 60)}"`);
    if (e.referee_advisory) ok(String(e.referee_advisory).startsWith('EXTERNAL_RESEARCH'),
      `intake ${e.branch}: referee_advisory must be labeled EXTERNAL_RESEARCH`);
    // v2: per-classification required fields — enforceable structure, no external-truth pretense.
    if (e.classification === 'ALREADY_INTEGRATED') ok(typeof e.landed_reference === 'string' && /[0-9a-f]{7,40}/.test(e.landed_reference),
      `intake ${e.branch}: ALREADY_INTEGRATED requires landed_reference citing a hex SHA on main`);
    if (e.classification === 'ADAPT') ok(!!e.narrow_extraction || /per-file/i.test(e.rationale),
      `intake ${e.branch}: ADAPT requires narrow_extraction or an explicit per-file intake rationale`);
    if (e.classification === 'REJECT') {
      ok(typeof e.reject_grounds === 'string' && e.reject_grounds.length > 0, `intake ${e.branch}: REJECT requires reject_grounds`);
      ok(!e.narrow_extraction, `intake ${e.branch}: REJECT must not carry an extraction action`);
    }
    if (e.classification === 'MISSING_EVIDENCE') ok(typeof e.missing_artifact === 'string' && e.missing_artifact.length > 0,
      `intake ${e.branch}: MISSING_EVIDENCE requires naming the missing artifact`);
  }

  return {
    errors, entries: entries.length, atlasRows: atlas.rows.length, currentObjects: snap.aukora.objects.length,
    scopes: scopes.length, r57aObjects: objs.length, r57aPending: pending.size,
    r57aDrift: recorded.length, r57aIntake: cap.pending_intake.entries.length,
    intakeBranches: intake.entries.length,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = runContinuity();
  if (r.errors.length) { console.error('CONTINUITY GATE FAILED:\n  ' + r.errors.join('\n  ')); process.exit(1); }
  console.log(`continuity: verified — ledger 191 (169+13+9) frozen, atlas ${r.atlasRows} rows, ${r.currentObjects} R51 objects capture-consistent, r57a capture ${r.r57aObjects} objects (${r.r57aPending} pending qualification, ${r.r57aDrift} legal drift, ${r.r57aIntake} sanitized intake), branch-intake ledger ${r.intakeBranches} inspected entries, ${r.scopes} anatomy scopes; set-equality + tiling PROVEN offline (live freshness not claimed)`);
}
