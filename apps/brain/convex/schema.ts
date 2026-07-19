// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Curated Convex schema for the reactive memory brain — the PERSISTENCE TARGET that mirrors the in-memory
 * ReactiveMemoryStore contracts (apps/brain/src/reactiveStore.ts). Driven headlessly under convex-test (a
 * simulated Convex backend), NOT a live cloud deployment; the deterministic demo:organism runs on the in-memory
 * adapter and makes no live-cloud claim.
 *
 * CONTENT-FREE CHAIN (R29): a `memoryChain` row stores the commitment metadata needed to reconstruct the
 * content-free `memoryCommitment` (recordId + createdAt + recordKind + consent + provenance) plus a SEPARATE,
 * REMOVABLE `content` column used only for recall. Governed forgetting patches `content` away — the chain
 * commits to content by its content-addressed recordId, so the chain stays byte-identical and verifiable.
 */
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  // Append-only receipt-chained memory log (memories + content-free tombstones).
  memoryChain: defineTable({
    index: v.number(),
    // chain-entry kind: a persisted memory row, or a content-free tombstone.
    kind: v.union(v.literal('memory'), v.literal('tombstone')),
    recordId: v.string(),
    createdAt: v.string(),
    prevHash: v.union(v.string(), v.null()),
    chainHash: v.string(),
    // Commitment metadata for kind:'memory' rows — content-free; lets `verify` reconstruct memoryCommitment exactly.
    recordKind: v.optional(v.string()),
    consent: v.optional(v.string()),
    provenance: v.optional(v.string()),
    // R60 M1: the record→root binding. Pinned ONCE at first ingest of a memory row; erase authority is scoped to
    // this root (forget requires attestation.ownerRootId === this). Absent ⇒ legacy/UNBOUND row ⇒ erase fails
    // closed (never guessed). Content-free label; NOT part of the content-addressed recordId or chain commitment.
    ownerRootId: v.optional(v.string()),
    // Recall PLAINTEXT for kind:'memory' rows — REMOVED (patched away) on governed forgetting. Never chained.
    content: v.optional(v.string()),
    advisoryOnly: v.literal(true),
    grantsAuthority: v.literal(false),
  }).index('by_index', ['index']).index('by_record', ['recordId']),

  // Forgotten record ids — read-time invisibility for governed forgetting.
  forgotten: defineTable({ recordId: v.string(), at: v.string() }).index('by_record', ['recordId']),

  // The single reactive brain snapshot row (recomputed on every append/forget).
  brainSnapshot: defineTable({
    liveCount: v.number(),
    chainLength: v.number(),
    forgottenCount: v.number(),
    headHash: v.union(v.string(), v.null()),
    merkleRootHex: v.union(v.string(), v.null()),
    lastEventAt: v.union(v.string(), v.null()),
  }),

  // DURABLE IMPULSES (R34): scheduled work with explicit retry state, cancellation, and receipt linkage.
  // status is the impulse lifecycle; attempts/maxAttempts is the retry state; chainHeadAtCompletion links the
  // completed impulse to the receipt chain head it observed (receipt linkage, content-free).
  impulses: defineTable({
    name: v.string(),
    status: v.union(v.literal('pending'), v.literal('running'), v.literal('success'), v.literal('failed'), v.literal('cancelled')),
    attempts: v.number(),
    maxAttempts: v.number(),
    scheduledId: v.union(v.string(), v.null()),
    lastError: v.union(v.string(), v.null()),
    chainHeadAtCompletion: v.union(v.string(), v.null()),
    advisoryOnly: v.literal(true),
    grantsAuthority: v.literal(false),
  }),

  // The impulse SPEND CEILING (fail-closed): a single budget row; every scheduled run decrements; exhausted ⇒
  // further impulses refuse. Raising the budget is an explicit owner action, never automatic.
  impulseBudget: defineTable({ remaining: v.number() }),

  // IMMUTABLE LIFECYCLE RECEIPT EVENTS (R35): an append-only, content-free, kernel-chained event log for
  // durable rehearsals. Rows are NEVER patched or deleted (append-only law); time is LOGICAL (`index`) — wall
  // time is never canonical here. `authorityRef` is a consumed-authority EVIDENCE REFERENCE recorded for audit;
  // Convex never authorizes.
  receiptEvents: defineTable({
    index: v.number(),
    rehearsalKey: v.string(),
    event: v.string(), // started | step-receipt | step-effect-applied | completed | cancelled | retry
    step: v.union(v.number(), v.null()),
    authorityRef: v.union(v.string(), v.null()),
    prevHash: v.union(v.string(), v.null()),
    chainHash: v.string(),
    advisoryOnly: v.literal(true),
    grantsAuthority: v.literal(false),
  }).index('by_index', ['index']).index('by_rehearsal', ['rehearsalKey']),

  // DURABLE REHEARSALS (R35): the workflow state machine. Start is IDEMPOTENT by `key`. Steps advance through
  // scheduled mutations in TWO PHASES per step — receipt txn commits BEFORE the effect txn (the donor
  // receipt-before-effect asymmetry, deliberately NOT flattened into one transaction).
  rehearsals: defineTable({
    key: v.string(),
    status: v.union(v.literal('running'), v.literal('completed'), v.literal('cancelled')),
    totalSteps: v.number(),
    currentStep: v.number(),
    authorityRef: v.string(),
    scheduledId: v.union(v.string(), v.null()),
    advisoryOnly: v.literal(true),
    grantsAuthority: v.literal(false),
  }).index('by_key', ['key']),

  // Step EFFECTS, keyed rehearsalKey+step — written exactly once (no duplicate effect), only AFTER the step's
  // receipt event exists (fail-closed).
  rehearsalEffects: defineTable({
    rehearsalKey: v.string(),
    step: v.number(),
    effect: v.string(),
  }).index('by_key_step', ['rehearsalKey', 'step']),

  // BOUNDED ATTENTION (R35): a single pool row; at most maxConcurrent rehearsals may be running at once — a
  // start beyond capacity refuses (fail-closed). Concurrency is attention, and attention is bounded.
  attentionPool: defineTable({ maxConcurrent: v.number() }),

  // WAVE 2 — consume-once anti-replay nonces for signed erase attestations. A nonce row is inserted in the SAME
  // transaction that removes the plaintext; a second presentation of the same attestation digest refuses.
  attestationNonces: defineTable({ nonce: v.string(), consumedAtMs: v.number() }).index('by_nonce', ['nonce']),

  // WAVE 2 — signed erase-attestation EVIDENCE rows (public material only: reason, digest, signature, public
  // key). Convex stores and projects this evidence; it never decides — the owner's signature was minted outside.
  eraseAttestations: defineTable({
    recordId: v.string(),
    digest: v.string(),
    ownerRootId: v.string(),
    eraseReason: v.string(),
    timestamp: v.number(),
    signatureHex: v.string(),
    publicKeyHex: v.string(),
    originalReceiptHash: v.string(),
    advisoryOnly: v.literal(true),
    grantsAuthority: v.literal(false),
  }).index('by_record', ['recordId']).index('by_digest', ['digest']),

  // R59 (G1 repair) — registered erase-root PIN allowlist. Public material only: ownerRootId → the owner's
  // ML-DSA-65 PUBLIC key (hex). This is a store-integrity pin, NOT authority: the row decides and releases
  // nothing; erase authority remains the owner's off-store signature. `forget` honors an attestation only if its
  // carried public key byte-equals the pin registered here for its root. Empty table = fail-closed (no erase).
  eraseRoots: defineTable({
    ownerRootId: v.string(),
    publicKeyHex: v.string(),
    advisoryOnly: v.literal(true),
    grantsAuthority: v.literal(false),
  }).index('by_root', ['ownerRootId']),

  // WAVE 2 — PQC-SIGNED CHAIN HEADS (donor SignedChainHeadV3/V4, vendored). Mutable row per chainKey under a
  // MONOTONICITY law: a lower chainLength or older timestamp than the stored head refuses (truncation/rollback
  // detection, donor high-water semantics). Signature minted OUTSIDE; the store verifies-and-records.
  signedHeads: defineTable({
    chainKey: v.string(),
    version: v.union(v.literal(3), v.literal(4)),
    timestamp: v.number(),
    chainLength: v.number(),
    chainHeadHash: v.string(),
    merkleRootHex: v.union(v.string(), v.null()),
    signatureHex: v.string(),
    publicKeyHex: v.string(),
    advisoryOnly: v.literal(true),
    grantsAuthority: v.literal(false),
  }).index('by_chainKey', ['chainKey']),

  // DURABLE RECURSION WORKFLOW PROJECTIONS (R36): the persistence rows behind Sam 3's `WorkflowStore` contract
  // (apps/seed/src/durableRecursion.ts). PROJECTIONS ONLY — never an authorization, signature, key, or proposal
  // content; the kernel/AUMLOK gate re-verifies from scratch outside Convex, so a tampered row decides nothing.
  // Mutable BY DESIGN under optimistic concurrency (version); receipts stay in the append-only chains.
  workflows: defineTable({
    schema: v.literal('aukora-recursion-workflow-v1'),
    workflowId: v.string(),
    version: v.number(),
    phase: v.union(v.literal('awaiting-owner'), v.literal('applied'), v.literal('refused'), v.literal('cancelled')),
    intentId: v.string(),
    draftHash: v.string(),
    nonce: v.string(),
    councilVerdict: v.union(v.literal('advisory-pass'), v.literal('advisory-hold'), v.null()),
    councilEvidenceDigest: v.union(v.string(), v.null()),
    stage: v.string(),
    refusals: v.array(v.string()),
    receiptHash: v.union(v.string(), v.null()),
    ownerVerified: v.boolean(),
    createdAtIso: v.string(),
    updatedAtIso: v.string(),
    advisoryOnly: v.literal(true),
    grantsAuthority: v.literal(false),
  }).index('by_workflowId', ['workflowId']),
});
