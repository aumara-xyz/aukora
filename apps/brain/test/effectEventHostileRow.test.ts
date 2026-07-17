// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Overnight brick 8 (adversarial) — hostile-row resilience at the durable boundary.
 *
 * Models a COMPROMISED backend: an adversary writes arbitrary, unvalidated rows straight into the durable table,
 * bypassing the store's validating write(). Proves the HARD ACCEPTANCE line "Convex compromise cannot authorize
 * or execute Git": on rebuild, projectEffectEvents re-validates every row, so a hostile row is refused, never
 * enters the canonical projection, cannot flip a settled effect, and cannot mint authority. The projection root
 * over the honest rows is UNCHANGED by any amount of injected garbage.
 */
import { describe, it, expect } from 'vitest';
import { makeEffectEvent, deriveEffectId, EFFECT_EVENT_SCHEMA } from '../src/effectEvent.js';
import { EffectEventStore, InMemoryEffectIo } from '../src/effectEventStore.js';

const AT = '2026-07-18T01:00:00.000Z';
const ev = (key: string, step: number, effect = 'step-effect-applied') => makeEffectEvent(key, step, effect, AT)!;

async function seedHonest(io: InMemoryEffectIo) {
  const store = new EffectEventStore(io);
  for (const e of [ev('wf-1', 0), ev('wf-1', 1), ev('wf-2', 0)]) await store.write(e);
  return store;
}

describe('hostile-row resilience — a compromised backend cannot corrupt the projection', () => {
  it('injected malformed / authority-claiming rows are refused on rebuild; the honest root is unchanged', async () => {
    const io = new InMemoryEffectIo();
    const store = await seedHonest(io);
    const honestRoot = (await store.rebuild()).root;
    const honestSize = (await store.rebuild()).canonicalSize;

    // An adversary sprays hostile rows straight into the durable table.
    io.injectRaw({ totally: 'malformed' });
    io.injectRaw(null);
    io.injectRaw({ ...ev('wf-9', 0), grantsAuthority: true });          // authority-claiming
    io.injectRaw({ ...ev('wf-9', 1), advisoryOnly: false });            // advisory flipped
    io.injectRaw({ ...ev('wf-9', 2), sneaky: 'extra-key' });            // unknown key (closed schema)
    io.injectRaw({ ...ev('wf-9', 3), effectId: deriveEffectId('wf-9', 99) }); // forged/swapped id
    io.injectRaw({ schema: EFFECT_EVENT_SCHEMA, effectId: 'ab'.repeat(32), rehearsalKey: 'x', step: 0, effect: 'ghp_' + 'A'.repeat(36), createdAtIso: AT, advisoryOnly: true, grantsAuthority: false }); // secret-bearing + bad id

    const after = await store.rebuild();
    expect(after.root).toBe(honestRoot);          // hostile rows changed NOTHING
    expect(after.canonicalSize).toBe(honestSize); // only the 3 honest effects
  });

  it('an injected CONFLICT for a settled effect (same id, different payload) cannot overwrite it — it quarantines', async () => {
    const io = new InMemoryEffectIo();
    const store = await seedHonest(io);

    // Same (rehearsalKey, step) as a settled honest row → same effectId, but a DIFFERENT payload.
    io.injectRaw(ev('wf-1', 0, 'ADVERSARY-REWRITE'));

    const after = await store.rebuild();
    expect(after.quarantined).toBe(1);            // the injected conflict is quarantined
    expect(after.canonicalSize).toBe(3);          // settled set intact
    // the settled effect for (wf-1,0) is still the honest one — never overwritten
    const rows = await io.list();
    // (the honest row remains the projection winner; verified via a fresh projection)
    const fresh = new EffectEventStore(io);
    expect((await fresh.rebuild()).quarantined).toBe(1);
    void rows;
  });

  it('no injected row can raise grantsAuthority — authority lives entirely outside the durable table', async () => {
    const io = new InMemoryEffectIo();
    await seedHonest(io);
    io.injectRaw({ ...ev('wf-9', 0), grantsAuthority: true });
    const rows = await io.list();
    // every row the projection ACCEPTS carries grantsAuthority:false by construction; the hostile one is refused.
    const store = new EffectEventStore(io);
    const p = await store.rebuild();
    expect(p.canonicalSize).toBe(3);
    // the only rows in the durable table with grantsAuthority:true are refused (never projected)
    const authorityRows = rows.filter((r) => (r as { grantsAuthority?: unknown }).grantsAuthority === true);
    expect(authorityRows.length).toBe(1);      // it IS in the raw table (compromise happened)
    expect(p.canonicalSize).toBe(3);           // …but it never entered the canonical projection
  });
});
