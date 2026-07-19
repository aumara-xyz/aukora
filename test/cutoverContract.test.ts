// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R60 embedded-KIRA cutover contract guards v2 (Sam 3, directive item 1 / audit M3).
 *
 * Proves the dry-run verifier enforces the TYPED contract: the honest contract passes with the full
 * proof set, and every planted tamper hard-fails — including the M3-mandated classes that v1 could
 * not catch: negation-smuggling (dual_writes.allowed flipped, or prose that would fool a regex),
 * transition-graph edge add/delete, kill-switch direction flip to fail-forward, a thinned checkpoint
 * that drops the new erase-root / writer-epoch groups, and an unnamed durable store. HONEST SCOPE
 * mirrors the verifier's: enforceability of the law machine, offline — not a live-store integration.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-expect-error — plain .mjs module
import { runCutoverVerification } from '../scripts/verify-cutover-contract.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTRACT = 'docs/atlas/EMBEDDED_KIRA_CUTOVER_CONTRACT.json';
const honest = JSON.parse(readFileSync(join(ROOT, CONTRACT), 'utf8'));

const tamperRun = (mutate: (c: Record<string, unknown>) => void) => {
  const c = JSON.parse(JSON.stringify(honest));
  mutate(c);
  const dir = mkdtempSync(join(tmpdir(), 'cutover-tamper-'));
  const p = join(dir, 'contract.json');
  writeFileSync(p, JSON.stringify(c));
  return runCutoverVerification(relative(ROOT, p));
};

describe('R60 cutover contract v2 — the honest typed contract proves every law', () => {
  const r = runCutoverVerification();
  it('dry-run verifier reports zero errors on the committed contract', () => {
    expect(r.errors, r.errors.join('\n')).toEqual([]);
  });
  it('the full proof set is present (typed structure + all law families)', () => {
    expect(r.proofs.length).toBeGreaterThanOrEqual(45);
    for (const key of [
      'C0.exactly-one-canonical-seam', 'C0.fourth-store-forbidden', 'C0.trusted-state-store-named',
      'C0.kill-switch-direction-typed-fail-safe', 'C0.dual-writes-typed-false',
      'C0.single-writer-invariant-typed', 'C0.transition-graph-exact', 'C0.rollback-edge-typed',
      'C0.writer-lock-prerequisite-typed', 'C0.crash-laws-typed',
      'P1.writer-epoch-fenced-and-incremented', 'P2.no-parity-without-writer-lock',
      'P2.cutover-refused-without-writer-lock', 'P3.dual-write-refused',
      'P4.cutover-refused-without-parity', 'P6.kill-switch-fail-safe-toward-convex',
      'P7.post-checkpoint-writes-quarantined', 'P8.checkpoint-replay-idempotent',
      'P10.receipt-before-effect-holds', 'P10.no-resurrection-refused', 'P10.forbidden-edge-skip-parity-refused',
    ]) {
      expect(r.proofs.some((p: string) => p.startsWith(key)), key).toBe(true);
    }
  });
  it('every one of the 7 checkpoint field groups has its own completeness refusal proof', () => {
    for (const g of ['signed_heads_high_water', 'record_id_derivation', 'receipt_chain_anchors',
      'no_resurrection_tombstone_set', 'erase_attestations_consumed_nonces', 'erase_root_registry', 'writer_epoch_fence']) {
      expect(r.proofs.some((p: string) => p.includes(`P5.checkpoint-missing-${g}-refused`)), g).toBe(true);
    }
  });
  it('all four crash canaries recover to a single writer without losing acknowledged writes', () => {
    for (const phase of ['SHADOW_READS', 'PARITY_PROVEN', 'CUTOVER_CHECKPOINT', 'EMBEDDED_CANONICAL']) {
      expect(r.proofs.some((p: string) => p.includes(`P9.crash-at-${phase}-recovers-single-writer`)), phase).toBe(true);
      expect(r.proofs.some((p: string) => p.includes(`P9.crash-at-${phase}-no-acknowledged-write-lost`)), phase).toBe(true);
    }
  });
});

describe('R60 cutover contract v2 — planted typed tampers hard-fail (incl. M3 classes)', () => {
  const fails = (mutate: (c: any) => void) => expect(tamperRun(mutate).errors.length).toBeGreaterThan(0);

  it('a second CANONICAL_DURABLE_MEMORY_WRITER seam fails', () =>
    fails((c) => c.canonicality_registry.seams.push({ name: 'rogue', role: 'CANONICAL_DURABLE_MEMORY_WRITER', code_identity: 'x', detail: 'x' })));
  it('permitting a fourth store fails', () =>
    fails((c) => { c.canonicality_registry.fourth_store_forbidden = false; }));
  it('dropping the TrustedStateStore seam name (unnamed store) fails', () =>
    fails((c) => { c.canonicality_registry.seams = c.canonicality_registry.seams.filter((s: any) => s.name !== 'trusted-state-store'); }));

  // M3: negation-smuggling — a typed boolean, not a prose regex, so this is caught.
  it('negation-smuggling dual_writes.allowed=true fails', () =>
    fails((c) => { c.dual_writes.allowed = true; }));
  it('kill-switch direction flipped to FAIL_FORWARD_TO_EMBEDDED fails', () =>
    fails((c) => { c.kill_switch.direction = 'FAIL_FORWARD_TO_EMBEDDED'; }));

  // M3: transition-graph add/delete-edge tampers.
  it('adding an illegal skip edge (SHADOW_READS->EMBEDDED_CANONICAL) fails', () =>
    fails((c) => { c.phases.transition_graph.push({ from: 'SHADOW_READS', to: 'EMBEDDED_CANONICAL', guard: 'sneaky' }); }));
  it('deleting the rollback edge fails', () =>
    fails((c) => { c.phases.transition_graph = c.phases.transition_graph.filter((e: any) => !(e.from === 'EMBEDDED_CANONICAL' && e.to === 'CONVEX_CANONICAL')); }));

  // M3: checkpoint must carry the new erase-root and writer-epoch continuity.
  it('dropping erase_root_registry from the checkpoint fails', () =>
    fails((c) => { c.checkpoint.required_field_groups = c.checkpoint.required_field_groups.filter((g: string) => g !== 'erase_root_registry'); }));
  it('dropping writer_epoch_fence from the checkpoint fails', () =>
    fails((c) => { c.checkpoint.required_field_groups = c.checkpoint.required_field_groups.filter((g: string) => g !== 'writer_epoch_fence'); }));

  // Writer-lock prerequisite must stay typed-true.
  it('disabling the cross-process writer lock prerequisite fails', () =>
    fails((c) => { c.writer_lock_prerequisite.capabilities.cross_process_exclusive_lock = false; }));

  it('reordering the phase machine fails', () =>
    fails((c) => { c.phases.order = [...c.phases.order].reverse(); }));
  it('flipping a crash law (complete checkpoint => convex) fails', () =>
    fails((c) => { c.crash_laws.complete_checkpoint_implies_writer = 'convex'; }));
  it('a wrong schema fails', () =>
    fails((c) => { c.schema = 'aukora-embedded-kira-cutover-contract-v1'; }));
});
