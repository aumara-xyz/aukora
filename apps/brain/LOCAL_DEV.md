<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# LOCAL_DEV brain path (never production)

A local-development brain using **official local Convex deployment semantics** — a local backend on your
machine. This is **LOCAL_DEV only**: not production, not managed cloud, no paid resources.

## One command

```bash
npm run dev:local --workspace @aukora/brain
```

Non-interactive / first-time notes (proven in [docs/LOCAL_DEV_EVIDENCE.md](./docs/LOCAL_DEV_EVIDENCE.md)):
- `export CONVEX_AGENT_MODE=anonymous` uses the official anonymous LOCAL deployment (no account, no login,
  `127.0.0.1` only). `npx convex init` once, then `dev`.
- `"use node"` actions (the `convex/ingest.ts` secret-scan door) need Node 18/20/22/24 on `PATH`; on a Node-26
  machine: `brew install node@22` and `export PATH="/opt/homebrew/opt/node@22/bin:$PATH"` for these commands.
- `.env.local` (local-deployment pointers only, no credentials) is gitignored — never commit it.

This runs `convex dev` against a **local** deployment of the curated functions in `apps/brain/convex`
(`schema.ts`, `memory.ts`). It generates `_generated/` (this repo ships hand-written codegen equivalents so
tests need no deployment) and serves the reactive query/mutation surface locally.

- **Do NOT select or provision a managed cloud deployment.** Use the local deployment.
- The deterministic demo and CI use **`convex-test`** (headless simulated Convex) — see
  `test/convexMemory.test.ts`. `convex-test` remains the test path; `dev:local` is for interactive local work.

## Read-only health/snapshot for the Spatial shell

The brain exposes read-only reactive senses the Spatial shell can poll without coupling any UI into brain code:

- Convex queries: `api.memory.snapshot`, `api.memory.health`, `api.memory.recall`.
- In-process contract: `brainHealthSnapshot(store)` → `BrainHealthSnapshotV1` (`src/healthContract.ts`).

Roles (see `src/reactiveBrainAdapter.ts`): reactive queries = **senses**, mutations = **atomic reflexes**,
scheduled = delayed impulses, cron = rhythm, workflow = durable rehearsal, workpool = attention, actions =
external nerves. **Kernel / AUMLOK authority stays outside and above Convex.**

## Label

`deployment: "local-dev"` on the `ReactiveBrainAdapter`. A LOCAL_DEV node and a Nebius node are **semantic
twins** — same print/schema and same adapter contract, differing only by an explicit adapter/config.
