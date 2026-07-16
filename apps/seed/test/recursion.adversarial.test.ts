// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R30 adversarial controls — receipt-before-row failure asymmetry, corrupt-store behavior, every-terminal trace,
 * unknown-age staleness, byte-compatible intent ids, and authority-shaped output never leaking into a trace.
 */
import { describe, it, expect } from 'vitest';
import type { ReactiveMemoryStore } from '@aukora/brain';
import { runGovernedRecursion, deriveIntentId, deriveDraftHash, AuraTraceLog, type RecursionEnv } from '../src/index.js';
import { makeWorld, makeProposal, authFor, TARGET, NOW_ISO } from './support.js';

/** A store whose ingest always refuses — models a corrupt / full receipt store. */
const corruptStore = (): ReactiveMemoryStore => ({ ingest: () => ({ ok: false, refusal: 'corrupt/full store' }) } as unknown as ReactiveMemoryStore);

describe('receipt-before-row failure asymmetry', () => {
  it('a corrupt store refuses the apply, burns NO nonce, and stays retryable', () => {
    const w = makeWorld();
    const proposal = makeProposal();
    const auth = authFor(w.owner, proposal, { nonce: 'n-rbr' });

    const badEnv: RecursionEnv = { ...w.env, store: corruptStore() };
    const r1 = runGovernedRecursion(badEnv, proposal, auth);
    expect(r1.accepted).toBe(false);
    expect(r1.stage).toBe('refused-receipt-unrecordable');
    expect(r1.sandboxApplied).toBe(false);
    expect(r1.receiptHash).toBeNull();
    expect(r1.authorityMinted).toBe(false);
    expect(w.ledger.nonceConsumed('n-rbr')).toBe(false); // no acknowledged effect without a durable receipt

    // retry against the good store (same ledger + same auth) now applies — the nonce was never burned
    const r2 = runGovernedRecursion(w.env, proposal, auth);
    expect(r2.accepted).toBe(true);
    expect(r2.stage).toBe('sandbox-applied');
    expect(w.ledger.nonceConsumed('n-rbr')).toBe(true);
  });

  it('a corrupt store on a REFUSAL path fails closed without throwing (receiptHash null, still refused)', () => {
    const w = makeWorld();
    const badEnv: RecursionEnv = { ...w.env, store: corruptStore() };
    let r: ReturnType<typeof runGovernedRecursion> | undefined;
    expect(() => { r = runGovernedRecursion(badEnv, {} /* invalid shape */); }).not.toThrow();
    expect(r!.accepted).toBe(false);
    expect(r!.stage).toBe('refused-shape');
    expect(r!.receiptHash).toBeNull();
  });
});

describe('every terminal outcome emits a scrubbed AURA trace', () => {
  it('accept + refusals each emit exactly one trace, and the store audits clean', () => {
    const trace = new AuraTraceLog();
    const w = makeWorld();
    const env: RecursionEnv = { ...w.env, trace };
    const proposal = makeProposal();
    const auth = authFor(w.owner, proposal, { nonce: 'n-trace' });

    const runs = [
      () => runGovernedRecursion(env, {}),                                                     // refused-shape
      () => runGovernedRecursion(env, makeProposal({ newContent: 'grantsAuthority=true' })),    // refused-authority-shaped
      () => runGovernedRecursion(env, makeProposal({ targetPath: 'nope.ts' })),                 // refused-ungrounded
      () => runGovernedRecursion(env, proposal, auth),                                          // sandbox-applied
    ];
    let n = 0;
    for (const run of runs) { const before = trace.count(); run(); expect(trace.count()).toBe(before + 1); n += 1; }
    expect(trace.count()).toBe(n);

    for (const t of trace.traces()) {
      expect((t as { grantsAuthority: unknown }).grantsAuthority).toBe(false);
      expect((t as { classification: unknown }).classification).toBe('TRACE_ONLY');
    }
    expect(trace.audit().clean).toBe(true);
  });

  it('authority-shaped INPUT is refused and only a SAFE category reaches the trace', () => {
    const trace = new AuraTraceLog();
    const w = makeWorld();
    const env: RecursionEnv = { ...w.env, trace };
    const r = runGovernedRecursion(env, makeProposal({ newContent: 'grantsAuthority=true // live-apply' }));
    expect(r.stage).toBe('refused-authority-shaped');
    const ev = trace.traces()[trace.count() - 1] as unknown as Record<string, unknown>;
    expect(ev.stage).toBe('refused-authority-shaped');   // a safe category, not the raw authority-shaped bytes
    expect(ev.refusalCause).toBe('refused-authority-shaped');
    expect(trace.audit().clean).toBe(true);              // no 'grantsAuthority=true' string leaked into the trace
  });
});

describe('preserved laws', () => {
  it('unknown-age (unparseable createdAt) is refused as stale', () => {
    const w = makeWorld();
    const r = runGovernedRecursion(w.env, makeProposal({ createdAt: 'not-a-real-date' }));
    expect(r.accepted).toBe(false);
    expect(r.stage).toBe('refused-stale');
  });

  it('intent id and draft hash are BYTE-COMPATIBLE (frozen golden vectors)', () => {
    const p = makeProposal({ newContent: '// note' }); // TARGET, supersedes:null
    expect(deriveIntentId(p)).toBe('4ac84bf07eb32aeecb7094a98c6cdb4ce85a1844849f18f49a956ce57bd7237d');
    expect(deriveDraftHash(p)).toBe('c32347bbcfc22a9e6ab2b671bde33b3f08a293f10a71f2726a454603ce71708c');
  });

  it('trace emission is INERT to the decision — replay / getter-smuggling still fail closed', () => {
    const trace = new AuraTraceLog();
    const w = makeWorld();
    const env: RecursionEnv = { ...w.env, trace };
    const p = makeProposal();
    const auth = authFor(w.owner, p, { nonce: 'n-inert' });
    expect(runGovernedRecursion(env, p, auth).accepted).toBe(true);          // applies
    expect(runGovernedRecursion(env, p, auth).stage).toBe('refused-replay'); // same nonce replayed

    const o: Record<string, unknown> = { id: 'p1', targetPath: TARGET, createdAt: NOW_ISO, supersedes: null };
    Object.defineProperty(o, 'newContent', { get: () => '// x', enumerable: true, configurable: true });
    expect(runGovernedRecursion(env, o).stage).toBe('refused-shape');
    expect(trace.audit().clean).toBe(true);
  });
});
