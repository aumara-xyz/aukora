"""
arc_agi.py - ARC Prize Arcade API wrapper.
Dynamically loads game modules from environment files and wraps arcengine.
"""
import os
import sys
import importlib.util
from types import SimpleNamespace
import arcengine
from arcengine import GameAction, ActionInput


class Scorecard:
    def __init__(self):
        self.total_actions = 0
        self.total_levels_completed = 0


class Env:
    """Wraps an ARCBaseGame instance to provide a gym-like interface."""

    def __init__(self, game, save_recording=False, include_frame_data=False):
        self.game = game
        self.save_recording = save_recording
        self.include_frame_data = include_frame_data
        self._action_count = 0
        self._levels_completed = 0

    def reset(self):
        """Reset the game and return initial observation."""
        self.game.full_reset()
        result = self.game.perform_action(ActionInput(id=GameAction.RESET))
        self._action_count = 0
        return self._wrap_obs(result)

    def step(self, action):
        """Perform an action and return the next observation."""
        if isinstance(action, GameAction):
            act = action
        elif isinstance(action, int):
            act = GameAction(action)
        else:
            act = GameAction.ACTION1
        result = self.game.perform_action(ActionInput(id=act))
        self._action_count += 1
        if result.state == arcengine.GameState.WIN:
            self._levels_completed += 1
        return self._wrap_obs(result)

    def _wrap_obs(self, result):
        """Wrap FrameData result in an observation namespace."""
        obs = SimpleNamespace()
        obs.frame = result.frame if result else None
        obs.state = SimpleNamespace()
        obs.state.name = result.state.value if result and result.state else "UNKNOWN"
        obs.available_actions = result.available_actions if result and result.available_actions else [1, 2, 3, 4]
        return obs


class Arcade:
    """ARC Prize Arcade client. Loads games from local environment files."""

    def __init__(self):
        self._games = {}
        self._envs = {}
        self._action_counts = {}

    def _find_game_module(self, game_id):
        """Find and import the game module from environment files."""
        base = "/mnt/agents/output/environment_files"
        if not os.path.isdir(os.path.join(base, game_id)):
            return None
        game_dir = os.path.join(base, game_id)
        subdirs = [d for d in os.listdir(game_dir) if os.path.isdir(os.path.join(game_dir, d))]
        if not subdirs:
            return None
        game_path = os.path.join(game_dir, subdirs[0], f"{game_id}.py")
        if not os.path.exists(game_path):
            return None
        spec = importlib.util.spec_from_file_location(game_id, game_path)
        mod = importlib.util.module_from_spec(spec)
        sys.modules[game_id] = mod
        spec.loader.exec_module(mod)
        return mod

    def _get_game_class(self, mod):
        """Find the game class in the module."""
        for name in dir(mod):
            obj = getattr(mod, name)
            if (isinstance(obj, type) and
                issubclass(obj, arcengine.ARCBaseGame) and
                obj is not arcengine.ARCBaseGame):
                return obj
        return None

    def make(self, game_id, save_recording=True, include_frame_data=True):
        """Create a game environment."""
        mod = self._find_game_module(game_id)
        if mod is None:
            raise ValueError(f"Game '{game_id}' not found in environment files")
        cls = self._get_game_class(mod)
        if cls is None:
            raise ValueError(f"No game class found for '{game_id}'")
        game = cls()
        self._games[game_id] = game
        env = Env(game, save_recording=save_recording, include_frame_data=include_frame_data)
        self._envs[game_id] = env
        self._action_counts[game_id] = 0
        return env

    def get_scorecard(self):
        """Return scorecard with action counts."""
        sc = Scorecard()
        for gid, count in self._action_counts.items():
            sc.total_actions += count
        return sc
