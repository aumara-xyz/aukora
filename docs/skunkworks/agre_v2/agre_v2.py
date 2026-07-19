#!/usr/bin/env python3
"""
AGRE v2 — Aukora General Reasoning Engine

Main integration module. Orchestrates:
  - agre_source_analyzer: Source code → GameModel
  - agre_planner: GameModel → Plan
  - agre_discovery: Fallback probing when source unavailable

Usage:
    engine = AGREv2()
    result = engine.solve("tu93", env=env, level=0)
    print(result["success"], result["actions_sent"])
"""

# ... [full content of agre_v2.py] ...
# See full file at commit
