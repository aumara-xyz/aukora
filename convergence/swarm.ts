// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Aukora Swarm — distributed memory reasoning nodes (pure, portable).
 *
 * Swarm nodes are autonomous reasoning agents that share a memory substrate.
 * They quiz each other on memory contents, deliberate on contradictions via
 * the VYMAKIRA council protocol, and collectively optimize the memory index.
 *
 * Convergence: swarm nodes + council governance + ARC-3 reasoning = a single
 * distributed mind where no node has authority, all nodes have evidence.
 */

import type { MemoryRecordV1 } from '../../memory/src/envelope.js';
import type { ParsedGlyph, CouncilResult, RoundRecord } from './council.js';
import { councilDeliberate } from './council.js';

/** A swarm node's identity and capabilities. */
export interface SwarmNode {
  readonly id: string;
  readonly role: 'indexer' | 'contradiction_hunter' | 'relevance_scorer' | 'generalist';
  readonly glyphStyle: 'cautious' | 'aggressive' | 'balanced' | 'contrarian';
  /** This node's memory of what other nodes know. */
  readonly peerModel: Readonly<Record<string, PeerBelief>>;
}

/** What this node believes about another node's knowledge. */
export interface PeerBelief {
  readonly knownScopes: readonly string[];
  readonly lastInteractionMs: number;
  readonly trustScore: number; // 0-1
  readonly contradictionsFound: number;
}

/** A quiz question from one node to another. */
export interface MemoryQuiz {
  readonly fromNode: string;
  readonly toNode: string;
  readonly question: string; // e.g., "What is the PHI_INV floor value?"
  readonly expectedAnswer: string;
  readonly scope: string; // which memory scope to test
  readonly timestampMs: number;
}

/** A quiz response. */
export interface QuizResponse {
  readonly quiz: MemoryQuiz;
  readonly answer: string;
  readonly correct: boolean;
  readonly confidence: number;
  readonly responseTimeMs: number;
}

/** A contradiction found between two memories. */
export interface Contradiction {
  readonly recordIdA: string;
  readonly recordIdB: string;
  readonly tildeScore: number; // ~ operator result
  readonly caratObject: string; // ^ operator result
  readonly foundBy: string; // which node found it
  readonly timestampMs: number;
}

/** Swarm deliberation over a memory operation. */
export interface SwarmDeliberation {
  readonly operation: string;
  readonly councilResult: CouncilResult;
  readonly participatingNodes: readonly string[];
  readonly contradictionsFound: readonly Contradiction[];
  readonly quizResults: readonly QuizResponse[];
}

// ─── Mock Glyph Generators ────────────────────────────────────────────────────

/** Generate a glyph response in a node's characteristic style. Pure. */
export function generateNodeGlyph(
  node: SwarmNode,
  operation: string,
  nodeIndex: number,
): string {
  const styles: Record<string, () => string> = {
    cautious: () => {
      const stances: StanceGlyph[] = ['⊙', '⊕', '⊚'];
      const confs: ConfidenceGlyph[] = ['→', '↑'];
      const strats: StrategyGlyph[] = ['↙', '⇄'];
      return `${stances[nodeIndex % 3]}${confs[nodeIndex % 2]}${strats[nodeIndex % 2]} { 0.2, 0.2, 0.5, 0.1 }\nVerify before modifying memory: ${operation.slice(0, 60)}`;
    },
    aggressive: () => {
      const stances: StanceGlyph[] = ['⊕', '⊕', '⊖'];
      const confs: ConfidenceGlyph[] = ['↑', '⇈'];
      const strats: StrategyGlyph[] = ['↗', '↘'];
      return `${stances[nodeIndex % 3]}${confs[nodeIndex % 2]}${strats[nodeIndex % 2]} { 0.5, 0.3, 0.1, 0.1 }\nFast progress on: ${operation.slice(0, 60)}`;
    },
    balanced: () => {
      const stances: StanceGlyph[] = ['⊕', '⊙', '⊖'];
      const confs: ConfidenceGlyph[] = ['↑', '→'];
      const strats: StrategyGlyph[] = ['⇄', '↗'];
      return `${stances[nodeIndex % 3]}${confs[nodeIndex % 2]}${strats[nodeIndex % 2]} { 0.3, 0.3, 0.3, 0.1 }\nBalanced approach to: ${operation.slice(0, 60)}`;
    },
    contrarian: () => {
      const stances: StanceGlyph[] = ['⊖', '⊘', '⊙'];
      const confs: ConfidenceGlyph[] = ['→', '↓'];
      const strats: StrategyGlyph[] = ['↖', '↙'];
      return `${stances[nodeIndex % 3]}${confs[nodeIndex % 2]}${strats[nodeIndex % 2]} { 0.1, 0.1, 0.6, 0.2 }\nQuestion assumptions in: ${operation.slice(0, 60)}`;
    },
  };

  return (styles[node.glyphStyle] || styles.balanced)();
}

type StanceGlyph = '⊕' | '⊖' | '⊙' | '⊘' | '⊚';
type ConfidenceGlyph = '⇈' | '↑' | '→' | '↓' | '⇊';
type StrategyGlyph = '↗' | '↘' | '↙' | '↖' | '⇄';

// ─── Quiz System ──────────────────────────────────────────────────────────────

/** Generate quiz questions from a memory record. Pure. */
export function generateQuizzes(
  fromNode: string,
  toNode: string,
  record: MemoryRecordV1,
  nowMs: number,
): readonly MemoryQuiz[] {
  const quizzes: MemoryQuiz[] = [];
  const content = record.content;

  // Quiz 1: First sentence comprehension
  const firstSentence = content.split(/[.!?]/)[0]?.trim() ?? content;
  if (firstSentence.length > 10) {
    quizzes.push({
      fromNode,
      toNode,
      question: `What is the main point of: "${firstSentence.slice(0, 80)}..."?`,
      expectedAnswer: firstSentence,
      scope: record.provenance,
      timestampMs: nowMs,
    });
  }

  // Quiz 2: Keyword extraction
  const words = content.toLowerCase().match(/\b[a-z]{4,}\b/g) ?? [];
  if (words.length >= 3) {
    const keyTerms = [...new Set(words)].slice(0, 3).join(', ');
    quizzes.push({
      fromNode,
      toNode,
      question: `What are the key terms in memory ${record.recordId.slice(0, 8)}?`,
      expectedAnswer: keyTerms,
      scope: record.provenance,
      timestampMs: nowMs,
    });
  }

  // Quiz 3: Content verification
  const snippet = content.slice(0, 60);
  quizzes.push({
    fromNode,
    toNode,
    question: `Complete this memory: "${snippet}..."`,
    expectedAnswer: content,
    scope: record.provenance,
    timestampMs: nowMs,
  });

  return quizzes;
}

/** Score a quiz response. Pure. */
export function scoreQuiz(response: string, expected: string): { correct: boolean; confidence: number } {
  const normResponse = response.toLowerCase().trim();
  const normExpected = expected.toLowerCase().trim();

  if (normResponse === normExpected) return { correct: true, confidence: 1.0 };

  // Check for key term overlap
  const expectedWords = new Set(normExpected.split(/\s+/));
  const responseWords = normResponse.split(/\s+/);
  const matches = responseWords.filter(w => expectedWords.has(w)).length;
  const overlap = expectedWords.size > 0 ? matches / expectedWords.size : 0;

  return {
    correct: overlap > 0.7,
    confidence: Math.min(1, overlap),
  };
}

// ─── Swarm Operations ─────────────────────────────────────────────────────────

/** Create a default swarm of 6 nodes with diverse roles. Pure. */
export function createSwarm(): readonly SwarmNode[] {
  return [
    { id: 'k3-alpha', role: 'indexer', glyphStyle: 'aggressive', peerModel: {} },
    { id: 'k3-beta', role: 'contradiction_hunter', glyphStyle: 'contrarian', peerModel: {} },
    { id: 'k3-gamma', role: 'relevance_scorer', glyphStyle: 'cautious', peerModel: {} },
    { id: 'k3-delta', role: 'generalist', glyphStyle: 'balanced', peerModel: {} },
    { id: 'k3-epsilon', role: 'indexer', glyphStyle: 'balanced', peerModel: {} },
    { id: 'k3-zeta', role: 'contradiction_hunter', glyphStyle: 'cautious', peerModel: {} },
  ];
}

/** Run swarm deliberation on a memory operation. Pure. */
export function swarmDeliberate(
  nodes: readonly SwarmNode[],
  operation: string,
  history: readonly RoundRecord[] = [],
  nowMs: number = 0,
): SwarmDeliberation {
  // Each node generates its glyph
  const responses: Record<string, string> = {};
  for (let i = 0; i < nodes.length; i++) {
    responses[nodes[i].id] = generateNodeGlyph(nodes[i], operation, i);
  }

  const councilResult = councilDeliberate(responses, history, nowMs);

  return {
    operation,
    councilResult,
    participatingNodes: nodes.map(n => n.id),
    contradictionsFound: [], // Populated by contradiction hunters
    quizResults: [],
  };
}

/** Run a quiz round: each node quizzes every other node on shared memories. Pure. */
export function runQuizRound(
  nodes: readonly SwarmNode[],
  records: readonly MemoryRecordV1[],
  nowMs: number = 0,
): readonly QuizResponse[] {
  const responses: QuizResponse[] = [];

  for (const fromNode of nodes) {
    for (const toNode of nodes) {
      if (fromNode.id === toNode.id) continue;
      if (records.length === 0) continue;

      // Pick a memory relevant to both nodes
      const record = records[Math.abs(hashString(fromNode.id + toNode.id)) % records.length];
      const quizzes = generateQuizzes(fromNode.id, toNode.id, record, nowMs);

      for (const quiz of quizzes) {
        // Simulate response: node answers based on "memory" of the content
        const simulatedAnswer = simulateNodeAnswer(toNode, quiz);
        const { correct, confidence } = scoreQuiz(simulatedAnswer, quiz.expectedAnswer);

        responses.push({
          quiz,
          answer: simulatedAnswer,
          correct,
          confidence,
          responseTimeMs: 50 + Math.abs(hashString(toNode.id + quiz.question)) % 200,
        });
      }
    }
  }

  return responses;
}

/** Simulate a node's answer to a quiz. Pure, deterministic. */
function simulateNodeAnswer(node: SwarmNode, quiz: MemoryQuiz): string {
  // Different roles have different "memory accuracy"
  const accuracy: Record<string, number> = {
    indexer: 0.9,
    contradiction_hunter: 0.85,
    relevance_scorer: 0.8,
    generalist: 0.75,
  };

  const acc = accuracy[node.role] ?? 0.7;
  const hash = hashString(node.id + quiz.question);
  const roll = (hash % 100) / 100;

  if (roll < acc) {
    // Correct or partially correct
    if (roll < acc * 0.7) {
      return quiz.expectedAnswer; // Full recall
    }
    return quiz.expectedAnswer.slice(0, Math.floor(quiz.expectedAnswer.length * 0.7));
  }

  // Wrong answer
  return `I'm not sure about the details of ${quiz.scope}.`;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/** FNV-1a hash for deterministic pseudo-randomness. Pure. */
function hashString(s: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash | 0);
}

/** Aggregate swarm quiz results into a health metric. Pure. */
export function swarmQuizHealth(quizResults: readonly QuizResponse[]): {
  accuracy: number;
  avgConfidence: number;
  weakestNode: string | null;
  strongestNode: string | null;
} {
  if (quizResults.length === 0) {
    return { accuracy: 0, avgConfidence: 0, weakestNode: null, strongestNode: null };
  }

  const correct = quizResults.filter(r => r.correct).length;
  const avgConf = quizResults.reduce((s, r) => s + r.confidence, 0) / quizResults.length;

  // Score per node
  const nodeScores: Record<string, { correct: number; total: number }> = {};
  for (const r of quizResults) {
    const id = r.quiz.toNode;
    if (!nodeScores[id]) nodeScores[id] = { correct: 0, total: 0 };
    nodeScores[id].total++;
    if (r.correct) nodeScores[id].correct++;
  }

  let weakest: string | null = null;
  let strongest: string | null = null;
  let minAcc = Infinity;
  let maxAcc = -Infinity;

  for (const [id, scores] of Object.entries(nodeScores)) {
    const acc = scores.correct / scores.total;
    if (acc < minAcc) { minAcc = acc; weakest = id; }
    if (acc > maxAcc) { maxAcc = acc; strongest = id; }
  }

  return {
    accuracy: correct / quizResults.length,
    avgConfidence: avgConf,
    weakestNode: weakest,
    strongestNode: strongest,
  };
}
