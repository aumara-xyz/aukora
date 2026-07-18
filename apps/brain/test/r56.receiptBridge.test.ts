// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/// <reference types="vite/client" />
/**
 * R56 brick 1 — the two-KIRA seam, proven on the REAL Convex functions via `convex-test`.
 *
 * HONESTY LABEL: `convex-test` is an in-process, headless SIMULATED Convex backend (real query/mutation
 * semantics, indexes, transactional db) — NOT a live cloud deployment; no network, no login, no paid call.
 *
 * Proves the `DurableReceiptBridge` closes the seam: a permitted door receipt appended to the in-process KIRA
 * (`ReactiveMemoryStore`) reaches the durable Convex `memoryChain` projection EXACTLY ONCE, survives a simulated
 * door restart (a fresh in-process store over the SAME durable backend re-forwards and is deduped), CANNOT grant
 * authority, refuses to forward a locally-refused (authority-shaped) record, and fails HONESTLY on a backend
 * outage.
 */
import { convexTest } from 'convex-test';
import { describe, it, expect } from 'vitest';
import schema from '../convex/schema';
import { api } from '../convex/_generated/api';
import { buildMemoryRecord } from '@aukora/memory';
import { ReactiveMemoryStore, DurableReceiptBridge, durableReceiptBridgeGrantsAuthority, type DurableProjectionIo } from '../src/index.js';

const modules = import.meta.glob('../convex/**/*.*s');
const at = (s: number) => `2026-07-16T00:00:${String(s).padStart(2, '0')}.000Z`;
// A door ceremony receipt: a bounded, content-free summary (no proposal content, no secret).
const doorReceipt = () => buildMemoryRecord({ content: 'governed-recursion applied · seq=7 · stage=sandbox-applied', createdAt: at(1), kind: 'receipt', consent: 'owner-only', provenance: 'durable-recursion' });

/** A projection io backed by the REAL public Convex ingest action (secret-scan → internal.memory.ingestValidated). */
const ioFor = (t: ReturnType<typeof convexTest>): DurableProjectionIo => ({
  ingest: (record) => t.action(api.ingest.ingest, { record }) as Promise<{ ok: boolean; recordId?: string; chainHash?: string; idempotent?: boolean; refusal?: string }>,
});
const chainRows = (t: ReturnType<typeof convexTest>) =>
  t.run(async (ctx: any) => ctx.db.query('memoryChain').withIndex('by_index').collect());

describe('convex-test: DurableReceiptBridge closes the two-KIRA seam (headless simulated Convex, NOT live cloud)', () => {
  it('a permitted door receipt reaches the durable memoryChain EXACTLY ONCE + cannot grant authority', async () => {
    const t = convexTest(schema, modules);
    const bridge = new DurableReceiptBridge(new ReactiveMemoryStore(), ioFor(t));
    const rec = doorReceipt();

    const out = await bridge.ingest(rec);
    expect(out.local.ok).toBe(true);              // in-process receipt appended
    expect(out.durable.ok).toBe(true);            // durable projection accepted
    expect(out.bridged).toBe(true);

    const rows = await chainRows(t);
    const mine = rows.filter((r: any) => r.recordId === (out.local.ok ? out.local.recordId : ''));
    expect(mine).toHaveLength(1);                  // EXACTLY ONE durable row
    expect(mine[0].grantsAuthority).toBe(false);   // cannot grant authority
    expect(mine[0].advisoryOnly).toBe(true);
    expect(durableReceiptBridgeGrantsAuthority()).toBe(false);
  });

  it('survives a door RESTART — a fresh in-process store re-forwards the same receipt; still exactly one durable row', async () => {
    const t = convexTest(schema, modules);
    const rec = doorReceipt();
    // boot 1
    const first = await new DurableReceiptBridge(new ReactiveMemoryStore(), ioFor(t)).ingest(rec);
    expect(first.durable.ok).toBe(true);
    // boot 2 (restart): a NEW in-process KIRA (the old one died with the process) over the SAME durable backend
    const second = await new DurableReceiptBridge(new ReactiveMemoryStore(), ioFor(t)).ingest(rec);
    expect(second.durable.ok).toBe(true);
    expect((second.durable as { idempotent?: boolean }).idempotent).toBe(true); // content-addressed dedup
    const rows = await chainRows(t);
    expect(rows.filter((r: any) => r.kind === 'memory')).toHaveLength(1);        // never doubled across restart
  });

  it('does NOT forward a locally-refused (authority-shaped) record to the durable projection', async () => {
    const t = convexTest(schema, modules);
    const bridge = new DurableReceiptBridge(new ReactiveMemoryStore(), ioFor(t));
    // an authority-shaped record: the in-process store refuses it (content-free), so it never reaches Convex
    const hostile = { ...doorReceipt(), grantsAuthority: true } as unknown;
    const out = await bridge.ingest(hostile);
    expect(out.local.ok).toBe(false);
    expect(out.bridged).toBe(false);
    expect(out.durable).toEqual({ ok: false, refusal: 'local-refused' });
    expect(await chainRows(t)).toHaveLength(0);    // nothing reached the durable projection
  });

  it('a backend outage FAILS HONESTLY — the local receipt stands, the durable leg is retryable (never silently applied)', async () => {
    const outage: DurableProjectionIo = { ingest: () => { throw new Error('convex unreachable'); } };
    const bridge = new DurableReceiptBridge(new ReactiveMemoryStore(), outage);
    const out = await bridge.ingest(doorReceipt());
    expect(out.local.ok).toBe(true);               // the in-process KIRA still recorded the receipt
    expect(out.bridged).toBe(false);
    expect(out.durable).toEqual({ ok: false, refusal: 'projection-unreachable' });
  });
});
