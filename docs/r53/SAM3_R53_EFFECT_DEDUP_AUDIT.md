<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# R53 · Sam 3 — effect/Git de-duplication & failure audit (PR #138, one system)

Convergence-only. Audited the effect-protocol system as integrated on **PR #138** (`sam/overnight-integration`)
head `aa11de9e3c25` (base = public main `a5dcd988` = R52 merged). No feature added; one minimal in-lane
disambiguation (a namespace comment on `PreparedEffect.effectId`). AUMLOK v2 bytes and all authority boundaries
untouched (no kernel/authority file changed).

## A. De-duplication matrix — my effect protocol (`@aukora/seed`) vs Sam 4's effect-event store (`@aukora/brain`)

| concept | Sam 3 owner (`apps/seed/src`) | Sam 4 owner (`apps/brain/src`) | verdict |
|---|---|---|---|
| **the word "effect"** | governed-recursion LIFECYCLE (a proposed code change → isolated git candidate) | JOURNAL STEP-EFFECT (a memory/journal step applied exactly once) | **OVERLOADED TERM, two layers.** Not a functional conflict (distinct packages, distinct payloads); flagged so they are never conflated. |
| **`effectId`** | `PreparedEffect.effectId` — content-addressed (intentId, draftHash, nonce); **no deriver in-module** | `deriveEffectId(rehearsalKey, step)` = `canonicalHash({domain:'AUKORA-EFFECT/1', …})` — **the canonical deriver** | **DUPLICATED SEMANTIC OWNER (concrete).** Same name + 64-hex shape, different keyspace. **Repair:** namespace comment on my field pointing at the recursion identity; Sam 4 stays the canonical `AUKORA-EFFECT/1` journal owner. Full convergence (share one deriver) deferred to wiring. |
| **append-only content-free log** | `effectAudit.ts` `EffectAuditLedger` — lifecycle PHASE-TRANSITION ledger (enforces no-second-candidate / no-null-completion) | `effectEventLog.ts` `EffectEventLog` — journal EVENT stream + destroy/rebuild proof | **PARALLEL, different layers.** Mine audits protocol transitions; Sam 4's is the durable event stream. Keep both; owners documented. No merge (they log different things). |
| **projection type** | `EffectSettlementV1` (terminal-outcome projection) | `EffectEventV1` / `EffectProjection` (per-effect journal projection) | Distinct payloads; each has its own closed validator. No conflict. |
| **projection-only / no-authority fence** | `validateSettlement` (closed shape + authority-key regex) | `validateEffectEvent` (closed shape + `textHasSecret`) | **SHARED PATTERN, two validators.** Both refuse authority/secret/extra-key. Convergence opportunity (one shared fence helper) — NOT taken this round (would be new shared surface; convergence-only forbids expansion). |
| **durable store seam** | `PreparedEffectStore` (interface + `InMemoryPreparedEffectStore` double) | `EffectIo` / `EffectEventStore`; also Sam 2 `ConvexWorkflowStore`, `trustedStateStore` (kernel-node) | **THREE store seams.** Mine is foundation-only (no live impl). **Recommendation:** at wiring, `PreparedEffect` persists as a projection through **Sam 2's trusted-state contract** (as its own docstring already states) — do not add a fourth live store. |
| **lifecycle state machine** | `effectProtocol.ts` (15-phase `EffectPhase`, `advance`/`reconcile`) | none (flat event projection) | **SOLE OWNER (mine).** No duplication. Sam 4's cancellation is projection-time, not a phase machine. |
| **recovery / crash** | `recoveryPlanner.ts` (crash-at-every-phase table) + `effectProtocol.reconcile` | `effectEventStore` idempotent re-delivery + `effectEventLog` rebuild | **Complementary layers.** Mine = lifecycle recovery decision; Sam 4's = event-stream convergence. No duplication. |

**Concrete conflicts found:** 1 duplicated semantic owner (`effectId` name across two keyspaces) → minimal comment repair applied. **No compile conflict** (`@aukora/seed` and `@aukora/brain` are separate packages; no barrel/name collision). **No runtime conflict** (see reachability, §B).

## B. Public-export reachability — honest labeling

Every effect-protocol module I added overnight is exported from `@aukora/seed`'s barrel and consumed ONLY by
its own tests and the barrel — **there is NO primary-runtime consumer** (grep of `apps/**/src` finds no
`driveEffect` / `advance` / `effectProtocol` import outside the modules + their tests). Therefore:

- `effectProtocol`, `effectCoordinator`, `recoveryPlanner`, `effectAudit`, `effectSettlement`, `hermeticRehearsal`,
  `refSnapshot`, `candidatePathIntegrity`, `gitConfigThreat` are **FOUNDATION-ONLY** (specified + tested, not yet
  wired). This is stated plainly, not claimed as the live protocol.
- The **primary runtime** effect path remains `mindDoor → localCeremonyRunner → durableRecursion → localCandidateStage`
  (R37/R50), which is production-reachable and green.
- `localCandidateStage.ts` git-cell hardening (R53 overnight #123) **IS** on the primary path (it is the one
  effectful adapter the live ceremony calls) — production-reachable, not foundation-only.

## C. PREPARED-precedes-Git — implemented vs foundation (labeled, not overclaimed)

- **Foundation protocol (`effectCoordinator.driveEffect`):** `prepare()` (durable PREPARED, fixes the ONE
  candidate branch) executes strictly **before** `runGitEffect()`; proven in `r53.effect-coordinator.test.ts`
  (the effect runs exactly once, only after prepare). `gitMayBegin(effect)` is true only for a `PREPARED`,
  not-yet-consumed effect.
- **Primary runtime (today):** the live ceremony does NOT yet consume the new `EffectPhase` machine. Its
  equivalent guarantee is the R50 durable `awaiting-owner` workflow + explicit `materialize` + fresh AUMLOK
  verify + the kernel reference monitor `decide()` — all of which precede any git in `localCandidateStage`
  (the disposable worktree is created only AFTER `monitor.decide()` allows). **So: PREPARED-precedes-Git is
  proven in the foundation protocol and the equivalent owner-gate-precedes-Git holds in the primary runtime;
  the primary runtime does not yet call the new state machine.** (Wiring = the deferred brick.)

## D. No-null-completion & ambiguous → reconciliation/quarantine (proven)

- `effectSettlement.validateSettlement`: a `COMMITTED` settlement with `completionRef === null` → refused
  (`committed-null-completion`).
- `effectAudit`: a `COMMITTED` transition without a completion bit → `audit:null-completion`; `verifyAuditLog`
  re-proves it over a rehydrated log.
- `effectCoordinator.driveEffect`: candidate absent → `QUARANTINED`; present + null completion →
  `RECONCILE_REQUIRED`; isolation violated → `QUARANTINED`; rejected settlement → `RECONCILE_REQUIRED`. No path
  reaches `COMMITTED` without a durable completion reference + projection-only settlement + audit acceptance.

## E. SIGKILL recovery observes reality before any retry (re-run)

`recoveryPlanner.planRecovery` (22 tests, exhaustive over all 15 phases × the consume marker): `EXECUTING`,
`RECONCILE_REQUIRED`, and `PREPARED`+consumed all resolve to `RECONCILE_BY_OBSERVATION` — never `RESUME_FORWARD`.
The witness `couldReExecuteOnResume` is never contradicted, so **no recovery path blindly re-executes**; pre-effect
phases resume, terminals no-op, incoherent/unknown quarantine.

## F. Hostile Git matrix (re-run on the #138 tree, all green)

| directive vector | covered by | class of evidence |
|---|---|---|
| PATH (fake git) | `r53.git-hardening` | fake `git` first on PATH never runs; real candidate still materializes |
| config (global/system/HOME) | `r53.git-hardening` + `gitConfigThreat` | hostile `GIT_CONFIG_GLOBAL`/`HOME` ignored; classifier flags dangerous keys |
| hooks | `r53.git-hardening` | malicious `pre-commit` never executes (`core.hooksPath=/dev/null`) |
| filters / textconv | `gitConfigThreat` | `config:filter-driver` / `config:textconv-command` DETECTED (detection, not live-run — labeled) |
| remotes / credentials | `gitConfigThreat` | `config:remote` / `config:credential-helper` detected |
| path collisions | `candidatePathIntegrity` + `localCandidateStage` r43 | Unicode NFC/NFD + case fold + committed-symlink deny |
| ref movement | `refSnapshot.verifyIsolation` | `isolation:protected-ref-moved` / `tree-changed` |
| ambiguous completion | `effectSettlement` + `effectAudit` + `effectCoordinator` | committed-null-completion / reconcile / quarantine |

## Test totals on the audited tree (`aa11de9e`, AUKORA_* cleared, serialized)
seed **453/453** · brain **215/215** (+2 gated skips) · targeted `r53` suites **115/115** · seed typecheck 0 ·
public-tree scan expected PASS. paid_calls 0.

## Verdict
The two effect families **coexist without a functional conflict** (separate packages, distinct payloads, no
runtime cross-call). The single concrete duplicated-semantic-owner (`effectId` name) is resolved by a minimal
namespace comment; full convergence (one `effectId` deriver, one shared projection fence, `PreparedEffectStore`
onto Sam 2's trusted-state) is the **wiring round's** job, not a convergence-round expansion. My overnight
protocol remains honestly **foundation-only** until that wiring; the primary-runtime effect path is unchanged and
green.
