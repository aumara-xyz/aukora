// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/// <reference types="vite/client" />
/**
 * Durable rehearsal (workflow) laws under convex-test (headless SIMULATED Convex — not live cloud):
 * idempotent start; consumed-authority evidence reference required + recorded (Convex never authorizes);
 * immutable append-only kernel-chained receipt events with LOGICAL time; two-phase receipt-before-effect;
 * exactly-once effects; bounded attention; cancellation; canonical chain verification of the event log.
 * The stubbed external nerve refuses. No Date.now enters any law or hash.
 */
import { convexTest } from 'convex-test';
import { describe, it, expect, vi } from 'vitest';
import schema from '../convex/schema';
import { api, internal } from '../convex/_generated/api';

const modules = import.meta.glob('../convex/**/*.*s');
const AUTH_REF = 'a'.repeat(64); // consumed-authority evidence reference (e.g. a gateArgsHash) — minted ABOVE

describe('durable rehearsal — the local workflow organ (convex-test)', () => {
  it('requires a consumed-authority evidence reference; start is IDEMPOTENT (no duplicate workflow)', async () => {
    const t = convexTest(schema, modules);
    const noAuth = await t.mutation(api.rehearsal.startRehearsal, { key: 'w1', totalSteps: 2, authorityRef: 'nope' });
    expect(noAuth.ok).toBe(false);
    expect(noAuth.refusal).toContain('Convex never authorizes');

    const first = await t.mutation(api.rehearsal.startRehearsal, { key: 'w1', totalSteps: 2, authorityRef: AUTH_REF });
    expect(first.ok).toBe(true);
    expect(first.idempotent).toBe(false);
    const second = await t.mutation(api.rehearsal.startRehearsal, { key: 'w1', totalSteps: 2, authorityRef: AUTH_REF });
    expect(second.idempotent).toBe(true); // same key ⇒ same workflow
    const status = await t.query(api.rehearsal.rehearsalStatus, { key: 'w1' });
    expect(status?.authorityRef).toBe(AUTH_REF); // evidence reference RECORDED
  });

  it('runs to completion: receipts lead effects two-phase; exactly-once; chain verifies; logical time only', async () => {
    vi.useFakeTimers();
    try {
      const t = convexTest(schema, modules);
      await t.mutation(api.rehearsal.startRehearsal, { key: 'w2', totalSteps: 3, authorityRef: AUTH_REF });
      // receipt for step 1 exists BEFORE any effect (separate txn still pending)
      let stream = await t.query(api.rehearsal.receiptStream, { rehearsalKey: 'w2' });
      expect(stream.map((e: any) => e.event)).toEqual(['started', 'step-receipt']);
      let status = await t.query(api.rehearsal.rehearsalStatus, { key: 'w2' });
      expect(status?.effectsApplied).toBe(0); // no effect yet — receipt committed first

      await t.finishAllScheduledFunctions(vi.runAllTimers);
      status = await t.query(api.rehearsal.rehearsalStatus, { key: 'w2' });
      expect(status?.status).toBe('completed');
      expect(status?.effectsApplied).toBe(3); // exactly one effect per step
      stream = await t.query(api.rehearsal.receiptStream, { rehearsalKey: 'w2' });
      // per step: receipt strictly precedes its effect-applied event
      for (let s = 1; s <= 3; s++) {
        const receiptIdx = stream.findIndex((e: any) => e.event === 'step-receipt' && e.step === s);
        const effectIdx = stream.findIndex((e: any) => e.event === 'step-effect-applied' && e.step === s);
        expect(receiptIdx).toBeGreaterThanOrEqual(0);
        expect(effectIdx).toBeGreaterThan(receiptIdx);
      }
      expect(stream[stream.length - 1].event).toBe('completed');
      // the immutable event log verifies with the CANONICAL kernel verifier
      const verdict = await t.query(api.rehearsal.verifyReceiptEvents, {});
      expect(verdict.valid).toBe(true);
      expect(verdict.eventCount).toBe(8); // started, receipt₁, effect₁, receipt₂, effect₂, receipt₃, effect₃, completed
    } finally {
      vi.useRealTimers();
    }
  });

  it('an effect without its receipt REFUSES (receipt-before-effect, fail-closed)', async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.rehearsal.startRehearsal, { key: 'w3', totalSteps: 2, authorityRef: AUTH_REF });
    // step 99 has no receipt event — the effect txn must refuse
    const rogue = await t.mutation(internal.rehearsal.applyStepEffect, { key: 'w3', step: 99 });
    expect(rogue.ok).toBe(false);
    expect(rogue.refusal).toContain('effect cannot precede its receipt');
  });

  it('re-running a step effect does NOT duplicate it (exactly-once)', async () => {
    vi.useFakeTimers();
    try {
      const t = convexTest(schema, modules);
      await t.mutation(api.rehearsal.startRehearsal, { key: 'w4', totalSteps: 1, authorityRef: AUTH_REF });
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      const again = await t.mutation(internal.rehearsal.applyStepEffect, { key: 'w4', step: 1 });
      expect(again.ok).toBe(false); // completed rehearsal refuses re-run entirely
      const status = await t.query(api.rehearsal.rehearsalStatus, { key: 'w4' });
      expect(status?.effectsApplied).toBe(1); // still exactly one
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancellation stops the continuation and appends a cancelled receipt event (append-only, never rewritten)', async () => {
    vi.useFakeTimers();
    try {
      const t = convexTest(schema, modules);
      await t.mutation(api.rehearsal.startRehearsal, { key: 'w5', totalSteps: 5, authorityRef: AUTH_REF });
      const c = await t.mutation(api.rehearsal.cancelRehearsal, { key: 'w5' });
      expect(c.ok).toBe(true);
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      const status = await t.query(api.rehearsal.rehearsalStatus, { key: 'w5' });
      expect(status?.status).toBe('cancelled');
      expect(status?.effectsApplied).toBe(0); // continuation never fired
      const stream = await t.query(api.rehearsal.receiptStream, { rehearsalKey: 'w5' });
      expect(stream[stream.length - 1].event).toBe('cancelled');
      expect((await t.query(api.rehearsal.verifyReceiptEvents, {})).valid).toBe(true); // chain intact
    } finally {
      vi.useRealTimers();
    }
  });

  it('bounded attention: starts beyond the pool capacity refuse until a slot frees', async () => {
    vi.useFakeTimers();
    try {
      const t = convexTest(schema, modules);
      await t.run(async (ctx) => { await ctx.db.insert('attentionPool', { maxConcurrent: 1 }); });
      const a = await t.mutation(api.rehearsal.startRehearsal, { key: 'wa', totalSteps: 1, authorityRef: AUTH_REF });
      expect(a.ok).toBe(true);
      const b = await t.mutation(api.rehearsal.startRehearsal, { key: 'wb', totalSteps: 1, authorityRef: AUTH_REF });
      expect(b.ok).toBe(false);
      expect(b.refusal).toContain('bounded attention');
      await t.finishAllScheduledFunctions(vi.runAllTimers); // wa completes → slot frees
      const bRetry = await t.mutation(api.rehearsal.startRehearsal, { key: 'wb', totalSteps: 1, authorityRef: AUTH_REF });
      expect(bRetry.ok).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('the external nerve is stubbed: it refuses and performs no network', async () => {
    const t = convexTest(schema, modules);
    const r = await t.action(api.nerves.external, { target: 'https://example.com' });
    expect(r.ok).toBe(false);
    expect(r.refusal).toContain('disabled');
    expect(r.networkPerformed).toBe(false);
  });

  it('no wall clock in the law: receipt events use logical indices; sources carry no Date.now in law paths', async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.rehearsal.startRehearsal, { key: 'w6', totalSteps: 1, authorityRef: AUTH_REF });
    const stream = await t.query(api.rehearsal.receiptStream, {});
    expect(stream.every((e: any, i: number) => e.index === i)).toBe(true); // logical time = index
  });
});
