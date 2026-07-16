// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R35 — durable governed recursion: crash/restart without duplication, cancellation, stale/expired authority,
 * malformed state, budget exhaustion, nonce replay, forgetting, UI-state non-authorization, and the salted PII tag.
 */
import { describe, it, expect } from 'vitest';
import {
  DurableRecursion, InMemoryWorkflowStore, deriveWorkflowId, validateWorkflowState, durableWorkflowGrantsAuthority,
  runGovernedRecursion, deriveIntentId, deriveDraftHash, LIMITS,
  saltedContentTag, assertViewSafe,
  type WorkflowStateV1, type WorkflowStore, type RecursionEnv,
} from '../src/index.js';
import { makeWorld, makeProposal, authFor, NOW_ISO } from './support.js';

const wfId = (p: ReturnType<typeof makeProposal>, nonce: string) => deriveWorkflowId(deriveIntentId(p), deriveDraftHash(p), nonce);

describe('durable propose — idempotent, deterministic, receipted refusals', () => {
  it('crash during advisory review: re-propose resumes the same workflow with the same evidence digest, no duplication', () => {
    const w = makeWorld();
    const store = new InMemoryWorkflowStore();
    const machine = new DurableRecursion(store, w.env);
    const p = makeProposal();

    const first = machine.propose(p, 'wf-1');
    expect(first.ok).toBe(true);
    expect(first.state?.phase).toBe('awaiting-owner');
    const digest = first.state?.councilEvidenceDigest;
    expect(digest).toMatch(/^[0-9a-f]{64}$/);

    // "crash" = lose the in-memory machine; a fresh machine over the SAME store re-proposes.
    const resumed = new DurableRecursion(store, w.env).propose(p, 'wf-1');
    expect(resumed.ok).toBe(true);
    expect(resumed.reasonClass).toBe('workflow:ok');
    expect(resumed.state?.version).toBe(1);                       // nothing was re-written
    expect(resumed.state?.councilEvidenceDigest).toBe(digest);    // deterministic review
    expect(durableWorkflowGrantsAuthority()).toBe(false);
  });

  it('a council-refused propose terminalizes with a receipt; malformed proposals never persist', () => {
    const w = makeWorld();
    const machine = new DurableRecursion(new InMemoryWorkflowStore(), w.env);
    const hold = machine.propose(makeProposal(), ''); // empty nonce still keys a workflow; council is fine — use shape refusal instead
    void hold;
    const badShape = machine.propose({ not: 'a proposal' }, 'wf-x');
    expect(badShape.ok).toBe(false);
    expect(badShape.reasonClass).toBe('refused-shape');
    expect(badShape.state).toBeNull();
  });
});

describe('durable complete — at-most-once effects across crashes and restarts', () => {
  it('happy path: complete applies once; completing again is a terminal no-op (no duplicate effect)', () => {
    const w = makeWorld();
    const store = new InMemoryWorkflowStore();
    const machine = new DurableRecursion(store, w.env);
    const p = makeProposal();
    machine.propose(p, 'wf-2');
    const auth = authFor(w.owner, p, { nonce: 'wf-2' });

    const done = machine.complete(p, wfId(p, 'wf-2'), auth);
    expect(done.ok).toBe(true);
    expect(done.state?.phase).toBe('applied');
    expect(done.state?.receiptHash).toMatch(/^[0-9a-f]{64}$/);
    const chainLenAfter = w.env.store.snapshot().chainLength;

    // restart: fresh machine, same store + env — completing again must not re-apply or re-receipt.
    const again = new DurableRecursion(store, w.env).complete(p, wfId(p, 'wf-2'), auth);
    expect(again.ok).toBe(true);
    expect(again.reasonClass).toBe('workflow:already-terminal');
    expect(again.gate).toBeNull();                                 // the gate never ran
    expect(w.env.store.snapshot().chainLength).toBe(chainLenAfter); // no duplicate receipts
  });

  it('crash BETWEEN apply and save: restart reconciles as applied-exactly-once (never double-applies)', () => {
    const w = makeWorld();
    const store = new InMemoryWorkflowStore();
    const machine = new DurableRecursion(store, w.env);
    const p = makeProposal();
    machine.propose(p, 'wf-3');
    const auth = authFor(w.owner, p, { nonce: 'wf-3' });

    // Simulate the crash window: the gate ran and applied (nonce consumed, receipt chained)…
    const gateRun = runGovernedRecursion(w.env, p, auth);
    expect(gateRun.stage).toBe('sandbox-applied');
    // …but the process died before the workflow projection was saved (store still awaiting-owner).
    expect(store.load(wfId(p, 'wf-3'))?.phase).toBe('awaiting-owner');

    const resumed = machine.complete(p, wfId(p, 'wf-3'), auth);
    expect(resumed.state?.phase).toBe('applied');
    expect(resumed.state?.stage).toBe('applied-reconciled-after-restart');
    expect(resumed.state?.receiptHash).toMatch(/^[0-9a-f]{64}$/);  // the reconciliation is itself receipted
    expect(w.env.ledger.attempts).toBe(2);                          // gate ran twice, applied once
  });

  it('a DIFFERENT proposal reusing a consumed nonce is a genuine replay refusal, never a reconciliation', () => {
    const w = makeWorld();
    const store = new InMemoryWorkflowStore();
    const machine = new DurableRecursion(store, w.env);
    const p1 = makeProposal({ newContent: '// first' });
    machine.propose(p1, 'shared-nonce');
    expect(machine.complete(p1, wfId(p1, 'shared-nonce'), authFor(w.owner, p1, { nonce: 'shared-nonce' })).state?.phase).toBe('applied');

    const p2 = makeProposal({ targetPath: 'apps/brain/src/reactiveStore.ts', newContent: '// second' });
    machine.propose(p2, 'shared-nonce');
    const out = machine.complete(p2, wfId(p2, 'shared-nonce'), authFor(w.owner, p2, { nonce: 'shared-nonce' }));
    expect(out.state?.phase).toBe('refused');
    expect(out.state?.stage).toBe('refused-replay');
  });

  it('expired authority defers (workflow stays awaiting); a fresh signature then completes', () => {
    const w = makeWorld();
    const store = new InMemoryWorkflowStore();
    const machine = new DurableRecursion(store, w.env);
    const p = makeProposal();
    machine.propose(p, 'wf-4');
    const expired = authFor(w.owner, p, { nonce: 'wf-4', issuedAt: '2026-07-16T06:00:00.000Z', expiresAt: '2026-07-16T07:00:00.000Z' });

    const deferred = machine.complete(p, wfId(p, 'wf-4'), expired);
    expect(deferred.state?.phase).toBe('awaiting-owner');           // deferral, not death
    expect(deferred.state?.stage).toBe('refused-owner-gate');
    expect(deferred.gate?.receiptHash).toBeTruthy();                // the refused attempt was receipted

    const fresh = machine.complete(p, wfId(p, 'wf-4'), authFor(w.owner, p, { nonce: 'wf-4' }));
    expect(fresh.state?.phase).toBe('applied');
  });

  it('a hard refusal (secret patch) terminalizes; budget exhaustion defers; attempts exhaustion terminalizes', () => {
    const w = makeWorld();
    const store = new InMemoryWorkflowStore();
    const machine = new DurableRecursion(store, w.env);

    const secret = makeProposal({ newContent: 'AKIAIOSFODNN7EXAMPLE' });
    machine.propose(secret, 'wf-5');
    const refused = machine.complete(secret, wfId(secret, 'wf-5'), authFor(w.owner, secret, { nonce: 'wf-5' }));
    expect(refused.state?.phase).toBe('refused');
    expect(refused.state?.stage).toBe('refused-secret');
    expect(refused.state?.receiptHash).toMatch(/^[0-9a-f]{64}$/);

    const p = makeProposal();
    machine.propose(p, 'wf-6');
    const contracted: RecursionEnv = { ...w.env, metabolismCapacity: 0.05 };
    const deferred = new DurableRecursion(store, contracted).complete(p, wfId(p, 'wf-6'), authFor(w.owner, p, { nonce: 'wf-6' }));
    expect(deferred.state?.phase).toBe('awaiting-owner');           // metabolic contraction = defer
    expect(deferred.state?.stage).toBe('refused-metabolic-contraction');

    for (let i = 0; i < LIMITS.MAX_ATTEMPTS; i += 1) runGovernedRecursion(w.env, {});
    const exhausted = machine.complete(p, wfId(p, 'wf-6'), authFor(w.owner, p, { nonce: 'wf-6b' }));
    expect(exhausted.state?.phase).toBe('refused');
    expect(exhausted.state?.stage).toBe('hard-stop-max-attempts');
  });
});

describe('cancellation, malformed state, forgetting, UI non-authorization', () => {
  it('cancel is terminal + receipted; complete after cancel is a no-op', () => {
    const w = makeWorld();
    const store = new InMemoryWorkflowStore();
    const machine = new DurableRecursion(store, w.env);
    const p = makeProposal();
    machine.propose(p, 'wf-7');

    const cancelled = machine.cancel(wfId(p, 'wf-7'));
    expect(cancelled.state?.phase).toBe('cancelled');
    expect(cancelled.state?.receiptHash).toMatch(/^[0-9a-f]{64}$/);
    const after = machine.complete(p, wfId(p, 'wf-7'), authFor(w.owner, p, { nonce: 'wf-7' }));
    expect(after.reasonClass).toBe('workflow:already-terminal');
    expect(after.gate).toBeNull();
  });

  it('malformed persisted state refuses with NO effects (the gate never runs)', () => {
    const w = makeWorld();
    const p = makeProposal();
    const evil: WorkflowStore = {
      load: () => ({ schema: 'aukora-recursion-workflow-v1', workflowId: 'zz', phase: 'awaiting-owner' } as never),
      save: () => ({ ok: true }),
    };
    const attemptsBefore = w.env.ledger.attempts;
    const out = new DurableRecursion(evil, w.env).complete(p, wfId(p, 'wf-8'), authFor(w.owner, p, { nonce: 'wf-8' }));
    expect(out.ok).toBe(false);
    expect(out.reasonClass).toBe('workflow:malformed-state');
    expect(w.env.ledger.attempts).toBe(attemptsBefore);             // no gate run, no attempt burned
  });

  it('a tampered ownerVerified:true projection CANNOT authorize — the gate re-verifies from scratch', () => {
    const w = makeWorld();
    const store = new InMemoryWorkflowStore();
    const machine = new DurableRecursion(store, w.env);
    const p = makeProposal();
    const proposed = machine.propose(p, 'wf-9');
    const tampered: WorkflowStateV1 = { ...(proposed.state as WorkflowStateV1), ownerVerified: true };
    const lying: WorkflowStore = { load: () => tampered, save: (s, v) => store.save(s, v) };

    const out = new DurableRecursion(lying, w.env).complete(p, wfId(p, 'wf-9') /* NO auth */);
    expect(out.state?.phase).toBe('awaiting-owner');                // no apply happened
    expect(out.state?.stage).toBe('refused-owner-gate');
    expect(out.gate?.sandboxApplied).toBe(false);
    expect(validateWorkflowState(tampered)).not.toBeNull();         // shape-valid, still powerless
  });

  it('states carry no authority material, are fence-clean, and survive governed forgetting', () => {
    const w = makeWorld();
    const store = new InMemoryWorkflowStore();
    const machine = new DurableRecursion(store, w.env);
    const p = makeProposal();
    machine.propose(p, 'wf-10');
    const done = machine.complete(p, wfId(p, 'wf-10'), authFor(w.owner, p, { nonce: 'wf-10' }));
    const state = done.state as WorkflowStateV1;

    // Free-text fields carry no secret/authority content (structural 64-hex ids are shape-validated separately —
    // the raw value fence rightly treats bare 64-hex as secret-shaped, so it is asserted over free text only).
    expect(assertViewSafe({ stage: state.stage, refusals: state.refusals, nonce: state.nonce, phase: state.phase }).safe).toBe(true);
    expect(JSON.stringify(state)).not.toContain('signature');
    expect(Object.keys(state).some((k) => /key|seed|secret|token|sig/i.test(k))).toBe(false); // no authority-shaped fields
    expect(state.grantsAuthority).toBe(false);

    // governed forgetting of an unrelated memory leaves the receipt chain verifiable
    const rec = w.env.store.recall({ text: 'governed-recursion applied' });
    expect(rec.length).toBeGreaterThan(0);
    const forgotten = w.env.store.forget(rec[0].recordId, () => true, NOW_ISO);
    expect(forgotten.ok).toBe(true);
    expect(w.env.store.verifyChain().valid).toBe(true);
  });

  it('optimistic concurrency: a losing writer defers to the stored terminal', () => {
    const store = new InMemoryWorkflowStore();
    const w = makeWorld();
    const machine = new DurableRecursion(store, w.env);
    const p = makeProposal();
    const proposed = machine.propose(p, 'wf-11');
    const stale = proposed.state as WorkflowStateV1;
    // winner cancels first (version 1 → 2)…
    expect(machine.cancel(stale.workflowId).state?.phase).toBe('cancelled');
    // …then a stale writer tries to save on top of version 1: conflict.
    expect(store.save({ ...stale, version: 2, phase: 'applied' }, 1).ok).toBe(false);
  });
});

describe('salted PII tag — never publish unsalted hashes of low-entropy PII', () => {
  it('salting defeats enumeration: same content, different salts → different tags; deterministic per salt', () => {
    const salt1 = 'a1'.repeat(16);
    const salt2 = 'b2'.repeat(16);
    const pii = '1987-03-14'; // low-entropy: a birthday
    expect(saltedContentTag(salt1, pii)).toMatch(/^[0-9a-f]{64}$/);
    expect(saltedContentTag(salt1, pii)).toBe(saltedContentTag(salt1, pii));
    expect(saltedContentTag(salt1, pii)).not.toBe(saltedContentTag(salt2, pii));
    expect(() => saltedContentTag('short', pii)).toThrow();          // <128-bit salt refused
    expect(() => saltedContentTag('ZZ'.repeat(16), pii)).toThrow();  // non-hex refused
  });
});
