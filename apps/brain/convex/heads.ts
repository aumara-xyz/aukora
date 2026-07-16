// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * PQC-SIGNED CHAIN HEADS (WAVE 2) — the donor SignedChainHeadV3/V4 law over the current chains.
 *
 * The head is SIGNED OUTSIDE (owner/operator seed, kernel layer); this module verifies-and-records, projects,
 * and enforces the donor's MONOTONICITY law: a submitted head with a LOWER chainLength or OLDER timestamp than
 * the stored head REFUSES (truncation/rollback becomes detectable, donor high-water semantics). V4 additionally
 * binds the RFC 6962 receipt-history Merkle root (computed with the kernel's `receiptHistoryRootHex` — reuse,
 * not clone). Convex decides nothing: a stored signed head is EVIDENCE a shell can verify independently.
 */
import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { receiptHistoryRootHex } from '@aukora/kernel/merkle';
import { verifyChainHeadV3, verifyChainHeadV4 } from '../src/continuity/aukoraSignedHead.js';

export const MEMORY_CHAIN_KEY = 'aukora:memoryChain';
export const RECEIPT_EVENTS_CHAIN_KEY = 'aukora:receiptEvents';

const HEX64 = /^[0-9a-f]{64}$/;

export const recordSignedHead = mutation({
  args: {
    chainKey: v.string(),
    version: v.union(v.literal(3), v.literal(4)),
    timestamp: v.number(),
    chainLength: v.number(),
    chainHeadHash: v.string(),
    merkleRootHex: v.union(v.string(), v.null()),
    signatureHex: v.string(),
    publicKeyHex: v.string(),
  },
  handler: async (ctx, a) => {
    if (!HEX64.test(a.chainHeadHash)) return { ok: false, refusal: 'refused: malformed head hash' };
    if (a.version === 4 && (a.merkleRootHex === null || !HEX64.test(a.merkleRootHex))) return { ok: false, refusal: 'refused: v4 requires a merkle root' };
    const fields = { chainKey: a.chainKey, timestamp: a.timestamp, chainLength: a.chainLength, chainHeadHash: a.chainHeadHash };
    const valid = a.version === 4
      ? await verifyChainHeadV4(a.publicKeyHex, fields, a.merkleRootHex as string, a.signatureHex, 'chainHead')
      : await verifyChainHeadV3(a.publicKeyHex, fields, a.signatureHex, 'chainHead');
    if (!valid) return { ok: false, refusal: 'refused: head signature invalid (forged/tampered/wrong chain)' };
    const existing = await ctx.db.query('signedHeads').withIndex('by_chainKey', (q: any) => q.eq('chainKey', a.chainKey)).first();
    if (existing) {
      // MONOTONICITY: never accept a shorter or older head — a rollback/truncation must refuse loudly.
      if (a.chainLength < existing.chainLength) return { ok: false, refusal: 'refused: chainLength lower than stored head (truncation/rollback detected)' };
      if (a.timestamp < existing.timestamp) return { ok: false, refusal: 'refused: timestamp older than stored head (stale head)' };
      const { _id, _creationTime, ...rest } = existing;
      void _creationTime; void rest;
      await ctx.db.replace(_id, { ...a, advisoryOnly: true, grantsAuthority: false } as any);
    } else {
      await ctx.db.insert('signedHeads', { ...a, advisoryOnly: true, grantsAuthority: false } as any);
    }
    return { ok: true };
  },
});

// SENSE: the stored signed head plus a LIVE audit against the actual chain it claims to bind — signature
// re-verified, and for the memory chain: length, head hash, and (v4) the kernel Merkle root recomputed and
// compared. Pure projection; a mismatch is reported, never "fixed".
export const auditSignedHead = query({
  args: { chainKey: v.string() },
  handler: async (ctx, { chainKey }) => {
    const head = await ctx.db.query('signedHeads').withIndex('by_chainKey', (q: any) => q.eq('chainKey', chainKey)).first();
    if (!head) return { present: false };
    const fields = { chainKey: head.chainKey, timestamp: head.timestamp, chainLength: head.chainLength, chainHeadHash: head.chainHeadHash };
    const signatureValid = head.version === 4
      ? await verifyChainHeadV4(head.publicKeyHex, fields, head.merkleRootHex as string, head.signatureHex, 'chainHead')
      : await verifyChainHeadV3(head.publicKeyHex, fields, head.signatureHex, 'chainHead');
    let chainMatches: boolean | null = null;
    if (chainKey === MEMORY_CHAIN_KEY) {
      const rows = await ctx.db.query('memoryChain').withIndex('by_index').collect();
      const lengthOk = rows.length === head.chainLength;
      const headOk = rows.length > 0 && rows[rows.length - 1].chainHash === head.chainHeadHash;
      const rootOk = head.version !== 4 || receiptHistoryRootHex(rows.map((r: any) => r.chainHash)) === head.merkleRootHex;
      chainMatches = lengthOk && headOk && rootOk;
    }
    return { present: true, version: head.version, chainLength: head.chainLength, signatureValid, chainMatches, grantsAuthority: false };
  },
});
