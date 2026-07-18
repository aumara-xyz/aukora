// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * THYMUS — Immune cell training and selection (pure, portable).
 *
 * The thymus trains immune cells to distinguish SELF (normal Aukora behavior)
 * from NON-SELF (threats). Like biological T-cell selection:
 * - Positive selection: cells must recognize normal patterns
 * - Negative selection: cells must NOT attack normal patterns
 * - Only cells passing both become mature immune agents
 *
 * Pattern from T3MP3ST: Operator archetype selection.
 * Pattern from Decepticon: Engagement RoE training.
 */

import { PHI, PHI_INV } from './decay.js';

/** A trained immune cell profile. */
export interface ImmuneCell {
  readonly id: string;
  readonly archetype: 'patrol' | 'killer' | 'memory' | 'regulatory';
  readonly selfPatterns: readonly string[];
  readonly threatSignatures: readonly ThreatSignature[];
  readonly maturityScore: number;
  readonly selectionRound: number;
}

/** A known threat signature — like an antibody's antigen recognition. */
export interface ThreatSignature {
  readonly id: string;
  readonly pattern: string;
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly mitreTechnique: string;
  readonly firstSeen: number;
  readonly encounterCount: number;
}

/** Self-pattern: normal Aukora behavior that immune cells must NOT attack. */
export interface SelfPattern {
  readonly pattern: string;
  readonly category: 'memory' | 'council' | 'workflow' | 'identity';
  readonly confidence: number;
}

/** Default self-patterns — what "normal" looks like for Aukora. */
export const DEFAULT_SELF_PATTERNS: readonly SelfPattern[] = [
  { pattern: 'grantsAuthority:false', category: 'memory', confidence: 1.0 },
  { pattern: 'advisoryOnly:true', category: 'memory', confidence: 1.0 },
  { pattern: 'vkKronosDecide', category: 'council', confidence: 1.0 },
  { pattern: 'WorkflowStateV1', category: 'workflow', confidence: 0.9 },
  { pattern: 'AUMLOK', category: 'identity', confidence: 0.9 },
  { pattern: 'content-addressed', category: 'memory', confidence: 0.8 },
  { pattern: 'deterministic', category: 'council', confidence: 0.8 },
  { pattern: 'advisoryOnly', category: 'council', confidence: 1.0 },
  { pattern: 'φ-decay', category: 'memory', confidence: 0.7 },
  { pattern: 'PHI_INV floor', category: 'memory', confidence: 0.7 },
];

/** Positive selection: cell must recognize at least threshold self-patterns. */
export function positiveSelect(
  candidatePatterns: readonly string[],
  selfPatterns: readonly SelfPattern[] = DEFAULT_SELF_PATTERNS,
  threshold: number = 0.15, // ~1/7 of self-patterns must be recognized
): boolean {
  const recognized = selfPatterns.filter(sp =>
    candidatePatterns.some(cp => cp.includes(sp.pattern) || sp.pattern.includes(cp))
  );
  const recognitionRate = recognized.length / selfPatterns.length;
  return recognitionRate >= threshold;
}

/** Negative selection: cell must NOT attack self-patterns. */
export function negativeSelect(
  candidateSignatures: readonly ThreatSignature[],
  selfPatterns: readonly SelfPattern[] = DEFAULT_SELF_PATTERNS,
): { passed: boolean; collisions: readonly string[] } {
  const collisions: string[] = [];
  for (const sig of candidateSignatures) {
    for (const sp of selfPatterns) {
      if (sig.pattern.includes(sp.pattern) || sp.pattern.includes(sig.pattern)) {
        collisions.push(`${sig.id}×${sp.pattern}`);
      }
    }
  }
  return { passed: collisions.length === 0, collisions };
}

/** Train a new immune cell through thymic selection. */
export function trainImmuneCell(
  archetype: ImmuneCell['archetype'],
  candidatePatterns: readonly string[],
  candidateSignatures: readonly ThreatSignature[],
  cellId: string,
  round: number = 1,
): ImmuneCell | null {
  // Positive selection: must recognize self
  if (!positiveSelect(candidatePatterns)) {
    return null;
  }
  // Negative selection: must NOT attack self
  const { passed: negPassed } = negativeSelect(candidateSignatures);
  if (!negPassed) {
    return null;
  }
  // Maturity: how well does this cell know the terrain?
  const maturityScore = Math.min(1, candidatePatterns.length * PHI_INV * 0.1);
  return {
    id: cellId,
    archetype,
    selfPatterns: candidatePatterns,
    threatSignatures: candidateSignatures,
    maturityScore,
    selectionRound: round,
  };
}

/** Batch thymic selection: train multiple candidates, return only mature cells. */
export function thymicSelection(
  candidates: ReadonlyArray<{
    archetype: ImmuneCell['archetype'];
    patterns: readonly string[];
    signatures: readonly ThreatSignature[];
    id: string;
  }>,
): readonly ImmuneCell[] {
  const mature: ImmuneCell[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const cell = trainImmuneCell(c.archetype, c.patterns, c.signatures, c.id, i + 1);
    if (cell) {
      mature.push(cell);
    }
  }
  return mature;
}

/** Fibonacci escalation levels for threat severity → golden ratio governed. */
export const FIBONACCI_LEVELS = [1, 1, 2, 3, 5, 8, 13, 21] as const;

export function fibonacciEscalation(severity: ThreatSignature['severity']): number {
  const map: Record<string, number> = { low: 1, medium: 2, high: 5, critical: 8 };
  return map[severity] ?? 1;
}
