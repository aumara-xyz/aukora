// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Curated Convex schema for the reactive memory brain — the PERSISTENCE TARGET that mirrors the in-memory
 * ReactiveMemoryStore contracts (apps/brain/src/reactiveStore.ts). This is the convex-test / live-Convex
 * backend; the deterministic demo:organism runs on the in-memory adapter and does NOT claim live cloud
 * execution. Distilled from donor apps/symbiote/convex + convex/ memory schema (aukora-kernel b441edc4),
 * reduced to the minimal reactive-memory surface.
 */
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  // Append-only receipt-chained memory log (memories + content-free tombstones).
  memoryChain: defineTable({
    index: v.number(),
    kind: v.union(v.literal('memory'), v.literal('tombstone')),
    recordId: v.string(),
    createdAt: v.string(),
    prevHash: v.union(v.string(), v.null()),
    chainHash: v.string(),
    // content present only for kind:'memory'; a tombstone carries NO plaintext.
    content: v.optional(v.string()),
    consent: v.optional(v.string()),
    provenance: v.optional(v.string()),
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
