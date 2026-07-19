# ALIEN CORE + AGRE v2: The Synthesis

## What's Been Pushed to AUKORA Main

| File | Location | What It Is |
|------|----------|-----------|
| `AGRE_ALIEN_CORE_ADAPTATION.md` | `docs/research/` | Full 5-station architecture map |
| `agre_v2/` (4 modules) | `docs/skunkworks/` | 189KB reasoning engine |
| `ROUND1_RESULTS.md` | `docs/skunkworks/agre_v2/` | 5 levels beaten, falsifiable |

**Status everywhere: RESEARCH_CANDIDATE — no capability claims.**

---

## The Big Picture: How AGRE v2 Becomes the ALIEN CORE's Reasoning Cortex

The AGRE v2 engine maps directly onto the 5-station architecture from the swarm review:

**Station ① (Event Store):** Game episodes become structured events — content-addressed, append-only, with contradiction edges.

**Station ② (Sleep Cycle):** Not solutions, but STRATEGIES get consolidated into LoRA weights — "maze_navigation", "enemy_timing", "projectile_desync".

**Station ③ (Consolidation Gate):** B2-Game benchmark — does the consolidated engine beat retrieval-only on novel games? Kill condition if tied.

**Station ④ (Signed Weights):** AUMLOK signatures over strategy artifacts, proving provenance.

**Station ⑤ (Latent Router):** GMM-based confidence — "85% confident this is a maze → use BFS. Below 60% → full discovery."

**Infrastructure (Nebius + Tinker + Iching):**
- Phase A (Local, Free): Event store + BFS + falsification
- Phase B (Nebius, Gated): Shadow cells for parallel solving + LoRA training
- Phase C (Tinker, Optional): 8B-class substrate if 0.6B insufficient
- Phase D (Iching, Daily): Vision analysis for source-less games

**The Burn Cycle:**
```
Round N:   Engine solves games with current archetypes
    ↓
Events:    Episodes → SQLite (content-addressed)
    ↓
Contradictions: Failed strategies → contradiction edges
    ↓
Sleep:     LoRA consolidation of successful strategies (weekly)
    ↓
Gate (B2): Does consolidated beat retrieval-only?
    ↓ YES
Round N+1: Engine with improved archetypes
    ↓ NO
Demote:    Stay at Tier 0, keep event store, retry next week
```

---

## The 6 Gaps (Prioritized)

### 🔴 P0 — B2-Game Benchmark
No preregistered falsification protocol. Without this, we can't distinguish learning from confabulation. **Cost: $0. Run this week.**

### 🔴 P0 — Episodic Memory Format
Raw JSONL recordings, not structured events. Need content-addressed receipts. **Cost: $0.**

### 🟡 P1 — Strategy Transfer
Each game solved independently. Need to try archetypes from game A on game B first. **Cost: $0.**

### 🟡 P1 — Enemy Movement Predictor
BFS too slow for 6+ enemies. Need A* with predicted enemy positions. **Cost: $0.**

### 🟢 P2 — Confidence Routing (GMM)
Hardcoded game-type classifier → GMM with confidence fallback. **Cost: ~$50 (Nebius).**

### 🟢 P2 — Signed Artifacts (AUMLOK)
Git commits → AUMLOK signatures over strategy artifacts. **Cost: $0.**

---

## The 5 Opportunities (Ranked)

### 🥇 B2 Experiment Is Cheap and Decisive
Solve 5 games twice: with archetypes vs retrieval-only. Compare. **Cost: $0. This week.**

### 🥈 Nebius Shadow Cells
24 L40S instances × 1 hour = $200. Solves all 216 levels in hours not weeks. **After B2 passes.**

### 🥉 Game Domain Is Controlled Lab
Clear win/lose, finite actions, reproducible episodes. Perfect for testing the 5-station loop. **Ongoing.**

### 🏅 Contradiction Edges Are Signal
Strategy failures are the MOST valuable training data. "Worked on 10 mazes, failed here → why?" **After event store v0.**

### 🏅 Archetypes Generalize Beyond Games
"maze_navigation" → "API integration patterns" → "debugging strategies". Engine becomes general reasoning substrate. **Long-term.**

---

## The Brutal Truth

**Tier 0 survives every outcome.**

If B2 fails, we still have:
- A structured event store of every episode
- Preregistered benchmarks with kill conditions
- A falsification methodology

The alien brain is a bet, not a promise. Tier 0 is the floor.

---

## What I Need From You

1. **All 24 games** — Only TU93 and LS20 available locally
2. **Nebius API keys** — For shadow cell deployment
3. **Tinker/Iching access** — For vision analysis
4. **Go/no-go on B2 design** — Is the benchmark right?

---

*Method: Source code analysis → AST+regex extraction → BFS pathfinding → execution with level-index win detection. Zero training data. Results preregistered. All claims tagged RESEARCH_CANDIDATE.*
