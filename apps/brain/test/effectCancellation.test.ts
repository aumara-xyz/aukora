// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Overnight brick 8 — cancellation + migration/version-pinning (the last item-8 categories).
 *
 * Cancellation: a governed, auditable, terminal projection-time revocation of a workflow's effects, without
 * rewriting the append-only stream. Migration: the closed validator is VERSION-PINNED, so old / future / missing
 * -schema rows fail closed — no silent cross-version acceptance during a schema migration.
 */
import { describe, it, expect } from 'vitest';
import { makeEffectEvent, validateEffectEvent, projectEffectEvents, effectProjectionRoot, EFFECT_EVENT_SCHEMA } from '../src/effectEvent.js';
import { projectWithCancellations, cancellableProjectionRoot } from '../src/effectCancellation.js';

const AT = '2026-07-18T03:00:00.000Z';
const ev = (key: string, step: number, effect = 'step-effect-applied') => makeEffectEvent(key, step, effect, AT)!;

describe('cancellation — governed, auditable, terminal revocation', () => {
  const stream = [ev('wf-1', 0), ev('wf-1', 1), ev('wf-2', 0), ev('wf-3', 0)];
  const uncancelledRoot = effectProjectionRoot(projectEffectEvents(stream));

  it('with no cancellations the projection equals the plain projection', () => {
    const p = projectWithCancellations(stream, []);
    expect(cancellableProjectionRoot(p)).toBe(uncancelledRoot);
    expect(p.cancelledEffects).toBe(0);
    expect(p.canonical.size).toBe(4);
  });

  it("cancelling a workflow removes ONLY its effects; the root changes; it is auditable", () => {
    const p = projectWithCancellations(stream, ['wf-1']);
    expect(p.canonical.size).toBe(2);                 // wf-2/0 and wf-3/0 remain
    expect(p.cancelledEffects).toBe(2);               // wf-1's two effects suppressed
    expect(p.cancelledKeysObserved).toEqual(['wf-1']); // auditable
    expect(cancellableProjectionRoot(p)).not.toBe(uncancelledRoot);
    // the raw stream is untouched — cancellation is a projection-time filter
    expect(stream.length).toBe(4);
  });

  it('cancelling an ABSENT key is a no-op (not observed)', () => {
    const p = projectWithCancellations(stream, ['wf-does-not-exist']);
    expect(cancellableProjectionRoot(p)).toBe(uncancelledRoot);
    expect(p.cancelledEffects).toBe(0);
    expect(p.cancelledKeysObserved).toEqual([]);
  });

  it('cancellation is TERMINAL and order-independent — re-delivering a cancelled key cannot resurrect it', () => {
    const replayed = [...stream, ev('wf-1', 0), ev('wf-1', 1), stream[2]]; // wf-1 re-delivered after cancel
    const a = projectWithCancellations(replayed, ['wf-1']);
    const b = projectWithCancellations([...replayed].reverse(), ['wf-1']); // SAME set, permuted delivery order
    expect(a.canonical.has(ev('wf-1', 0).effectId)).toBe(false); // stays cancelled despite redelivery
    expect(a.canonical.size).toBe(2);                              // only wf-2/0, wf-3/0 survive
    expect(cancellableProjectionRoot(a)).toBe(cancellableProjectionRoot(b)); // order-independent
  });
});

describe('migration — the closed validator is version-pinned (no silent cross-version acceptance)', () => {
  it('an OLD-schema row (aukora-effect-event-v0) is refused', () => {
    expect(validateEffectEvent({ ...ev('wf-1', 0), schema: 'aukora-effect-event-v0' })).toBeNull();
  });
  it('a FUTURE-schema row (v2) is refused', () => {
    expect(validateEffectEvent({ ...ev('wf-1', 0), schema: 'aukora-effect-event-v2' })).toBeNull();
  });
  it('a MISSING-schema row is refused (closed schema)', () => {
    const { schema, ...noSchema } = ev('wf-1', 0) as unknown as Record<string, unknown>;
    void schema;
    expect(validateEffectEvent(noSchema)).toBeNull();
  });
  it('only the exact current schema validates, and a mixed old+current stream projects only the current rows', () => {
    expect((ev('wf-1', 0)).schema).toBe(EFFECT_EVENT_SCHEMA);
    const mixed = [ev('wf-1', 0), { ...ev('wf-2', 0), schema: 'aukora-effect-event-v0' }, ev('wf-3', 0)];
    const p = projectEffectEvents(mixed);
    expect(p.canonical.size).toBe(2); // the v0 row is refused, not migrated silently
    expect(p.refused).toBe(1);
  });
});
