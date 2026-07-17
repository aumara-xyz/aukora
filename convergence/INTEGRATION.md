# Aukora Convergence — Integration Guide

**Target:** Aukora v10.0.0-PHOENIX | **Source:** KIMI Convergence Session | **Status:** 156/156 tests passing

---

## Table of Contents

1. [Step-by-Step Integration](#step-by-step-integration)
2. [Module Usage Examples](#module-usage-examples)
3. [VK Kronos Decision Matrix Reference](#vk-kronos-decision-matrix-reference)
4. [How to Extend](#how-to-extend)
5. [Troubleshooting](#troubleshooting)

---

## Step-by-Step Integration

### Step 1: Copy Files

**Memory package** — copy 3 files into `packages/memory/src/`:
```bash
cp searchIndex.ts packages/memory/src/
cp decay.ts packages/memory/src/
cp selfOptimize.ts packages/memory/src/
```

**Mind package** — copy 3 files into `packages/mind/src/`:
```bash
cp council.ts packages/mind/src/
cp swarm.ts packages/mind/src/
cp arc3Memory.ts packages/mind/src/
```

**Test runner** — copy to `packages/mind/test/`:
```bash
cp convergence.run.ts packages/mind/test/
```

### Step 2: Update Barrel Exports

**`packages/memory/index.ts`** — add these exports:
```typescript
// Convergence: memory indexing + decay + self-optimization
export * from './src/searchIndex.js';
export * from './src/decay.js';
export * from './src/selfOptimize.js';
```

**`packages/mind/index.ts`** — add these exports:
```typescript
// Convergence: council governance + swarm + ARC-3 reasoning
export * from './src/council.js';
export * from './src/swarm.js';
export * from './src/arc3Memory.js';
```

### Step 3: Build and Test

```bash
# Build the kernel (from repo root)
cd /path/to/aukora
npm run build

# Run convergence tests
cd packages/mind
npx tsx test/convergence.run.ts
```

Expected output:
```
━━ §1 Search Index           ━━  8/8   PASS
━━ §2 φ-Decay SHEAR Engine   ━━  13/13 PASS
━━ §3 Self-Optimization      ━━  7/7   PASS
━━ §4 Council Glyph Protocol  ━━  20/20 PASS
━━ §5 Swarm                  ━━  6/6   PASS
━━ §6 ARC-3 Memory Reasoning  ━━  9/9   PASS
━━ §7 Convergence Integration ━━  8/8   PASS
═══════════════════════════════════════════════════════════
Total: 156 assertions | Passed: 156 | Failed: 0
```

### Step 4: Verify Integration Points

The convergence modules integrate with these existing Aukora components:

| Existing Component | Integration Point | How |
|-------------------|-------------------|-----|
| `envelope.ts` (MemoryRecordV1) | Index, decay, ARC-3 all consume records | Direct import |
| `recall.ts` | `recallIndexed()` is drop-in performance upgrade | Replace or augment |
| `governor.ts` | Council deliberates on patches before governor | Pre-filter via VK Kronos |
| `grid.ts` | Swarm nodes map to grid cells | SwarmDeliberation output |
| `plan.ts` | ARC-3 reasoning feeds into plan generation | `reasonAboutMemory()` output |

---

## Module Usage Examples

### Example 1: Build an Index and Query It

```typescript
import { buildMemoryRecord } from '@aukora/memory/envelope';
import { buildIndex, recallIndexed } from '@aukora/memory/searchIndex';

// Create some memory records
const records = [
  buildMemoryRecord({ content: 'The golden ratio governs memory decay', kind: 'observation', consent: 'private', provenance: 'test' }),
  buildMemoryRecord({ content: 'Council governance uses glyph packets', kind: 'observation', consent: 'private', provenance: 'test' }),
  buildMemoryRecord({ content: 'PHI_INV is the relevance floor at 0.618', kind: 'observation', consent: 'private', provenance: 'test' }),
];

// Build inverted index
const index = buildIndex(records);

// Query: O(1) lookup instead of O(n) scan
const results = recallIndexed(records, index, 'golden ratio');
// → [{ recordId: "...", score: 2.41 }]
```

### Example 2: Apply φ-Decay to Memories

```typescript
import { phiDecay, buildEnvelopes, scoreRelevance, RELEVANCE_FLOOR } from '@aukora/memory/decay';

const now = Date.now();
const halfLifeMs = 24 * 60 * 60 * 1000; // 24 hours

// Build decay envelopes from records
const recordIds = records.map(r => r.recordId);
const createdAtMap = Object.fromEntries(records.map(r => [r.recordId, now - r.ageMs]));
const envelopes = buildEnvelopes(recordIds, createdAtMap, halfLifeMs);

// Score relevance (memories naturally age)
const scores = scoreRelevance(envelopes, now);
// → [{ recordId: "...", relevance: 0.95, ageMs: 3600000, sheared: false }, ...]

// All scores are ≥ PHI_INV (memories never fully disappear)
assert(scores.every(s => s.relevance >= RELEVANCE_FLOOR));
```

### Example 3: Detect Contradictions and Apply Shear

```typescript
import { tilde, carat, createShear, detectTransformation } from '@aukora/memory/decay';
import { detectTransformation as arc3Detect } from '@aukora/mind/arc3Memory';

// Two contradicting memories
const memA = buildMemoryRecord({ content: 'The half-life is 24 hours' });
const memB = buildMemoryRecord({ content: 'The half-life is 5 minutes' });

// Detect transformation type
const transform = arc3Detect(memA, memB);
// → { type: 'contradiction', tildeScore: 0.72, principlesApplied: ['P3', 'P7'] }

// Measure cognitive distance
const dist = tilde(memA.content, memB.content);
// → 0.72 (high distance = contradiction)

// Create shear object (contradiction accelerates decay of the old memory)
const shear = createShear(memB.recordId, memB.content, memA.recordId, memA.content, Date.now());
// → { id: "shear_...", magnitude: 0.72, contradictorId: "..." }
```

### Example 4: Run Council Deliberation

```typescript
import { councilDeliberate } from '@aukora/mind/council';

// Collect glyph packets from each model
const responses: Record<string, string> = {
  'm1': '⊕↑↗ { 0.6, 0.2, 0.1, 0.1 }\nThe indexing approach improves recall performance',
  'm2': '⊕↑↘ { 0.2, 0.5, 0.2, 0.1 }\nReady to deploy after benchmarks',
  'm3': '⊙→↙ { 0.2, 0.1, 0.5, 0.2 }\nNeed verification on edge cases',
};

// Run full deliberation pipeline
const result = councilDeliberate(responses, [], Date.now());
// → {
//   verdict: 'APPROVED',
//   confidence: 0.82,
//   glyphs: [ParsedGlyph, ParsedGlyph, ParsedGlyph],
//   securityDecision: { action: 'PASS', coherenceScore: 0.85, ... },
//   aggregateDistribution: { explore: 0.33, exploit: 0.27, verify: 0.27, abstain: 0.13 },
//   reasoning: "Council: 3 models, coherence 0.850\nSecurity: PASS..."
// }
```

### Example 5: Run Swarm Quiz Round

```typescript
import { createSwarm, runQuizRound, swarmQuizHealth } from '@aukora/mind/swarm';

// Create 6-node swarm
const swarm = createSwarm();

// Have nodes quiz each other on memory contents
const quizResults = runQuizRound(swarm, records, Date.now());
// → 90 quiz responses (6 nodes × 5 others × 3 quizzes each)

// Check swarm health
const health = swarmQuizHealth(quizResults);
// → { accuracy: 0.78, avgConfidence: 0.81, weakestNode: 'k3-gamma', strongestNode: 'k3-alpha' }
```

### Example 6: ARC-3 Reasoning About Memory

```typescript
import { reasonAboutMemory, solveAnalogy, findIsomorphic } from '@aukora/mind/arc3Memory';

// Reason about a query using stored memories
const query = 'What governs memory decay?';
const relevantMemories = [
  buildMemoryRecord({ content: 'The golden ratio PHI approximately 1.618 governs the decay curve' }),
  buildMemoryRecord({ content: 'PHI_INV at 0.618 is the relevance floor — memories never decay below this' }),
  buildMemoryRecord({ content: 'The half-life parameter controls how quickly memories age' }),
];

const result = reasonAboutMemory(query, relevantMemories);
// → {
//   conclusion: "Based on 3 memories... PHI governs the decay curve with floor at PHI_INV",
//   confidence: 0.85,
//   chain: [
//     { step: 1, operation: "Locality search", principle: "P6", result: "Found 3 relevant memories" },
//     { step: 2, operation: "Pattern detection", principle: "P1", result: "composition: ..." },
//     { step: 3, operation: "Compositional synthesis", principle: "P7", result: "Synthesized 3 memories into answer" }
//   ]
// }

// Solve analogy: A is to B as C is to ?
const a = buildMemoryRecord({ content: 'Small red circle' });
const b = buildMemoryRecord({ content: 'Large red circle' });
const c = buildMemoryRecord({ content: 'Small blue square' });
const dCandidates = [buildMemoryRecord({ content: 'Large blue square' }), /* ... */];

const analogy = solveAnalogy(a, b, c, dCandidates);
// → { answer: MemoryRecordV1, confidence: 0.72, reasoning: "A→B is specialization..." }
```

### Example 7: Self-Optimization Feedback Loop

```typescript
import { healthCheck } from '@aukora/memory/selfOptimize';
import { indexStats } from '@aukora/memory/searchIndex';

// Build index and get stats
const index = buildIndex(records);
const stats = indexStats(records, index);

// Collect query events from your application
const events: QueryEvent[] = [
  { queryText: 'golden ratio', resultsCount: 5, top5HitsUsed: 4, latencyMs: 50, satisfied: true },
  { queryText: 'council protocol', resultsCount: 3, top5HitsUsed: 2, latencyMs: 80, satisfied: true },
  { queryText: 'memory decay', resultsCount: 0, top5HitsUsed: 0, latencyMs: 200, satisfied: false },
];

// Run health check
const health = healthCheck(events, stats, 86400000);
// → {
//   status: 'degraded',
//   metrics: { totalQueries: 3, hitRate: 0.4, satisfactionRate: 0.67, zeroResultRate: 0.33 },
//   recommendations: [
//     { action: 'rebuild_index', reason: "Zero-result rate 33.3% exceeds 20%...", priority: 0.33, expectedImprovement: 0.23 }
//   ],
//   adaptiveHalfLifeMs: 53344500
// }
```

---

## VK Kronos Decision Matrix Reference

### Complete State Table

All 24 input states and their resulting actions:

| Coherence | PhaseLock | MajorityNeutral | StreakViolation | Action |
|-----------|-----------|-----------------|-----------------|--------|
| < 0.3 | any | any | any | **QUARANTINE** |
| ≥ 0.3 | true | any | any | **FORCE_DIVERSITY** |
| ≥ 0.3 | false | true | any | **STRIP_REPLAY** |
| ≥ 0.3 | false | false | true | **BOOST_CONTRARIAN** |
| ≥ 0.7 | false | false | false | **PASS** |
| 0.4–0.7 | false | false | false | **PROCEED_WITH_CAUTION** |
| < 0.4 | false | false | false | **QUARANTINE** |

### Action Meanings

| Action | What Happens | When to Use |
|--------|-------------|-------------|
| `PASS` | Council verdict proceeds normally | Coherence > 0.7, no anomalies |
| `QUARANTINE` | Verdict forced to REJECTED | Coherence < 0.3 or marginal with no other signals |
| `FORCE_DIVERSITY` | Inject contrarian perspectives | All models agree too much (phase-lock) |
| `STRIP_REPLAY` | Remove abstaining/neutral votes | Majority voting without informed opinions |
| `BOOST_CONTRARIAN` | Weight opposing views higher | One model winning 5+ consecutive rounds |
| `PROCEED_WITH_CAUTION` | Verdict proceeds with warning | Marginal coherence (0.4–0.7) |

### Coherence Thresholds

```
1.0 ┤                                    ╭────── GREEN (PASS)
    │                              ╭────╯
0.7 ┤                        ╭────╯      ╭────── YELLOW (PROCEED_WITH_CAUTION)
    │                  ╭────╯      ╭────╯
0.4 ┤            ╭────╯      ╭────╯            ╭────── RED (QUARANTINE)
    │      ╭────╯      ╭────╯            ╭────╯
0.3 ┤╭────╯      ╭────╯            ╭────╯
    │╯      ╭────╯            ╭────╯
  0 ┤──────╯            ╭────╯
    │               ╭───╯
    └───────┬───────┬───────┬───────┬───────┬───
            │       │       │       │       │
           PASS   CAUTION QUARANTINE FORCE STRIP BOOST
```

### Glyph Confidence Weights

| Glyph | Weight | Meaning |
|-------|--------|---------|
| ⇈ | 1.0 | Certain |
| ↑ | 0.8 | Likely |
| → | 0.5 | Neutral |
| ↓ | 0.2 | Uncertain |
| ⇊ | 0.05 | Guess |

### Stance Weights

| Glyph | Weight | Meaning |
|-------|--------|---------|
| ⊕ | +1.0 | Endorse |
| ⊖ | −1.0 | Oppose |
| ⊙ | 0.0 | Observe |
| ⊘ | −2.0 | Veto |
| ⊚ | 0.0 | Abstain |

---

## How to Extend

### Adding a New Node Type

Edit `swarm.ts` — the `SwarmNode` interface uses a discriminated union for roles:

```typescript
// Add your new role to the union:
type NodeRole = 'indexer' | 'contradiction_hunter' | 'relevance_scorer' | 'generalist' | 'your_new_role';

// Add accuracy in simulateNodeAnswer():
const accuracy: Record<string, number> = {
  indexer: 0.9,
  contradiction_hunter: 0.85,
  relevance_scorer: 0.8,
  generalist: 0.75,
  your_new_role: 0.88, // your accuracy here
};

// Add glyph style in generateNodeGlyph():
const styles: Record<string, () => string> = {
  // ... existing styles ...
  your_style: () => {
    return `⊕↑↗ { 0.4, 0.2, 0.3, 0.1 }\nYour reasoning here`;
  },
};
```

### Adding a New ARC-3 Principle

Edit `arc3Memory.ts` — principles are a readonly array:

```typescript
export const PRINCIPLES: readonly Principle[] = [
  // ... existing 7 principles ...
  { id: 'P8', name: 'Your Principle', description: 'What it means' },
];
```

Then reference it in `detectTransformation()`:

```typescript
if (yourCondition) {
  return {
    type: 'your_transformation',
    description: 'What happened',
    tildeScore: dist,
    principlesApplied: ['P8', 'P2'],
  };
}
```

### Adding a New Self-Optimization Rule

Edit `selfOptimize.ts` — add a rule in the `selfOptimize()` function:

```typescript
// Rule 5: Your custom condition
if (metrics.yourMetric > yourThreshold) {
  recommendations.push({
    action: 'your_action', // or add to TuningRecommendation union
    reason: `Your condition triggered: ${metrics.yourMetric}`,
    priority: 0.6,
    expectedImprovement: 0.25,
  });
}
```

To add a new action type, extend the union:

```typescript
export type TuningAction = 'rebuild_index' | 'extend_half_life' | 'shorten_half_life' | 'add_shear' | 'no_change' | 'your_action';
```

### Adding a New VK Kronos State

Edit `council.ts` — the decision matrix is in priority order:

```typescript
export function vkKronosDecide(
  coherenceScore: number,
  phaseLocked: boolean,
  majorityNeutral: boolean,
  streakViolation: boolean,
  // Add new parameter:
  yourCondition: boolean,
): SecurityAction {
  // Insert at appropriate priority level:
  if (yourCondition) return 'YOUR_ACTION';
  // ... existing rules ...
}
```

Add the new action to the union:

```typescript
export type SecurityAction = 'PASS' | 'QUARANTINE' | 'STRIP_REPLAY' | 'FORCE_DIVERSITY' | 'BOOST_CONTRARIAN' | 'PROCEED_WITH_CAUTION' | 'YOUR_ACTION';
```

### Adding New Index Scoring

Edit `searchIndex.ts` — the scoring function is pluggable:

```typescript
// Current: TF-only scoring
export function scoreTerm(posting: Posting): number {
  return 1 + Math.log(1 + posting.termFrequency);
}

// You could add IDF or BM25 variants:
export function scoreTermBM25(posting: Posting, idf: number, k1: number = 1.2, b: number = 0.75): number {
  const tf = posting.termFrequency;
  return idf * ((tf * (k1 + 1)) / (tf + k1));
}
```

### Adding Custom Tokenization

Edit `searchIndex.ts` — the `tokenize()` function can be swapped:

```typescript
// Current: alphanumeric, min 2 chars, stopwords removed
export function tokenize(content: string): readonly string[] {
  // Your custom tokenization here
}

// Example: Add n-gram support
export function tokenizeNgrams(content: string, n: number = 2): readonly string[] {
  const terms = tokenize(content);
  const ngrams: string[] = [];
  for (let i = 0; i <= terms.length - n; i++) {
    ngrams.push(terms.slice(i, i + n).join('_'));
  }
  return ngrams;
}
```

---

## Troubleshooting

### Import errors

If you get module resolution errors, check that:
1. The barrel exports are added to `packages/memory/index.ts` and `packages/mind/index.ts`
2. The `.js` extension is used in imports (TypeScript ESM requires this)
3. The build output includes the new files

### Test failures

If individual tests fail:
1. Check that `envelope.ts` exports haven't changed (tests depend on `buildMemoryRecord`, `validateMemoryRecord`, `deriveRecordId`)
2. Verify PHI constant precision: `assert(PHI === 1.618033988749895)`
3. Check that `advisoryOnly` and `grantsAuthority` are set correctly on memory records

### Performance concerns

- `recallIndexed()` is O(postings for query terms) — typically much faster than O(n) scan
- For very large corpora (>100K records), consider rebuilding the index periodically
- The self-optimizer will recommend `rebuild_index` when zero-result rate exceeds 20%

---

## License

SPDX-License-Identifier: AGPL-3.0-or-later
Copyright (c) 2026 Aukora
