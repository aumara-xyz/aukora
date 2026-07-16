// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Governed recursion — the one valid path reaches an ISOLATED sandbox (and nothing else), and the supersedes
 * chain composes. No authority is ever minted.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  runGovernedRecursion, deriveIntentId, deriveDraftHash,
  councilGrantsAuthority, recursionGrantsAuthority, aumlokGateGrantsAuthority, proposalGrantsAuthority,
  mockCouncilReview, RecursionLedger,
} from '../src/index.js';
import { makeWorld, makeProposal, authFor, TARGET, NOW_MS } from './support.js';

describe('the valid governed flow reaches a sandbox — and only a sandbox', () => {
  it('an owner-signed, council-reviewed, grounded proposal is applied to an isolated in-memory Map + receipted', () => {
    const { env, owner, store } = makeWorld();
    const proposal = makeProposal({ newContent: '// governed refinement (valid)' });
    const auth = authFor(owner, proposal);

    const before = store.snapshot().liveCount;
    const r = runGovernedRecursion(env, proposal, auth);

    expect(r.accepted).toBe(true);
    expect(r.stage).toBe('sandbox-applied');
    expect(r.aumlokMode).toBe('software_hybrid');   // real hybrid Ed25519 + ML-DSA-65
    expect(r.councilVerdict).toBe('advisory-pass');
    expect(r.councilEvidenceDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(r.intentId).toBe(deriveIntentId(proposal));

    // The effect is an in-memory Map, disjoint from anything live.
    expect(r.sandboxApplied).toBe(true);
    expect(r.sandbox).toBeInstanceOf(Map);
    expect(r.sandbox?.get(TARGET)).toBe(proposal.newContent);
    expect(r.sandbox?.size).toBe(1);

    // Exactly one receipt memory was appended, and the chain still verifies.
    expect(r.receiptHash).toBeTruthy();
    expect(store.snapshot().liveCount).toBe(before + 1);
    expect(store.verifyChain().valid).toBe(true);
    expect(r.authorityMinted).toBe(false);
  });

  it('no disk / live-repository mutation occurs — the real target file on disk is unchanged', () => {
    const { env, owner } = makeWorld();
    const proposal = makeProposal({ newContent: '// THIS MUST NOT BE WRITTEN TO DISK' });
    const auth = authFor(owner, proposal);
    const r = runGovernedRecursion(env, proposal, auth);
    expect(r.accepted).toBe(true);

    // TARGET is a REAL source file. If the apply had touched disk it would now equal newContent; it does not.
    const onDisk = readFileSync('src/recursion.ts', 'utf8'); // vitest cwd = apps/seed
    expect(onDisk).toContain('export function runGovernedRecursion');
    expect(onDisk).not.toBe(proposal.newContent);
    expect(onDisk).not.toContain('THIS MUST NOT BE WRITTEN TO DISK');
  });

  it('the supersedes chain composes — a child intent applies on top of an applied root', () => {
    const { env, owner } = makeWorld();
    const root = makeProposal({ newContent: '// root change' });
    const rootIntent = deriveIntentId(root);
    const r1 = runGovernedRecursion(env, root, authFor(owner, root, { nonce: 'n-root' }));
    expect(r1.accepted).toBe(true);
    expect(r1.intentId).toBe(rootIntent);

    const child = makeProposal({ newContent: '// child change', supersedes: rootIntent });
    const r2 = runGovernedRecursion(env, child, authFor(owner, child, { nonce: 'n-child' }));
    expect(r2.accepted).toBe(true);
    expect(r2.intentId).toBe(deriveIntentId(child));
    expect(r2.intentId).not.toBe(rootIntent);
    // Both drafts are distinct 64-hex, bound to distinct intents.
    expect(deriveDraftHash(child)).not.toBe(deriveDraftHash(root));
  });
});

describe('no authority is minted anywhere in the pipeline', () => {
  it('every containment pin is a hard false, and the council grants nothing', () => {
    expect(councilGrantsAuthority()).toBe(false);
    expect(recursionGrantsAuthority()).toBe(false);
    expect(aumlokGateGrantsAuthority()).toBe(false);
    expect(proposalGrantsAuthority()).toBe(false);
    expect(new RecursionLedger().grantsAuthority()).toBe(false);

    const cv = mockCouncilReview('apply x', ['a claim'], NOW_MS);
    expect(cv.grantsAuthority).toBe(false);
    expect(cv.advisoryOnly).toBe(true);
    expect(cv.verdict).toBe('advisory-pass'); // even a passing review confers no authority
  });
});
