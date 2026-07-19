// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/// <reference types="vite/client" />
/**
 * WAVE 2 — signed continuity proofs (donor-restored, adapted at the boundary only).
 *
 * Covers: donor comparative vectors (preimage byte-shape) · forged/tampered/expired attestation refusals ·
 * anti-replay · erase receipt with no plaintext residue · deletion closure across derived state · crash between
 * receipt and row → restart reconciliation · stale/monotonic signed-head refusals · adaptive-organ severance.
 * All on convex-test (SIMULATED); the live crash proof is transcripted in LOCAL_DEV_EVIDENCE.md.
 */
import { convexTest } from 'convex-test';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import schema from '../convex/schema';
import { api, internal } from '../convex/_generated/api';
import { buildMemoryRecord } from '@aukora/memory';
import {
  signEraseAttestation, verifyEraseAttestation, serializeEraseV1, ERASE_DOMAIN_PREFIX, ERASE_FRESHNESS_MS,
  signChainHeadV3, verifyChainHeadV3, serializeSignedChainHeadV3, mlDsa65PublicKeyFromSeed,
  buildEraseRootRegistry, type RegisteredEraseRoots,
} from '../src/index.js';
import { receiptHistoryRootHex } from '@aukora/kernel/merkle';

const modules = import.meta.glob('../convex/**/*.*s');
const SEED = 'a'.repeat(64);
const at = (s: number) => `2026-07-16T00:00:${String(s).padStart(2, '0')}.000Z`;
const eraseFor = (recordId: string, over: Record<string, unknown> = {}) =>
  signEraseAttestation(SEED, { ownerRootId: 'owner-test', key: recordId, eraseReason: 'test erase', timestamp: Date.now(), ...over });

// R59 G1: the registered-root pin. Tests pin the SEED public key to the roots they exercise; the Convex `forget`
// handler reads the pin from the `eraseRoots` allowlist table, seeded per-test via seedRoot().
let SEED_PUB = '';
let REGISTRY: RegisteredEraseRoots;
beforeAll(async () => {
  SEED_PUB = await mlDsa65PublicKeyFromSeed(SEED);
  REGISTRY = buildEraseRootRegistry([['owner-test', SEED_PUB], ['o', SEED_PUB]]);
});
async function seedRoot(t: ReturnType<typeof convexTest>, ownerRootId = 'owner-test', publicKeyHex = SEED_PUB) {
  await t.run(async (ctx) => {
    await ctx.db.insert('eraseRoots', { ownerRootId, publicKeyHex, advisoryOnly: true as const, grantsAuthority: false as const });
  });
}

describe('WAVE 2 — erase attestation law (donor-faithful)', () => {
  it('donor comparative vector: preimage is the exact "aukora-aumlok-memerase-v1|" sorted-key JSON shape', () => {
    const fields = { v: 1, ownerRootId: 'r', key: 'k', eraseReason: 'because', timestamp: 42 };
    const s = serializeEraseV1(fields);
    expect(s.startsWith(`${ERASE_DOMAIN_PREFIX}|`)).toBe(true);
    // sorted keys, exactly the donor field set — no extra fields, no reordering
    expect(s.slice(ERASE_DOMAIN_PREFIX.length + 1)).toBe('{"eraseReason":"because","key":"k","ownerRootId":"r","timestamp":42,"v":1}');
  });

  it('a valid attestation verifies; forged / tampered / expired / wrong-scope all REFUSE', async () => {
    const now = Date.now();
    const a = await signEraseAttestation(SEED, { ownerRootId: 'o', key: 'f'.repeat(64), eraseReason: 'r', timestamp: now });
    expect((await verifyEraseAttestation(a, now, REGISTRY)).ok).toBe(true);
    // forged signature
    expect((await verifyEraseAttestation({ ...a, signatureHex: '0'.repeat(a.signatureHex.length) }, now, REGISTRY)).ok).toBe(false);
    // tampered reason (signature no longer matches the preimage)
    expect((await verifyEraseAttestation({ ...a, eraseReason: 'DIFFERENT' }, now, REGISTRY)).ok).toBe(false);
    // expired (older than the donor 60s window)
    const exp = await verifyEraseAttestation(a, now + ERASE_FRESHNESS_MS + 1, REGISTRY);
    expect(exp).toEqual({ ok: false, reason: 'expired' });
    // wrong public key (different owner) — now refused as not-the-pinned-key (G1 pin), before signature check
    const otherPub = await mlDsa65PublicKeyFromSeed('b'.repeat(64));
    expect((await verifyEraseAttestation({ ...a, publicKeyHex: otherPub }, now, REGISTRY)).ok).toBe(false);
  });
});

describe('WAVE 2 — attestation-gated forgetting (convex, SIMULATED)', () => {
  async function seedOne(t: ReturnType<typeof convexTest>, content: string, ownerRootId = 'owner-test') {
    const rec = buildMemoryRecord({ content, createdAt: at(1) });
    await t.action(api.ingest.ingest, { record: rec, ownerRootId }); // R60 M1: bind record→root at ingest
    return rec;
  }

  it('erase leaves NO plaintext residue and records a content-free evidence row + erasure receipt', async () => {
    const t = convexTest(schema, modules);
    await seedRoot(t);
    const rec = await seedOne(t, 'a private thing to erase');
    const done = await t.mutation(api.memory.forget, { recordId: rec.recordId, at: at(2), attestation: await eraseFor(rec.recordId, { eraseReason: 'owner asked' }) });
    expect(done.ok).toBe(true);
    // no plaintext anywhere across ALL derived state
    const residue = await t.run(async (ctx) => {
      const chain = await ctx.db.query('memoryChain').withIndex('by_index').collect();
      const forgotten = await ctx.db.query('forgotten').collect();
      const attest = await ctx.db.query('eraseAttestations').collect();
      const events = await ctx.db.query('receiptEvents').collect();
      const snap = await ctx.db.query('brainSnapshot').first();
      return JSON.stringify({ chain, forgotten, attest, events, snap });
    });
    expect(residue).not.toContain('private thing');
    // evidence + erasure receipt present (content-free)
    const evidence = await t.query(api.memory.eraseEvidence, { recordId: rec.recordId });
    expect(evidence.length).toBe(1);
    expect(evidence[0].eraseReason).toBe('owner asked'); // owner-attested words are inside the signed preimage
    expect(evidence[0].originalReceiptHash).toMatch(/^[0-9a-f]{64}$/);
    expect((await t.query(api.memory.verify, {})).valid).toBe(true);
  });

  it('anti-replay: the same attestation cannot erase twice', async () => {
    const t = convexTest(schema, modules);
    await seedRoot(t);
    const rec = await seedOne(t, 'erase me once');
    const attestation = await eraseFor(rec.recordId);
    expect((await t.mutation(api.memory.forget, { recordId: rec.recordId, at: at(2), attestation })).ok).toBe(true);
    const replay = await t.mutation(api.memory.forget, { recordId: rec.recordId, at: at(3), attestation });
    expect(replay.ok).toBe(false);
    // it is refused as replay (nonce already consumed) — not silently re-applied
    expect(replay.refusal).toMatch(/replay|already/);
  });

  it('scope mismatch: an attestation for another record cannot erase this one', async () => {
    const t = convexTest(schema, modules);
    await seedRoot(t);
    const rec = await seedOne(t, 'scoped memory');
    const wrong = await eraseFor('c'.repeat(64)); // attests a different key
    const r = await t.mutation(api.memory.forget, { recordId: rec.recordId, at: at(2), attestation: wrong });
    expect(r.ok).toBe(false);
    expect(r.refusal).toContain('scope mismatch');
  });

  it('deletion closure: after erase, recall + snapshot + evidence agree, and the chain still verifies', async () => {
    const t = convexTest(schema, modules);
    await seedRoot(t);
    const rec = await seedOne(t, 'closure target');
    await t.action(api.ingest.ingest, { record: buildMemoryRecord({ content: 'kept', createdAt: at(2) }) });
    await t.mutation(api.memory.forget, { recordId: rec.recordId, at: at(3), attestation: await eraseFor(rec.recordId) });
    expect((await t.query(api.memory.recall, { text: 'closure' })).length).toBe(0); // gone from recall
    const snap = await t.query(api.memory.snapshot, {});
    expect(snap?.liveCount).toBe(1);
    expect(snap?.forgottenCount).toBe(1);
    expect((await t.query(api.memory.eraseEvidence, { recordId: rec.recordId })).length).toBe(1); // closure evidence
    expect((await t.query(api.memory.verify, {})).valid).toBe(true);                               // chain intact
  });
});

describe('WAVE 2 — PQC signed heads over the live chain (convex, SIMULATED)', () => {
  it('records a valid v4 head bound to the kernel Merkle root; audit confirms it matches the chain', async () => {
    const t = convexTest(schema, modules);
    for (let i = 1; i <= 3; i++) await t.action(api.ingest.ingest, { record: buildMemoryRecord({ content: `head ${i}`, createdAt: at(i) }) });
    const rows = await t.run(async (ctx) => ctx.db.query('memoryChain').withIndex('by_index').collect());
    const chainHashes = (rows as { chainHash: string }[]).map((r) => r.chainHash);
    const head = { chainKey: 'aukora:memoryChain', timestamp: 1000, chainLength: chainHashes.length, chainHeadHash: chainHashes[chainHashes.length - 1] };
    const merkleRootHex = receiptHistoryRootHex(chainHashes);
    const signatureHex = await (await import('../src/index.js')).signChainHeadV4(SEED, head, merkleRootHex, 'chainHead');
    const publicKeyHex = await mlDsa65PublicKeyFromSeed(SEED);
    const rec = await t.mutation(api.heads.recordSignedHead, { ...head, version: 4, merkleRootHex, signatureHex, publicKeyHex });
    expect(rec.ok).toBe(true);
    const audit = await t.query(api.heads.auditSignedHead, { chainKey: 'aukora:memoryChain' });
    expect(audit.present).toBe(true);
    expect(audit.signatureValid).toBe(true);
    expect(audit.chainMatches).toBe(true);
  });

  it('MONOTONICITY: a shorter/older head is refused (truncation/rollback detection)', async () => {
    const t = convexTest(schema, modules);
    const mk = async (len: number, ts: number) => {
      const head = { chainKey: 'k', timestamp: ts, chainLength: len, chainHeadHash: 'd'.repeat(64) };
      return { ...head, version: 3 as const, merkleRootHex: null, signatureHex: await signChainHeadV3(SEED, head, 'chainHead'), publicKeyHex: await mlDsa65PublicKeyFromSeed(SEED) };
    };
    expect((await t.mutation(api.heads.recordSignedHead, await mk(5, 2000))).ok).toBe(true);
    expect((await t.mutation(api.heads.recordSignedHead, await mk(3, 3000))).refusal).toContain('truncation/rollback');
    expect((await t.mutation(api.heads.recordSignedHead, await mk(6, 1000))).refusal).toContain('stale head');
  });

  it('a forged head signature is refused (store integrity — Convex verifies but never decides)', async () => {
    const t = convexTest(schema, modules);
    const head = { chainKey: 'k', timestamp: 1, chainLength: 1, chainHeadHash: 'e'.repeat(64) };
    const forged = { ...head, version: 3 as const, merkleRootHex: null, signatureHex: '0'.repeat(3309 * 2), publicKeyHex: await mlDsa65PublicKeyFromSeed(SEED) };
    expect((await t.mutation(api.heads.recordSignedHead, forged)).refusal).toContain('signature invalid');
  });
});

describe('WAVE 2 — crash reconciliation (receipt-before-row across restart)', () => {
  it('the two-phase rehearsal reconciles across a simulated crash: receipt exists before its effect, no duplicate', async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.rehearsal.startRehearsal, { key: 'wf-crash', totalSteps: 2, authorityRef: 'a'.repeat(64) });
    // "crash" = the scheduled effect never fired; the step-1 RECEIPT is already committed, the effect is not.
    const midStream = await t.query(api.rehearsal.receiptStream, { rehearsalKey: 'wf-crash' });
    expect(midStream.map((e: any) => e.event)).toEqual(['started', 'step-receipt']); // receipt strictly BEFORE its row
    expect((await t.query(api.rehearsal.rehearsalStatus, { key: 'wf-crash' }))?.effectsApplied).toBe(0);
    // RESTART: the resumed scheduler re-fires the step-1 effect. Drive it directly, twice, to prove exactly-once.
    expect((await t.mutation(internal.rehearsal.applyStepEffect, { key: 'wf-crash', step: 1 })).ok).toBe(true);
    const again = await t.mutation(internal.rehearsal.applyStepEffect, { key: 'wf-crash', step: 1 });
    expect(again.alreadyApplied ?? false).toBe(true); // no duplicate effect on the re-fire
    const status = await t.query(api.rehearsal.rehearsalStatus, { key: 'wf-crash' });
    expect(status?.effectsApplied).toBe(1); // exactly one effect for step 1 despite the double drive
    expect((await t.query(api.rehearsal.verifyReceiptEvents, {})).valid).toBe(true); // receipt spine intact
  });
});

describe('WAVE 2 — adaptive-organ severance (advisory metabolism cannot become authority)', () => {
  it('a severed/untrusted adaptive signal cannot authorize or release; it only contracts', async () => {
    // the metabolism simulator is the adaptive organ; severance = untrusted samples. They must never authorize.
    const { runMetabolism, metabolismGrantsAuthority, BUDGET_BASE } = await import('../src/index.js');
    const severed = runMetabolism(BUDGET_BASE, [
      { schema: 'aukora-metabolism-sample-v1', sensorId: 'severed', dimension: 'energy', unitScale: 1, value: 0, timestampMs: 1, trusted: false },
    ]);
    expect(severed.budgetCeiling).toBe(BUDGET_BASE); // untrusted cannot contract-to-zero (no DoS oracle)
    expect(severed.grantsAuthority).toBe(false);
    expect(metabolismGrantsAuthority()).toBe(false); // never authority — release stays with the owner ceremony
  });
});
