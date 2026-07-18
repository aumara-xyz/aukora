# SAM 4 · R54 — Kimi convergence + 7090 donor qualification (READ-ONLY disposition)

**Scope of the rejection:** this record REJECTS **canonical-runtime adoption and donor merging** of the
`convergence/kimi-overnight` modules — it does **not** object to administratively merging *this qualification
record itself* (the doc/PR is fine to merge). A file-level qualification matrix for the public branch
`convergence/kimi-overnight` (PR #121, head `c3a0fb4a0485454d8a8cbd8228cd2539d68ad956`, display prefix `c3a0fb4`)
against canonical Aukora (`main` `92a452b23755a1549231384fea15c912d2871582`, display prefix `92a452b`) and donor
equivalents. No module integration, no runtime-code change, no provider calls.

**Headline (test evidence — one consistent split):**
- **617 = externally reported** (from a container run, not the committed public tree).
- **156 = the committed runner's own assertion count** (`convergence.run.ts`, ≈169 inline asserts) — but see the
  hard caveat below: the committed runner **does not resolve its imports against the public tree**, so those 156
  are reproducible only after relocating the modules into the runner's assumed layout; **0 run from the public
  tree as-committed.**
- **461 = absent / unreproducible** from the audited public tree (no `stress.test.ts`/`deep.test.ts` blob exists).

Even the 156 would demonstrate **internal consistency only — not superiority, not donor continuity.**

## The 6 Kimi modules (all under top-level `convergence/`)

Source branch: `convergence/kimi-overnight` @ commit **`c3a0fb4a0485454d8a8cbd8228cd2539d68ad956`** (full 40-hex;
display prefix `c3a0fb4`). All hashes below are full 40-hex git blob object ids.

| module | git blob (40-hex) | lines | what it claims to be | authority | secret scan |
|---|---|---|---|---|---|
| `searchIndex.ts` | `73b625ee2021046991343312276a41220c6d9b5c` | 212 | KIRA inverted index — O(1) keyword→records, replacing recall()'s O(n) scan | none (advisory-only) | clean |
| `decay.ts` | `d76378cccb008c200ebc6f9ccb9d625273c571e9` | 206 | KIRA φ-decay "SHEAR Engine" — golden-ratio relevance decay floored at 1/φ | none | clean |
| `selfOptimize.ts` | `68e0dfcf0726e4da7ced71bdf570ca3488c050fc` | 193 | memory "metacortex" — watches hit-rate/latency/coverage, emits tuning recommendations | none | clean |
| `council.ts` | `03517b2134bc6fca3602585d1812caff90f4346f` | 423 | VYMAKIRA council — glyph packets + VK-Kronos security | fail-closed advisory (VK-Kronos); grants nothing | clean |
| `swarm.ts` | `6f1a69b865a1d3b07d1fc611a90f1d85b1f5bbeb` | 339 | 6-node "swarm" — nodes quiz each other, deliberate via council | none | clean |
| `arc3Memory.ts` | `bab207a898807de9429ace346a5a32c140cc7b16` | 361 | ARC-3 "general reasoning engine for memory" — analogy/isomorphism over memories | none ("sign*" hits are `signature`, pure) | clean |

`convergence/convergence.run.ts` (blob **`05c35848869c977aa99746d3df143c1357cc9bf8`**, 610 lines) is a standalone
`tsx` runner. It **imports all six modules**, but from paths that **do not exist in the committed tree** —
`searchIndex`/`decay`/`selfOptimize` from `../../memory/src/*` and `council`/`swarm`/`arc3Memory` from `../src/*`
(the modules physically live in `convergence/`). So the committed runner **cannot execute against the public
tree**; it presupposes a relocated layout that is not committed.

## Provenance / license / import boundaries

- **License:** every module carries `SPDX AGPL-3.0-or-later` + `Copyright (c) 2026 Aukora`. Self-declared
  Aukora-authored; no third-party/donor license conflict observed. (Provenance is *claimed*, not independently
  attested — no donor blob match asserted.)
- **Import boundaries — DANGLING against the committed tree (the load-bearing finding):**
  - **The runner itself is dangling.** `convergence.run.ts` imports `searchIndex`/`decay`/`selfOptimize` from
    `../../memory/src/*` and `council`/`swarm`/`arc3Memory` from `../src/*` — **none of those paths exist** in
    `convergence/kimi-overnight` (the modules are all in `convergence/`, and there is no repo-root `memory/` or
    `src/`). So the runner references, but cannot load, any module from the committed tree.
  - **The modules are dangling too.** `searchIndex.ts` imports `./envelope.js` (no `convergence/envelope.ts`);
    `swarm.ts`/`arc3Memory.ts` import `../../memory/src/envelope.js` + `../../memory/src/decay.js` (no repo-root
    `memory/`). Canonical is `packages/memory/src`.
  - **What was actually exercised from the public tree: nothing demonstrably.** The runner *imports* all six
    modules but via non-existent paths, so it does not run as-committed; and because `searchIndex`/`swarm`/
    `arc3Memory` additionally carry their own dangling imports, there is **no evidence any of them executed** —
    I do not claim a broken module ran. The externally-reported 617 (and the runner's 156) could only have run in
    a **reconstructed layout** (modules copied to `memory/src/` + `src/`) that is **not committed**. That relocated
    layout also does not match canonical `packages/memory/src`, so it does not enter canonical runtime either.
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

---

## AMENDMENT — R54 research-evidence reconciliation (docs only)

The owner's tree inspection (and my independent re-check) find **no `stress.test.ts` or `deep.test.ts` under
`convergence/`** — the only executable evidence in the public branch is `convergence/convergence.run.ts`
(169 inline assertion-shaped calls; no import of any stress/deep suite). The claimed "617/617 passing
(156 convergence + 164 stress + 297 deep)" therefore splits as follows:

| evidence class | count | reproducible from the committed public tree? | disposition |
|---|---|---|---|
| **Externally reported (total)** | **617** | **NO (as-committed)** | ran only in a reconstructed, non-committed layout (container) |
| **Committed runner's own assertions** | **156** (≈169 inline asserts in `convergence.run.ts`) | **NO as-committed** — the runner imports every module from `../../memory/src/*` + `../src/*`, which do not exist in the tree; runnable only after relocating the modules | even if relocated, internal-consistency self-tests only — not superiority, not donor continuity |
| **Externally reported, ABSENT** | **461** (164 stress + 297 deep) | **NO** — no `stress.test.ts`/`deep.test.ts` blob exists in `convergence/kimi-overnight` | uncorroborated; **do not credit** until the source files are committed and re-run first-hand |
| **New φ / index / swarm / ARC benchmarks** | — | **NO** — no benchmark harness, dataset, or verifier in the tree | **external lab evidence, pending source + dataset + verifier import**; perf claims (O(1) vs O(n), "faster", "self-optimizing") remain asserted, unmeasured |
| **Canonical/donor duplicates (already established)** | — | n/a | `council` SUPERSEDED by `packages/council`; `decay` `tilde`/`decayShear` already canonical in `aukoraFuGlyph.ts` (see matrix above) |
| **Branch compile / import gaps** | — | n/a | the runner AND the modules have dangling imports (`../../memory/src/*`, `../src/*`, `./envelope.js`) — nothing compiles/runs from the committed tree, and none matches canonical `packages/memory/src` (see Import boundaries above) |

**Net:** **0/617 are reproducible from the committed public tree** (the runner cannot resolve its own imports).
At most **156** *could* run after relocating the modules into the runner's assumed layout, and even then they
prove only internal consistency. **461/617 are absent** entirely, and the benchmark superiority claims are external
evidence with no importable source/dataset/verifier. Nothing here changes the disposition: **REJECT canonical adoption;
RESEARCH_CANDIDATE for an offline Nebius lab** where the 461 absent tests + the benchmarks would have to be
supplied and re-run first-hand.

## 7090 (item D) — tracked at Symbiote #405, still BLOCKED

The 7090 donor lane is now tracked at `aumara-xyz/aukora-symbiote#405` ("[R54 SKUNKWORKS] 7090 memory/Spatial
donor lane + governed local-mind handoff").

**#405 snapshot — re-inspected 2026-07-18T01:44Z (UTC):** `state=OPEN` · `created=2026-07-17T23:36:47Z` ·
`comments=0` · **no branch/commit/blob/test/secret-free packet posted** (unchanged since the prior 00:31Z check).
So as of this dated re-inspection **no 7090 delta exists to qualify** — the status is BLOCKED against a current
(not stale) snapshot; re-inspect #405 for a posted packet before crediting any 7090 row. Per the directive, I will qualify **only the sanitized delta from #405's exact
branch/commit/blob/test/secret-free packet** when it appears; **nothing from the local `:7090` donor lane enters
canonical Aukora by summary or chat alone.** The required packet contents are the six items specified above.
