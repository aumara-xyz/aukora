<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (c) 2026 Aukora -->

# WAVE 1 — Fu / AUMLOK / AURA / Recursion forensics (READ-ONLY)

Lane: SAM 3 · recursion / AUMLOK–AURA. Base: merged main `b38d625697470c9da11afdab106c800260245bf8`.
Donor: `aukora-symbiote` (`~/Documents/AUKORA`, `spatial/` + `core/src/`). Current: `aukora` monorepo
(`packages/{kernel,council,evidence,memory}` + `apps/seed`, `apps/brain`, `spatial`).

**Discipline for this wave:** read-only. NO implementation, NO paid model calls, NO signing/apply/candidate staging,
NO rewrite. This document is the report; it adds no runtime behavior.

Classifications: `EXACT_PORT` (byte/behaviour identical), `MOVED_UNCHANGED` (same code, new location), `ADAPTED_BOUNDARY`
(same law, boundary re-shaped for the monorepo/injection), `SUPERSEDED_WITH_COMPARATIVE_PROOF` (replaced by a
stronger law, proof cited), `EXCLUDED_BY_PETER` (deliberately out of this lane), `MISSING` (donor capability with no
current counterpart).

---

## 1 — Continuity matrix (donor → current counterpart → class)

### 1a. Fu council / fusion / router / spend / transports / execution

| donor (core/src, spatial) | current | class | note |
| --- | --- | --- | --- |
| `aukoraFuCouncil.ts` + `aukoraFuGlyph.ts` (pure 8-seat engine) | `packages/council/src/{aukoraFuCouncil,aukoraFuGlyph}.ts` | MOVED_UNCHANGED | the canonical pure engine is the SAME code, now a workspace package; `apps/seed` never forks it |
| `aukoraFuEngine.ts` (fuller engine + shear) | — | EXCLUDED_BY_PETER | the fuller experimental engine stayed donor-side; the hardened `aukoraFuCouncil` (H1–H8) is the canonical replay |
| `fusionConfig.ts` (models + `fetch` transport + timeouts) | `apps/seed/src/providerTransport.ts` | ADAPTED_BOUNDARY | transport re-shaped to injected `HttpPost` + `CredentialSource` (Keychain/env); no embedded key/endpoint; failures → non-votes |
| `fusionReadingLane.ts`, `presenceLane.ts`, `voiceLane.ts` (spatial live lanes) | `apps/seed/src/fuStructuredAdapter.ts` | ADAPTED_BOUNDARY | the in-organism Fu boundary: advisoryOnly, spend-clamped, receipted, `reviewerFor(outcome)` → `env.review`; UI voice lanes are Spatial-lane, EXCLUDED here |
| `SpendMeter` (in `aukoraFuCouncil.ts`) + `fusionOpsHealth/Retry/CaptureLog.ts` | `packages/council` `SpendMeter` + `apps/seed/src/{councilRunnerBoundary,providerEgress}.ts` | ADAPTED_BOUNDARY | canonical $2/pass·$10/day meter reused; R39 adds `DurableSpendAccount` (persisted day total) + content-free egress receipts |
| `fusionSelfReview.ts`, `fusionSelfOpt.ts`, `fusionSwarm.ts`, `selfEditReviewCouncil.ts` | — | EXCLUDED_BY_PETER | self-optimising/swarm council loops are not in this lane's scope; the advisory-only boundary is |
| `memoryKernelTransport.ts` | (durable side: `durableRecursion.WorkflowStore`) | ADAPTED_BOUNDARY | memory transport is Sam 2's Convex lane; seed defines the `WorkflowStore` contract only |

### 1b. AUMLOK verification / ceremony / onboarding / custody / consumption / owner-gate

| donor | current | class | note |
| --- | --- | --- | --- |
| kernel `authority.ts` `verifyAumlokPromotionV2` (hybrid Ed25519+ML-DSA-65) | `packages/kernel/src/authority.ts` (same) | EXACT_PORT | the verification core is identical; `apps/seed/src/aumlokGate.ts` is a verify-only wrapper that binds intent/draft/root |
| kernel `reducer.ts` `decide()` (consumed-authority reference monitor) | `packages/kernel/src/reducer.ts` (same) + `apps/seed/src/candidateReferenceMonitor.ts` | EXACT_PORT + ADAPTED_BOUNDARY | R39 wires the effect path through canonical `decide()` (self-modify ring, humanClearance, consumptionId replay, payload-bound sig) — one authorization semantics |
| `aumlokSigner.ts` (Ed25519), `mldsaSandboxSigner.ts` (ML-DSA) | `apps/seed/src/ownerFixture.ts` (test/demo hybrid signer) | ADAPTED_BOUNDARY | the runtime NEVER signs; signing is out-of-band. The fixture is a deterministic dev signer; real custody is donor/OS-side |
| `aumlokApproveCeremony/Challenge/Guard.ts`, `aumlokBondCeremony.ts`, `aumlokCeremonySpec.ts`, `aumlokSigningAssistant.ts`, `aumlokApprovalRoot.ts`, `aumlokAuthorityRoot.ts` + `spatial/aumlok-{approve,bind}-serve.ts` | — | MISSING / EXCLUDED_BY_PETER | the COMPLETE ceremony/onboarding/custody/bind flow (phrase challenge, keygen, bind, approve-and-apply-locally) is donor-side; `apps/seed` has verification + a formalized ceremony CONTRACT (`ceremony.ts`) but not custody/onboarding. See §6 |
| `aumlokStatusSnapshot.ts` | (door `GET /api/door` status; `spatialCeremonyAdapter` snapshot) | ADAPTED_BOUNDARY | status is display-only, fence-clean |

### 1c. AURA trace law / event history / ceremony separation / evolving geometry

| donor | current | class | note |
| --- | --- | --- | --- |
| `boundaryTraceTelemetry.ts` (TELEMETRY_ONLY, allowlist, recursive forbidden scan) | `apps/seed/src/auraTrace.ts` | ADAPTED_BOUNDARY | trace law ported; adds frozen `TRACE_LIMITS` + content-free-tombstone `erase`/`verifyErasure` |
| `forbiddenContent.ts` (FORBIDDEN_FIELDS + regex pattern block) | `apps/seed/src/forbiddenContent.ts` | EXACT_PORT | the DRIFT-SYNC pattern block is ported verbatim (provenance noted in header) |
| `aukoraFuGlyph.ts` `GlyphChannel`/`perceive`/`coherenceScore`/`shearMagnitude`/`phaseLock`/`neutralReplayDrift` (the FULL geometric field) | `packages/council` (present, engine-side) — NOT wired into seed geometry | MOVED_UNCHANGED (engine) / MISSING (seed wiring) | see §5: `apps/seed/src/geometry.ts` is a bounded DISPLAY scalar, NOT the donor's evolving glyph-field geometry |
| `restingGlyph.ts`, `vjepaGlyphTelemetry.ts` | — | EXCLUDED_BY_PETER | resting-glyph / vJEPA telemetry are donor experiments, not this lane |
| ceremony/AURA separation | `apps/seed/src/{ceremony,ceremonyView,spatialCeremonyAdapter}.ts` | ADAPTED_BOUNDARY | AUMLOK verdicts and AURA geometry are SEPARATE keys; `feedsApply:false`; read-only shell face |

### 1d. Intent IDs / supersedes / recursion / rehearsal / refusal receipts / path fences / candidate staging

| donor | current | class | note |
| --- | --- | --- | --- |
| `recursiveWorkbench.ts`, `workbenchCommandLoop.ts` (single-driver REPL) | `apps/seed/src/{recursion,durableRecursion}.ts` + door serialization | SUPERSEDED_WITH_COMPARATIVE_PROOF | the ad-hoc REPL is replaced by a fail-closed staged gate + a durable state machine + a serialized door chain (proof: R30/R35/R38 negative suites) |
| `sandboxTestRunner.ts`, `sandboxApply.ts`, `sandboxApplyPermit.ts`, `sandboxEngineBridge.ts`, `openCodeSandbox{Runner,DraftEngine}.ts`, `sandboxPreviewPlan.ts` | `apps/seed/src/{ideEnvelope,localCandidateStage}.ts` | SUPERSEDED_WITH_COMPARATIVE_PROOF | donor sandbox = temp dir + allowlist on the SAME host as real keys. Current = in-memory rehearsal + a DISPOSABLE git worktree that NEVER touches the live tree/main and is authorized only by kernel `decide()`. Proof: R36/R39 isolation tests (main/HEAD/tree byte-identical; no remote) |
| intent IDs / supersedes / lineage | `apps/seed/src/proposal.ts` (`deriveIntentId`/`deriveDraftHash`, byte-compatible golden vectors) | ADAPTED_BOUNDARY | canonical 64-hex intent ids + supersedes depth/attempt limits formalized; pinned golden vectors |
| `workbenchEvidencePacket.ts`, `workbenchReceiptPersistence.ts`, `workbenchRunReport.ts` | receipts via `@aukora/memory` chain + kernel `receiptDraft` + `councilPack.ts` | ADAPTED_BOUNDARY | refusal + terminal receipts are content-free chain entries; `CouncilEvidencePackV1` is the scrubbed, digested, external-review pack |
| path fences | `apps/seed/src/pathFence.ts` | ADAPTED_BOUNDARY | classifier allowed/authority/sacred/secret/invalid + R39 frozen `isSelfProtecting` (table-independent) |
| `repoReadPathResolver.ts` (donor) | `apps/seed/src/ideEnvelope.ts` `RepoReadCapability` (injected) | ADAPTED_BOUNDARY | R0 confined read is an injected capability; the law is pure/testable, and the fs adapter is a follow-up |

---

## 2 — Behavioral-law matrix + lost negative paths

| law | donor | current | status |
| --- | --- | --- | --- |
| hybrid signature required (no Ed25519-only) | kernel verify | kernel verify + `aumlokGate` bind + `decide()` | PRESERVED (stronger: R39 routes the effect through `decide()`) |
| consumed-once authorization (replay) | kernel `decide` consumedIds | `candidateReferenceMonitor` (kernel) + ledger nonce | PRESERVED |
| advisory Fu never authorizes | council `grantsAuthority:false` | `fuStructuredAdapter` + gate separation | PRESERVED |
| non-vote on malformed/timeout/substitution | `classifySeatResult` | same engine + `providerTransport` non-vote-on-failure | PRESERVED |
| spend ceilings fail-closed | `SpendMeter` | `SpendMeter` + `DurableSpendAccount` | PRESERVED (stronger: durable day total) |
| forbidden-field recursive refusal | `forbiddenContent` | same pattern block | PRESERVED |
| receipt-before-effect | workbench receipts | `recursion.ts` + `localCandidateStage` attempt-before-mutation | PRESERVED |
| **live-tree apply permit** (`sandboxApplyPermit`) | donor could apply to the real tree under permit | **REMOVED — candidate is TERMINAL, disposable worktree only** | INTENTIONAL SUPERSESSION (safer). LOST NEGATIVE PATH to re-derive later if live apply is ever re-introduced: the donor's permit revocation / apply rollback tests |
| **onboarding / custody / bind ceremony** | donor `aumlokBind/Approve*` | not in seed | LOST (EXCLUDED_BY_PETER) — the negative paths for keygen/bind/phrase-challenge live in the donor's ceremony tests, not re-derived here |
| **glyph-field shear/coherence geometry** | `aukoraFuGlyph.perceive` | engine present, not wired to seed geometry | PARTIAL — the phase-lock/shear negative paths (suspect-matched-prior-consensus) run inside the council but are not surfaced as AURA geometry |

**Net:** every SAFETY negative path is preserved or strengthened. The lost paths are the ones that came with capabilities deliberately NOT in this lane (live-tree apply, onboarding/custody, self-optimising council).

---

## 3 — Improvements proven (not asserted)

1. **Effect authorization is now the ONE kernel reference monitor** (R39): `materializeCandidate` → `decide()`; no bespoke/weaker path. Proof: `r39.security.test.ts` (armed⇒allowed, unarmed⇒`self_modify_requires_clearance`, replay⇒`replay`, forged⇒`authority_invalid`, wrong-root⇒`authority_root_unknown`).
2. **Isolation is checked, not assumed**: R36/R39 tests assert main/HEAD/tree byte-identical after materialization, no remote, `--no-gpg-sign`, git-subcommand allowlist. Donor sandbox ran on the same host as real keys.
3. **Self-protecting fence is table-independent** (R39): `candidateAllowed` refuses the fence's own code even given a stale `class:'allowed'` verdict — proven in `r39.security.test.ts`.
4. **Durable crash-safety without duplication** (R35): `r35.durable.test.ts` proves crash-between-apply-and-save reconciliation (applied-exactly-once) via the (intent,nonce) pair; a tampered `ownerVerified` projection cannot authorize.
5. **Content-free audit**: receipts + traces + egress receipts carry metadata only; the R30 secret-in-receipt test and R39 content-free-egress test prove the prompt/response/key never enter a receipt.
6. **Byte-compatible intent ids** (R30 golden vectors) — continuity, not drift.

Each improvement is a STRENGTHENING of a preserved law, with a named test; none removes a safety negative path.

---

## 4 — Working pure council logic vs live in-organism Fu transport

- **Pure council logic** = `packages/council` (`aukoraFuCouncil`/`aukoraFuGlyph`): deterministic, offline, no network; two-round bounded fan-out, quorum, phase-lock, English-last synthesis. Fully exercised by the council package tests + `apps/seed` with FAKE transports. **This is proven and green.**
- **Live in-organism Fu transport** = `providerTransport` (DI) + `fuStructuredAdapter` + `fuLiveSmoke` (opt-in). A real paid pass has **NOT** been executed on this node (no key/authorization) — the deterministic path is proven with an injected fake HTTP layer; the real live smoke is opt-in and labelled NOT-RUN ($0). **The pure logic is live; the paid transport is wired but unexercised here.**

---

## 5 — AURA trace law vs the full event-driven geometric pattern

- **AURA trace law** (present, ported): `auraTrace.ts` — a scrubbed, allowlisted, forbidden-field-refusing, content-free-erasable trace of governed events. This is TELEMETRY, not geometry.
- **Full geometric pattern** (donor, engine-side, NOT wired to seed): the glyph field in `aukoraFuGlyph.perceive` — `coherenceScore`, `shearMagnitude`, `phaseLocked`, `neutralReplayDrift`. `apps/seed/src/geometry.ts` is a bounded DISPLAY scalar (`coherence∈[0,1]`, `witnessMode`) that encodes an ALREADY-decided verdict; it is NOT the evolving glyph-field geometry. **The real geometric pattern lives in the council engine and drives the advisory verdict; it is deliberately NOT surfaced as an authority-adjacent AURA signal.** Bridging the two (render the council's real shear/coherence as evolving AURA geometry, display-only) is a defined-but-unbuilt future.

---

## 6 — AUMLOK verification vs complete ceremony / custody / onboarding

- **Verification** (present, EXACT): `verifyAumlokPromotionV2` + `decide()` — given a signed promotion + trusted root, verify hybrid signature, time window, consumption. This is the load-bearing authority check.
- **Complete ceremony / custody / onboarding** (donor, MISSING here): keygen, first-bind, phrase-challenge minting, approve-and-apply-locally, custody rotation, revocation lifecycle (`aumlokBond/Approve*`, `spatial/aumlok-*-serve.ts`). `apps/seed/src/ceremony.ts` formalizes the ceremony CONTRACT (unsigned challenge → custody sign → verify → witness → receipt → sandbox) but the custody/onboarding endpoints are donor/Spatial-lane. **Verification is proven; custody/onboarding is out of this lane (EXCLUDED_BY_PETER).**

---

## 7 — Headless acceptance lifecycle (DEFINED, not implemented)

The exact sequence and the invariant at each step (each is a HARD gate; failure is terminal + receipted):

```
1. MEMORY            @aukora/brain ReactiveMemoryStore recall (integrity-checked, cited)
   inv: recall is read-only; forgotten content never resurfaces; chain verifies.
2. AUMA PROPOSAL     ideEnvelope.draft (capability=propose; target candidate-able + non-self-protecting)
   inv: exact-shape validate; no authority/secret content; Auma may never sign/merge/deploy.
3. FU ADVISORY       fuStructuredAdapter.runFuAdvisory → verdictFromCouncilOutcome (advisoryOnly)
   inv: grantsAuthority:false; quorum + valid basis ⇒ advisory-pass; non-votes/divergence grant nothing.
4. FRESH AUMLOK      candidateReferenceMonitor.decide (kernel decide(): self-modify + humanClearance + consumptionId + payload-bound hybrid sig + trusted root)
   inv: the ONLY authorization; owner-armed; consumed-once; persisted state can never substitute.
5. GOVERNED RECURSION durableRecursion.propose→complete (canonical gate re-verifies EVERYTHING)
   inv: receipt-before-row; retryable stages defer; every terminal receipted.
6. ISOLATED CANDIDATE localCandidateStage.materializeCandidate (disposable worktree, candidate/<id>)
   inv: never push/merge/sign/main; HEAD/main/tree byte-identical after; TERMINAL, never live-tree apply.
7. RECEIPTS          memory chain + kernel receiptDraft head bound into the completion receipt
   inv: content-free; lineage read via recall; chain verifies.
8. REACTIVE RECOVERY durable restart re-reads state, re-verifies, emits PLAN only — NEVER auto-resumes an effect
   inv: an effect requires a fresh explicit owner invocation + fresh AUMLOK; no auto-apply on restart.
```

---

## 8 — Confirmation: nothing but a fresh AUMLOK decision authorizes

| candidate authorizer | verdict | evidence |
| --- | --- | --- |
| Fu advisory output | CANNOT authorize | `grantsAuthority:false`; `verdictFromCouncilOutcome` never mints; gate is separate |
| AURA geometry / trace | CANNOT authorize | `GEOMETRY_ONLY`/`TRACE_ONLY`, `feedsApply:false`; display-only; R31/R34 view-safety tests |
| Convex / durable workflow state | CANNOT authorize | `WorkflowStateV1` is a projection; `complete` re-verifies; tampered `ownerVerified` refused (R35 test) |
| door / ceremony-runner supervisor | CANNOT authorize | `mindDoorGrantsAuthority:false`; the door composes but `decide()` is the sole authorizer |
| metabolism / spend / timing | CANNOT authorize | refuse-only inputs; latency is secondary; `latencyOnlyClassifierSufficient()===false` |

**Only** `candidateReferenceMonitor.decide()` (kernel `decide()`, owner-armed, hybrid-signed, consumed-once) authorizes the one effect.

---

## Addendum A — CONTRADICTION_SHEAR

- **Donor (real code, not metaphor):** `core/src/hypothesisMemory.ts` `LiquidHypothesis` preserves conflicting claims as
  SOURCE-BOUND, queryable, explicitly UNRESOLVED evidence: `status: open|supported|contradicted`, with
  `evidenceForReceiptIds` / `evidenceAgainstReceiptIds` (both retained). The council's `aukoraFuGlyph` keeps per-seat
  signed claim vectors over a shared frozen basis and FLAGS disagreement (`shearMagnitude`, `phaseLock`,
  `neutralReplayDrift`) without resolving it.
- **Metaphor boundary (confirmed):** shear/coherence/phase-lock are GEOMETRIC METRICS of the glyph field — advisory
  evidence only. **No phi / knot / topology constant is an authority or an acceptance threshold.** No empirical
  validation ⇒ no constant becomes a gate. `EVIDENCE_NEVER_AUTHORITY` holds.
- **Current (seed):** the council preserves per-pass contradiction transiently; there is **no first-class, durable
  "source-bound unresolved contradiction" memory** in `apps/seed` (MISSING). The donor `hypothesisMemory` is the
  reference design for it. Recommendation (defined, not built): a KIRA memory kind that stores competing claims with
  for/against receipt ids and an explicit `unresolved` state, queryable, never auto-resolved, never authority.

## Addendum B — EVIDENCE_NEVER_AUTHORITY

| capability | donor | current | class |
| --- | --- | --- | --- |
| strip-neutrality replay | `boundaryTrace` neutral replay; council `neutralReplayDrift` (H8) | `packages/council` (present) | MOVED_UNCHANGED |
| decode-to-readable | evidence canonical decode (`canonical.ts`) | `packages/kernel/src/canonical.ts` | EXACT_PORT |
| unknown-representation quarantine | `forbiddenContent` recursive scan; `classifySeatResult` non-votes | `apps/seed/forbiddenContent` + council | EXACT_PORT + MOVED |
| hostile-parser limits | evidence ReDoS-bounded catalogue; `extractPacketBlock` bounded; strict canonical bytes | `packages/evidence/catalogue.ts` + council + kernel | EXACT_PORT |
| timing neutrality | `latencyOnlyClassifierSufficient()===false`; latency secondary | `packages/council` | MOVED_UNCHANGED |
| artifact provenance | SPDX headers + `PROVENANCE.md` | present repo-wide | PRESERVED |
| incident receipts | council `SecurityIncident`; boundary-trace receipts | council + `auraTrace`/door events | ADAPTED_BOUNDARY |

**Confirmed:** unreadable / model / timing channels never affect authorization — they are quarantined to non-votes or
refusals, and authorization flows only through the kernel decision.

## Addendum C — GOVERNED_EXPERIMENT_LOOP

| element | donor | current | status |
| --- | --- | --- | --- |
| immutable baseline / evaluation | `sandboxTestRunner`, recursion prereg | rehearsal via governed gate | PARTIAL — no frozen immutable-baseline scorer in seed |
| isolated candidate mutation | `sandboxApply` (permit) | `localCandidateStage` (disposable worktree, terminal) | SUPERSEDED (safer) |
| fixed time / spend / attempt budget | fusion `SpendMeter`; workbench limits | `LIMITS` + `metabolism` + `DurableSpendAccount` + wall-time | PRESERVED |
| measured comparison | donor fusion artifacts | — | MISSING (no objective A/B comparator) |
| keep / discard decision | — | — | MISSING (no automated keep/discard) |
| rollback | donor apply rollback | gold `rollbackDraftHash` (owner ceremony) | PARTIAL (manual, ceremony-gated) |
| receipts | workbench receipts | memory chain + kernel receipts | PRESERVED |

**The eventual safe loop** — sense → competing hypotheses → bounded isolated rehearsal → objective comparison → Fu
advisory → fresh AUMLOK → promotion candidate → monitor → rollback if invariants regress — has its GATES built
(rehearsal, isolation, budgets, advisory, fresh AUMLOK, candidate, receipts). **MISSING for a future wave:** the
first-class contradiction/hypothesis store (Addendum A), an immutable-baseline scorer, an objective comparator, and a
monitor-then-rollback-on-regression controller. None of these should authorize; all must remain evidence + gates.

## External autoresearch archive — provenance HOLD

Not imported this wave (as directed). Its README declares MIT but the ZIP lacks a LICENSE file — **provenance/license
unverified ⇒ do not import.** Its never-stop / direct-edit autonomy is incompatible with Aukora's gate + isolation +
budgets + owner-approval discipline. Any future harvest is GENERIC invariants only (consent, reversibility,
non-suggestive interaction, stop conditions, deletion closure, rollback). Healing/clinical language + sensors are
RESEARCH_ONLY — no therapeutic diagnosis / trauma inference / crisis dispatch / somatic scoring.
