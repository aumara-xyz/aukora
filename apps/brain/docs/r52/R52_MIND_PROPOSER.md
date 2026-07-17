<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# R52 — @aukora/mind wired into the governed runtime without authority (issue #109)

Base `main@5ae15481`. Smallest real closure of the causal slice, using EXISTING organs (no second mind, store,
council, gate, or workflow engine):

`bounded Env observation + cited KIRA context → @aukora/mind (observe→hypothesize→act→verify→trace) → unsigned
SupervisedGenerationEnvelopeV1 → seed assessEnvelope qualifier → DurableRecursion.propose over
ConvexWorkflowStore → durable pending → STOP awaiting fresh AUMLOK`.

## The bridge (my lane)
- `apps/brain/src/mindProposer.ts` — `runMindProposal(...)` runs ONE bounded mind loop and packages the mind's
  advisory output as an unsigned `MindProposalEnvelopeV1` (structurally the seed's
  `aukora-supervised-generation-envelope-v1`; redeclared locally so brain never imports seed → no package cycle).
  Imports ONLY `@aukora/mind` + `@aukora/kernel/canonical`. NO fs/convex/github/signing/credential; `grantsAuthority`
  constant false. `ScriptedMindSocket` is the injected, credential-free transport (a private live model would
  implement the same `MindSocket` behind the keychain broker; Spatial never sees it).
- `@aukora/mind` is now a production dependency of `@aukora/brain` and reachable from its barrel (`src/index.ts`).

## Acceptance (issue #109) → evidence (`apps/brain/test/r52.mindProposer.test.ts`, 13 tests, all green)

| Acceptance criterion | Evidence | Label |
| --- | --- | --- |
| production composition imports the existing @aukora/mind; no third engine | dep added; `runMindProposal` reachable from `@aukora/brain` barrel; reachability test | LIVE (real import) |
| injected MindSocket = local adapter, no credentials to Spatial | `ScriptedMindSocket` (no network, no key); source-scan test | LIVE (source) |
| one bounded observe→hypothesize→act→verify→trace loop | happy-path test: trace step verified, envelope emitted | TEST |
| checkPlanExpectation after every step; halt/re-prompt on mismatch | expectation-mismatch test halts fail-closed within the re-prompt budget | TEST |
| KIRA context with citations + uncertainty; Fu advisory-only | `CitedContext` carries recordId+createdAt citation + uncertainty, shown to the mind; envelope `advisoryOnly:true` | TEST |
| mind output → unsigned envelope → passes proposer qualification → halts for AUMLOK | envelope → real seed `assessEnvelope` → `proposer:admitted-to-owner-decision`, `haltedBeforeSignature:true` | LIVE (real qualifier) |
| no fs/GitHub/Convex-authority/signing/candidate-stage/main-write in the mind | source scan: only `@aukora/mind` + `@aukora/kernel/canonical` imported; `grantsAuthority:false` | LIVE (source) |
| poisoned output, runaway plans, stale head, authority-shaped text fail closed | poisoned-secret → `forbidden-content`; authority-shaped → contained; runaway plan → bounded/halted; stale head → contained-earlier | LIVE (real qualifier) |
| model-free fallback honestly labelled if adapter absent | `socket:null` → `mode:'model-free'`, labelled, no envelope | TEST |
| durable pending + no duplicate + restart persistence | mind proposal → `DurableWorkflowSession` → `awaiting-owner`, `ownerVerified:false`; re-propose → ONE row | TEST-ONLY (convex-test); the SAME `ConvexWorkflowStore` is proven on a REAL backend with a real SIGKILL/restart by R51 (`apps/brain/scripts/r51-canary.mjs`, exit 0) |

## Preserved
R50 (`apps/seed/test/r50.process-ceremony.test.ts`, 15/15) and R51 (`npm run canary:r51 --workspace @aukora/brain`,
exit 0 — real `convex-local-backend`, real `kill -9`, restart) both re-run green this round; untouched.

## Boundaries held
No live provider, managed Convex, Nebius, Inkling, Tinker, signing, Git materialization, auto-promotion, UI
redesign, or metabolism. Deterministic injected transport only. The mind proposes; it never authorizes.
