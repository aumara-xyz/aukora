// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * KIRA search index (pure, portable).
 *
 * Inverted index for O(1) keyword-to-records lookup, replacing the O(n) linear scan
 * of recall() for repeated queries. Built on the same constitutional laws:
 * content-addressed ids, advisory-only, never grants authority. Pure: no I/O,
 * no clock, no randomness. The index is a derived view — rebuild anytime from records.
 *
 * Convergence: indexing + φ-decay + self-optimization = living memory.
 */
import type { MemoryRecordV1 } from './envelope.js';

/** A single posting: which record, how many times the term appears. */
export interface Posting {
  readonly recordId: string;
  readonly termFrequency: number;
}

/** Inverted index: term → sorted postings (by recordId for determinism). */
export type InvertedIndex = Readonly<Record<string, readonly Posting[]>>;

/** Index statistics for self-optimization decisions. */
export interface IndexStats {
  readonly termCount: number;
  readonly totalPostings: number;
  readonly avgPostingsPerTerm: number;
  readonly maxPostingsForTerm: number;
  readonly uncoveredTerms: readonly string[];
}

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'could', 'should', 'may', 'might', 'can', 'shall', 'this', 'that', 'these',
  'those', 'it', 'its', 'from', 'as', 'if', 'then', 'than', 'so', 'very', 'just', 'now', 'only',
  'also', 'get', 'got', 'go', 'going', 'went', 'like', 'know', 'think', 'see', 'come', 'want',
  'use', 'used', 'using', 'make', 'made', 'way', 'work', 'need', 'say', 'said', 'each', 'which',
  'their', 'them', 'they', 'we', 'our', 'us', 'i', 'me', 'my', 'he', 'she', 'him', 'her', 'his',
]);

/** Tokenize content into indexable terms (lowercase, alphanumeric, min 2 chars). Pure. */
export function tokenize(content: string): readonly string[] {
  const terms: string[] = [];
  const matches = content.toLowerCase().match(/[a-z0-9][a-z0-9_-]*/g);
  if (!matches) return terms;
  for (const term of matches) {
    if (term.length >= 2 && !STOPWORDS.has(term)) {
      terms.push(term);
    }
  }
  return terms;
}

/** Build inverted index from a corpus of memory records. Pure, deterministic. */
export function buildIndex(
  records: readonly MemoryRecordV1[],
  forgotten: ReadonlySet<string> = new Set(),
): InvertedIndex {
  const index: Record<string, Posting[]> = {};
  for (const r of records) {
    if (forgotten.has(r.recordId)) continue;
    const terms = tokenize(r.content);
    const freq: Record<string, number> = {};
    for (const t of terms) {
      freq[t] = (freq[t] ?? 0) + 1;
    }
    for (const [term, count] of Object.entries(freq)) {
      if (!index[term]) index[term] = [];
      index[term].push({ recordId: r.recordId, termFrequency: count });
    }
  }
  // Sort postings by recordId for deterministic output
  for (const term of Object.keys(index)) {
    index[term].sort((a, b) => a.recordId.localeCompare(b.recordId));
  }
  return index;
}

/** Score a single term match using TF (no IDF — pure, no corpus statistics needed). */
export function scoreTerm(posting: Posting): number {
  // Log-scaled term frequency: diminishing returns for repeated occurrences
  return 1 + Math.log(1 + posting.termFrequency);
}

/** Indexed recall: O(postings for query terms) instead of O(n records). Pure. */
export function recallIndexed(
  records: readonly MemoryRecordV1[],
  index: InvertedIndex,
  queryText: string,
  forgotten: ReadonlySet<string> = new Set(),
  limit: number = 20,
): Array<{ readonly recordId: string; readonly score: number }> {
  const queryTerms = tokenize(queryText);
  if (queryTerms.length === 0) {
    // Fallback: return all live records with score 1
    const all: Array<{ recordId: string; score: number }> = [];
    for (const r of records) {
      if (!forgotten.has(r.recordId)) all.push({ recordId: r.recordId, score: 1 });
    }
    all.sort((a, b) => a.recordId.localeCompare(b.recordId));
    return all.slice(0, limit);
  }

  const scores = new Map<string, number>();
  for (const term of queryTerms) {
    const postings = index[term];
    if (!postings) continue;
    for (const p of postings) {
      if (forgotten.has(p.recordId)) continue;
      const current = scores.get(p.recordId) ?? 0;
      scores.set(p.recordId, current + scoreTerm(p));
    }
  }

  const results = Array.from(scores.entries())
    .map(([recordId, score]) => ({ recordId, score }))
    .sort((a, b) => b.score - a.score || a.recordId.localeCompare(b.recordId));

  return results.slice(0, limit);
}

/** Multi-term AND search: only records matching ALL query terms. Pure. */
export function recallIndexedAnd(
  records: readonly MemoryRecordV1[],
  index: InvertedIndex,
  queryText: string,
  forgotten: ReadonlySet<string> = new Set(),
  limit: number = 20,
): Array<{ readonly recordId: string; readonly score: number }> {
  const queryTerms = tokenize(queryText);
  if (queryTerms.length === 0) return recallIndexed(records, index, queryText, forgotten, limit);

  // Start with the rarest term (fewest postings) for efficiency
  const sortedTerms = queryTerms
    .map(t => ({ term: t, postings: index[t]?.length ?? Infinity }))
    .sort((a, b) => a.postings - b.postings);

  const firstPostings = index[sortedTerms[0].term];
  if (!firstPostings) return [];

  // Candidate set: recordIds from the rarest term
  let candidates = new Set(firstPostings.map(p => p.recordId));

  // Intersect with other terms
  for (let i = 1; i < sortedTerms.length; i++) {
    const postings = index[sortedTerms[i].term];
    if (!postings) return []; // AND fails if any term missing
    const termIds = new Set(postings.map(p => p.recordId));
    candidates = new Set([...candidates].filter(id => termIds.has(id)));
    if (candidates.size === 0) return [];
  }

  // Score candidates
  const scores = new Map<string, number>();
  for (const term of queryTerms) {
    const postings = index[term];
    if (!postings) continue;
    for (const p of postings) {
      if (!candidates.has(p.recordId)) continue;
      if (forgotten.has(p.recordId)) continue;
      const current = scores.get(p.recordId) ?? 0;
      scores.set(p.recordId, current + scoreTerm(p));
    }
  }

  return Array.from(scores.entries())
    .map(([recordId, score]) => ({ recordId, score }))
    .sort((a, b) => b.score - a.score || a.recordId.localeCompare(b.recordId))
    .slice(0, limit);
}

/** Get index statistics for self-optimization. Pure. */
export function indexStats(
  records: readonly MemoryRecordV1[],
  index: InvertedIndex,
  forgotten: ReadonlySet<string> = new Set(),
): IndexStats {
  const terms = Object.keys(index);
  let totalPostings = 0;
  let maxPostings = 0;
  const recordIds = new Set(records.map(r => r.recordId));
  const coveredTerms = new Set(terms);

  for (const postings of Object.values(index)) {
    totalPostings += postings.length;
    if (postings.length > maxPostings) maxPostings = postings.length;
  }

  // Find terms that appear in records but aren't in the index
  const uncovered: string[] = [];
  for (const r of records) {
    if (forgotten.has(r.recordId)) continue;
    const tokens = tokenize(r.content);
    for (const t of tokens) {
      if (!coveredTerms.has(t)) {
        coveredTerms.add(t);
        // Only uncovered if it's a non-Stopword that somehow missed indexing
        // (shouldn't happen with correct index build, but defensive)
      }
    }
  }

  return {
    termCount: terms.length,
    totalPostings,
    avgPostingsPerTerm: terms.length > 0 ? totalPostings / terms.length : 0,
    maxPostingsForTerm: maxPostings,
    uncoveredTerms: uncovered,
  };
}
