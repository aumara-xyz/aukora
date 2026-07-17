# SAM 4 · R50 #102 — ARC-3 Dojo (onboard worlds through `@aukora/mind`, replayable evidence)

**Lane:** Sam 4 · **Issue:** #23 / #102 · **Base:** canonical `main@4fc6e09c3ce9f9d5c5480c5edbcc49d26a47b70c`
· **Claims tier:** `ONBOARD_ARC3_COMPATIBLE` (NOT an official ARC-AGI-3 result).

## What was built

The smallest isolated adapter (`apps/spatial/arc3-dojo/`) that runs the donor's scrambled onboard
ARC-3-compatible worlds and emits replayable, content-addressed evidence — **without inventing a third
reasoning engine**:

- **Donor line** `fable/arc3-reasoning-engine-20260710 @ e5768a2f`, transplanted **byte-exact** under
  `arc3-dojo/donor/` (`engine.js` blob `7bf1446…`, `mock-arcade.js` blob `a609716…` — git blob shas equal the
  donor's; pinned + re-checked in `DONOR_PROVENANCE.json`). Provides the worlds (`createMockArcade`), the
  deterministic model-free policy (`Reasoner`), and perception (`frameHash`/`normalizeObs`).
- **`@aukora/mind`** (already merged, re-authored from the same donor line) drives the reasoning loop:
  `renderFrame` (bounded perception), `normalizeAction` (canonical action vocabulary), `checkPlanExpectation`
  (per-step reality check).

## Evidence — honest wins AND losses (seeds: arcadeSeed 42, policySeed 7, maxSteps 400)

| world | result | terminal | levels | steps | coreHash |
|---|---|---|---|---|---|
| mk-courier | WIN | WIN | 2/2 | 72 | 9dabeb06ac4455d1… |
| mk-ember | WIN | WIN | 2/2 | 34 | 1e614cdaf3555ca3… |
| mk-forge | WIN | WIN | 2/2 | 61 | ad5862dbd4dc8030… |
| **mk-glyphs** | **loss** | NOT_FINISHED | 1/2 | 400 (budget) | 5216981991afcf65… |
| mk-maze | WIN | WIN | 3/3 | 83 | c11db54fbd52583b… |
| mk-mirror | WIN | WIN | 2/2 | 4 | 2472181dd9dcfb37… |
| mk-oddball | WIN | WIN | 2/2 | 2 | 320427e37919c109… |
| mk-rail | WIN | WIN | 2/2 | 112 | cd3e710771ddcfe9… |

**7 wins / 1 loss.** The reasoner solves 7 scrambled onboard worlds (learning the shuffled control map by
calibration) and honestly **fails mk-glyphs** — it exhausts the 400-move budget at level 1/2. The loss is
committed, not hidden. Receipts: `apps/spatial/arc3-dojo/artifacts/<world>.json`.

## What replay proves (falsifiable, executed not asserted)

`replay.mjs` is an **independent oracle** — it reconstructs a fresh donor arcade from the recorded seeds,
applies the recorded actions, and **recomputes** every frame hash + terminal from the world itself. In
`r50.arc3-dojo.test.mjs`:

- every episode replays clean;
- **mutating one action** → world diverges → later hash mismatch → INVALID;
- **mutating one frame hash** → recomputed correct hash ≠ recorded → INVALID;
- **mutating the terminal / level count** → mismatch → INVALID.

Determinism: same seeds → byte-identical `coreHash` (proven across repeated runs). The `Math.random` session
`guid` is the only non-reproducible donor value and is carried **outside** the hashed core, so the coreHash
replays on a second node (whose fingerprint differs). Byte-provenance of the two donor files is tamper-checked
against sha256 pins every gate run.

## Official ARC-AGI-3 run — BLOCKED (exact blocker)

Per the directive, a bounded blind official run may be attempted **only if** a machine-local ARC API key and
the current official harness are available. On this node they are **not**:

1. No `ARC_API_KEY` in the environment; no `~/.aukora-symbiote/arc3/api-key.txt` (the donor
   `scripts/fable-arc3-live.ts` key path) — absent.
2. No current official ARC-AGI-3 harness installed locally.
3. A live win additionally requires **retrieved platform-scorecard evidence** — unobtainable without (1)+(2).
4. Lane fence: no network/paid egress from this read-only lane regardless.

No onboard result is ever reported as an official ARC-AGI-3 win. If the owner provisions a key + harness on a
node, the donor `fable-arc3-live.ts` path opens a real scorecard; that is an owner/Peter action, not this lane's.

## Nebius evolution-cell packaging — SKETCH ONLY (no deployment, no training claimed)

From the **proven runner** (`runEpisode` + `replayEpisode`), a Nebius cell would package as:

- **Copy-on-write & killable:** a container pinned to this canonical commit + the donor blob shas above; the
  dojo runner + a bounded episode budget (`maxSteps`, wall/step deadlines) as the only entrypoint. `SIGKILL`
  at the deadline leaves nothing behind (COW layer discarded).
- **Bounded:** fixed roster × seed grid, per-episode step ceiling, total-episode ceiling; a run that exceeds
  any bound is terminated and reported as `exhaustedBudget`, never retried silently.
- **No authority material:** the cell receives **no** owner keyphrase/AUMLOK signing material, no GitHub write
  credentials, no managed-Convex/production secrets, and cannot merge or mutate the canonical repo.
- **Outputs = lessons/proposals only:** content-addressed episode receipts (the coreHash bundles here) and
  distilled `EpisodicNote`-shaped lessons. Promotion crosses the normal governed gate + fresh owner AUMLOK on
  Peter's machine — the cell never promotes itself.
- **Model swap:** the deterministic `Reasoner` policy is the model-free baseline; a Nebius-served model would
  slot in behind the same `@aukora/mind` loop as a `MindSocket`, under the same budget/receipt discipline.

This is a packaging **sketch**, not a deployment. Nothing here is deployed, trained, armed, or spent. Tinker
remains a separate future training contract — no real transcript exists, so nothing is claimed.
