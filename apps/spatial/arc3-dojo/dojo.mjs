// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * ARC-3 Dojo adapter (#102) — the smallest isolated adapter that runs the donor's scrambled onboard
 * ARC-3-compatible worlds and emits replayable, content-addressed evidence. NO third reasoning engine:
 *
 *   - WORLD + PERCEPTION + POLICY = the donor line `fable/arc3-reasoning-engine-20260710 @ e5768a2f`,
 *     transplanted BYTE-EXACT under ./donor (createMockArcade + Reasoner + frameHash + normalizeObs).
 *     The arcade scrambles its control mapping per seed, so the reasoner must EARN "ACTION1 = up".
 *   - REASONING-LOOP CORE = the already-merged `@aukora/mind` (re-authored from the same donor line):
 *     renderFrame (the bounded perception the mind sees), normalizeAction (canonicalize the action into the
 *     mind's one action vocabulary), checkPlanExpectation (the mind's per-step reality check).
 *
 * HONESTY RULE (donor's, kept verbatim in spirit): these onboard worlds are NOT the ARC-AGI-3 benchmark.
 * They exist so the loop is verifiable end-to-end. A run here is labelled `ONBOARD_ARC3_COMPATIBLE` and is
 * NEVER an official ARC-AGI-3 win. Wins AND losses are recorded honestly — the replay is the proof, not the
 * outcome.
 *
 * Everything here is deterministic given (arcadeSeed, gameId, policySeed, maxSteps): no clock, no network,
 * no randomness of our own. The one non-deterministic donor value — the session `guid` (Math.random) — is
 * carried OUTSIDE the hashed core so replay stays exact.
 */
import { createMockArcade } from './donor/mock-arcade.js';
import { Reasoner, normalizeObs, frameHash, lastGrid } from './donor/engine.js';
import { renderFrame, checkPlanExpectation, normalizeAction } from '@aukora/mind';
import { coreHash } from './lib/hash.mjs';

export const DOJO_SCHEMA = 'aukora-arc3-dojo-episode-v1';
export const LABEL = 'ONBOARD_ARC3_COMPATIBLE';
/** The donor line this dojo runs (recorded in every receipt for provenance). */
export const DONOR_CODE = Object.freeze({
  branch: 'fable/arc3-reasoning-engine-20260710',
  commit: 'e5768a2fcf974a564ef842551a27bbb6287e6c8b',
  files: {
    'engine.js': '7bf144617741700350b9750f68bf9104e84e5ffc',       // git blob sha (byte-identity vs donor)
    'mock-arcade.js': 'a609716a15a3d3ce75d3c63db470c1eb6a85e652',
  },
});

const TERMINAL = new Set(['WIN', 'GAME_OVER']);

/** The mind sees only what the Obs port allows; adapt the donor observation to the @aukora/mind shape. */
function toMindObs(donorObs) {
  return {
    state: donorObs.state === 'NOT_STARTED' ? 'NOT_FINISHED' : donorObs.state,
    levelsCompleted: donorObs.levelsCompleted,
    winLevels: donorObs.winLevels,
    availableActions: donorObs.availableActions,
    grid: donorObs.grid ?? [],
    segments: donorObs.segments ?? null,
  };
}

/** Donor Decision → the mind's one action vocabulary (ACTION1..5 simple, ACTION6 click with x/y). */
function decisionToMindAction(d) {
  if (d.kind === 'click') return { name: 'ACTION6', x: d.x, y: d.y };
  return { name: `ACTION${d.actionId}` };
}

/**
 * Run one episode. Returns the deterministic episode receipt (a `coreHash`-addressed core) plus the
 * out-of-core envelope (guid + fingerprint). `maxSteps` bounds the run for failure containment.
 */
export function runEpisode({ arcadeSeed = 42, gameId, policySeed = 7, maxSteps = 400 } = {}) {
  if (!gameId) throw new Error('runEpisode: gameId is required');
  const arcade = createMockArcade(arcadeSeed);
  let fr = arcade.reset(gameId);
  const guid = fr.guid; // Math.random session key — OUT of the hashed core
  let donorObs = normalizeObs(fr);
  const reasoner = new Reasoner({ seed: policySeed });
  reasoner.begin(donorObs);

  const steps = [];
  const frameHashChain = [frameHash(lastGrid(fr.frame) ?? [[0]])];
  let prevGrid = null;
  let normalizeRejections = 0;

  let i = 0;
  for (; i < maxSteps && !TERMINAL.has(donorObs.state); i++) {
    const mindObs = toMindObs(donorObs);
    // The mind's bounded perception of the current frame (grid + regions + diff from the previous frame).
    const perception = renderFrame(mindObs, prevGrid);

    // The donor line decides (model-free, deterministic policy over the scrambled world).
    const decision = reasoner.decide(donorObs);
    const proposed = decisionToMindAction(decision);
    // The mind canonicalizes the action into its one vocabulary; a null is a real adapter finding.
    const normalized = normalizeAction(proposed);
    if (normalized === null) normalizeRejections++;
    const action = normalized ?? proposed;

    const beforeGrid = donorObs.grid;
    const hashBefore = frameHash(beforeGrid ?? [[0]]);
    fr = arcade.act(gameId, guid, action.name, action.x, action.y);
    const nextDonorObs = normalizeObs(fr);
    const afterGrid = nextDonorObs.grid ?? [[0]];
    const hashAfter = frameHash(afterGrid);

    // The mind's per-step reality check: did the frame change as a bounded expectation predicts?
    const check = checkPlanExpectation('changed', beforeGrid, afterGrid);
    // Keep the donor reasoner's calibration state advancing (self-color, direction map, budget, graph).
    reasoner.observe(donorObs, decision, nextDonorObs);

    steps.push({
      step: i,
      action: action.name === 'ACTION6' ? { name: 'ACTION6', x: action.x, y: action.y } : { name: action.name },
      reason: String(decision.reason ?? '').slice(0, 120),
      tag: String(decision.tag ?? '').slice(0, 32),
      expectation: 'changed',
      expectationMet: check.ok,
      changedCells: perception.changedCount,
      hashBefore,
      hashAfter,
      state: nextDonorObs.state,
      levelsCompleted: nextDonorObs.levelsCompleted,
    });
    frameHashChain.push(hashAfter);

    prevGrid = beforeGrid;
    donorObs = nextDonorObs;
  }

  const terminal = TERMINAL.has(donorObs.state) ? donorObs.state : 'NOT_FINISHED';
  const won = donorObs.state === 'WIN';

  const core = {
    schema: DOJO_SCHEMA,
    label: LABEL,
    donorCode: DONOR_CODE,
    world: { gameId, winLevels: donorObs.winLevels, version: 'onboard-arcade-v1' },
    seeds: { arcadeSeed, policySeed },
    budget: { maxSteps },
    result: {
      terminal,
      won,
      levelsCompleted: donorObs.levelsCompleted,
      steps: steps.length,
      exhaustedBudget: !TERMINAL.has(donorObs.state) && i >= maxSteps,
      normalizeRejections,
    },
    // The bounded per-step trace + the frame-hash chain are the replayable spine.
    steps,
    frameHashChain,
  };
  return { core, coreHash: coreHash(core), guid };
}
