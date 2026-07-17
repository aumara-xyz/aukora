# R52 canonical-path evaluator (#115) — one command, one self-verifying bundle

For a hostile evaluator: **one command** demonstrates the real governed organism end-to-end, over
**production adapters** (no second mock architecture), and writes **one self-verifying evidence bundle**.

## The path

```
typed input → local Convex settle → governed unsigned proposal → fresh AUMLOK halt
            → isolated candidate → receipt → reactive projection
```

## One command (fresh clone)

```bash
npm ci
npm run build --workspace @aukora/kernel        # kernel is consumed built
npm run evaluate --workspace @aukora/spatial     # runs the path, writes evaluator/artifacts/canonical-path.json
```

The command uses the real `@aukora/brain` `ReactiveMemoryStore`, `@aukora/seed` `MindDoor` + the hybrid
AUMLOK gate + the local candidate ceremony over a **temporary** git repo. The reasoning provider stays
**unarmed** — the proposal is deterministic/typed, exactly as #115 permits.

## Proof labels (this run, on a node WITH the local Convex binary)

| Stage | Label |
|---|---|
| 1 typed input → `@aukora/brain` ingest | **PROVEN** |
| 2 local Convex settle | **LIVE_LOCAL** (binary present; real durable settle via the delegated canary) |
| 3 governed unsigned proposal (`/api/propose`, no signature) | **PROVEN** — grounded then owner-gated; no plan/candidate/signature leaks unsigned |
| 4 fresh AUMLOK halt (`/api/materialize`, no auth) | **PROVEN** — refused at the hybrid AUMLOK gate, fail-closed |
| 5 isolated candidate (deterministic TEST owner signs) | **TEST_ONLY** — real `candidate/*` branch in a temp repo; real main never touched |
| 6 receipt | **PROVEN** — content-free chain verifies |
| 7 reactive projection | **LIVE_LOCAL** (binary present) / **TEST_ONLY** (absent) |

`coreHash f55b065d…` (self-verifying anchor — re-running the deterministic path reproduces it byte-for-byte).

## Fails honestly without the official local Convex binary

If `convex-local-backend` is absent (`~/.cache/convex/binaries/*/convex-local-backend` or
`CONVEX_LOCAL_BACKEND_BINARY`), stage 2 is **PARKED** and stage 7 is **TEST_ONLY** — the bundle records the
exact prerequisite, and the in-process governed proof (stages 1, 3–6) still runs and passes. It never fakes
a live backend.

**Prerequisite for LIVE_LOCAL:** `export CONVEX_AGENT_MODE=anonymous` then `npm run dev:local --workspace
@aukora/brain` once (primes the official FSL-1.1 local binary — used as a dev runtime, not source-incorporated),
Node 18/20/22/24 on `PATH` for `"use node"` actions (on Node 26: `brew install node@22`).

## Real process death vs in-process simulation (#115)

The evaluator's in-process path performs **no real process death** — it is honestly not presented as one.
The **real** `kill -9` proof is **delegated** to Sam 2's canary (reuse, not copied):

```bash
npm run canary:r51 --workspace @aukora/brain   # spawns real convex-local-backend, kill -9, restart on same SQLite
```

On a node with the binary this passes with a genuine crash (real SIGKILL of the running backend, restart on
the same on-disk SQLite, settled state survives, no duplicate effect) — see `docs/continuity/r52`.

## Fences

Read-only lane. No remote write. The candidate only ever lands in a **temp** repo — the real `main` is
byte-identical. No provider armed, no paid call, no secrets in the bundle. `grantsAuthority:false` throughout.
