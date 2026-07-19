// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R59 embedded-KIRA cutover contract guards (Sam 3, directive item 1).
 *
 * Proves the dry-run verifier enforces the contract's laws: the honest contract passes with the
 * full proof set, and every planted contract tamper (second canonical writer, permitted fourth
 * store, thinned checkpoint, renamed kill switch, reordered phases, dual-writes-allowed wording)
 * hard-fails. HONEST SCOPE mirrors the verifier's: enforceability of the law machine, offline —
 * not a live-store integration; no embedded store exists this round.
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

describe('R59 cutover contract — the honest contract proves every law', () => {
  const r = runCutoverVerification();
  it('dry-run verifier reports zero errors on the committed contract', () => {
    expect(r.errors, r.errors.join('\n')).toEqual([]);
  });
  it('the full proof set is present (structure + 10 law families)', () => {
    expect(r.proofs.length).toBeGreaterThanOrEqual(30);
    for (const key of [
      'C0.exactly-one-canonical-seam', 'C0.fourth-store-forbidden', 'C0.checkpoint-field-groups-exact',
      'P1.exactly-one-writer-per-write-no-overlap', 'P2.dual-write-refused',
      'P3.shadow-follower-rejects-direct-writes', 'P4.cutover-refused-without-parity',
      'P6.kill-switch-refuses-cutover', 'P7.post-checkpoint-writes-quarantined-not-dropped',
      'P8.checkpoint-replay-idempotent', 'P10.receipt-before-effect-holds', 'P10.no-resurrection-refused',
    ]) {
      expect(r.proofs.some((p: string) => p.startsWith(key)), key).toBe(true);
    }
  });
  it('every checkpoint field group has its own completeness refusal proof', () => {
    for (const g of ['signed_heads_high_water', 'attestation_nonces', 'tombstones_no_resurrection', 'record_id_derivation', 'receipt_chain_anchors']) {
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

describe('R59 cutover contract — planted contract tampers hard-fail', () => {
  it('a second CANONICAL_DURABLE_MEMORY_WRITER seam fails', () => {
    const r = tamperRun((c: any) => {
      c.canonicality_registry.seams.push({ name: 'rogue', role: 'CANONICAL_DURABLE_MEMORY_WRITER', detail: 'x' });
    });
    expect(r.errors.length).toBeGreaterThan(0);
  });
  it('permitting a fourth store fails', () => {
    const r = tamperRun((c: any) => { c.canonicality_registry.fourth_store_forbidden = false; });
    expect(r.errors.length).toBeGreaterThan(0);
  });
  it('thinning the checkpoint field groups fails', () => {
    const r = tamperRun((c: any) => { c.checkpoint.required_field_groups = c.checkpoint.required_field_groups.slice(0, 4); });
    expect(r.errors.length).toBeGreaterThan(0);
  });
  it('renaming the kill switch fails', () => {
    const r = tamperRun((c: any) => { c.laws.kill_switch.env = 'AUKORA_TOTALLY_SAFE_FLAG'; });
    expect(r.errors.length).toBeGreaterThan(0);
  });
  it('reordering the phase machine fails', () => {
    const r = tamperRun((c: any) => { c.phases.order = [...c.phases.order].reverse(); });
    expect(r.errors.length).toBeGreaterThan(0);
  });
  it('softening the dual-write prohibition wording fails', () => {
    const r = tamperRun((c: any) => { c.laws.transition_mode = 'Dual writes are permitted briefly during migration.'; });
    expect(r.errors.length).toBeGreaterThan(0);
  });
  it('a wrong schema fails', () => {
    const r = tamperRun((c: any) => { c.schema = 'aukora-embedded-kira-cutover-contract-v0'; });
    expect(r.errors.length).toBeGreaterThan(0);
  });
});
