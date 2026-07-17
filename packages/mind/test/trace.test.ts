// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
// The house invariant, pinned: every trace payload the mind can author is
// advisory-only JSON — it never carries authority, and it survives a JSON
// round-trip unchanged (plain objects, no hidden state).
// Re-authored from the ARC-AGI-3 reasoning engine, aukora-symbiote branch
// fable/arc3-reasoning-engine-20260710 @ e5768a2f.
import { describe, expect, it } from 'vitest';
import {
  buildCouncilTrace, buildMoveTrace, buildPlanMoveTrace, buildRolloutRejectTrace,
  buildStartTrace, buildSummaryTrace, mindGrantsAuthority, type MindTraceRow,
} from '../index.js';

describe('trace payloads — advisory by construction', () => {
  const rows: MindTraceRow[] = [
    buildStartTrace({ runId: 'r1', environmentId: 'corridor', maxMoves: 80, maxResets: 3, windowPairs: 5 }),
    buildMoveTrace({
      move: 1, action: 'ACTION4', noop: false, state: 'NOT_FINISHED', levelsCompleted: 0,
      whatISee: 'a corridor', delta: '', hypothesis: 'maze', reason: 'probe right',
      prediction: 'blue right', memo: '4=right?', planLength: 0,
    }),
    buildPlanMoveTrace({ move: 2, action: 'ACTION4', expect: 'moved:9:right', ok: true, note: 'matched', state: 'NOT_FINISHED', levelsCompleted: 0 }),
    buildCouncilTrace({ afterMove: 9, deathsThisLevel: 2, advice: ['the red pixel is a gaze'] }),
    buildRolloutRejectTrace({ move: 4, outcome: { valid: true, survived: false, won: false, executed: 3, levelsGained: 0, diedAtStep: 3 } }),
    buildSummaryTrace({ runId: 'r1', environmentId: 'corridor', won: true, state: 'WIN', levelsCompleted: 1, winLevels: 1, moves: 12, resets: 1, planMoves: 4 }),
  ];

  it('every row kind carries the containment literals', () => {
    expect(rows.map((r) => r.kind)).toEqual(['start', 'move', 'plan_move', 'council', 'rollout_reject', 'summary']);
    for (const row of rows) {
      expect(row.advisoryOnly).toBe(true);
      expect(row.grantsAuthority).toBe(false);
    }
  });

  it('every row is plain JSON (round-trips unchanged)', () => {
    for (const row of rows) {
      expect(JSON.parse(JSON.stringify(row))).toEqual(row);
    }
  });

  it('the mind can never grant authority', () => {
    expect(mindGrantsAuthority()).toBe(false);
  });
});
