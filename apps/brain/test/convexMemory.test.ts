// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/// <reference types="vite/client" />
/**
 * convex-test suite for the curated Convex memory backend (apps/brain/convex).
 *
 * HONESTY LABEL: this exercises `convex-test` — an in-process, headless SIMULATED Convex backend (real Convex
 * query/mutation semantics, reactive reads, indexes, transactional db). It is NOT a live Convex cloud
 * deployment and makes NO liveness claim. No network, no deployment, no login, no paid call.
 *
 * It proves, on the actual Convex functions: append → reactive snapshot update → recall; growth across ingests;
 * tamper of any prior chain row detected by the canonical verifier; governed forgetting removes the plaintext,
 * keeps a content-free tombstone, and leaves the chain verifiable; and fail-closed refusal of malformed /
 * authority-shaped / secret-bearing memory.
 */
import { convexTest } from 'convex-test';
import { describe, it, expect, vi } from 'vitest';
import schema from '../convex/schema';
import { api } from '../convex/_generated/api';
import { buildMemoryRecord } from '@aukora/memory';
import { signEraseAttestation } from '../src/index.js';

const ERASE_SEED = 'a'.repeat(64); // disposable owner seed for tests only
const eraseFor = (recordId: string) => signEraseAttestation(ERASE_SEED, { ownerRootId: 'owner-test', key: recordId, eraseReason: 'test erase', timestamp: Date.now() });

// convex-test locates the module root from the `_generated` directory in these keys.
const modules = import.meta.glob('../convex/**/*.*s');

const at = (s: number) => `2026-07-16T00:00:${String(s).padStart(2, '0')}.000Z`;

describe('convex-test: reactive receipt-chained growing memory (headless simulated Convex, NOT live cloud)', () => {
  it('append → reactive snapshot update → recall', async () => {
    const t = convexTest(schema, modules);
    const rec = buildMemoryRecord({ content: 'event A: the organism woke', createdAt: at(1) });
    const A = await t.action(api.ingest.ingest, { record: rec });
    expect(A.ok).toBe(true);

    const snap = await t.query(api.memory.snapshot, {});
    expect(snap?.liveCount).toBe(1);          // reactive snapshot recomputed on append
    expect(snap?.chainLength).toBe(1);
    expect(snap?.headHash).toBe(A.chainHash);  // head reflects the appended entry
    expect(snap?.merkleRootHex).not.toBeNull();

    const recalled = await t.query(api.memory.recall, { text: 'woke' });
    expect(recalled.map((h: any) => h.content)).toEqual(['event A: the organism woke']);
  });

  it('memory grows across multiple ingests (liveCount strictly rises)', async () => {
    const t = convexTest(schema, modules);
    let prevRoot: string | null = null;
    for (let i = 1; i <= 4; i++) {
      await t.action(api.ingest.ingest, { record: buildMemoryRecord({ content: `event ${i}: grew`, createdAt: at(i) }) });
      const snap = await t.query(api.memory.snapshot, {});
      expect(snap?.liveCount).toBe(i);                 // GROWTH proven, ingest by ingest
      expect(snap?.merkleRootHex).not.toBe(prevRoot);  // reactive Merkle root moved each time
      prevRoot = snap?.merkleRootHex ?? null;
    }
    const snap = await t.query(api.memory.snapshot, {});
    expect(snap?.chainLength).toBe(4);
    expect((await t.query(api.memory.verify, {})).valid).toBe(true);
  });

  it('tampering with a prior chain row (committed metadata) fails verification', async () => {
    const t = convexTest(schema, modules);
    for (let i = 1; i <= 3; i++) {
      await t.action(api.ingest.ingest, { record: buildMemoryRecord({ content: `link ${i}`, createdAt: at(i) }) });
    }
    expect((await t.query(api.memory.verify, {})).valid).toBe(true);

    // Directly tamper the committed provenance of the MIDDLE row via raw db access.
    await t.run(async (ctx) => {
      const rows = await ctx.db.query('memoryChain').withIndex('by_index').collect();
      await ctx.db.patch(rows[1]._id, { provenance: 'tampered-after-the-fact' });
    });

    const verdict = await t.query(api.memory.verify, {});
    expect(verdict.valid).toBe(false);
    expect(verdict.breakIndex).toBe(1);
  });

  it('tampering with a stored chainHash fails verification at that link', async () => {
    const t = convexTest(schema, modules);
    await t.action(api.ingest.ingest, { record: buildMemoryRecord({ content: 'genesis', createdAt: at(1) }) });
    await t.action(api.ingest.ingest, { record: buildMemoryRecord({ content: 'next', createdAt: at(2) }) });

    await t.run(async (ctx) => {
      const rows = await ctx.db.query('memoryChain').withIndex('by_index').collect();
      // A syntactically valid but wrong 64-hex hash for the genesis row.
      await ctx.db.patch(rows[0]._id, { chainHash: '0'.repeat(64) });
    });

    const verdict = await t.query(api.memory.verify, {});
    expect(verdict.valid).toBe(false);
    expect(verdict.breakIndex).toBe(0);
  });

  it('governed forgetting: removes plaintext, keeps a content-free tombstone, chain still verifies', async () => {
    const t = convexTest(schema, modules);
    const secretish = buildMemoryRecord({ content: 'private diary entry to forget', createdAt: at(1) });
    await t.action(api.ingest.ingest, { record: secretish });
    await t.action(api.ingest.ingest, { record: buildMemoryRecord({ content: 'kept memory', createdAt: at(2) }) });

    // Refuse without a signed erase attestation — still visible.
    const denied = await t.mutation(api.memory.forget, { recordId: secretish.recordId, at: at(3), attestation: { bogus: true } });
    expect(denied.ok).toBe(false);
    expect((await t.query(api.memory.recall, { text: 'diary' })).length).toBe(1);

    // Owner-signed erase attestation (WAVE 2).
    const done = await t.mutation(api.memory.forget, { recordId: secretish.recordId, at: at(4), attestation: await eraseFor(secretish.recordId) });
    expect(done.ok).toBe(true);

    // Plaintext no longer recalled; snapshot shrank; a tombstone was appended.
    expect((await t.query(api.memory.recall, { text: 'diary' })).length).toBe(0);
    const snap = await t.query(api.memory.snapshot, {});
    expect(snap?.liveCount).toBe(1);
    expect(snap?.forgottenCount).toBe(1);
    expect(snap?.chainLength).toBe(3); // 2 memories + 1 tombstone

    // Storage-layer proof: the forgotten memory row has NO content column, the tombstone is content-free, and
    // no plaintext of the forgotten memory remains anywhere in the chain.
    const audit = await t.run(async (ctx) => {
      const rows = await ctx.db.query('memoryChain').withIndex('by_index').collect();
      const memRow = rows.find((r: any) => r.recordId === secretish.recordId && r.kind === 'memory');
      const tomb = rows[rows.length - 1];
      return { memHasContent: memRow?.content !== undefined, tombKind: tomb.kind, tombHasContent: tomb.content !== undefined, dump: JSON.stringify(rows) };
    });
    expect(audit.memHasContent).toBe(false);       // plaintext REMOVED
    expect(audit.tombKind).toBe('tombstone');
    expect(audit.tombHasContent).toBe(false);       // tombstone is content-free
    expect(audit.dump).not.toContain('diary');      // no plaintext of the forgotten memory survives in the chain

    // The chain — never rewritten — still verifies end to end.
    expect((await t.query(api.memory.verify, {})).valid).toBe(true);
  });

  it('refuses malformed / authority-shaped memory (fail-closed; nothing chained)', async () => {
    const t = convexTest(schema, modules);
    const bad = await t.action(api.ingest.ingest, { record: { schema: 'aukora-memory-v1', grantsAuthority: true } });
    expect(bad.ok).toBe(false);
    const snap = await t.query(api.memory.snapshot, {});
    expect(snap?.chainLength ?? 0).toBe(0);
  });

  it('refuses a memory whose content carries a secret (canonical @aukora/evidence scanner reuse)', async () => {
    const t = convexTest(schema, modules);
    const withSecret = buildMemoryRecord({ content: 'my aws key AKIAIOSFODNN7EXAMPLE leaked into a note', createdAt: at(1) });
    const res = await t.action(api.ingest.ingest, { record: withSecret });
    expect(res.ok).toBe(false);
    expect(res.refusal).toContain('secret');
    const snap = await t.query(api.memory.snapshot, {});
    expect(snap?.chainLength ?? 0).toBe(0); // the secret never entered the chain
  });

  it('receipt-before-row: every stored row carries a valid receipt; health is ok', async () => {
    const t = convexTest(schema, modules);
    for (let i = 1; i <= 3; i++) await t.action(api.ingest.ingest, { record: buildMemoryRecord({ content: `r ${i}`, createdAt: at(i) }) });
    const rows = await t.run(async (ctx) => ctx.db.query('memoryChain').withIndex('by_index').collect());
    for (const row of rows as any[]) expect(row.chainHash).toMatch(/^[0-9a-f]{64}$/); // no row without a receipt
    const h = await t.query(api.memory.health, {});
    expect(h.ok).toBe(true);
    expect(h.chainLength).toBe(3);
  });

  it('query→mutation→scheduled end-to-end: a scheduled heartbeat (delayed impulse) runs and its status is observable', async () => {
    vi.useFakeTimers();
    try {
      const t = convexTest(schema, modules);
      // mutation (atomic reflex) → data in
      await t.action(api.ingest.ingest, { record: buildMemoryRecord({ content: 'pulse source', createdAt: at(1) }) });
      // mutation schedules the delayed impulse
      const s = await t.mutation(api.memory.scheduleHeartbeat, { delayMs: 1000 });
      expect(s.ok).toBe(true);
      // sense: the scheduled function is PENDING before its time arrives
      const pending = await t.query(api.memory.scheduledStatus, { scheduledId: s.scheduledId });
      expect(pending?.state).toBe('pending');
      expect(pending?.name).toContain('heartbeat');
      // advance time → the impulse fires; wait for completion
      vi.advanceTimersByTime(1000);
      await t.finishInProgressScheduledFunctions();
      const done = await t.query(api.memory.scheduledStatus, { scheduledId: s.scheduledId });
      expect(done?.state).toBe('success');
      // reactive query (sense): the snapshot the heartbeat recomputed is intact
      const snap = await t.query(api.memory.snapshot, {});
      expect(snap?.liveCount).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ingest is IDEMPOTENT: the same content-addressed record twice ⇒ one row, same receipt', async () => {
    const t = convexTest(schema, modules);
    const rec = buildMemoryRecord({ content: 'once only', createdAt: at(1) });
    const first = await t.action(api.ingest.ingest, { record: rec });
    const second = await t.action(api.ingest.ingest, { record: rec }); // retry-safe impulse
    expect(second.ok).toBe(true);
    expect(second.idempotent).toBe(true);
    expect(second.chainHash).toBe(first.chainHash); // same receipt, no duplicate append
    const snap = await t.query(api.memory.snapshot, {});
    expect(snap?.liveCount).toBe(1);
    expect(snap?.chainLength).toBe(1);
    expect((await t.query(api.memory.verify, {})).valid).toBe(true);
  });

  it('durable impulse: retry state recorded, then success with chain-head receipt linkage', async () => {
    vi.useFakeTimers();
    try {
      const t = convexTest(schema, modules);
      await t.action(api.ingest.ingest, { record: buildMemoryRecord({ content: 'impulse ground', createdAt: at(1) }) });
      // fail the first 2 attempts deterministically; succeed on the 3rd
      const s = await t.mutation(api.memory.scheduleImpulse, { name: 'heartbeat-retry', delayMs: 100, maxAttempts: 5, failFirstAttempts: 2 });
      expect(s.ok).toBe(true);
      await t.finishAllScheduledFunctions(vi.runAllTimers); // drains retries too
      const status = await t.query(api.memory.impulseStatus, { impulseId: s.impulseId });
      expect(status?.status).toBe('success');
      expect(status?.attempts).toBe(3); // retry state: 2 failures + 1 success
      const snap = await t.query(api.memory.snapshot, {});
      expect(status?.chainHeadAtCompletion).toBe(snap?.headHash); // receipt linkage
      // budget decremented once per RUN (3 runs)
      expect((await t.query(api.memory.impulseBudgetRemaining, {})).remaining).toBe(64 - 3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('durable impulse: cancellation stops a pending impulse and its scheduled run', async () => {
    vi.useFakeTimers();
    try {
      const t = convexTest(schema, modules);
      const s = await t.mutation(api.memory.scheduleImpulse, { name: 'to-cancel', delayMs: 60_000, maxAttempts: 3 });
      const c = await t.mutation(api.memory.cancelImpulse, { impulseId: s.impulseId });
      expect(c.ok).toBe(true);
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      const status = await t.query(api.memory.impulseStatus, { impulseId: s.impulseId });
      expect(status?.status).toBe('cancelled');
      expect(status?.attempts).toBe(0); // never ran
    } finally {
      vi.useRealTimers();
    }
  });

  it('impulse spend ceiling fails closed: exhausted budget refuses new impulses and marks running ones failed', async () => {
    vi.useFakeTimers();
    try {
      const t = convexTest(schema, modules);
      await t.run(async (ctx) => { await ctx.db.insert('impulseBudget', { remaining: 1 }); });
      const s1 = await t.mutation(api.memory.scheduleImpulse, { name: 'one', delayMs: 10, maxAttempts: 1 });
      expect(s1.ok).toBe(true);
      await t.finishAllScheduledFunctions(vi.runAllTimers); // consumes the last budget unit
      expect((await t.query(api.memory.impulseBudgetRemaining, {})).remaining).toBe(0);
      const s2 = await t.mutation(api.memory.scheduleImpulse, { name: 'two', delayMs: 10, maxAttempts: 1 });
      expect(s2.ok).toBe(false);
      expect(s2.refusal).toContain('spend ceiling');
    } finally {
      vi.useRealTimers();
    }
  });

  it('corrupt store fails closed: a tampered chain blocks further ingest/forget and health reports not-ok', async () => {
    const t = convexTest(schema, modules);
    const first = buildMemoryRecord({ content: 'alpha', createdAt: at(1) });
    await t.action(api.ingest.ingest, { record: first });
    await t.action(api.ingest.ingest, { record: buildMemoryRecord({ content: 'beta', createdAt: at(2) }) });

    // Corrupt a prior row's committed metadata.
    await t.run(async (ctx) => {
      const rows = await ctx.db.query('memoryChain').withIndex('by_index').collect();
      await ctx.db.patch(rows[0]._id, { provenance: 'tampered' });
    });

    expect((await t.query(api.memory.health, {})).ok).toBe(false);
    const ingestBlocked = await t.action(api.ingest.ingest, { record: buildMemoryRecord({ content: 'gamma', createdAt: at(3) }) });
    expect(ingestBlocked.ok).toBe(false);
    expect(ingestBlocked.refusal).toContain('corrupt store');
    const forgetBlocked = await t.mutation(api.memory.forget, { recordId: first.recordId, at: at(4), attestation: await eraseFor(first.recordId) });
    expect(forgetBlocked.ok).toBe(false);
    expect(forgetBlocked.refusal).toContain('corrupt store');
  });
});
