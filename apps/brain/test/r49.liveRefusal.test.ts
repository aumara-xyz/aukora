// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/// <reference types="vite/client" />
/**
 * R49 — the EXACT live /api/propose refusal (issue #87 / R49 directive), proven executably and content-free.
 *
 * FINDING (field + rule, no state contents logged):
 *   FIELD: `nonce` — the mind door defaults a missing/non-string body.nonce to '' (apps/seed/src/mindDoor.ts:233).
 *   RULE:  validateWorkflowState, durableRecursion.ts:83 —
 *          `typeof r.nonce !== 'string' || r.nonce.length === 0 || r.nonce.length > 128`.
 *   PATH:  save() → validator returns null → { ok:false, reason:'refused' } → propose's failure branch
 *          (~204-211) finds load()===null and mislabels the validation refusal as `workflow:store-conflict` —
 *          exactly the live symptom (fresh backend, chainLength 0, well-formed 5-key proposal).
 * The council arm is EXONERATED: R48's parity test proved a mock-council pass state validates (evidence digest
 * is a real 64-hex frozen-basis digest), so the only live-vs-test input delta at the store seam is the nonce.
 *
 * Diagnostics here are CONTENT-FREE: the bisector reports FIELD NAMES only; no state values are ever logged.
 * The validator is NOT weakened; first-create/dedup/OCC/restart/projection-only/zero-authority laws are
 * regression-guarded by r48.firstCreate.test.ts and re-asserted at the end.
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
    query: (fn: string, args: Record<string, unknown>) => (t.query as never as (f: unknown, a: unknown) => Promise<unknown>)(api.workflows.loadWorkflow, args),
    mutation: (fn: string, args: Record<string, unknown>) => (t.mutation as never as (f: unknown, a: unknown) => Promise<unknown>)(api.workflows.saveWorkflow, args),
  };
  return new ConvexWorkflowStore(liveWorkflowIo(client as never), validateWorkflowState as never);
}

/** CONTENT-FREE bisector: which single field, replaced into a known-good state, flips the validator to null. */
function failingFields(goodState: Record<string, unknown>, suspectState: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const key of Object.keys(goodState)) {
    if (validateWorkflowState({ ...goodState, [key]: suspectState[key] }) === null) out.push(key); // name only
  }
  return out;
}

describe('R49 — exact live refusal: empty door-defaulted nonce vs validator rule 83', () => {
  it('REPRODUCES the live symptom: nonce "" (the door default for a missing body.nonce) → workflow:store-conflict on a FRESH backend', async () => {
    const t = convexTest(schema, modules);
    const w = makeWorld();
    const store = liveStyleStore(t);
    const machine = new DurableRecursion(store as never, w.env);
    const p = makeProposal(); // well-formed, exact-5-key — same class as the live repro

    const liveDerivedNonce = ''; // apps/seed/src/mindDoor.ts:233 — `typeof body.nonce === 'string' ? body.nonce : ''`
    const wfId = deriveWorkflowId(deriveIntentId(p), deriveDraftHash(p), liveDerivedNonce);
    await store.hydrate(wfId);
    const out = machine.propose(p, liveDerivedNonce);

    expect(out.ok).toBe(false);
    expect(out.reasonClass).toBe('workflow:store-conflict');   // the EXACT live label — for a VALIDATION refusal
    expect(store.load(wfId)).toBeNull();                        // nothing persisted (matches chainLength-0 live repro)
    expect((await t.query(api.workflows.loadWorkflow, { workflowId: wfId }))).toBeNull(); // durable side empty too
  });

  it('PINPOINTS the field content-free: the bisector names exactly ["nonce"]; the store seam says "refused", never "conflict"', () => {
    const w = makeWorld();
    const p = makeProposal();
    // Known-good state: a passing propose over the in-process spec store (same mock council as the live door).
    const good = new DurableRecursion(new InMemoryWorkflowStore(), w.env).propose(p, 'r49-good').state! as unknown as Record<string, unknown>;
    expect(validateWorkflowState(good)).not.toBeNull();

    const suspect = { ...good, nonce: '' };                     // the live-derived delta, nothing else
    expect(validateWorkflowState(suspect)).toBeNull();          // rule 83 refuses
    expect(failingFields(good, suspect)).toEqual(['nonce']);    // EXACTLY one field, named content-free

    // and the STORE distinguishes correctly — the mislabel is upstream in propose, not in any store:
    const store = new InMemoryWorkflowStore();
    expect(store.save(suspect, 0)).toEqual({ ok: false, reason: 'refused' });
  });

  it('rule 83 boundaries: 1-char and 128-char nonces pass; 129-char refuses (still content-free)', () => {
    const w = makeWorld();
    const p = makeProposal();
    const good = new DurableRecursion(new InMemoryWorkflowStore(), w.env).propose(p, 'x').state! as unknown as Record<string, unknown>;
    expect(validateWorkflowState({ ...good, nonce: 'a' })).not.toBeNull();
    expect(validateWorkflowState({ ...good, nonce: 'a'.repeat(128) })).not.toBeNull();
    expect(validateWorkflowState({ ...good, nonce: 'a'.repeat(129) })).toBeNull();
  });

  it('COUNCIL ARM EXONERATED + laws preserved: the same live-shaped flow with a REAL nonce first-creates cleanly', async () => {
    const t = convexTest(schema, modules);
    const w = makeWorld();
    const store = liveStyleStore(t);
    const p = makeProposal();
    const nonce = 'r49-live-shaped';
    const wfId = deriveWorkflowId(deriveIntentId(p), deriveDraftHash(p), nonce);
    await store.hydrate(wfId);
    const out = new DurableRecursion(store as never, w.env).propose(p, nonce);
    expect(out.reasonClass).toBe('workflow:ok');                // mock-council evidence digest validates (64-hex)
    expect(out.state?.phase).toBe('awaiting-owner');
    expect((await store.settle()).ok).toBe(true);               // first-create/OCC/projection-only laws intact
    const durable = await t.query(api.workflows.loadWorkflow, { workflowId: wfId });
    expect(durable?.version).toBe(1);
    expect(durable?.grantsAuthority).toBe(false);               // zero-authority preserved
  });
});
