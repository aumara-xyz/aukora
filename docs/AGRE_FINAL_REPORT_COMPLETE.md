# AGRE (Aukora General Reasoning Engine) — Complete Report
## 15 Iterations, 10 Versions (v5-v15), 2 Games, ~$3.50 total spend

---

## TL;DR

After 15 iterations across 10 versions, **the best-performing engines are**:
- **TU93: AGRE v14** — Reaches the detected goal position at (-2, 0)
- **LS20: AGRE v11** — Gets within 19 cells of the goal

**Neither triggers WIN.** The engines demonstrate strong spatial reasoning, maze navigation, and autonomous operation (often $0 cost), but LS20's corridor-with-hidden-opening structure and TU93's 51-step hard limit prevent completion.

---

## Critical Bugs Found and Fixed

### Bug 1: ActionInput API (arcengine 0.9.3)
- `ActionInput(action=GameAction.RESET)` → `ActionInput(id=GameAction.RESET)`
- **Impact**: Restored movement from 0% to 80-100%

### Bug 2: AT_GOAL Detection
- `abs(dx) <= 1` → `dx == 0 and dy == 0`
- **Impact**: Prevented infinite oscillation 1 cell from goal

### Bug 3: Global Blocked Set
- `blocked = set()` → `blocked_at[(x,y)] = set()`
- **Impact**: +66pp movement on TU93, eliminated 22-step stuck loops

### Bug 4: Goal Color Detection
- Frequency heuristic → Semantic RGB analysis
- **Impact**: Correct goal identification across all games

---

## Version Progression

| Ver | LS20 Dist | TU93 Dist | Cost | Key Innovation | Verdict |
|-----|-----------|-----------|------|----------------|---------|
| v5 | oscillated | 3 | $0.03 | Baseline | OK |
| v6 | 2 | GAME_OVER | - | Spatial map (broken) | Meh |
| v7 | 1 (osc) | 28% mov | $0.13 | Dead reckoning + 2 bugs | Bad |
| **v8** | 100% mov | **94% mov** | **$0.03** | **Bug fixes** | **Good** |
| v9 | 35 | 58% mov | $0.08 | Semantic colors | OK |
| v10 | 56 | 28% mov | $0.13 | Visit counts | Bad |
| **v11** | **19** | **2** | **$0.00** | **Goal bias +200/-100** | **BEST LS20** |
| v12 | 23 | 3 | $0.03 | Wall-following | Backfire |
| **v14** | 36 | **AT GOAL** | **$0.01** | **A* + loop escape + wall retry** | **BEST TU93** |
| v15 | 30 | 4 | $0.04 | Hybrid | Regression |

---

## Architecture of Best Engines

### AGRE v11 (Best for LS20)
```
Semantic Color Detection
Spatial Memory (dead reckoning + wall learning)
Decision Hierarchy:
  1. Goal Sprint (distance <= 3)
  2. 2-Cell Loop Escape (A→B→A→B detection)
  3. Goal-Biased Exploration (+200 toward, -100 away)
  4. Inkling LLM Fallback
Cost: ~$0.00 per run (fully autonomous)
```

### AGRE v14 (Best for TU93)
```
Semantic Color Detection
Spatial Memory (dead reckoning + wall learning)
Decision Hierarchy:
  1. A* Path to Goal (Manhattan heuristic + goal bonus)
  2. Loop Escape (stuck >6 steps → force perpendicular)
  3. A* Explore (unknown cells toward goal)
  4. Wall Retry (walls expensive, not impassable)
  5. Inkling LLM Fallback
Cost: ~$0.01 per run (6 LLM calls)
```

---

## What Works

1. **Semantic color detection** — RGB analysis correctly IDs player/goal/wall/path
2. **Dead reckoning position tracking** — accurate (x,y) via move counting
3. **Position-dependent blocked set** — learns walls without cross-position pollution
4. **Goal-biased exploration (+200/-100)** — keeps agent oriented toward goal
5. **2-cell loop detector** — breaks oscillation in 3 cycles
6. **Loop escape with wall retry** — re-checks "walls" that might be passable
7. **Spatial memory** — tracks visited cells, walls, goal position

## What Doesn't Work

1. **Global A* pathfinding** — wanders toward "nearest unknown" (often north)
2. **Wall-following** — traces walls away from goal, consumes steps
3. **Sprint mode** — causes oscillation when goal direction returns to recent cell
4. **K3 fallback** — expensive ($0.008/call), rarely helps
5. **Complex hybrids** — more features = more failure modes

---

## Why Neither Game Was Won

### LS20 Level 1
- Agent stays on horizontal corridor at y=0
- Goal is south at y=16, opening is somewhere along corridor
- Agent needs to **systematically try DOWN at each corridor position**
- Current corridor probe tries perpendicular but doesn't prioritize goal direction
- **Fix needed**: Corridor scan that always tries goal-direction first

### TU93 Level 1
- Game hard-limits at S51 regardless of step budget
- Agent reaches goal position at S25 (v14) but doesn't trigger WIN
- Goal detection may be slightly off, or win requires additional action
- **Fix needed**: Better goal detection or post-position win trigger

---

## File Inventory

| File | Description |
|------|-------------|
| `agre_v11.py` | Best LS20 engine |
| `agre_v14.py` | Best TU93 engine |
| `agre_v15.py` | Final hybrid attempt |
| `arc_agi.py` | ARC wrapper (fixed for arcengine 0.9.3) |
| `AGRE_FINAL_REPORT_COMPLETE.md` | This report |

---

## Recommendations for Next Session

1. **Corridor scanner for LS20** — try goal-direction (DOWN) systematically at each position
2. **Win trigger detection** — investigate what action triggers WIN on TU93
3. **Cross-session memory** — save/load spatial maps between runs
4. **ULHF integration** — scored hypotheses with kill-tests
5. **4D Gaussian memory** — Vyomakira capsule integration
6. **Swarm coordination** — multiple K3 nodes with different strategies

---

*Report generated: 2026-07-19 after 15 iterative development cycles.*
*Total cost across all experiments: ~$3.50*
*Best single-run cost: $0.00 (v11 autonomous mode)*
