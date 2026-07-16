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
const fake: DoorBackend = {
  health: async () => ({ ok: true }),
  snapshot: async () => ({ liveCount: 2 }),
  workflow: async (id) => (id === 'known' ? { workflowId: id, phase: 'awaiting-owner' } : null),
  receiptStream: async (key) => [{ index: 0, rehearsalKey: key ?? 'all' }],
  cancelRehearsal: async (key) => { calls.push(`cancel-rehearsal:${key}`); return { ok: true }; },
  cancelImpulse: async (id) => { calls.push(`cancel-impulse:${id}`); return { ok: true }; },
};

const PORT = 7148; // test port inside the NEW-AUKORA brain block (7141 is the real door)
const BASE = `http://127.0.0.1:${PORT}`;
let server: Server;

beforeAll(async () => { server = await startLocalDoor(fake, PORT); });
afterAll(() => new Promise<void>((r) => server.close(() => r())));

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
