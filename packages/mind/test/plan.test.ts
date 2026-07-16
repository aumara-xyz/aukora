// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
// Plans are mind-authored straightaways verified per step by the harness. The
// grammar must be drop-not-fail and bounded, unknown expectations must fail
// safe, and the rigid-move threshold must be ONE law shared by renderDiff's
// mover labeling and checkPlanExpectation's verification (the donor carried an
// asymmetry: >=4 cells for labeling vs >=2 for verification — unified here).
// Re-authored from the ARC-AGI-3 reasoning engine, aukora-symbiote branch
// fable/arc3-reasoning-engine-20260710 @ e5768a2f.
import { describe, expect, it } from 'vitest';
import {
  EXPECT_MAX_CHARS, PLAN_MAX_STEPS, checkPlanExpectation, parseMindReply, renderDiff,
} from '../index.js';

const REPLY = (over: Record<string, unknown> = {}) => JSON.stringify({
  whatISee: 'a blue block', delta: '', hypothesis: 'maze', action: 'ACTION4',
  reason: 'go', prediction: 'blue right', memo: '', ...over,
});

describe('plan parsing — cap, drop, defaults, bounds', () => {
  it('parses a plan of actions with expectations, capped at 8, dropping malformed steps', () => {
    const p = parseMindReply(REPLY({ plan: [
      { action: 'ACTION4', expect: 'moved:9:right' },
      { action: { name: 'ACTION6', x: 3, y: 4 }, expect: 'changed' },
      { action: 'ACTION9' },
      ...Array.from({ length: 10 }, () => ({ action: 'ACTION1' })),
    ] }));
    expect(p.ok).toBe(true);
    if (p.ok) {
      expect(p.plan.length).toBe(PLAN_MAX_STEPS); // cap
      expect(p.plan[0]).toEqual({ action: { name: 'ACTION4' }, expect: 'moved:9:right' });
      expect(p.plan[1].action).toEqual({ name: 'ACTION6', x: 3, y: 4 });
      expect(p.plan[2].expect).toBe('changed'); // default; ACTION9 dropped
    }
  });

  it('reply without a plan yields an empty plan', () => {
    const p = parseMindReply(REPLY());
    expect(p.ok && p.plan.length === 0).toBe(true);
  });

  it('bounds each expectation string at 40 chars', () => {
    const p = parseMindReply(REPLY({ plan: [{ action: 'ACTION1', expect: 'z'.repeat(200) }] }));
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.plan[0].expect.length).toBe(EXPECT_MAX_CHARS);
  });

  it('drops plan steps whose click coordinates are illegal', () => {
    const p = parseMindReply(REPLY({ plan: [
      { action: { name: 'ACTION6', x: 99, y: 2 }, expect: 'any' },
      { action: 'ACTION2', expect: 'any' },
    ] }));
    expect(p.ok).toBe(true);
    if (p.ok) {
      expect(p.plan.length).toBe(1);
      expect(p.plan[0].action.name).toBe('ACTION2');
    }
  });

  it('a non-array plan yields an empty plan, never a failure', () => {
    const p = parseMindReply(REPLY({ plan: 'march right forever' }));
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.plan.length).toBe(0);
  });
});

describe('expectation grammar — verified against real grids, unknown fails safe', () => {
  const a = [[0, 9, 0], [0, 9, 0], [0, 0, 0]];
  const right = [[0, 0, 9], [0, 0, 9], [0, 0, 0]];

  it('verifies movement direction, change, and no-ops', () => {
    expect(checkPlanExpectation('moved:9:right', a, right).ok).toBe(true);
    expect(checkPlanExpectation('moved:9:left', a, right).ok).toBe(false);
    expect(checkPlanExpectation('moved', a, right).ok).toBe(true);
    expect(checkPlanExpectation('changed', a, right).ok).toBe(true);
    expect(checkPlanExpectation('changed', a, a.map((r) => [...r])).ok).toBe(false);
    expect(checkPlanExpectation('any', a, a).ok).toBe(true);
    expect(checkPlanExpectation('sideways', a, right).ok).toBe(false); // unknown expectation fails safe
  });

  it('fails safe with no grids to compare', () => {
    expect(checkPlanExpectation('changed', null, right).ok).toBe(false);
    expect(checkPlanExpectation('moved', a, null).ok).toBe(false);
  });
});

describe('THE unified rigid-move law — one threshold for renderDiff AND checkPlanExpectation', () => {
  it('a 2-cell rigid move is a MOVE on both sides (the donor labeled only at >=4)', () => {
    const prev = [[0, 9, 0], [0, 9, 0], [0, 0, 0]];
    const next = [[0, 0, 9], [0, 0, 9], [0, 0, 0]];
    const d = renderDiff(prev, next);
    expect(d.text).toContain('color 9');
    expect(d.text).toContain('MOVED');
    expect(d.text).toContain('[right]');
    expect(checkPlanExpectation('moved:9:right', prev, next).ok).toBe(true);
  });

  it('a single-cell shift is below the law on both sides', () => {
    const prev = [[0, 9, 0], [0, 0, 0], [0, 0, 0]];
    const next = [[0, 0, 9], [0, 0, 0], [0, 0, 0]];
    const d = renderDiff(prev, next);
    expect(d.changedCount).toBe(2); // it DID change...
    expect(d.text).not.toContain('MOVED'); // ...but no rigid move is labeled
    const c = checkPlanExpectation('moved', prev, next);
    expect(c.ok).toBe(false);
    expect(c.note).toContain('changed but no rigid move');
    expect(checkPlanExpectation('changed', prev, next).ok).toBe(true);
  });

  it('direction is the dominant axis on both sides', () => {
    // 2-cell block of color 9 displaces dx=+2, dy=+1 → 'right' everywhere.
    const prev = [
      [0, 0, 0, 0, 0, 0],
      [0, 9, 9, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
    ];
    const next = [
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 9, 9, 0],
      [0, 0, 0, 0, 0, 0],
    ];
    const d = renderDiff(prev, next);
    expect(d.text).toMatch(/color 9 .* MOVED .*\[right\]/);
    expect(checkPlanExpectation('moved:9:right', prev, next).ok).toBe(true);
    expect(checkPlanExpectation('moved:9:down', prev, next).ok).toBe(false);
  });
});
