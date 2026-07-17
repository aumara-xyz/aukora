// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * KIRA φ-decay — the SHEAR Engine (pure, portable).
 *
 * Golden ratio (φ ≈ 1.618...) governed memory relevance decay. Each memory has a
 * relevance score that decays exponentially with age, floored at PHI_INV (1/φ ≈ 0.618).
 * The floor ensures memories never fully disappear — they become archaeological layers.
 *
 * The ~ operator: when a contradiction is detected between two memories, it creates
 * a SHEAR object that accelerates decay of the contradicted memory while boosting
 * the contradictor. Differences become objects via the ^ operator.
 *
 * Convergence: φ-decay + indexing + self-optimization = living memory architecture.
 */

/** The golden ratio φ = (1 + √5) / 2. */
export const PHI = (1 + Math.sqrt(5)) / 2;

/** The inverse golden ratio 1/φ = φ - 1 ≈ 0.618... */
export const PHI_INV = 1 / PHI;

/** φ² = φ + 1 ≈ 2.618... */
export const PHI_SQUARED = PHI + 1;

/** Default half-life in milliseconds (24 hours). */
export const DEFAULT_HALF_LIFE_MS = 24 * 60 * 60 * 1000;

/** Minimum relevance floor — memories never decay below this. */
export const RELEVANCE_FLOOR = PHI_INV;

/** A memory's decay envelope: tracks when it was created and its current relevance. */
export interface DecayEnvelope {
  readonly recordId: string;
  readonly createdAtMs: number;
  readonly initialRelevance: number;
  readonly halfLifeMs: number;
  /** Contradiction objects that modify this memory's decay. */
  readonly shearObjects: readonly ShearObject[];
}

/** A SHEAR object: evidence that contradicts a memory, accelerating its decay. */
export interface ShearObject {
  readonly id: string;
  /** When the contradiction was detected. */
  readonly createdAtMs: number;
  /** Magnitude of contradiction [0, 1]. Higher = faster decay. */
  readonly magnitude: number;
  /** The ~ operator applied: which memory is contradicting. */
  readonly contradictorId: string;
}

/** Relevance score in [PHI_INV, 1.0]. */
export interface RelevanceScore {
  readonly recordId: string;
  readonly relevance: number;
  readonly ageMs: number;
  readonly shearCount: number;
  /** Whether the memory has been touched by contradiction. */
  readonly sheared: boolean;
}

/**
 * Compute φ-governed exponential decay. Pure: no ambient clock.
 *
 * relevance(t) = max(PHI_INV, initial * φ^(-t / halfLife))
 *
 * The φ base means decay follows the golden ratio — nature's preferred damping.
 * The PHI_INV floor ensures memories never fully vanish (archaeological layer).
 */
export function phiDecay(
  ageMs: number,
  initialRelevance: number = 1.0,
  halfLifeMs: number = DEFAULT_HALF_LIFE_MS,
): number {
  if (ageMs < 0) return initialRelevance; // Future-dated = full relevance
  if (halfLifeMs <= 0) return RELEVANCE_FLOOR; // Invalid half-life = floor

  const exponent = -ageMs / halfLifeMs;
  const decayed = initialRelevance * Math.pow(PHI, exponent);
  return Math.max(RELEVANCE_FLOOR, decayed);
}

/**
 * The ~ (tilde/shear) operator: measure cognitive distance between two memory contents.
 * Returns [0, 1] where 0 = identical, 1 = completely different.
 * Based on token set overlap (Jaccard distance on trigrams).
 */
export function tilde(contentA: string, contentB: string): number {
  const trigramsA = trigrams(contentA);
  const trigramsB = trigrams(contentB);

  if (trigramsA.size === 0 && trigramsB.size === 0) return 0;
  if (trigramsA.size === 0 || trigramsB.size === 0) return 1;

  const intersection = new Set([...trigramsA].filter(x => trigramsB.has(x)));
  const union = new Set([...trigramsA, ...trigramsB]);

  // Jaccard distance = 1 - similarity
  return 1 - intersection.size / union.size;
}

/** Extract character trigrams from content. Pure. */
function trigrams(content: string): Set<string> {
  const normalized = content.toLowerCase().replace(/\s+/g, ' ').trim();
  const grams = new Set<string>();
  for (let i = 0; i <= normalized.length - 3; i++) {
    grams.add(normalized.substring(i, i + 3));
  }
  return grams;
}

/**
 * The ^ (carat/difference) operator: differences become objects.
 * When two memories contradict, the difference IS the new memory content.
 */
export function carat(contentA: string, contentB: string): string {
  const diff = tilde(contentA, contentB);
  if (diff < 0.3) return `alignment: near-match (${diff.toFixed(3)})`;
  if (diff < 0.7) return `tension: partial-contradiction (${diff.toFixed(3)}) between "${contentA.slice(0, 40)}" and "${contentB.slice(0, 40)}"`;
  return `contradiction: full-shear (${diff.toFixed(3)}) "${contentA.slice(0, 40)}" vs "${contentB.slice(0, 40)}"`;
}

/**
 * Apply shear to a decay envelope: a contradiction accelerates decay.
 * Each shear object multiplies relevance by (1 - magnitude * PHI_INV).
 */
export function applyShear(
  envelope: DecayEnvelope,
  nowMs: number,
): number {
  const baseRelevance = phiDecay(nowMs - envelope.createdAtMs, envelope.initialRelevance, envelope.halfLifeMs);

  let shearedRelevance = baseRelevance;
  for (const shear of envelope.shearObjects) {
    const shearAgeMs = nowMs - shear.createdAtMs;
    if (shearAgeMs < 0) continue; // Future shear not yet active
    // Shear decays its own effect over time too
    const activeMagnitude = shear.magnitude * phiDecay(shearAgeMs, 1.0, envelope.halfLifeMs);
    shearedRelevance *= (1 - activeMagnitude * PHI_INV);
  }

  return Math.max(RELEVANCE_FLOOR, shearedRelevance);
}

/**
 * Create a SHEAR object from two contradicting memories.
 * The ~ operator determines the contradiction magnitude.
 */
export function createShear(
  contradictorId: string,
  contradictorContent: string,
  contradictedId: string,
  contradictedContent: string,
  nowMs: number,
): ShearObject {
  const magnitude = Math.min(1, tilde(contradictorContent, contradictedContent));
  return {
    id: `shear_${contradictorId.slice(0, 8)}_${contradictedId.slice(0, 8)}_${nowMs}`,
    createdAtMs: nowMs,
    magnitude,
    contradictorId,
  };
}

/** Score a batch of memories by relevance. Pure — caller supplies nowMs. */
export function scoreRelevance(
  envelopes: readonly DecayEnvelope[],
  nowMs: number,
): readonly RelevanceScore[] {
  return envelopes.map(e => {
    const relevance = applyShear(e, nowMs);
    return {
      recordId: e.recordId,
      relevance,
      ageMs: nowMs - e.createdAtMs,
      shearCount: e.shearObjects.length,
      sheared: e.shearObjects.length > 0,
    };
  });
}

/** Sort memories by relevance (highest first), breaking ties by age (newest first). Pure. */
export function sortByRelevance(
  scores: readonly RelevanceScore[],
): readonly RelevanceScore[] {
  return [...scores].sort((a, b) =>
    b.relevance - a.relevance ||
    a.ageMs - b.ageMs ||
    a.recordId.localeCompare(b.recordId));
}

/** Build decay envelopes from memory records with default parameters. Pure. */
export function buildEnvelopes(
  recordIds: readonly string[],
  createdAtMsMap: Readonly<Record<string, number>>,
  halfLifeMs: number = DEFAULT_HALF_LIFE_MS,
): readonly DecayEnvelope[] {
  return recordIds.map(id => ({
    recordId: id,
    createdAtMs: createdAtMsMap[id] ?? 0,
    initialRelevance: 1.0,
    halfLifeMs,
    shearObjects: [],
  }));
}
