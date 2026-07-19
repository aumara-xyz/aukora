# AGRE v2 — Round 1 Results (truth-repaired R58)

**Status: RESEARCH_CANDIDATE — no capability claims.**

> **TRUTH REPAIR (R58).** This file originally carried a "Beaten" table asserting five per-level
> results. The public Avengers audit
> ([issue #20](https://github.com/aumara-xyz/aukora/issues/20#issuecomment-5013983883)) found **no
> runnable code, no raw receipts, no replay instructions, and no platform scorecards for any of
> them, on any branch** — and the engine the table implied (a "189KB" source-first v2) never
> existed anywhere (the directory held 471 bytes of self-referential stubs). Every original claim
> is preserved below with its honest label, per this directory's evidence law (see `README.md`).

## Original claims — all UNPROVEN

| Game | Level | Claimed actions | Claimed method | Label |
|------|-------|-----------------|----------------|-------|
| TU93 | L1 | 18 | BFS optimal | **UNPROVEN** — no artifact, no receipt |
| TU93 | L2 | 10 | Enemy timing (zigzag) | **UNPROVEN** — no artifact, no receipt |
| TU93 | L3 | 18 | BFS exploration | **UNPROVEN** — surfaced as prose ~55 min after a first report listing only L1+L2 |
| TU93 | L4 | 17 | BFS full state hashing | **UNPROVEN** — same late-prose provenance |
| LS20 | L1 | 17 | Puzzle mechanics | **UNPROVEN** — contradicts the owner archive's 13-action record |

## The executed baseline (different engines, preserved verbatim)

The only same-day *executed* evidence lives on public branch `skunkworks/arc3-agre` @ `5b091bc`
(vision+LLM engines `agre_v11.py` / `agre_v14.py`, ~$3.50 historical spend, 15 iterations). Its own
committed report (`docs/AGRE_FINAL_REPORT_COMPLETE.md`) states: **"Neither triggers WIN."**
Best TU93 attempt (v14) reaches the detected goal position without a WIN trigger; best LS20 attempt
(v11) gets within 19 cells of the goal. That is the honest baseline this research line starts from.

## Original "meta-awareness" notes — unverified observations

The original file listed five gameplay observations (position carry-over between levels, projectile
vs enemy physics rates, zigzag desync, action-before-rotation validation, LS20 being a puzzle rather
than a movement game). They are retained here as **unverified prose observations** — possibly useful
hypotheses for the preregistered B2-Game run, evidence for nothing.

## What would change these labels

Exactly what [`docs/research/B2_GAME_PREREGISTRATION.md`](../../research/B2_GAME_PREREGISTRATION.md)
requires: raw receipts, deterministic replay from committed code and fixed seeds, and a platform
scorecard, produced under the blind-run law. Until then, the labels above stand.
