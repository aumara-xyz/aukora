<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# R45 — independent qualification of the `@aukora/mind` candidate (PR #72 @ `02db55b`)

Independent review per ROUND_DIRECTIVE R45 / issue #75. Reviewer: Sam 2 (BRAIN lane) — not the candidate's
author. Everything below was verified executable-first on this machine; nothing was taken from the PR's own
claims without re-derivation. **No adoption performed**: the organ was never committed to this lane (a temporary
uncommitted copy was used to run its suite, then removed; worktree verified clean). No model call, no Nebius,
no authority change.

## 1. Provenance + license/IP basis — **PROVEN**

- **Donor commit exists and is exact:** `e5768a2fcf974a564ef842551a27bbb6287e6c8b`
  (2026-07-11, "arc2: T6 socket-press-assembly…"), reachable locally on
  `origin/fable/arc3-reasoning-engine-20260710` of the private `aukora-symbiote` repo — precisely what the
  candidate's headers claim.
- **Donor files + blobs at that commit** (`spatial/app/arc3/`): `mind.js @ d418ff76…` (372 ln),
  `engine.js @ 7bf14461…` (1380 ln), `rollout.js @ f0ed9653…` (66 ln), `mock-arcade.js @ a609716a…`,
  plus `mind.d.ts @ c832de5b…`, `engine.d.ts @ 8423e47e…`.
- **License basis:** every donor source above carries `SPDX-License-Identifier: AGPL-3.0-or-later` +
  `Copyright (c) 2026 Aukora` **in the donor itself**; the candidate keeps the same identifier and holder.
  Honest nuance: the donor repo is `"private": true` with **no root LICENSE file and no package.json license
  field** — the IP basis is the per-file SPDX headers + single copyright holder + the owner's own direction
  (issue #75). No third-party code was found in the compared surface (no ARC-prize harness code; the arcade is
  the donor's own mock).
- The donor's own export blueprint (`docs/arc3/REASONING_ENGINE_EXPORT.md @ e5768a2f`) names exactly this
  five-port extraction — the candidate implements that blueprint.

## 2. File-level map — donor → candidate → disposition

**Pure package subset (`packages/mind/**`, 8 src + 7 test + 4 config/docs):**

| Donor (at `e5768a2f`) | Candidate | Disposition |
| --- | --- | --- |
| `mind.js` COLOR_NAME/HEX, renderGrid, renderSegments, renderFrame, boundingBox | `src/grid.ts` | **ADAPTED (typed)** — behaviorally byte-identical (vectors V1/V2) |
| `engine.js` `segment()` | `src/grid.ts` `segment()` | **ADAPTED** — identical algorithm/output (V3); safer empty-grid edge (donor THROWS on `[]`, candidate returns empty — V3b) |
| `mind.js` `renderDiff` (mover ≥4 cells, integer rounding, composite direction) + `checkPlanExpectation` (mover ≥2 cells, >0.5 centroid) | `src/grid.ts` `detectRigidMoves` + both callers | **ADAPTED WITH REASON (declared)** — the donor's diff/plan asymmetry is unified on the plan-side law; plan-side verification is byte-identical (V8 ×11), diff RENDERING changes (V5/V6/V7, below) |
| `mind.js` parse pipeline (tryParseFrom, scanForObject, extractJsonObject, normalizeAction, parseMindReply, validateAction) | `src/reply.ts` | **ADAPTED (typed)** — byte-identical verdicts across 15 adversarial vectors (V9); plan parsing split into `src/plan.ts` with the same caps (8 steps / 40-char expect / 600-char memo) |
| `mind.js` MIND_SYSTEM_PROMPT + buildTurnMessage | `src/governor.ts` | **ADAPTED WITH REASON** — semantics preserved; "game"→"environment" rewording (V10: single-word delta in STAGNATION line; prompt likewise) |
| `mind.js` TurnWindow | `src/window.ts` | **ADAPTED (typed)** — identical (V11) |
| `rollout.js` rolloutPlan/rolloutBest (bound to the donor arcade) | `src/rollout.ts` | **ADAPTED WITH REASON** — arcade import replaced by an injected `Simulator` port; on the SAME world (donor mock-arcade behind the port) outcomes and scores are **identical** (V13 ×5, incl. `rolloutBest` ordering) |
| *(driver-side ad-hoc JSONL receipts in `scripts/fable-arc3-*.ts`)* | `src/trace.ts` | **NEW (donor-inspired)** — typed advisory receipt-payload builders; every payload pins `advisoryOnly:true` / `grantsAuthority:false`; `mindGrantsAuthority(): false` |
| `mind.d.ts` / `engine.d.ts` fragments | `src/ports.ts` | **NEW** — the five-port contract (Env, MindSocket, Simulator, TerminalSignal, EpisodicNote); types only |
| — | `test/*.test.ts` (7 files) | **NEW** — 51 tests; all pass on this machine; typecheck clean |

**Root docs/wiring (SEPARATE from the organ, per issue #75 gate 5):** `ARCHITECTURE.md`, `CLAIMS.md`,
`README.md`, root `package.json` + `package-lock.json`, root `test/packageExports.test.ts` — integration
surface, not organ implementation. Should land in the ADOPTION round, not with the organ file-drop.

**Explicitly NOT ported (correct):** the arcade/env itself (`engine.js` game logic, `mock-arcade.js`), live
drivers (`scripts/fable-arc3-*.ts` — fs/network/keys), episodic store I/O, council calls. These are the four
bridges issue #75 gate 6 reviews separately.

## 3. Golden behavioral vectors — donor executed vs candidate executed

Method: donor blobs extracted from `e5768a2f` and RUN as-is (plain ESM); candidate bundled from PR #72
`02db55b` with esbuild and RUN; outputs JSON-compared. Rollout equivalence drives BOTH implementations over
the **same deterministic world** (donor mock-arcade, seed 7, `mk-maze`) — the candidate through its Simulator
port. **45 vectors: 40 IDENTICAL, 5 deltas — every delta explained, none unexplained.**

| Area | Vectors | Result |
| --- | --- | --- |
| Grid render / segments / segment | V1,V2,V3 | IDENTICAL |
| Diff no-op + first-frame | V4,V4b | IDENTICAL |
| Plan-expectation grammar (any/changed/moved/moved:c:dir/unknown/no-grids, 2-cell + 4-cell + diagonal movers) | V8 ×11 | **IDENTICAL** (the safety-relevant law — what a plan may keep executing under — is unchanged) |
| Reply parsing (clean/fenced/chatter/numeric/"A4"/click forms/bad click/plan cap 8/bad plan click/memo 600/expect 40/no JSON/array/no action) | V9 ×15 | IDENTICAL |
| Turn window parity + bound | V11 | IDENTICAL |
| Action availability refusal | V12 ×3 | IDENTICAL |
| Rollout on the same world: 4 plans + rolloutBest scoring/ordering | V13 ×5 | IDENTICAL |
| Containment pins (candidate-only) | V14 | `mindGrantsAuthority()===false`; every trace payload `advisoryOnly:true, grantsAuthority:false` |

**The 5 labeled deltas (all in diff RENDERING, the governor prompt, or an edge):**
1. **V6/V5 mover threshold (declared):** candidate labels rigid movers at ≥2 cells (donor diff required ≥4),
   so small movers now get a `MOVED` line the donor omitted. Plan-side verification identical (V8).
2. **V7 direction rendering (declared):** donor printed composite directions ("down right", sometimes with a
   trailing space); candidate prints the dominant axis only (`[down]`), ties to horizontal.
3. **V10 wording (declared):** "game"→"environment" in the prompt + STAGNATION line; single-token, semantics preserved.
4. **V3b empty-grid edge (improvement):** donor `segment([])` THROWS TypeError; candidate returns
   `{background:0, regions:[]}` — candidate is safer.
5. **AMPLIFIED INHERITED ARTIFACT (my finding, not declared):** the gained/lost-centroid method labels the
   **background color as a counter-mover** ("color 0 white block MOVED …") whenever a block moves. The donor
   law had the same artifact at ≥4 cells; the unified ≥2 threshold makes it fire on nearly every move, adding a
   meaningless line to every diff the model reads. Not unsafe (rendering only) — but an easy legibility AMEND:
   exclude the frame's background (or the majority color of the changed set) from mover labeling.

## 4. Determinism · bounded work · refusal · purity

- **Purity:** every import across `src/` + `index.ts` is relative-only — zero external deps, zero node
  builtins, zero `@aukora/*`; grep-clean for `Date.now|Math.random|fetch|process|require|globalThis|
  setTimeout|console` — no clock, no randomness, no I/O, no env. No memory/provider/fs/network/authority
  import slipped in. `package.json` declares no runtime dependency.
- **Determinism:** all 45 vectors byte-stable across repeated runs; nothing nondeterministic exists in the
  package by construction.
- **Bounded work per call:** plan ≤8 steps · expect ≤40 chars · memo ≤600 · window `maxPairs` (default 5) ·
  `segment` capped at 96 regions · rollout breaks on WIN/GAME_OVER and executes ≤plan-length steps · diff
  cell list capped at 24 rendered. **Honest scope:** the package contains NO run loop — turn budgets, retry
  policy, and termination live in the DRIVER (the impure adapter bridge, issue #75 gate 6, reviewed separately).
  In-package, nothing can loop unboundedly.
- **Error/refusal:** unparseable reply → `{ok:false}` error; malformed/illegal click → refused; illegal plan
  click → step dropped; unknown expectation → fails safe; unavailable action → refused; rollout from terminal
  history → `{valid:false}` refusal. All donor-equivalent (V8/V9/V12; terminal refusal law identical in code,
  donor-side vector limited by the arcade's non-terminating repeated-action worlds).
- **Candidate's own gate:** 7 test files / **51 tests pass**; `tsc --noEmit` clean (run from a temporary
  uncommitted copy; removed after — worktree verified clean).

## 5. Recommendation — **AMEND (small), then ACCEPT-FOR-R46-ADOPTION of the pure subset**

The candidate is a faithful, typed, port-hardened re-authoring of a proven donor engine, with real
improvements (unified move law, safer edges, containment-pinned traces, injected simulator). Nothing
unexplained diverges; the safety-relevant laws (plan verification, parsing refusals, rollout outcomes) are
byte-identical to the donor. Amendments requested before adoption:

1. **Separate root wiring from the organ** (issue #75 gate 5): adopt `packages/mind/**` alone in R46;
   `ARCHITECTURE.md`/`CLAIMS.md`/`README.md`/root `package.json`/`package-lock.json`/root export test land
   with the integration PR, not the organ drop.
2. **Background counter-mover artifact (§3.5):** either filter the background color from mover labeling or
   record an explicit decision to accept the noise — one small `detectRigidMoves`/`renderDiff` touch.
3. Record deltas V5/V6/V7/V10 as ACCEPTED rendering/wording changes in the package README (they alter what a
   model SEES vs the donor; the prompt-behavior consequences are a live-driver question, outside this pure review).

**Smallest safe file subset for R46 adoption:** `packages/mind/{index.ts, package.json, tsconfig.json,
vitest.config.ts, README.md, src/{ports,grid,plan,reply,window,governor,rollout,trace}.ts, test/*}` — nothing
else. The four bridges (arcade/model adapter, KIRA episodic, Fu advisory, proposer→supervised-generation)
remain UNBUILT and separately gated; fresh AUMLOK remains the only authority.

## Gaps / residuals (honest)
- Behavioral vectors cover the pure surface only; live-driver behavior (retries, budgets, stuck-state council,
  episodic distillation) is NOT covered here — it lives in the impure bridges, per issue #75 gates 6/8.
- The donor-side terminal-refusal vector could not be forced on the sampled arcade world (non-terminating under
  the probe sequence); the law was verified identical by code inspection and is covered by the candidate's own suite.
- License basis rests on per-file SPDX + single holder (no donor root LICENSE) — flagged for the owner's records.
