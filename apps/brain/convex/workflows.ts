// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Durable recursion workflow persistence (R36) — the Convex half of Sam 3's `WorkflowStore` contract
 * (apps/seed/src/durableRecursion.ts). Local self-hosted deployment only.
 *
 * Rows are PROJECTIONS: the store never receives an authorization, a signature, a key, or proposal content —
 * the kernel/AUMLOK gate re-verifies every decision from scratch OUTSIDE Convex, so nothing persisted here can
 * decide anything. Saves are OPTIMISTICALLY CONCURRENT: `expectedVersion` must equal the stored version
 * (0 = create) and the new state's version must be exactly one greater — a losing writer gets `conflict`.
 *
 * Validation split (honest): the FULL exact-shape + forbidden-content law (`validateWorkflowState`, which needs
 * the Node-runtime secret scanner) runs in the Node-side adapter (apps/brain/src/convexWorkflowStore.ts) BEFORE
 * any save reaches this mutation; this isolate side enforces the structural law it can express — the schema
 * validators above plus hex/phase/version checks below. Workflow rows are mutable BY DESIGN under OCC;
 * receipts remain in the append-only chains and are never touched here.
 */
import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

const HEX64 = /^[0-9a-f]{64}$/;
const PHASES = new Set(['awaiting-owner', 'applied', 'refused', 'cancelled']);

export const loadWorkflow = query({
  args: { workflowId: v.string() },
  handler: async (ctx, { workflowId }) => {
    const row = await ctx.db.query('workflows').withIndex('by_workflowId', (q: any) => q.eq('workflowId', workflowId)).first();
    if (!row) return null;
    const { _id, _creationTime, ...state } = row;
    void _id; void _creationTime;
    return state;
  },
});

// SENSE: current workflow projections (most recent first, bounded), optionally filtered by phase.
// Read-only; projections only — powers the door's /workflows, /aumlok (awaiting-owner) and /candidates
// (applied) views for Spatial and the chat door.
export const listWorkflows = query({
  args: { phase: v.optional(v.union(v.literal('awaiting-owner'), v.literal('applied'), v.literal('refused'), v.literal('cancelled'))), limit: v.optional(v.number()) },
  handler: async (ctx, { phase, limit }) => {
    const bounded = Number.isInteger(limit) && (limit as number) > 0 && (limit as number) <= 100 ? (limit as number) : 20;
    const rows = await ctx.db.query('workflows').order('desc').take(200);
    return rows
      .filter((r: any) => phase === undefined || r.phase === phase)
      .slice(0, bounded)
      .map((r: any) => {
        const { _id, _creationTime, ...state } = r;
        void _id; void _creationTime;
        return state;
      });
  },
});

export const saveWorkflow = mutation({
  args: { state: v.any(), expectedVersion: v.number() },
  handler: async (ctx, { state, expectedVersion }) => {
    const s = state as Record<string, unknown> | null;
    // Structural law (isolate-expressible): schema/id/phase/version/flags. The full exact-shape +
    // forbidden-content law already ran in the Node adapter.
    if (
      s === null || typeof s !== 'object' ||
      s.schema !== 'aukora-recursion-workflow-v1' ||
      typeof s.workflowId !== 'string' || !HEX64.test(s.workflowId) ||
      typeof s.intentId !== 'string' || !HEX64.test(s.intentId) ||
      typeof s.draftHash !== 'string' || !HEX64.test(s.draftHash) ||
      typeof s.phase !== 'string' || !PHASES.has(s.phase) ||
      !Number.isSafeInteger(s.version) || (s.version as number) < 1 ||
      s.advisoryOnly !== true || s.grantsAuthority !== false
    ) {
      return { ok: false, reason: 'refused' };
    }
    const existing = await ctx.db.query('workflows').withIndex('by_workflowId', (q: any) => q.eq('workflowId', s.workflowId)).first();
    const current = existing ? existing.version : 0;
    if (current !== expectedVersion || s.version !== current + 1) return { ok: false, reason: 'conflict' };
    if (existing) {
      const { _id, _creationTime, ...rest } = existing;
      void _creationTime; void rest;
      await ctx.db.replace(_id, s as any);
    } else {
      await ctx.db.insert('workflows', s as any);
    }
    return { ok: true };
  },
});
