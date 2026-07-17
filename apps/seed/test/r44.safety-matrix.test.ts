// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R44 — the smallest MISSING negative from the native safety-regression matrix: WRONG-PURPOSE AUMLOK material.
 *
 * The whole review set is otherwise already proven green by real-component suites (see R44_SAFETY_MATRIX.json for
 * the row→proof citations): forged Ed25519/ML-DSA halves, expired/stale, replay, wrong-signer/root, byte/content
 * mismatch, advisory-pass-without-signature, forbidden-content injection, self-protecting targets (incl. the WAVE 2
 * membrane), crash reconciliation, tampered/stale projections, and the WAVE 3 candidate-write attacks.
 *
 * The one uncovered cell: the kernel proves a wrong-DOMAIN signature fails for the RECEIPT-HEAD path
 * (packages/kernel/test/evidence.test.ts), but nothing proved that an AUMLOK owner-PROMOTION whose ML-DSA-65 half
 * is bound to a DIFFERENT purpose domain is refused on the seed authority path. A signature that is otherwise
 * perfectly valid — right key, right message, right Ed25519 half — but produced for another purpose must NOT
 * authorize a promotion. This proves the purpose-domain separation is load-bearing (the ML-DSA half is context-
 * bound), isolating exactly that one variable: same owner, same message, only the ML-DSA context differs.
 *
 * Builds its own trusted owner root with the SAME kernel helpers the fixture uses (no authority code is changed),
 * so the root is trusted and the Ed25519 half verifies — the ONLY reason the negative case fails is the purpose.
 */
import { describe, it, expect } from 'vitest';
import { ed25519 } from '@noble/curves/ed25519.js';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { aumlokRootId, aumlokRootIntegrity, canonicalAumlokPromotion } from '@aukora/kernel/authority';
import { PURPOSE_DOMAINS } from '@aukora/kernel/registries';
import type { AumlokAuthorityRootV2, PromotionAuthorizationV2, SignedPromotionV2 } from '@aukora/kernel/schemas';
import { verifyOwnerPromotion } from '../src/index.js';

const SUITE = 'aumlok-ed25519-ml-dsa-65-v1' as const;
const NOW_MS = Date.parse('2026-07-16T12:00:00.000Z');
const INTENT = 'a'.repeat(64);
const DRAFT = 'b'.repeat(64);

/** Deterministic trusted owner root + a hybrid promotion whose ML-DSA half uses `mlContext`. Everything else is
 *  correct; only the ML-DSA purpose domain varies, so a refusal isolates the purpose binding. */
function craftedPromotion(mlContext: string): { root: AumlokAuthorityRootV2; receipt: SignedPromotionV2 } {
  const edSeed = sha256(utf8ToBytes('aukora-owner-ed25519:r44-purpose'));
  const mlKeys = ml_dsa65.keygen(sha256(utf8ToBytes('aukora-owner-ml-dsa-65:r44-purpose')));
  const publicKeys = { ed25519: bytesToHex(ed25519.getPublicKey(edSeed)), mlDsa65: bytesToHex(mlKeys.publicKey) };
  const rootId = aumlokRootId(publicKeys);
  const base = {
    schema: 'aumlok-authority-root-v2' as const, suite: SUITE, rootId, publicKeys,
    mode: 'software_hybrid' as const, createdAt: '2026-07-16T00:00:00.000Z', expiresAt: null, revoked: false,
  };
  const root: AumlokAuthorityRootV2 = { ...base, integrity: aumlokRootIntegrity(base) };

  const authorization: PromotionAuthorizationV2 = {
    rootId, proposalHash: INTENT, draftHash: DRAFT, nonce: 'nonce-r44', issuedAt: '2026-07-16T12:00:00.000Z', expiresAt: null,
  };
  const message = canonicalAumlokPromotion(authorization);
  const receipt: SignedPromotionV2 = {
    schema: 'aumlok-signed-promotion-v2', suite: SUITE, authorization,
    signatures: {
      ed25519: bytesToHex(ed25519.sign(message, edSeed)),                                   // always correct
      mlDsa65: bytesToHex(ml_dsa65.sign(message, mlKeys.secretKey, { context: utf8ToBytes(mlContext) })),
    },
    mode: 'software_hybrid',
  } as SignedPromotionV2;
  return { root, receipt };
}

describe('R44 · wrong-purpose AUMLOK material fails closed (the one missing native negative)', () => {
  it('an ML-DSA-65 signature bound to a DIFFERENT purpose domain (receiptHead) is REFUSED for an owner promotion', () => {
    const { root, receipt } = craftedPromotion(PURPOSE_DOMAINS.receiptHead); // wrong purpose
    const verdict = verifyOwnerPromotion(receipt, root, { rootId: root.rootId, proposalHash: INTENT, draftHash: DRAFT }, NOW_MS);
    expect(verdict.valid).toBe(false);
    if (!verdict.valid) expect(verdict.reason).toContain('hybrid verification failed');
  });

  it('POSITIVE CONTROL: the SAME material with the CORRECT purpose domain verifies — isolating the purpose bit', () => {
    const { root, receipt } = craftedPromotion(PURPOSE_DOMAINS.aumlokPromotion); // correct purpose
    const verdict = verifyOwnerPromotion(receipt, root, { rootId: root.rootId, proposalHash: INTENT, draftHash: DRAFT }, NOW_MS);
    expect(verdict.valid).toBe(true);
  });

  it('a made-up purpose string is also refused (only the canonical promotion domain authorizes)', () => {
    const { root, receipt } = craftedPromotion('totally-different-purpose-v9');
    const verdict = verifyOwnerPromotion(receipt, root, { rootId: root.rootId, proposalHash: INTENT, draftHash: DRAFT }, NOW_MS);
    expect(verdict.valid).toBe(false);
  });
});
