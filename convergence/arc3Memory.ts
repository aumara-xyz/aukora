// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * ARC-3 General Reasoning Engine for Memory (pure, portable).
 *
 * ARC-3 is not just a puzzle solver — it's a general reasoning engine that reasons
 * ABOUT memory. It solves analogy problems between memories, finds transformation
 * patterns, and applies structural isomorphism across domains.
 *
 * The 7 Principles:
 * P1: Structural Isomorphism — Same structure implies same solution
 * P2: Transformation Closure — Operations compose predictably
 * P3: Edge Conservation — Boundary conditions preserve invariants
 * P4: Color Invariance — Labels are arbitrary
 * P5: Symmetry Exploitation — Symmetries reduce search space
 * P6: Locality Principle — Nearby elements influence each other
 * P7: Compositional Reasoning — Complex = simple parts composed
 *
 * Convergence: ARC-3 + council + swarm = one distributed reasoning organism.
 */

import type { MemoryRecordV1 } from '../../memory/src/envelope.js';
import { tilde } from '../../memory/src/decay.js';

// ─── 7 Principles ─────────────────────────────────────────────────────────────

export interface Principle {
  readonly id: string;
  readonly name: string;
  readonly description: string;
}

export const PRINCIPLES: readonly Principle[] = [
  { id: 'P1', name: 'Structural Isomorphism', description: 'Same structure implies same solution' },
  { id: 'P2', name: 'Transformation Closure', description: 'Operations compose predictably' },
  { id: 'P3', name: 'Edge Conservation', description: 'Boundary conditions preserve invariants' },
  { id: 'P4', name: 'Color Invariance', description: 'Labels are arbitrary — semantics matter' },
  { id: 'P5', name: 'Symmetry Exploitation', description: 'Symmetries reduce search space' },
  { id: 'P6', name: 'Locality Principle', description: 'Nearby elements influence each other' },
  { id: 'P7', name: 'Compositional Reasoning', description: 'Complex = simple parts composed' },
];

// ─── Memory Analogy Problem ───────────────────────────────────────────────────

/**
 * A memory analogy: A is to B as C is to ?
 * The engine finds the transformation from A→B and applies it to C.
 */
export interface MemoryAnalogy {
  readonly memoryA: MemoryRecordV1;
  readonly memoryB: MemoryRecordV1;
  readonly memoryC: MemoryRecordV1;
  readonly predictedTransformation: string;
  readonly confidence: number;
}

/** Transformation between two memories. Pure. */
export interface Transformation {
  readonly type: 'identity' | 'generalization' | 'specialization' | 'contradiction' | 'composition' | 'analogy';
  readonly description: string;
  readonly tildeScore: number; // cognitive distance
  readonly principlesApplied: readonly string[];
}

// ─── Pattern Detection ────────────────────────────────────────────────────────

/** Detect the transformation pattern between two memories. Pure. */
export function detectTransformation(a: MemoryRecordV1, b: MemoryRecordV1): Transformation {
  const dist = tilde(a.content, b.content);

  // Identity check
  if (dist < 0.05) {
    return {
      type: 'identity',
      description: 'Identical content (within tolerance)',
      tildeScore: dist,
      principlesApplied: ['P1'],
    };
  }

  // Contradiction check — HIGH cognitive distance means conflicting memories
  // Checked BEFORE specialization/generalization because contradiction
  // can coexist with some word overlap (e.g., "X is 5" vs "X is 999")
  if (dist > 0.6) {
    return {
      type: 'contradiction',
      description: `Contradiction detected: "${a.content.slice(0, 30)}" vs "${b.content.slice(0, 30)}"`,
      tildeScore: dist,
      principlesApplied: ['P3', 'P7'],
    };
  }

  // Composition check (one contains the other)
  const aLower = a.content.toLowerCase();
  const bLower = b.content.toLowerCase();
  if (aLower.includes(bLower) || bLower.includes(aLower)) {
    return {
      type: 'composition',
      description: 'One memory contains the other (compositional)',
      tildeScore: dist,
      principlesApplied: ['P7'],
    };
  }

  // Specialization/Generalization — check AFTER contradiction
  const aWords = new Set(aLower.split(/\s+/));
  const bWords = new Set(bLower.split(/\s+/));
  const aMinusB = [...aWords].filter(w => !bWords.has(w));
  const bMinusA = [...bWords].filter(w => !aWords.has(w));

  if (aMinusB.length > bMinusA.length * 2) {
    return {
      type: 'generalization',
      description: `B generalizes A (loses ${aMinusB.length} specific terms)`,
      tildeScore: dist,
      principlesApplied: ['P2', 'P4'],
    };
  }
  if (bMinusA.length > aMinusB.length * 2) {
    return {
      type: 'specialization',
      description: `B specializes A (adds ${bMinusA.length} specific terms)`,
      tildeScore: dist,
      principlesApplied: ['P2', 'P4'],
    };
  }

  // Default: analogy
  return {
    type: 'analogy',
    description: `Analogical relationship (cognitive distance: ${dist.toFixed(3)})`,
    tildeScore: dist,
    principlesApplied: ['P1', 'P5', 'P6'],
  };
}

// ─── Structural Analysis ──────────────────────────────────────────────────────

/** Memory structure signature: what "shape" is this memory? Pure. */
export interface StructureSignature {
  readonly recordId: string;
  readonly wordCount: number;
  readonly uniqueTerms: number;
  readonly avgWordLength: number;
  readonly hasCode: boolean;
  readonly hasNumbers: boolean;
  readonly hasQuestions: boolean;
  readonly keyPhrases: readonly string[];
}

/** Extract structural signature from memory content. Pure. */
export function structureSignature(record: MemoryRecordV1): StructureSignature {
  const content = record.content;
  const words = content.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  const uniqueTerms = new Set(words.map(w => w.toLowerCase().replace(/[^a-z0-9]/g, ''))).size;
  const avgWordLength = wordCount > 0 ? words.reduce((s, w) => s + w.length, 0) / wordCount : 0;
  const hasCode = /[{};=>]|function|class|const|let|var|import/.test(content);
  const hasNumbers = /\d/.test(content);
  const hasQuestions = /\?/.test(content);

  // Extract key phrases (capitalized sequences, quoted text, technical terms)
  const keyPhrases: string[] = [];
  const capsMatches = content.match(/\b([A-Z][a-z]+\s+){1,3}[A-Z][a-z]+\b/g);
  if (capsMatches) keyPhrases.push(...capsMatches.slice(0, 3));
  const quoteMatches = content.match(/"([^"]{5,40})"/g);
  if (quoteMatches) keyPhrases.push(...quoteMatches.slice(0, 2));

  return {
    recordId: record.recordId,
    wordCount,
    uniqueTerms,
    avgWordLength,
    hasCode,
    hasNumbers,
    hasQuestions,
    keyPhrases: [...new Set(keyPhrases)].slice(0, 5),
  };
}

/** Find structurally similar memories (isomorphism detection). Pure. */
export function findIsomorphic(
  target: MemoryRecordV1,
  candidates: readonly MemoryRecordV1[],
  threshold: number = 0.7,
): readonly { record: MemoryRecordV1; similarity: number }[] {
  const targetSig = structureSignature(target);

  return candidates
    .map(r => {
      const sig = structureSignature(r);
      const sim = signatureSimilarity(targetSig, sig);
      return { record: r, similarity: sim };
    })
    .filter(r => r.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity);
}

/** Similarity between two structure signatures [0, 1]. Pure. */
function signatureSimilarity(a: StructureSignature, b: StructureSignature): number {
  const wordCountSim = 1 - Math.abs(a.wordCount - b.wordCount) / Math.max(a.wordCount, b.wordCount, 1);
  const uniqueSim = 1 - Math.abs(a.uniqueTerms - b.uniqueTerms) / Math.max(a.uniqueTerms, b.uniqueTerms, 1);
  const lengthSim = 1 - Math.abs(a.avgWordLength - b.avgWordLength) / Math.max(a.avgWordLength, b.avgWordLength, 1);
  const codeSim = a.hasCode === b.hasCode ? 1 : 0;
  const numberSim = a.hasNumbers === b.hasNumbers ? 1 : 0;
  const questionSim = a.hasQuestions === b.hasQuestions ? 1 : 0;

  // Key phrase overlap
  const aPhrases = new Set(a.keyPhrases.map(p => p.toLowerCase()));
  const bPhrases = new Set(b.keyPhrases.map(p => p.toLowerCase()));
  const phraseOverlap = aPhrases.size + bPhrases.size > 0
    ? [...aPhrases].filter(x => bPhrases.has(x)).length * 2 / (aPhrases.size + bPhrases.size)
    : 0;

  return (wordCountSim + uniqueSim + lengthSim + codeSim + numberSim + questionSim + phraseOverlap) / 7;
}

// ─── Solve Memory Analogy ─────────────────────────────────────────────────────

/**
 * Solve "A is to B as C is to ?" using structural principles.
 * Returns the predicted transformation to apply to C. Pure.
 */
export function solveAnalogy(
  a: MemoryRecordV1,
  b: MemoryRecordV1,
  c: MemoryRecordV1,
  dCandidates: readonly MemoryRecordV1[],
): { answer: MemoryRecordV1 | null; confidence: number; reasoning: string } {
  // Step 1: Detect A→B transformation
  const abTransform = detectTransformation(a, b);

  // Step 2: Find C→D that matches the same pattern
  const scored = dCandidates.map(d => {
    const cdTransform = detectTransformation(c, d);
    // Score: same type + similar cognitive distance + principle overlap
    const typeMatch = abTransform.type === cdTransform.type ? 0.4 : 0;
    const distanceMatch = 0.3 * (1 - Math.abs(abTransform.tildeScore - cdTransform.tildeScore));
    const principleOverlap = abTransform.principlesApplied.filter(p => cdTransform.principlesApplied.includes(p)).length;
    const principleScore = abTransform.principlesApplied.length > 0
      ? 0.3 * (principleOverlap / abTransform.principlesApplied.length)
      : 0;

    return { d, score: typeMatch + distanceMatch + principleScore };
  });

  scored.sort((x, y) => y.score - x.score);
  const best = scored[0];

  if (!best || best.score < 0.3) {
    return {
      answer: null,
      confidence: 0,
      reasoning: `No good match for ${abTransform.type} transformation (best score: ${best?.score.toFixed(3) ?? 0})`,
    };
  }

  return {
    answer: best.d,
    confidence: best.score,
    reasoning: `A→B is ${abTransform.type} (tilde=${abTransform.tildeScore.toFixed(3)}). ` +
      `C→best match applies same pattern with score ${best.score.toFixed(3)}. ` +
      `Principles: ${abTransform.principlesApplied.join(', ')}`,
  };
}

// ─── Reasoning About Memory ───────────────────────────────────────────────────

/** A reasoning chain: steps the engine took to reach a conclusion. Pure. */
export interface ReasoningStep {
  readonly step: number;
  readonly operation: string;
  readonly principle: string;
  readonly result: string;
}

/** Reason about a memory query using the 7 principles. Pure. */
export function reasonAboutMemory(
  query: string,
  relevantMemories: readonly MemoryRecordV1[],
): { conclusion: string; confidence: number; chain: readonly ReasoningStep[] } {
  const chain: ReasoningStep[] = [];
  let step = 1;

  // P6: Locality — find most relevant memories
  const scored = relevantMemories.map(r => ({
    record: r,
    score: memoryQueryRelevance(r, query),
  })).sort((a, b) => b.score - a.score);

  const topMemories = scored.slice(0, 3);
  chain.push({
    step: step++,
    operation: 'Locality search',
    principle: 'P6',
    result: `Found ${topMemories.length} relevant memories`,
  });

  if (topMemories.length === 0) {
    return {
      conclusion: 'Insufficient memory to answer query.',
      confidence: 0.1,
      chain,
    };
  }

  // P1: Structural Isomorphism — find patterns in relevant memories
  if (topMemories.length >= 2) {
    const transform = detectTransformation(topMemories[0].record, topMemories[1].record);
    chain.push({
      step: step++,
      operation: 'Pattern detection',
      principle: 'P1',
      result: `${transform.type}: ${transform.description}`,
    });
  }

  // P7: Compositional Reasoning — synthesize from multiple memories
  const synthesis = topMemories.map(m => m.record.content).join(' + ');
  const conclusion = synthesizeAnswer(query, topMemories.map(m => m.record));

  chain.push({
    step: step++,
    operation: 'Compositional synthesis',
    principle: 'P7',
    result: `Synthesized ${topMemories.length} memories into answer`,
  });

  const avgScore = topMemories.reduce((s, m) => s + m.score, 0) / topMemories.length;

  return {
    conclusion,
    confidence: Math.min(1, avgScore * 1.2),
    chain,
  };
}

/** Score how relevant a memory is to a query. Pure. */
function memoryQueryRelevance(memory: MemoryRecordV1, query: string): number {
  const memLower = memory.content.toLowerCase();
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (queryWords.length === 0) return 0.5;

  const matches = queryWords.filter(w => memLower.includes(w)).length;
  return matches / queryWords.length;
}

/** Synthesize an answer from relevant memories. Pure. */
function synthesizeAnswer(query: string, memories: readonly MemoryRecordV1[]): string {
  if (memories.length === 0) return 'No relevant memories found.';
  if (memories.length === 1) return memories[0].content;

  // Multi-memory synthesis
  const keyPoints = memories.map((m, i) => `${i + 1}. ${m.content.slice(0, 100)}`);
  return `Based on ${memories.length} memories regarding "${query.slice(0, 50)}":\n${keyPoints.join('\n')}`;
}

// ─── Version ──────────────────────────────────────────────────────────────────

export const ARC3_VERSION = '10.0.0-PHOENIX';
export const ARC3_CODENAME = 'PHOENIX';
