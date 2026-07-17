<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# R46 — Sam 2 capability-continuity sweep (KIRA/memory · Convex brain · provider/Fu · supervisor · persistence)

Read-only evidence round on `main@f6130296`. Method: runtime/import-graph level, not issue state — every row
below was verified against SOURCE + the deterministic import graph (`sam2-import-graph.json`, same directory)
+ the test/live evidence named per row. Donor pins: `aukora-symbiote@ed1824a` (working tree + blobs; arc3
engine at `e5768a2f`), `aukora-kernel b441edc4d17d` (tree `711336558a13`, per `verify:provenance` byte-identity),
Fu/council canonical seats (kernel reuse). Machine-readable rows: `sam2-capability-rows.json`.

## Runtime entrypoints + reachability (import graph, aliases resolved)

| Entrypoint | Reachable files | What it proves |
| --- | --- | --- |
| `organism-ctl.mjs up` (supervisor) | 2 (ctl + doorCustody) | lifecycle owner; bundles/holds everything below |
| brain door 7141 (`doorServerMain.ts`, supervisor-held) | 16 | composeLive → localDoor → convex contracts; reactive seam |
| local Convex deployment (all `convex/*.ts`) | 17 | memory/heads/workflows/rehearsal/impulses/heartbeat + pure memory via `@aukora/memory` |
| governed mind door 7097 (seed runner, supervisor-spawned) | 35 | consumes `@aukora/brain` barrel — the widest runtime surface |

**Only `apps/brain/scripts/local-ctl.mjs` is runtime-orphaned** (superseded R38 controller; kept as history).
Honest nuance: barrel (`src/index.ts`) reachability = *imported at runtime*, not necessarily *executed*; rows
below carry the stronger per-capability proof grade (LIVE transcript > simulated convex-test > pure unit).

## Capability rows (donor → current → disposition · reachability · laws/tests · degradation)

| # | Capability | Donor (path @ blob) | Current | Disposition | Runtime reachability | Proof grade | Honest degradation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Governed memory core (envelope, content-hash, consent) | `memory/memory.ts @ 46eff426` | `packages/memory/src/envelope.ts` (content-addressed `recordId=canonicalHash({content})`) | ADAPTED_BOUNDARY (stronger: content-free chain) | convex ingest + door recall + mind door | SIMULATED + LIVE (R37/R39 transcripts) | none |
| 2 | Secret-refusal ingest gate | `memory.ts` `remember` (gate DENY) | `convex/ingest.ts` ('use node' scan) + store gate | EXACT_PORT + structural no-bypass | convex action (public door) | SIMULATED + LIVE | AUMLOK-lock does NOT gate advisory ingest (owner ruling open — R42 App.F) |
| 3 | Governed forgetting (RTBF) + erase attestation | `memory.ts` `forget`; donor M2b stub law | store `forget` (Ed25519 verify) + convex `forget` (ML-DSA attestation, scoped/expiring/anti-replay) | EXACT_PORT + SUPERSEDED_WITH_PROOF | convex mutation | SIMULATED + LIVE (Wave-2 live erase transcript) | none |
| 4 | **No-resurrection on re-ingest** | implied by donor tombstone law | both rails refuse re-ingest of forgotten id (R44 defect fix) | FIXED_CURRENT (defect found by negative test) | ingest paths | SIMULATED | — |
| 5 | Chain verify / tamper detection | `memory.ts` `verifyChain` (2-file cross-check) | canonical `verifyReceiptChain` + content-addressing self-check | EXACT_PORT + ADAPTED | convex `verify` query; door `/health` | SIMULATED + LIVE | — |
| 6 | Signed chain heads (donor "Step 4" limit) | SignedChainHeadV3/V4 (`aukoraSignedHead.ts @ b0c2a4fc`, vendored byte-faithful) | `convex/heads.ts` monotonicity + live re-audit (ML-DSA) | SUPERSEDED_WITH_PROOF | convex mutation/query (on demand) | SIMULATED | NOT emitted on every live write (donor B1.5b2) — PARKED_PENDING_OWNER |
| 7 | Signed recall proof-of-possession | `core/src/memoryRecall.ts @ a8a4861b` (`aumlokMemRecall` owner-seed PoP) | ABSENT — door recall is unauthenticated loopback | **MISSING** (custody-gated) | n/a | — | recall auth = loopback/origin-closed perimeter only (R42 App.C/E) |
| 8 | Recall content-minimization (keyed point read, no enumeration) | same donor module ("no content-listing query") | `/memory/recall` is content-bearing + empty-term enumerable BY DESIGN | ADAPTED_BOUNDARY (accepted residual) | door GET | LIVE | single content surface; narrowing PARKED_PENDING_OWNER |
| 9 | Scope-aware recall (#62 empty-shelf) | `kiraBrain.ts @ fa113e8a` scope + isTestFile | `recallScoped`/`scopeCensus`/`hasScope` (Wave 3, opt-in; default recall byte-frozen) | ADAPTED (landed on main `d0bb625`) | library (door recall stays default-shape) | UNIT (serialization-frozen) + dual-rail hash proof | identity-corpus INGEST still owner-gated — the shelf can still be empty, but now honestly reported |
| 10 | Donor memory-category runtimes (episode/hypothesis/mdl/structural/ide/womb) | `f32bcede…` et al. | ABSENT (inventoried R42 App.A) | **MISSING** (scope-gated) | n/a | — | evidence-only source-labeled law shared by all five |
| 11 | Reactive snapshot (derived, non-canonical) | donor in-Convex projections | `brainSnapshot` + heartbeat recompute; corruption REPAIRED from chain (R44 GAP C) | ADAPTED + proven rebuildable | convex query + door `/snapshot` + SSE `/events` | SIMULATED + LIVE (SSE transcript) | — |
| 12 | Durable workflows / persistence / restart | donor durable recursion spec | `ConvexWorkflowStore` (OCC) + crash-window receipt-before-effect reconciliation | ADAPTED_BOUNDARY | convex `workflows.*` + door projections | SIMULATED + **LIVE restart transcript** (R36 `LOCAL_DEV_EVIDENCE.md`) | — |
| 13 | Supervisor lifecycle (one owner) | `docs/CONVEX_CANONICAL_BRAIN_SPEC.md @ a3af164b` + donor #71/#26 | `organism-ctl.mjs` (checkout-scoped PIDs, verified-only signals, Node preflight) + R44 `doorCustody.mjs` | ADAPTED (current is BEYOND the atlas row — see §challenge) | THE root entrypoint | **LIVE** (R39 + R44 Sam 1 token transcript) | voice sidecar absent (degrades loudly); `local-ctl.mjs` superseded-but-present |
| 14 | Mind-door per-boot token custody | (gap — donor printed token) | supervisor mints → env + one 0600 gitignored file; seed adopted (R44b `77e2321`) | FIXED_CURRENT, closed cross-lane | supervisor → mind door | **LIVE** (Sam 1 refuse-tokenless/accept-tokened transcript `da4089e`) | — |
| 15 | compose:live vs held door | (gap) | `assertComposeMayBindDoor` refuses collide/bypass | FIXED_CURRENT | gated live test preflight | UNIT | hand-rolled scripts bypass preflight; supervisor port-refusal is backstop |
| 16 | Provider truth / fail-closed selection | donor provider bridges | `providerPolicy.ts` (fails closed) + truth table on door `/truth` + `/fu` | ADAPTED | door GET + barrel | UNIT + LIVE door reads | — |
| 17 | Bounded Nebius runtime | donor Nebius scripts | `nebiusProvider.ts` PARKED, zero-outbound proven, never-authorize tests | PARKED (quarantine intact) | barrel-imported, NOT invoked | UNIT + zero-outbound observation | armed use = owner + go/no-go gates |
| 18 | Supervised generation envelope | donor gate law | `supervisedGeneration.ts` + `offlineExecutor.ts` (fail-closed harness) | ADAPTED | barrel; executor test-only | UNIT | no live generation path (by design — no model calls) |
| 19 | Keychain custody (opaque refs) | donor env-key handling | `keychain/` (mac impl + double, revocation, redacted logs, broker contract 7142) | ADAPTED (stronger) | barrel; broker not yet a held service | UNIT | broker port reserved, not supervisor-held yet |
| 20 | Fu/council seats | Fu donor canonical seats | `CANONICAL_SEATS` (kernel reuse) on door `/fu` | EXACT reuse | door GET | LIVE read | Fu transport hardening = Fu-lane row (atlas #7), not brain-lane |
| 21 | Legacy migration bridge (dry-run, selection, KIRA classes, gold ceremony) | donor rows + `aukora_memory` fields | `memoryBridge.ts` + `goldRegistry.ts` (content-free carry incl. `gateArgsHash`; AUMLOK-gated commit) | ADAPTED_BOUNDARY | library/test-only (real import owner-gated) | UNIT (bridge suite) | REAL import never run — awaits owner selection + approval |
| 22 | Mind organ (ARC-3 reasoning core) | `spatial/app/arc3/mind.js @ d418ff76` etc. @ `e5768a2f` | QUARANTINED candidate (PR #72; R45 verdict AMEND; 5 amend items) | NOT ADOPTED (by ruling) | none — zero CODE imports on main (the only `packages/mind` references are R45 qualification artifacts: Sam 3's `proposerQualification.ts` comment + threat-matrix JSON, which treat the organ as an untrusted black box) | 45 executed golden vectors (R45) | adoption blocked on the 5 amend items |

## Challenges to canonical tracking (the directive's item (b) — code disagrees with `docs/atlas/ATLAS.json`)

The atlas is issue-derived (`aukora-issue-atlas-v1`; lane rows carry `evidence_grade: PROSE` and a shared
boilerplate line "donor capability, no landed counterpart proof"). Runtime evidence disagrees in five places:

1. **Symbiote #62 (RESTORE_DONOR)** — the retrieval-side counterpart HAS landed: opt-in `recallScoped` +
   `scopeCensus`/`hasScope` with a byte-frozen default contract (main `d0bb625`, dual-rail hash equivalence).
   The un-landed remainder is only the owner-gated identity-corpus ingest. Row should split: retrieval =
   DONE_VERIFIED; corpus ingest = BLOCKED_OWNER.
2. **Symbiote #71 (supervisor, RESTORE_DONOR)** — the row's `current_paths` cites the superseded
   `local-ctl.mjs`. Current reality: `organism-ctl.mjs` (R39) + `doorCustody.mjs` (R44) with a LIVE Sam 1
   verification transcript (`da4089e`) — and `local-ctl.mjs` is the ONLY runtime-orphaned file in this lane.
   Row is stale on both fields.
3. **Memory-continuity rows #57/#60/#44/#61/#93** share one copy-pasted donor/current blob and the same
   "no landed counterpart proof" line — but rows 1–6/11 above ARE landed counterpart proof for the chain,
   forgetting, attestation, and snapshot laws. What is genuinely still missing from the donor set is rows 7
   (signed recall PoP) and 10 (category runtimes) — the atlas should say THAT, not a blanket family miss.
4. **Untracked-but-present (nowhere in the atlas):** the R44 no-resurrection ingest gate (row 4), the
   compose:live supervisor-awareness preflight (row 15), the R44 token-custody law (row 14 — atlas predates
   it), and the R45 executed-vector qualification method itself. These exist, are tested, and are canonical
   behavior; canonical tracking has no rows for them.
5. **KIRA rows #42/#43 (RESTORE_DONOR, "see private forensics")** — cannot be audited from this lane: donor
   pointer is a private ledger reference. Honest verdict: UNVERIFIABLE-HERE, not restorable-by-code; needs the
   owner's ledger, not a lane round.

## Distinguishing source survival from live behavioral proof

Exact source survival (byte-verified): kernel canonical sources (10 files, `verify:provenance` byte-identity
to `b441edc4d17d`); Wave-2 vendored PQC modules (`aukoraPqcSigner`/`aukoraSignedHead`, donor blobs recorded in
headers). Everything else in this lane is ADAPTED with the invariant carried and tested — live behavioral
proof exists for the door/supervisor/persistence/token paths (R36/R37/R39/R44 transcripts + Wave-2 live erase);
simulated (convex-test) proof for the chain laws; pure-unit proof for the portable library. No capability in
rows 1–21 relies on prose alone.

## Bottom line

Nothing in the brain lane silently regressed: every donor law is either carried (often strengthened), or its
absence is a NAMED, owner-gated gap (signed recall PoP; category runtimes; every-write head emission; identity
corpus ingest; AUMLOK-lock-on-ingest posture). The canonical atlas lags the code in the five places above —
recommend a tracking refresh, not code work.
