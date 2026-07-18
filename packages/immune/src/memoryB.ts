// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * MEMORY B — Learned immune defenses that persist (pure, portable).
 *
 * After a threat is cleared, Memory B cells remember it. They integrate
 * with KIRA memory (φ-decay) — threat memories have a LONG half-life
 * so the system remembers past attacks. Newer threats are recalled faster
 * on re-encounter (immunological memory).
 */

import { PHI, PHI_INV, phiDecay } from './decay.js';
import type { ThreatSignature } from './thymus.js';

/** A memory B cell — learned defense against a specific threat. */
export interface MemoryBCell {
  readonly signatureId: string;
  readonly pattern: string;
  readonly encounterTimestamps: readonly number[];
  readonly lastEncounter: number;
  readonly responseEffectiveness: number;
  readonly halfLifeMs: number;
}

/** Default threat memory half-life: 30 days (much longer than normal memory). */
export const THREAT_MEMORY_HALF_LIFE_MS = 30 * 24 * 60 * 60 * 1000;

/** Create a new memory B cell from a cleared threat. */
export function createMemoryB(
  threat: ThreatSignature,
  responseEffectiveness: number,
  nowMs: number,
): MemoryBCell {
  return {
    signatureId: threat.id,
    pattern: threat.pattern,
    encounterTimestamps: [threat.firstSeen, nowMs],
    lastEncounter: nowMs,
    responseEffectiveness,
    halfLifeMs: THREAT_MEMORY_HALF_LIFE_MS,
  };
}

/** Score how well this memory B cell recognizes a candidate threat. */
export function memoryBRecognition(
  cell: MemoryBCell,
  candidateContent: string,
  nowMs: number,
): number {
  const ageMs = nowMs - cell.lastEncounter;
  const relevance = phiDecay(ageMs, 1.0, cell.halfLifeMs);
  const normalizedCell = cell.pattern.trim().toLowerCase();
  const normalizedCandidate = candidateContent.toLowerCase();
  // FAIL CLOSED on an empty stored pattern — `''` would otherwise substring-match every candidate.
  if (normalizedCell.length === 0) return 0;
  if (normalizedCandidate.includes(normalizedCell)) {
    return relevance * 0.9;
  }
  const cellWords = normalizedCell.split(/\s+/);
  const candidateWords = normalizedCandidate.split(/\s+/);
  const overlap = cellWords.filter(w => candidateWords.includes(w)).length;
  const overlapScore = cellWords.length > 0 ? overlap / cellWords.length : 0;
  return relevance * overlapScore * 0.7;
}

/** Recall memory B cells that recognize a candidate threat. */
export function recallMemoryB(
  cells: readonly MemoryBCell[],
  candidateContent: string,
  nowMs: number,
  threshold: number = 0.1,
): readonly MemoryBCell[] {
  return cells
    .map(c => ({ cell: c, score: memoryBRecognition(c, candidateContent, nowMs) }))
    .filter(r => r.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .map(r => r.cell);
}

/** Reinforce a memory B cell after successful threat response. */
export function reinforceMemoryB(
  cell: MemoryBCell,
  nowMs: number,
  effectiveness: number,
): MemoryBCell {
  const newEffectiveness = Math.min(1, (cell.responseEffectiveness + effectiveness) / 2 + 0.05);
  return {
    ...cell,
    encounterTimestamps: [...cell.encounterTimestamps, nowMs],
    lastEncounter: nowMs,
    responseEffectiveness: newEffectiveness,
  };
}

/** Compute aggregate strength of the memory B repertoire. */
export function memoryStrength(cells: readonly MemoryBCell[]): number {
  if (cells.length === 0) return 0;
  const totalEncounters = cells.reduce((s, c) => s + c.encounterTimestamps.length, 0);
  const avgEffectiveness = cells.reduce((s, c) => s + c.responseEffectiveness, 0) / cells.length;
  return Math.min(1, (totalEncounters * PHI_INV * 0.01) * avgEffectiveness);
}
