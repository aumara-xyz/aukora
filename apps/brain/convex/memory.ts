// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Curated Convex memory functions — the reactive, receipt-chained, growing memory backend, mirroring
 * apps/brain/src/reactiveStore.ts exactly:
 *   append → CONTENT-FREE receipt-chain (canonical @aukora/kernel hash over memoryCommitment) → reactive
 *   snapshot recompute; recall excludes forgotten; owner-authorized forgetting REMOVES the plaintext column and
 *   appends a content-free tombstone (audit kept, chain never rewritten); `verify` reconstructs the chain and
 *   runs the canonical verifier so tamper of any prior row is detected.
 *
 * Ingest is fail-closed: malformed / authority-shaped records refuse, and a record whose content carries a live
 * secret (canonical @aukora/evidence scanner, no clone) refuses — no plaintext credential is ever persisted.
 *
 * This is the convex-test / live-Convex persistence target; it makes no live-execution claim of its own. Owner
 * verification is passed in — Convex never holds a key or signs. Reuses @aukora/kernel receipt-chain + Merkle +
 * canonical hash and @aukora/memory commitment law — nothing is cloned.
 */
import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { receiptChainHash, verifyReceiptChain } from '@aukora/kernel/evidence';
import { merkleRoot } from '@aukora/kernel/merkle';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { validateMemoryRecord, memoryCommitment, tombstoneCommitment } from '@aukora/memory';
import { textHasSecret } from '@aukora/evidence';

async function chainRows(ctx: any) {
  return await ctx.db.query('memoryChain').withIndex('by_index').collect();
}

// Reconstruct the exact content-free chain payload a row committed to — memoryCommitment for a memory row,
// tombstoneCommitment for a tombstone. Same law as ingest/forget, so `verify` is drift-free.
function rowPayload(row: any) {
  return row.kind === 'tombstone'
    ? tombstoneCommitment({ recordId: row.recordId, at: row.createdAt })
    : memoryCommitment({ recordId: row.recordId, createdAt: row.createdAt, kind: row.recordKind, consent: row.consent, provenance: row.provenance });
}

function reconstructEntries(chain: any[]) {
  return chain.map((row: any) => ({ payload: rowPayload(row), prevHash: row.prevHash, chainHash: row.chainHash }));
}

// Fail-closed corruption gate: run the CANONICAL verifier over the stored chain. A mutation that would extend a
// corrupt store REFUSES rather than appending on top of a broken chain.
function chainVerdict(chain: any[]) {
  return verifyReceiptChain(reconstructEntries(chain));
}

async function recompute(ctx: any) {
  const chain = await chainRows(ctx);
  const forgotten = await ctx.db.query('forgotten').collect();
  const forgottenIds = new Set(forgotten.map((f: any) => f.recordId));
  const liveCount = chain.filter((e: any) => e.kind === 'memory' && !forgottenIds.has(e.recordId)).length;
  const headHash = chain.length ? chain[chain.length - 1].chainHash : null;
  const merkleRootHex = chain.length ? bytesToHex(merkleRoot(chain.map((e: any) => hexToBytes(e.chainHash)))) : null;
  const snap = {
    liveCount,
    chainLength: chain.length,
    forgottenCount: forgottenIds.size,
    headHash,
    merkleRootHex,
    lastEventAt: chain.length ? chain[chain.length - 1].createdAt : null,
  };
  const existing = await ctx.db.query('brainSnapshot').first();
  if (existing) await ctx.db.patch(existing._id, snap); else await ctx.db.insert('brainSnapshot', snap);
  return snap;
}

export const ingest = mutation({
  args: { record: v.any() },
  handler: async (ctx, { record }) => {
    const r = validateMemoryRecord(record);
    if (r === null) return { ok: false, refusal: 'refused: malformed or authority-shaped memory' };
    if (textHasSecret(r.content)) return { ok: false, refusal: 'refused: memory content carries a secret; not persisted in plaintext' };
    const chain = await chainRows(ctx);
    if (chain.length > 0 && !chainVerdict(chain).valid) return { ok: false, refusal: 'refused: corrupt store — chain verification failed (fail-closed)' };
    const prevHash = chain.length ? chain[chain.length - 1].chainHash : null;
    // receipt-before-row: the receipt (chainHash) is computed BEFORE the row is written and stored ON it, so a
    // memoryChain row can never exist without its receipt.
    const chainHash = receiptChainHash(memoryCommitment(r), prevHash); // content-free commitment
    await ctx.db.insert('memoryChain', {
      index: chain.length,
      kind: 'memory',
      recordId: r.recordId,
      createdAt: r.createdAt,
      prevHash,
      chainHash,
      recordKind: r.kind,
      consent: r.consent,
      provenance: r.provenance,
      content: r.content, // recall plaintext — removable on forget
      advisoryOnly: true,
      grantsAuthority: false,
    });
    const snapshot = await recompute(ctx);
    return { ok: true, recordId: r.recordId, chainHash, snapshot };
  },
});

export const forget = mutation({
  args: { recordId: v.string(), at: v.string(), ownerAuthorized: v.boolean() },
  handler: async (ctx, { recordId, at, ownerAuthorized }) => {
    if (!ownerAuthorized) return { ok: false, refusal: 'refused: forgetting requires owner authorization' };
    const chain = await chainRows(ctx);
    if (chain.length > 0 && !chainVerdict(chain).valid) return { ok: false, refusal: 'refused: corrupt store — chain verification failed (fail-closed)' };
    const rows = await ctx.db.query('memoryChain').withIndex('by_record', (q: any) => q.eq('recordId', recordId)).collect();
    const memoryRows = rows.filter((row: any) => row.kind === 'memory');
    if (memoryRows.length === 0) return { ok: false, refusal: 'refused: unknown record' };
    // REMOVE the plaintext: replace each memory row with a copy that OMITS the content column entirely (content
    // is optional in the schema), so no plaintext remains for this content-addressed id. The chain is untouched.
    for (const row of memoryRows) {
      const { _id, _creationTime, content, ...withoutContent } = row;
      void content;
      await ctx.db.replace(_id, withoutContent);
    }
    await ctx.db.insert('forgotten', { recordId, at });
    const prevHash = chain.length ? chain[chain.length - 1].chainHash : null;
    const chainHash = receiptChainHash(tombstoneCommitment({ recordId, at }), prevHash); // content-free audit
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
    const chain = await chainRows(ctx);
    const forgotten = new Set((await ctx.db.query('forgotten').collect()).map((f: any) => f.recordId));
    const term = (text ?? '').toLowerCase();
    return chain
      .filter((e: any) => e.kind === 'memory' && !forgotten.has(e.recordId) && (term === '' || (e.content ?? '').toLowerCase().includes(term)))
      .map((e: any) => ({ recordId: e.recordId, createdAt: e.createdAt, content: e.content }));
  },
});

// Reconstruct the receipt chain from stored rows and run the CANONICAL verifier. Tamper of any prior row's
// commitment metadata or chainHash is detected (breakIndex points at the first broken link).
export const verify = query({
  args: {},
  handler: async (ctx) => {
    const chain = await chainRows(ctx);
    const verdict = verifyReceiptChain(reconstructEntries(chain));
    const merkleRootHex = chain.length ? bytesToHex(merkleRoot(chain.map((e: any) => hexToBytes(e.chainHash)))) : null;
    return { ...verdict, chainLength: chain.length, merkleRootHex };
  },
});

// Fail-closed health gate: `ok` is the canonical chain verdict. A corrupt store reports `ok:false` and blocks
// further ingest/forget (they refuse). Read-only.
export const health = query({
  args: {},
  handler: async (ctx) => {
    const chain = await chainRows(ctx);
    const verdict = verifyReceiptChain(reconstructEntries(chain));
    return { ok: verdict.valid, breakIndex: verdict.breakIndex, headHash: verdict.headHash, chainLength: chain.length };
  },
});
