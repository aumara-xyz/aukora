# SAM 4 · R54 — Kimi convergence + 7090 donor qualification (READ-ONLY disposition)

**No code integration, no merge.** A file-level qualification matrix for the public branch
`convergence/kimi-overnight` (PR #121, head `c3a0fb4`) against canonical Aukora (`main` `92a452b`) and donor
equivalents. Skeptical bar: **the branch's 617 self-tests are evidence of internal consistency, not of
superiority or donor continuity.**

## The 6 Kimi modules (all under top-level `convergence/`)

| module | blob | lines | what it claims to be | authority | secret scan |
|---|---|---|---|---|---|
| `searchIndex.ts` | `73b625ee` | 212 | KIRA inverted index — O(1) keyword→records, replacing recall()'s O(n) scan | none (advisory-only) | clean |
| `decay.ts` | `d76378cc` | 206 | KIRA φ-decay "SHEAR Engine" — golden-ratio relevance decay floored at 1/φ | none | clean |
| `selfOptimize.ts` | `68e0dfcf` | 193 | memory "metacortex" — watches hit-rate/latency/coverage, emits tuning recommendations | none | clean |
| `council.ts` | `03517b21` | 423 | VYMAKIRA council — glyph packets + VK-Kronos security | fail-closed advisory (VK-Kronos); grants nothing | clean |
| `swarm.ts` | `6f1a69b8` | 339 | 6-node "swarm" — nodes quiz each other, deliberate via council | none | clean |
| `arc3Memory.ts` | `bab207a8` | 361 | ARC-3 "general reasoning engine for memory" — analogy/isomorphism over memories | none ("sign*" hits are `signature`, pure) | clean |

`convergence/convergence.run.ts` (`05c3584`, 610 lines) is a standalone `tsx` runner (the 617-test harness).

## Provenance / license / import boundaries

- **License:** every module carries `SPDX AGPL-3.0-or-later` + `Copyright (c) 2026 Aukora`. Self-declared
  Aukora-authored; no third-party/donor license conflict observed. (Provenance is *claimed*, not independently
  attested — no donor blob match asserted.)
- **Import boundaries — DANGLING vs canonical (the load-bearing finding):**
  - `searchIndex.ts` imports `./envelope.js` — **there is no `convergence/envelope.ts`**.
  - `swarm.ts` / `arc3Memory.ts` import `../../memory/src/envelope.js` and `../../memory/src/decay.js` — **there
    is no repo-root `memory/`** (canonical is `packages/memory/src`).
  - So the bundle **does not compile against the canonical package layout**; it assumes its own root-level
    `memory/` + a local `envelope`. The 617 self-tests therefore ran in the bundle's own context, **not** against
    canonical Aukora. This is the #1 reason none of it can enter canonical runtime as-is.
- **Authority status:** all six are authority-clean — pure, `advisory-only`, "never grants authority" per their
  own headers; `arc3Memory` "sign" hits are `signature`/`signatureSimilarity` (structure analysis). Convex
  stays projection-only; AUMLOK remains sole authority. Nothing here touches the authority boundary.

## Classification (EXACT_PORT / ADAPTED / DUPLICATE / SUPERSEDED / RESEARCH_CANDIDATE / REJECT)

| module | vs canonical | verdict | why |
|---|---|---|---|
| `council.ts` | `packages/council` (Fu council) | **DUPLICATE → SUPERSEDED** | re-implements the tested, exported, in-runtime Fu council: glyph packets, coherence, phase-lock, VK-Kronos. Canonical `aukoraFuGlyph.ts` already has `StanceGlyph`/`ConfidenceGlyph`/`StrategyGlyph`, `tilde`, `decayShear`, `perceive`, `parseGlyphResponse`. Convergence renamed `parseGlyphResponse`→`parseGlyphPacket`. **Reject for canonical adoption.** |
| `decay.ts` | `packages/council/src/aukoraFuGlyph.ts` (`tilde`/`decayShear`) | **DUPLICATE (partial) / RESEARCH_CANDIDATE** | the φ-decay `tilde` math already exists canonically as `tilde`/`decayShear`. The PHI-floor framing is a *design choice*; φ-superiority is asserted, never falsified (same "aesthetics ≠ evidence" pattern as the metals/GH-RECOV lane). |
| `searchIndex.ts` | (no canonical equivalent; `recall()` is O(n)) | **RESEARCH_CANDIDATE** | a genuine O(1) inverted-index optimization. But: dangling import, and **no differential test proving it returns the same results as canonical `recall()`**, and O(1)-vs-O(n) is *claimed, not benchmarked*. |
| `selfOptimize.ts` | (none) | **RESEARCH_CANDIDATE** | advisory tuning recommendations (does not self-modify). No evidence the recommendations improve any measured outcome. |
| `swarm.ts` | (none; overlaps `packages/council`) | **RESEARCH_CANDIDATE** | a pure *simulation* of multi-node quizzing over council — not a distributed system. Imports the duplicate council. |
| `arc3Memory.ts` | overlaps my R50 ARC-3 dojo + `@aukora/mind` (grids, not memory) | **RESEARCH_CANDIDATE** | structural-signature/analogy heuristics over memory. "General reasoning engine" overstates structural-similarity scoring. |

**Overall disposition: REJECT wholesale adoption into canonical runtime** — dangling imports, `council`+`decay`
duplicate canonical, zero behavioral-differential tests, zero measured performance evidence, and the
"self-optimizing / swarm-distributed / ARC-3-reasoned substrate" (README) is a research bundle's self-claim, not
a demonstrated organism. The convergence branch's OWN audit (`R53_FULL_SWARM_AUDIT.md`) is, to its credit,
honest on the runtime: "primary runtime door remains projections-only," "foundation-only code clearly marked."

## Evidence bar not met (skeptical framing)

- **Behavioral differential tests: ABSENT.** 617 tests are *self-tests* (each module vs its own spec). None
  proves `searchIndex ≡ recall()`, none compares `decay`/`selfOptimize`/`swarm`/`arc3Memory` outputs to a
  canonical baseline. Internal consistency ≠ superiority ≠ donor continuity (exactly the directive's caution).
- **Performance evidence: ABSENT.** O(1)/O(n), "faster", "self-optimizing" are asserted; no benchmark harness,
  no timing, no memory-footprint numbers in the audit.
- **Donor continuity: UNPROVEN.** No donor blob/hash match is asserted for any module; these read as
  newly-authored Aukora research, not ported donor code.
- **Secret scan: CLEAN** (0 secret-shaped hits across all 7 files) — public-safe.

## Value for a future NEBIUS CONFORMANCE LAB (without entering canonical runtime)

The right home for the salvageable ideas is an **offline Nebius conformance/benchmark lab**, never canonical
runtime, because that is exactly where the missing differential + performance evidence would be produced:

- **`searchIndex`** — benchmark O(1) index vs canonical `recall()` for result-equivalence + latency at scale. HIGH lab value.
- **`selfOptimize`** — a measurement harness for hit-rate/coverage/latency; useful as a *metrics probe*, not a controller. MEDIUM.
- **`swarm`** — an adversarial "quiz each other" harness for stress-testing memory consistency across nodes. MEDIUM (as a test cell, not a substrate).
- **`arc3Memory`** — a research probe for memory-analogy/isomorphism; falsify the "general reasoning" claim first. MEDIUM.
- **`decay`** — LOW (duplicates canonical `tilde`/`decayShear`; would need a falsifiable φ-vs-non-φ retention benchmark to earn more than the existing canonical decay).
- **`council`** — NONE (canonical `packages/council` supersedes it; do not re-import).

Fences: this is a **research lab** disposition — no canonical-runtime import, no authority, no Nebius *deployment*
(bench-only), no wholesale copy into canonical per the R54 constraint.

## The exact 7090 handoff packet needed (item D — BLOCKED, no exact ref yet)

No exact 7090 branch/commit/handoff is available at qualification time, so **D is BLOCKED**. An acceptable 7090
memory-changes packet MUST contain, before any qualification can proceed:

1. **branch + commit SHA** (exact, immutable) of the 7090 memory changes;
2. **changed files + git blob hashes** (per file), scoped to what actually changed;
3. **the tests** that exercise the change (files + pass evidence + a first-hand run transcript, not a count);
4. **memory schema changes** — exact table/field/index deltas vs canonical `packages/memory` + `apps/brain/convex/schema.ts`, with a migration note;
5. **desired behaviors** — the falsifiable statements the change is meant to satisfy (so a differential test can be written);
6. **a secret-free export** — the packet passes a public secret scan before it lands anywhere public (the directive's public-scan bar).

Until such a packet exists, no 7090 row can be classified — I will not qualify against a moving or absent ref.

## Recommendations

1. **Do not integrate `convergence/kimi-overnight` into canonical runtime.** `council`/`decay` are DUPLICATE/
   SUPERSEDED; the rest have dangling imports + no differential/perf evidence.
2. **Route `searchIndex` / `selfOptimize` / `swarm` / `arc3Memory` to an offline Nebius conformance lab** as
   RESEARCH_CANDIDATEs — earn adoption only via result-equivalence + measured-performance tests against canonical.
3. **Keep the README's "substrate/organism" claims out of public README/CLAIMS** until that evidence exists
   (the branch's own audit already declines to promote them — hold that line).
4. **Block the 7090 row** pending an exact handoff packet (spec above).
