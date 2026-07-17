#!/usr/bin/env tsx
/**
 * CONVERGENCE TEST RUNNER — Standalone runner using direct file imports.
 * Runs all convergence tests without requiring vitest or complex module resolution.
 * Pure, deterministic, zero I/O beyond stdout.
 */

// ─── Memory Imports (direct file paths) ───────────────────────────────────────
import {
  buildMemoryRecord, validateMemoryRecord, deriveRecordId,
  type MemoryRecordV1,
} from '../../memory/src/envelope.js';
import {
  tokenize, buildIndex, recallIndexed, recallIndexedAnd, indexStats,
} from '../../memory/src/searchIndex.js';
import {
  PHI, PHI_INV, phiDecay, tilde, carat, createShear, applyShear,
  scoreRelevance, sortByRelevance, buildEnvelopes, RELEVANCE_FLOOR,
  type DecayEnvelope,
} from '../../memory/src/decay.js';
import {
  computeMetrics, selfOptimize, healthCheck, adaptiveHalfLife,
  type QueryEvent,
} from '../../memory/src/selfOptimize.js';

// ─── Mind Imports (direct file paths) ─────────────────────────────────────────
import {
  parseGlyphPacket, computeCoherence, detectPhaseLock, isMajorityNeutral,
  checkWinnerStreak, vkKronosDecide, councilDeliberate, computeVerdict,
  aggregateDistribution, CONFIDENCE_WEIGHTS, type ParsedGlyph,
} from '../src/council.js';
import {
  createSwarm, generateNodeGlyph, generateQuizzes, scoreQuiz,
  runQuizRound, swarmQuizHealth,
} from '../src/swarm.js';
import {
  detectTransformation, structureSignature, findIsomorphic,
  solveAnalogy, reasonAboutMemory, PRINCIPLES, ARC3_VERSION,
} from '../src/arc3Memory.js';

// ─── Test Harness ─────────────────────────────────────────────────────────────

interface TestResult {
  passed: number;
  failed: number;
  failures: string[];
}

const results: TestResult = { passed: 0, failed: 0, failures: [] };

function assert(cond: boolean, message: string): void {
  if (cond) {
    results.passed++;
  } else {
    results.failed++;
    results.failures.push(message);
    console.log(`  FAIL: ${message}`);
  }
}

function assertClose(actual: number, expected: number, epsilon: number, message: string): void {
  assert(Math.abs(actual - expected) < epsilon, `${message}: expected ${expected}, got ${actual}`);
}

function section(name: string): void {
  console.log(`\n━━ ${name} ━━`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRecord(content: string, overrides: Partial<MemoryRecordV1> = {}): MemoryRecordV1 {
  return buildMemoryRecord({
    content,
    createdAt: overrides.createdAt ?? '2026-07-17T00:00:00Z',
    kind: overrides.kind ?? 'observation',
    consent: overrides.consent ?? 'private',
    provenance: overrides.provenance ?? 'test',
    ...overrides,
  });
}

function makeRecords(contents: string[]): MemoryRecordV1[] {
  return contents.map((c, i) => makeRecord(c, {
    createdAt: `2026-07-${(10 + i).toString().padStart(2, '0')}T00:00:00Z`,
  }));
}

function makeGlyph(
  modelId: string, stance: string, confidence: string, strategy: string, dist: number[],
): ParsedGlyph {
  return {
    modelId,
    stance: stance as ParsedGlyph['stance'],
    confidence: confidence as ParsedGlyph['confidence'],
    confidenceWeight: (CONFIDENCE_WEIGHTS as Record<string, number>)[confidence] ?? 0.5,
    strategy: strategy as ParsedGlyph['strategy'],
    distribution: { explore: dist[0], exploit: dist[1], verify: dist[2], abstain: dist[3] },
    hypothesis: 'Test',
    rawResponse: `${stance}${confidence}${strategy} { ${dist.join(', ')} }\nTest`,
  };
}

// ─══════════════════════════════════════════════════════════════════════════════
// §1 MEMORY INDEX TESTS
// ─══════════════════════════════════════════════════════════════════════════════

section('§1 Search Index');

// 1.1
const terms1 = tokenize('The quick brown fox jumps over the lazy dog');
assert(!terms1.includes('the'), '1.1 stopwords excluded');
assert(terms1.includes('quick'), '1.1 quick present');
assert(terms1.includes('brown'), '1.1 brown present');
assert(terms1.includes('fox'), '1.1 fox present');

// 1.2
const records2 = makeRecords(['Memory about identity and architecture', 'Memory about testing', 'Memory about identity']);
const index2 = buildIndex(records2);
assert(index2['identity'] !== undefined, '1.2 index has identity term');
assert(index2['identity'].length === 2, `1.2 identity has 2 postings, got ${index2['identity']?.length}`);
assert(index2['architecture'] !== undefined, '1.2 index has architecture term');
assert(index2['architecture'].length === 1, '1.2 architecture has 1 posting');

// 1.3
const records3 = makeRecords(['Identity memory one', 'Identity memory two']);
const forgotten3 = new Set([records3[0].recordId]);
const index3 = buildIndex(records3, forgotten3);
assert(index3['identity'].length === 1, '1.3 forgotten excluded');
assert(index3['identity'][0].recordId === records3[1].recordId, '1.3 correct record remains');

// 1.4
const records4 = makeRecords(['golden ratio memory decay', 'architecture boundaries', 'memory indexing']);
const index4 = buildIndex(records4);
const results4 = recallIndexed(records4, index4, 'memory');
assert(results4.length === 2, `1.4 found 2 memory results, got ${results4.length}`);
assert(results4[0].score > 0, '1.4 score positive');

// 1.5
const records5 = makeRecords(['golden ratio memory', 'golden architecture', 'memory system']);
const index5 = buildIndex(records5);
const results5 = recallIndexedAnd(records5, index5, 'golden memory');
assert(results5.length === 1, `1.5 AND found 1 result, got ${results5.length}`);

// 1.6
const records6 = makeRecords(['golden ratio']);
const forgotten6 = new Set([records6[0].recordId]);
const index6 = buildIndex(records6);
const results6 = recallIndexed(records6, index6, 'golden', forgotten6);
assert(results6.length === 0, '1.6 forgotten returns empty');

// 1.7
const records7 = makeRecords(['identity architecture', 'identity test code']);
const index7 = buildIndex(records7);
const stats7 = indexStats(records7, index7);
assert(stats7.termCount > 0, '1.7 stats has terms');
assert(stats7.totalPostings > 0, '1.7 stats has postings');

// 1.8 determinism
const records8 = makeRecords(['alpha beta gamma', 'beta gamma delta']);
const index8 = buildIndex(records8);
const r1_8 = recallIndexed(records8, index8, 'beta');
const r2_8 = recallIndexed(records8, index8, 'beta');
assert(JSON.stringify(r1_8) === JSON.stringify(r2_8), '1.8 deterministic');

// ─══════════════════════════════════════════════════════════════════════════════
// §2 φ-DECAY TESTS
// ─══════════════════════════════════════════════════════════════════════════════

section('§2 φ-Decay SHEAR Engine');

assertClose(PHI, 1.618033988749895, 1e-10, '2.1 PHI value');
assertClose(PHI_INV, 0.6180339887498948, 1e-10, '2.2 PHI_INV value');
assertClose(1 / PHI, PHI_INV, 1e-10, '2.2 1/PHI = PHI_INV');
assert(phiDecay(0, 1.0) === 1.0, '2.3 age 0 = initial');
assert(phiDecay(0, 0.8) === 0.8, '2.3 age 0 = initial 0.8');

const veryOld = phiDecay(1_000_000_000, 1.0);
assert(veryOld >= PHI_INV - 0.001, `2.4 floor respected: ${veryOld} >= ${PHI_INV}`);
assert(veryOld === RELEVANCE_FLOOR, '2.4 exact floor match');

const d1 = phiDecay(1000, 1.0);
const d2 = phiDecay(2000, 1.0);
const d3 = phiDecay(3000, 1.0);
assert(d1 > d2, `2.5 monotonic: ${d1} > ${d2}`);
assert(d2 > d3, `2.5 monotonic: ${d2} > ${d3}`);

assert(tilde('identical', 'identical') === 0, '2.6 identical = 0');
assert(tilde('abc123xyz', '!!!@@@###') > 0.8, '2.7 different > 0.8');

const distSym1 = tilde('golden ratio memory', 'memory decay system');
const distSym2 = tilde('memory decay system', 'golden ratio memory');
assert(distSym1 === distSym2, `2.8 symmetric: ${distSym1} === ${distSym2}`);

const diff9 = carat('alpha beta', 'alpha gamma');
assert(diff9.length > 0, '2.9 carat produces output');
assert(diff9.includes('alpha'), '2.9 carat mentions alpha');

const now10 = Date.now();
const shear10 = createShear('id1', 'content one', 'id2', 'content two', now10);
assert(shear10.id.includes('shear'), '2.10 shear id format');
assert(shear10.createdAtMs === now10, '2.10 timestamp');
assert(shear10.magnitude >= 0 && shear10.magnitude <= 1, '2.10 magnitude range');
assert(shear10.contradictorId === 'id1', '2.10 contradictor');

const envelope11: DecayEnvelope = {
  recordId: 'test-id', createdAtMs: now10 - 10000, initialRelevance: 1.0,
  halfLifeMs: 3600000,
  shearObjects: [createShear('other', 'different', 'test-id', 'original', now10)],
};
const withShear11 = applyShear(envelope11, now10);
const withoutShear11 = phiDecay(10000, 1.0, 3600000);
assert(withShear11 < withoutShear11, `2.11 shear reduces: ${withShear11} < ${withoutShear11}`);
assert(withShear11 >= RELEVANCE_FLOOR, `2.11 floor: ${withShear11} >= ${RELEVANCE_FLOOR}`);

const envelopes12 = buildEnvelopes(['id1', 'id2'], { id1: now10 - 1000, id2: now10 - 5000 }, 3600000);
const scores12 = scoreRelevance(envelopes12, now10);
assert(scores12.length === 2, '2.12 two scores');
assert(scores12[0].ageMs < scores12[1].ageMs, '2.12 age ordering');

const envelopes13 = buildEnvelopes(['id1', 'id2', 'id3'], { id1: now10, id2: now10 - 10000, id3: now10 - 5000 }, 3600000);
const scores13 = scoreRelevance(envelopes13, now10);
const sorted13 = sortByRelevance(scores13);
assert(sorted13[0].relevance >= sorted13[1].relevance, '2.13 sort desc');
assert(sorted13[1].relevance >= sorted13[2].relevance, '2.13 sort desc');

// ─══════════════════════════════════════════════════════════════════════════════
// §3 SELF-OPTIMIZATION TESTS
// ─══════════════════════════════════════════════════════════════════════════════

section('§3 Self-Optimization');

const m14 = computeMetrics([]);
assert(m14.totalQueries === 0, '3.1 empty metrics');
assert(m14.hitRate === 0, '3.1 empty hitRate');

const events15: QueryEvent[] = [
  { queryText: 't1', resultsCount: 5, top5HitsUsed: 3, latencyMs: 100, satisfied: true },
  { queryText: 't2', resultsCount: 3, top5HitsUsed: 2, latencyMs: 80, satisfied: true },
];
const m15 = computeMetrics(events15);
assert(m15.totalQueries === 2, '3.2 two queries');
assert(m15.hitRate === 5 / 10, '3.2 hit rate');
assert(m15.satisfactionRate === 1, '3.2 satisfaction');

const events16: QueryEvent[] = Array.from({ length: 10 }, () => ({
  queryText: 'u', resultsCount: 0, top5HitsUsed: 0, latencyMs: 50, satisfied: false,
}));
const stats16 = { termCount: 5, totalPostings: 10, avgPostingsPerTerm: 2, maxPostingsForTerm: 5, uncoveredTerms: ['missing'] };
const recs16 = selfOptimize(computeMetrics(events16), stats16, 86400000);
assert(recs16[0].action === 'rebuild_index', `3.3 rebuild: ${recs16[0].action}`);
assert(recs16[0].priority > 0.5, '3.3 high priority');

const events17: QueryEvent[] = Array.from({ length: 20 }, (_, i) => ({
  queryText: 'q' + i, resultsCount: 3, top5HitsUsed: 1, latencyMs: 100, satisfied: i < 5,
}));
const stats17 = { termCount: 50, totalPostings: 200, avgPostingsPerTerm: 4, maxPostingsForTerm: 20, uncoveredTerms: [] };
const recs17 = selfOptimize(computeMetrics(events17), stats17, 86400000);
const halfRec17 = recs17.find(r => r.action === 'shorten_half_life');
assert(halfRec17 !== undefined, '3.4 shorten recommendation');

const events18: QueryEvent[] = Array.from({ length: 10 }, () => ({
  queryText: 'g', resultsCount: 5, top5HitsUsed: 4, latencyMs: 50, satisfied: true,
}));
const stats18 = { termCount: 100, totalPostings: 500, avgPostingsPerTerm: 5, maxPostingsForTerm: 30, uncoveredTerms: [] };
const recs18 = selfOptimize(computeMetrics(events18), stats18, 86400000);
assert(recs18.some(r => r.action === 'extend_half_life'), '3.5 extend recommendation');

const critEvents19: QueryEvent[] = Array.from({ length: 10 }, () => ({
  queryText: 'x', resultsCount: 0, top5HitsUsed: 0, latencyMs: 1000, satisfied: false,
}));
const stats19 = { termCount: 1, totalPostings: 1, avgPostingsPerTerm: 1, maxPostingsForTerm: 1, uncoveredTerms: [] };
const health19 = healthCheck(critEvents19, stats19, 86400000);
assert(health19.status === 'critical', `3.6 critical: ${health19.status}`);
assert(health19.recommendations.length > 0, '3.6 has recommendations');

const high20 = { totalQueries: 10, hitRate: 0.8, avgLatencyMs: 50, satisfactionRate: 0.9, zeroResultRate: 0 };
const low20 = { totalQueries: 10, hitRate: 0.3, avgLatencyMs: 200, satisfactionRate: 0.3, zeroResultRate: 0.4 };
const longer20 = adaptiveHalfLife(86400000, high20);
const shorter20 = adaptiveHalfLife(86400000, low20);
assert(longer20 > 86400000, `3.7 longer: ${longer20}`);
assert(shorter20 < 86400000, `3.7 shorter: ${shorter20}`);

// ─══════════════════════════════════════════════════════════════════════════════
// §4 COUNCIL GLYPH PROTOCOL TESTS
// ─══════════════════════════════════════════════════════════════════════════════

section('§4 Council Glyph Protocol');

const raw21 = '⊕↑↗ { 0.6, 0.2, 0.1, 0.1 }\nSolution path is sound';
const { glyph: g21, issues: i21 } = parseGlyphPacket(raw21, 'model-1');
assert(g21 !== null, '4.1 parsed');
assert(g21!.stance === '⊕', '4.1 stance');
assert(g21!.confidence === '↑', '4.1 confidence');
assert(g21!.strategy === '↗', '4.1 strategy');
assertClose(g21!.distribution.explore, 0.6, 0.01, '4.1 distribution');
assert(i21.length === 0, '4.1 no issues');

const { glyph: g22, issues: i22 } = parseGlyphPacket('X↑↗ { 0.6, 0.2, 0.1, 0.1 }\nTest', 'm1');
assert(g22 === null, '4.2 rejected');
assert(i22.some(i => i.code === 'INVALID_STANCE'), '4.2 invalid stance');

const { glyph: g23 } = parseGlyphPacket('⊕↑↗\nNo distribution', 'm1');
assert(g23 === null, '4.3 missing dist rejected');

const { glyph: g24, issues: i24 } = parseGlyphPacket('⊕↑↗ { 0.5, -0.2, 0.5, 0.2 }\nTest', 'm1');
assert(g24 === null, '4.4 negative rejected');
assert(i24.some(i => i.code === 'NEGATIVE_DISTRIBUTION_VALUE'), '4.4 negative issue');

const { glyph: g25, issues: i25 } = parseGlyphPacket('⊕⇊↗ { 0.5, 0.2, 0.2, 0.1 }\nProbably fine', 'm1');
assert(g25 !== null, '4.5 corrected');
assert(g25!.stance === '⊙', `4.5 stance corrected to ⊙, got ${g25!.stance}`);
assert(g25!.confidence === '↓', '4.5 confidence corrected');
assert(i25.some(i => i.code === 'STANCE_CONFIDENCE_CONTRADICTION'), '4.5 logged');

const longHyp26 = 'a'.repeat(200);
const { glyph: g26, issues: i26 } = parseGlyphPacket(`⊕↑↗ { 0.5, 0.2, 0.2, 0.1 }\n${longHyp26}`, 'm1');
assert(g26 !== null, '4.6 parsed');
assert(g26!.hypothesis.length === 120, `4.6 truncated: ${g26!.hypothesis.length}`);
assert(i26.some(i => i.code === 'HYPOTHESIS_TRUNCATED'), '4.6 logged');

const { glyph: g27a } = parseGlyphPacket('⊕↑↗ { 0.25, 0.25, 0.25, 0.25 }\nA', 'm1');
const { glyph: g27b } = parseGlyphPacket('⊕↑↗ { 0.25, 0.25, 0.25, 0.25 }\nB', 'm2');
assert(computeCoherence([g27a!, g27b!]) === 1.0, '4.7 identical = 1.0');

const { glyph: g28a } = parseGlyphPacket('⊕↑↗ { 0.9, 0.0, 0.1, 0.0 }\nExplore', 'm1');
const { glyph: g28b } = parseGlyphPacket('⊖↓↙ { 0.0, 0.0, 0.9, 0.1 }\nVerify', 'm2');
assert(computeCoherence([g28a!, g28b!]) < 0.5, '4.8 divergent < 0.5');

const glyphs29: ParsedGlyph[] = [
  makeGlyph('m1', '⊕', '↑', '↗', [0.31, 0.29, 0.20, 0.20]),
  makeGlyph('m2', '⊕', '↑', '↗', [0.30, 0.30, 0.20, 0.20]),
  makeGlyph('m3', '⊕', '↑', '↗', [0.29, 0.31, 0.20, 0.20]),
];
assert(detectPhaseLock(glyphs29, 0.05), '4.9 phase lock detected');

const glyphs30: ParsedGlyph[] = [
  makeGlyph('m1', '⊚', '→', '⇄', [0, 0, 0, 1]),
  makeGlyph('m2', '⊚', '→', '⇄', [0, 0, 0, 1]),
  makeGlyph('m3', '⊚', '→', '⇄', [0, 0, 0, 1]),
  makeGlyph('m4', '⊚', '→', '⇄', [0, 0, 0, 1]),
];
assert(isMajorityNeutral(glyphs30, 4), '4.10 majority neutral');

const history31 = [
  { winningModelId: 'm1', timestampMs: 1 }, { winningModelId: 'm1', timestampMs: 2 },
  { winningModelId: 'm1', timestampMs: 3 }, { winningModelId: 'm1', timestampMs: 4 },
  { winningModelId: 'm1', timestampMs: 5 }, { winningModelId: 'm1', timestampMs: 6 },
];
assert(checkWinnerStreak(history31, 5), '4.11 streak detected');

assert(vkKronosDecide(0.2, false, false, false) === 'QUARANTINE', '4.12 low coherence');
assert(vkKronosDecide(0.8, true, false, false) === 'FORCE_DIVERSITY', '4.13 phase lock');
assert(vkKronosDecide(0.8, false, true, false) === 'STRIP_REPLAY', '4.14 majority neutral');
assert(vkKronosDecide(0.8, false, false, true) === 'BOOST_CONTRARIAN', '4.15 streak');
assert(vkKronosDecide(0.8, false, false, false) === 'PASS', '4.16 all clear');
assert(vkKronosDecide(0.5, false, false, false) === 'PROCEED_WITH_CAUTION', '4.17 caution');

const responses32: Record<string, string> = {
  'm1': '⊕↑↗ { 0.6, 0.2, 0.1, 0.1 }\nCorrect',
  'm2': '⊕↑↗ { 0.5, 0.3, 0.1, 0.1 }\nAgree',
  'm3': '⊙→↙ { 0.2, 0.2, 0.5, 0.1 }\nVerify',
};
const result32 = councilDeliberate(responses32);
assert(result32.verdict !== undefined, '4.18 verdict');
assert(result32.glyphs.length === 3, '4.18 3 glyphs');

const glyphs33: ParsedGlyph[] = [
  makeGlyph('m1', '⊕', '⇈', '↗', [0.6, 0.2, 0.1, 0.1]),
  makeGlyph('m2', '⊕', '↑', '↗', [0.5, 0.3, 0.1, 0.1]),
  makeGlyph('m3', '⊕', '↑', '↘', [0.4, 0.4, 0.1, 0.1]),
];
const verdict33 = computeVerdict(glyphs33);
assert(verdict33.verdict === 'APPROVED', `4.19 approved: ${verdict33.verdict}`);

const glyphs34: ParsedGlyph[] = [
  makeGlyph('m1', '⊕', '↑', '↗', [0.6, 0.2, 0.1, 0.1]),
  makeGlyph('m2', '⊖', '↑', '↙', [0.1, 0.1, 0.6, 0.2]),
];
const agg34 = aggregateDistribution(glyphs34);
const sum34 = agg34.explore + agg34.exploit + agg34.verify + agg34.abstain;
assertClose(sum34, 1.0, 0.001, '4.20 distribution sums to 1');

// ─══════════════════════════════════════════════════════════════════════════════
// §5 SWARM TESTS
// ─══════════════════════════════════════════════════════════════════════════════

section('§5 Swarm');

const swarm35 = createSwarm();
assert(swarm35.length === 6, `5.1 6 nodes: ${swarm35.length}`);
const roles35 = new Set(swarm35.map(n => n.role));
assert(roles35.size > 1, '5.1 diverse roles');

const glyph36 = generateNodeGlyph(swarm35[0], 'test memory operation', 0);
assert(glyph36.length > 10, '5.2 glyph length');
assert(glyph36.includes('{'), '5.2 has brace');
assert(glyph36.includes('}'), '5.2 has brace');

const record37 = makeRecord('The golden ratio is approximately 1.618');
const quizzes37 = generateQuizzes('n1', 'n2', record37, Date.now());
assert(quizzes37.length > 0, '5.3 quizzes generated');
assert(quizzes37[0].fromNode === 'n1', '5.3 from');
assert(quizzes37[0].toNode === 'n2', '5.3 to');

const score38 = scoreQuiz('exact answer', 'exact answer');
assert(score38.correct && score38.confidence === 1, '5.4 exact');

const score39 = scoreQuiz('wrong', 'the correct answer');
assert(!score39.correct, '5.5 wrong');

const quizResults40 = [
  { quiz: { fromNode: 'n1', toNode: 'n2', question: 'q1', expectedAnswer: 'a', scope: 'test', timestampMs: 0 }, answer: 'a', correct: true, confidence: 1, responseTimeMs: 100 },
  { quiz: { fromNode: 'n2', toNode: 'n1', question: 'q2', expectedAnswer: 'b', scope: 'test', timestampMs: 0 }, answer: 'x', correct: false, confidence: 0, responseTimeMs: 100 },
];
const health40 = swarmQuizHealth(quizResults40);
assert(health40.accuracy === 0.5, `5.6 accuracy: ${health40.accuracy}`);
assert(health40.strongestNode !== null, '5.6 strongest');
assert(health40.weakestNode !== null, '5.6 weakest');

// ─══════════════════════════════════════════════════════════════════════════════
// §6 ARC-3 MEMORY REASONING TESTS
// ─══════════════════════════════════════════════════════════════════════════════

section('§6 ARC-3 Memory Reasoning');

assert(PRINCIPLES.length === 7, `6.1 7 principles: ${PRINCIPLES.length}`);
assert(PRINCIPLES[0].id === 'P1', '6.1 P1');
assert(PRINCIPLES[6].id === 'P7', '6.1 P7');
assert(ARC3_VERSION !== undefined, '6.2 version');

const rA43 = makeRecord('The golden ratio governs decay');
const rB43 = makeRecord('The golden ratio governs decay');
const t43 = detectTransformation(rA43, rB43);
assert(t43.type === 'identity', `6.3 identity: ${t43.type}`);
assert(t43.tildeScore < 0.05, '6.3 low distance');

const rA44 = makeRecord('PHI_INV equals 0.618');
const rB44 = makeRecord('PHI_INV equals 99.999 and the sky is green');
const t44 = detectTransformation(rA44, rB44);
assert(t44.type === 'contradiction', `6.4 contradiction: ${t44.type}`);
assert(t44.tildeScore > 0.6, `6.4 high distance: ${t44.tildeScore}`);

const sig45 = structureSignature(makeRecord('The quick brown fox jumps over 13 lazy dogs.'));
assert(sig45.wordCount > 0, '6.5 word count');
assert(sig45.hasNumbers, '6.5 has numbers');
assert(!sig45.hasQuestions, '6.5 no questions');

const target46 = makeRecord('First: verify boundary. Then: check invariants.');
const candidates46 = [
  makeRecord('Step one: validate edge cases. Step two: confirm constraints.'),
  makeRecord('Cats and dogs running around the park freely'),
  makeRecord('Phase 1: test limits. Phase 2: assert properties hold.'),
];
const iso46 = findIsomorphic(target46, candidates46, 0.3);
assert(iso46.length > 0, `6.6 found: ${iso46.length}`);
assert(iso46[0].similarity > 0.3, '6.6 similarity');

const a47 = makeRecord('Small red circle');
const b47 = makeRecord('Large red circle');
const c47 = makeRecord('Small blue square');
const d47 = [makeRecord('Large blue square'), makeRecord('Tiny green triangle'), makeRecord('Small blue square')];
const ans47 = solveAnalogy(a47, b47, c47, d47);
assert(ans47.confidence > 0, `6.7 confidence: ${ans47.confidence}`);
assert(ans47.reasoning.length > 0, '6.7 reasoning');

const query48 = 'What is the golden ratio?';
const memories48 = [
  makeRecord('PHI is the golden ratio, approximately 1.618'),
  makeRecord('PHI_INV is the inverse, approximately 0.618'),
  makeRecord('The golden ratio appears in nature and art'),
];
const reason48 = reasonAboutMemory(query48, memories48);
assert(reason48.conclusion.length > 0, '6.8 conclusion');
assert(reason48.confidence > 0, '6.8 confidence');
assert(reason48.chain.length > 0, '6.8 chain');

const reason49 = reasonAboutMemory('test', []);
assert(reason49.conclusion.includes('Insufficient'), `6.9: ${reason49.conclusion}`);
assert(reason49.confidence < 0.2, '6.9 low confidence');

// ─══════════════════════════════════════════════════════════════════════════════
// §7 CONVERGENCE INTEGRATION TESTS
// ─══════════════════════════════════════════════════════════════════════════════

section('§7 Convergence Integration');

// 7.1 Full pipeline
const records50 = makeRecords([
  'Identity: organism has maternal anchor',
  'Architecture: six gates enforce recursion',
  'Evidence: receipts form chain of custody',
  'Memory: KIRA stores content-addressed observations',
  'Council: VYMAKIRA governs deliberations',
]);
const index50 = buildIndex(records50);
assert(Object.keys(index50).length > 0, '7.1 index built');

const results50 = recallIndexed(records50, index50, 'council');
assert(results50.length > 0, `7.1 recall works: ${results50.length} results`);

const now50 = Date.now();
const recordIds50 = records50.map(r => r.recordId);
const createdAtMap50: Record<string, number> = {};
for (let i = 0; i < records50.length; i++) createdAtMap50[recordIds50[i]] = now50 - i * 3600_000;
const envelopes50 = buildEnvelopes(recordIds50, createdAtMap50);
const relScores50 = scoreRelevance(envelopes50, now50);
assert(relScores50.length === 5, '7.1 relevance scores');
assert(relScores50.every(s => s.relevance >= RELEVANCE_FLOOR), '7.1 floor');

const responses50: Record<string, string> = {
  'm1': '⊕↑↗ { 0.5, 0.3, 0.1, 0.1 }\nIndex improves recall',
  'm2': '⊕↑↘ { 0.2, 0.5, 0.2, 0.1 }\nReady to deploy',
  'm3': '⊙→↙ { 0.2, 0.1, 0.5, 0.2 }\nNeed benchmarks',
};
const council50 = councilDeliberate(responses50, [], now50);
assert(council50.verdict !== undefined, '7.1 verdict');
assert(council50.glyphs.length === 3, '7.1 glyphs');

const swarm50 = createSwarm();
const quizzes50 = runQuizRound(swarm50, records50, now50);
assert(quizzes50.length > 0, '7.1 quizzes');
const qHealth50 = swarmQuizHealth(quizzes50);
assert(qHealth50.accuracy >= 0 && qHealth50.accuracy <= 1, '7.1 health');

// 7.2 ARC-3 + index
const records51 = makeRecords([
  'Structural Isomorphism: same structure same solution',
  'Symmetry Exploitation: grid symmetries reduce search',
  'Locality Principle: adjacent cells influence',
]);
const index51 = buildIndex(records51);
const qr51 = recallIndexed(records51, index51, 'grid transformation');
const rel51 = qr51.map(r => records51.find(rec => rec.recordId === r.recordId)).filter((r): r is MemoryRecordV1 => r !== undefined);
const reasoning51 = reasonAboutMemory('grid transformations', rel51);
assert(reasoning51.conclusion.length > 0, '7.2 conclusion');
assert(reasoning51.chain.length > 0, '7.2 chain');

// 7.3 Contradiction → shear
const rA52 = makeRecord('half-life is 24 hours');
const rB52 = makeRecord('half-life is 5 minutes');
const t52 = detectTransformation(rA52, rB52);
assert(t52.type === 'contradiction', '7.3 contradiction');
const shear52 = createShear(rB52.recordId, rB52.content, rA52.recordId, rA52.content, now50);
assert(shear52.magnitude > 0.5, '7.3 shear magnitude');

// 7.4 Self-optimization feedback
const events53: QueryEvent[] = [
  { queryText: 'i', resultsCount: 5, top5HitsUsed: 4, latencyMs: 50, satisfied: true },
  { queryText: 'a', resultsCount: 3, top5HitsUsed: 2, latencyMs: 80, satisfied: true },
  { queryText: 'i', resultsCount: 1, top5HitsUsed: 0, latencyMs: 120, satisfied: false },
  { queryText: 'm', resultsCount: 0, top5HitsUsed: 0, latencyMs: 200, satisfied: false },
];
const stats53 = indexStats(records50, index50);
const health53 = healthCheck(events53, stats53, 86400000);
assert(health53.status !== undefined, '7.4 status');
assert(health53.recommendations.length > 0, '7.4 recommendations');
assert(health53.adaptiveHalfLifeMs > 0, '7.4 adaptive');

// 7.5 Decision matrix
assert(vkKronosDecide(0.2, false, false, false) === 'QUARANTINE', '7.5');
assert(vkKronosDecide(0.8, true, false, false) === 'FORCE_DIVERSITY', '7.5');
assert(vkKronosDecide(0.8, false, true, false) === 'STRIP_REPLAY', '7.5');
assert(vkKronosDecide(0.8, false, false, true) === 'BOOST_CONTRARIAN', '7.5');
assert(vkKronosDecide(0.8, false, false, false) === 'PASS', '7.5');
assert(vkKronosDecide(0.5, false, false, false) === 'PROCEED_WITH_CAUTION', '7.5');

// 7.6 Principles
const names54 = PRINCIPLES.map(p => p.name);
assert(names54.includes('Structural Isomorphism'), '7.6 P1');
assert(names54.includes('Transformation Closure'), '7.6 P2');
assert(names54.includes('Edge Conservation'), '7.6 P3');
assert(names54.includes('Color Invariance'), '7.6 P4');
assert(names54.includes('Symmetry Exploitation'), '7.6 P5');
assert(names54.includes('Locality Principle'), '7.6 P6');
assert(names54.includes('Compositional Reasoning'), '7.6 P7');

// 7.7 Golden ratio consistency
assertClose(PHI * PHI_INV, 1.0, 1e-10, '7.7 PHI * PHI_INV = 1');
assertClose(PHI - 1, PHI_INV, 1e-10, '7.7 PHI - 1 = PHI_INV');
assertClose(PHI * PHI, PHI + 1, 1e-10, '7.7 PHI² = PHI + 1');

// 7.8 Advisory-only
const record55 = makeRecord('Test');
assert(record55.advisoryOnly === true, '7.8 advisory');
assert(record55.grantsAuthority === false, '7.8 no authority');
const validated55 = validateMemoryRecord(record55);
assert(validated55 !== null, '7.8 valid');
assert(validated55!.advisoryOnly === true, '7.8 validated advisory');
assert(validated55!.grantsAuthority === false, '7.8 validated no authority');

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(60)}`);
console.log('  AUKORA CONVERGENCE TEST RESULTS');
console.log(`${'═'.repeat(60)}`);
console.log(`  Total:  ${results.passed + results.failed}`);
console.log(`  Passed: ${results.passed}`);
console.log(`  Failed: ${results.failed}`);
console.log(`${'═'.repeat(60)}`);

if (results.failed > 0) {
  console.log('\n  Failures:');
  for (const f of results.failures) console.log(`    ❌ ${f}`);
  process.exit(1);
} else {
  console.log('\n  ALL TESTS PASSED ✓');
  console.log(`  Modules: searchIndex, decay, selfOptimize, council, swarm, arc3Memory`);
  console.log(`  Sections: 7 | Assertions: ${results.passed}`);
  console.log(`${'═'.repeat(60)}\n`);
}
