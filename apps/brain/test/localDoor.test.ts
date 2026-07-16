// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * The brain's loopback projection/control door: binds 127.0.0.1 only, serves LIVE-labelled projections from the
 * injected backend (no fixture path exists), exposes exactly two control reflexes, 404s everything else, and
 * grants no authority. Driven with a fake backend on an ephemeral port.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import { startLocalDoor, localDoorGrantsAuthority, AUKORA_PORTS, type DoorBackend } from '../src/index.js';

const calls: string[] = [];
let pushSnapshot: ((s: unknown) => void) | null = null;
const fake: DoorBackend = {
  health: async () => ({ ok: true }),
  snapshot: async () => ({ liveCount: 2 }),
  workflow: async (id) => (id === 'known' ? { workflowId: id, phase: 'awaiting-owner' } : null),
  listWorkflows: async (phase) => [{ workflowId: 'w1', phase: phase ?? 'applied' }],
  recall: async (text) => [{ recordId: 'r1', content: `hit for ${text}` }],
  receiptStream: async (key) => [{ index: 0, rehearsalKey: key ?? 'all' }],
  cancelRehearsal: async (key) => { calls.push(`cancel-rehearsal:${key}`); return { ok: true }; },
  cancelImpulse: async (id) => { calls.push(`cancel-impulse:${id}`); return { ok: true }; },
  subscribeSnapshot: (onChange) => { pushSnapshot = onChange; return () => { pushSnapshot = null; }; },
};

const PORT = 7148; // test port inside the NEW-AUKORA brain block (7141 is the real door)
const BASE = `http://127.0.0.1:${PORT}`;
let server: Server;

beforeAll(async () => { server = await startLocalDoor(fake, PORT); });
afterAll(() => new Promise<void>((r) => { server.closeAllConnections(); server.close(() => r()); }));

describe('local door — loopback projection/control', () => {
  it('claims the collision-free NEW-AUKORA block and never the donor ports', () => {
    expect(AUKORA_PORTS.brainDoor).toBe(7141);
    expect(AUKORA_PORTS.donorReserved).toContain(7091);
    expect(AUKORA_PORTS.donorReserved).toContain(7092);
    expect([7091, 7092]).not.toContain(AUKORA_PORTS.brainDoor);
    expect(localDoorGrantsAuthority()).toBe(false);
  });

  it('serves projections with the LIVE source label (no fixture path exists on the door)', async () => {
    const res = await fetch(`${BASE}/health`);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-aukora-source')).toBe('live');
    expect(res.headers.get('x-aukora-grants-authority')).toBe('false');
    expect(((await res.json()) as { backend: { ok: boolean } }).backend.ok).toBe(true);
    expect(((await (await fetch(`${BASE}/snapshot`)).json()) as { liveCount: number }).liveCount).toBe(2);
    const truth = (await (await fetch(`${BASE}/truth`)).json()) as { id: string; truth: string }[];
    expect(truth.find((p: { id: string }) => p.id === 'kimi')?.truth).toBe('REJECTED');
  });

  it('workflow projection: known id 200, unknown id 404', async () => {
    expect((await fetch(`${BASE}/workflow/known`)).status).toBe(200);
    expect((await fetch(`${BASE}/workflow/unknown`)).status).toBe(404);
    const stream = (await (await fetch(`${BASE}/receipts?rehearsalKey=w1`)).json()) as { rehearsalKey: string }[];
    expect(stream[0].rehearsalKey).toBe('w1');
  });

  it('R38 projections: /workflows /memory/recall /fu /aumlok /candidates — all live-labelled', async () => {
    const wfs = (await (await fetch(`${BASE}/workflows?phase=applied`)).json()) as { phase: string }[];
    expect(wfs[0].phase).toBe('applied');
    expect((await fetch(`${BASE}/workflows?phase=bogus`)).status).toBe(400);
    const recall = (await (await fetch(`${BASE}/memory/recall?text=door`)).json()) as { content: string }[];
    expect(recall[0].content).toContain('door');
    const fu = (await (await fetch(`${BASE}/fu`)).json()) as { seats: { id: string }[]; providerTruth: unknown[]; grantsAuthority: boolean };
    expect(fu.seats.map((s) => s.id)).toContain('FBL'); // canonical Fu roster served untouched
    expect(fu.grantsAuthority).toBe(false);
    const aumlok = (await (await fetch(`${BASE}/aumlok`)).json()) as { awaitingOwner: { phase: string }[]; authorityLocation: string };
    expect(aumlok.awaitingOwner[0].phase).toBe('awaiting-owner');
    expect(aumlok.authorityLocation).toContain('kernel/AUMLOK');
    const candidates = (await (await fetch(`${BASE}/candidates`)).json()) as { applied: { phase: string }[]; egress: string };
    expect(candidates.applied[0].phase).toBe('applied');
    expect(candidates.egress).toBe('pr-candidate-only');
  });

  it('is ORIGIN-CLOSED: no CORS header is ever emitted, even for cross-origin-looking requests', async () => {
    const res = await fetch(`${BASE}/health`, { headers: { origin: 'https://evil.example' } });
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
    expect(res.headers.get('access-control-allow-methods')).toBeNull();
  });

  it('REACTIVE /events: SSE pushes snapshot changes through the injected seam; unsubscribes on close', async () => {
    const controller = new AbortController();
    const res = await fetch(`${BASE}/events`, { signal: controller.signal });
    expect(res.headers.get('content-type')).toBe('text/event-stream');
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let seen = decoder.decode((await reader.read()).value); // ': connected' flush
    // the fake seam is now wired; push one snapshot and read until it arrives
    expect(pushSnapshot).not.toBeNull();
    pushSnapshot!({ liveCount: 3 });
    while (!seen.includes('event: snapshot')) seen += decoder.decode((await reader.read()).value);
    expect(seen).toContain('"liveCount":3');
    controller.abort();
    await new Promise((r) => setTimeout(r, 50));
    expect(pushSnapshot).toBeNull(); // unsubscribed on close
  });

  it('exactly two control reflexes; malformed bodies refuse; unknown paths 404', async () => {
    const ok = await fetch(`${BASE}/control/cancel-rehearsal`, { method: 'POST', body: JSON.stringify({ key: 'w9' }) });
    expect(ok.status).toBe(200);
    expect(calls).toContain('cancel-rehearsal:w9');
    const bad = await fetch(`${BASE}/control/cancel-impulse`, { method: 'POST', body: '{}' });
    expect(bad.status).toBe(400);
    expect((await fetch(`${BASE}/control/ingest`, { method: 'POST', body: '{}' })).status).toBe(404); // no write door
    expect((await fetch(`${BASE}/anything`)).status).toBe(404);
  });
});
