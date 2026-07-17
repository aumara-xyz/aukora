<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# Sam 3 overnight — crash-recoverable effect protocol: brick map + integration guide

Base for all ten bricks: public main `5ae15481bf5676ede97aab28b5c16e189358472c` (the released
`OVERNIGHT_BASE_READY`). Every brick is `apps/seed/**` only, a draft PR, never merged; each is green in-lane
(seed suite + typecheck + public-tree scan). This document maps the directive's requirements to the bricks, gives
the composition order, and names the single remaining integration step (gated on the base bump post-#135).

## Mission requirement → brick

| directive item | brick | PR | what it provides |
|---|---|---|---|
| Effect states PROPOSED→…→COMMITTED + exceptional first-class | `effectProtocol.ts` | #125 | pure state machine `advance`/`reconcile`; the 15 phases; per-transition invariants |
| (2) prepare/execute/observe/reconcile/quarantine/compensate | `effectProtocol.ts` + `recoveryPlanner.ts` | #125, #136 | the transitions + the crash-at-every-phase recovery table |
| (3) after crash in EXECUTING, observe before acting | `effectProtocol.reconcile` + `recoveryPlanner.ts` | #125, #136 | reconcile-by-observation; never blind re-execute |
| (4) post-effect Convex settlement is projection-only | `effectSettlement.ts` | #129 | `validateSettlement` — total, fail-closed projection validator |
| (5) isolation-failure cleanup/quarantine | `refSnapshot.ts` | #128 | protected-ref+tree snapshot; violation → quarantine reason |
| (6) eliminate clean success with a null completion receipt | `effectProtocol` + `effectSettlement` + `effectAudit` | #125,#129,#131 | COMMITTED requires a durable completion ref at every layer |
| (7) rename Map-only "rehearsal" → policy/binding simulation | `hermeticRehearsal.ts` (`simulatePolicyBinding`) | #126 | the Map-only check is `executed:false`, distinct from real rehearsal |
| (8) HermeticRehearsalRunner: run a fixed plan in a no-secret/no-network cell or refuse unavailable | `hermeticRehearsal.ts` | #126 | `runHermeticRehearsal`; honest `unavailable`; never a fabricated pass |
| (9) models select an approved test-plan ID; never arbitrary shell | `hermeticRehearsal.ts` (`ApprovedTestPlans`) | #126 | closed registry; a caller may only name an approved id |
| HARDEN GIT: trusted binary, minimal env, empty HOME/XDG, config/hooks/filters off, argv-only | `localCandidateStage.ts` | #123 | the hardened trusted-git cell + hostile tests |
| HARDEN GIT: protected-ref snapshots before/after; quarantine ambiguous | `refSnapshot.ts` | #128 | `verifyIsolation`; byte-exact fail-closed |
| HOSTILE: fake git in PATH, hooks, malicious config | `localCandidateStage.ts` tests | #123 | sentinel never executes |
| HOSTILE: filters, textconv, submodules (detection) | `gitConfigThreat.ts` | #133 | classifies command-executing/redirecting directives |
| HOSTILE: case folding, Unicode normalization | `candidatePathIntegrity.ts` | #130 | APFS-equivalence collision detection (NFC + case) |
| HOSTILE: SIGKILL at every effect phase | `recoveryPlanner.ts` | #136 | exhaustive safe-recovery table (15 phases × consume marker) |
| closing law: no clean success without a durable ref; no crash → second candidate | `effectAudit.ts` | #131 | append-time + `verifyAuditLog` enforcement over the whole life |
| the composition (the conductor) | `effectCoordinator.ts` | #134 | `driveEffect(ops)` — the canonical order over injected ops |

## Composition order (the coordinator, `driveEffect`)

```
rehearse (policy sim + hermetic) ──▶ ownerAuthorize (the ONE authority)
   │ fail/unavailable → REHEARSAL_FAILED            │ no → REFUSED_AT_OWNER
   ▼                                                ▼
prepare (durable PREPARED; fixes the ONE candidate branch)
   ▼
snapshotBefore (protected refs + tree)
   ▼
runGitEffect  ── consumes PREPARED once ── observes reality  (the ONE effect; hardened git cell)
   ▼
verifyIsolation(before, after)  ── not byte-identical → QUARANTINED
   ▼
terminalize by OBSERVED reality:
   candidate absent            → QUARANTINED (never re-run)
   present + null completion   → RECONCILE_REQUIRED (no clean success without a receipt)
   present + ref → settle (projection-only) + audit → COMMITTED
```

Recovery (on restart, from `recoveryPlanner.planRecovery`): pre-effect → resume; PREPARED-not-consumed → resume;
PREPARED-consumed / EXECUTING / RECONCILE_REQUIRED → reconcile-by-observation; OBSERVED → resume; terminal →
noop; incoherent/unknown → quarantine. The safety witness `couldReExecuteOnResume` is never contradicted.

## What is proven vs. what remains

- **Proven (in-lane, green):** every primitive above, with hostile/negative tests. The full flow is proven over
  an injected `EffectOps` double in `effectCoordinator` (the one committed path + every halt/quarantine branch).
- **NOT claimed:** end-to-end durability against a live store. Sam 2's durable trusted-state / PREPARED contract
  is in the comprehensive integration (#135), not yet on main — so all durable seams here are injected interfaces
  + test doubles by design.
- **Single remaining integration brick (gated on the base bump after #135 merges):** supply the concrete
  `EffectOps` — `advance`/`reconcile` (state machine), `runHermeticRehearsal` (rehearsal), `snapshotProtected`/
  `verifyIsolation` (isolation), `validateSettlement` + Sam 2 store (settlement), `EffectAuditLedger` (audit),
  and the hardened `localCandidateStage.materializeCandidate` (the one git effect) — and delegate the live
  candidate-stage ceremony to `driveEffect`. No new authority path; the owner gate and the reference monitor stay
  the sole authorities.

## Invariants held across the set

1. Git begins only after consuming a durable PREPARED effect.
2. After a crash in EXECUTING, observe reality before acting; never blindly re-execute.
3. No clean success carries a null completion receipt.
4. No crash creates a second candidate.
5. Post-effect settlement is a projection only — no authority, signature, key, or content crosses into the store.
6. Every ambiguous outcome is quarantined, never silently accepted.
7. Nothing in this lane signs, pushes, merges, or mutates main; nothing grants authority.
