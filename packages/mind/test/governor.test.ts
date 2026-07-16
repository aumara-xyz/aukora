// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
// The governor must speak loudly (no-op flags, stagnation streaks, carried memo
// and prediction) and stay environment-agnostic by contract: rules are earned
// generalities, the control prior is labeled weak, nothing is asserted as a
// known mechanic. Ported from the donor battery.
// Re-authored from the ARC-AGI-3 reasoning engine, aukora-symbiote branch
// fable/arc3-reasoning-engine-20260710 @ e5768a2f.
import { describe, expect, it } from 'vitest';
import { GOVERNOR_PROMPT, buildTurnMessage } from '../index.js';

describe('buildTurnMessage — the governor speaks loudly', () => {
  it('flags a no-op as BLOCKED and reports stagnation streaks', () => {
    const m = buildTurnMessage({
      moveNo: 7, movesLeft: 40, frameText: 'FRAME', noopAction: 'ACTION3',
      noopStreakActions: ['ACTION3', 'ACTION1'], memo: 'controls unknown', lastPrediction: 'blue moves left',
    });
    expect(m).toContain('[LAST ACTION = NO-OP] ACTION3');
    expect(m).toContain('BLOCKED');
    expect(m).toContain('[STAGNATION] 2 consecutive no-ops');
    expect(m).toContain('[YOUR MEMO FROM LAST TURN] controls unknown');
    expect(m).toContain('[YOUR LAST PREDICTION] blue moves left');
    expect(m.trim().endsWith('FRAME')).toBe(true);
  });

  it('omits flags that do not apply', () => {
    const m = buildTurnMessage({ moveNo: 1, movesLeft: 80, frameText: 'FRAME' });
    expect(m).not.toContain('NO-OP');
    expect(m).not.toContain('STAGNATION');
    expect(m).not.toContain('MEMO');
  });

  it('carries harness notices ahead of the frame', () => {
    const m = buildTurnMessage({ moveNo: 2, movesLeft: 10, frameText: 'FRAME', notices: ['LEVEL COMPLETE'] });
    expect(m).toContain('[NOTICE] LEVEL COMPLETE');
    expect(m.indexOf('[NOTICE]')).toBeLessThan(m.indexOf('FRAME'));
  });
});

describe('the governor prompt itself — environment-agnostic by contract', () => {
  it('encodes the core governor rules and labels the control prior as weak', () => {
    for (const phrase of ['NO-OP = BLOCKED', 'SEE FIRST', 'ENUMERATE', 'CALIBRATE', 'TOPOLOGY OVER PROXIMITY', 'memo']) {
      expect(GOVERNOR_PROMPT).toContain(phrase);
    }
    // the weak prior is labeled as untrustworthy, not asserted
    expect(GOVERNOR_PROMPT).toContain('Weak prior');
    expect(GOVERNOR_PROMPT).toContain('Trust NOTHING');
  });

  it('keeps the plan and episodic-memory disciplines', () => {
    expect(GOVERNOR_PROMPT).toContain('PLAN DISCIPLINE');
    expect(GOVERNOR_PROMPT).toContain('EPISODIC MEMORY');
    expect(GOVERNOR_PROMPT).toContain('up to 8 FURTHER steps');
  });
});
