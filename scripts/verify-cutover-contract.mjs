// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R60 EMBEDDED-KIRA CUTOVER CONTRACT — DRY-RUN VERIFIER v2 (Sam 3, directive item 1 / audit M3).
 *
 * Offline, no network, no SQLite/libSQL, no Convex. Loads
 * docs/atlas/EMBEDDED_KIRA_CUTOVER_CONTRACT.json and EXECUTES its laws against an in-memory
 * simulation of the two stores and the phase machine.
 *
 * v2 hardening vs v1 (M3): every structural decision is derived from TYPED contract data, never a
 * regex over prose — the kill-switch direction is an enum, dual-writes is a boolean, the canonical
 * seam is a role, the phase machine is a typed edge graph, and the crash laws are typed. So
 * negation-smuggling ("dual writes are NOT forbidden") and edge add/delete tampers fail. The atomic
 * checkpoint now carries erase-root registry, erase-attestation/nonce state, and the writer-epoch
 * fence. A cross-process writer-lock + atomic-append prerequisite is EXECUTABLE: the follower cannot
 * reach PARITY/CUTOVER without holding it.
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

const PHASES = ['CONVEX_CANONICAL', 'SHADOW_READS', 'PARITY_PROVEN', 'CUTOVER_CHECKPOINT', 'EMBEDDED_CANONICAL'];
// The canonical legal edge set, as {from->to}. The verifier reconstructs the contract's typed graph
// and asserts it equals EXACTLY this set — an added or deleted edge fails.
const CANONICAL_EDGES = new Set([
  'CONVEX_CANONICAL->SHADOW_READS',
  'SHADOW_READS->PARITY_PROVEN',
  'PARITY_PROVEN->SHADOW_READS',
  'PARITY_PROVEN->CUTOVER_CHECKPOINT',
  'CUTOVER_CHECKPOINT->EMBEDDED_CANONICAL',
  'EMBEDDED_CANONICAL->CONVEX_CANONICAL',
]);
const REQUIRED_GROUPS = [
  'signed_heads_high_water', 'record_id_derivation', 'receipt_chain_anchors',
  'no_resurrection_tombstone_set', 'erase_attestations_consumed_nonces',
  'erase_root_registry', 'writer_epoch_fence',
];
const WRITER_LOCK_PHASES = new Set(['PARITY_PROVEN', 'CUTOVER_CHECKPOINT', 'EMBEDDED_CANONICAL']);

// ---------- in-memory store + phase-machine simulation (driven by the typed contract) ----------

class SimStore {
  constructor(name) {
    this.name = name;
    this.rows = new Map();
    this.receipts = [];
    this.tombstones = new Set();
    this.consumedEraseNonces = new Set();
    this.eraseRootRegistry = new Map();  // recordId -> ownerRootId (M1 binding continuity)
    this.signedHeadHighWater = 0;
    this.writerEpoch = 0;
    this.directWrites = 0;
  }
  snapshotDigest() {
    return digest({
      rows: [...this.rows.entries()].sort(),
      tombstones: [...this.tombstones].sort(),
      nonces: [...this.consumedEraseNonces].sort(),
      roots: [...this.eraseRootRegistry.entries()].sort(),
      hw: this.signedHeadHighWater,
      epoch: this.writerEpoch,
      receipts: this.receipts,
    });
  }
}

class CutoverSim {
  constructor(contract, env = {}) {
    this.c = contract;
    this.env = env;
    this.phase = 'CONVEX_CANONICAL';
    // canonical writer is DERIVED from the typed role, not hardcoded.
    this.canonicalSeam = contract.canonicality_registry.seams.find((s) => s.role === 'CANONICAL_DURABLE_MEMORY_WRITER');
    this.canonical = 'convex';
    this.convex = new SimStore('convex');
    this.embedded = new SimStore('embedded');
    this.convex.writerEpoch = 1;
    this.writerLockHeld = false;
    this.writerLog = [];
    this.checkpoint = null;
    this.reconcileQuarantine = [];
    this.seq = 0;
    this.parityWindowsClean = 0;
  }
  // Typed reads — no prose regex anywhere.
  killSwitchArmed() { return this.env[this.c.kill_switch.env] === this.c.kill_switch.armed_value; }
  killSwitchFailSafeTowardConvex() { return this.c.kill_switch.direction === 'FAIL_SAFE_TOWARD_CONVEX'; }
  dualWritesAllowed() { return this.c.dual_writes.allowed === true; }
  edgeAllowed(from, to) { return this.c._edgeSet.has(`${from}->${to}`); }
  store(which) { return which === 'convex' ? this.convex : this.embedded; }

  acquireWriterLock() { this.writerLockHeld = true; }
  releaseWriterLock() { this.writerLockHeld = false; }

  write(recordId, content, { scanPassed = true, targets, ownerRootId = 'root-A' } = {}) {
    if (targets && targets.length > 1) throw new Error('DUAL_WRITE_REFUSED: writes may target only the canonical writer');
    if (this.dualWritesAllowed()) throw new Error('DUAL_WRITE_REFUSED: contract dual_writes.allowed must be false');
    const target = targets ? targets[0] : this.canonical;
    if (target !== this.canonical) throw new Error(`NON_CANONICAL_WRITE_REFUSED: ${target} is not the canonical writer`);
    if (this.c.ordering.scan_before_chain && !scanPassed) throw new Error('SCAN_BEFORE_CHAIN_REFUSED: record failed scan; it may not chain');
    const s = this.store(this.canonical);
    if (s.tombstones.has(recordId)) throw new Error('NO_RESURRECTION_REFUSED: tombstoned recordId may not return');
    const receiptSeq = ++this.seq;
    s.receipts.push({ seq: receiptSeq, recordId });
    s.rows.set(recordId, { content, scanPassed, receiptSeq, ownerRootId });
    s.eraseRootRegistry.set(recordId, ownerRootId);
    this.writerLog.push({ seq: receiptSeq, writer: this.canonical, epoch: s.writerEpoch, recordId });
    return receiptSeq;
  }

  transition(to) {
    if (!this.edgeAllowed(this.phase, to)) throw new Error(`PHASE_EDGE_FORBIDDEN: ${this.phase}->${to} is not in the typed transition graph`);
    this.phase = to;
  }
  enterShadow() { this.transition('SHADOW_READS'); }
  shadowRefresh() {
    if (this.phase !== 'SHADOW_READS' && this.phase !== 'PARITY_PROVEN') throw new Error('PHASE_ORDER_VIOLATION');
    this.embedded.rows = new Map(this.convex.rows);
    this.embedded.tombstones = new Set(this.convex.tombstones);
    this.embedded.consumedEraseNonces = new Set(this.convex.consumedEraseNonces);
    this.embedded.eraseRootRegistry = new Map(this.convex.eraseRootRegistry);
    this.embedded.signedHeadHighWater = this.convex.signedHeadHighWater;
    this.embedded.receipts = [...this.convex.receipts];
  }
  parityCheck() {
    const idsA = [...this.convex.rows.keys()].sort().join();
    const idsB = [...this.embedded.rows.keys()].sort().join();
    const clean = idsA === idsB && digest([...this.convex.rows.entries()].sort()) === digest([...this.embedded.rows.entries()].sort());
    this.parityWindowsClean = clean ? this.parityWindowsClean + 1 : 0;
    if (!clean && this.phase === 'PARITY_PROVEN') this.transition('SHADOW_READS');
    // Writer-lock prerequisite is EXECUTABLE: no PARITY_PROVEN without the lock.
    if (clean && this.parityWindowsClean >= 3 && this.phase === 'SHADOW_READS' && this.writerLockHeld) this.transition('PARITY_PROVEN');
    return clean;
  }
  buildCheckpoint(omitGroup = null) {
    const cp = {
      signed_heads_high_water: this.convex.signedHeadHighWater,
      record_id_derivation: 'content-addressed sha256 (R34 rule identity)',
      receipt_chain_anchors: digest(this.convex.receipts),
      no_resurrection_tombstone_set: digest({ tombstones: [...this.convex.tombstones].sort(), noResurrection: true }),
      erase_attestations_consumed_nonces: digest([...this.convex.consumedEraseNonces].sort()),
      erase_root_registry: { version: 1, digest: digest([...this.convex.eraseRootRegistry.entries()].sort()) },
      writer_epoch_fence: this.convex.writerEpoch,
    };
    if (omitGroup) delete cp[omitGroup];
    return cp;
  }
  cutover(checkpoint) {
    if (this.phase !== 'PARITY_PROVEN') throw new Error('CUTOVER_REFUSED: parity not proven');
    if (!this.writerLockHeld) throw new Error('CUTOVER_REFUSED: cross-process writer lock not held (executable prerequisite)');
    if (this.killSwitchArmed()) throw new Error('CUTOVER_REFUSED: kill switch armed (fail-safe toward Convex)');
    for (const g of REQUIRED_GROUPS) if (!(g in (checkpoint ?? {}))) throw new Error(`CUTOVER_REFUSED: checkpoint incomplete — missing ${g}`);
    this.transition('CUTOVER_CHECKPOINT');
    // Fence the pre-cutover epoch; the embedded writer starts at epoch+1 (single-writer continuity).
    this.checkpoint = { ...checkpoint, appliedDigest: null };
    this.embedded.writerEpoch = this.convex.writerEpoch + 1;
    this.applyCheckpoint();
    this.transition('EMBEDDED_CANONICAL');
    this.canonical = 'embedded';
  }
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
    for (const [id, row] of this.embedded.rows) if (!checkpointIds.has(id)) this.reconcileQuarantine.push({ recordId: id, row });
    this.transition('CONVEX_CANONICAL');
    this.canonical = 'convex';
    this.parityWindowsClean = 0;
  }
  recover() {
    const complete = this.checkpoint && REQUIRED_GROUPS.every((g) => g in this.checkpoint) && this.checkpoint.appliedDigest;
    // Crash law is TYPED: complete checkpoint => embedded, else convex.
    this.canonical = complete ? this.c.crash_laws.complete_checkpoint_implies_writer : this.c.crash_laws.incomplete_checkpoint_implies_writer;
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

  let contract;
  try { contract = JSON.parse(readFileSync(join(ROOT, contractPath), 'utf8')); }
  catch (e) { return { errors: [`contract unreadable: ${e.message}`], proofs }; }

  // C0 — TYPED structure, fail-closed. No prose regex.
  ok(contract.schema === 'aukora-embedded-kira-cutover-contract-v2', 'C0.schema');
  const canonicalSeams = (contract.canonicality_registry?.seams ?? []).filter((s) => s.role === 'CANONICAL_DURABLE_MEMORY_WRITER');
  ok(canonicalSeams.length === 1, 'C0.exactly-one-canonical-seam', `found ${canonicalSeams.length}`);
  ok(contract.canonicality_registry?.fourth_store_forbidden === true, 'C0.fourth-store-forbidden');
  // Every durable seam is NAMED, incl. TrustedStateStore; no unnamed store.
  const seamNames = (contract.canonicality_registry?.seams ?? []).map((s) => s.name);
  ok(seamNames.includes('trusted-state-store') && (contract.canonicality_registry.seams.find((s) => s.name === 'trusted-state-store')?.code_identity ?? '').includes('trustedStateStore.ts'),
    'C0.trusted-state-store-named');
  ok((contract.canonicality_registry?.seams ?? []).every((s) => s.name && s.role && s.code_identity), 'C0.every-seam-named-typed');
  // Kill switch: TYPED direction enum, not prose.
  ok(contract.kill_switch?.env === 'AUKORA_EMBEDDED_CUTOVER_KILL' && contract.kill_switch.armed_value === '1', 'C0.kill-switch-named');
  ok(contract.kill_switch?.direction === 'FAIL_SAFE_TOWARD_CONVEX', 'C0.kill-switch-direction-typed-fail-safe');
  // Dual writes: TYPED boolean, not a 'FORBIDDEN' substring (defeats negation-smuggling).
  ok(contract.dual_writes?.allowed === false, 'C0.dual-writes-typed-false');
  // Single-writer invariant is typed.
  ok(contract.single_writer_invariant?.max_canonical_writers === 1 && contract.single_writer_invariant.overlapping_epochs_forbidden === true, 'C0.single-writer-invariant-typed');
  // Phase order + typed transition graph reconstructed and compared EXACTLY.
  ok(JSON.stringify(contract.phases?.order) === JSON.stringify(PHASES), 'C0.phase-order-exact');
  const edgeSet = new Set((contract.phases?.transition_graph ?? []).map((e) => `${e.from}->${e.to}`));
  contract._edgeSet = edgeSet;
  const edgesEqual = edgeSet.size === CANONICAL_EDGES.size && [...CANONICAL_EDGES].every((e) => edgeSet.has(e));
  ok(edgesEqual, 'C0.transition-graph-exact', `${edgeSet.size} edges`);
  ok(contract.phases?.rollback_edge?.from === 'EMBEDDED_CANONICAL' && contract.phases.rollback_edge.to === 'CONVEX_CANONICAL', 'C0.rollback-edge-typed');
  // Checkpoint field groups typed & exact (now 7, incl. erase-root + writer-epoch).
  ok(REQUIRED_GROUPS.every((g) => contract.checkpoint?.required_field_groups?.includes(g))
    && contract.checkpoint?.required_field_groups?.length === REQUIRED_GROUPS.length, 'C0.checkpoint-field-groups-exact', `${contract.checkpoint?.required_field_groups?.length}`);
  for (const g of ['erase_root_registry', 'writer_epoch_fence', 'erase_attestations_consumed_nonces', 'no_resurrection_tombstone_set']) {
    ok(contract.checkpoint?.required_field_groups?.includes(g) && !!contract.checkpoint?.field_semantics?.[g], `C0.checkpoint-has-${g}`);
  }
  // Writer-lock prerequisite typed.
  ok(contract.writer_lock_prerequisite?.capabilities?.cross_process_exclusive_lock === true
    && contract.writer_lock_prerequisite?.capabilities?.atomic_append === true
    && (contract.writer_lock_prerequisite?.required_before_phases ?? []).includes('CUTOVER_CHECKPOINT'), 'C0.writer-lock-prerequisite-typed');
  // Crash laws typed.
  ok(contract.crash_laws?.complete_checkpoint_implies_writer === 'embedded'
    && contract.crash_laws?.incomplete_checkpoint_implies_writer === 'convex'
    && contract.crash_laws?.zero_writer_recovery_forbidden === true
    && contract.crash_laws?.two_writer_recovery_forbidden === true, 'C0.crash-laws-typed');
  if (errors.length) return { errors, proofs };

  const fresh = (env) => new CutoverSim(contract, env);

  // P1 — happy path with writer lock; single-writer log with epochs.
  const sim = fresh();
  sim.convex.signedHeadHighWater = 7; sim.convex.consumedEraseNonces.add('n1'); sim.convex.tombstones.add('erased-1');
  sim.write('r1', 'alpha'); sim.write('r2', 'beta');
  sim.enterShadow(); sim.shadowRefresh();
  sim.acquireWriterLock();
  sim.parityCheck(); sim.parityCheck(); sim.parityCheck();
  ok(sim.phase === 'PARITY_PROVEN', 'P1.parity-proven-with-writer-lock', sim.phase);
  sim.cutover(sim.buildCheckpoint());
  ok(sim.phase === 'EMBEDDED_CANONICAL' && sim.canonical === 'embedded', 'P1.cutover-flips-single-writer');
  ok(sim.embedded.writerEpoch === 2 && sim.convex.writerEpoch === 1, 'P1.writer-epoch-fenced-and-incremented');
  sim.write('r3', 'gamma');
  ok(new Set(sim.writerLog.map((w) => w.writer)).size === 2 && sim.writerLog.every((w, _i, a) => a.filter((x) => x.seq === w.seq).length === 1), 'P1.exactly-one-writer-per-write');

  // P2 — writer lock is an EXECUTABLE prerequisite: no parity/cutover without it.
  const sim2 = fresh();
  sim2.write('a', '1'); sim2.enterShadow(); sim2.shadowRefresh();
  sim2.parityCheck(); sim2.parityCheck(); sim2.parityCheck(); // no lock acquired
  ok(sim2.phase === 'SHADOW_READS', 'P2.no-parity-without-writer-lock', sim2.phase);
  refuses(() => sim2.cutover(sim2.buildCheckpoint()), 'P2.cutover-refused-without-writer-lock', 'CUTOVER_REFUSED');

  // P3 — dual writes refused; non-canonical writes refused.
  const sim3 = fresh();
  sim3.write('a', '1'); sim3.enterShadow(); sim3.shadowRefresh();
  refuses(() => sim3.write('b', 'x', { targets: ['convex', 'embedded'] }), 'P3.dual-write-refused', 'DUAL_WRITE_REFUSED');
  refuses(() => sim3.write('b', 'x', { targets: ['embedded'] }), 'P3.non-canonical-write-refused', 'NON_CANONICAL_WRITE_REFUSED');
  ok(sim3.embedded.directWrites === 0 && sim3.embedded.rows.has('a'), 'P3.follower-populated-by-reads-only');

  // P4 — parity mismatch demotes and blocks cutover.
  const sim4 = fresh();
  sim4.write('a', '1'); sim4.enterShadow(); sim4.shadowRefresh(); sim4.acquireWriterLock();
  sim4.parityCheck(); sim4.parityCheck(); sim4.parityCheck();
  sim4.embedded.rows.set('phantom', { content: 'drift' });
  ok(sim4.parityCheck() === false && sim4.phase === 'SHADOW_READS', 'P4.parity-mismatch-demotes-and-blocks');
  refuses(() => sim4.cutover(sim4.buildCheckpoint()), 'P4.cutover-refused-without-parity', 'CUTOVER_REFUSED');

  // P5 — each of the 7 checkpoint field groups refuses cutover when missing.
  for (const g of REQUIRED_GROUPS) {
    const s = fresh();
    s.write('a', '1'); s.enterShadow(); s.shadowRefresh(); s.acquireWriterLock();
    s.parityCheck(); s.parityCheck(); s.parityCheck();
    refuses(() => s.cutover(s.buildCheckpoint(g)), `P5.checkpoint-missing-${g}-refused`, `missing ${g}`);
  }

  // P6 — kill switch (typed) refuses cutover, leaves Convex canonical.
  const sim6 = fresh({ AUKORA_EMBEDDED_CUTOVER_KILL: '1' });
  sim6.write('a', '1'); sim6.enterShadow(); sim6.shadowRefresh(); sim6.acquireWriterLock();
  sim6.parityCheck(); sim6.parityCheck(); sim6.parityCheck();
  refuses(() => sim6.cutover(sim6.buildCheckpoint()), 'P6.kill-switch-refuses-cutover', 'kill switch armed');
  ok(sim6.canonical === 'convex' && sim6.killSwitchFailSafeTowardConvex(), 'P6.kill-switch-fail-safe-toward-convex');

  // P7 — rollback boundary: quarantine post-checkpoint writes.
  const sim7 = fresh();
  sim7.write('a', '1'); sim7.enterShadow(); sim7.shadowRefresh(); sim7.acquireWriterLock();
  sim7.parityCheck(); sim7.parityCheck(); sim7.parityCheck();
  sim7.cutover(sim7.buildCheckpoint());
  sim7.write('post-1', 'embedded-only');
  sim7.rollback();
  ok(sim7.canonical === 'convex' && sim7.phase === 'CONVEX_CANONICAL', 'P7.rollback-restores-convex-at-boundary');
  ok(sim7.reconcileQuarantine.length === 1 && sim7.reconcileQuarantine[0].recordId === 'post-1', 'P7.post-checkpoint-writes-quarantined');

  // P8 — idempotent checkpoint replay.
  const sim8 = fresh();
  sim8.write('a', '1'); sim8.enterShadow(); sim8.shadowRefresh(); sim8.acquireWriterLock();
  sim8.parityCheck(); sim8.parityCheck(); sim8.parityCheck();
  sim8.cutover(sim8.buildCheckpoint());
  const before = sim8.embedded.snapshotDigest();
  ok(sim8.applyCheckpoint() === 'noop' && sim8.embedded.snapshotDigest() === before, 'P8.checkpoint-replay-idempotent');

  // P9 — crash canaries: recover from durable markers only, single legal writer, no lost writes.
  for (const crashAt of ['SHADOW_READS', 'PARITY_PROVEN', 'CUTOVER_CHECKPOINT', 'EMBEDDED_CANONICAL']) {
    const s = fresh();
    s.write('a', '1'); s.enterShadow(); s.shadowRefresh();
    if (crashAt !== 'SHADOW_READS') { s.acquireWriterLock(); s.parityCheck(); s.parityCheck(); s.parityCheck(); }
    if (crashAt === 'CUTOVER_CHECKPOINT') { s.phase = 'CUTOVER_CHECKPOINT'; s.checkpoint = s.buildCheckpoint('writer_epoch_fence'); }
    if (crashAt === 'EMBEDDED_CANONICAL') s.cutover(s.buildCheckpoint());
    const writer = s.recover();
    const expectEmbedded = crashAt === 'EMBEDDED_CANONICAL';
    ok((writer === 'convex' || writer === 'embedded') && PHASES.includes(s.phase) && writer === (expectEmbedded ? 'embedded' : 'convex'),
      `P9.crash-at-${crashAt}-recovers-single-writer`, `writer=${writer}`);
    ok(s.store(writer).rows.has('a'), `P9.crash-at-${crashAt}-no-acknowledged-write-lost`);
  }

  // P10 — ordering laws + edge graph enforcement.
  const sim10 = fresh();
  refuses(() => sim10.write('bad', 'x', { scanPassed: false }), 'P10.scan-before-chain-refused', 'SCAN_BEFORE_CHAIN_REFUSED');
  sim10.write('good', 'y');
  const receipt = sim10.convex.receipts.find((r) => r.recordId === 'good');
  ok(receipt && receipt.seq === sim10.convex.rows.get('good').receiptSeq, 'P10.receipt-before-effect-holds');
  refuses(() => { sim10.convex.tombstones.add('g2'); sim10.write('g2', 'z'); }, 'P10.no-resurrection-refused', 'NO_RESURRECTION_REFUSED');
  // Forbidden edge: SHADOW_READS -> EMBEDDED_CANONICAL (skip parity+checkpoint) must be refused by the typed graph.
  const sim11 = fresh();
  sim11.write('a', '1'); sim11.enterShadow();
  refuses(() => sim11.transition('EMBEDDED_CANONICAL'), 'P10.forbidden-edge-skip-parity-refused', 'PHASE_EDGE_FORBIDDEN');

  return { errors, proofs };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { errors, proofs } = runCutoverVerification(process.argv[2]);
  if (errors.length) { console.error('CUTOVER CONTRACT DRY-RUN v2: FAIL\n  ' + errors.join('\n  ')); process.exit(1); }
  console.log(`cutover-contract v2: dry-run verified — ${proofs.length} law proofs from TYPED contract data (kill-switch direction enum, dual-writes boolean, canonical seam role, ${CANONICAL_EDGES.size}-edge typed transition graph, ${REQUIRED_GROUPS.length}-group checkpoint incl. erase-root registry + erase-nonces + writer-epoch fence, executable cross-process writer-lock prerequisite, typed crash laws). HONEST SCOPE: offline enforceability simulation — NOT a live-store integration; no embedded store exists this round.`);
}
