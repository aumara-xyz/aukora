<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# R45 — independent falsification of issue #75 / PR #72

- **My base:** `main@91e4f6f` · **target:** PR #72 draft, frozen head `02db55b76472814101cc621caaf1d6e480745634` (`fable/mind-organ`), fetched into a **detached quarantine worktree** — never adopted into my lane, never edited.
- **Stance:** falsify, not confirm. I did NOT rely on the PR's README, CLAIMS.md, or its 51-test count. Vectors were hand-authored before reading its own tests.

## Check 1 — main clean, PR truly absent
`packages/` on main = council · council-node · evidence · kernel · memory. **No `packages/mind`, no PR-72 content on main** (verified). The PR is a real draft off `02db55b`; its 26-file diff is genuinely quarantined.

## Check 2 — purity / zero-dependency boundary: TRUE
`npm ci && npm run test --workspace @aukora/mind` → **51/51 pass**, `typecheck` clean. Every `import` across `src/` + `index.ts` is either a **type-only** intra-package import or a Node builtin — **no runtime dependency, no `fs`/`fetch`/`process`/`Date.now`/`Math.random`/`console`** anywhere (grepped). `package.json` `sideEffects:false`, pure ESM. The purity claim holds independently.

## Check 5 — separation of root edits: TRUE
Root/doc/wiring edits (ARCHITECTURE.md, CLAIMS.md, README.md, package.json, package-lock, `test/packageExports.test.ts`) are separate files from the organ implementation (`packages/mind/**`). Gate 5 satisfied.

## Check 3 — mutation/fault vectors (8 required). Suite: [`mind-fault-final.test.js`](mind-fault-final.test.js)
| vector | result |
| --- | --- |
| V1 malformed grid | `segment([[0,1,2],[0],[0,1]])` does NOT throw — defensive. **PASS** (my earlier renderFrame "throw" was a HARNESS error: `renderFrame` requires a well-formed `Obs`; retracted, not a defect). |
| V6 huge input | valid 1000×1000 grid `segment`+`renderFrame` in **53 ms** — no crash, bounded. **PASS** (earlier throw = same harness `Obs` error; retracted). |
| V7 deterministic replay | identical sim+history+plan → byte-identical `rolloutPlan` outcome. **PASS**. |
| V5 impossible termination | history already terminal → `valid:false, reason:/terminal/`; plans hard-capped at `PLAN_MAX_STEPS=8` even given 80 steps. **PASS**. |
| V4 repeated failure | always-dying sim → `valid:true, survived:false, diedAtStep:1` — honest (`valid` = "rollout ran", `survived` carries death). **PASS** (my first assertion miscalibrated; corrected). |
| **V2 contradictory hypothesis** | a `NOOP` step whose `expect:'moved:3:up'` can never hold returns `valid:true, executed:1, survived:true`. **FINDING 1 — REAL.** `rolloutPlan` **never calls `checkPlanExpectation`** (grepped: zero references in `rollout.ts`), yet the governor prompt promises "each plan step executes only while reality matches its expect check … the harness STOPS on the first mismatch." The exported `checkPlanExpectation` exists but is **unwired**; the pure rollout delivers no plan discipline. |
| **V8 trace truncation** | a 2 MB `note` yields a **4 MB** built trace (`buildMoveTrace`). **FINDING 2 — REAL.** Traces are `advisory` + carry `grantsAuthority:false` (good) but are **unbounded**; nothing caps free-text before an adapter could carry megabytes into KIRA/receipts. |

## Check 6 (of #75) / Check 4 — the four promised integration bridges
| bridge (#75 gate 6) | disposition | evidence |
| --- | --- | --- |
| impure arcade / model adapter | **SPECIFIED** | `ports.ts` defines `Simulator`/`ChatMessage`/`EnvState` interfaces only — the contract, no adapter code |
| episodic output → KIRA | **MISSING** | `trace.ts` builds payloads; nothing imports/writes `@aukora/memory` |
| Fu advisory / stuck-state | **SPECIFIED** | `CouncilTrace` type exists in `trace.ts`; no wiring to `@aukora/council` |
| proposer → `SupervisedGenerationEnvelope` | **MISSING** | `SupervisedGenerationEnvelope`'s only consumers are `apps/brain`; `packages/mind` never references it — the "empty proposer seat" is still empty |

Nothing is **UNSAFE** (no code widens routes, signs, or applies — `mindGrantsAuthority()` is a hard `false`, traces pin it). But **0 of 4 bridges are BUILT**: this PR is the pure organ, not its integration.

## Check 5 (false-positive audit) — do the green tests encode the reimplementation, not donor behavior?
**Partially, yes.** `rollout.test.ts` asserts the scoring formula and outcome shape the code produces — it passes precisely because it tests the code, and it **does not** assert the donor's promised per-step expectation-stop (Finding 1). The donor's live engine "caught two real model errors mid-run" via that discipline; the re-authored pure `rolloutPlan` cannot, because the check is unwired. Green ≠ donor-faithful here on the one behavior that most matters for a proposer.

## Disposition: **AMEND**
The package is genuinely pure, deterministic, well-typed, honestly labelled, and its own suite is green — real, adoptable engineering. But before R46 adoption it needs: (1) wire `checkPlanExpectation` into `rolloutPlan` (or delete the unenforced promise from the governor prompt) + a vector proving a bad plan is stopped mid-rollout; (2) a bounded-trace cap with an explicit truncation marker; (3) at least the proposer→`SupervisedGenerationEnvelope` bridge as CODE, since that seat is the entire point of #75. Fresh AUMLOK stays sole authority throughout — no change needed there.

### Smallest demo that proves the proposer useful WITHOUT granting authority
Feed a **recorded** ARC-3 frame/action sequence (no model, no Nebius) into `rolloutPlan` with a deliberately-wrong plan step; show it (a) **rejects** the plan at the first failed expectation and (b) emits an advisory trace with `grantsAuthority:false` — and that `proposalInput` shaped from it still requires fresh AUMLOK to materialize (it refuses, receipted, no candidate dir). That demonstrates "the mind may propose; it never authorizes" on live local wiring with zero authority granted.
