<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# WAVE 1 — Kernel / KIRA / Reactive-Brain Forensics (Sam 2)

**READ-ONLY FORENSICS on main `b38d625`. Nothing was implemented or rewritten; this document and the issue
report are the round's only artifacts.** Donor references: `aukora-kernel @ b441edc4d17de778d30ae955f46408edae39bffe`
(the pinned promotion donor) and the Symbiote working checkout `aukora-symbiote @ ed1824a` (branch
`sam/arc3-wip-preserved-20260713`, local read-only). `convex-test` results are cited as SIMULATED evidence only;
live claims cite the anonymous LOCAL deployment transcripts (`LOCAL_DEV_EVIDENCE.md`). No managed Convex.
No secret, key, token, or private plaintext is copied into this document.

## 1. Classification table (capability level, with file anchors)

Labels: `EXACT_PORT` · `MOVED_UNCHANGED` · `ADAPTED_BOUNDARY` · `SUPERSEDED_WITH_COMPARATIVE_PROOF` ·
`EXCLUDED_BY_PETER` · `MISSING`.

### 1a. Kernel family (donor: aukora-kernel @ `b441edc4`)

| Capability / file | Donor anchor | Current | Class | Evidence |
| --- | --- | --- | --- | --- |
| EvidencePack (canonical/catalogue/digest/framing/index/types/validate — 7 files) | blobs pinned in `scripts/verify-provenance.mjs` (e.g. digest `1a07e9d4…`, catalogue `2b7ff7f3…`) | `packages/evidence/src/*` | **EXACT_PORT** | `npm run verify:provenance` re-ran green this round: 10 sources byte-identical to donor `b441edc4`, tree `71133655…` |
| Fu council + glyph + spend ledger | pinned blobs (`93bc046a…`, `7081ab39…`, `60d4407c…`) | `packages/council*/src/*` | **EXACT_PORT** | same provenance gate |
| Kernel authority / canonical / evidence(receipt-chain) / merkle / reducer / registry / schema / errors | aukora-kernel PR #1 promotion (package `repository` still names aukora-kernel) | `packages/kernel/src/*` | **MOVED_UNCHANGED** | conformance vectors (`conformance/v1.json`, `hybrid-v1.json`) + cross-runtime verifier (`verify-kernel-runtimes`) are the donor-behavior oracle; kernel suite 19/19 green |
| Staleness law | donor loose version used `Date.parse`/`new Date().toISOString()` (was `packages/memory/src/staleness.ts`, harvested from old symbiote PR #20) | `packages/kernel/src/staleness.ts` (from `sam/r29-recursion @ e929adf`), re-exported by `@aukora/memory` | **SUPERSEDED_WITH_COMPARATIVE_PROOF** | comparative negative path: a NON-canonical timestamp (`'July 16, 2026'`) was loosely coerced by the donor law; the canonical law flags it `unknown-age` ⇒ stale (fail-closed). Proven: `packages/memory/test/stalenessOneLaw.test.ts` (incl. reference-identity = no duplicate law) + kernel `staleness.test.ts` (5) |

### 1b. KIRA memory family (donor: symbiote @ `ed1824a` unless noted)

| Capability | Donor anchor | Current | Class | Evidence / law comparison |
| --- | --- | --- | --- | --- |
| Memory envelope (consent-scoped, content-addressed, advisory-only) | `coreMemoryEnvelope.ts` (aukora-kernel `b441edc4`; per header in current envelope) | `packages/memory/src/envelope.ts` | **ADAPTED_BOUNDARY** | `node:crypto` → kernel canonical hash (one hash law); consent/provenance/validation laws preserved; negative paths tested (authority claim, extra key, id/content mismatch ⇒ refused) |
| Advisory containment predicates | `evidenceAuthorityGuard.ts` (donor blob `e317491c…`; function bodies preserved per header) | `packages/memory/src/containment.ts` | **ADAPTED_BOUNDARY** | bodies verbatim, internal codenames removed; quarantine/authority laws intact |
| KIRA rehearsal memory (receipt-BEFORE-row, `gateArgsHash`, contentHash-not-plaintext chain, tiers, tombstone status) | `memory/memory.ts` (blob `46eff426…`) | split: `apps/brain` content-free chain (`memoryCommitment`), two-phase receipt-before-effect (`convex/rehearsal.ts`), governed forgetting; `gateArgsHash`/tier/chainKey#seq preserved content-free by the migration bridge; `authorityRef` on workflows/rehearsals | **SUPERSEDED_WITH_COMPARATIVE_PROOF** | donor kept plaintext on the row and marked tombstones by status flag; current REMOVES plaintext while the chain still verifies. Comparative negative paths: tamper of committed metadata AND of a stored chainHash both break verification (convex-test), live tamper of `ownerVerified` decides nothing and is durably overwritten; forgetting leaves no plaintext in any dump. Donor receipt-first ordering is kept as a two-transaction asymmetry, deliberately not flattened |
| Manifest-authorized memory writes IN Convex (grant→intent→token→receipt, one-shot, OCC useSeq) | `convex/aumlokMemory.ts` (blob `5fc75be6…`) + `aukoraRuntime.ts` (`47398b88…`) | deliberately NOT ported into Convex: authority sits OUTSIDE/ABOVE (kernel/AUMLOK); the store persists projections + a consumed-authority evidence reference only | **SUPERSEDED_WITH_COMPARATIVE_PROOF** (for the boundary) | the donor enforced authority *inside* Convex mutations (bigger in-store trust surface); current proof: a lying persisted projection cannot authorize anything because the gate re-verifies from scratch (`convexWorkflowStore.test.ts` tamper case). This is the WAVE-1 authority law: **kernel/AUMLOK decides; Convex persists and reacts only** |
| Signed recall proof-of-possession (`aumlokMemRecall` domain) | `aumlokMemory.ts` §RECALL | none | **MISSING** | current recall is loopback-door read-only, unauthenticated by design for the local single-owner dev boot; a signed-recall equivalent has no current counterpart |
| Signed erase w/ reason inside the preimage + erasure receipts binding original hashes | `aumlokMemory.ts` §M2b | governed forgetting (owner-authorized, content-free tombstone, chain verifiable) exists; the *signed erase-head + erasure-receipt binding* does not | **MISSING** (partial supersession noted) | current forgetting is stronger on plaintext removal, weaker on erase-attestation; flagged for the AUMLOK lane |
| Per-row integrity scrub (memoryHash + binding receipt re-check) | `aumlokMemory.ts` M2 integrity | `memory:verify` / `health` re-run the canonical verifier over the whole chain | **ADAPTED_BOUNDARY** | equivalent-or-stronger at chain level (any row tamper breaks verify); donor's receipt-binding scan per row is subsumed by chain reconstruction |
| Receipts spine (auma_receipts + chain head + high-water + Merkle log) | `convex/aukoraReceipts.ts` (`302d01ac…`), `aukoraMerkleLog.ts` (`69a003bf…`) | `receiptEvents` (kernel-chained, LOGICAL time) + `memoryChain` + Merkle root in snapshot + `verifyReceiptEvents` | **ADAPTED_BOUNDARY** | one governed event/receipt spine, canonical-verifier backed; logical time removes wall-clock from the law |
| PQC/signed chain head (`aukoraSignedHead`, `aukoraPqcSigner`) | donor convex | none in brain lane (kernel hybrid authority exists at kernel level; head-signing not wired to the local chains) | **MISSING** | flagged: candidate for the AUMLOK/kernel lane, not silently dropped |
| Donor memory categories: `episodeMemory`, `hypothesisMemory`, `mdlProcessMemory`, `structuralMemory` (blob `f32bcede…`), `ide_memory` table, womb-memory chain | `core/src/*`, `convex/schema.ts` | no per-category runtime; current organizing scheme is the KIRA class taxonomy (ROOT/UNITE/RISE/GOLD) + gold registry + (seed lane) maternal anchor | **MISSING** (as distinct runtime categories) | the migration bridge can carry their ROWS as legacy records with `KiraClassifier` mapping + content-free provenance (`legacy chainKey#seq … gate=…`), so no data is stranded — but the donor *behaviors* per category have no current counterpart |
| Rate limiting (`aukora_rate_limits`) | donor convex schema | `impulseBudget` (monotone spend ceiling) + bounded attention | **ADAPTED_BOUNDARY** (narrower) | budget is contraction-only and fail-closed (proven); donor windowed rate limits per actor are broader — noted, not lost data |
| Node identity / trust registry / cross-grants / revocations / kill switch | donor convex schema | none in brain lane (single-node local organism this wave) | **MISSING** (multi-node era) / partially **EXCLUDED_BY_PETER** pending the friend-node lane | inventoried so the future headless multi-node lifecycle knows where the donor law lives |
| Donor durable workflows (intent logs + runtime state + one-shot grants) | `convex/schema.ts`, `aukoraRuntime.ts` | `workflows` (OCC projections) + `rehearsals` + `impulses` + receipt events; machine = seed `DurableRecursion` | **ADAPTED_BOUNDARY** | current adds: idempotent start, exactly-once effects, cancellation, crash-resume, two-writer divergence-defer — each with tests + live transcripts |
| Read-only mounts | donor `ide_memory` read views | the 7141 door projections (origin-closed, live-labelled, no fixture path) + `SAM4_CONVEX_CONTRACTS` | **ADAPTED_BOUNDARY** | R38/R39 transcripts |

### 1c. Current `packages/memory` + `apps/brain` files with no donor counterpart (additions)

`reactiveStore` (content-free chain + fail-closed corrupt-store gate) · `convex/{schema,memory,rehearsal,workflows,ingest,crons,nerves}` ·
`convexWorkflowStore` (Sam 3 contract adapter) · `localDoor`/`composeLive`/`ports` · `organism-ctl`/`local-ctl`/`doorServerMain` ·
`keychain/*` (custody seam) · `memoryBridge` + `goldRegistry` (KIRA classes + ceremony-gated gold) · `nodePrint`/`offlineExecutor`/
`supervisedGeneration`/`brainRoles`/`providerPolicy`/`perceptionProvider`/`metabolismSimulator` (see addendum) — all built under the
Wave-1 authority law and feeding the headless lifecycle (one supervisor, one door, one receipt spine).

## 2. Improvements proven (comparative, not asserted)

1. **Plaintext-removing forgetting vs donor status-flag tombstones** — storage dumps carry no forgotten plaintext while the chain verifies (convex-test + live). Donor rows retained `value` with `status`.
2. **Strict canonical staleness vs `Date.parse`** — non-canonical timestamps fail closed instead of being coerced (one-law test).
3. **Authority outside Convex vs in-mutation enforcement** — tampered projections provably decide nothing (gate re-verifies); donor's in-Convex pipeline could not be lied to either, but its trust surface *was* the deployment; ours is not.
4. **Crash discipline** — kill-9 transcripts: workflow/memory/receipts identical after restart, nothing executes automatically (R36/R39); donor had no equivalent recorded proof in the compared sources.
5. **Two-checkout process safety** — refuse/never-kill/never-reuse (R39 transcript); donor launchers used global assumptions.

## 3. Losses / gaps (explicit, none silent)

`MISSING` rows above, condensed: signed recall PoP · signed erase attestation + erasure receipts · PQC-signed chain heads ·
donor memory categories as behaviors (episode/hypothesis/mdl/structural/ide/womb) · windowed rate limits · node
identity/trust/cross-grant/revocation/kill-switch (multi-node) · donor migrations for those tables. None are data losses —
the donor repo remains intact and the bridge can carry rows — they are **unported behaviors**, now inventoried.

## 4. Custody / secret classification

Donor sources examined contain key REGISTRIES and PoP protocols (public keys, fingerprints, nonces) — no private key
material was found in the examined files, and none was copied anywhere. Current custody: secrets only in the OS keychain
seam (opaque refs, redacted logs); `.env.local` untracked (deployment pointers only). This report contains hashes and
paths only.

---

# ADDENDUM — `RESOURCE_GOVERNANCE_HOMEOSTASIS` capability family

## A1. Classification

| Item | Class | Evidence |
| --- | --- | --- |
| Owner research analogy/specification (homeostatic-balance objective; digital-metabolism research) | **NOT IMPLEMENTED** | analogy/spec only; `ADR-0001-digital-metabolism-research-only.md` states RESEARCH_ONLY and corrects seven hazards before any code |
| Donor resource-governor / supervisor designs (e.g. symbiote issue #390 "Digital Metabolism v0 — receipted contraction-only resource governor") | **DESIGN SPEC** | grep of donor `core/src` + `convex` finds **no** resourceGovernor/homeostasis runtime — no runtime proof exists |
| Current metabolism scalar/simulator (`apps/brain/src/metabolismSimulator.ts`) | **IMPLEMENTED_PARTIAL (as an isolated advisory simulator) / RESEARCH_ONLY (as a governor)** | pure, integer fixed-point, 5 law tests green; **not wired to any real sensor, cannot affect any budget in the running organism** |

## A2. Health-signal register (current organism)

| Signal | Source | Trust class | Directionality | Calibration | Staleness | False-positive behavior | Authority effect | Recovery evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Chain verdict (`memory:health`/`verify`) | canonical kernel verifier over stored rows | trusted (deterministic recomputation) | binary valid/invalid; invalid ⇒ CONTRACT (ingest/forget refuse) | exact (hash law) | none (recomputed per read) | none observed; tamper tests only trip on real breaks | fail-closed contraction only; never expands | kill-9 transcripts: valid after restart |
| Reactive snapshot counts | recomputed per reflex txn | trusted | informational | exact | none | n/a | none (display) | counts identical across crash |
| Impulse spend budget | `impulseBudget` row | trusted | monotone DOWN; exhausted ⇒ refuse | integer units | none | over-refusal possible if budget set low (safe direction) | contraction only; raising = explicit owner action | live: 64→62 across runs |
| Door liveness / 502s | held door process | trusted (loopback) | degraded ⇒ shell shows degradedSenses | n/a | per request | 502 during backend restart window (honest) | none — projection only | door survived kill-9, recovered to ok |
| Organism status | supervisor pid+port checks | trusted (verified pids) | binary per service | n/a | point-in-time | UNVERIFIED warning path exists | none; exit code only | R39 transcript |
| Scheduled/impulse status | `_scheduled_functions` + impulses rows | trusted | lifecycle states | n/a | reactive | none observed | none | resume-after-crash (R35) |
| Metabolism samples | **simulated inputs only** | `trusted` flag is CALLER-ASSERTED (injected) | trusted ⇒ contract-only; untrusted ⇒ advisory no-op | integer unitScale per dimension (no cross-dimension sums) | out-of-order refused (injected clock) | untrusted floods cannot contract (tested) — no DoS oracle | **none — simulator is unwired** | deterministic replay test |

## A3. Required laws — verdicts against donor/current code

1. *Pressure recommends or monotonically contracts, never expands authority* — **HOLDS (current, tested)**: `Math.min` ratchet, `metabolismGrantsAuthority()===false`; budget/attention are contraction-only. Donor: design-spec only.
2. *Untrusted sensors can't become an authorization or DoS oracle* — **HOLDS (current, tested)**: untrusted samples never contract (no DoS) and nothing in the family authorizes (no oracle).
3. *Release from contraction requires protected authorization* — **HOLDS BY ABSENCE, UNIMPLEMENTED PATH**: no release path exists in code; ADR assigns release to an explicit owner action. Gap: no ceremony-gated release implementation yet.
4. *Hysteresis/cooldown prevents flapping* — **MISSING** (no hysteresis in simulator or budget; honest gap).
5. *Health = challenge-and-recovery, not uptime* — **PARTIAL**: recovery dynamics are proven (crash/restart, resume, reconciliation); *challenges* are not implemented anywhere.
6. *Live destructive challenges forbidden; challenges belong in isolated rehearsal* — **HOLDS BY CONSTRUCTION**: no live challenge exists; the rehearsal organ + sandbox-only apply are the designated isolated venue; external nerves stubbed.
7. *Explicit UNKNOWN state; correlation ≠ causation* — **MISSING** in the simulator (refusals are not an UNKNOWN state); the staleness law's `unknown-age` and containment's `quarantine` are the existing UNKNOWN precedents to reuse.

## A4. Recovery state-machine inventory (NOT implemented — mapping of existing pieces only)

| Stage | Existing pieces (current) | Restart-safe? | Idempotent? |
| --- | --- | --- | --- |
| DETECT | chain verify/health, door 502s, organism status, budget exhaustion | ✓ (recomputed) | ✓ |
| ISOLATE | fail-closed refusals: corrupt-store gate, attention cap, ceiling exhaustion, stubbed nerves | ✓ | ✓ |
| PROPOSE | governed-recursion proposals (seed machine); PR-candidate-only egress | ✓ (durable workflows) | ✓ (workflow key) |
| AUTHORIZE | AUMLOK owner gate OUTSIDE the store; consumed-authority evidence refs recorded | ✓ | ✓ (nonce consume-once) |
| APPLY / REHEARSE | sandbox-only apply; rehearsal organ (two-phase receipt-before-effect) | ✓ (proven kill-9 mid-workflow) | ✓ (exactly-once effects) |
| VERIFY | canonical verifiers; comparative counts after restart | ✓ | ✓ |
| COMMIT / ROLLBACK | workflow terminal phases + receipts; migration-bridge rollback; OCC divergence-defer-to-winner | ✓ | ✓ |

Missing for a full governor: the DETECT→ISOLATE *automation* (today humans/supervisor invoke), hysteresis, UNKNOWN state,
challenge scheduling inside rehearsal, and a ceremony-gated RELEASE — all inventoried, none implemented this wave.
