// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Overnight brick 3 — durable effect-event store: idempotent projection into the backend + rebuild.
 *
 * Proves the fail-closed store contract the live convex adapter mirrors: 10 identical writes → one durable row;
 * a conflicting write is refused (never overwrites); a malformed/authority write is refused before IO; a backend
 * outage is 'unavailable' and retries losslessly; a fresh store over the same durable rows rebuilds the identical
 * root (the adapter-restart + destroy-and-rebuild model).
 */
import { describe, it, expect } from 'vitest';
import { makeEffectEvent } from '../src/effectEvent.js';
import { EffectEventStore, InMemoryEffectIo } from '../src/effectEventStore.js';

const AT = '2026-07-18T00:00:00.000Z';
const ev = (key: string, step: number, effect = 'step-effect-applied') => makeEffectEvent(key, step, effect, AT)!;

describe('EffectEventStore — idempotent durable projection', () => {
  it('10 identical writes → ONE durable row (idempotent by effectId)', async () => {
    const io = new InMemoryEffectIo();
    const store = new EffectEventStore(io);
    const one = ev('wf-1', 0);
    const results = [];
    for (let i = 0; i < 10; i++) results.push(await store.write({ ...one }));
    expect(results[0]).toEqual({ ok: true, outcome: 'inserted' });
    expect(results.slice(1).every((r) => r.ok && r.outcome === 'exists')).toBe(true);
    expect((await store.rebuild()).canonicalSize).toBe(1);
  });

  it('a CONFLICTING write (same id, different payload) is REFUSED — never overwrites', async () => {
    const io = new InMemoryEffectIo();
    const store = new EffectEventStore(io);
    expect(await store.write(ev('wf-1', 0, 'step-effect-applied'))).toEqual({ ok: true, outcome: 'inserted' });
    expect(await store.write(ev('wf-1', 0, 'DIFFERENT'))).toEqual({ ok: false, reason: 'conflict' });
    const rows = await io.list();
    expect(rows.length).toBe(1);
    expect((rows[0] as { effect: string }).effect).toBe('step-effect-applied'); // settled row unchanged
  });

  it('a malformed / authority-claiming write is REFUSED before any IO', async () => {
    const io = new InMemoryEffectIo();
    const store = new EffectEventStore(io);
    expect(await store.write({ bogus: true })).toEqual({ ok: false, reason: 'refused' });
    expect(await store.write({ ...ev('wf-1', 0), grantsAuthority: true })).toEqual({ ok: false, reason: 'refused' });
    expect((await io.list()).length).toBe(0);
  });

  it('a backend OUTAGE is reported unavailable and RETRIES losslessly — nothing silently dropped', async () => {
    const io = new InMemoryEffectIo();
    const store = new EffectEventStore(io);
    io.setOutage(true);
    expect(await store.write(ev('wf-1', 0))).toEqual({ ok: false, reason: 'unavailable' });
    expect((await io.list()).length).toBe(0); // not stored during outage
    io.setOutage(false); // outage clears — the caller retries
    expect(await store.write(ev('wf-1', 0))).toEqual({ ok: true, outcome: 'inserted' });
    expect((await io.list()).length).toBe(1); // recovered, nothing lost
  });
});

describe('rebuild — adapter restart + destroy-and-rebuild', () => {
  it('a FRESH store over the SAME durable rows rebuilds the identical root (settled rows survive)', async () => {
    const io = new InMemoryEffectIo();
    const s1 = new EffectEventStore(io);
    for (const e of [ev('wf-1', 0), ev('wf-1', 1), ev('wf-2', 0)]) await s1.write(e);
    const rootBefore = (await s1.rebuild()).root;

    const s2 = new EffectEventStore(io); // fresh adapter, same durable io — the "restart" model
    expect((await s2.rebuild()).root).toBe(rootBefore);
  });

  it('destroy the durable rows, replay the protected stream → identical root', async () => {
    const io = new InMemoryEffectIo();
    const store = new EffectEventStore(io);
    const stream = [ev('wf-1', 0), ev('wf-1', 1), ev('wf-2', 0), ev('wf-3', 0)];
    for (const e of stream) await store.write(e);
    const before = (await store.rebuild()).root;

    io.destroyRows(); // destroy the durable projection
    expect((await store.rebuild()).canonicalSize).toBe(0);

    for (const e of stream) await store.write(e); // replay the protected event stream
    const after = await store.rebuild();
    expect(after.root).toBe(before);
    expect(after.canonicalSize).toBe(4);
  });
});
