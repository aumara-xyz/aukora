// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Overnight brick 6 — append-only effect-event log + destroy-and-rebuild.
 *
 * Proves the HARD ACCEPTANCE criterion: destroy the projection, rebuild it purely from the protected event
 * stream, obtain the IDENTICAL state and root — including under a re-ordered / partially-redelivered replay.
 */
import { describe, it, expect } from 'vitest';
import { makeEffectEvent } from '../src/effectEvent.js';
import { EffectEventLog, rebuildFromStream } from '../src/effectEventLog.js';

const AT = '2026-07-17T23:00:00.000Z';
const ev = (key: string, step: number, effect = 'step-effect-applied') => makeEffectEvent(key, step, effect, AT)!;

describe('EffectEventLog — append-only protected event stream', () => {
  it('admits only validated rows; refuses malformed/authority rows without polluting the stream', () => {
    const log = new EffectEventLog();
    expect(log.append(ev('wf-1', 0))).toBe('accepted');
    expect(log.append({ bogus: true })).toBe('refused');
    expect(log.append({ ...ev('wf-1', 1), grantsAuthority: true })).toBe('refused');
    expect(log.length).toBe(1);
    expect(log.refused).toBe(2);
  });

  it('the returned stream is a COPY — mutating it cannot corrupt the append-only log', () => {
    const log = new EffectEventLog();
    log.appendAll([ev('wf-1', 0), ev('wf-1', 1)]);
    const s = log.stream() as unknown[];
    s.push({ tampered: true });
    (s as unknown as { length: number }).length = 0; // clear the copy
    expect(log.length).toBe(2); // log intact
    expect(log.projection().canonical.size).toBe(2);
  });
});

describe('destroy-and-rebuild — identical state and root from the event stream', () => {
  it('rebuild from the stream reproduces the projection root exactly', () => {
    const log = new EffectEventLog();
    log.appendAll([ev('wf-1', 0), ev('wf-1', 1), ev('wf-2', 0)]);
    const before = log.root();

    // "destroy" the projection cache → rebuild PURELY from the protected event stream.
    const rebuilt = rebuildFromStream(log.stream());
    expect(rebuilt.root).toBe(before);
    expect(rebuilt.projection.canonical.size).toBe(3);
  });

  it('rebuild is ORDER-INDEPENDENT — a shuffled / partially-redelivered replay converges to the same root', () => {
    const log = new EffectEventLog();
    const evs = [ev('wf-1', 0), ev('wf-1', 1), ev('wf-2', 0), ev('wf-3', 0)];
    log.appendAll(evs);
    const before = log.root();

    const shuffledReplay = [evs[2], evs[0], evs[3], evs[1], evs[0], evs[2]]; // reordered + redelivered
    expect(rebuildFromStream(shuffledReplay).root).toBe(before);
  });

  it('a conflicting replay (same id, different payload) is QUARANTINED identically on rebuild — never overwrites', () => {
    const log = new EffectEventLog();
    log.append(ev('wf-1', 0, 'step-effect-applied'));
    log.append(ev('wf-1', 0, 'DIFFERENT')); // same (key,step) → same id, conflicting payload — enters the stream
    expect(log.length).toBe(2);

    const p = log.projection();
    expect(p.canonical.size).toBe(1);
    expect(p.canonical.get(ev('wf-1', 0).effectId)!.effect).toBe('step-effect-applied'); // settled one wins
    expect(p.quarantined).toEqual([{ effectId: ev('wf-1', 0).effectId, reason: 'conflict' }]);

    // rebuild from the stream makes the SAME deterministic quarantine decision.
    const rebuilt = rebuildFromStream(log.stream());
    expect(rebuilt.root).toBe(log.root());
    expect(rebuilt.projection.quarantined.length).toBe(1);
  });

  it('an empty log rebuilds to a stable empty root', () => {
    const log = new EffectEventLog();
    expect(rebuildFromStream(log.stream()).root).toBe(log.root());
    expect(log.root()).toMatch(/^[0-9a-f]{64}$/);
  });
});
