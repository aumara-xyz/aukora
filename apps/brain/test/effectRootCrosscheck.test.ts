// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Anti-drift lock: the node-importable root formula (scripts/lib/effectRoot.mjs, used by the live canary) MUST
 * produce results IDENTICAL to the TS law (src/effectEvent.ts). If either drifts, this fails.
 */
import { describe, it, expect } from 'vitest';
import {
  makeEffectEvent,
  deriveEffectId as tsDeriveEffectId,
  effectPayloadHash as tsEffectPayloadHash,
  projectEffectEvents, effectProjectionRoot as tsProjectionRoot,
} from '../src/effectEvent.js';
// @ts-expect-error — plain .mjs shared with the live canary
import { deriveEffectId as mjsDeriveEffectId, effectPayloadHash as mjsEffectPayloadHash, projectionRoot as mjsProjectionRoot } from '../scripts/lib/effectRoot.mjs';

const AT = '2026-07-18T01:30:00.000Z';
const ev = (key: string, step: number, effect = 'step-effect-applied') => makeEffectEvent(key, step, effect, AT)!;

describe('effectRoot.mjs ≡ effectEvent.ts (no drift between the live canary and the law)', () => {
  it('deriveEffectId matches for many keys/steps', () => {
    for (const key of ['wf-1', 'wf-2', 'a very long rehearsal key ' + 'x'.repeat(40)]) {
      for (const step of [0, 1, 7, 42]) {
        expect(mjsDeriveEffectId(key, step)).toBe(tsDeriveEffectId(key, step));
      }
    }
  });

  it('effectPayloadHash matches', () => {
    const e = ev('wf-1', 0);
    expect(mjsEffectPayloadHash(e)).toBe(tsEffectPayloadHash(e));
  });

  it('projectionRoot matches over a mixed stream (dups + a conflict + several effects)', () => {
    const evs = [ev('wf-1', 0), ev('wf-1', 0), ev('wf-1', 1), ev('wf-2', 0), ev('wf-3', 0)];
    const tsRoot = tsProjectionRoot(projectEffectEvents(evs));
    const mjsRoot = mjsProjectionRoot(evs);
    expect(mjsRoot).toBe(tsRoot);
  });

  it('an empty stream yields the same root on both', () => {
    expect(mjsProjectionRoot([])).toBe(tsProjectionRoot(projectEffectEvents([])));
  });
});
