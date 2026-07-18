// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * KILLER T — Specialized threat response agents (pure, portable).
 *
 * When a specific threat type is identified, Killer T cells are dispatched
 * to eliminate it. Different archetypes for different threat types:
 * - Cytotoxic: destroys infected/compromised content
 * - Helper: coordinates the immune response (inflammation, memory B)
 * - Suppressor: dampens overactive responses (prevents autoimmunity)
 */

import type { ThreatSignature, ImmuneCell } from './thymus.js';
import type { DefensiveAction } from './engagement.js';

/** Killer T cell archetypes. */
export type KillerTType = 'cytotoxic' | 'helper' | 'suppressor';

/** A Killer T cell — specialized for a specific threat. */
export interface KillerT {
  readonly id: string;
  readonly type: KillerTType;
  readonly targetThreatId: string;
  readonly actions: readonly DefensiveAction[];
  readonly effectiveness: number;
  readonly spawnTimestampMs: number;
}

/** Archetype profiles — what each Killer T type does. */
export const KILLER_T_PROFILES: Readonly<Record<KillerTType, {
  actions: readonly DefensiveAction[];
  description: string;
  maxEffectiveness: number;
}>> = {
  cytotoxic: {
    actions: ['quarantine_content', 'block_egress', 'alert_log'],
    description: 'Destroys compromised content. Direct action against threats.',
    maxEffectiveness: 0.95,
  },
  helper: {
    actions: ['elevate_inflammation', 'council_report', 'signature_update', 'force_diversity'],
    description: 'Coordinates the immune response. Raises alarms, updates signatures.',
    maxEffectiveness: 0.85,
  },
  suppressor: {
    actions: ['patrol_scan', 'memory_snapshot'],
    description: 'Prevents autoimmunity. Monitors for overreaction, preserves normal function.',
    maxEffectiveness: 0.75,
  },
};

/** Select the best Killer T type for a given threat. */
export function selectKillerTType(threat: ThreatSignature): KillerTType {
  if (threat.severity === 'critical') return 'cytotoxic';
  if (threat.severity === 'high') return 'helper';
  return 'suppressor';
}

/** Spawn a new Killer T cell targeting a specific threat. */
export function spawnKillerT(
  threat: ThreatSignature,
  cellId: string,
  nowMs: number,
): KillerT {
  const type = selectKillerTType(threat);
  const profile = KILLER_T_PROFILES[type];
  // Effectiveness increases with threat maturity (more encounters = better targeting)
  const maturityBonus = Math.min(0.2, threat.encounterCount * 0.02);
  const effectiveness = profile.maxEffectiveness * (0.8 + maturityBonus);

  return {
    id: cellId,
    type,
    targetThreatId: threat.id,
    actions: [...profile.actions],
    effectiveness,
    spawnTimestampMs: nowMs,
  };
}

/** Execute a Killer T cell against its target threat. */
export function executeKillerT(
  killer: KillerT,
  threat: ThreatSignature,
): { threatNeutralized: boolean; actionsTaken: readonly DefensiveAction[] } {
  // TARGET IDENTITY: a Killer T cell acts ONLY against the exact threat it was spawned for. An unrelated threat
  // is refused — it can never report neutralization (and only logs), so a mismatched pairing has no effect.
  if (threat.id !== killer.targetThreatId) {
    return { threatNeutralized: false, actionsTaken: ['alert_log'] };
  }

  const effectivenessThreshold = threat.severity === 'critical' ? 0.9 :
    threat.severity === 'high' ? 0.7 : 0.5;

  const neutralized = killer.effectiveness >= effectivenessThreshold;

  return {
    threatNeutralized: neutralized,
    actionsTaken: neutralized ? killer.actions : ['alert_log'],
  };
}

/** Check if a Killer T action would attack self-patterns (autoimmunity). */
export function checkAutoimmunity(
  killer: KillerT,
  selfPatterns: readonly string[],
): { autoImmune: boolean; collisions: readonly string[] } {
  const collisions: string[] = [];
  for (const action of killer.actions) {
    for (const sp of selfPatterns) {
      if (sp.length === 0) continue; // an empty self-pattern would make `action.includes('')` classify EVERY action autoimmune
      if (action.includes(sp) || sp.includes(action)) {
        collisions.push(`${action}×${sp}`);
      }
    }
  }
  return { autoImmune: collisions.length > 0, collisions };
}
