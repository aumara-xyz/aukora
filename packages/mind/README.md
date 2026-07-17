# @aukora/mind

The pure reasoning loop: a model-in-the-loop **observe → hypothesize → act → verify** cycle for
any observe-act environment on a color grid. It contains ZERO environment logic — no BFS, no
goal-seeking, no assumed mechanic. The model is the mind; this package only makes one frame
legible (grid + regions + diff), manages a bounded parity-safe conversation window with a
carried memo, parses one structured action per turn, and verifies mind-authored plans step by
step under ONE rigid-move law shared by diff rendering and plan verification.

Pure by design: no I/O, no network, no filesystem, no clock, no randomness. Every effect enters
through a caller-supplied port — the **five-port contract** in `src/ports.ts`:

| Port | What the caller supplies |
| --- | --- |
| `Env` | the world: `actions()`, `act(action)`, `reset()`, `observe()` |
| `MindSocket` | the model transport: `call(messages) -> Promise<{text, usage?}>` |
| `Simulator` | a deterministic replayable ghost (`reset()`, `act()`) for rollout lookahead |
| `TerminalSignal` | how a run ends: `'WIN' | 'GAME_OVER'` |
| `EpisodicNote` | distilled prior-session knowledge `{at, runId, outcome, memo}` (structural — no store import) |

Governance position: the mind is **advisory-only** — it authors observations, hypotheses, and
proposals; it signs, applies, and authorizes nothing (`mindGrantsAuthority()` returns `false`,
and every trace payload carries `advisoryOnly: true` / `grantsAuthority: false`). Its only
outlet is `Env.act`; in the self-modification domain `Env.act` is the propose door, and every
proposal still crosses the 13 gates plus the AUMLOK owner gate before anything real changes.

Disambiguation: `@aukora/mind` (this pure reasoning-loop package) is distinct from the seed's
mind DOOR — the governed HTTP surface in `apps/seed` (`mindDoor`). The door is an adapter that
owns I/O and composes governance; this package is the portable reasoning law it can call into.

Provenance: re-authored from the ARC-AGI-3 reasoning engine, aukora-symbiote branch
`fable/arc3-reasoning-engine-20260710` @ `e5768a2f`.
