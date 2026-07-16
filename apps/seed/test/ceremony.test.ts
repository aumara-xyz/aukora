// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * The governed AUMLOK–AURA ceremony contract — the one legitimate flow reaches a sandbox-only effect, the capability
 * law bounds Auma, and the geometry/view boundary is display-only.
 */
import { describe, it, expect } from 'vitest';
import {
  issueChallenge, completeCeremony, verifyCeremony,
  toCeremonyView, assertViewSafe, viewGrantsAuthority,
  deriveGeometry, sanitizeGeometry, GeometryLog,
  deriveIntentId, deriveDraftHash,
  assertCapability, capabilityAllowed, CAPABILITY_SETS_DISJOINT, capabilitiesGrantAuthority,
  type CeremonyEnv, type HybridOwnerAdapter, type CeremonyChallenge,
} from '../src/index.js';
import { makeWorld, makeProposal } from './support.js';

const sign = (owner: HybridOwnerAdapter, ch: CeremonyChallenge) =>
  owner.authorize({ proposalHash: ch.intentId, draftHash: ch.draftHash, nonce: ch.nonce, issuedAt: ch.issuedAtIso, expiresAt: null });

describe('capability law — Auma may propose, never sign/authorize/merge/deploy', () => {
  it('allowed and forbidden sets are disjoint and correct', () => {
    expect(CAPABILITY_SETS_DISJOINT).toBe(true);
    for (const c of ['inspect', 'recall', 'draft', 'propose', 'rehearse', 'requestCouncilReview', 'explain']) {
      expect(capabilityAllowed(c)).toBe(true);
    }
    for (const c of ['sign', 'authorize', 'expandCapabilities', 'merge', 'deploy', 'bypassConsent', 'unknownAct']) {
      expect(assertCapability(c).ok).toBe(false);
    }
    expect(capabilitiesGrantAuthority()).toBe(false);
  });

  it('issuing a challenge for a forbidden capability is refused up front', () => {
    const { env } = makeWorld();
    const cenv: CeremonyEnv = { ...env, currentEpoch: 0 };
    expect(issueChallenge(cenv, makeProposal(), { capability: 'sign' }).ok).toBe(false);
    expect(issueChallenge(cenv, makeProposal(), { capability: 'propose' }).ok).toBe(true);
  });
});

describe('the full ceremony — challenge → custody sign → hybrid verify → witness → commit → sandbox', () => {
  it('an owner-signed challenge completes to a sandbox-only effect with a receipt + geometry + safe view', () => {
    const w = makeWorld();
    const geometryLog = new GeometryLog();
    const env: CeremonyEnv = { ...w.env, currentEpoch: 0, geometryLog };
    const proposal = makeProposal();

    const issued = issueChallenge(env, proposal, { capability: 'propose', nonce: 'cer-1' });
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;
    const challenge = issued.challenge;
    expect(challenge.intentId).toBe(deriveIntentId(proposal));
    expect(challenge.draftHash).toBe(deriveDraftHash(proposal));
    expect(challenge.grantsAuthority).toBe(false);

    const outcome = completeCeremony(env, proposal, challenge, sign(w.owner, challenge));
    expect(outcome.completed).toBe(true);
    expect(outcome.phase).toBe('sandbox-applied');
    expect(outcome.receiptHash).toBeTruthy();
    expect(outcome.merkleRootHex).toBeTruthy();
    expect(outcome.recursion?.aumlokMode).toBe('software_hybrid');
    expect(outcome.grantsAuthority).toBe(false);
    expect(verifyCeremony(outcome).valid).toBe(true);

    // geometry evolved and audits clean
    expect(outcome.geometry.coherence).toBe(1);
    expect(outcome.geometry.witnessMode).toBe('write');
    expect(geometryLog.all().length).toBe(1);
    expect(geometryLog.audit().clean).toBe(true);

    // display-safe view carries only public references and mints no authority
    const view = toCeremonyView(outcome, w.owner.root);
    expect(view.verdict).toBe('applied');
    expect(view.grantsAuthority).toBe(false);
    expect(view.ownerFingerprint.length).toBe(16);
    expect(assertViewSafe(view).safe).toBe(true);
    expect(viewGrantsAuthority()).toBe(false);
  });

  it('a challenge with no owner signature is an honest refusal (no fake completion)', () => {
    const w = makeWorld();
    const env: CeremonyEnv = { ...w.env, currentEpoch: 0 };
    const proposal = makeProposal();
    const issued = issueChallenge(env, proposal, { nonce: 'cer-2' });
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;

    const outcome = completeCeremony(env, proposal, issued.challenge /* no auth */);
    expect(outcome.completed).toBe(false);
    expect(outcome.phase).toBe('refused-owner-gate');
    expect(outcome.receiptHash).toBeTruthy();
    expect(verifyCeremony(outcome).valid).toBe(true); // honestly a refusal
  });
});

describe('AURA geometry — bounded, display-only, smuggling-proof', () => {
  it('derives a bounded frame and clamps/refuses hostile shapes', () => {
    const g = deriveGeometry({ epoch: 2, phase: 'sandbox-applied', applied: true, lineageDepth: 1, attemptsUsed: 3, intentId: 'ab'.repeat(32) });
    expect(g.coherence).toBe(1);
    expect(g.witnessMode).toBe('write');
    expect(g.intentPrefix).toBe('abababababab'); // 12 hex, never the full id
    expect(g.grantsAuthority).toBe(false);

    expect(sanitizeGeometry({ ...g, coherence: 9 }).geometry?.coherence).toBe(1); // clamped to [0,1]
    expect(sanitizeGeometry({ ...g, privateKey: 'x' } as unknown).ok).toBe(false); // forbidden key
    expect(sanitizeGeometry({ ...g, intentPrefix: 'ab'.repeat(32) } as unknown).ok).toBe(false); // 64-hex value smuggled
  });
});
