// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * The brain's loopback projection/control door: binds 127.0.0.1 only, serves LIVE-labelled projections from the
 * injected backend (no fixture path exists), exposes exactly two control reflexes, 404s everything else, and
 * grants no authority. Driven with a fake backend on an ephemeral port.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import { startLocalDoor, localDoorGrantsAuthority, AUKORA_PORTS, DOOR_CAPABILITY_HEADER, verifyDoorControlToken, type DoorBackend } from '../src/index.js';

const TOKEN = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718'; // 48-hex, per-boot shape (synthetic, test only)
const authed = (extra: Record<string, string> = {}) => ({ [DOOR_CAPABILITY_HEADER]: TOKEN, ...extra });

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

beforeAll(async () => { server = await startLocalDoor(fake, PORT, TOKEN); });
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

  it('exactly two control reflexes (with a valid token); malformed bodies refuse; unknown paths 404', async () => {
    const ok = await fetch(`${BASE}/control/cancel-rehearsal`, { method: 'POST', headers: authed(), body: JSON.stringify({ key: 'w9' }) });
    expect(ok.status).toBe(200);
    expect(calls).toContain('cancel-rehearsal:w9');
    const bad = await fetch(`${BASE}/control/cancel-impulse`, { method: 'POST', headers: authed(), body: '{}' });
    expect(bad.status).toBe(400);
    expect((await fetch(`${BASE}/control/ingest`, { method: 'POST', headers: authed(), body: '{}' })).status).toBe(404); // no write door
    expect((await fetch(`${BASE}/anything`)).status).toBe(404);
  });

  it('R59 control capability: missing / forged / replayed-stale tokens are rejected 401; the token is never echoed', async () => {
    const paths = ['/control/cancel-rehearsal', '/control/cancel-impulse'];
    const before = calls.length;
    for (const p of paths) {
      // missing token
      const miss = await fetch(`${BASE}${p}`, { method: 'POST', body: JSON.stringify({ key: 'x', impulseId: 'x' }) });
      expect(miss.status, `${p} missing`).toBe(401);
      // forged token (right shape, wrong value)
      const forged = await fetch(`${BASE}${p}`, { method: 'POST', headers: { [DOOR_CAPABILITY_HEADER]: 'f'.repeat(48) }, body: JSON.stringify({ key: 'x', impulseId: 'x' }) });
      expect(forged.status, `${p} forged`).toBe(401);
      // replayed/stale token from a prior boot (any non-matching value; per-boot rotation is the replay boundary)
      const stale = await fetch(`${BASE}${p}`, { method: 'POST', headers: { authorization: 'Bearer 00000000000000000000000000000000000000000000dead' }, body: JSON.stringify({ key: 'x', impulseId: 'x' }) });
      expect(stale.status, `${p} stale`).toBe(401);
      // the 401 body carries no token material
      expect(JSON.stringify(await forged.json())).not.toContain('f'.repeat(48));
    }
    expect(calls.length, 'no control effect ran for any unauthorized request').toBe(before);
  });

  it('R59 accepts the Authorization: Bearer form as well as the x-aukora-door-token header', async () => {
    const viaBearer = await fetch(`${BASE}/control/cancel-rehearsal`, { method: 'POST', headers: { authorization: `Bearer ${TOKEN}` }, body: JSON.stringify({ key: 'w-bearer' }) });
    expect(viaBearer.status).toBe(200);
    expect(calls).toContain('cancel-rehearsal:w-bearer');
  });
});

describe('R59 door capability — unit + unprovisioned control plane', () => {
  it('verifyDoorControlToken is constant-time-shaped and total (missing/forged/valid/replay)', () => {
    expect(verifyDoorControlToken(TOKEN, TOKEN)).toBe(true);        // valid
    expect(verifyDoorControlToken(TOKEN, TOKEN)).toBe(true);        // same token again = accepted within a boot (bearer)
    expect(verifyDoorControlToken('f'.repeat(48), TOKEN)).toBe(false); // forged, same length
    expect(verifyDoorControlToken('short', TOKEN)).toBe(false);     // length mismatch
    expect(verifyDoorControlToken(TOKEN, null)).toBe(false);        // unprovisioned expected
    expect(verifyDoorControlToken(TOKEN, '')).toBe(false);          // empty expected
    expect(verifyDoorControlToken(undefined, TOKEN)).toBe(false);   // missing presented
    expect(verifyDoorControlToken(12345 as unknown, TOKEN)).toBe(false); // non-string presented
  });

  it('an UNPROVISIONED control plane fails closed: control POSTs refuse 503 even with a token', async () => {
    const port = 7149;
    const srv = await startLocalDoor(fake, port, null); // no control token provisioned
    try {
      const r = await fetch(`http://127.0.0.1:${port}/control/cancel-rehearsal`, { method: 'POST', headers: authed(), body: JSON.stringify({ key: 'w9' }) });
      expect(r.status).toBe(503);
      // reads remain available on the same unprovisioned door (projections are not gated)
      expect((await fetch(`http://127.0.0.1:${port}/health`)).status).toBe(200);
    } finally {
      await new Promise<void>((res) => { srv.closeAllConnections(); srv.close(() => res()); });
    }
  });
});
