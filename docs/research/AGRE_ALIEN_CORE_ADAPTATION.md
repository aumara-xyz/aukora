# AGRE v2 → ALIEN CORE Adaptation Plan

**Date:** 2026-07-19 · **Truth-repaired:** R58 (Sam 4 lane)
**Status:** RESEARCH_CANDIDATE — no capability claims
**Falsification target:** B2-equivalent for game reasoning — the binding preregistration is
[`B2_GAME_PREREGISTRATION.md`](B2_GAME_PREREGISTRATION.md) (§3 below is the design sketch it grew from)

> **TRUTH REPAIR (R58).** The public Avengers audit
> ([issue #20](https://github.com/aumara-xyz/aukora/issues/20#issuecomment-5013983883)) falsified this
> document's original results section: the "189KB engine" that §10 listed was in fact **471 bytes of
> self-referential stubs** on `main` (a 44–54KB engine never existed on any branch), and **all five per-level
> results below are UNPROVEN** — no runnable code, no raw receipts, no replay instructions, no
> scorecards, on any branch. The only same-day executed evidence
> (`skunkworks/arc3-agre` @ `5b091bc`, `docs/AGRE_FINAL_REPORT_COMPLETE.md`) is about *different*,
> vision+LLM engines and states plainly: "Neither triggers WIN."
> The architecture mapping (§2), gate design (§3/§5), and gap list (§6) were audited as accurate honest
> self-assessment and are preserved. The claims were the rot; the design is the value.

---

## 1. What AGRE v2 Was Claimed To Be (claims now labeled)

The original text claimed a general reasoning engine that beats ARC-AGI-3 games — that claim is
retired as unsupported (see banner). What the design describes is an engine *intended* to attack
such games by:

1. Reading game source code (`.py` files packaged with the environment)
2. Extracting mechanics via AST + regex analysis
3. Building an internal GameModel (sprites, levels, walkability graphs, win conditions)
4. Computing optimal paths via BFS/A*
5. Executing with level-index win detection

**Original per-level results table — every row UNPROVEN (no code, no receipts, no replay, no scorecard):**

| Original claim | Label | Audit note |
|---|---|---|
| TU93 Level 1: 18 actions (3/3 consistent) | **UNPROVEN** | no artifact on any branch |
| TU93 Level 2: 10 actions, enemy timing (3/3) | **UNPROVEN** | no artifact on any branch |
| TU93 Level 3: 18 actions via exploration | **UNPROVEN** | appeared as prose ~55 min after a first report listing only L1+L2 |
| TU93 Level 4: 17 actions via BFS full-state hashing | **UNPROVEN** | same late-prose provenance as L3 |
| LS20 Level 1: 17 actions (puzzle mechanics) | **UNPROVEN** | contradicts the owner archive's 13-action record |

Note also that source-reading of shipped game `.py` files violates the blind norm and issue #102's own
"no source/game-specific solution path" requirement — a source-assisted run is not vision-only, is
not blind, and is never an official ARC-AGI-3 generalization result.
The fallback discovery/probing mode
and "zero training data" statements are design intent, not demonstrated properties.

---

## 2. The 5-Station Map: AGRE v2 → ALIEN CORE

```
ALIEN CORE                        AGRE v2 (today)                    Gap
─────────────────────────────────────────────────────────────────────────────────
① EVENT LOG                       Recording JSONL + execution logs   Need: structured
(append-only SQLite)                                                 event schema
                                                                     with receipts
② SLEEP CYCLE                     None — static code                 Need: episode
(periodic LoRA consolidation)                                        consolidation
                                                                     of strategies
③ CONSOLIDATION GATE              Manual review by Peter             Need: automated
(preregistered benchmarks)                                           B2 with kill
                                                                     conditions
④ SIGNED WEIGHTS                  Git commits                        Need: AUMLOK
(AUMLOK hybrid signature)                                            over strategy
                                                                     artifacts
⑤ LATENT ROUTER                   Hardcoded game-type                Need: GMM
(GMM index + confidence)             classifier                      confidence +
                                                                     fallback to
                                                                     text retrieval
```

---

## 3. The B2 for Game Reasoning (preregistered)

**The decisive question:** Does a LoRA-consolidated reasoning engine beat text-retrieval-only on novel games at the same scale?

### Benchmark: B2-Game

| Probe | What it measures | Kill condition |
|-------|-----------------|----------------|
| **B2a: Strategy transfer** | Engine trained on games A,B,C beats games D,E,F faster than retrieval-only | Retrieval matches within CI → demote parametric |
| **B2b: Archetype coverage** | Consolidated archetype library covers ≥80% of novel games without expansion | Coverage < 60% → text retrieval remains primary |
| **B2c: Poison canary** | Planted false strategies (e.g., "always go left first") are NOT recited on games where they fail | Distorted canary recited → consolidation rejected |
| **B2d: Degradation under erasure** | After removing N archetypes, graceful degradation (not catastrophic) | Binary failure → no resilience |

**The honest prediction:** At prototype scale (2 games, 5 levels), retrieval-only likely matches parametric memory. The justification for consolidation is **function, not storage** — the archetype library enables faster reasoning on novel games by recognizing patterns, not by storing solutions.

---

## 4. What Each Round Burns (Episode Structure)

> **Caption (R59):** the JSON examples in this section are **schema illustrations with hypothetical
> values**. The `tu93` / level-4 / 17-action / `"level_beaten": true` numbers reuse the §1 claims,
> which are UNPROVEN — no such episode was ever recorded. They show the intended field shapes only.

Each game-solving round produces an **episode** suitable for the event store:

```json
{
  "episode_id": "sha256-of-events",
  "timestamp": "2026-07-19T06:30:00Z",
  "game_id": "tu93",
  "level": 4,
  "events": [
    {"type": "source_analysis", "sprites": 43, "levels": 9, "wall_clock_ms": 210},
    {"type": "path_discovery", "method": "bfs_full_state", "actions": 17, "expanded_states": 2847},
    {"type": "execution", "actions_sent": 17, "level_beaten": true, "deaths": 0},
    {"type": "meta_learning", "pattern": "zigzag_desync_projectile", "confidence": 0.85}
  ],
  "strategy_artifact": {
    "game_archetype": "maze_navigation_with_projectile",
    "key_move": "zigzag_at_start_to_desync",
    "prerequisite": "predictable_projectile_path",
    "applicability": ["tu93_l4", "games_with_moving_hazards"]
  }
}
```

### Contradiction Edges (for Shear Engine)

When a strategy fails, that's a **contradiction edge**:

```json
{
  "type": "contradiction",
  "strategy": "optimal_path_without_enemy_awareness",
  "worked_on": ["tu93_l1", "tu93_l3"],
  "failed_on": ["tu93_l2", "tu93_l4"],
  "reason": "enemy/projectile_intersection",
  "resolution": "enemy_aware_bfs_required"
}
```

---

## 5. The Sleep Cycle for Game Reasoning

### What Gets Consolidated

Not the solutions — the **strategies**:

| Archetype | Compressed Form | What the LoRA learns |
|-----------|----------------|---------------------|
| Maze navigation | "6-pixel grid, 3-pixel lookahead" | Recognize grid-based movement games |
| Enemy timing | "retreat-let_pass-follow" | Sequence: retreat → wait → follow |
| Projectile desync | "zigzag_pattern(R,L,R,L)" | Disrupt timing with oscillation |
| Puzzle matching | "attribute_match: shape,color,rot" | Identify non-movement games |
| Level carryover | "position_carries_between_levels" | Plan ending positions |
| Step budgeting | "count_actions_not_pixels" | Optimize for action count, not distance |

### Cadence

Weekly at prototype volume (2-3 games/week). Not nightly — there's not enough signal.

### The Gate (both halves)

**Half 1 — Fidelity:**
- Paraphrase: Same strategy expressed different ways must produce same actions
- Coverage: Consolidated archetypes must cover held-out games
- Poison canary: "always brute force" strategy must NOT be recited
- Refusal: Below-confidence games must route to full BFS, not confabulate

**Half 2 — Amortized cost:**
- `(adapter_bits + pointer_bits + retrain_compute) / games_solved_over_lifetime`
- At prototype scale this is unfavorable. Stated honestly.

---

## 6. What's Missing (The Gaps)

### Gap 1: No Episodic Memory Format
**Today:** JSONL recordings with raw frames. Not structured events.
**Need:** Receipt-formatted events with `event_id = content_hash`, immutable append.

### Gap 2: No Self-Evaluation Loop
**Today:** I manually report results to Peter.
**Need:** Automated B2 probes after each episode. If B2a fails, flag for review.

### Gap 3: No Strategy Transfer
**Today:** Each game solved independently.
**Need:** Try archetype strategies from game A on game B before full analysis.

### Gap 4: No Falsification Protocol
**Today:** I report successes; failures are in the chat log.
**Need:** Preregistered kill conditions per archetype. "If this strategy fails on 3 consecutive games of type X, kill it."

### Gap 5: No Confidence Routing
**Today:** Hardcoded game-type routing.
**Need:** GMM-based confidence. "I'm 85% confident this is a maze → use BFS. Below 60% → use full discovery."

### Gap 6: No Signed Artifacts
**Today:** Git commits.
**Need:** AUMLOK signatures over strategy artifacts. Prove provenance of each archetype.

---

## 7. Opportunities

### Opportunity 1: The B2 Experiment Is Cheap
Run B2a right now: solve 5 games with retrieval-only (pure BFS, no archetypes) vs with archetype guidance (try known strategies first). Compare action counts. If archetypes win → consolidation justified. If tied → stay at Tier 0.

### Opportunity 2: Game Episodes Are Perfect Event Store Content
Each game level is a self-contained episode with clear outcomes. The event schema maps directly to the AUKORA Receipt→Capsule→Episode hierarchy.

### Opportunity 3: Nebius Shadow Cells for Parallel Game Solving
Run 24 game solvers in parallel on Nebius GPU VMs. Each cell produces receipts. The consolidation gate merges strategies that pass B2. R4 applies: sandboxed trainer with no store write authority.

### Opportunity 4: Contradiction Edges Are Training Signal
When a strategy fails, that's not noise — it's the most valuable signal. The shear engine can detect semantic discontinuities: "this strategy worked on 10 maze games but failed on this one. Why?"

### Opportunity 5: The Meta-Archetype Library Generalizes Beyond Games
The same architecture that learns "maze navigation" from TU93 could learn:
- "API integration patterns" from code tasks
- "debugging strategies" from error traces
- "conversation flow management" from chat tasks

The game domain is a **controlled environment** for testing the learning loop.

---

## 8. Integration Plan (Tiered)

### Phase A (Now — Local, Free)
1. **Event store v0:** Convert recording JSONL to structured events with content-addressed IDs
2. **Falsification protocol:** Write B2-Game spec with preregistered kill conditions
3. **Strategy transfer:** Try archetypes from TU93 on LS20 before full analysis
4. **Contradiction logging:** Log strategy failures as contradiction edges

### Phase B (After B2 Pass)
1. **LoRA consolidation:** Train rank-64 LoRA on Qwen3-0.6B with game strategy episodes
2. **Consolidation gate:** Automated B2a probes after each consolidation
3. **Confidence routing:** GMM-based game-type classification with fallback

### Phase C (Nebius — Gated)
1. **Shadow cells:** Parallel game solving on Nebius L40S instances
2. **Signed artifacts:** AUMLOK signatures over strategy artifacts
3. **Fleet scaling:** Multiple reasoning cells with UCAN delegation

### Phase D (Tinker — Optional)
1. **8B-class substrate:** If 0.6B is insufficient, scale to Tinker fine-tunes
2. **Inkling integration:** Vision analysis for games without source code

---

## 9. Honest Assessment (repaired)

### What's Proven
- Nothing in this document is proven. The three bullets originally listed here ("source-code-first
  reasoning beats heuristics", "BFS solves complex levels", "enemy timing transfers") all depended on
  the §1 results table, and every row of that table is UNPROVEN (see banner). Until a run exists with
  raw receipts, deterministic replay, and a platform scorecard, this section stays empty by design.

### What's Executed Evidence (different engines, preserved baseline)
- `skunkworks/arc3-agre` @ `5b091bc` holds real, runnable vision+LLM engines (`agre_v11.py`,
  `agre_v14.py`) whose own committed report states: "Neither triggers WIN." That is the current
  honest baseline for this research line — best TU93 attempt reaches the detected goal position
  without a WIN; best LS20 attempt gets within 19 cells.

### What's Unproven
- Every per-level result claimed for the "v2" engine (§1 table)
- Whether LoRA consolidation beats retrieval on game reasoning
- Whether archetypes generalize across different game types
- Whether the full 5-station loop works at any scale

### The Brutal Truth
Tier 0 (event store + falsification) survives every outcome. If B2 fails, we're left with a good event store and the falsification machine — which was worth building anyway. The alien brain is a bet, not a promise.

---

## 10. Files (original claim FALSIFIED)

The original section claimed five modules totaling 189KB. **FALSIFIED by the public audit:** what
actually landed on `main` were four self-referential placeholder stubs totaling 471 bytes
(`agre_v2.py` 123B · `agre_source_analyzer.py` 137B · `agre_planner.py` 103B · `agre_discovery.py`
108B — each a comment pointing at its own directory), `tu93_all_bfs.py` never existed anywhere, and
a 44–54KB engine never existed on any branch. The stubs were removed in R58; the directory now carries the
evidence law and the RESEARCH_CANDIDATE intake record for the real branch artifacts — see
[`docs/skunkworks/agre_v2/README.md`](../skunkworks/agre_v2/README.md).

---

*Method (design intent, not a demonstrated property): source code analysis → AST+regex extraction →
BFS pathfinding → execution with level-index win detection. The original footer's "results
preregistered in this document" was backwards — results were claimed here, not preregistered; the
actual preregistration is [`B2_GAME_PREREGISTRATION.md`](B2_GAME_PREREGISTRATION.md).*
