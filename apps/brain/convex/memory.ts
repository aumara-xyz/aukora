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
 * Ingest is fail-closed: malformed / authority-shaped records refuse here, and the canonical secret scan
 * (@aukora/evidence, no clone) guards the ONLY public door — the "use node" action in ./ingest.ts — because the
 * provenance-locked scanner needs node:crypto, which the Convex isolate does not provide. `ingestValidated` is
 * INTERNAL, so no client path skips the scan; no plaintext credential is ever persisted.
 *
 * This is the convex-test / live-Convex persistence target; it makes no live-execution claim of its own. Owner
 * verification is passed in — Convex never holds a key or signs. Reuses @aukora/kernel receipt-chain + Merkle +
 * canonical hash and @aukora/memory commitment law — nothing is cloned.
 */
import { mutation, internalMutation, query } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';
import { receiptChainHash, verifyReceiptChain } from '@aukora/kernel/evidence';
import { merkleRoot } from '@aukora/kernel/merkle';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { validateMemoryRecord, memoryCommitment, tombstoneCommitment } from '@aukora/memory';
import { verifyEraseAttestation } from '../src/continuity/eraseAttestation.js';
import { eraseRootsFromRows } from '../src/continuity/eraseRootRegistry.js';
import { appendReceiptEvent } from './rehearsal.js';

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

// INTERNAL atomic ingest reflex. NOT client-callable: the ONLY public door is the "use node" `ingest.ts` action,
// which runs the canonical @aukora/evidence secret scan first (node:crypto is unavailable in the Convex isolate,
// so the scan lives in the Node runtime — see convex/ingest.ts). A client cannot reach this mutation directly,
// so the secret gate cannot be bypassed (fail-closed by structure, not by a trusted flag).
export const ingestValidated = internalMutation({
  args: { record: v.any() },
  handler: async (ctx, { record }) => {
    const r = validateMemoryRecord(record);
    if (r === null) return { ok: false, refusal: 'refused: malformed or authority-shaped memory' };
    const chain = await chainRows(ctx);
    if (chain.length > 0 && !chainVerdict(chain).valid) return { ok: false, refusal: 'refused: corrupt store — chain verification failed (fail-closed)' };
    // NO RESURRECTION (R44): a governedly forgotten content id may not be re-admitted. Without this gate, a
    // re-ingest of erased plaintext would insert a fresh row CARRYING the plaintext again (recall would hide it,
    // but the erased bytes would be physically back in the store). Fail-closed, like the bridge's tombstone law.
    const forgotten = await ctx.db.query('forgotten').withIndex('by_record', (q: any) => q.eq('recordId', r.recordId)).first();
    if (forgotten) return { ok: false, refusal: 'refused: recordId was governedly forgotten — re-ingest would resurrect erased plaintext (no resurrection)' };
    // IDEMPOTENT IMPULSE (R34): the same content-addressed record ingested twice is ONE memory. A live row with
    // this recordId already carries the identical content commitment, so re-ingest returns the existing receipt
    // instead of appending a duplicate — safe under retries.
    const existingRows = await ctx.db.query('memoryChain').withIndex('by_record', (q: any) => q.eq('recordId', r.recordId)).collect();
    const liveExisting = existingRows.find((row: any) => row.kind === 'memory' && row.content !== undefined);
    if (liveExisting) {
      const snapshot = await recompute(ctx);
      return { ok: true, recordId: r.recordId, chainHash: liveExisting.chainHash, snapshot, idempotent: true };
    }
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

/**
 * WAVE 2 governed forgetting: requires a SIGNED ERASE ATTESTATION (donor M2b law, ML-DSA-65, minted OUTSIDE by
 * the owner). The mutation is SCOPED (attestation.key must equal recordId), EXPIRING (donor 60s freshness),
 * ANTI-REPLAY (attestation digest consumed once), ATOMIC (nonce consume + plaintext removal + tombstone +
 * erasure receipt + evidence row commit in ONE transaction), and CONTENT-MINIMIZING (no plaintext in any of it).
 * Convex verifies-and-refuses forgeries as store integrity and RECORDS evidence — the decision was signed above.
 * The freshness window uses wall time as an expiry GUARD only (donor-style); it never enters chain material.
 */
export const forget = mutation({
  args: { recordId: v.string(), at: v.string(), attestation: v.any() },
  handler: async (ctx, { recordId, at, attestation }) => {
    // G1 pin: build the registered-root allowlist from the store and require the attestation's carried key to be
    // the pinned owner key for its root. Empty allowlist = fail-closed (every erase refused). Read before any
    // deletion so a forged/unregistered key cannot reach the plaintext removal below.
    const registeredRoots = eraseRootsFromRows(await ctx.db.query('eraseRoots').collect());
    const verdict = await verifyEraseAttestation(attestation, Date.now(), registeredRoots);
    if (!verdict.ok) return { ok: false, refusal: `refused: erase attestation ${verdict.reason}` };
    if ((attestation as { key: string }).key !== recordId) return { ok: false, refusal: 'refused: attestation scope mismatch (key != recordId)' };
    const chain = await chainRows(ctx);
    if (chain.length > 0 && !chainVerdict(chain).valid) return { ok: false, refusal: 'refused: corrupt store — chain verification failed (fail-closed)' };
    const rows = await ctx.db.query('memoryChain').withIndex('by_record', (q: any) => q.eq('recordId', recordId)).collect();
    const memoryRows = rows.filter((row: any) => row.kind === 'memory');
    if (memoryRows.length === 0) return { ok: false, refusal: 'refused: unknown record' };
    // ANTI-REPLAY: consume the attestation digest exactly once, atomically with the erase itself.
    const consumed = await ctx.db.query('attestationNonces').withIndex('by_nonce', (q: any) => q.eq('nonce', verdict.digest)).first();
    if (consumed) return { ok: false, refusal: 'refused: attestation already consumed (replay)' };
    await ctx.db.insert('attestationNonces', { nonce: verdict.digest, consumedAtMs: Date.now() });
    // REMOVE the plaintext: replace each memory row with a copy that OMITS the content column entirely (content
    // is optional in the schema), so no plaintext remains for this content-addressed id. The chain is untouched.
    const originalReceiptHash = memoryRows[0].chainHash;
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
    // ERASURE RECEIPT on the one governed event spine: binds the attestation digest (authorityRef) and, via the
    // evidence row, the ORIGINAL receipt hash + the content hash (recordId) — donor's erasure-receipt binding.
    await appendReceiptEvent(ctx, { rehearsalKey: `erase:${recordId}`, event: 'erasure', step: null, authorityRef: verdict.digest });
    const a = attestation as { ownerRootId: string; eraseReason: string; timestamp: number; signatureHex: string; publicKeyHex: string };
    await ctx.db.insert('eraseAttestations', {
      recordId, digest: verdict.digest, ownerRootId: a.ownerRootId, eraseReason: a.eraseReason, timestamp: a.timestamp,
      signatureHex: a.signatureHex, publicKeyHex: a.publicKeyHex, originalReceiptHash,
      advisoryOnly: true, grantsAuthority: false,
    });
    const snapshot = await recompute(ctx);
    return { ok: true, recordId, digest: verdict.digest, snapshot };
  },
});

// SENSE: erase-attestation evidence projection (public material only).
export const eraseEvidence = query({
  args: { recordId: v.string() },
  handler: async (ctx, { recordId }) => {
    const rows = await ctx.db.query('eraseAttestations').withIndex('by_record', (q: any) => q.eq('recordId', recordId)).collect();
    return rows.map((r: any) => ({ recordId: r.recordId, digest: r.digest, ownerRootId: r.ownerRootId, eraseReason: r.eraseReason, timestamp: r.timestamp, originalReceiptHash: r.originalReceiptHash }));
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

// DELAYED IMPULSE (scheduled function, per the ReactiveBrainAdapter role map): the heartbeat recomputes the
// reactive snapshot. It is rhythm/cadence only — it carries NO authority and writes nothing but the snapshot.
export const heartbeat = internalMutation({
  args: {},
  handler: async (ctx) => {
    await recompute(ctx);
    return { ok: true };
  },
});

// ATOMIC REFLEX that schedules the delayed impulse. Returns the scheduled-function id so its status can be
// observed reactively (`scheduledStatus`) — the query→mutation→scheduled end-to-end proof path.
export const scheduleHeartbeat = mutation({
  args: { delayMs: v.number() },
  handler: async (ctx, { delayMs }) => {
    const id = await ctx.scheduler.runAfter(delayMs, internal.memory.heartbeat, {});
    return { ok: true, scheduledId: id };
  },
});

// SENSE over the scheduler: read a scheduled function's status from the system table. Read-only.
export const scheduledStatus = query({
  args: { scheduledId: v.id('_scheduled_functions') },
  handler: async (ctx, { scheduledId }) => {
    const doc = await ctx.db.system.get(scheduledId);
    return doc ? { state: doc.state.kind, name: doc.name, scheduledTime: doc.scheduledTime } : null;
  },
});

// ── DURABLE IMPULSES (R34) ─────────────────────────────────────────────────────────────────────────────────
// Scheduled work with explicit retry state, cancellation, a fail-closed spend ceiling, and receipt linkage.
// All rows are advisory; nothing here grants authority.

const DEFAULT_IMPULSE_BUDGET = 64;

async function budgetRow(ctx: any) {
  const existing = await ctx.db.query('impulseBudget').first();
  if (existing) return existing;
  const id = await ctx.db.insert('impulseBudget', { remaining: DEFAULT_IMPULSE_BUDGET });
  return await ctx.db.get(id);
}

// ATOMIC REFLEX: schedule a durable impulse. Fail-closed on an exhausted spend ceiling; every scheduled RUN
// (including retries) decrements the budget at run time, so retries cannot bypass the ceiling.
export const scheduleImpulse = mutation({
  args: { name: v.string(), delayMs: v.number(), maxAttempts: v.number(), failFirstAttempts: v.optional(v.number()) },
  handler: async (ctx, { name, delayMs, maxAttempts, failFirstAttempts }) => {
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 16) return { ok: false, refusal: 'refused: maxAttempts must be 1..16' };
    const budget = await budgetRow(ctx);
    if (budget.remaining <= 0) return { ok: false, refusal: 'refused: impulse spend ceiling exhausted (fail-closed)' };
    const impulseId = await ctx.db.insert('impulses', {
      name, status: 'pending', attempts: 0, maxAttempts, scheduledId: null, lastError: null,
      chainHeadAtCompletion: null, advisoryOnly: true, grantsAuthority: false,
    });
    const scheduledId = await ctx.scheduler.runAfter(delayMs, internal.memory.runImpulse, { impulseId, failFirstAttempts: failFirstAttempts ?? 0 });
    await ctx.db.patch(impulseId, { scheduledId });
    return { ok: true, impulseId };
  },
});

// DELAYED IMPULSE runner (internal): decrements the budget, records retry state, retries itself with backoff
// until maxAttempts, and on success links the observed chain head (receipt linkage, content-free).
// `failFirstAttempts` exists so tests can exercise REAL retry behaviour deterministically.
export const runImpulse = internalMutation({
  args: { impulseId: v.id('impulses'), failFirstAttempts: v.number() },
  handler: async (ctx, { impulseId, failFirstAttempts }) => {
    const impulse = await ctx.db.get(impulseId);
    if (!impulse || impulse.status === 'cancelled') return { ok: false, refusal: 'impulse missing or cancelled' };
    const budget = await budgetRow(ctx);
    if (budget.remaining <= 0) {
      await ctx.db.patch(impulseId, { status: 'failed', lastError: 'spend ceiling exhausted' });
      return { ok: false, refusal: 'refused: impulse spend ceiling exhausted (fail-closed)' };
    }
    await ctx.db.patch(budget._id, { remaining: budget.remaining - 1 });
    const attempt = impulse.attempts + 1;
    if (attempt <= failFirstAttempts) {
      // deterministic simulated failure → real retry path
      if (attempt >= impulse.maxAttempts) {
        await ctx.db.patch(impulseId, { status: 'failed', attempts: attempt, lastError: `attempt ${attempt} failed; maxAttempts reached` });
        return { ok: false, refusal: 'failed: maxAttempts reached' };
      }
      const scheduledId = await ctx.scheduler.runAfter(2 ** attempt * 100, internal.memory.runImpulse, { impulseId, failFirstAttempts });
      await ctx.db.patch(impulseId, { status: 'pending', attempts: attempt, scheduledId, lastError: `attempt ${attempt} failed; retrying` });
      return { ok: false, retrying: true, attempt };
    }
    // the impulse's work: recompute the reactive snapshot (heartbeat semantics), then link the chain head.
    const snap = await recompute(ctx);
    await ctx.db.patch(impulseId, { status: 'success', attempts: attempt, chainHeadAtCompletion: snap.headHash, lastError: null });
    return { ok: true, attempt };
  },
});

// ATOMIC REFLEX: cancel a pending impulse — cancels the underlying scheduled function too.
export const cancelImpulse = mutation({
  args: { impulseId: v.id('impulses') },
  handler: async (ctx, { impulseId }) => {
    const impulse = await ctx.db.get(impulseId);
    if (!impulse) return { ok: false, refusal: 'refused: unknown impulse' };
    if (impulse.status === 'success' || impulse.status === 'failed') return { ok: false, refusal: `refused: impulse already ${impulse.status}` };
    if (impulse.scheduledId) await ctx.scheduler.cancel(impulse.scheduledId as any);
    await ctx.db.patch(impulseId, { status: 'cancelled' });
    return { ok: true };
  },
});

// SENSES over impulses + budget. Read-only.
export const impulseStatus = query({
  args: { impulseId: v.id('impulses') },
  handler: async (ctx, { impulseId }) => {
    const i = await ctx.db.get(impulseId);
    return i ? { name: i.name, status: i.status, attempts: i.attempts, maxAttempts: i.maxAttempts, lastError: i.lastError, chainHeadAtCompletion: i.chainHeadAtCompletion } : null;
  },
});

export const impulseBudgetRemaining = query({
  args: {},
  handler: async (ctx) => {
    const b = await ctx.db.query('impulseBudget').first();
    return { remaining: b ? b.remaining : DEFAULT_IMPULSE_BUDGET };
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
