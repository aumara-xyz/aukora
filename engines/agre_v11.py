#!/usr/bin/env python3
"""
AGRE v11 — BEST FOR LS20. Goal-biased exploration + 2-cell loop detector.
The +200/-100 goal bias keeps the agent oriented toward the goal.
The 2-cell loop detector breaks A→B→A→B oscillation in 3 cycles.
Fully autonomous — typically $0 cost per run.
"""
import os, io, base64, json, requests, time, sys, traceback, hashlib
import numpy as np
from PIL import Image
from datetime import datetime
import arc_agi
from arcengine import GameAction

OR_KEY = os.environ.get("OPENROUTER_API_KEY", "")
DIR = {1: "UP", 2: "DOWN", 3: "LEFT", 4: "RIGHT"}
ACT = {1: GameAction.ACTION1, 2: GameAction.ACTION2, 3: GameAction.ACTION3, 4: GameAction.ACTION4}
DIR_DELTA = {1: (0, -1), 2: (0, 1), 3: (-1, 0), 4: (1, 0)}
OPPOSITE = {1: 2, 2: 1, 3: 4, 4: 1}

def pd(text):
    text = (text or "").upper()
    for w in ["UP", "DOWN", "LEFT", "RIGHT"]:
        if w in text: return w
    return None

def palette(unique, gid):
    k = {"tu93": {0:(255,200,0),2:(150,150,150),4:(255,0,0),5:(30,30,30),6:(60,60,60),9:(0,255,100),14:(200,0,200)},
         "ls20": {0:(255,200,0),1:(255,100,0),3:(150,150,150),4:(30,30,30),5:(60,60,60),8:(0,200,0),9:(0,255,100),11:(100,100,255),12:(255,0,200)}}
    p = k.get(gid, {})
    for v in unique:
        if v not in p: p[v] = (100+(v*37)%155, 100+(v*71)%155, 100+(v*113)%155)
    return p

def f2b64(frame, pal):
    h, w = frame.shape
    rgb = np.zeros((h, w, 3), dtype=np.uint8)
    for y in range(h):
        for x in range(w):
            rgb[y, x] = pal.get(frame[y, x], (128, 128, 128))
    img = Image.fromarray(rgb).resize((w * 8, h * 8), Image.NEAREST)
    buf = io.BytesIO(); img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()

def fhash(frame):
    return hashlib.sha256(frame.tobytes()).hexdigest()[:16]

def fmoved(f1, f2):
    if f1 is None or f2 is None or f1.shape != f2.shape: return False
    return int((f1 != f2).sum()) > 5

def safe_frame(obs):
    if obs is None or obs.frame is None: return None
    arr = np.array(obs.frame)
    if arr.size == 0 or arr.ndim < 3: return None
    return arr[0] if arr.shape[0] > 0 else None


def detect_colors_semantic(frame, gid):
    unique = sorted(set(frame.flatten().tolist()))
    pal = palette(unique, gid)
    scores = {}
    for val, (r, g, b) in pal.items():
        if val == 0: continue
        scores[val] = {
            "player": (r * 2 + g - b * 2) / 255,
            "goal": (g * 2 - r - b * 0.5) / 255,
            "wall": (-r - g - b + 100) / 255,
            "path": (150 - abs(r - g) - abs(g - b) - abs(r - b)) / 255,
        }
    unique_all, counts_all = np.unique(frame, return_counts=True)
    count_map = {int(u): int(c) for u, c in zip(unique_all, counts_all)}
    pc = [(v, s["player"], count_map.get(v, 999999)) for v, s in scores.items()]
    pc.sort(key=lambda x: (-x[1], x[2]))
    player_c = pc[0][0] if pc else 1
    gc = [(v, s["goal"], count_map.get(v, 999999)) for v, s in scores.items() if v != player_c]
    gc.sort(key=lambda x: (-x[1], x[2]))
    goal_c = gc[0][0] if gc else 9
    wc = [(v, s["wall"]) for v, s in scores.items() if v not in (player_c, goal_c)]
    wc.sort(key=lambda x: -x[1])
    wall_c = wc[0][0] if wc else 4
    pth = [(v, count_map.get(v, 0)) for v in unique if v not in (0, player_c, goal_c, wall_c)]
    pth.sort(key=lambda x: -x[1])
    path_c = pth[0][0] if pth else 2
    return {"player": player_c, "goal": goal_c, "path": path_c, "wall": wall_c}


def query_inkling(b64, step, history, blocked_set, goal_info, color_desc, pos_str):
    hs = " | ".join(f"S{h['s']}:{h['d']}({'ok' if h['m'] else 'X'})" for h in history[-5:]) if history else "None"
    bs = ", ".join(sorted(blocked_set)) if blocked_set else "None"
    gi = f"Goal is {goal_info}. " if goal_info else ""
    text = f"{gi}Step {step}. {pos_str}\nHistory: {hs}\nBlocked here: {bs}\n\n{color_desc}\n\nReply ONLY: UP, DOWN, LEFT, or RIGHT."
    try:
        r = requests.post("https://openrouter.ai/api/v1/chat/completions",
            headers={"Authorization": f"Bearer {OR_KEY}", "Content-Type": "application/json"},
            json={"model": "thinkingmachines/inkling",
                  "messages": [
                      {"role": "system", "content": "Grid puzzle expert. Reply exactly one word: UP, DOWN, LEFT, or RIGHT."},
                      {"role": "user", "content": [
                          {"type": "text", "text": text},
                          {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}", "detail": "high"}}]}],
                  "max_tokens": 50, "temperature": 0.7}, timeout=60)
        d = r.json()
        cost = d.get("usage", {}).get("cost", 0) if "choices" in d else 0
        if "choices" not in d: return None, cost
        msg = d["choices"][0]["message"]
        direction = pd(msg.get("content")) or pd(msg.get("reasoning"))
        if direction: return {"UP":1,"DOWN":2,"LEFT":3,"RIGHT":4}[direction], cost
        return None, cost
    except: return None, 0


class SpatialMemory:
    UNKNOWN = 0; VISITED = 1; WALL = 2; GOAL = 3
    
    def __init__(self):
        self.cells = {}
        self.visit_count = {}
        self.x = 0; self.y = 0
        self.goal_pos = None
        self.blocked_at = {}
        self.move_history = []
        self.recent_positions = []
        
    def get_blocked(self):
        return self.blocked_at.get((self.x, self.y), set())
    
    def add_blocked(self, direction_name):
        pos = (self.x, self.y)
        if pos not in self.blocked_at:
            self.blocked_at[pos] = set()
        self.blocked_at[pos].add(direction_name)
    
    def moved(self, direction_id, did_move, direction_name):
        if direction_id not in DIR_DELTA:
            return
        dx, dy = DIR_DELTA[direction_id]
        nx, ny = self.x + dx, self.y + dy
        if did_move:
            self.cells[(self.x, self.y)] = self.VISITED
            self.x, self.y = nx, ny
            self.cells[(self.x, self.y)] = self.VISITED
            self.visit_count[(self.x, self.y)] = self.visit_count.get((self.x, self.y), 0) + 1
            self.move_history.append((direction_id, self.x, self.y))
            self.recent_positions.append((self.x, self.y))
            if len(self.recent_positions) > 8:
                self.recent_positions = self.recent_positions[-8:]
        else:
            self.cells[(nx, ny)] = self.WALL
            self.add_blocked(direction_name)
    
    def detect_2cell_loop(self):
        if len(self.recent_positions) < 6:
            return False
        rp = self.recent_positions
        if rp[-6] == rp[-4] == rp[-2] and rp[-5] == rp[-3] == rp[-1] and rp[-6] != rp[-5]:
            return True
        if len(rp) >= 4 and rp[-4] == rp[-2] and rp[-3] == rp[-1] and rp[-4] != rp[-3]:
            return True
        return False
    
    def get_perpendicular_escape(self, blocked_set):
        if len(self.move_history) < 2:
            return None
        recent_dirs = [self.move_history[-1][0], self.move_history[-3][0]]
        perp_map = {1: [3, 4], 2: [3, 4], 3: [1, 2], 4: [1, 2]}
        for rd in recent_dirs:
            for pdir in perp_map.get(rd, []):
                if DIR[pdir] not in blocked_set:
                    return pdir
        return None
    
    def mark_goal(self, frame, goal_color, player_color):
        goal_yx = np.argwhere(frame == goal_color)
        player_yx = np.argwhere(frame == player_color)
        if len(goal_yx) == 0 or len(player_yx) == 0:
            return False
        gy = int(goal_yx[:, 0].mean()) - int(player_yx[:, 0].mean())
        gx = int(goal_yx[:, 1].mean()) - int(player_yx[:, 1].mean())
        self.goal_pos = (self.x + gx, self.y + gy)
        self.cells[self.goal_pos] = self.GOAL
        return True
    
    def goal_direction(self):
        if self.goal_pos is None:
            return None
        dx = self.goal_pos[0] - self.x
        dy = self.goal_pos[1] - self.y
        if dx == 0 and dy == 0:
            return "AT_GOAL"
        if abs(dx) >= abs(dy):
            return 4 if dx > 0 else 3
        return 2 if dy > 0 else 1
    
    def goal_distance(self):
        if self.goal_pos is None:
            return float('inf')
        return abs(self.goal_pos[0] - self.x) + abs(self.goal_pos[1] - self.y)
    
    def get_explore_direction(self, blocked_set):
        best_dir = None
        best_score = -999999
        for aid, (dx, dy) in DIR_DELTA.items():
            if DIR[aid] in blocked_set:
                continue
            nx, ny = self.x + dx, self.y + dy
            if self.cells.get((nx, ny)) == self.WALL:
                continue
            cell_type = self.cells.get((nx, ny), self.UNKNOWN)
            visit = self.visit_count.get((nx, ny), 0)
            if cell_type == self.UNKNOWN:
                score = 50
            else:
                score = -visit * 20
            if self.goal_pos:
                gd = self.goal_direction()
                if gd and gd != "AT_GOAL":
                    if aid == gd:
                        score += 200
                    elif aid == OPPOSITE.get(gd):
                        score -= 100
            if score > best_score:
                best_score = score
                best_dir = aid
        return best_dir


def play(gid, max_steps=120, budget=2.0):
    results = {"timestamp": datetime.now().isoformat(), "agent": "AGRE_v11",
               "game": gid, "history": [], "spent": 0, "state": "UNKNOWN",
               "steps": 0, "won": False, "colors": {}, "hypotheses": [], "memory": {}}
    
    try:
        arc = arc_agi.Arcade()
        env = arc.make(gid, save_recording=True, include_frame_data=True)
        obs = env.reset()
        frame = safe_frame(obs)
        if frame is None: print("No frame!"); return results
        
        colors = detect_colors_semantic(frame, gid)
        results["colors"] = colors
        player_c, goal_c = colors["player"], colors["goal"]
        
        pal = palette(sorted(set(frame.flatten().tolist())), gid)
        color_names = {}
        for val, rgb in pal.items():
            r, g, b = rgb
            if val == player_c: color_names[val] = "YELLOW (you)"
            elif val == goal_c: color_names[val] = "GREEN (goal)"
            elif r > 150 and g > 150 and b > 150: color_names[val] = "gray path"
            elif r < 80 and g < 80 and b < 80: color_names[val] = "dark wall"
            elif r > 150 and g < 100 and b < 100: color_names[val] = "red"
            elif r < 100 and g > 150 and b < 100: color_names[val] = "green"
            elif r < 100 and g < 100 and b > 150: color_names[val] = "blue"
            else: color_names[val] = f"c{val}"
        color_desc = "Colors: " + ", ".join(f"{v}={n}" for v, n in sorted(color_names.items()))
        
        mem = SpatialMemory()
        mem.mark_goal(frame, goal_c, player_c)
        
        b64 = f2b64(frame, pal)
        history, visited = [], set()
        prev_frame = frame.copy()
        spent = 0.0
        hypotheses = []
        inkling_calls = 0
        
        print(f"\nAGRE v11 — {gid.upper()} — {max_steps} steps — ${budget:.2f}")
        print(f"Goal: {mem.goal_pos}")
        print("=" * 60)
        
        for step in range(max_steps):
            if obs.state.name == "WIN":
                print(f"\n*** WIN at step {step}! ***")
                results["won"] = True; results["state"] = "WIN"; break
            if obs.state.name in ("LOST", "GAME_OVER"):
                results["state"] = obs.state.name; break
            
            if mem.goal_pos is None:
                mem.mark_goal(frame, goal_c, player_c)
            
            blocked_here = mem.get_blocked()
            
            if mem.goal_pos:
                dist = mem.goal_distance()
                gd = mem.goal_direction()
                if gd == "AT_GOAL":
                    goal_info = "ARRIVED!"
                elif dist <= 5:
                    goal_info = f"{DIR.get(gd, '?')} {dist}away"
                else:
                    goal_info = f"{DIR.get(gd, '?')} ~{dist}"
            else:
                goal_info = "unknown"
            
            fh = fhash(frame)
            if fh in visited and step > 10:
                if (mem.x, mem.y) in mem.blocked_at:
                    mem.blocked_at[(mem.x, mem.y)].clear()
            visited.add(fh)
            
            action_id = None
            mode = "?"
            
            # === MODE 1: Goal Sprint ===
            if mem.goal_pos and mem.goal_distance() <= 3:
                gd = mem.goal_direction()
                if gd and gd != "AT_GOAL" and DIR.get(gd) not in blocked_here:
                    action_id = gd; mode = "sprint"
            
            # === MODE 2: 2-Cell Loop Escape ===
            if action_id is None and mem.detect_2cell_loop():
                escape = mem.get_perpendicular_escape(blocked_here)
                if escape:
                    action_id = escape; mode = "loop_esc"
                    print(f"       [LOOP ESCAPE: {DIR[escape]}]")
            
            # === MODE 3: Goal-Biased Exploration ===
            if action_id is None:
                explore = mem.get_explore_direction(blocked_here)
                if explore and DIR[explore] not in blocked_here:
                    action_id = explore; mode = "explore"
            
            # === MODE 4: LLM Fallback ===
            if action_id is None:
                pos_str = f"Pos:({mem.x},{mem.y}) Goal:{mem.goal_pos or '?'})"
                action_id, cost = query_inkling(b64, step, history, blocked_here, goal_info, color_desc, pos_str)
                spent += cost
                inkling_calls += 1
                mode = "inkling"
            
            direction = DIR.get(action_id, "?")
            
            if direction in blocked_here or action_id is None:
                for a in [4, 2, 1, 3]:
                    if DIR.get(a) not in blocked_here:
                        action_id = a; direction = DIR[a]; mode = "fallback"; break
                if action_id is None:
                    mem.blocked_at[(mem.x, mem.y)] = set()
                    for a in [4, 2, 1, 3]: action_id = a; direction = DIR[a]; mode = "clear"; break
            
            obs = env.step(ACT.get(action_id, GameAction.ACTION4))
            new_frame = safe_frame(obs)
            did_move = fmoved(prev_frame, new_frame) if new_frame is not None else False
            
            mem.moved(action_id, did_move, direction)
            
            history.append({"s": step, "d": direction, "m": did_move, "pos": (mem.x, mem.y), "mode": mode})
            print(f"  S{step:2d}: {direction:5s} | moved={did_move} | pos=({mem.x:3d},{mem.y:3d}) | goal={goal_info:12s} | {mode:10s} | ${spent:.4f}")
            
            if step % 10 == 0 and step > 0:
                move_rate = sum(1 for h in history[-10:] if h['m']) / min(10, len(history[-10:]))
                hypo = f"S{step}: rate={move_rate:.1f} pos=({mem.x},{mem.y}) goal_d={mem.goal_distance() if mem.goal_pos else '?' loop={mem.detect_2cell_loop()}}"
                hypotheses.append(hypo)
                print(f"       [HYPOTHESIS] {hypo}")
            
            if new_frame is not None:
                frame = new_frame
                b64 = f2b64(frame, pal)
                prev_frame = frame.copy()
            else:
                results["state"] = obs.state.name if obs else "NO_FRAME"; break
            
            if spent > budget: print(f"\nBUDGET"); break
            time.sleep(0.2)
        
        results["steps"] = step + 1
        results["spent"] = spent
        results["history"] = history
        results["hypotheses"] = hypotheses
        mode_counts = {}
        for h in history:
            m = h.get("mode", "?")
            mode_counts[m] = mode_counts.get(m, 0) + 1
        results["memory"] = {"position": [mem.x, mem.y], "goal": list(mem.goal_pos) if mem.goal_pos else None,
                             "cells": len(mem.cells), "visited": sum(1 for v in mem.cells.values() if v == 1),
                             "walls": sum(1 for v in mem.cells.values() if v == 2),
                             "inkling_calls": inkling_calls,
                             "unique_visits": len(mem.visit_count),
                             "mode_counts": mode_counts}
        if results["state"] == "UNKNOWN":
            results["state"] = obs.state.name if obs else "?"
    
    except Exception as e:
        print(f"\nERROR: {e}")
        traceback.print_exc()
        results["state"] = f"ERROR: {e}"
    finally:
        with open(f"/mnt/agents/output/agre_{gid}_v11.json", "w") as f:
            json.dump(results, f, indent=2, default=str)
        print(f"\n{results['state']} | {results['steps']} steps | ${results['spent']:.4f} | Inkling: {inkling_calls}")
        ms = results.get("memory", {})
        print(f"Memory: visited={ms.get('visited', 0)} walls={ms.get('walls', 0)} visits={ms.get('unique_visits', 0)} modes={ms.get('mode_counts', {})}")
        try:
            sc = arc_agi.Arcade().get_scorecard()
            print(f"Scorecard: actions={sc.total_actions}")
        except: pass
    return results

if __name__ == "__main__":
    g = sys.argv[1] if len(sys.argv) > 1 else "tu93"
    s = int(sys.argv[2]) if len(sys.argv) > 2 else 120
    play(g, max_steps=s, budget=2.0)
