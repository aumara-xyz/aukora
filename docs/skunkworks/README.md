<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# Aukora Skunkworks — public truth surface

This page is the single main-facing index of Aukora's research and experiment work. It exists so the
skunkworks can be **public without turning a spectacle into a capability claim**. It is a map with honest
status labels and links — **not** a results dump, and **not** a copy of the raw research reports on
[PR #121](https://github.com/aumara-xyz/aukora/pull/121). Every strong external figure lives (already
qualified) in the linked qualification records; this surface summarises and points, it does not re-assert.

- **Canonical base:** `main@1394321fffd5de6296d44423d097e4e6199ab62b`
- **Donor (owner-approved Symbiote source):** `41707f910d10696482c28ee80346c252a55e9d41`
- **Posture:** preserve and park. Nothing here is deployed, and nothing here grants authority
  (`grantsAuthority:false` everywhere; the kernel never consults any of it).

## Status vocabulary (exact)

| status | meaning | may claim |
| --- | --- | --- |
| **VERIFIED** | reproduced *in this repository* over production adapters, self-verifying on this node | observation / live-local proof |
| **PREPARED** | an in-repo cell that is complete but **inert** (`enabled:false`) — no runtime, no deployment, unbound pins | a design that is parked, nothing more |
| **EXTERNAL** | ran only in an outside harness/container; **not** reproducible from the public tree | a documented experiment, never an Aukora fact |

No entry below is allowed to claim aliveness, production-grade behaviour, identity-level capability, or
readiness for Nebius. Those framings are out of scope for this surface by construction.

## Records (status · link · blob@`main`)

| record | status | link | blob |
| --- | --- | --- | --- |
| Canonical-path organism proof (production adapters, self-verifying `coreHash`) | **VERIFIED** | [`docs/continuity/r52/SAM4_SKUNKWORKS_QUALIFICATION.md`](../continuity/r52/SAM4_SKUNKWORKS_QUALIFICATION.md) contrast section + `apps/spatial/evaluator/canonical-path.mjs` | `976877e0d0a6` |
| R51 external skunkworks qualification (Kimi K3 experiments) | **EXTERNAL** · `EXTERNAL_SIMULATION / NOT_CANONICAL_RUNTIME / REPRODUCTION_PENDING` | [`docs/r51/EXTERNAL_SKUNKWORKS.md`](../r51/EXTERNAL_SKUNKWORKS.md) | `31bed6b14c8b` |
| R52 independent re-qualification + executable no-overclaim fence | **VERIFIED** (the fence) | [`docs/continuity/r52/SAM4_SKUNKWORKS_QUALIFICATION.md`](../continuity/r52/SAM4_SKUNKWORKS_QUALIFICATION.md) | `976877e0d0a6` |
| R54 Kimi convergence / 7090 donor disposition | **EXTERNAL** · REJECT canonical adoption | [`docs/continuity/r54/SAM4_KIMI_7090_QUALIFICATION.md`](../continuity/r54/SAM4_KIMI_7090_QUALIFICATION.md) | `0b836efc7a71` |
| Raw Kimi research bundle (immune · Petri · mem) | **EXTERNAL** · open, **not merged** | [PR #121](https://github.com/aumara-xyz/aukora/pull/121) `convergence/kimi-overnight@70639ac01dcb` | — |
| Model truth table (weights: none in-repo) | reference | [`models/MODEL_TRUTH.md`](../../models/MODEL_TRUTH.md) | — |

## Two categories, kept apart

The directive that governs this surface is: keep **external experiments** separate from **parked runtime
cells**. They are different kinds of thing and must never be conflated.

### A. External Inkling/Tinker experiments (ran outside this repo)

Recorded for honesty; none is reproducible from the public tree, so none is an Aukora capability.

- **Kimi K3 experiments** (memory/index prototype; a constitutional-evolution *simulation*). The externally
  reported counts (candidate records, advisory reviews, recall deltas) are **simulation figures, not Aukora
  results** — documented and explicitly negated in the R51/R54 records above.
- **Fugu Ultra via OpenRouter** — an external live-model experiment. Fugu Ultra is **not** Inkling; results
  are not committed here (the raw harness needed credential scrubbing and independent reproduction).
- **Auma-VL LoRA ladder** (reported v5..v17) and other model runs — provenance is out-of-repo; the resolved
  truth for every one is `UNVERIFIED_OR_PARKED` / `BLOCKED` / `DESIGN_ONLY` in `models/MODEL_TRUTH.md`. This
  repo ships **no weights**.

### B. Parked runtime cells (in-repo, inert, `enabled:false`)

Complete manifests that describe how a cell *would* run — kept inert until an owner bring-up pins real digests.

| cell | file | state |
| --- | --- | --- |
| Inkling-NVFP4 vLLM serving manifest | `models/nebius/inkling/inkling-nvfp4.serving.manifest.json` | **PREPARED · PARKED** (`enabled:false`; pins are explicit unbound `""` slots, no invented hashes) |
| Nebius deployment manifest | `models/nebius/deployment.manifest.json` | **PREPARED · PARKED** (`enabled:false`) |
| Nebius canary manifest | `models/nebius/canary.manifest.json` | **PREPARED · PARKED** (`enabled:false`) |

## Qualified salvage queue

From the R54 disposition: the Kimi modules are **rejected for canonical-runtime adoption** (dangling imports,
a duplicated `council`, and superiority asserted but never falsified). The salvageable *ideas* are routed to an
**offline Nebius conformance/benchmark lab** as research candidates — they earn adoption only through
result-equivalence + measured-performance tests against the canonical implementation, never by assertion.

| idea | canonical relation | disposition |
| --- | --- | --- |
| `searchIndex` (inverted-index recall) | canonical `recall()` is O(n) | **RESEARCH_CANDIDATE** — needs a differential test proving identical results + a real benchmark |
| `selfOptimize` (advisory tuning) | none | **RESEARCH_CANDIDATE** — no evidence it improves a measured outcome |
| `swarm` (multi-node quiz sim) | overlaps `packages/council` | **RESEARCH_CANDIDATE** — a simulation, not a distributed system |
| `arc3Memory` (structural-signature heuristics) | overlaps R50 ARC-3 dojo + `@aukora/mind` | **RESEARCH_CANDIDATE** — structural-similarity scoring, not general reasoning |
| `decay` (φ-floor tuning) | `packages/council` `tilde`/`decayShear` | **DUPLICATE (partial)** — the φ-decay math already exists canonically |

**Admission law** — external evidence may enter canonical Aukora only after: (1) secret/private-data scans
pass; (2) source, model, environment, seed, dependency versions pinned; (3) evidence bundle + verifier
complete; (4) an independent run reproduces the result at an exact `main` SHA; (5) claims distinguish
observation / simulation / live-local / deployed; (6) every model/cell stays `advisoryOnly:true`,
`grantsAuthority:false`. None of (1)–(4) is satisfiable on this node for the external artifacts, so they stay
EXTERNAL.

## The fence is executable

This surface is not a promise — it is enforced. `apps/spatial/evaluator/no-overclaim.mjs`
(blob `b795fc6d4460`) scans every tracked Markdown/JSON file and **fails the build** if a forbidden phrase
appears without a negation/qualification within ±3 lines. It runs in `npm run test:all`. A spectacle cannot
silently become a canonical claim on a later edit — including an edit to this very page.
