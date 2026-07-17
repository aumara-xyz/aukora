// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/// <reference types="vite/client" />
/**
 * R48 — the live door → ConvexWorkflowStore FIRST-CREATE handshake (issue #87, store side).
 *
 * Drives the REAL machine (`DurableRecursion.propose`, Sam 3's, unmodified) over the REAL adapter
 * (`ConvexWorkflowStore` + the REAL `validateWorkflowState`) against the REAL convex functions
 * (`workflows.saveWorkflow`/`loadWorkflow` via convex-test) — i.e., the exact composition the live door
 * should run, minus HTTP. Proves: a genuinely new proposal creates ONE durable workflow; duplicates
 * deduplicate deterministically; concurrency/replay/stale saves stay fail-closed; and the refused-vs-conflict
 * distinction is visible at the store seam (the #87 symptom conflated them).
 */
import { convexTest } from 'convex-test';
import { describe, it, expect } from 'vitest';
import schema from '../convex/schema';
import { api } from '../convex/_generated/api';
import { ConvexWorkflowStore, liveWorkflowIo } from '../src/index.js';
import { DurableRecursion, InMemoryWorkflowStore, validateWorkflowState, deriveWorkflowId, deriveIntentId, deriveDraftHash } from '../../seed/src/index.js';
import { makeWorld, makeProposal } from '../../seed/test/support.js';

const modules = import.meta.glob('../convex/**/*.*s');

function liveStyleStore(t: ReturnType<typeof convexTest>) {
  const client = {
    query: (fn: string, args: Record<string, unknown>) => (t.query as never as (f: unknown, a: unknown) => Promise<unknown>)(fnRef(fn), args),
    mutation: (fn: string, args: Record<string, unknown>) => (t.mutation as never as (f: unknown, a: unknown) => Promise<unknown>)(fnRef(fn), args),
  };
  return new ConvexWorkflowStore(liveWorkflowIo(client as never), validateWorkflowState as never);
}
// convex-test needs function REFERENCES; the live client uses string paths. Map the two contract names.
function fnRef(path: string): unknown {
  if (path === 'workflows:loadWorkflow' || path === 'workflows/loadWorkflow' || path.includes('loadWorkflow')) return api.workflows.loadWorkflow;
  if (path.includes('saveWorkflow')) return api.workflows.saveWorkflow;
  throw new Error(`unmapped workflow fn ${path}`);
}

describe('R48 — first-create handshake over the REAL store/machine/convex composition', () => {
  it('a genuinely NEW proposal creates exactly ONE durable workflow (the #87 happy path)', async () => {
    const t = convexTest(schema, modules);
    const w = makeWorld();
    const store = liveStyleStore(t);
    const machine = new DurableRecursion(store as never, w.env);
    const p = makeProposal();
    const nonce = 'r48-first-create';
    const wfId = deriveWorkflowId(deriveIntentId(p), deriveDraftHash(p), nonce);

    await store.hydrate(wfId);                     // live-path discipline: hydrate BEFORE machine steps
    const out = machine.propose(p, nonce);
    expect(out.reasonClass).toBe('workflow:ok');   // NOT workflow:store-conflict — the #87 symptom
    expect(out.state?.version).toBe(1);
    expect(out.state?.phase).toBe('awaiting-owner');

    const settled = await store.settle();          // durability point
    expect(settled).toEqual({ ok: true, pushed: 1, divergence: [], unavailable: [] }); // R50: additive field

    const durable = await t.query(api.workflows.loadWorkflow, { workflowId: wfId });
    expect(durable?.version).toBe(1);              // exactly one durable row, v1
    expect(durable?.phase).toBe('awaiting-owner');
  });

  it('a DUPLICATE propose (same proposal+nonce, fresh hydrate) deduplicates deterministically — no second row', async () => {
    const t = convexTest(schema, modules);
    const w = makeWorld();
    const p = makeProposal();
    const nonce = 'r48-dup';
    const wfId = deriveWorkflowId(deriveIntentId(p), deriveDraftHash(p), nonce);

    const store1 = liveStyleStore(t);
    await store1.hydrate(wfId);
    expect(new DurableRecursion(store1 as never, w.env).propose(p, nonce).reasonClass).toBe('workflow:ok');
    await store1.settle();

    // second door request: fresh cache facade (exactly what a new HTTP request sees), same backend
    const store2 = liveStyleStore(t);
    await store2.hydrate(wfId);                    // pulls the durable v1
    const again = new DurableRecursion(store2 as never, w.env).propose(p, nonce);
    expect(again.reasonClass).toBe('workflow:ok'); // resumed the winner — deterministic dedup
    expect(again.text).toMatch(/resumed|awaiting/);
    expect((await store2.settle()).ok).toBe(true);
    const durable = await t.query(api.workflows.loadWorkflow, { workflowId: wfId });
    expect(durable?.version).toBe(1);              // STILL one row, v1 — nothing duplicated
  });

  it('an UNHYDRATED duplicate create loses the server-side OCC race and re-hydrates to the winner (fail-closed)', async () => {
    const t = convexTest(schema, modules);
    const w = makeWorld();
    const p = makeProposal();
    const nonce = 'r48-race';
    const wfId = deriveWorkflowId(deriveIntentId(p), deriveDraftHash(p), nonce);

    const store1 = liveStyleStore(t);
    await store1.hydrate(wfId);
    new DurableRecursion(store1 as never, w.env).propose(p, nonce);
    await store1.settle();

    // a racing door instance that SKIPPED hydrate: its cache create succeeds, but the authoritative
    // mutation refuses (conflict) and settle reports divergence + re-hydrates the winner.
    const store2 = liveStyleStore(t);
    const raced = new DurableRecursion(store2 as never, w.env).propose(p, nonce);
    expect(raced.reasonClass).toBe('workflow:ok'); // cache-level create accepted pre-settle
    const settled = await store2.settle();
    expect(settled.ok).toBe(false);
    expect(settled.divergence).toEqual([wfId]);    // the loser is NAMED
    expect(store2.load(wfId)?.version).toBe(1);    // and now holds the durable winner
    expect((await t.query(api.workflows.loadWorkflow, { workflowId: wfId }))?.version).toBe(1); // one row
  });

  it('STALE-HEAD save refuses at both rails (cache and authoritative mutation)', async () => {
    const t = convexTest(schema, modules);
    const w = makeWorld();
    const p = makeProposal();
    const wfId = deriveWorkflowId(deriveIntentId(p), deriveDraftHash(p), 'r48-stale');
    const store = liveStyleStore(t);
    await store.hydrate(wfId);
    new DurableRecursion(store as never, w.env).propose(p, 'r48-stale');
    await store.settle();

    const durable = (await t.query(api.workflows.loadWorkflow, { workflowId: wfId })) as { version: number };
    // stale write straight at the mutation: expectedVersion 0 against a v1 row → conflict, row unchanged
    const stale = await t.mutation(api.workflows.saveWorkflow, { state: { ...durable, version: 1 }, expectedVersion: 0 });
    expect(stale).toEqual({ ok: false, reason: 'conflict' });
    expect(((await t.query(api.workflows.loadWorkflow, { workflowId: wfId })) as { version: number }).version).toBe(1);
  });

  it('the store seam DISTINGUISHES refused from conflict (the #87 symptom conflated them downstream)', async () => {
    const t = convexTest(schema, modules);
    const store = liveStyleStore(t);
    // authority-claiming state → REFUSED (validator law), never 'conflict'
    const bad = { schema: 'aukora-recursion-workflow-v1', workflowId: 'f'.repeat(64), version: 1, grantsAuthority: true } as never;
    expect(store.save(bad, 0)).toEqual({ ok: false, reason: 'refused' });
    // version-skew on a fresh id → CONFLICT
    const w = makeWorld();
    const p = makeProposal();
    const wfId = deriveWorkflowId(deriveIntentId(p), deriveDraftHash(p), 'r48-skew');
    const m = new DurableRecursion(new InMemoryWorkflowStore() as never, w.env);
    const good = m.propose(p, 'r48-skew').state!;
    expect(store.save({ ...good, workflowId: wfId, version: 2 } as never, 0)).toEqual({ ok: false, reason: 'conflict' });
  });

  it('PARITY: the ConvexWorkflowStore create law is byte-equal to the in-process store law', async () => {
    const t = convexTest(schema, modules);
    const w = makeWorld();
    const p = makeProposal();
    const nonce = 'r48-parity';
    const mem = new DurableRecursion(new InMemoryWorkflowStore() as never, w.env).propose(p, nonce);
    const store = liveStyleStore(t);
    const cvx = new DurableRecursion(store as never, w.env).propose(p, nonce);
    expect(cvx.reasonClass).toBe(mem.reasonClass);
    expect(cvx.state?.version).toBe(mem.state?.version);
    expect(cvx.state?.phase).toBe(mem.state?.phase);
  });
});
