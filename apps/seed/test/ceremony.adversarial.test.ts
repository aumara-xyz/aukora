// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R31 ceremony adversarial controls — display-state→authority leakage, fake completion, replayed challenges,
 * stale epochs, geometry-field smuggling, and every terminal receipt.
 */
import { describe, it, expect } from 'vitest';
import {
  issueChallenge, completeCeremony, verifyCeremony,
  toCeremonyView, assertViewSafe, sanitizeGeometry,
  type CeremonyEnv, type HybridOwnerAdapter, type CeremonyChallenge,
} from '../src/index.js';
import { makeWorld, makeProposal } from './support.js';

const sign = (owner: HybridOwnerAdapter, ch: CeremonyChallenge) =>
  owner.authorize({ proposalHash: ch.intentId, draftHash: ch.draftHash, nonce: ch.nonce, issuedAt: ch.issuedAtIso, expiresAt: null });

describe('displayed state can never become authority', () => {
  it('the view is fence-clean, mints no authority, and carries no full key / private material', () => {
    const w = makeWorld();
    const env: CeremonyEnv = { ...w.env, currentEpoch: 0 };
    const p = makeProposal();
    const issued = issueChallenge(env, p, { nonce: 'view-1' });
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;
    const outcome = completeCeremony(env, p, issued.challenge, sign(w.owner, issued.challenge));
    const view = toCeremonyView(outcome, w.owner.root);

    expect(view.grantsAuthority).toBe(false);
    expect(assertViewSafe(view).safe).toBe(true);
    // the full public key (64-hex) is NEVER in the view — only a 16-hex fingerprint
    expect(JSON.stringify(view)).not.toContain(w.owner.root.publicKeys.ed25519);
    // a view spiked with private material or an authority claim fails the fence
    expect(assertViewSafe({ ...view, seed: 'deadbeefcafef00d' }).safe).toBe(false);
    expect(assertViewSafe({ ...view, note: 'grantsAuthority=true' }).safe).toBe(false);
  });
});

describe('fake ceremony completion is caught', () => {
  it('completion without an owner signature is refused, and a forged "completed" outcome fails verification', () => {
    const w = makeWorld();
    const env: CeremonyEnv = { ...w.env, currentEpoch: 0 };
    const p = makeProposal();
    const issued = issueChallenge(env, p, { nonce: 'fake-1' });
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;

    const refused = completeCeremony(env, p, issued.challenge /* no auth */);
    expect(refused.completed).toBe(false);
    expect(verifyCeremony(refused).valid).toBe(true);

    const forgedFromRefusal = { ...refused, completed: true, phase: 'sandbox-applied' };
    expect(verifyCeremony(forgedFromRefusal).valid).toBe(false); // no accepted gate behind it
    const forgedFromNothing = { ...refused, completed: true, recursion: null, receiptHash: '00'.repeat(32) };
    expect(verifyCeremony(forgedFromNothing).valid).toBe(false);
  });
});

describe('replayed challenges and stale epochs fail closed', () => {
  it('replaying a completed challenge is refused', () => {
    const w = makeWorld();
    const env: CeremonyEnv = { ...w.env, currentEpoch: 0 };
    const p = makeProposal();
    const issued = issueChallenge(env, p, { nonce: 'replay-1' });
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;
    const auth = sign(w.owner, issued.challenge);

    expect(completeCeremony(env, p, issued.challenge, auth).completed).toBe(true);
    const again = completeCeremony(env, p, issued.challenge, auth);
    expect(again.completed).toBe(false);
    expect(again.phase).toBe('refused-replay');
    expect(again.receiptHash).toBeTruthy();
  });

  it('a challenge from a past epoch is stale once the epoch advances', () => {
    const w = makeWorld();
    const env0: CeremonyEnv = { ...w.env, currentEpoch: 0 };
    const p = makeProposal();
    const issued = issueChallenge(env0, p, { nonce: 'epoch-1' });
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;
    const auth = sign(w.owner, issued.challenge);

    const env1: CeremonyEnv = { ...w.env, currentEpoch: 1 }; // epoch advanced before completion
    const outcome = completeCeremony(env1, p, issued.challenge, auth);
    expect(outcome.completed).toBe(false);
    expect(outcome.phase).toBe('refused-stale-epoch');
    expect(outcome.receiptHash).toBeTruthy();
  });

  it('a tampered challenge (gateArgsHash mismatch) and a challenge/proposal mismatch are refused', () => {
    const w = makeWorld();
    const env: CeremonyEnv = { ...w.env, currentEpoch: 0 };
    const a = makeProposal({ newContent: '// draft A' });
    const b = makeProposal({ newContent: '// draft B' }); // same intent, different draft
    const issuedA = issueChallenge(env, a, { nonce: 't-1' });
    expect(issuedA.ok).toBe(true);
    if (!issuedA.ok) return;

    const mismatch = completeCeremony(env, b, issuedA.challenge, sign(w.owner, issuedA.challenge));
    expect(mismatch.phase).toBe('refused-challenge-mismatch');
    expect(mismatch.receiptHash).toBeTruthy();

    const tampered = { ...issuedA.challenge, gateArgsHash: 'ff'.repeat(32) };
    const out = completeCeremony(env, a, tampered);
    expect(out.phase).toBe('refused-tampered-challenge');
    expect(out.receiptHash).toBeTruthy();
  });
});

describe('geometry-field smuggling and every terminal receipt', () => {
  it('geometry smuggling (forbidden key / nested secret / 64-hex value) is refused', () => {
    const base = { schema: 'aukora-aura-geometry-v1', epoch: 0, phase: 'x', lineageDepth: 0, attemptsUsed: 0, witnessMode: 'witness', coherence: 0.5 };
    expect(sanitizeGeometry({ ...base, privateKey: 'x' }).ok).toBe(false);
    expect(sanitizeGeometry({ ...base, meta: { nested: { seed: 'x' } } }).ok).toBe(false);
    expect(sanitizeGeometry({ ...base, label: 'ab'.repeat(32) }).ok).toBe(false); // 64-hex value at depth
    expect(sanitizeGeometry({ ...base, harmless: 'ok' }).ok).toBe(true); // dropped, not rejected
  });

  it('every ceremony terminal (applied + each refusal class) is receipted', () => {
    const w = makeWorld();
    const env: CeremonyEnv = { ...w.env, currentEpoch: 0 };

    const shapeRefusal = completeCeremony(env, {} as unknown, { schema: 'aukora-ceremony-challenge-v1', intentId: '00'.repeat(32), draftHash: '00'.repeat(32), gateArgsHash: '00'.repeat(32), epoch: 0, nonce: 'x', issuedAtIso: '2026-07-16T12:00:00.000Z', capability: 'propose', advisoryOnly: true, grantsAuthority: false });
    expect(shapeRefusal.phase).toBe('refused-shape');
    expect(shapeRefusal.receiptHash).toBeTruthy();

    const p = makeProposal();
    const issued = issueChallenge(env, p, { nonce: 'term-1' });
    if (!issued.ok) return;
    const applied = completeCeremony(env, p, issued.challenge, sign(w.owner, issued.challenge));
    expect(applied.completed).toBe(true);
    expect(applied.receiptHash).toBeTruthy();
  });
});
