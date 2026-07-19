# AGRE v2 — Round 1 Results

## Beaten

| Game | Level | Actions | Method |
|------|-------|---------|--------|
| TU93 | L1 | 18 | BFS optimal |
| TU93 | L2 | 10 | Enemy timing (zigzag) |
| TU93 | L3 | 18 | BFS exploration |
| TU93 | L4 | 17 | BFS full state hashing |
| LS20 | L1 | 17 | Puzzle mechanics |

## Architecture

Source Code → AST+Regex → GameModel → BFS → Executor

## Meta-Awareness Learned

1. Player position CARRIES OVER between levels
2. Projectile physics ≠ enemy physics (1px/step vs 6px/action)
3. Zigzag pattern desynchronizes from moving hazards
4. Actions validated BEFORE rotation change
5. LS20 is puzzle, not movement (1px steps, attribute matching)

## Status: RESEARCH_CANDIDATE — no capability claims
