// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R37 LIVE COMPOSITION (gated: AUKORA_LIVE_COMPOSE=1, run via `npm run compose:live --workspace @aukora/brain`
 * with the local backend up via `local:up`/`local:hold`).
 *
 * The REAL composition against the RUNNING local self-hosted backend over a loopback ConvexHttpClient:
 * DurableRecursion (Sam 3's machine, unmodified) over ConvexWorkflowStore(liveWorkflowIo) — plus the loopback
 * door on the NEW-AUKORA port serving live projections and control. Proves live HTTP writes/reads of workflows,
 * memory, receipts, cancellation, and OCC through the real backend. Restart recovery is transcripted in
 * docs/LOCAL_DEV_EVIDENCE.md (the crash itself is driven outside the test runner).
 */
import { describe, it, expect } from 'vitest';
import { ConvexHttpClient } from 'convex/browser';
import { anyApi } from 'convex/server';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import {
  ConvexWorkflowStore, liveWorkflowIo, liveDoorBackend, startLocalDoor, assertLoopbackUrl, AUKORA_PORTS,
} from '../src/index.js';
// R44 LAW 2 — supervisor awareness: same custody module the supervisor itself uses (one owner, one path).
import { assertComposeMayBindDoor } from '../scripts/doorCustody.mjs';
import { DurableRecursion, validateWorkflowState, deriveWorkflowId, deriveIntentId, deriveDraftHash } from '../../seed/src/index.js';
import { makeWorld, makeProposal, authFor } from '../../seed/test/support.js';
import { buildMemoryRecord } from '@aukora/memory';

const LIVE = process.env.AUKORA_LIVE_COMPOSE === '1';
const URL_LOCAL = 'http://127.0.0.1:3210';

describe.skipIf(!LIVE)('LIVE composition — real machine over the real local backend (loopback)', () => {
  it('composes, writes/reads workflows+memory+receipts, cancels, and hits OCC — all over live HTTP', async () => {
    assertLoopbackUrl(URL_LOCAL);
    expect(() => assertLoopbackUrl('http://10.0.0.5:3210')).toThrow(/loopback/); // fail-closed composition
    const http = new ConvexHttpClient(URL_LOCAL);
    // string-path face (ConvexHttpClient accepts string function paths at runtime; the contract names are stable)
    const client = {
      query: (fn: string, args: Record<string, unknown>) => http.query(fn as never, args as never),
      mutation: (fn: string, args: Record<string, unknown>) => http.mutation(fn as never, args as never),
    };

    // ── REAL COMPOSITION: Sam 3's machine over my adapter over the live backend ──
    const w = makeWorld();
    const store = new ConvexWorkflowStore(liveWorkflowIo(client), validateWorkflowState);
    const machine = new DurableRecursion(store as never, w.env);
    const p = makeProposal();
    const nonce = `r37-live-${Date.now()}`; // unique per run (test identity only, never canonical time)
    const wfId = deriveWorkflowId(deriveIntentId(p), deriveDraftHash(p), nonce);

    await store.hydrate(wfId);
    const proposed = machine.propose(p, nonce);
    expect(proposed.ok).toBe(true);
    expect((await store.settle()).ok).toBe(true); // durable in the REAL backend

    const completed = machine.complete(p, wfId, authFor(w.owner, p, { nonce }));
    expect(completed.ok).toBe(true);
    expect(completed.state?.phase).toBe('applied');
    expect((await store.settle()).ok).toBe(true);

    // live HTTP read-back of the workflow projection
    const durable = (await http.query(anyApi.workflows.loadWorkflow, { workflowId: wfId })) as { phase: string; version: number };
    expect(durable.phase).toBe('applied');

    // live OCC: a stale duplicate create must conflict
    const stale = await http.mutation(anyApi.workflows.saveWorkflow, { state: { ...durable, version: 1 }, expectedVersion: 0 });
    expect(stale).toEqual({ ok: false, reason: 'conflict' });

    // live memory write/read through the node action + query
    const rec = buildMemoryRecord({ content: `r37 live memory ${nonce}`, createdAt: '2026-07-16T13:00:00.000Z' });
    const ing = (await http.action(anyApi.ingest.ingest, { record: rec })) as { ok: boolean };
    expect(ing.ok).toBe(true);
    const verify = (await http.query(anyApi.memory.verify, {})) as { valid: boolean };
    expect(verify.valid).toBe(true);

    // live receipts + cancellation through the DOOR on the NEW-AUKORA port
    const rehearsalKey = `door-${nonce}`;
    await http.mutation(anyApi.rehearsal.startRehearsal, { key: rehearsalKey, totalSteps: 8, authorityRef: 'a'.repeat(64) });
    // R44 LAW 2: never collide with or bypass the supervisor-held door — refuse loudly if it is held.
    const APP_DIR = resolve(fileURLToPath(new URL('..', import.meta.url)));
    assertComposeMayBindDoor(resolve(APP_DIR, '.local', 'organism'), resolve(APP_DIR, '..', '..'));
    const door = await startLocalDoor(liveDoorBackend(client), AUKORA_PORTS.brainDoor);
    try {
      const base = `http://127.0.0.1:${AUKORA_PORTS.brainDoor}`;
      const health = await fetch(`${base}/health`);
      expect(health.headers.get('x-aukora-source')).toBe('live');
      expect(((await health.json()) as { backend: { ok: boolean } }).backend.ok).toBe(true);
      const receipts = (await (await fetch(`${base}/receipts?rehearsalKey=${rehearsalKey}`)).json()) as { event: string }[];
      expect(receipts.map((e) => e.event)).toContain('started'); // live receipt REFERENCES through the door
      const cancel = await fetch(`${base}/control/cancel-rehearsal`, { method: 'POST', body: JSON.stringify({ key: rehearsalKey }) });
      expect(((await cancel.json()) as { ok: boolean }).ok).toBe(true);
      const after = (await (await fetch(`${base}/receipts?rehearsalKey=${rehearsalKey}`)).json()) as { event: string }[];
      expect(after[after.length - 1].event).toBe('cancelled'); // cancellation visible live
      const wfDoor = await fetch(`${base}/workflow/${wfId}`);
      expect(((await wfDoor.json()) as { phase: string }).phase).toBe('applied'); // live workflow projection via the door
    } finally {
      await new Promise<void>((r) => door.close(() => r()));
    }
  }, 60_000);
});
