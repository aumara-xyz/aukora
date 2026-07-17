// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R51 pilot functions — the append-only-events + atomic-snapshot law, in ONE serializable mutation each.
 * No authority anywhere: `appendEventOnce` REFUSES any event carrying grantsAuthority !== false, and every
 * row it writes is grantsAuthority:false. Idempotency is content-addressed: the SAME eventId commits at most
 * one row, so an at-least-once door (10 identical submissions) yields exactly one canonical effect + snapshot.
 */
import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

const HEX64 = /^[0-9a-f]{64}$/;

export const appendEventOnce = mutation({
  args: {
    eventId: v.string(),
    workflowId: v.string(),
    kind: v.string(),
    at: v.string(),
    grantsAuthority: v.optional(v.boolean()),
  },
  handler: async (ctx, a) => {
    // Structural + authority law (isolate-expressible). Authority material is refused, never persisted.
    if (!HEX64.test(a.eventId) || !HEX64.test(a.workflowId) || a.kind.length === 0 || a.kind.length > 64) {
      return { ok: false, reason: 'refused-shape' as const };
    }
    if (a.grantsAuthority === true) return { ok: false, reason: 'refused-authority' as const };

    // IDEMPOTENT: a re-delivered event (same content address) is a no-op that returns the existing effect.
    const existing = await ctx.db.query('wf_events').withIndex('by_eventId', (q: any) => q.eq('eventId', a.eventId)).first();
    if (existing) {
      const snap = await ctx.db.query('wf_snapshot').withIndex('by_workflow', (q: any) => q.eq('workflowId', a.workflowId)).first();
      return { ok: true, deduplicated: true, seq: existing.seq, eventCount: snap?.eventCount ?? 0 };
    }

    // Append order = current event count for this workflow (assigned at commit, in-transaction).
    const prior = await ctx.db.query('wf_events').withIndex('by_workflow_seq', (q: any) => q.eq('workflowId', a.workflowId)).collect();
    const seq = prior.length;

    // ATOMIC: append the event AND advance the snapshot in the SAME transaction — they can never diverge.
    await ctx.db.insert('wf_events', { eventId: a.eventId, workflowId: a.workflowId, kind: a.kind, seq, at: a.at, grantsAuthority: false });
    const snap = await ctx.db.query('wf_snapshot').withIndex('by_workflow', (q: any) => q.eq('workflowId', a.workflowId)).first();
    const next = { workflowId: a.workflowId, eventCount: seq + 1, headEventId: a.eventId, lastKind: a.kind, updatedAt: a.at, grantsAuthority: false };
    if (snap) { const { _id, _creationTime, ...rest } = snap; void _creationTime; void rest; await ctx.db.replace(_id, next as any); }
    else await ctx.db.insert('wf_snapshot', next as any);

    return { ok: true, deduplicated: false, seq, eventCount: seq + 1 };
  },
});

/** The single reactive projection — atomic current snapshot for a workflow. Read-only, advisory. */
export const snapshot = query({
  args: { workflowId: v.string() },
  handler: async (ctx, { workflowId }) => {
    const s = await ctx.db.query('wf_snapshot').withIndex('by_workflow', (q: any) => q.eq('workflowId', workflowId)).first();
    if (!s) return null;
    const { _id, _creationTime, ...state } = s; void _id; void _creationTime;
    return state;
  },
});

/** The append-only log for a workflow, in append order — the durable truth the snapshot is derived from. */
export const events = query({
  args: { workflowId: v.string() },
  handler: async (ctx, { workflowId }) => {
    const rows = await ctx.db.query('wf_events').withIndex('by_workflow_seq', (q: any) => q.eq('workflowId', workflowId)).collect();
    return rows.map((r: any) => ({ eventId: r.eventId, kind: r.kind, seq: r.seq, at: r.at }));
  },
});

/** Total durable event rows across all workflows — a global liveness projection for the canary. */
export const totalEvents = query({
  args: {},
  handler: async (ctx) => (await ctx.db.query('wf_events').collect()).length,
});
