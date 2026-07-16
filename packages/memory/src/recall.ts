// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * KIRA recall contracts (pure, portable).
 *
 * Deterministic recall over a supplied set of memory records: filter, score, stably order, bound. Governed
 * forgetting is enforced HERE as a read-time rail — a forgotten recordId never appears in recall results and
 * its content is never returned, while the historical receipt chain (held by the app adapter) is NOT rewritten.
 * Pure: no I/O, no clock, no randomness, no mutation of inputs.
 */
import type { MemoryRecordV1, ProvenanceKind } from './envelope.js';

export interface RecallQuery {
  /** Substring/keyword to match against content (case-insensitive). Empty = match all. */
  readonly text?: string;
  readonly kind?: ProvenanceKind;
  /** Max hits (default 20). */
  readonly limit?: number;
}

export interface RecallHit {
  readonly recordId: string;
  readonly createdAt: string;
  readonly kind: ProvenanceKind;
  readonly content: string;
  readonly score: number;
}

/** Deterministic keyword score: term hits, higher for exact/earlier matches. No randomness. */
function scoreOf(content: string, term: string): number {
  if (term.length === 0) return 1;
  const hay = content.toLowerCase();
  const needle = term.toLowerCase();
  let score = 0;
  let idx = hay.indexOf(needle);
  while (idx !== -1) {
    score += 1;
    idx = hay.indexOf(needle, idx + needle.length);
  }
  return score;
}

/**
 * Recall over records, excluding any recordId in `forgotten`. Deterministic: score desc, then createdAt asc,
 * then recordId asc — stable regardless of input order. A forgotten record is invisible and its content is
 * never surfaced (governed forgetting at read time).
 */
export function recall(
  records: readonly MemoryRecordV1[],
  query: RecallQuery,
  forgotten: ReadonlySet<string> = new Set(),
): RecallHit[] {
  const term = query.text ?? '';
  const limit = Number.isInteger(query.limit) && (query.limit as number) > 0 ? (query.limit as number) : 20;
  const hits: RecallHit[] = [];
  for (const r of records) {
    if (forgotten.has(r.recordId)) continue; // forgotten: never recalled
    if (query.kind !== undefined && r.kind !== query.kind) continue;
    const score = scoreOf(r.content, term);
    if (term.length > 0 && score === 0) continue;
    hits.push({ recordId: r.recordId, createdAt: r.createdAt, kind: r.kind, content: r.content, score });
  }
  hits.sort((a, b) =>
    b.score - a.score ||
    a.createdAt.localeCompare(b.createdAt) ||
    a.recordId.localeCompare(b.recordId));
  return hits.slice(0, limit);
}

/** Count of live (non-forgotten) records — the "growth" measure the organism proves increases over time. */
export function liveMemoryCount(records: readonly MemoryRecordV1[], forgotten: ReadonlySet<string> = new Set()): number {
  let n = 0;
  for (const r of records) if (!forgotten.has(r.recordId)) n += 1;
  return n;
}
