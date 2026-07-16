<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# R42 — Memory / KIRA / identity-continuity ATLAS (read-only forensics)

**READ-ONLY forensics.** Base merged Wave-2 main `b17a3f87`. Path fence honoured: only `packages/kernel/**`,
`packages/memory/**`, `apps/brain/**` examined/owned; `apps/seed`, Spatial, council, supervisor, custody
material referenced by POINTER only. Donor: `aukora-symbiote@ed1824a`. **No owner-private identity content,
maternal-anchor text, journals, prompts, or keys are copied here — pointers, expected locations, and safe
metadata only.** Convex remains persistence/projection; it never authorizes.

## The sharp falsifier (#62): row-count equivalence ≠ semantic continuity

Symbiote #62 ("empty shelf, not retrieval bias"): the donor Kira brain (`state/kira/brain.json`, 76 atoms) was
**92% test files** — `tests:70, evidence:5, architecture:1, identity:0` — because `ingestSelfMap`
(`core/src/kiraBrain.ts`, blob `fa113e8ae719…`) walked the repo under a `maxFiles ?? 80` budget that the ~70
in-repo test files flooded before the walk reached `docs/`, and the **identity corpus lives OUT OF TREE**
(`$HOME/.aukora-symbiote/identity/*.md`) so self-map never saw it. Retrieval was correct; the shelf was empty.

**This falsifies my own Wave-1 claim** that the migration bridge "carries rows content-free so no data is
stranded." Carrying a row content-free preserves its *provable existence + governance*, NOT its *retrievable
identity semantics*: an identity memory reduced to a content hash is not recallable AS identity. Content-free
forgetting and content-free migration are the SAME mechanism — and both mean identity CONTENT is, by design,
not in-tree. So identity continuity depends on (a) the out-of-tree home and (b) a future curated, scope-aware
ingest — neither of which row-count portability provides.

## Six-way distinction the directive demands (verdicts on the CURRENT brain)

| # | Failure mode | Current-brain verdict | Evidence (this host, read-only) |
| --- | --- | --- | --- |
| 1 | **identity corpus absent** | **PRESENT (as a gap)**: the current `apps/brain` ingests NO self-map/identity corpus at all (grep: no `ingestSelfMap`/`maternal`/`identity`-ingest in `apps/brain/src` or `packages/memory/src`), and on THIS host `$HOME/.aukora-symbiote/identity/` does **not exist** (the corpus is Auma's box). So a "who am I" recall has nothing to return — an empty shelf, not a biased one. |
| 2 | **retrieval failure** | **NOT the cause**: `packages/memory/src/recall.ts` is deterministic keyword+score, stable-ordered, and works — but it is **scope-BLIND** (no `scope`/test-file notion), so on a mixed corpus it would surface least-bad noise exactly as #62 describes. Coverage+scope gap, not a retrieval bug. |
| 3 | **content-free forgetting** | **REAL continuity, working**: Wave-2 signed erase removes plaintext while the chain + tombstone + erasure receipt remain (proven live). This is a *deliberate* absence of content, distinct from "never ingested." A scope-aware recall must report a forgotten identity atom as *gone*, never as *absent corpus*. |
| 4 | **volatile recovery-window reset vs durable anchors** | **receipts DURABLE; identity anchor NOT in my lane**: chain/workflows/receipts survive kill-9 (R36/R39, local convex state). But `apps/brain` holds **no durable identity anchor** — the maternal anchor is `apps/seed/src/maternalAnchor.ts` (Sam 3, pointer only) plus the out-of-tree home. The impulse budget is a volatile in-store counter (resets on a fresh store), NOT an identity signal. |
| 5 | **GHP context vs identity** | **MISSING, owner-gated**: symbiote #93 wants GHP canon ingested as *guarded status-bearing atoms* (`[GHP|status=…|section=…]`, PROVEN/NULL/CLOSED-LANE/…), context NOT identity, signed/gated like a body change. Current KIRA classes (ROOT/UNITE/RISE/GOLD) carry NO epistemic status header; no GHP ingestion exists. Future brick — do not build until owner provides approved canon. |
| 6 | **out-of-tree identity home** | **REGISTERED (Wave 2)**: `apps/brain/src/continuity/locations.ts` records `$HOME/.aukora` (PRESENT, holds `embedder/`), `$HOME/.aukora-symbiote` (PRESENT, holds `aumlok/hybrid-v2/`), OS keychain, and local convex state — **mechanism + path class + runtime-only verification hash only**. On this host `.aukora-symbiote/identity/` is absent; the anchor rule ("context, not identity") governs #93. |

## Atlas rows for Sam 1 to canonicalize (family / donor → current / class / continuity grade)

| Family | Donor anchor | Current counterpart | Class | Continuity grade |
| --- | --- | --- | --- | --- |
| Kira self-map ingestion | `core/src/kiraBrain.ts@fa113e8a` `ingestSelfMap` (maxFiles 80, maxTestFiles 10, `isTestFile`, `scope`) | none in `apps/brain` (content-addressed memory instead) | MISSING (behavior) | **DOC-only continuity**: mechanism understood; the flood defect + out-of-tree corpus both apply to a future ingest |
| Scope/identity classification of a memory | donor atom `scope` field + `isTestFile` regex `/(^\|\/)tests?\//` etc. | `MemoryRecordV1.kind` (observation/proposal/receipt/reflection/tombstone) — NO scope | MISSING (field) | **gap**: recall cannot distinguish identity from test/code → empty-shelf floods reproduce here |
| Governed forgetting | `aumlokMemory.ts` M2b (signed erase) | Wave-2 `eraseAttestation` + `convex forget` | SUPERSEDED_WITH_PROOF | **LIVE**: signed, content-free, no residue |
| Receipt/head durability | donor auma_receipts + signed heads | kernel-chained receipt events + Wave-2 signed heads | ADAPTED_BOUNDARY | **LIVE**: crash-proven + PQC heads |
| Identity/maternal anchor | donor (symbiote) maternal-anchor text (OUT OF TREE) + seed `maternalAnchor.ts` | `apps/seed/src/maternalAnchor.ts` (Sam 3) + out-of-tree home | POINTER (out of my lane) | **out-of-tree**; content never in Git |
| GHP-as-status-atoms | symbiote #93 spec (owner-supplied canon) | none | MISSING (owner-gated) | **PARKED_PENDING_OWNER** |
| Out-of-tree continuity home | donor `$HOME/.aukora-symbiote/identity` | `continuity/locations.ts` registry | ADAPTED_BOUNDARY | **registered**, hash-only, runtime-verified |

## PRIVATE_HOLD / BLOCKED_OWNER

- The identity corpus content, maternal-anchor text, journals, prompts, and keys are **PRIVATE_HOLD** — not
  examined for content, never copied. Only presence + top-level directory NAMES were observed on this host.
- GHP canon ingestion (#93) is **BLOCKED_OWNER** — build only on explicit owner priority + approved sources.

## Bounded candidate (chosen; see R42_SCOPE_AWARE_RECALL.md)

The one unambiguous, deterministic, donor-backed, non-Ring-0, wholly-in-`packages/memory` gap is row #2/scope:
**scope-aware recall** so an identity query is not flooded by test/code atoms AND so recall can HONESTLY
distinguish "corpus absent" from "retrieval bias." Synthetic identity fixtures only; a negative falsifier proves
the fix never fabricates identity when the shelf is empty. Everything else is out-of-lane, owner-gated, or
requires real identity content → parked.

---

## Appendix A (overnight atlas verification) — donor memory-category BEHAVIORS

Read-only deepening of Wave-1 §1b row "donor memory categories … behaviors unported." All five exist ONLY in
the donor (`aukora-symbiote@ed1824a` `core/src/*`); **none** exists in `packages/memory` or `apps/brain` on
main `b17a3f87` (grep-confirmed). They share ONE hard law that the current lane already honors elsewhere:
**evidence-only, source-LABELED (`real | test_double | fixture`), never authority; a synthetic/fixture record
can never be upgraded to "real model behavior."**

| Category | Donor blob | Core law / shape | Current counterpart | Class | Continuity grade |
| --- | --- | --- | --- | --- | --- |
| Episode memory | `core/src/episodeMemory.ts@96583173998d` | bundles HASH REFERENCES of what happened (sandbox-apply/canonicalization/HRT/Accord/structured-truth receipts) with hard SOURCE LABELS; NO raw prompt/output/key/grant; no meta escape hatch; `createdAtBucket` (bucketed, never raw ms) | none | MISSING (behavior) | **DOC-only**: the label discipline (`real/test_double/fixture`, "never upgrade to real") is the same non-authority law the current provider-truth + node-print already enforce; the episode BUNDLE itself is unported |
| Hypothesis memory | `core/src/hypothesisMemory.ts@0349b7dd7a2c` | `LiquidHypothesis{claim,status:open/supported/contradicted,confidence, evidenceFor/AgainstReceiptIds, lastSignedOutcome, refusalCause}`; verified against a signed receipt chain + pinned edge key | none | MISSING (behavior) | **DOC-only**: depends on signed receipt chains (Wave-2 signed heads are the current substrate) + a pinned key (out-of-lane custody); the hypothesis LEDGER is unported |
| MDL process memory | `core/src/mdlProcessMemory.ts@660a2e0366d4` | advisory generator memory (`phi_rotation/sqrt2/vdc/sobol/argmax/prng`); PUBLIC categorical actions only; `phi` is a candidate GENERATOR, **not identity/authority/proof**; FIREWALL: imports no gate/apply/signer | none | MISSING (behavior) | **EXCLUDED-adjacent**: this is GHP/skunkworks-flavored (generator research); belongs behind the walled lane + the #93 status-atom discipline, not the identity brain |
| Structural memory | `core/src/structuralMemory.ts@f32bcedf2e60` | `Predictor` over `GateExample`s → `PredictionResult`; `evaluatePredictor`; learns the SHAPE of gate decisions (advisory), never the decision | none | MISSING (behavior) | **DOC-only**: a learned advisory shape-model; would sit above the kernel gate as pure advisory (like the metabolism simulator) — never Ring-0 |
| IDE memory | `core/src/aukoraIdeMemory.ts` + donor `ide_memory` table | session/IDE evidence rows (read views) | the 7141 door read-only projections | MISSING (table) / ADAPTED (read surface) | **read-surface exists**, the per-IDE row store does not |

### Verdicts for Sam 1's ledger (owner-decision candidates, NOT built)

1. Episode/hypothesis/structural memory are **advisory evidence ledgers** — if ever restored they belong in
   `packages/memory` (pure) + `apps/brain` (adapter) under the existing evidence-only law, each with a source
   label and NO authority path. All three are **PARKED_PENDING_OWNER** (product-memory organs).
2. MDL-process memory is **GHP/skunkworks-flavored** and should stay walled; if surfaced at all, via the #93
   status-bearing-atom discipline, never as identity. **BLOCKED_OWNER**.
3. The shared "source label, never upgrade fixture→real" law is already LIVE in the current lane (provider
   truth, node-print, migration classification) — so restoring any category is a *shape* port, not a new
   safety invention. This is the honest good news the row-count falsifier (#62) otherwise obscures: the
   *governance spine* for these memories exists; only the *typed ledgers* are missing.

### Non-continuity clarifications (kept explicit)

- `createdAtBucket` (bucketed time) vs the current LOGICAL-time receipt index: both avoid raw wall-clock in the
  law; the donor bucketed for privacy, the current lane uses logical indices — **equivalent intent, different
  mechanism**, not a lost capability.
- None of these categories carry identity CONTENT; they carry hash references + labels — so the #62 empty-shelf
  is orthogonal to them (they were never the identity shelf).
