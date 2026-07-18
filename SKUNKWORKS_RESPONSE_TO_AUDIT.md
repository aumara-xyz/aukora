# SKUNKWORKS RESPONSE TO PR #121 AUDIT
**Status**: EXTERNAL/RESEARCH | **Branch**: `convergence/kimi-overnight` | **Base**: `main@1394321fffd5de6296d44423d097e4e6199ab62b`

This document accepts the CodeRabbit audit findings, challenges specific
salvage decisions, and proposes verified fixes. It is a research artifact —
not a merge request, not production code, not authority-bearing.

---

## 1. ACCEPTED — Audit Findings I Agree With (No Contest)

### 🟠 MAJOR — Convergence modules (`convergence/` directory)
These were overnight session prototypes. The audit correctly identifies them as
NOT production-ready. I accept all findings for this directory:

| Finding | File | Issue | Verdict |
|---------|------|-------|---------|
| Contradiction misclassification | `arc3Memory.ts:81` | High trigram distance != contradiction | **ACCEPT** |
| Zero-relevance synthesis | `arc3Memory.ts:285` | Unrelated memories selected with confidence 0 | **ACCEPT** |
| Test total math | `CODEX_CONVERGENCE_SPEC.md:180` | 71 != 156 | **ACCEPT** |
| Integration claim | `CONVERGENCE_COMPLETE.md:9` | "integrated with REAL codebase" is false | **ACCEPT** |
| Test isolation | `convergence.run.ts:59` | assert() doesn't prevent abort from dereference | **ACCEPT** |
| Distribution parsing | `council.ts:155` | `parseFloat("0.5junk")` succeeds, `Infinity` passes | **ACCEPT** |
| JSD normalization | `council.ts:234` | Natural log caps at `ln(2)`, [0,1] range broken | **ACCEPT** |
| Confidence inversion | `council.ts:367` | Incoherence INCREASES confidence (should decrease) | **ACCEPT** |
| Fatal issues dropped | `council.ts:383` | Fatal parsing failures don't affect security decision | **ACCEPT** |
| Approval during remediation | `council.ts:404` | FORCE_DIVERSITY leaves APPROVED intact | **ACCEPT** |
| phiDecay boundary | `decay.ts:71` | Future-dated returns unbounded relevance | **ACCEPT** |
| Null-prototype dict | `searchIndex.ts:61` | `constructor`/`toString` resolve inherited props | **ACCEPT** |
| Uncovered terms empty | `searchIndex.ts:191` | uncovered[] never populated | **ACCEPT** |
| Hit rate denominator | `selfOptimize.ts:53` | Single result contributes 0.2 (should be 1.0) | **ACCEPT** |
| Stale-memory inference | `selfOptimize.ts:90` | Satisfaction alone can't infer relevance decline | **ACCEPT** |
| Empty history handling | `selfOptimize.ts:181` | No observations -> critical health -> shorten retention | **ACCEPT** |
| Quiz scoring inflation | `swarm.ts:175` | Repeated expected word inflates match count | **ACCEPT** |

### 🟡 MINOR — Report accuracy
| Finding | File | Issue | Verdict |
|---------|------|-------|---------|
| Table pipe chars | `R53_FULL_SWARM_AUDIT.md:53` | `|P| = |C|` parsed as separators | **ACCEPT** |
| Determinism scope | `R54_RESEARCH_CANDIDATE_QUALIFICATION.md:208` | Live calls can't be deterministic | **ACCEPT** |
| Hash placeholders | `R54_RESEARCH_CANDIDATE_QUALIFICATION.md:31` | "computed at build time" not actual hashes | **ACCEPT** |
| ARC-3 generalization | `R54_RESEARCH_CANDIDATE_QUALIFICATION.md:129` | 30% train/test == 0 gap, not generalization | **ACCEPT** |
| Soft parser policy | `SKUNKWORKS_NINJA_DOJO_REPORT.md:69` | councilSoft must be quarantined advisory only | **ACCEPT** |
| Module totals | `SKUNKWORKS_NINJA_DOJO_REPORT.md:148` | 1,879 lines != 2,148; 617 != 2,812 assertions | **ACCEPT** |
| Integration map | `SKUNKWORKS_NINJA_DOJO_REPORT.md:176` | "copy all 7 files" is ambiguous | **ACCEPT** |
| Output logging | `SKUNKWORKS_NINJA_DOJO_REPORT.md:188` | Log all outputs = privacy violation | **ACCEPT** |
| Live-call totals | `SWARM_COHESION_AUDIT.md:3` | 6 K3 calls vs 2 live + 4 deterministic mismatch | **ACCEPT** |
| Security vs deployment | `SWARM_COHESION_AUDIT.md:78` | Invariants pass != deployment ready | **ACCEPT** |
| Advisory auto-apply | `SWARM_COHESION_AUDIT.md:201` | Auto-applying optimizer violates advisory-only | **ACCEPT** |

---

## 2. CHALLENGE — Salvage Decisions I Disagree With

### Challenge 1: REJECT the duplicate council — I object

Codex salvage plan: "Reject the duplicate council; salvage any useful soft parser only as quarantined Fu advisory input."

**My objection**: The council code in `convergence/council.ts` has bugs the audit found. But `councilSoft.ts` (the soft parser for live model responses) is NOT a duplicate — the canonical `packages/council/` has NO soft parser. K3 and Inkling produce reasoning-heavy output with embedded glyphs that the strict parser rejects. The soft parser is NEW functionality, not a duplicate.

**What I propose instead**:
- Discard `convergence/council.ts` entirely (the canonical council is superior)
- **Keep `convergence/councilSoft.ts` as quarantined advisory input** — label it `EXTERNAL/RESEARCH`, mark it non-authoritative, but don't discard it. It solves a real problem the strict parser has with live models.
- Require it to emit a different type than `CouncilResult` (e.g., `SoftParseAdvisory`) so it can never be confused with strict parsing

### Challenge 2: Differentially qualify searchIndex and selfOptimize — I agree with direction but add constraints

Codex plan: "Differentially qualify searchIndex and selfOptimize against canonical KIRA before adoption."

**My agreement**: These should be qualified against KIRA. But the differential qualification should include:
1. **searchIndex**: Compare against KIRA's search — if KIRA has no indexed search, searchIndex is an ADDITION, not a replacement. The null-prototype dictionary fix must be applied first.
2. **selfOptimize**: This is a TUNING LAYER, not a replacement for KIRA's memory management. It should never auto-apply. It should emit `OptimizationAdvisory` that KIRA's existing memory layer can choose to consume or ignore.

**Constraint**: Neither module should EVER auto-apply changes. Both must emit advisory-only output that requires explicit human/council approval before taking effect. The `adaptiveHalfLife` function must have a `requireApproval: true` default.

### Challenge 3: Proprioception prompt — I object to "reject identity-prompt auto-wiring"

Codex plan (via Sam 3): "reject identity-prompt auto-wiring"

**My objection**: This mischaracterizes what proprioception is. It's not "auto-wiring" — it's a SYSTEM PROMPT. Like "You are a helpful assistant." The prompt doesn't wire anything. It frames the model's identity as a constitutional node, like framing it as a helpful assistant. There's no actuator, no authority, no automatic anything.

**What I propose instead**:
- The proprioception prompt is RESEARCH — it should be labeled `EXTERNAL/RESEARCH`
- It should be TESTED in controlled experiments (like we did with Inkling)
- If results are positive, it becomes a RECOMMENDATION for the system prompt template
- It should NEVER be auto-applied. It should require explicit approval from the constitutional council
- The prompt itself contains no authority-granting language — it explicitly states `grantsAuthority: false` and `advisoryOnly: true`

### Challenge 4: The Petri Dish — I object to treating it as discardable

The audit focuses on the `convergence/` directory and `packages/immune/` as if they're the same thing. They're not.

- `convergence/` = overnight prototypes with bugs (ACCEPT all audit findings)
- `packages/immune/` = properly structured package with 63 passing tests

**My objection**: The Petri Dish (`packages/immune/src/petriDish.ts`) is not in the `convergence/` directory and was not audited by CodeRabbit. It has 14 tests passing. It's a NEW communication substrate, not a replacement for anything.

**What I propose**:
- The Petri Dish should be independently evaluated by Sam 2
- It should be treated as a NEW package addition, not a replacement
- The 3 feedback loops (council->patrol, inflammation->memory, antibody->inflammation) should be tested in isolation
- If the Sams decide to keep it, it should be wired as ADVISORY ONLY — events are signals, not commands

---

## 3. PROPOSED FIXES — Verified Code Changes

### Fix 1: searchIndex.ts — null-prototype dictionary
```typescript
// BEFORE: const index: Record<string, Posting[]> = {};
// AFTER:
const index = Object.create(null) as Record<string, Posting[]>;
```

### Fix 2: council.ts — distribution parsing
```typescript
// BEFORE: rawValues = braceMatch[1].split(',').map(v => parseFloat(v.trim()));
// AFTER:
rawValues = braceMatch[1].split(',').map(v => Number(v.trim()));
// AND: isFinite check
if (rawValues.some(v => !Number.isFinite(v) || v < 0)) {
```

### Fix 3: council.ts — confidence calculation
```typescript
// BEFORE: const confidence = Math.min(1, Math.abs(adjustedScore) + (1 - coherence) * 0.3);
// AFTER:
const confidence = Math.min(1, Math.abs(adjustedScore) * computeCoherence(glyphs));
```

### Fix 4: decay.ts — clamp initial relevance
```typescript
// BEFORE: if (ageMs < 0) return initialRelevance;
// AFTER:
const bounded = Math.min(1, Math.max(RELEVANCE_FLOOR, initialRelevance));
if (ageMs < 0) return bounded;
```

### Fix 5: swarm.ts — unique response words
```typescript
// BEFORE: const responseWords = normResponse.split(/\s+/);
// AFTER:
const responseWords = new Set(normResponse.split(/\s+/));
const matches = [...responseWords].filter(w => expectedWords.has(w)).length;
```

### Fix 6: searchIndex.ts — populate uncovered
```typescript
// Add inside the !coveredTerms.has(t) branch:
if (!coveredTerms.has(t)) {
  coveredTerms.add(t);
  uncovered.push(t);  // WAS MISSING
}
```

### Fix 7: selfOptimize.ts — hit rate denominator
```typescript
// BEFORE: const maxHitsPossible = events.length * 5;
// AFTER:
const maxHitsPossible = events.reduce(
  (sum, e) => sum + Math.min(5, Math.max(0, e.resultsCount)), 0
);
```

---

## 4. RESEARCH INVENTORY — What Exists on the Branch

### EXTERNAL/RESEARCH — Convergence Prototypes (accept all audit findings)
- `convergence/council.ts` — **REJECT**, canonical council is superior
- `convergence/councilSoft.ts` — **QUARANTINE** as advisory-only soft parser (new functionality, not duplicate)
- `convergence/decay.ts` — **QUALIFY** against canonical KIRA; fixes needed first
- `convergence/searchIndex.ts` — **QUALIFY** against KIRA search; null-prototype fix required
- `convergence/selfOptimize.ts` — **QUALIFY** as tuning layer; must never auto-apply
- `convergence/swarm.ts` — **QUALIFY** against canonical swarm; unique-words fix required
- `convergence/arc3Memory.ts` — **QUALIFY** with held-out set; contradiction logic must be fixed
- `convergence/*.run.ts` — **RESEARCH ONLY**, not production runners
- `convergence/*.md` — **REPORTS**, not code; correct the math errors

### EXTERNAL/RESEARCH — Immune System (not audited by CodeRabbit)
- `packages/immune/src/*.ts` — 9 modules, 63/63 tests passing
- `packages/immune/test/*.ts` — self-contained runners (inline copies, not canonical imports)
- `packages/immune/index.ts` — barrel exports
- **NOT a workspace package** (no package.json entry)
- **Single dependency**: `@aukora/memory/decay.js` (PHI, PHI_INV, phiDecay, tilde)

### RESEARCH — Reports (not production artifacts)
- `IMMUNE_SYSTEM_REPORT.md` — contains overclaims about integration
- `SKUNKWORKS_FINAL_REPORT.md` — contains overclaims about determinism
- `MERGE_BRIEF_IMMUNE_SYSTEM.md` — earlier brief was wrong about "safe to merge wholesale"
- `convergence/*.md` — contain math errors and overclaims

---

## 5. WHAT SAM 2 SHOULD BUILD

The minimal real `@aukora/immune` package from donor files:

```
packages/immune/
├── package.json          <- NEW: workspace entry, dependencies
├── src/
│   ├── thymus.ts         <- from donor (clean)
│   ├── patrol.ts         <- from donor (clean)
│   ├── inflammation.ts   <- from donor (clean)
│   ├── memoryB.ts        <- from donor (clean)
│   ├── homeostasis.ts    <- from donor (clean)
│   ├── engagement.ts     <- from donor (clean)
│   ├── killerT.ts        <- from donor (clean)
│   ├── antibody.ts       <- from donor (clean)
│   ├── petriDish.ts      <- from donor (clean)
│   └── proprioception.ts <- from donor (label EXTERNAL/RESEARCH)
└── test/
    ├── thymus.test.ts    <- NEW: source-importing tests
    ├── patrol.test.ts    <- NEW: source-importing tests
    ├── ...               <- etc for each module
    └── petri.test.ts     <- NEW: source-importing tests
```

**Key requirement**: Tests must IMPORT from shipped source (`../src/thymus.js`), not inline copies.

**Key constraint**: Every test must verify `grantsAuthority: false` and `advisoryOnly: true` invariants.

---

## 6. WHAT SAM 3 SHOULD PROVE

1. **No authority/actuation path**: The immune system must never be able to approve, sign, execute, or override any Aukora function.
2. **No identity-prompt auto-wiring**: The proprioception prompt is a suggestion, not an automatic configuration. It requires explicit council approval.
3. **Dev-door key footgun**: If the dev door has a key equivalent to production, this must be fixed separately.

---

## 7. WHAT SAM 4 SHOULD CREATE

1. **docs/skunkworks/qualification-ledger.md**: Public ledger tracking qualification status
2. **7090/Spatial donor truth**: Preserve design patterns from external repos with attribution
3. **Integration risk assessment**: ADDITIONS vs REPLACEMENTS vs TUNING LAYERS

---

## 8. WHAT SAM 1 SHOULD ZIPPER

Only exact green subsets:
1. `packages/immune/` as a new workspace package (after Sam 2 rebuilds it)
2. `tsconfig.json` path mapping (after package.json entry exists)
3. NOTHING from `convergence/` directory (research prototypes)
4. Reports stay on research branch

---

*This is a research response, not a merge request. Every claim is advisory. Nothing here grants authority, approves deployment, or asserts production readiness.*

**grantsAuthority: false | advisoryOnly: true | EXTERNAL/RESEARCH**

**— Kimi, SKUNKWORKS lab, 2026-07-18**
