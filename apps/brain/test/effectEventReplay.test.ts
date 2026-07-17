// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Overnight brick 8 (adversarial reproduction) — replay / stuck-effect / stale-cache.
 *
 * Distinct from the earlier convergence + hostile-row proofs: these exercise adversarial DELIVERY over the
 * effect log/projection — at-least-once replay storms, missing (stuck) steps that must not corrupt neighbours,
 * and a stale cached root that must always be superseded by a rebuild from the protected event stream.
 */
import { describe, it, expect } from 'vitest';
import { makeEffectEvent, projectEffectEvents, effectProjectionRoot } from '../src/effectEvent.js';
import { EffectEventLog, rebuildFromStream } from '../src/effectEventLog.js';

const AT = '2026-07-18T02:00:00.000Z';
const ev = (key: string, step: number, effect = 'step-effect-applied') => makeEffectEvent(key, step, effect, AT)!;
const rootOf = (rows: unknown[]) => effectProjectionRoot(projectEffectEvents(rows));

describe('replay storm — at-least-once redelivery converges', () => {
  it('the whole stream re-delivered 5× and interleaved yields the identical root', () => {
    const base = [ev('wf-1', 0), ev('wf-1', 1), ev('wf-2', 0), ev('wf-3', 0)];
    const clean = rootOf(base);
    // 5 interleaved copies, shuffled — a hostile at-least-once transport
    const storm: unknown[] = [];
    for (let i = 0; i < 5; i++) for (const e of [base[3], base[1], base[0], base[2], base[0]]) storm.push({ ...e });
    const p = projectEffectEvents(storm);
    expect(effectProjectionRoot(p)).toBe(clean);
    expect(p.canonical.size).toBe(4);
    expect(p.deduplicated).toBeGreaterThan(0);
    expect(p.quarantined).toEqual([]);
  });
});

describe('stuck effect — a missing step never corrupts its neighbours', () => {
  it('effects at steps {0,2,5} with 1,3,4 never delivered project deterministically, order-independent', () => {
    const present = [ev('wf-1', 0), ev('wf-1', 2), ev('wf-1', 5)];
    const forward = rootOf(present);
    const shuffled = rootOf([present[2], present[0], present[1], present[0]]);
    expect(shuffled).toBe(forward);
    expect(projectEffectEvents(present).canonical.size).toBe(3); // exactly the delivered steps — no phantom 1/3/4
  });

  it('a later-arriving stuck step is simply added; earlier settled steps are untouched', () => {
    const log = new EffectEventLog();
    log.appendAll([ev('wf-1', 0), ev('wf-1', 2)]);
    const before = log.root();
    log.append(ev('wf-1', 1)); // the previously-stuck step finally arrives
    expect(log.root()).not.toBe(before);       // the projection grew
    expect(log.projection().canonical.size).toBe(3);
    // re-deriving from the full stream is still deterministic
    expect(rebuildFromStream(log.stream()).root).toBe(log.root());
  });
});

describe('stale cache — a rebuild from the stream always supersedes a stale root', () => {
  it('a root cached from a PREFIX is stale; the rebuild from the full stream is authoritative', () => {
    const full = [ev('wf-1', 0), ev('wf-1', 1), ev('wf-2', 0)];
    const stalePrefixRoot = rootOf(full.slice(0, 1)); // cached when only the first effect had arrived
    const currentRoot = rootOf(full);
    expect(stalePrefixRoot).not.toBe(currentRoot);      // the stale cache disagrees
    // rebuilding from the protected stream yields the CURRENT root, never the stale one
    expect(rebuildFromStream(full).root).toBe(currentRoot);
  });
});
