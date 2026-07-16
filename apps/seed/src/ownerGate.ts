// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * AUMLOK owner-gate — the local owner authority adapter.
 *
 * Advisory review never authorizes anything; only the owner does, cryptographically. A proposal may be applied
 * (even to a sandbox) ONLY if it carries a valid owner Ed25519 signature over the proposal's canonical digest.
 * No model can sign for the owner. Custody/signing stays in this app adapter — it never enters a portable
 * package. Production AUMLOK is the hybrid Ed25519 + ML-DSA-65 verify in @aukora/kernel/authority
 * (verifyAumlokPromotionV2); this is the Ed25519 spine, kept deterministic for demos via a fixture seed.
 */
import { ed25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { canonicalHash } from '@aukora/kernel/canonical';

/** Canonical digest an owner signs to authorize a proposal. Domain-separated; reuses the kernel canonical hash. */
export function proposalDigest(proposalId: string, targetPath: string, newContent: string): string {
  return canonicalHash({ domain: 'AUKORA-PROPOSAL/1', proposalId, targetPath, newContent });
}

/**
 * Local owner adapter. In production the owner secret is supplied out-of-band and never leaves custody; here a
 * fixture seed makes demos/tests deterministic. Holds the secret in the adapter only — nothing else can sign.
 */
export class LocalOwnerAdapter {
  private readonly secret: Uint8Array;
  readonly publicKeyHex: string;

  constructor(seedLabel: string) {
    this.secret = sha256(new TextEncoder().encode(`aukora-owner-fixture:${seedLabel}`)); // 32 bytes, deterministic
    this.publicKeyHex = bytesToHex(ed25519.getPublicKey(this.secret));
  }

  /** Sign a proposal digest. */
  sign(digestHex: string): string {
    return bytesToHex(ed25519.sign(hexToBytes(digestHex), this.secret));
  }
}

/** Verify an owner authorization over a proposal digest. Total: returns false on any malformed input. */
export function verifyOwnerAuthorization(digestHex: string, signatureHex: string, publicKeyHex: string): boolean {
  try {
    return ed25519.verify(hexToBytes(signatureHex), hexToBytes(digestHex), hexToBytes(publicKeyHex));
  } catch {
    return false;
  }
}

/** The owner-gate grants no authority by itself — it only verifies the owner's explicit signature. */
export function ownerGateGrantsAuthority(): false {
  return false;
}
