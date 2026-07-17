// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Overnight brick 1+2 — closed effect-event validators + convergent append-only projection.
 *
 * Proves the HARD ACCEPTANCE criteria this primitive underwrites: ten identical projection deliveries collapse
 * to ONE canonical result; a conflicting duplicate is explicitly quarantined (never silently overwritten); the
 * projection is a pure function of the delivery SET (order-independent → destroy-and-rebuild safe); and the
 * closed validator refuses malformed / extra-keyed / authority-claiming / forged-id / secret-bearing rows.
 */
import { describe, it, expect } from 'vitest';
import {
  EFFECT_EVENT_SCHEMA, deriveEffectId, validateEffectEvent, makeEffectEvent,
  projectEffectEvents, effectProjectionRoot, effectEventGrantsAuthority, MAX_EFFECT_LEN,
} from '../src/effectEvent.js';

const AT = '2026-07-17T22:00:00.000Z';
const ev = (key: string, step: number, effect = 'step-effect-applied', at = AT) => makeEffectEvent(key, step, effect, at)!;

describe('deriveEffectId — deterministic, keyed by (rehearsalKey, step)', () => {
  it('same (key, step) → same id; different → different; always 64-hex', () => {
    expect(deriveEffectId('wf-1', 0)).toBe(deriveEffectId('wf-1', 0));
    expect(deriveEffectId('wf-1', 0)).not.toBe(deriveEffectId('wf-1', 1));
    expect(deriveEffectId('wf-1', 0)).not.toBe(deriveEffectId('wf-2', 0));
    expect(deriveEffectId('wf-1', 0)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('validateEffectEvent — CLOSED and COMPATIBLE', () => {
  it('a well-formed event round-trips; authority stays out', () => {
    const e = ev('wf-1', 0);
    expect(validateEffectEvent(e)).toEqual(e);
    expect(e.advisoryOnly).toBe(true);
    expect(e.grantsAuthority).toBe(false);
    expect(effectEventGrantsAuthority()).toBe(false);
  });
  it('refuses an UNKNOWN extra key (closed schema)', () => {
    expect(validateEffectEvent({ ...ev('wf-1', 0), sneaky: 1 })).toBeNull();
  });
  it('refuses a MISSING key', () => {
    const { effect, ...missing } = ev('wf-1', 0) as unknown as Record<string, unknown>;
    void effect;
    expect(validateEffectEvent(missing)).toBeNull();
  });
  it('refuses a FORGED / swapped id', () => {
    expect(validateEffectEvent({ ...ev('wf-1', 0), effectId: deriveEffectId('wf-1', 1) })).toBeNull();
    expect(validateEffectEvent({ ...ev('wf-1', 0), effectId: 'ab'.repeat(32) })).toBeNull();
  });
  it('refuses AUTHORITY-claiming flags', () => {
    expect(validateEffectEvent({ ...ev('wf-1', 0), grantsAuthority: true })).toBeNull();
    expect(validateEffectEvent({ ...ev('wf-1', 0), advisoryOnly: false })).toBeNull();
  });
  it('refuses a SECRET-bearing effect / key', () => {
    expect(makeEffectEvent('wf-1', 0, 'token ghp_' + 'A'.repeat(36), AT)).toBeNull();
  });
  it('refuses malformed step / oversized effect / bad shape', () => {
    expect(validateEffectEvent({ ...ev('wf-1', 0), step: -1 })).toBeNull();
    expect(validateEffectEvent({ ...ev('wf-1', 0), step: 1.5 })).toBeNull();
    expect(makeEffectEvent('wf-1', 0, 'x'.repeat(MAX_EFFECT_LEN + 1), AT)).toBeNull();
    expect(validateEffectEvent(null)).toBeNull();
    expect(validateEffectEvent([])).toBeNull();
  });
});

describe('projectEffectEvents — HARD ACCEPTANCE', () => {
  it('TEN identical deliveries → ONE canonical result', () => {
    const one = ev('wf-1', 0);
    const p = projectEffectEvents(Array.from({ length: 10 }, () => ({ ...one })));
    expect(p.canonical.size).toBe(1);
    expect(p.accepted).toBe(1);
    expect(p.deduplicated).toBe(9);
    expect(p.quarantined).toEqual([]);
    expect(p.canonical.get(one.effectId)).toEqual(one);
  });

  it('a CONFLICTING duplicate (same id, different payload) → explicit QUARANTINE, canonical never overwritten', () => {
    const first = ev('wf-1', 0, 'step-effect-applied');
    const conflict = ev('wf-1', 0, 'DIFFERENT-effect'); // same (key,step) → same id, different payload
    expect(conflict.effectId).toBe(first.effectId);
    const p = projectEffectEvents([first, conflict, first]);
    expect(p.canonical.size).toBe(1);
    expect(p.canonical.get(first.effectId)!.effect).toBe('step-effect-applied'); // the settled one, unchanged
    expect(p.quarantined).toEqual([{ effectId: first.effectId, reason: 'conflict' }]);
    expect(p.deduplicated).toBe(1); // the re-delivered `first`
  });

  it('is ORDER-INDEPENDENT — any permutation yields the identical canonical root (destroy-and-rebuild safe)', () => {
    const evs = [ev('wf-1', 0), ev('wf-1', 1), ev('wf-2', 0), ev('wf-2', 1), ev('wf-3', 0)];
    const forward = projectEffectEvents([...evs, ...evs]); // duplicated deliveries
    const shuffled = projectEffectEvents([evs[3], evs[0], evs[4], evs[1], evs[2], evs[2], evs[0]]);
    expect(forward.canonical.size).toBe(5);
    expect(effectProjectionRoot(forward)).toBe(effectProjectionRoot(shuffled));
  });

  it('malformed deliveries are refused and dropped, not projected', () => {
    const good = ev('wf-1', 0);
    const p = projectEffectEvents([good, { bogus: true }, null, { ...good, grantsAuthority: true }]);
    expect(p.accepted).toBe(1);
    expect(p.refused).toBe(3);
    expect(p.canonical.size).toBe(1);
  });

  it('an empty stream projects to an empty, stable root', () => {
    const p = projectEffectEvents([]);
    expect(p.canonical.size).toBe(0);
    expect(effectProjectionRoot(p)).toMatch(/^[0-9a-f]{64}$/);
  });
});
