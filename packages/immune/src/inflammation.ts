// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * INFLAMMATION — Elevated security alert state (pure, portable).
 *
 * When a threat is detected, inflammation raises Aukora's security posture:
 * - Council coherence threshold increases (harder to approve)
 * - VK Kronos becomes more restrictive
 * - Patrol frequency increases (more white blood cells)
 * - All decisions require additional verification
 *
 * Homeostasis (homeostasis.ts) brings the system back down after
 * threat clearance.
 */

import { PHI, PHI_INV } from './decay.js';
import { fibonacciEscalation } from './thymus.js';
import type { ThreatSignature } from './thymus.js';

/**
 * RECURSIVELY freeze a value in place — enforce the immutability contract at RUNTIME (TypeScript `readonly` is a
 * compile-time fiction that does not stop a JavaScript consumer or an aliased reference from mutating the graph).
 * Idempotent + cycle-safe (skips already-frozen nodes). Returns the same (now frozen) reference.
 */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v);
  }
  return value;
}

/** Inflammation levels — golden ratio governed. */
export type InflammationLevel = 'baseline' | 'elevated' | 'high' | 'crisis';

/** Security posture adjustments at each inflammation level. */
export interface SecurityPosture {
  readonly level: InflammationLevel;
  readonly coherenceThreshold: number;
  readonly vkKronosStrictness: number;
  readonly patrolFrequency: number;
  readonly verificationRounds: number;
  readonly escalationLevel: number;
}

/** φ-governed security postures. PHI_INV floor ensures minimum security. Deep-frozen so a consumer cannot mutate
 *  the exported posture graph at runtime (the `Readonly<>` type alone does not prevent it). */
export const POSTURES: Readonly<Record<InflammationLevel, SecurityPosture>> = deepFreeze({
  baseline: {
    level: 'baseline',
    coherenceThreshold: PHI_INV,
    vkKronosStrictness: 1.0,
    patrolFrequency: 1,
    verificationRounds: 0,
    escalationLevel: 1,
  },
  elevated: {
    level: 'elevated',
    coherenceThreshold: 0.75,
    vkKronosStrictness: PHI,
    patrolFrequency: 2,
    verificationRounds: 1,
    escalationLevel: 2,
  },
  high: {
    level: 'high',
    coherenceThreshold: 0.85,
    vkKronosStrictness: PHI * PHI,
    patrolFrequency: 3,
    verificationRounds: 2,
    escalationLevel: 5,
  },
  crisis: {
    level: 'crisis',
    coherenceThreshold: 0.95,
    vkKronosStrictness: PHI * PHI * PHI,
    patrolFrequency: 5,
    verificationRounds: 3,
    escalationLevel: 8,
  },
});

/** Compute inflammation level from threat status. */
export function computeInflammation(
  criticalCount: number,
  totalFindings: number,
  previousLevel?: InflammationLevel,
): { level: InflammationLevel; posture: SecurityPosture } {
  // Hysteresis: inflammation only increases automatically
  // Homeostasis must bring it back down
  let level: InflammationLevel;
  if (criticalCount >= 2 || totalFindings >= 10) {
    level = 'crisis';
  } else if (criticalCount >= 1 || totalFindings >= 3) {
    level = 'high';
  } else if (totalFindings >= 1) {
    level = 'elevated';
  } else {
    level = 'baseline';
  }

  // If previously higher, stay there (hysteresis)
  if (previousLevel) {
    const levels: InflammationLevel[] = ['baseline', 'elevated', 'high', 'crisis'];
    const prevIdx = levels.indexOf(previousLevel);
    const currIdx = levels.indexOf(level);
    if (currIdx < prevIdx) {
      level = previousLevel;
    }
  }

  return { level, posture: POSTURES[level] };
}

/** Apply a security posture to council parameters. */
export function applyPostureToCouncil(posture: SecurityPosture): {
  coherenceRequired: number;
  maxRetries: number;
  strictnessMultiplier: number;
} {
  return {
    coherenceRequired: posture.coherenceThreshold,
    maxRetries: posture.verificationRounds + 1,
    strictnessMultiplier: posture.vkKronosStrictness,
  };
}
