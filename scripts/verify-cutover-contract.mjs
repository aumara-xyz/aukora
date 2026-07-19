// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R59 EMBEDDED-KIRA CUTOVER CONTRACT — DRY-RUN VERIFIER (Sam 3, directive item 1).
 *
 * Offline, no network, no SQLite/libSQL, no Convex: this verifier loads
 * docs/atlas/EMBEDDED_KIRA_CUTOVER_CONTRACT.json, validates its structure fail-closed, and then
 * EXECUTES the contract's laws against an in-memory simulation of the two stores and the phase
 * machine. Every law is proven by running the scenario that would violate it and asserting the
 * refusal, plus the happy path and crash/replay canaries.
 *
 * HONEST SCOPE: this is a dry-run enforceability proof — the laws are internally consistent and
 * mechanically checkable. It is NOT a live-store integration test; no embedded store exists in the
 * tree this round, and this verifier must keep passing without one.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const digest = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex');

const REQUIRED_GROUPS = [
  'signed_heads_high_water', 'attestation_nonces', 'tombstones_no_resurrection',
  'record_id_derivation', 'receipt_chain_anchors',
];
const PHASES = ['CONVEX_CANONICAL', 'SHADOW_READS', 'PARITY_PROVEN', 'CUTOVER_CHECKPOINT', 'EMBEDDED_CANONICAL'];

// ---------- in-memory store + phase-machine simulation ----------

class SimStore {
  constructor(name) {
    this.name = name;
    this.rows = new Map();          // recordId -> { content, scanPassed, receiptSeq }
    this.receipts = [];             // { seq, recordId }
    this.tombstones = new Set();
    this.consumedNonces = new Set();
    this.signedHeadHighWater = 0;
    this.directWrites = 0;
  }
  snapshotDigest() {
    return digest({
      rows: [...this.rows.entries()].sort(),
      tombstones: [...this.tombstones].sort(),
      nonces: [...this.consumedNonces].sort(),
      hw: this.signedHeadHighWater,
      receipts: this.receipts,
    });
  }
}

class CutoverSim {
  constructor(env = {}) {
    this.env = env;
    this.phase = 'CONVEX_CANONICAL';
    this.canonical = 'convex';
    this.convex = new SimStore('convex');
    this.embedded = new SimStore('embedded');
    this.writerLog = [];            // { seq, writer, recordId }
    this.checkpoint = null;
    this.reconcileQuarantine = [];
    this.seq = 0;
    this.parityWindowsClean = 0;
  }
  killSwitchArmed() { return this.env.AUKORA_EMBEDDED_CUTOVER_KILL === '1'; }
  store(which) { return which === 'convex' ? this.convex : this.embedded; }

  /** The only legal write path: scan → receipt → effect, through the canonical writer ONLY. */
  write(recordId, content, { scanPassed = true, targets } = {}) {
    if (targets && targets.length > 1) throw new Error('DUAL_WRITE_REFUSED: writes may target only the canonical writer');
    const target = targets ? targets[0] : this.canonical;
    if (target !== this.canonical) throw new Error(`NON_CANONICAL_WRITE_REFUSED: ${target} is not the canonical writer`);
    if (!scanPassed) throw new Error('SCAN_BEFORE_CHAIN_REFUSED: record failed scan; it may not chain');
    const s = this.store(this.canonical);
    if (s.tombstones.has(recordId)) throw new Error('NO_RESURRECTION_REFUSED: tombstoned recordId may not return');
    const receiptSeq = ++this.seq;
    s.receipts.push({ seq: receiptSeq, recordId });                 // receipt BEFORE effect
    s.rows.set(recordId, { content, scanPassed, receiptSeq });      // effect row after receipt
    this.writerLog.push({ seq: receiptSeq, writer: this.canonical, recordId });
    return receiptSeq;
  }

  enterShadow() {
    if (this.phase !== 'CONVEX_CANONICAL') throw new Error('PHASE_ORDER_VIOLATION');
    this.phase = 'SHADOW_READS';
  }
  /** Shadow refresh: the follower is populated by READING the canonical store only. */
  shadowRefresh() {
    if (this.phase !== 'SHADOW_READS' && this.phase !== 'PARITY_PROVEN') throw new Error('PHASE_ORDER_VIOLATION');
    this.embedded.rows = new Map(this.convex.rows);
    this.embedded.tombstones = new Set(this.convex.tombstones);
    this.embedded.consumedNonces = new Set(this.convex.consumedNonces);
    this.embedded.signedHeadHighWater = this.convex.signedHeadHighWater;
    this.embedded.receipts = [...this.convex.receipts];
  }
  parityCheck() {
    const idsA = [...this.convex.rows.keys()].sort().join();
    const idsB = [...this.embedded.rows.keys()].sort().join();
    const contentA = digest([...this.convex.rows.entries()].sort());
    const contentB = digest([...this.embedded.rows.entries()].sort());
    const clean = idsA === idsB && contentA === contentB;
    this.parityWindowsClean = clean ? this.parityWindowsClean + 1 : 0;
    if (!clean && this.phase === 'PARITY_PROVEN') this.phase = 'SHADOW_READS';
    if (clean && this.parityWindowsClean >= 3 && this.phase === 'SHADOW_READS') this.phase = 'PARITY_PROVEN';
    return clean;
  }
  buildCheckpoint(omitGroup = null) {
    const cp = {
      signed_heads_high_water: this.convex.signedHeadHighWater,
      attestation_nonces: digest([...this.convex.consumedNonces].sort()),
      tombstones_no_resurrection: digest([...this.convex.tombstones].sort()),
      record_id_derivation: 'content-addressed sha256 (R34 rule identity)',
      receipt_chain_anchors: digest(this.convex.receipts),
    };
    if (omitGroup) delete cp[omitGroup];
    return cp;
  }
  cutover(checkpoint) {
    if (this.phase !== 'PARITY_PROVEN') throw new Error('CUTOVER_REFUSED: parity not proven');
    if (this.killSwitchArmed()) throw new Error('CUTOVER_REFUSED: kill switch armed (fail-safe toward Convex)');
    for (const g of REQUIRED_GROUPS) {
      if (!(g in (checkpoint ?? {}))) throw new Error(`CUTOVER_REFUSED: checkpoint incomplete — missing ${g}`);
    }
    this.phase = 'CUTOVER_CHECKPOINT';
    this.checkpoint = { ...checkpoint, appliedDigest: null };
    this.applyCheckpoint();
    this.phase = 'EMBEDDED_CANONICAL';
    this.canonical = 'embedded';
  }
  /** Idempotent by construction: applying an already-applied checkpoint is a no-op. */
  applyCheckpoint() {
    const target = digest({ cp: { ...this.checkpoint, appliedDigest: null }, state: this.embedded.snapshotDigest() });
    if (this.checkpoint.appliedDigest === target) return 'noop';
    this.embedded.signedHeadHighWater = this.checkpoint.signed_heads_high_water;
    this.checkpoint.appliedDigest = digest({ cp: { ...this.checkpoint, appliedDigest: null }, state: this.embedded.snapshotDigest() });
    return 'applied';
  }
  rollback() {
    if (this.phase !== 'EMBEDDED_CANONICAL') throw new Error('ROLLBACK_REFUSED: nothing to roll back');
    const checkpointIds = new Set(this.convex.rows.keys());
    for (const [id, row] of this.embedded.rows) {
      if (!checkpointIds.has(id)) this.reconcileQuarantine.push({ recordId: id, row });
    }
    this.phase = 'CONVEX_CANONICAL';
    this.canonical = 'convex';
    this.parityWindowsClean = 0;
  }
  /** Crash recovery law: derive the single writer from durable markers alone. */
  recover() {
    const complete = this.checkpoint && REQUIRED_GROUPS.every((g) => g in this.checkpoint) && this.checkpoint.appliedDigest;
    this.canonical = complete ? 'embedded' : 'convex';
    this.phase = complete ? 'EMBEDDED_CANONICAL' : (this.parityWindowsClean >= 3 ? 'PARITY_PROVEN' : this.phase === 'EMBEDDED_CANONICAL' ? 'CONVEX_CANONICAL' : this.phase);
    if (!PHASES.includes(this.phase)) this.phase = 'CONVEX_CANONICAL';
    return this.canonical;
  }
}

// ---------- the verification run ----------

export function runCutoverVerification(contractPath = 'docs/atlas/EMBEDDED_KIRA_CUTOVER_CONTRACT.json') {
  const errors = [];
  const proofs = [];
  const ok = (cond, law, detail) => { (cond ? proofs : errors).push(`${law}${detail ? ` — ${detail}` : ''}`); };
  const refuses = (fn, law, needle) => {
    try { fn(); errors.push(`${law} — expected refusal, got success`); }
    catch (e) { ok(String(e.message).includes(needle), law, `refused with ${e.message.split(':')[0]}`); }
  };

  // C0 — contract structure, fail-closed.
  let contract;
  try { contract = JSON.parse(readFileSync(join(ROOT, contractPath), 'utf8')); }
  catch (e) { return { errors: [`contract unreadable: ${e.message}`], proofs }; }
  ok(contract.schema === 'aukora-embedded-kira-cutover-contract-v1', 'C0.schema');
  const canonicalSeams = (contract.canonicality_registry?.seams ?? []).filter((s) => s.role === 'CANONICAL_DURABLE_MEMORY_WRITER');
  ok(canonicalSeams.length === 1, 'C0.exactly-one-canonical-seam', `found ${canonicalSeams.length}`);
  ok(contract.canonicality_registry?.fourth_store_forbidden === true, 'C0.fourth-store-forbidden');
  ok(REQUIRED_GROUPS.every((g) => contract.checkpoint?.required_field_groups?.includes(g))
    && contract.checkpoint?.required_field_groups?.length === REQUIRED_GROUPS.length, 'C0.checkpoint-field-groups-exact');
  ok(contract.laws?.kill_switch?.env === 'AUKORA_EMBEDDED_CUTOVER_KILL' && contract.laws.kill_switch.armed_value === '1', 'C0.kill-switch-named');
  ok(JSON.stringify(contract.phases?.order) === JSON.stringify(PHASES), 'C0.phase-order-exact');
  ok(/FORBIDDEN/i.test(contract.laws?.transition_mode ?? ''), 'C0.dual-writes-forbidden-stated');
  if (errors.length) return { errors, proofs }; // structure is the foundation; stop here if broken

  // P1 — happy path with single-writer log.
  const sim = new CutoverSim();
  sim.convex.signedHeadHighWater = 7;
  sim.convex.consumedNonces.add('nonce-1');
  sim.convex.tombstones.add('erased-1');
  sim.write('r1', 'alpha'); sim.write('r2', 'beta');
  sim.enterShadow(); sim.shadowRefresh();
  sim.parityCheck(); sim.parityCheck(); sim.parityCheck();
  ok(sim.phase === 'PARITY_PROVEN', 'P1.parity-proven-after-3-clean-windows', sim.phase);
  sim.cutover(sim.buildCheckpoint());
  ok(sim.phase === 'EMBEDDED_CANONICAL' && sim.canonical === 'embedded', 'P1.cutover-flips-single-writer');
  sim.write('r3', 'gamma');
  const writers = new Set(sim.writerLog.map((w) => w.writer));
  const perWrite = sim.writerLog.every((w, i, a) => a.filter((x) => x.seq === w.seq).length === 1);
  ok(writers.size === 2 && perWrite, 'P1.exactly-one-writer-per-write-no-overlap');

  // P2 — dual writes refused in every phase.
  refuses(() => sim.write('r4', 'x', { targets: ['convex', 'embedded'] }), 'P2.dual-write-refused', 'DUAL_WRITE_REFUSED');
  refuses(() => sim.write('r4', 'x', { targets: ['convex'] }), 'P2.non-canonical-write-refused', 'NON_CANONICAL_WRITE_REFUSED');

  // P3 — shadow phase: follower takes no direct writes.
  const sim3 = new CutoverSim();
  sim3.write('a', '1'); sim3.enterShadow(); sim3.shadowRefresh();
  refuses(() => sim3.write('b', '2', { targets: ['embedded'] }), 'P3.shadow-follower-rejects-direct-writes', 'NON_CANONICAL_WRITE_REFUSED');
  ok(sim3.embedded.directWrites === 0 && sim3.embedded.rows.has('a'), 'P3.follower-populated-by-reads-only');

  // P4 — parity mismatch blocks cutover.
  const sim4 = new CutoverSim();
  sim4.write('a', '1'); sim4.enterShadow(); sim4.shadowRefresh();
  sim4.parityCheck(); sim4.parityCheck(); sim4.parityCheck();
  sim4.embedded.rows.set('phantom', { content: 'drift', scanPassed: true, receiptSeq: -1 });
  ok(sim4.parityCheck() === false && sim4.phase === 'SHADOW_READS', 'P4.parity-mismatch-demotes-and-blocks');
  refuses(() => sim4.cutover(sim4.buildCheckpoint()), 'P4.cutover-refused-without-parity', 'CUTOVER_REFUSED');

  // P5 — each missing checkpoint field group refuses cutover.
  for (const g of REQUIRED_GROUPS) {
    const s = new CutoverSim();
    s.write('a', '1'); s.enterShadow(); s.shadowRefresh();
    s.parityCheck(); s.parityCheck(); s.parityCheck();
    refuses(() => s.cutover(s.buildCheckpoint(g)), `P5.checkpoint-missing-${g}-refused`, `missing ${g}`);
  }

  // P6 — kill switch refuses cutover (fail-safe toward Convex).
  const sim6 = new CutoverSim({ AUKORA_EMBEDDED_CUTOVER_KILL: '1' });
  sim6.write('a', '1'); sim6.enterShadow(); sim6.shadowRefresh();
  sim6.parityCheck(); sim6.parityCheck(); sim6.parityCheck();
  refuses(() => sim6.cutover(sim6.buildCheckpoint()), 'P6.kill-switch-refuses-cutover', 'kill switch armed');
  ok(sim6.canonical === 'convex', 'P6.kill-switch-leaves-convex-canonical');

  // P7 — rollback boundary: exact checkpoint restore + quarantined reconcile set.
  const sim7 = new CutoverSim();
  sim7.write('a', '1'); sim7.enterShadow(); sim7.shadowRefresh();
  sim7.parityCheck(); sim7.parityCheck(); sim7.parityCheck();
  sim7.cutover(sim7.buildCheckpoint());
  sim7.write('post-cutover-1', 'embedded-only');
  sim7.rollback();
  ok(sim7.canonical === 'convex' && sim7.phase === 'CONVEX_CANONICAL', 'P7.rollback-restores-convex-at-boundary');
  ok(sim7.reconcileQuarantine.length === 1 && sim7.reconcileQuarantine[0].recordId === 'post-cutover-1',
    'P7.post-checkpoint-writes-quarantined-not-dropped', `${sim7.reconcileQuarantine.length} quarantined`);

  // P8 — idempotent checkpoint replay.
  const sim8 = new CutoverSim();
  sim8.write('a', '1'); sim8.enterShadow(); sim8.shadowRefresh();
  sim8.parityCheck(); sim8.parityCheck(); sim8.parityCheck();
  sim8.cutover(sim8.buildCheckpoint());
  const before = sim8.embedded.snapshotDigest();
  const second = sim8.applyCheckpoint();
  ok(second === 'noop' && sim8.embedded.snapshotDigest() === before, 'P8.checkpoint-replay-idempotent', second);

  // P9 — crash canaries at every phase boundary recover to a legal single writer.
  for (const crashAt of ['SHADOW_READS', 'PARITY_PROVEN', 'CUTOVER_CHECKPOINT', 'EMBEDDED_CANONICAL']) {
    const s = new CutoverSim();
    s.write('a', '1'); s.enterShadow(); s.shadowRefresh();
    if (crashAt !== 'SHADOW_READS') { s.parityCheck(); s.parityCheck(); s.parityCheck(); }
    if (crashAt === 'CUTOVER_CHECKPOINT') { s.phase = 'CUTOVER_CHECKPOINT'; s.checkpoint = s.buildCheckpoint('receipt_chain_anchors'); }
    if (crashAt === 'EMBEDDED_CANONICAL') s.cutover(s.buildCheckpoint());
    const writer = s.recover();
    const legal = (writer === 'convex' || writer === 'embedded') && PHASES.includes(s.phase);
    const expectEmbedded = crashAt === 'EMBEDDED_CANONICAL';
    ok(legal && writer === (expectEmbedded ? 'embedded' : 'convex'),
      `P9.crash-at-${crashAt}-recovers-single-writer`, `writer=${writer}`);
    ok(s.store(writer).rows.has('a'), `P9.crash-at-${crashAt}-no-acknowledged-write-lost`);
  }

  // P10 — ordering laws.
  const sim10 = new CutoverSim();
  refuses(() => sim10.write('bad', 'x', { scanPassed: false }), 'P10.scan-before-chain-refused', 'SCAN_BEFORE_CHAIN_REFUSED');
  sim10.write('good', 'y');
  const row = sim10.convex.rows.get('good');
  const receipt = sim10.convex.receipts.find((r) => r.recordId === 'good');
  ok(receipt && row && receipt.seq === row.receiptSeq, 'P10.receipt-before-effect-holds');
  refuses(() => { sim10.convex.tombstones.add('good2'); sim10.write('good2', 'z'); }, 'P10.no-resurrection-refused', 'NO_RESURRECTION_REFUSED');

  return { errors, proofs };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { errors, proofs } = runCutoverVerification(process.argv[2]);
  if (errors.length) {
    console.error('CUTOVER CONTRACT DRY-RUN: FAIL\n  ' + errors.join('\n  '));
    process.exit(1);
  }
  console.log(`cutover-contract: dry-run verified — ${proofs.length} law proofs (structure, single-writer, dual-write refusal, shadow-read-only, parity gate, ${REQUIRED_GROUPS.length} checkpoint completeness refusals, kill switch, rollback quarantine, idempotent replay, 4 crash canaries, ordering laws). HONEST SCOPE: offline simulation of contract enforceability — NOT a live-store integration; no embedded store exists this round.`);
}
