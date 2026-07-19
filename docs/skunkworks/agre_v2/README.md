# docs/skunkworks/agre_v2 — evidence law + intake record

## Directory law (R58): no replay, no solved claim

Nothing under this directory may assert a solved level, a beaten game, a win, or an official
ARC-AGI result unless the assertion ships with **all three** of:

1. **raw receipts** — the actual run logs/events, content-addressed;
2. **deterministic replay** — committed runnable code plus fixed seeds/digests that reproduce the
   run from scratch;
3. **a platform scorecard** — for anything described as "official", the platform's own scoring
   artifact with session identity.

Claims without all three carry an UNPROVEN label at the claim site. Falsified claims keep a
FALSIFIED label rather than being silently deleted — this directory preserves its mistakes as
evidence. Source-assisted runs (reading shipped game `.py` files) must be labeled as such and may
never be described as vision-only, blind, or official-generalization results. The `verify:no-overclaim`
gate carries ARC-specific patterns enforcing a slice of this law on every PR diff.

## What happened here (R58 truth repair)

Four self-referential placeholder stubs, publicly claimed as a "189KB reasoning engine", were
removed in R58 after the Avengers audit
([issue #20](https://github.com/aumara-xyz/aukora/issues/20#issuecomment-5013983883)) falsified the
claim. The removed stubs, for the record (base `feb11bf`, 471 bytes total):

| Removed stub | Size | Blob |
|---|---|---|
| `agre_v2.py` | 123 B | `94b1d667a51d7579a0ad22dccc14ef9d8329a02c` |
| `agre_source_analyzer.py` | 137 B | `ad38ab07b8822fae67541f3f9c33cadf8e9d97f7` |
| `agre_planner.py` | 103 B | `901011d11a3f9c5760b92bbd999190b8ad975ce8` |
| `agre_discovery.py` | 108 B | `6041ec4665f036b675a075fb7303d5bb79c435f0` |

`tu93_all_bfs.py`, also claimed, never existed on any branch. No 44–54KB engine exists on any
branch.

## RESEARCH_CANDIDATE intake — the real artifacts (not merged, classified)

The genuine executed work of this research line lives on public branch **`skunkworks/arc3-agre`**
(head `5b091bc`, 2 commits ahead of `0ceb517`). Classification per the R58 directive:
**RESEARCH_CANDIDATE** — inspected and recorded, not merged; presence of a branch is not a result.

| Branch artifact | Size | Blob | What it is |
|---|---|---|---|
| `engines/agre_v11.py` | 17,372 B | `ed4cfb415e49582806ae57cdf9893362c3d2c983` | vision+LLM engine — best LS20 attempt (within 19 cells; no WIN) |
| `engines/agre_v14.py` | 18,327 B | `6d597add0bd744b2843410331fd6dedf763b67ad` | vision+LLM engine — best TU93 attempt (reaches detected goal; no WIN) |
| `engines/arc_agi.py` | 4,158 B | `7b81a83f41aefa1dc667eb90bd5e1555b5a5954d` | local wrapper fixed for arcengine 0.9.3 |
| `docs/AGRE_FINAL_REPORT_COMPLETE.md` | 5,344 B | `0f13fb683113481b0c0430ad8a40d95d3b9f9ce2` | the honest baseline report — 15 iterations, v5–v15, ~$3.50 historical spend |

**Preserved baseline statement from that report: "Neither triggers WIN."** These engines are
vision+LLM based — they are *not* the source-first "v2" the falsified claims described.

## Forward path

Any future scored run in this line is governed by
[`docs/research/B2_GAME_PREREGISTRATION.md`](../../research/B2_GAME_PREREGISTRATION.md)
(preregistered arms, blind held-out games, compute parity, fixed digests, kill conditions) and must
emit `SwarmRunEvidenceV1` envelopes (`@aukora/evidence`), where transport completion never implies
governance acceptance and SELF_REPORTED/REMOTE_ONLY evidence saturates at quarantined until a
qualifying LOCAL_REPRODUCTION exists. No provider execution is authorized as of R58; Nebius/Tinker
remain HOLD.
