// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Governed recursion — every hostile path fails closed, and every terminal outcome is receipted.
 */
import { describe, it, expect } from 'vitest';
import { runGovernedRecursion, RecursionLedger, LIMITS, deriveIntentId } from '../src/index.js';
import type { CouncilReviewer } from '../src/mockCouncil.js';
import { makeWorld, makeProposal, authFor, TARGET, TARGET2, NOW_ISO, NOW_MS } from './support.js';

describe('advisory review never authorizes; owner gate is separate and required', () => {
  it('advisory-pass WITHOUT an owner signature is refused (council can never substitute for the owner)', () => {
    const { env } = makeWorld();
    const r = runGovernedRecursion(env, makeProposal() /* no auth */);
    expect(r.accepted).toBe(false);
    expect(r.stage).toBe('refused-owner-gate');
    expect(r.councilVerdict).toBe('advisory-pass'); // the review happened and passed…
    expect(r.councilEvidenceDigest).toMatch(/^[0-9a-f]{64}$/); // …and produced evidence…
    expect(r.sandboxApplied).toBe(false);            // …but it authorized nothing.
    expect(r.receiptHash).toBeTruthy();
    expect(r.authorityMinted).toBe(false);
  });

  it('a VALID owner signature WITHOUT required council evidence is refused (owner cannot bypass the council gate)', () => {
    const holdNoEvidence: CouncilReviewer = () => ({ verdict: 'advisory-hold', grantsAuthority: false, advisoryOnly: true, basisValid: false, evidenceDigest: '', reason: 'forced: no evidence' });
    const { env, owner } = makeWorld({ review: holdNoEvidence });
    const proposal = makeProposal();
    const auth = authFor(owner, proposal); // a genuine, valid hybrid signature
    const r = runGovernedRecursion(env, proposal, auth);
    expect(r.accepted).toBe(false);
    expect(r.stage).toBe('refused-council-evidence');
    expect(r.sandboxApplied).toBe(false);
    expect(r.receiptHash).toBeTruthy();
  });
});

describe('owner signature integrity — forged, stale, wrong-signer, and target/content mismatch fail closed', () => {
  it('a forged Ed25519 signature is refused', () => {
    const { env, owner } = makeWorld();
    const proposal = makeProposal();
    const auth = authFor(owner, proposal);
    const forged = { ...auth, signatures: { ...auth.signatures, ed25519: 'ab'.repeat(64) } };
    const r = runGovernedRecursion(env, proposal, forged);
    expect(r.accepted).toBe(false);
    expect(r.stage).toBe('refused-owner-gate');
    expect(r.receiptHash).toBeTruthy();
  });

  it('a forged ML-DSA-65 signature is refused (both halves of the hybrid are load-bearing)', () => {
    const { env, owner } = makeWorld();
    const proposal = makeProposal();
    const auth = authFor(owner, proposal);
    const forged = { ...auth, signatures: { ...auth.signatures, mlDsa65: 'cd'.repeat(3309) } };
    const r = runGovernedRecursion(env, proposal, forged);
    expect(r.accepted).toBe(false);
    expect(r.stage).toBe('refused-owner-gate');
  });

  it('a stale (expired) authorization is refused', () => {
    const { env, owner } = makeWorld();
    const proposal = makeProposal();
    // issued in-window but already expired before now.
    const auth = authFor(owner, proposal, { issuedAt: '2026-07-16T06:00:00.000Z', expiresAt: '2026-07-16T07:00:00.000Z' });
    const r = runGovernedRecursion(env, proposal, auth); // now = 12:00 > 07:00
    expect(r.accepted).toBe(false);
    expect(r.stage).toBe('refused-owner-gate');
    expect(r.refusals.join(' ')).toMatch(/expired/);
  });

  it('an authorization from an UNTRUSTED signer (different owner root) is refused', () => {
    const { env } = makeWorld(); // env.ownerRoot is the legit owner
    const attacker = makeWorld({ ownerLabel: 'attacker' }).owner;
    const proposal = makeProposal();
    const auth = authFor(attacker, proposal); // validly signed, but by the wrong root
    const r = runGovernedRecursion(env, proposal, auth);
    expect(r.accepted).toBe(false);
    expect(r.stage).toBe('refused-owner-gate');
    expect(r.refusals.join(' ')).toMatch(/rootId/);
  });

  it('a malformed authorization (throwing accessor) fails CLOSED and never throws', () => {
    const { env } = makeWorld();
    const evil = {} as Record<string, unknown>;
    Object.defineProperty(evil, 'authorization', { get() { throw new Error('boom'); }, enumerable: true });
    let r: ReturnType<typeof runGovernedRecursion> | undefined;
    expect(() => { r = runGovernedRecursion(env, makeProposal(), evil as never); }).not.toThrow();
    expect(r!.accepted).toBe(false);
    expect(r!.stage).toBe('refused-owner-gate');
    expect(r!.receiptHash).toBeTruthy();
  });

  it('TARGET mismatch is refused (a signature for one target cannot authorize another)', () => {
    const { env, owner } = makeWorld();
    const a = makeProposal({ targetPath: TARGET });
    const b = makeProposal({ targetPath: TARGET2 });
    const authForA = authFor(owner, a);
    const r = runGovernedRecursion(env, b, authForA);
    expect(r.accepted).toBe(false);
    expect(r.stage).toBe('refused-owner-gate');
    expect(r.refusals.join(' ')).toMatch(/proposalHash|intent/);
  });

  it('CONTENT mismatch is refused (same intent, different bytes ⇒ draftHash binding fails)', () => {
    const { env, owner } = makeWorld();
    const a = makeProposal({ newContent: '// draft one' });
    const b = makeProposal({ newContent: '// draft two' }); // same target+supersedes ⇒ same intent, different draft
    expect(deriveIntentId(a)).toBe(deriveIntentId(b));
    const authForA = authFor(owner, a);
    const r = runGovernedRecursion(env, b, authForA);
    expect(r.accepted).toBe(false);
    expect(r.stage).toBe('refused-owner-gate');
    expect(r.refusals.join(' ')).toMatch(/draft/);
  });
});

describe('replay guard — a nonce authorizes exactly once', () => {
  it('replaying an already-consumed authorization is refused', () => {
    const { env, owner } = makeWorld();
    const proposal = makeProposal();
    const auth = authFor(owner, proposal, { nonce: 'nonce-once' });
    const first = runGovernedRecursion(env, proposal, auth);
    expect(first.accepted).toBe(true);
    const replay = runGovernedRecursion(env, proposal, auth); // same nonce
    expect(replay.accepted).toBe(false);
    expect(replay.stage).toBe('refused-replay');
    expect(replay.receiptHash).toBeTruthy();
  });
});

describe('content, grounding, staleness, and lineage gates', () => {
  it('a secret-shaped patch is refused AND the secret never enters the receipt', () => {
    const { env, store } = makeWorld();
    const secret = 'AKIAIOSFODNN7EXAMPLE';
    const r = runGovernedRecursion(env, makeProposal({ newContent: `// ${secret}` }));
    expect(r.accepted).toBe(false);
    expect(r.stage).toBe('refused-secret');
    expect(r.receiptHash).toBeTruthy();
    const lastPayload = store.chain()[store.chain().length - 1].payload;
    expect(JSON.stringify(lastPayload)).not.toContain(secret);
  });

  it('an env-secret assignment patch is refused', () => {
    const { env } = makeWorld();
    const r = runGovernedRecursion(env, makeProposal({ newContent: 'API_KEY=abcdefgh12345678' }));
    expect(r.accepted).toBe(false);
    expect(r.stage).toBe('refused-secret');
  });

  it('an authority-shaped patch is refused', () => {
    const { env } = makeWorld();
    const r = runGovernedRecursion(env, makeProposal({ newContent: 'grantsAuthority: true // live-apply' }));
    expect(r.accepted).toBe(false);
    expect(r.stage).toBe('refused-authority-shaped');
  });

  it('an ungrounded target (not in the known fileset) is refused', () => {
    const { env, owner } = makeWorld();
    const proposal = makeProposal({ targetPath: 'apps/seed/src/does-not-exist.ts' });
    const auth = authFor(owner, proposal);
    const r = runGovernedRecursion(env, proposal, auth);
    expect(r.accepted).toBe(false);
    expect(r.stage).toBe('refused-ungrounded');
  });

  it('a stale proposal (older than the draft horizon) is refused', () => {
    const { env } = makeWorld();
    const r = runGovernedRecursion(env, makeProposal({ createdAt: '2026-07-01T00:00:00.000Z' })); // ~15 days old
    expect(r.accepted).toBe(false);
    expect(r.stage).toBe('refused-stale');
  });

  it('invalid lineage — an unknown/unreachable ancestor is refused', () => {
    const { env, owner } = makeWorld();
    const proposal = makeProposal({ supersedes: 'ab'.repeat(32) }); // never applied
    const auth = authFor(owner, proposal);
    const r = runGovernedRecursion(env, proposal, auth);
    expect(r.accepted).toBe(false);
    expect(r.stage).toBe('refused-lineage');
  });

  it('invalid lineage — a chain deeper than the max is refused', () => {
    const ancestor = 'cd'.repeat(32);
    const ledger = new RecursionLedger({ knownIntents: [[ancestor, LIMITS.MAX_LINEAGE_DEPTH]] });
    const { env, owner } = makeWorld({ ledger });
    const proposal = makeProposal({ supersedes: ancestor }); // child depth = max + 1
    const auth = authFor(owner, proposal);
    const r = runGovernedRecursion(env, proposal, auth);
    expect(r.accepted).toBe(false);
    expect(r.stage).toBe('refused-lineage');
  });

  it('a smuggling-shaped proposal (getter) is refused at the shape gate', () => {
    const { env } = makeWorld();
    const o: Record<string, unknown> = { id: 'p1', targetPath: TARGET, createdAt: NOW_ISO, supersedes: null };
    Object.defineProperty(o, 'newContent', { get: () => '// smuggled', enumerable: true, configurable: true });
    const r = runGovernedRecursion(env, o);
    expect(r.accepted).toBe(false);
    expect(r.stage).toBe('refused-shape');
    expect(r.intentId).toBeNull();
  });
});

describe('hard stops — attempts, wall time, patch bytes', () => {
  it('exceeding the maximum attempts fails closed', () => {
    const { env } = makeWorld();
    for (let i = 0; i < LIMITS.MAX_ATTEMPTS; i += 1) runGovernedRecursion(env, {} /* cheap invalid shape */);
    const over = runGovernedRecursion(env, makeProposal());
    expect(over.accepted).toBe(false);
    expect(over.stage).toBe('hard-stop-max-attempts');
    expect(over.receiptHash).toBeTruthy();
  });

  it('a request observed after the wall-time deadline fails closed', () => {
    const { env } = makeWorld({ deadlineMs: NOW_MS - 1 });
    const r = runGovernedRecursion(env, makeProposal());
    expect(r.accepted).toBe(false);
    expect(r.stage).toBe('hard-stop-wall-time');
  });

  it('a patch larger than the byte ceiling fails closed', () => {
    const { env } = makeWorld();
    const r = runGovernedRecursion(env, makeProposal({ newContent: 'a'.repeat(LIMITS.MAX_PATCH_BYTES + 1) }));
    expect(r.accepted).toBe(false);
    expect(r.stage).toBe('hard-stop-patch-bytes');
  });
});

describe('every terminal outcome is receipted', () => {
  it('each refusal appends exactly one receipt to the chain', () => {
    const { env, store } = makeWorld();
    const cases: unknown[] = [
      {},                                                   // shape
      makeProposal({ newContent: 'AKIAIOSFODNN7EXAMPLE' }), // secret
      makeProposal({ targetPath: 'nope.ts' }),              // ungrounded
      makeProposal(),                                       // owner-gate (no auth)
    ];
    for (const input of cases) {
      const before = store.snapshot().liveCount;
      const r = runGovernedRecursion(env, input);
      expect(r.accepted).toBe(false);
      expect(r.receiptHash).toBeTruthy();
      expect(store.snapshot().liveCount).toBe(before + 1);
    }
    expect(store.verifyChain().valid).toBe(true);
  });
});
