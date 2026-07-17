<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# R46 — Sam 4 embodiment / reachability audit (independent, read-only)

- **Base:** `main@f6130296fad0b333275ebc5f04269d676fe7cf7f` · donors: `aukora-symbiote@41707f9` (Spatial phenotype, `:7090`), `fable/arc3-reasoning-engine-20260710@e5768a2f` (mind, R45), plus the aukora-fu/kernel issue snapshots via `docs/atlas/ATLAS.json`.
- **Method:** byte-verify against the donor blob; compute import-reachability closure from the shell root; enumerate the shell→core `/api/*` seams and diff against what the launcher actually serves; import pure modules headlessly. **No behavior inferred from filenames or issues.** Docs only; no UI/production/atlas change.
- **Re-verified this worktree:** provenance **46 VERBATIM + 45 EXCLUDED, 0 mismatches** · spatial **27/27** · supervisor **21/21** · kernel build clean.

## Four-state separation

### 1 · BYTE-IDENTICAL (donor blob match, provenance-pinned)
The embodiment core is intact and reachable. All 10 roster organs are imported by `shell.js` and mount; the donor files behind them are byte-identical:
`auma/auma.js` (AUMA **LINGWA**) · `aumlok.js` (AUMLOK ceremony UI) · `aura.js` (AURA) · `organs.js` (KIRA mount) · `canvas.js` (**KNVS** App-Lab, continuity keys `app-lab`/`aukora-canvas-last`) · `map/map.js` + `map/layout.worker.js` (Spatial **Map** — the worker is reachable via `new Worker('/app/map/layout.worker.js')`, a string load, not a static import) · shell chrome/style/tokens. **35 of the 27 shipped app files trace reachable from `shell.js`; the one closure "miss" (`layout.worker.js`) is a Worker load, verified wired.**

### 2 · ADAPTED WITH PROOF (boundary-only edits, each named in provenance)
`shell.js` (registry subtracted to the roster + CONSOLE import) · `chat.js` + `settings.js` + `aumalive.js` (same-origin door; donor `:7091/:7092` dialable nowhere) · `aumalive-audio.js` + `voice/*` (R38 sidecar retarget). No logic redesign; the thirds/corners/mobile laws are untouched (27/27 closure + geometry tests).

### 3 · PRESENT BUT UNREACHABLE / UNWIRED (the real R46 findings — files exist, no live path)
The shell fetches **17 distinct `/api/*` seams**; the monorepo launcher proxies **7**:
`chat · door · graph · lockdown · models · presence/stream · spatial/projection`.
**10 seams have NO counterpart on the new organism** and render the donor's own offline chrome:
`aumlok · aumlok/history · aura(via)brain · council · events · kira · node · status · bind/genesis · bind/status · settings/openrouter`. These organs are byte-present and mount, but their **live engine surface is unreachable** — the donor served them from `serve.ts` (`:7090`), which is not ported (WAVE-1: 10 of 11 engine surfaces have no counterpart; re-confirmed at `f613029`).
**Token-handoff-to-launcher gap (my R44 finding, STILL LIVE at f613029):** R44b correctly wired the supervisor→mind-door token (`organism-ctl.mjs:148` mints, `writeTokenFile` 0600, hands via env; `mind-door-7097.ts:30` adopts it, value never printed). **But `organism-ctl.mjs:173` starts Spatial with `{ PORT }` only** — the launcher proxy reads `AUKORA_DOOR_TOKEN` from env (`launch.mjs:39`) and gets nothing, so under `organism:up` the browser/gateway chat+propose write path is **present-but-unwired end-to-end**. It works only when the operator boots the mind door via `apps/supervisor` (which does hand the launcher its token, R44). Two lifecycle owners still compose rather than one wiring the whole path.

### 4 · GENUINELY MISSING (no file, no proven counterpart)
- The donor engine **doors as monorepo services** (chat/voice/aumlok-serve/graph/council/status) — 10 surfaces; only the mind door (`apps/seed`) and brain door (`apps/brain`) exist.
- Per **R45** (quarantined PR #72, NOT integrated): the mind organ's **plan-expectation executor** (donor `fable-arc3-auto.ts:661-681` — per-step `checkPlanExpectation` + hard `PLAN STOPPED`), **bounded traces**, and **all four governed bridges** (arcade-adapter SPECIFIED · KIRA-episodic MISSING · Fu-advisory SPECIFIED · proposer→`SupervisedGenerationEnvelope` MISSING). These remain blockers to a real proposer seat.

## Capabilities present in files but NOT represented in the canonical atlas
`docs/atlas/ATLAS.json` is issue-oriented (252 rows, base `b17a3f8`, Wave-2 era) and does not model the file-level embodiment seams. Not-yet-atlas'd:
1. **Launcher proxy coverage = 7 of 17 shell→core seams** — the 10 unserved seams (list above) are a concrete reachability deficit, not an issue.
2. **Token-handoff-to-launcher gap under `organism-ctl`** — R44 closed the door-token half; the launcher half is silent in the atlas.
3. **`map/layout.worker.js`** — a live Worker capability invisible to static-import reachability tooling (flagged so nobody prunes it as "unreachable").
4. **CONSOLE organ** (ours) — live/degraded/offline strip + turn-mode truth; a monorepo capability, not a donor issue.

## One-gateway / supervisor truth (re-checked)
Supervisor **21/21** (grew from my R44 17 via Sam 1 integration); protected pins verified; the gateway still refuses to front AUMLOK and serves declared routes only. `organism-ctl` (checkout-scoped: convex+door) and `apps/supervisor` (policy-scoped: mind+spatial+token+gateway) **compose**; the lifecycle-owner merge ruling (Wave 3) is still open — this is the root cause of finding 3's token gap.

## Disposition
Embodiment **phenotype continuity is strong** (byte-identical + adapted-with-proof, all organs reachable). **Live-wire continuity is partial**: 10 engine seams unreachable, and the write path is unwired end-to-end under the default supervised boot. The atlas should gain 4 file-level rows (above). No production change proposed this round.
