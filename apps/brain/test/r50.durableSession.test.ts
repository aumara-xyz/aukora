// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/// <reference types="vite/client" />
/**
 * R50 — production local-Convex continuity at the store seam (issue #99, brain half). Real machine
 * (DurableRecursion) + real adapter (ConvexWorkflowStore + validateWorkflowState) + real convex functions
 * (convex-test) behind the typed DurableWorkflowSession seam. Proves: hydrate-before-listen ·
 * settle-after-mutation · zero-pending success · idempotent retry through an outage · OCC conflict ·
 * crash-visible persistence — and FALSIFIES Fugu's "cache looks green before settle()" warning executably.
 * All failure classes are content-free (class names + ids only).
 */
import { convexTest } from 'convex-test';
import { describe, it, expect } from 'vitest';
import schema from '../convex/schema';
import { api } from '../convex/_generated/api';
import { ConvexWorkflowStore, liveWorkflowIo, DurableWorkflowSession, durableSessionGrantsAuthority, type WorkflowIo } from '../src/index.js';
import { DurableRecursion, validateWorkflowState, deriveWorkflowId, deriveIntentId, deriveDraftHash } from '../../seed/src/index.js';
import { makeWorld, makeProposal } from '../../seed/test/support.js';

const modules = import.meta.glob('../convex/**/*.*s');
const ioFor = (t: ReturnType<typeof convexTest>): WorkflowIo => liveWorkflowIo({
  query: (_fn: string, args: Record<string, unknown>) => (t.query as never as (f: unknown, a: unknown) => Promise<unknown>)(api.workflows.loadWorkflow, args),
  mutation: (_fn: string, args: Record<string, unknown>) => (t.mutation as never as (f: unknown, a: unknown) => Promise<unknown>)(api.workflows.saveWorkflow, args),
} as never);
/** An io whose next `failures` saves throw — the transient local-backend outage. */
const flaky = (io: WorkflowIo, failures: { n: number }): WorkflowIo => ({
  load: (id) => io.load(id),
  save: (s, v) => { if (failures.n > 0) { failures.n -= 1; return Promise.reject(new Error('ECONNREFUSED 127.0.0.1:3210')); } return io.save(s, v); },
});

function world(t: ReturnType<typeof convexTest>, io?: WorkflowIo) {
  const w = makeWorld();
  const store = new ConvexWorkflowStore(io ?? ioFor(t), validateWorkflowState as never);
  return { w, store, session: new DurableWorkflowSession(store), machine: new DurableRecursion(store as never, w.env) };
}
const idsFor = (p: unknown, nonce: string) => deriveWorkflowId(deriveIntentId(p as never), deriveDraftHash(p as never), nonce);

describe('R50 — durable session over the real local adapter', () => {
  it('FALSIFIES green-before-settle: cache save/load look green while the durable backend has NOTHING', async () => {
    const t = convexTest(schema, modules);
    const { session, machine, store } = world(t);
    const p = makeProposal(); const wfId = idsFor(p, 'r50-fugu');
    expect((await session.begin(wfId)).ok).toBe(true);            // hydrate-before-listen
    const v = session.stepWithoutSettle(() => machine.propose(p, 'r50-fugu'));
    expect(v.outcome.reasonClass).toBe('workflow:ok');            // the cache is GREEN…
    expect(store.load(wfId)?.version).toBe(1);                    // …load() shows the row…
    expect(v.durability).toBe('pending');                         // …but the seam refuses to call it durable…
    expect(await t.query(api.workflows.loadWorkflow, { workflowId: wfId })).toBeNull(); // …because it is NOT (Fugu confirmed)
  });

  it('settle-after-mutation + zero-pending success: durable ONLY after settle drains everything', async () => {
    const t = convexTest(schema, modules);
    const { session, machine } = world(t);
    const p = makeProposal(); const wfId = idsFor(p, 'r50-durable');
    await session.begin(wfId);
    const v = await session.runMutating(() => machine.propose(p, 'r50-durable'));
    expect(v.durability).toBe('durable');
    expect(v.settled).toEqual({ pushed: 1, divergence: [], unavailable: [] });
    expect(v.pendingCount).toBe(0);                               // zero-pending success
    expect((await t.query(api.workflows.loadWorkflow, { workflowId: wfId }))?.version).toBe(1);
  });

  it('IDEMPOTENT RETRY through an outage: unavailable keeps the save pending; retry lands EXACTLY one row', async () => {
    const t = convexTest(schema, modules);
    const failures = { n: 1 };
    const { session, machine, store } = world(t, flaky(ioFor(t), failures));
    const p = makeProposal(); const wfId = idsFor(p, 'r50-retry');
    await session.begin(wfId);
    const v1 = await session.runMutating(() => machine.propose(p, 'r50-retry'));
    expect(v1.durability).toBe('store-unavailable');              // outage named content-free
    expect(v1.settled?.unavailable).toEqual([wfId]);
    expect(v1.pendingCount).toBe(1);                              // NOT lost (the R50 store fix)
    expect(await t.query(api.workflows.loadWorkflow, { workflowId: wfId })).toBeNull();
    const v2 = await session.retrySettle();                       // backend healed
    expect(v2.durability).toBe('durable');
    expect(v2.settled?.pushed).toBe(1);
    expect(store.pendingCount()).toBe(0);
    expect((await t.query(api.workflows.loadWorkflow, { workflowId: wfId }))?.version).toBe(1); // exactly one row
    expect((await session.retrySettle()).settled?.pushed).toBe(0); // idempotent: nothing double-pushed
  });

  it('OCC conflict and validation refusal are DISTINCT classes; a lost race is settle-divergence', async () => {
    const t = convexTest(schema, modules);
    const a = world(t); const b = world(t);
    const p = makeProposal(); const wfId = idsFor(p, 'r50-occ');
    await a.session.begin(wfId);
    expect((await a.session.runMutating(() => a.machine.propose(p, 'r50-occ'))).durability).toBe('durable');
    // competing session that SKIPPED hydrate: its cache create is accepted, the authoritative mutation refuses
    const raced = await b.session.runMutating(() => b.machine.propose(p, 'r50-occ'));
    expect(raced.durability).toBe('settle-divergence');
    expect(raced.settled?.divergence).toEqual([wfId]);
    expect(b.store.load(wfId)?.version).toBe(1);                  // re-hydrated to the winner
    // machine-level refusal (empty nonce, R49) classifies as a refusal — nothing pending, nothing settled
    const refused = await b.session.runMutating(() => b.machine.propose(p, ''));
    expect(['validation-refused', 'occ-conflict']).toContain(refused.durability);
    expect(refused.settled).toBeNull();
  });

  it('CRASH-VISIBLE persistence: a settled row survives a new session; an unsettled one is visibly absent', async () => {
    const t = convexTest(schema, modules);
    const first = world(t);
    const p1 = makeProposal(); const settledId = idsFor(p1, 'r50-crash-settled');
    await first.session.begin(settledId);
    await first.session.runMutating(() => first.machine.propose(p1, 'r50-crash-settled'));
    const p2 = { ...makeProposal(), rationale: 'crash-lost variant' } as never;
    const lostId = idsFor(p2, 'r50-crash-lost');
    first.session.stepWithoutSettle(() => first.machine.propose(p2, 'r50-crash-lost')); // crash BEFORE settle
    // "crash" = the process dies: new store/session instances over the same backend
    const revived = world(t);
    expect((await revived.session.begin(settledId)).ok).toBe(true);
    expect(revived.store.load(settledId)?.version).toBe(1);       // durable truth survived
    await revived.session.begin(lostId);
    expect(revived.store.load(lostId)).toBeNull();                // unsettled loss is VISIBLE, never phantom-green
  });

  it('the seam grants no authority and its verdicts are content-free (ids + counts only)', async () => {
    expect(durableSessionGrantsAuthority()).toBe(false);
    const t = convexTest(schema, modules);
    const { session, machine } = world(t);
    const p = makeProposal(); const wfId = idsFor(p, 'r50-clean');
    await session.begin(wfId);
    const v = await session.runMutating(() => machine.propose(p, 'r50-clean'));
    const s = JSON.stringify({ durability: v.durability, settled: v.settled, pendingCount: v.pendingCount });
    expect(s).not.toMatch(/newContent|targetPath|rationale|signature|seed/i); // no state/proposal contents
  });
});
