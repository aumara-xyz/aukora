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
});
