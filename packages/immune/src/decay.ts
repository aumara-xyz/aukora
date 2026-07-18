// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * φ-decay relevance law for the immune substrate (R55).
 *
 * WHY THIS FILE EXISTS — resolving the donor's phantom `@aukora/memory/decay.js` import against canonical law:
 * that module never existed in the shipped tree, and `@aukora/memory` defines no decay/φ primitives. The repo's
 * ONE `tilde` is the council glyph-shear operator (`@aukora/council` `aukoraFuGlyph.tilde`) — a *different*
 * operation over GlyphPackets, NOT a string distance. To avoid shipping a SECOND, incompatible `tilde`, this
 * package:
 *   - provides the golden-ratio relevance decay it genuinely needs (`PHI`, `PHI_INV`, `phiDecay`) — the first
 *     φ-relevance-decay in the shipped tree (council's `decayShear` decays a different quantity, glyph shear);
 *   - renames the donor's trigram-distance operator to `trigramDistance` (NOT `tilde`), so `@aukora/council`
 *     remains the one and only `tilde` in the repository.
 *
 * METAPHOR NOTICE: "relevance", "half-life", and "archaeological floor" are metaphors for a bounded exponential
 * weighting. Nothing here is memory, biology, or cognition; it is arithmetic. Advisory only; grants no authority.
 */

/** Golden ratio φ. A mathematical constant (shared with `@aukora/council`'s φ), not a forked law. */
export const PHI = (1 + Math.sqrt(5)) / 2;
/** 1/φ ≈ 0.618 — the permanent relevance floor (a weight never decays fully to zero). */
export const PHI_INV = 1 / PHI;
/** Default half-life for the metaphorical decay (24h in ms). Callers may override. */
export const DEFAULT_HALF_LIFE_MS = 24 * 60 * 60 * 1000;
/** The floor a relevance weight decays toward but never below. */
export const RELEVANCE_FLOOR = PHI_INV;

/**
 * Bounded exponential relevance weight in [PHI_INV, 1.0]:
 *   relevance(t) = max(PHI_INV, initial · φ^(-ageMs / halfLifeMs))
 * A future-dated age returns full relevance; a non-positive half-life returns the floor. Pure; total.
 */
export function phiDecay(ageMs: number, initialRelevance = 1.0, halfLifeMs: number = DEFAULT_HALF_LIFE_MS): number {
  if (ageMs < 0) return initialRelevance;
  if (halfLifeMs <= 0) return RELEVANCE_FLOOR;
  const decayed = initialRelevance * Math.pow(PHI, -ageMs / halfLifeMs);
  return Math.max(RELEVANCE_FLOOR, decayed);
}

/**
 * Trigram (Jaccard) distance between two strings in [0, 1] — 0 identical, 1 fully disjoint. Renamed from the
 * donor's `tilde` so it never shadows council's canonical glyph-shear `tilde`. Pure; total.
 */
export function trigramDistance(a: string, b: string): number {
  const A = trigrams(a);
  const B = trigrams(b);
  if (A.size === 0 && B.size === 0) return 0;
  if (A.size === 0 || B.size === 0) return 1;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  const union = A.size + B.size - inter;
  return 1 - inter / union;
}

function trigrams(content: string): Set<string> {
  const s = content.toLowerCase().replace(/\s+/g, ' ').trim();
  const grams = new Set<string>();
  if (s.length < 3) { if (s.length > 0) grams.add(s); return grams; }
  for (let i = 0; i <= s.length - 3; i++) grams.add(s.slice(i, i + 3));
  return grams;
}

/** HARD: the decay law is pure arithmetic; it grants no authority. */
export function decayGrantsAuthority(): false { return false; }
