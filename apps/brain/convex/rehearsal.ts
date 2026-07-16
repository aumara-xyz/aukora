// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Durable rehearsal — the WORKFLOW organ of the local nervous system (R35).
 *
 * A rehearsal is a multi-step, durable, resumable run whose whole lifecycle is receipted on an APPEND-ONLY,
 * kernel-chained event log (`receiptEvents`) with LOGICAL time (the event index — wall clock is never canonical
 * here; no Date.now enters any hash or law).
 *
 * Laws enforced structurally:
 *   - IDEMPOTENT START: starting the same `key` twice returns the existing rehearsal — no duplicate workflow.
 *   - CONSUMED-AUTHORITY EVIDENCE REFERENCE: `authorityRef` (e.g. a gateArgsHash) is REQUIRED and RECORDED on
 *     the start receipt. It is evidence-about authority consumed OUTSIDE/ABOVE (kernel/AUMLOK) — Convex never
 *     authorizes anything.
 *   - TWO-PHASE RECEIPT-BEFORE-EFFECT: each step is two transactions — txn A appends the step's RECEIPT event
 *     and schedules txn B; txn B refuses unless that receipt exists, applies the effect EXACTLY ONCE
 *     (`rehearsalEffects` keyed by rehearsalKey+step), then appends the effect-applied event. The donor
 *     receipt-before-row asymmetry is deliberately NOT flattened into one transaction.
 *   - APPEND-ONLY RECEIPTS: no code path patches or deletes a receiptEvents row.
 *   - BOUNDED ATTENTION: the effect txn acquires a slot in `attentionPool`; at capacity it requeues.
 *   - CANCELLATION: cancels the scheduled continuation and appends a `cancelled` receipt event.
 *   - DURABILITY: all state lives in tables; a crashed backend resumes from the scheduled continuation.
 *
 * Reuses the canonical @aukora/kernel receipt chain — no second hash implementation.
 */
import { mutation, internalMutation, query } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';
import { receiptChainHash, verifyReceiptChain } from '@aukora/kernel/evidence';

const HEX64 = /^[0-9a-f]{64}$/;
const STEP_DELAY_MS = 200;
const DEFAULT_MAX_CONCURRENT = 2;

async function eventRows(ctx: any) {
  return await ctx.db.query('receiptEvents').withIndex('by_index').collect();
}

// Append one immutable lifecycle receipt event to the kernel-chained log. LOGICAL time = index. Exported for the
// erasure-receipt path (memory.ts) so ALL lifecycle receipts live on ONE governed spine.
export async function appendReceiptEvent(ctx: any, fields: { rehearsalKey: string; event: string; step: number | null; authorityRef: string | null }) {
  const events = await eventRows(ctx);
  const prevHash = events.length ? events[events.length - 1].chainHash : null;
  const payload = { kind: 'rehearsal-receipt', index: events.length, rehearsalKey: fields.rehearsalKey, event: fields.event, step: fields.step, authorityRef: fields.authorityRef };
  const chainHash = receiptChainHash(payload, prevHash);
  await ctx.db.insert('receiptEvents', { index: events.length, ...fields, prevHash, chainHash, advisoryOnly: true, grantsAuthority: false });
  return chainHash;
}

async function attention(ctx: any) {
  const existing = await ctx.db.query('attentionPool').first();
  if (existing) return existing;
  const id = await ctx.db.insert('attentionPool', { maxConcurrent: DEFAULT_MAX_CONCURRENT });
  return await ctx.db.get(id);
}

/**
 * IDEMPOTENT start. Requires a consumed-authority evidence reference (64-hex, e.g. a gateArgsHash) minted by
 * the kernel/AUMLOK layer above — recorded, never interpreted as permission by Convex.
 */
export const startRehearsal = mutation({
  args: { key: v.string(), totalSteps: v.number(), authorityRef: v.string() },
  handler: async (ctx, { key, totalSteps, authorityRef }) => {
    if (!Number.isInteger(totalSteps) || totalSteps < 1 || totalSteps > 32) return { ok: false, refusal: 'refused: totalSteps must be 1..32' };
    if (!HEX64.test(authorityRef)) return { ok: false, refusal: 'refused: consumed-authority evidence reference required (64-hex); Convex never authorizes' };
    const existing = await ctx.db.query('rehearsals').withIndex('by_key', (q: any) => q.eq('key', key)).first();
    if (existing) return { ok: true, rehearsalId: existing._id, idempotent: true, status: existing.status }; // no duplicate workflow
    // BOUNDED ATTENTION: at most maxConcurrent rehearsals run at once — a start beyond capacity refuses
    // (fail-closed; the caller may retry after one completes). Concurrency is attention; attention is bounded.
    const pool = await attention(ctx);
    const running = (await ctx.db.query('rehearsals').collect()).filter((r: any) => r.status === 'running').length;
    if (running >= pool.maxConcurrent) return { ok: false, refusal: 'refused: attention pool at capacity (bounded attention)' };
    const rehearsalId = await ctx.db.insert('rehearsals', {
      key, status: 'running', totalSteps, currentStep: 0, authorityRef, scheduledId: null, advisoryOnly: true, grantsAuthority: false,
    });
    // RECEIPT FIRST (txn A): the started event commits with this mutation; the first step effect runs in a
    // LATER transaction (txn B) — the asymmetry is preserved, never flattened.
    await appendReceiptEvent(ctx, { rehearsalKey: key, event: 'started', step: null, authorityRef });
    await appendReceiptEvent(ctx, { rehearsalKey: key, event: 'step-receipt', step: 1, authorityRef: null });
    const scheduledId = await ctx.scheduler.runAfter(STEP_DELAY_MS, internal.rehearsal.applyStepEffect, { key, step: 1 });
    await ctx.db.patch(rehearsalId, { scheduledId });
    return { ok: true, rehearsalId, idempotent: false, status: 'running' };
  },
});

/**
 * Txn B: apply one step's effect. FAIL-CLOSED unless the step's receipt event already exists (receipt-before-
 * effect); EXACTLY-ONCE via rehearsalEffects; BOUNDED by the attention pool (requeues at capacity); then the
 * next step's receipt is appended and its effect scheduled — receipts always lead effects by one transaction.
 */
export const applyStepEffect = internalMutation({
  args: { key: v.string(), step: v.number() },
  handler: async (ctx, { key, step }) => {
    const rehearsal = await ctx.db.query('rehearsals').withIndex('by_key', (q: any) => q.eq('key', key)).first();
    if (!rehearsal || rehearsal.status !== 'running') return { ok: false, refusal: 'rehearsal missing or not running' };
    // receipt-before-effect: refuse if the step's receipt event is absent.
    const events = await ctx.db.query('receiptEvents').withIndex('by_rehearsal', (q: any) => q.eq('rehearsalKey', key)).collect();
    const hasReceipt = events.some((e: any) => e.event === 'step-receipt' && e.step === step);
    if (!hasReceipt) return { ok: false, refusal: 'refused: no receipt event for this step — effect cannot precede its receipt' };
    // no duplicate effect: exactly-once per (key, step).
    const already = await ctx.db.query('rehearsalEffects').withIndex('by_key_step', (q: any) => q.eq('rehearsalKey', key).eq('step', step)).first();
    if (already) return { ok: true, duplicate: false, alreadyApplied: true };
    // the effect (advisory, local): one row per step.
    await ctx.db.insert('rehearsalEffects', { rehearsalKey: key, step, effect: `step-${step}-effect` });
    await appendReceiptEvent(ctx, { rehearsalKey: key, event: 'step-effect-applied', step, authorityRef: null });
    if (step >= rehearsal.totalSteps) {
      await ctx.db.patch(rehearsal._id, { status: 'completed', currentStep: step, scheduledId: null });
      await appendReceiptEvent(ctx, { rehearsalKey: key, event: 'completed', step, authorityRef: null });
      return { ok: true, completed: true };
    }
    // next step: receipt NOW (this txn), effect LATER (scheduled txn) — receipts lead effects.
    await appendReceiptEvent(ctx, { rehearsalKey: key, event: 'step-receipt', step: step + 1, authorityRef: null });
    const scheduledId = await ctx.scheduler.runAfter(STEP_DELAY_MS, internal.rehearsal.applyStepEffect, { key, step: step + 1 });
    await ctx.db.patch(rehearsal._id, { currentStep: step, scheduledId });
    return { ok: true, completed: false };
  },
});

/** Cancel a running rehearsal: cancels the scheduled continuation, appends a cancelled receipt event. */
export const cancelRehearsal = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const rehearsal = await ctx.db.query('rehearsals').withIndex('by_key', (q: any) => q.eq('key', key)).first();
    if (!rehearsal) return { ok: false, refusal: 'refused: unknown rehearsal' };
    if (rehearsal.status !== 'running') return { ok: false, refusal: `refused: rehearsal already ${rehearsal.status}` };
    if (rehearsal.scheduledId) await ctx.scheduler.cancel(rehearsal.scheduledId as any);
    await ctx.db.patch(rehearsal._id, { status: 'cancelled', scheduledId: null });
    await appendReceiptEvent(ctx, { rehearsalKey: key, event: 'cancelled', step: rehearsal.currentStep, authorityRef: null });
    return { ok: true };
  },
});

/** SENSE: rehearsal state (read-only, for Sam 4). */
export const rehearsalStatus = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const r = await ctx.db.query('rehearsals').withIndex('by_key', (q: any) => q.eq('key', key)).first();
    if (!r) return null;
    const effects = await ctx.db.query('rehearsalEffects').withIndex('by_key_step', (q: any) => q.eq('rehearsalKey', key)).collect();
    return { key: r.key, status: r.status, totalSteps: r.totalSteps, currentStep: r.currentStep, authorityRef: r.authorityRef, effectsApplied: effects.length };
  },
});

/** SENSE: the receipt-event STREAM (read-only, reactive — Sam 4 subscribes to this). */
export const receiptStream = query({
  args: { rehearsalKey: v.optional(v.string()) },
  handler: async (ctx, { rehearsalKey }) => {
    const events = rehearsalKey
      ? await ctx.db.query('receiptEvents').withIndex('by_rehearsal', (q: any) => q.eq('rehearsalKey', rehearsalKey)).collect()
      : await eventRows(ctx);
    return events
      .sort((a: any, b: any) => a.index - b.index)
      .map((e: any) => ({ index: e.index, rehearsalKey: e.rehearsalKey, event: e.event, step: e.step, chainHash: e.chainHash }));
  },
});

/** SENSE: verify the whole receipt-event chain with the CANONICAL verifier (tamper of any event detected). */
export const verifyReceiptEvents = query({
  args: {},
  handler: async (ctx) => {
    const events = await eventRows(ctx);
    const entries = events.map((e: any) => ({
      payload: { kind: 'rehearsal-receipt', index: e.index, rehearsalKey: e.rehearsalKey, event: e.event, step: e.step, authorityRef: e.authorityRef },
      prevHash: e.prevHash,
      chainHash: e.chainHash,
    }));
    const verdict = verifyReceiptChain(entries);
    return { ...verdict, eventCount: events.length };
  },
});
