// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * ANTIBODY — Signature-based threat recognition (pure, portable).
 *
 * Antibodies recognize specific pathogen signatures. When a new threat
 * is encountered, the system generates antibodies (signatures) against it.
 * On re-encounter, the antibody binds instantly — no learning needed.
 *
 * This is the FAST path of the immune system. Memory B cells provide
 * the SLOW path (learned, adaptive). Together they give both speed
 * and adaptability.
 */

import type { ThreatSignature } from './thymus.js';

/** An antibody — a content-addressed threat signature. */
export interface Antibody {
  readonly id: string;
  readonly antigenPattern: string;
  readonly bindScore: number;
  readonly originThreatId: string;
  readonly generationTimestampMs: number;
  readonly bindCount: number;
}

/** Generate an antibody from a threat signature. */
export function generateAntibody(
  threat: ThreatSignature,
  nowMs: number,
): Antibody {
  return {
    id: `ab_${threat.id}`,
    antigenPattern: threat.pattern,
    bindScore: 0.85, // fresh antibody — room for affinity maturation
    originThreatId: threat.id,
    generationTimestampMs: nowMs,
    bindCount: 0,
  };
}

/** Test if an antibody binds to candidate content. */
export function antibodyBind(
  antibody: Antibody,
  candidateContent: string,
): { binds: boolean; confidence: number } {
  const normalizedPattern = antibody.antigenPattern.trim().toLowerCase();
  const normalizedContent = candidateContent.toLowerCase();

  // An EMPTY antigen pattern binds nothing — never every candidate (`''.includes` / `includes('')` would).
  if (normalizedPattern.length === 0) return { binds: false, confidence: 0 };

  // Exact substring match: highest confidence
  if (normalizedContent.includes(normalizedPattern)) {
    return { binds: true, confidence: antibody.bindScore };
  }

  // Partial match: UNIQUE word-level overlap (a Set on both sides — duplicate content words can never inflate
  // overlapScore beyond 1, so confidence = bindScore·overlapScore stays within [0, bindScore] ⊆ [0, 1]).
  const patternWords = new Set(normalizedPattern.split(/\s+/).filter(Boolean));
  const contentWords = new Set(normalizedContent.split(/\s+/).filter(Boolean));
  if (patternWords.size === 0) return { binds: false, confidence: 0 };
  let matched = 0;
  for (const w of patternWords) if (contentWords.has(w)) matched++;
  const overlapScore = matched / patternWords.size; // ∈ [0, 1]

  if (overlapScore > 0.7) {
    return { binds: true, confidence: antibody.bindScore * overlapScore };
  }

  return { binds: false, confidence: 0 };
}

/** Find all antibodies that bind to candidate content. */
export function findBindingAntibodies(
  antibodies: readonly Antibody[],
  candidateContent: string,
  threshold: number = 0.5,
): readonly { antibody: Antibody; confidence: number }[] {
  const results: { antibody: Antibody; confidence: number }[] = [];
  for (const ab of antibodies) {
    const { binds, confidence } = antibodyBind(ab, candidateContent);
    if (binds && confidence >= threshold) {
      results.push({ antibody: ab, confidence });
    }
  }
  return results.sort((a, b) => b.confidence - a.confidence);
}

/** Reinforce an antibody after successful binding (affinity maturation). */
export function reinforceAntibody(ab: Antibody): Antibody {
  const newBindScore = Math.min(1, ab.bindScore * 1.05);
  return {
    ...ab,
    bindScore: newBindScore,
    bindCount: ab.bindCount + 1,
  };
}

/** Seroconversion: has the system developed antibodies to a threat class? */
export function hasSeroconverted(
  antibodies: readonly Antibody[],
  threatPattern: string,
): boolean {
  // FAIL CLOSED on an empty requested pattern — `''` would otherwise match every antigen with any bind.
  const needle = threatPattern.trim().toLowerCase();
  if (needle.length === 0) return false;
  return antibodies.some(ab =>
    ab.antigenPattern.toLowerCase().includes(needle) &&
    ab.bindCount > 0
  );
}
