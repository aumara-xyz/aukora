// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * VYMAKIRA Council Engine — glyph protocol + VK Kronos security (pure, portable).
 *
 * The council deliberates over memory operations, reasoning steps, and system changes.
 * Every model communicates via structured glyph packets (stance ⊕⊖⊙⊘⊚, confidence
 * ⇈↑→↓⇊, strategy ↗↘↙↖⇄, 4D distribution vector). The VK Kronos fail-closed security
 * layer enforces coherence thresholds, phase-lock detection, and complete auditability.
 *
 * Convergence: council governs memory operations → swarm distributes reasoning →
 * ARC-3 solves problems. All three are one organism.
 */

// ─── Glyph Taxonomy ───────────────────────────────────────────────────────────

export const VALID_STANCES = ['⊕', '⊖', '⊙', '⊘', '⊚'] as const;
export type StanceGlyph = (typeof VALID_STANCES)[number];

export const VALID_CONFIDENCES = ['⇈', '↑', '→', '↓', '⇊'] as const;
export type ConfidenceGlyph = (typeof VALID_CONFIDENCES)[number];

export const VALID_STRATEGIES = ['↗', '↘', '↙', '↖', '⇄'] as const;
export type StrategyGlyph = (typeof VALID_STRATEGIES)[number];

export const CONFIDENCE_WEIGHTS: Readonly<Record<ConfidenceGlyph, number>> = {
  '⇈': 1.0,
  '↑': 0.8,
  '→': 0.5,
  '↓': 0.2,
  '⇊': 0.05,
};

export const STANCE_WEIGHTS: Readonly<Record<StanceGlyph, number>> = {
  '⊕': 1.0,
  '⊖': -1.0,
  '⊙': 0.0,
  '⊘': -2.0,
  '⊚': 0.0,
};

/** 4D distribution vector: { explore, exploit, verify, abstain }. */
export interface DistributionVector {
  readonly explore: number;
  readonly exploit: number;
  readonly verify: number;
  readonly abstain: number;
}

/** A parsed glyph packet from a council member. */
export interface ParsedGlyph {
  readonly modelId: string;
  readonly stance: StanceGlyph;
  readonly confidence: ConfidenceGlyph;
  readonly confidenceWeight: number;
  readonly strategy: StrategyGlyph;
  readonly distribution: DistributionVector;
  readonly hypothesis: string;
  readonly rawResponse: string;
}

/** Security actions from VK Kronos. */
export type SecurityAction = 'PASS' | 'QUARANTINE' | 'STRIP_REPLAY' | 'FORCE_DIVERSITY' | 'BOOST_CONTRARIAN' | 'PROCEED_WITH_CAUTION';

/** A security decision with full audit context. */
export interface SecurityDecision {
  readonly action: SecurityAction;
  readonly coherenceScore: number;
  readonly phaseLocked: boolean;
  readonly majorityNeutral: boolean;
  readonly streakViolation: boolean;
  readonly reasons: readonly string[];
  readonly timestampMs: number;
}

/** A council deliberation result. */
export interface CouncilResult {
  readonly verdict: 'APPROVED' | 'REJECTED' | 'AMBIGUOUS';
  readonly confidence: number;
  readonly glyphs: readonly ParsedGlyph[];
  readonly securityDecision: SecurityDecision;
  readonly aggregateDistribution: DistributionVector;
  readonly reasoning: string;
}

// ─── Parse Errors ─────────────────────────────────────────────────────────────

export type ParseErrorCode =
  | 'INSUFFICIENT_LINES'
  | 'GLYPH_LINE_TOO_SHORT'
  | 'INVALID_STANCE'
  | 'INVALID_CONFIDENCE'
  | 'INVALID_STRATEGY'
  | 'MISSING_DISTRIBUTION'
  | 'DISTRIBUTION_PARSE_ERROR'
  | 'WRONG_DIMENSION_COUNT'
  | 'NEGATIVE_DISTRIBUTION_VALUE'
  | 'ZERO_SUM_DISTRIBUTION'
  | 'HYPOTHESIS_TRUNCATED'
  | 'STANCE_CONFIDENCE_CONTRADICTION'
  | 'STRONG_REJECT_LOW_CONFIDENCE'
  | 'VETO_WITHOUT_OBJECTION';

export interface ParseIssue {
  readonly code: ParseErrorCode;
  readonly severity: 'fatal' | 'warning';
  readonly detail: string;
}

// ─── Perceiver ────────────────────────────────────────────────────────────────

/**
 * The perceiver: sole authorized glyph parser. Drop-not-fail, pure, deterministic.
 */
export function parseGlyphPacket(rawResponse: string, modelId: string): { glyph: ParsedGlyph | null; issues: readonly ParseIssue[] } {
  const issues: ParseIssue[] = [];
  const lines = rawResponse.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  if (lines.length < 2) {
    issues.push({ code: 'INSUFFICIENT_LINES', severity: 'fatal', detail: `Only ${lines.length} line(s)` });
    return { glyph: null, issues };
  }

  const glyphLine = lines[0];
  if (glyphLine.length < 3) {
    issues.push({ code: 'GLYPH_LINE_TOO_SHORT', severity: 'fatal', detail: glyphLine });
    return { glyph: null, issues };
  }

  // Extract stance, confidence, strategy (first 3 characters)
  let stance = glyphLine[0] as StanceGlyph;
  let confidence = glyphLine[1] as ConfidenceGlyph;
  const strategy = glyphLine[2] as StrategyGlyph;

  if (!VALID_STANCES.includes(stance)) {
    issues.push({ code: 'INVALID_STANCE', severity: 'fatal', detail: stance });
    return { glyph: null, issues };
  }
  if (!VALID_CONFIDENCES.includes(confidence)) {
    issues.push({ code: 'INVALID_CONFIDENCE', severity: 'fatal', detail: confidence });
    return { glyph: null, issues };
  }
  if (!VALID_STRATEGIES.includes(strategy)) {
    issues.push({ code: 'INVALID_STRATEGY', severity: 'fatal', detail: strategy });
    return { glyph: null, issues };
  }

  // Extract distribution from braces
  const braceMatch = glyphLine.match(/\{([^}]*)\}/);
  if (!braceMatch) {
    issues.push({ code: 'MISSING_DISTRIBUTION', severity: 'fatal', detail: glyphLine });
    return { glyph: null, issues };
  }

  let rawValues: number[];
  try {
    rawValues = braceMatch[1].split(',').map(v => parseFloat(v.trim()));
  } catch {
    issues.push({ code: 'DISTRIBUTION_PARSE_ERROR', severity: 'fatal', detail: braceMatch[1] });
    return { glyph: null, issues };
  }

  if (rawValues.length !== 4) {
    issues.push({ code: 'WRONG_DIMENSION_COUNT', severity: 'fatal', detail: String(rawValues.length) });
    return { glyph: null, issues };
  }
  if (rawValues.some(v => v < 0 || Number.isNaN(v))) {
    issues.push({ code: 'NEGATIVE_DISTRIBUTION_VALUE', severity: 'fatal', detail: JSON.stringify(rawValues) });
    return { glyph: null, issues };
  }

  const distSum = rawValues.reduce((a, b) => a + b, 0);
  if (distSum === 0) {
    issues.push({ code: 'ZERO_SUM_DISTRIBUTION', severity: 'fatal', detail: '[0,0,0,0]' });
    return { glyph: null, issues };
  }

  const normalized = rawValues.map(v => v / distSum);
  const distribution: DistributionVector = {
    explore: normalized[0],
    exploit: normalized[1],
    verify: normalized[2],
    abstain: normalized[3],
  };

  // Parse hypothesis
  let hypothesis = lines[1].slice(0, 120);
  if (lines[1].length > 120) {
    issues.push({ code: 'HYPOTHESIS_TRUNCATED', severity: 'warning', detail: `${lines[1].length} chars` });
  }

  // Validate stance-confidence consistency
  if (stance === '⊕' && (confidence === '↓' || confidence === '⇊')) {
    issues.push({ code: 'STANCE_CONFIDENCE_CONTRADICTION', severity: 'warning', detail: `${stance}${confidence}` });
    stance = '⊙';
    confidence = '↓';
  }
  if (stance === '⊘' && (confidence === '↓' || confidence === '⇊')) {
    issues.push({ code: 'STRONG_REJECT_LOW_CONFIDENCE', severity: 'warning', detail: `${stance}${confidence}` });
    stance = '⊖';
    confidence = '→';
  }
  if (stance === '⊘' && hypothesis.length < 10) {
    issues.push({ code: 'VETO_WITHOUT_OBJECTION', severity: 'warning', detail: hypothesis });
    stance = '⊖';
  }

  return {
    glyph: {
      modelId,
      stance,
      confidence,
      confidenceWeight: CONFIDENCE_WEIGHTS[confidence],
      strategy,
      distribution,
      hypothesis,
      rawResponse,
    },
    issues,
  };
}

// ─── Coherence Engine ─────────────────────────────────────────────────────────

/** KL divergence between two distributions. Pure. */
export function klDivergence(p: readonly number[], q: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < p.length; i++) {
    if (p[i] > 0 && q[i] > 0) sum += p[i] * Math.log(p[i] / q[i]);
  }
  return sum;
}

/** Jensen-Shannon divergence (symmetric, bounded [0, 1]). Pure. */
export function jsDivergence(p: readonly number[], q: readonly number[]): number {
  const m = p.map((v, i) => (v + q[i]) / 2);
  return (klDivergence(p, m) + klDivergence(q, m)) / 2;
}

/** Compute council coherence: 1 - average pairwise JS divergence. Pure. */
export function computeCoherence(glyphs: readonly ParsedGlyph[]): number {
  if (glyphs.length < 2) return 1.0;

  const dists = glyphs.map(g => [g.distribution.explore, g.distribution.exploit, g.distribution.verify, g.distribution.abstain]);
  let total = 0;
  let pairs = 0;

  for (let i = 0; i < dists.length; i++) {
    for (let j = i + 1; j < dists.length; j++) {
      total += jsDivergence(dists[i], dists[j]);
      pairs++;
    }
  }

  return Math.max(0, 1 - (pairs > 0 ? total / pairs : 0));
}

// ─── VK Kronos ────────────────────────────────────────────────────────────────

/**
 * Detect phase-lock: all models have near-identical distributions.
 * Tolerance: max pairwise difference < tol for all 4 dimensions.
 */
export function detectPhaseLock(glyphs: readonly ParsedGlyph[], tolerance: number = 0.05): boolean {
  if (glyphs.length < 2) return false;
  const dists = glyphs.map(g => [g.distribution.explore, g.distribution.exploit, g.distribution.verify, g.distribution.abstain]);

  for (let i = 0; i < dists.length; i++) {
    for (let j = i + 1; j < dists.length; j++) {
      for (let k = 0; k < 4; k++) {
        if (Math.abs(dists[i][k] - dists[j][k]) > tolerance) return false;
      }
    }
  }
  return true;
}

/** Check for majority neutral (≥ count abstentions). */
export function isMajorityNeutral(glyphs: readonly ParsedGlyph[], quorum: number = 4): boolean {
  return glyphs.filter(g => g.stance === '⊚').length >= quorum;
}

/** Check winner streak: one model's patches accepted > threshold consecutive rounds. */
export interface RoundRecord {
  readonly winningModelId: string;
  readonly timestampMs: number;
}

export function checkWinnerStreak(history: readonly RoundRecord[], threshold: number = 5): boolean {
  if (history.length < threshold) return false;
  const recent = history.slice(-threshold);
  const first = recent[0].winningModelId;
  return recent.every(r => r.winningModelId === first);
}

/** VK Kronos decision matrix: 24 input states → security action. Pure. */
export function vkKronosDecide(
  coherenceScore: number,
  phaseLocked: boolean,
  majorityNeutral: boolean,
  streakViolation: boolean,
): SecurityAction {
  // Priority 1: Fail-closed (coherence < 0.3)
  if (coherenceScore < 0.3) return 'QUARANTINE';

  // Priority 2: Phase-lock detection (premature consensus)
  if (phaseLocked) return 'FORCE_DIVERSITY';

  // Priority 3: Majority neutral (no informed opinion)
  if (majorityNeutral) return 'STRIP_REPLAY';

  // Priority 4: Streak violation (one model dominating)
  if (streakViolation) return 'BOOST_CONTRARIAN';

  // Priority 5: Coherence thresholds
  if (coherenceScore >= 0.7) return 'PASS';
  if (coherenceScore >= 0.4) return 'PROCEED_WITH_CAUTION';

  return 'QUARANTINE';
}

// ─── Council Deliberation ─────────────────────────────────────────────────────

/** Aggregate 4D distribution across all glyphs. Pure. */
export function aggregateDistribution(glyphs: readonly ParsedGlyph[]): DistributionVector {
  if (glyphs.length === 0) return { explore: 0.25, exploit: 0.25, verify: 0.25, abstain: 0.25 };

  const totalWeight = glyphs.reduce((sum, g) => sum + g.confidenceWeight, 0);
  if (totalWeight === 0) return { explore: 0.25, exploit: 0.25, verify: 0.25, abstain: 0.25 };

  let explore = 0, exploit = 0, verify = 0, abstain = 0;
  for (const g of glyphs) {
    explore += g.distribution.explore * g.confidenceWeight;
    exploit += g.distribution.exploit * g.confidenceWeight;
    verify += g.distribution.verify * g.confidenceWeight;
    abstain += g.distribution.abstain * g.confidenceWeight;
  }

  return {
    explore: explore / totalWeight,
    exploit: exploit / totalWeight,
    verify: verify / totalWeight,
    abstain: abstain / totalWeight,
  };
}

/** Compute weighted verdict from glyph stances. Pure. */
export function computeVerdict(glyphs: readonly ParsedGlyph[]): { verdict: 'APPROVED' | 'REJECTED' | 'AMBIGUOUS'; confidence: number } {
  if (glyphs.length === 0) return { verdict: 'AMBIGUOUS', confidence: 0 };

  let weightedSum = 0;
  let totalWeight = 0;
  let vetoCount = 0;

  for (const g of glyphs) {
    const weight = g.confidenceWeight;
    weightedSum += STANCE_WEIGHTS[g.stance] * weight;
    totalWeight += weight;
    if (g.stance === '⊘') vetoCount++;
  }

  // Any veto strongly influences the outcome
  const vetoFactor = Math.min(1, vetoCount / Math.max(1, glyphs.length));
  const normalizedScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
  const adjustedScore = normalizedScore * (1 - vetoFactor * 0.5);

  const confidence = Math.min(1, Math.abs(adjustedScore) + (1 - computeCoherence(glyphs)) * 0.3);

  if (adjustedScore > 0.3) return { verdict: 'APPROVED', confidence };
  if (adjustedScore < -0.3) return { verdict: 'REJECTED', confidence };
  return { verdict: 'AMBIGUOUS', confidence };
}

/** Full council deliberation: parse → coherence → security → verdict. Pure. */
export function councilDeliberate(
  rawResponses: Readonly<Record<string, string>>,
  history: readonly RoundRecord[] = [],
  nowMs: number = 0,
): CouncilResult {
  const glyphs: ParsedGlyph[] = [];
  const allIssues: ParseIssue[] = [];

  for (const [modelId, raw] of Object.entries(rawResponses)) {
    const { glyph, issues } = parseGlyphPacket(raw, modelId);
    allIssues.push(...issues);
    if (glyph) glyphs.push(glyph);
  }

  const coherenceScore = computeCoherence(glyphs);
  const phaseLocked = detectPhaseLock(glyphs);
  const majorityNeutral = isMajorityNeutral(glyphs);
  const streakViolation = checkWinnerStreak(history);

  const securityDecision: SecurityDecision = {
    action: vkKronosDecide(coherenceScore, phaseLocked, majorityNeutral, streakViolation),
    coherenceScore,
    phaseLocked,
    majorityNeutral,
    streakViolation,
    reasons: allIssues.filter(i => i.severity === 'warning').map(i => `${i.code}: ${i.detail}`),
    timestampMs: nowMs,
  };

  const { verdict, confidence } = computeVerdict(glyphs);
  const aggregate = aggregateDistribution(glyphs);

  const reasoning = [
    `Council: ${glyphs.length} models, coherence ${coherenceScore.toFixed(3)}`,
    `Security: ${securityDecision.action} (phaseLock=${phaseLocked}, neutral=${majorityNeutral}, streak=${streakViolation})`,
    `Verdict: ${verdict} (confidence ${(confidence * 100).toFixed(1)}%)`,
    `Distribution: explore=${aggregate.explore.toFixed(2)} exploit=${aggregate.exploit.toFixed(2)} verify=${aggregate.verify.toFixed(2)}`,
    ...glyphs.map(g => `  ${g.modelId}: ${g.stance}${g.confidence}${g.strategy} "${g.hypothesis}"`),
  ].join('\n');

  return {
    verdict: securityDecision.action === 'QUARANTINE' ? 'REJECTED' : verdict,
    confidence,
    glyphs,
    securityDecision,
    aggregateDistribution: aggregate,
    reasoning,
  };
}
