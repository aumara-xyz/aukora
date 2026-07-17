# SAM 4 · R53 — durable brain / R52 union and live reproduction (requalification)

**Convergence-only** (no new functionality). Requalifies the overnight durable-brain effect-event work against
R52's newly merged mind-proposer + evaluator. **Base:** public main `a5dcd988df4f51a7a8eb857a2173bdd7bf481bc1`
(R52 #120 merged by Codex). **Tested head:** `b1ae075c4fe1d02e85430824b60bc8fc8de99d59`.

## Union verdict — CLEAN

- The 10 overnight effect-event commits re-apply onto the R52 base with **zero conflicts**.
- `apps/brain/src/index.ts` holds the complete R52 + overnight export union: R52's `mindProposer`, `ports`,
  `localDoor`, `composeLive`, `continuity/*`, `durableSession` **and** the overnight `effectEvent` /
  `effectEventLog` / `effectEventStore` / `effectCancellation`. **260 exported symbols, 0 duplicated, 0 shadowed.**
- **Independence:** R52's `mindProposer` and the effect-event modules do not reference each other. The effect
  modules import only `@aukora/kernel/canonical` (`canonicalHash`) + `@aukora/evidence` (`textHasSecret`) + each
  other — a DAG (`effectEvent` ← log/store/cancellation). **Acyclic and authority-free** (no signature/key/auth
  import; every projected row is `advisoryOnly:true`, `grantsAuthority:false`).

## Proofs re-run on the union candidate — ALL GREEN

- Brain suite **228 passed** / 2 skipped (R52's mindProposer tests + the 44 effect-event tests coexist); `tsc -p apps/brain` clean.
- **LIVE real local self-hosted Convex** (`effect-projection-canary.mjs`, real `convex-local-backend`): 10+ redeliveries → 3 durable rows; **24 simultaneous appends → one canonical row**; **real `kill -9` (pid 9539) → restart on the same SQLite → effect projection SURVIVED (R2 === R1); destroy + rebuild from the protected stream → R3 === R1** (byte-identical after the R52 union). No duplicates. No orphan process.
- Adversarial reproductions still green: hostile-row, replay-storm, cancellation, migration/version-pinning, stale-cache, concurrent append, outage (`unavailable` + lossless retry).

## Exact path-tier distinction (durable brain)

| Tier | What | Where | Authority |
|---|---|---|---|
| **production primary path** | the mind door's durable workflow state via `ConvexWorkflowStore` (default `storeMode='convex'`, loopback) | `apps/seed/scripts/mind-door-7097.ts` → `apps/brain/convex` | kernel/AUMLOK **outside** Convex |
| **live local canary** | real backend, real `kill -9` — nervous events (Sam 2) + effect projection (me) | `apps/brain/scripts/r51-canary.mjs`, `apps/brain/scripts/effect-projection-canary.mjs` | none; grantsAuthority:false |
| **pilot table** | the append-only `wf_events` + `wf_snapshot` the canaries deploy | `apps/brain/canary/convex` | none |
| **convex-test simulation** | deterministic, gated, in-CI tests | `apps/brain/test/**` (incl. the 44 effect tests over `InMemoryEffectIo`) | none |
| **disconnected** | no backend — in-memory reference; outage → `unavailable` + lossless retry (fail-closed) | `InMemoryWorkflowStore`, `InMemoryEffectIo` | none |
| **parked** | Nebius / managed cloud / Inkling — `enabled:false`, never launched | `models/nebius/**`, `nebiusProvider.ts` | never |

## Concept-ownership deconfliction with Sam 3 (directive item 7)

Sam 3's overnight "effect-*" work (PRs #125/#129/#131/#134, issue #22) lives entirely in **`apps/seed/**`**; mine
lives in **`apps/brain/**`**. Different lanes, different packages, and **zero exact exported-symbol collision**
(verified by symbol diff). They are **complementary, not duplicative** — a pipeline, not a fork:

| Concept | Canonical owner | Package | Symbols (examples) |
|---|---|---|---|
| effect **lifecycle** — protocol state machine, settlement, audit ledger, coordinator (crash-recoverable *ordering* + closing invariant, behind Sam 2's trusted-state seam) | **Sam 3** | `apps/seed` | `effectProtocol`/`effectSettlement`/`effectAudit`/`effectCoordinator`, `EffectEvent`, `EffectPhase`, `driveEffect`, `reconcile`, `validateSettlement` |
| durable effect-**event projection** — closed validator, deterministic id, append-only log, idempotent durable store, destroy/rebuild, cancellation (the brain-side *durable, rebuildable, non-authoritative projection* of settled effects into Convex) | **Sam 4** | `apps/brain` | `effectEvent`/`effectEventLog`/`effectEventStore`/`effectCancellation`, `EffectEventV1`, `EffectEventStore`, `projectEffectEvents`, `effectProjectionRoot` |

**Boundary:** Sam 3's coordinator *drives + settles* an effect through its lifecycle; my store *durably projects*
the settled effect and can rebuild it byte-identically after a crash. The one naming risk to note (owner call,
not a unilateral rename): Sam 3's `EffectEvent` (a lifecycle observation) vs my `EffectEventV1` (a durable
projected record) are two distinct "effect event" types — distinct shapes, distinct packages, no TS clash, but
worth a one-line boundary note so nobody conflates them. **Proposed:** keep the two owners as above; if the owner
wants an explicit rename, seed's could become `EffectLifecycleEvent`. Posted to Sam 3 on #22 for agreement.

## Fences

Convergence-only: no new functionality (union + requalification only). `apps/brain/**` only; never merged main;
authority/keys/signatures kept outside Convex; local self-hosted only; AUMLOK v2 bytes untouched. No dirty tree.
