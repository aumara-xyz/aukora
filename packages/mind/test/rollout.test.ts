// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
// Rollout is exact lookahead over an INJECTED simulator port: ghost outcomes
// must equal real execution, terminal states must stop the ghost, and the
// donor scoring law must rank wins over level gains over survival with fewer
// steps breaking ties. The simulator here is a tiny pure in-test corridor
// world, deterministic in its seed argument — no engine import anywhere.
// Re-authored from the ARC-AGI-3 reasoning engine, aukora-symbiote branch
// fable/arc3-reasoning-engine-20260710 @ e5768a2f.
import { describe, expect, it } from 'vitest';
import {
  rolloutBest, rolloutPlan,
  type EnvState, type MindAction, type Obs, type PlanStep, type ReplayStep, type Simulator,
} from '../index.js';

// A 1x8 corridor. Agent (color 9) starts at 0; reaching 7 is WIN (one level).
// A hazard (color 8) sits at 3 + (seed % 2); stepping onto it is GAME_OVER.
// ACTION4 = +1 right, ACTION3 = -1 left, ACTION1 = +2 leap. Pure and
// deterministic in the seed argument — no clock, no randomness.
function corridorSim(seed: number): Simulator {
  const hazard = 3 + (seed % 2);
  let pos = 0;
  let state: EnvState = 'NOT_FINISHED';
  let levels = 0;
  const obs = (): Obs => ({
    state,
    levelsCompleted: levels,
    winLevels: 1,
    availableActions: [1, 3, 4],
    grid: [Array.from({ length: 8 }, (_, x) => (x === pos ? 9 : x === hazard ? 8 : 0))],
  });
  return {
    reset(): Obs {
      pos = 0; state = 'NOT_FINISHED'; levels = 0;
      return obs();
    },
    act(action: MindAction): Obs {
      if (state !== 'NOT_FINISHED') return obs();
      const d = action.name === 'ACTION4' ? 1 : action.name === 'ACTION3' ? -1 : action.name === 'ACTION1' ? 2 : 0;
      pos = Math.max(0, Math.min(7, pos + d));
      if (pos === hazard) state = 'GAME_OVER';
      else if (pos === 7) { state = 'WIN'; levels = 1; }
      return obs();
    },
  };
}

const step = (name: MindAction['name'], expect = 'any'): PlanStep => ({ action: { name }, expect });
const RIGHT: ReplayStep = { name: 'ACTION4' };

describe('rolloutPlan — ghost futures over the injected simulator', () => {
  it('is deterministic: the same seed, history, and plan yield the identical outcome', () => {
    const history: ReplayStep[] = [RIGHT];
    const plan = [step('ACTION4'), step('ACTION1')];
    const a = rolloutPlan(corridorSim(5), history, plan);
    const b = rolloutPlan(corridorSim(5), history, plan);
    expect(a).toEqual(b);
  });

  it('the seed argument is the only source of variation', () => {
    // seed 0 puts the hazard at 3: walking right three times dies there.
    // seed 1 puts it at 4: the same walk survives.
    const plan = [step('ACTION4'), step('ACTION4'), step('ACTION4')];
    const dead = rolloutPlan(corridorSim(0), [], plan);
    const alive = rolloutPlan(corridorSim(1), [], plan);
    expect(dead).toEqual({ valid: true, survived: false, won: false, executed: 3, levelsGained: 0, diedAtStep: 3 });
    expect(alive.valid && alive.survived).toBe(true);
  });

  it('ghost outcomes match real execution exactly', () => {
    // real world: two probes on one simulator
    const real = corridorSim(5);
    real.reset();
    real.act({ name: 'ACTION4' });
    const realObs = real.act({ name: 'ACTION1' });
    // ghost: same seed, first probe as history, second as the plan
    const ghost = rolloutPlan(corridorSim(5), [RIGHT], [step('ACTION1')]);
    expect(ghost.valid).toBe(true);
    if (ghost.valid) {
      expect(ghost.executed).toBe(1);
      expect(ghost.survived).toBe(realObs.state !== 'GAME_OVER');
    }
  });

  it('a ghost that reaches WIN or GAME_OVER stops and reports it', () => {
    // seed 0: hazard at 3 — leap it, then run to 7: WIN in 6 steps.
    const winning = [step('ACTION4'), step('ACTION4'), step('ACTION1'), step('ACTION4'), step('ACTION4'), step('ACTION4'), step('ACTION4')];
    const r = rolloutPlan(corridorSim(0), [], winning);
    expect(r).toEqual({ valid: true, survived: true, won: true, executed: 6, levelsGained: 1, diedAtStep: null });
  });

  it('replays RESET steps in history through the simulator', () => {
    // walk two right, reset, then the fatal walk begins from 0 again
    const history: ReplayStep[] = [RIGHT, RIGHT, { name: 'RESET' }];
    const r = rolloutPlan(corridorSim(0), history, [step('ACTION4'), step('ACTION4'), step('ACTION4')]);
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.diedAtStep).toBe(3);
  });

  it('refuses a history that is already terminal', () => {
    const fatal: ReplayStep[] = [RIGHT, RIGHT, RIGHT]; // seed 0: dies on the third step
    const r = rolloutPlan(corridorSim(0), fatal, [step('ACTION4')]);
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toContain('terminal');
  });
});

describe('rolloutBest — the donor scoring law, fresh ghost per candidate', () => {
  it('ranks win > slower win > mere survival > death', () => {
    const fastWin = [step('ACTION4'), step('ACTION4'), step('ACTION1'), step('ACTION4'), step('ACTION4'), step('ACTION4')];
    const slowWin = [step('ACTION4'), step('ACTION4'), step('ACTION1'), step('ACTION4'), step('ACTION3'), step('ACTION4'), step('ACTION4'), step('ACTION4')];
    const survive = [step('ACTION4')];
    const die = [step('ACTION4'), step('ACTION4'), step('ACTION4')];
    const ranked = rolloutBest(() => corridorSim(0), [], [die, survive, slowWin, fastWin]);
    expect(ranked.map((r) => r.index)).toEqual([3, 2, 1, 0]);
    expect(ranked[0].outcome).toMatchObject({ won: true });
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
    expect(ranked[3].score).toBe(-1); // invalid/dead futures score -1
  });

  it('keeps the donor score formula exactly', () => {
    const survive = [step('ACTION4'), step('ACTION4')];
    const [r] = rolloutBest(() => corridorSim(1), [], [survive]);
    // (won?1000:0) + levelsGained*100 + 1 - executed/100
    expect(r.score).toBeCloseTo(0 + 0 + 1 - 2 / 100, 10);
  });
});
