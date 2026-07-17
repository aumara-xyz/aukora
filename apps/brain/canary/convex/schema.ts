// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R51 CORE TRUTH FREEZE — the append-only workflow-events + atomic current-snapshot SPEC, as a MINIMAL
 * self-hosted-Convex pilot (issue #108). This is NOT the production store (apps/brain/src/convexWorkflowStore.ts
 * stays authoritative tonight); it is the smallest schema that lets a REAL local backend prove the five nervous-
 * system laws (accept-once, 10→1 canonical effect, SIGKILL loses no settled state, restart makes no duplicate,
 * one reactive projection changes). No authority, no keys, no signatures — projections only.
 */
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  // APPEND-ONLY event log. Rows are never mutated or deleted. `eventId` is content-addressed (sha256 of the
  // typed submission) so an at-least-once transport that re-delivers the SAME event de-duplicates to ONE row.
  wf_events: defineTable({
    eventId: v.string(),        // 64-hex content address of the typed event — the idempotency key
    workflowId: v.string(),     // 64-hex
    kind: v.string(),           // typed event kind (e.g. 'accepted')
    seq: v.number(),            // append order within the workflow (0-based), assigned at commit
    at: v.string(),             // caller-supplied logical ISO time (never an ambient clock in the law)
    grantsAuthority: v.boolean(), // ALWAYS false — asserted by the mutation
  }).index('by_eventId', ['eventId']).index('by_workflow_seq', ['workflowId', 'seq']),

  // ATOMIC CURRENT snapshot — exactly one row per workflow, advanced in the SAME transaction as its event
  // append (so the snapshot can never disagree with the log). This is the single reactive projection.
  wf_snapshot: defineTable({
    workflowId: v.string(),
    eventCount: v.number(),     // = number of wf_events rows for this workflow
    headEventId: v.string(),    // eventId of the most recent appended event
    lastKind: v.string(),
    updatedAt: v.string(),
    grantsAuthority: v.boolean(), // ALWAYS false
  }).index('by_workflow', ['workflowId']),
});
