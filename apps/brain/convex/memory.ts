// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Curated Convex memory functions — the reactive, receipt-chained, growing memory backend, mirroring
 * apps/brain/src/reactiveStore.ts exactly (append → receipt-chain via the canonical @aukora/kernel hash →
 * reactive snapshot recompute; recall excludes forgotten; owner-authorized tombstone hides content but keeps a
 * content-free audit). This is the persistence target driven under convex-test / live Convex; it is NOT part of
 * the deterministic demo and makes no live-execution claim. Owner verification is passed in — Convex never
 * holds a key or signs.
 */
import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { receiptChainHash } from '@aukora/kernel/evidence';
import { merkleRoot } from '@aukora/kernel/merkle';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { validateMemoryRecord } from '@aukora/memory';

async function recompute(ctx: any) {
  const chain = await ctx.db.query('memoryChain').withIndex('by_index').collect();
  const forgotten = await ctx.db.query('forgotten').collect();
  const forgottenIds = new Set(forgotten.map((f: any) => f.recordId));
  const liveCount = chain.filter((e: any) => e.kind === 'memory' && !forgottenIds.has(e.recordId)).length;
  const headHash = chain.length ? chain[chain.length - 1].chainHash : null;
  const merkleRootHex = chain.length ? bytesToHex(merkleRoot(chain.map((e: any) => hexToBytes(e.chainHash)))) : null;
  const snap = { liveCount, chainLength: chain.length, forgottenCount: forgottenIds.size, headHash, merkleRootHex, lastEventAt: chain.length ? chain[chain.length - 1].createdAt : null };
  const existing = await ctx.db.query('brainSnapshot').first();
  if (existing) await ctx.db.patch(existing._id, snap); else await ctx.db.insert('brainSnapshot', snap);
  return snap;
}

export const ingest = mutation({
  args: { record: v.any() },
  handler: async (ctx, { record }) => {
    const r = validateMemoryRecord(record);
    if (r === null) return { ok: false, refusal: 'refused: malformed or authority-shaped memory' };
    const chain = await ctx.db.query('memoryChain').withIndex('by_index').collect();
    const prevHash = chain.length ? chain[chain.length - 1].chainHash : null;
    const chainHash = receiptChainHash({ ...r } as never, prevHash);
    await ctx.db.insert('memoryChain', {
      index: chain.length, kind: 'memory', recordId: r.recordId, createdAt: r.createdAt,
      prevHash, chainHash, content: r.content, consent: r.consent, provenance: r.provenance,
      advisoryOnly: true, grantsAuthority: false,
    });
    const snapshot = await recompute(ctx);
    return { ok: true, recordId: r.recordId, chainHash, snapshot };
  },
});

export const forget = mutation({
  args: { recordId: v.string(), at: v.string(), ownerAuthorized: v.boolean() },
  handler: async (ctx, { recordId, at, ownerAuthorized }) => {
    if (!ownerAuthorized) return { ok: false, refusal: 'refused: forgetting requires owner authorization' };
    await ctx.db.insert('forgotten', { recordId, at });
    const chain = await ctx.db.query('memoryChain').withIndex('by_index').collect();
    const prevHash = chain.length ? chain[chain.length - 1].chainHash : null;
    const chainHash = receiptChainHash({ kind: 'tombstone', recordId, at } as never, prevHash);
    await ctx.db.insert('memoryChain', {
      index: chain.length, kind: 'tombstone', recordId, createdAt: at, prevHash, chainHash,
      advisoryOnly: true, grantsAuthority: false,
    });
    const snapshot = await recompute(ctx);
    return { ok: true, recordId, snapshot };
  },
});

export const snapshot = query({ args: {}, handler: async (ctx) => await ctx.db.query('brainSnapshot').first() });

export const recall = query({
  args: { text: v.optional(v.string()) },
  handler: async (ctx, { text }) => {
    const chain = await ctx.db.query('memoryChain').withIndex('by_index').collect();
    const forgotten = new Set((await ctx.db.query('forgotten').collect()).map((f: any) => f.recordId));
    const term = (text ?? '').toLowerCase();
    return chain
      .filter((e: any) => e.kind === 'memory' && !forgotten.has(e.recordId) && (term === '' || (e.content ?? '').toLowerCase().includes(term)))
      .map((e: any) => ({ recordId: e.recordId, createdAt: e.createdAt, content: e.content }));
  },
});
