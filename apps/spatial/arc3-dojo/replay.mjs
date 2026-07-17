// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Independent replay verifier (#102) — the falsifiable half of the evidence.
 *
 * Given only a receipt `core`, reconstruct a FRESH donor arcade from the recorded seeds, apply the recorded
 * action sequence, and recompute each frame hash + the terminal from the world itself. The receipt is VALID
 * only if every recomputed frame hash equals the recorded `hashAfter`, the recomputed terminal + level count
 * match, and the initial frame hash matches. This never trusts the recorded hashes — it recomputes them.
 *
 * Therefore: mutating ONE recorded action makes the world diverge → a later hash mismatches → INVALID.
 * Mutating ONE recorded frame hash → the recomputed (correct) hash no longer equals it → INVALID.
 * Mutating the recorded terminal / levelsCompleted → mismatch → INVALID. This is the "mutating one
 * action/frame/receipt must break replay" law, executed rather than asserted.
 *
 * The verifier deliberately uses ONLY the donor arcade + frameHash (not the reasoner), so it is an
 * independent oracle: it replays what the receipt CLAIMS happened, with no access to how it was chosen.
 */
import { createMockArcade } from './donor/mock-arcade.js';
import { frameHash, lastGrid } from './donor/engine.js';

const TERMINAL = new Set(['WIN', 'GAME_OVER']);

export function replayEpisode(core) {
  const problems = [];
  const fail = (mismatchAt, detail) => ({ ok: false, mismatchAt, detail, problems });

  if (!core || core.schema !== 'aukora-arc3-dojo-episode-v1') return fail(-1, 'not an arc3 dojo episode core');
  const { gameId } = core.world ?? {};
  const { arcadeSeed } = core.seeds ?? {};
  if (!gameId || typeof arcadeSeed !== 'number') return fail(-1, 'missing gameId / arcadeSeed');

  const arcade = createMockArcade(arcadeSeed);
  let fr = arcade.reset(gameId);
  const guid = fr.guid;

  // Initial frame hash must match the head of the recorded chain.
  const chain = core.frameHashChain ?? [];
  const h0 = frameHash(lastGrid(fr.frame) ?? [[0]]);
  if (chain[0] !== h0) return fail(0, `initial frame hash ${h0} != recorded ${chain[0]}`);

  let lastState = fr.state === 'NOT_STARTED' ? 'NOT_FINISHED' : fr.state;
  let lastLevels = fr.levels_completed ?? 0;

  const steps = core.steps ?? [];
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (!s || !s.action || typeof s.action.name !== 'string') return fail(i, `step ${i} has no action`);
    fr = arcade.act(gameId, guid, s.action.name, s.action.x, s.action.y);
    const grid = lastGrid(fr.frame) ?? [[0]];
    const recomputed = frameHash(grid);
    if (recomputed !== s.hashAfter) return fail(i, `step ${i} frame hash ${recomputed} != recorded ${s.hashAfter}`);
    if ((chain[i + 1] ?? null) !== recomputed) return fail(i, `step ${i} chain hash ${chain[i + 1]} != recomputed ${recomputed}`);
    const state = fr.state === 'NOT_STARTED' ? 'NOT_FINISHED' : fr.state;
    if (state !== s.state) return fail(i, `step ${i} state ${state} != recorded ${s.state}`);
    if ((fr.levels_completed ?? 0) !== s.levelsCompleted) return fail(i, `step ${i} levels ${fr.levels_completed} != recorded ${s.levelsCompleted}`);
    lastState = state;
    lastLevels = fr.levels_completed ?? 0;
  }

  // Terminal reconciliation against the recorded result.
  const terminal = TERMINAL.has(lastState) ? lastState : 'NOT_FINISHED';
  if (terminal !== core.result.terminal) return fail(steps.length, `terminal ${terminal} != recorded ${core.result.terminal}`);
  if (lastLevels !== core.result.levelsCompleted) return fail(steps.length, `final levels ${lastLevels} != recorded ${core.result.levelsCompleted}`);
  if ((lastState === 'WIN') !== core.result.won) return fail(steps.length, `won ${lastState === 'WIN'} != recorded ${core.result.won}`);

  return { ok: true, mismatchAt: -1, detail: `replayed ${steps.length} steps; terminal ${terminal}`, problems };
}
