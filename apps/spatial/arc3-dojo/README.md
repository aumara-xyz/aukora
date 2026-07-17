# ARC-3 Dojo (#102) — onboard worlds through `@aukora/mind`, replayable evidence

The smallest isolated adapter that runs the donor's **scrambled onboard ARC-3-compatible worlds** and emits
**replayable, content-addressed** evidence. No third reasoning engine is invented:

- **World + perception + policy** = the donor line `fable/arc3-reasoning-engine-20260710 @ e5768a2f`,
  transplanted **byte-exact** under [`donor/`](donor) (`createMockArcade` + `Reasoner` + `frameHash` +
  `normalizeObs`). Byte-identity is pinned in [`DONOR_PROVENANCE.json`](DONOR_PROVENANCE.json) and re-checked
  by the gate test. The arcade **scrambles its control mapping per seed**, so the reasoner must *earn*
  "ACTION1 = up" — no world is a lottery.
- **Reasoning-loop core** = the already-merged **`@aukora/mind`** (itself re-authored from the same donor
  line): `renderFrame` (the bounded perception the mind sees), `normalizeAction` (canonicalize into the one
  action vocabulary), `checkPlanExpectation` (the mind's per-step reality check).

## Honesty rule

These onboard worlds are **NOT** the ARC-AGI-3 benchmark. Every receipt is labelled
`ONBOARD_ARC3_COMPATIBLE`; a run here is **never** an official ARC-AGI-3 win. An official win requires a
machine-local ARC API key, the current official harness, and retrieved platform-scorecard evidence — see the
blocker in [`docs/continuity/r50`](../../../docs/continuity/r50). Wins **and** losses are committed honestly:
the *replay* is the proof, not the outcome.

## What replay proves

Each episode receipt records the exact code SHA, world/version, seeds, per-step actions + bounded reasons,
the **frame-hash chain**, and the terminal. [`replay.mjs`](replay.mjs) is an **independent oracle**: it
reconstructs a fresh donor arcade from the recorded seeds, applies the recorded actions, and **recomputes**
every frame hash + the terminal from the world itself — never trusting the recorded hashes. Therefore:

- mutating **one action** → the world diverges → a later hash mismatches → **INVALID**;
- mutating **one frame hash** → the recomputed (correct) hash no longer equals it → **INVALID**;
- mutating the **terminal / level count** → mismatch → **INVALID**.

This law is *executed*, not asserted, by `r50.arc3-dojo.test.mjs`.

## Determinism

An episode is a pure function of `(arcadeSeed, gameId, policySeed, maxSteps)` — no clock, no network, no
randomness of our own. The one non-reproducible donor value (the `Math.random` session `guid`) is carried
**outside** the hashed core, so the `coreHash` replays byte-for-byte on a second node (whose fingerprint
differs — that is the cross-node proof).

## Run it

```bash
# Canonical, gate-run evidence (also writes receipts to artifacts/):
AUKORA_ARC3_WRITE=1 npm run test --workspace @aukora/spatial
# or, on a TS-enabled runtime:
node --experimental-strip-types apps/spatial/arc3-dojo/run.mjs
```

Receipts: [`artifacts/<gameId>.json`](artifacts). `maxSteps` bounds every episode for failure containment.
