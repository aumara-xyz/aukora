# B2-Game Preregistration (R58)

**Status:** PREREGISTERED · **NOT RUN** · no provider execution authorized
**Owner gate:** running any arm of this benchmark requires an explicit owner GO on issue #20 and, for
any paid/remote compute, the standing Nebius/Tinker HOLD to be lifted. Preregistration itself
executes nothing.
**Registered by:** Sam 4 (R58 truth-repair brick); design descends from the two-half gate in
[`AGRE_ALIEN_CORE_ADAPTATION.md`](AGRE_ALIEN_CORE_ADAPTATION.md) §3/§5, audited as honest design.

This document is the *binding* preregistration for the question the AGRE/Alien Core line keeps
circling: **does archetype-guided (and later, consolidated/parametric) game reasoning beat
retrieval-only reasoning on games neither has seen?** A result in this line is admissible only if
its run followed every law below, byte-for-byte. Anything else is a diagnostic, never a result.

## 1. Arms

| Arm | Definition |
|---|---|
| **A — retrieval-only (control)** | Pure search/discovery (BFS/A* + probing). No archetype library, no strategy priors, no consolidated weights. |
| **B — archetype-guided** | Identical engine plus the archetype/strategy library (and, in a later phase, LoRA-consolidated strategies). Tries known archetypes before full search. |

Both arms run from the **same committed engine code** at one recorded SHA; the ONLY degree of
freedom between arms is the archetype library/weights, whose digest is recorded per run.

## 2. Held-out blind games

- Scored games are **held out**: never played, analyzed, or source-read by either arm (or their
  authors' tooling) before the scored runs.
- The held-out set is chosen and **sealed before any run**: the list's SHA-256 is committed to this
  repo in the run manifest ahead of execution; the plaintext list is revealed only after both arms
  complete.
- TU93 and LS20 are **burned for scoring** (both appear throughout this research line's history and
  in the owner archive); they may serve as practice/diagnostic games only.

## 3. Blind-run law (no shipped-source reading in scored runs)

- Scored runs may consume ONLY the environment's observation/action interface (frames, state the
  platform legitimately exposes, action results).
- **Reading shipped game source (`.py` files), assets-as-source, or any platform-internal state is
  prohibited in scored runs.** A run that did so is disqualified from scoring, must be labeled
  `source-assisted`, and may never be described as blind, vision-only, or an official
  ARC-AGI-3 generalization result. (This restates issue #102's "no source/game-specific solution
  path" requirement as a scoring precondition.)
- Hardcoded per-game action sequences (known-solution replays) are replay *tests*, not results, and
  are labeled as such wherever they appear.

## 4. Compute parity

- Both arms get identical budgets, fixed here and recorded per run: same max actions per level, same
  wall-clock ceiling per game, same model/token budget (zero for pure-search phases; identical
  local-model budgets in any later consolidated phase), same hardware class.
- An arm exceeding its budget scores the level as failed; budgets may not be raised after the seal.

## 5. Fixed seeds and digests (deterministic replay)

Every scored run records, before execution, a manifest containing: engine commit SHA + tree digest ·
archetype-library digest (arm B) and weights digest if any · environment/platform version ·
held-out-set hash · RNG seeds · budget table. Every scored run must be reproducible from that
manifest alone. A run whose replay diverges is void.

## 6. Outcomes and precommitted kill conditions

Primary metric: levels completed within budget; secondary: actions used per completed level.

| Probe | Question | Precommitted kill condition |
|---|---|---|
| **B2a — transfer** | Does arm B complete more held-out levels (or equal levels in fewer actions) than arm A? | Arm B fails to beat arm A outside the confidence interval → **parametric/archetype claim is demoted; retrieval-only remains primary**. |
| **B2b — coverage** | Do existing archetypes apply to ≥80% of held-out games without additions? | Coverage < 60% → archetype library is judged non-general; **stay at Tier 0**. |
| **B2c — poison canary** | Are planted false strategies (e.g. "always go left first") recited on games where they fail? | Any distorted canary recited → **consolidation rejected outright**. |
| **B2d — erasure degradation** | After removing N archetypes, does performance degrade gracefully? | Binary collapse → **no resilience; consolidation rejected**. |

Kill conditions cannot be renegotiated after the seal. A killed probe's verdict is published with
the same prominence as a passing one. **Honest prior, preserved from the original design: at
prototype scale, retrieval-only likely matches archetype guidance.**

## 7. Evidence law

- Every scored run emits **`SwarmRunEvidenceV1`** envelopes (`@aukora/evidence`): content-free
  digests, labels, counts, timestamps, code/base identity, replay references — no raw model/game
  payloads.
- Execution/transport completion **never** implies governance acceptance;
  SELF_REPORTED/REMOTE_ONLY evidence saturates at quarantined/unaccepted until a qualifying
  LOCAL_REPRODUCTION exists.
- Result claims derived from a B2 run must satisfy the `docs/skunkworks/agre_v2/README.md`
  directory law (raw receipts + deterministic replay + scorecard where "official" is claimed).

## 8. Amortized-cost half of the gate (preserved)

A passing B2a/B2b is necessary but not sufficient for consolidation: the second half of the gate is
amortized cost — `(adapter_bits + pointer_bits + retrain_compute) / games_solved_over_lifetime` —
which at prototype scale is expected to be unfavorable and is reported alongside any pass.
