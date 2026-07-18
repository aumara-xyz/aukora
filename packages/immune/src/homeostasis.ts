// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * HOMEOSTASIS — Return to normal after threat clearance (pure, portable).
 *
 * After a threat is cleared, inflammation subsides and the system returns
 * to baseline. This is φ-governed cooldown — gradual, never abrupt.
 *
 * Homeostasis is the ONLY way inflammation de-escalates.
 */

import { PHI, PHI_INV, phiDecay } from './decay.js';
import type { InflammationLevel, SecurityPosture } from './inflammation.js';
import { POSTURES } from './inflammation.js';

/** Homeostasis state — tracking cooldown progress. */
export interface HomeostasisState {
  readonly currentLevel: InflammationLevel;
  readonly targetLevel: InflammationLevel;
  readonly clearanceTimeMs: number;
  readonly cooldownProgress: number;
  readonly cyclesCompleted: number;
}

/**
 * Compute the target inflammation level from current threat status. The thresholds MIRROR
 * `computeInflammation` EXACTLY (criticalThreats↔criticalCount, activeThreats↔totalFindings) — otherwise the
 * target can sit ABOVE the current level (e.g. 1 critical → inflammation 'high' but a 'crisis' target) and, since
 * cooldown only de-escalates when current > target, the state machine gets permanently stuck.
 */
export function computeHomeostasisTarget(
  activeThreats: number,
  criticalThreats: number,
): InflammationLevel {
  if (criticalThreats >= 2 || activeThreats >= 10) return 'crisis';
  if (criticalThreats >= 1 || activeThreats >= 3) return 'high';
  if (activeThreats >= 1) return 'elevated';
  return 'baseline';
}

/** Advance homeostasis by one cooldown cycle. φ-governed gradual reduction. */
export function advanceHomeostasis(
  state: HomeostasisState,
  nowMs: number,
): HomeostasisState {
  const levels: InflammationLevel[] = ['baseline', 'elevated', 'high', 'crisis'];
  const currentIdx = levels.indexOf(state.currentLevel);
  const targetIdx = levels.indexOf(state.targetLevel);

  if (currentIdx === targetIdx) {
    return { ...state, cooldownProgress: 1.0 };
  }

  // Cooldown must REQUIRE TIME TO PASS. The old math multiplied a phiDecay value (always ≥ PHI_INV) by
  // cyclesCompleted+1, so `cycleProgress ≥ PHI_INV` was true at timeSinceClearance = 0 → a level dropped on
  // EVERY call regardless of elapsed time. Here progress GROWS 0 → 1 as the φ-decayed threat relevance falls
  // from 1 toward its PHI_INV floor, and a level de-escalates only after at least one half-life has elapsed.
  const HALF_LIFE_MS = 60_000;
  const elapsed = Math.max(0, nowMs - state.clearanceTimeMs);
  const relevance = phiDecay(elapsed, 1.0, HALF_LIFE_MS);            // 1.0 at t=0, → PHI_INV as t→∞
  const cooldownProgress = Math.min(1, (1 - relevance) / (1 - PHI_INV)); // 0 at t=0, monotonically → 1

  if (elapsed >= HALF_LIFE_MS && currentIdx > targetIdx) {
    // One half-life elapsed → de-escalate ONE level and restart the clearance clock for the next drop.
    return {
      ...state,
      currentLevel: levels[currentIdx - 1],
      clearanceTimeMs: nowMs,
      cooldownProgress: 0,
      cyclesCompleted: state.cyclesCompleted + 1,
    };
  }

  // Not enough time yet — report progress toward the next drop; the clock and cycle count are unchanged.
  return { ...state, cooldownProgress };
}

/** Initialize homeostasis state from current inflammation. */
export function initHomeostasis(
  currentLevel: InflammationLevel,
  activeThreats: number,
  criticalThreats: number,
  nowMs: number,
): HomeostasisState {
  return {
    currentLevel,
    targetLevel: computeHomeostasisTarget(activeThreats, criticalThreats),
    clearanceTimeMs: nowMs,
    cooldownProgress: 0,
    cyclesCompleted: 0,
  };
}

/** Get the effective posture considering homeostasis cooldown. */
export function effectivePosture(state: HomeostasisState): SecurityPosture {
  return POSTURES[state.currentLevel];
}
