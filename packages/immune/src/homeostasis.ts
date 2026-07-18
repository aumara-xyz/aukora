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

/** Compute target inflammation level based on current threat status. */
export function computeHomeostasisTarget(
  activeThreats: number,
  criticalThreats: number,
): InflammationLevel {
  if (criticalThreats > 0) return 'crisis';
  if (activeThreats >= 3) return 'high';
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

  const timeSinceClearance = nowMs - state.clearanceTimeMs;
  const cooldownRate = phiDecay(timeSinceClearance, 1.0, 60000);
  const cycleProgress = Math.min(1, cooldownRate * (state.cyclesCompleted + 1));

  if (cycleProgress >= PHI_INV && currentIdx > targetIdx) {
    // De-escalated ONE level. Restart the cooldown clock (clearanceTimeMs = nowMs) so the NEXT level-drop is
    // measured from this transition, not the original clearance — otherwise cyclesCompleted compounds and the
    // cooldown accelerates unboundedly. cooldownProgress resets for the new level.
    return {
      ...state,
      currentLevel: levels[currentIdx - 1],
      clearanceTimeMs: nowMs,
      cooldownProgress: 0,
      cyclesCompleted: state.cyclesCompleted + 1,
    };
  }

  return {
    ...state,
    cooldownProgress: cycleProgress,
    cyclesCompleted: state.cyclesCompleted + 1,
  };
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
