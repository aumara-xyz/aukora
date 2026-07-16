<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# Convex as a nervous system — research memo (R33)

Research memo for the BRAIN lane. Maps Convex's execution primitives onto the organism's nervous-system
vocabulary (see `src/reactiveBrainAdapter.ts` for the pinned role map) and records the engineering facts a
future round needs. **Kernel/AUMLOK authority always stays outside and above Convex.** Nothing here grants
authority; everything observable through this layer is advisory.

## 1. Primitives → roles

| Convex primitive | Organism role | Facts that matter |
| --- | --- | --- |
| Reactive query | **Sense / shared state** | Deterministic, read-only, transactional snapshot reads; subscriptions push updates automatically — the Spatial shell polls or subscribes without coupling UI into brain code. |
| Mutation | **Atomic reflex** | One mutation = one serializable transaction; our receipt-before-row + corrupt-store gate live here. Convex retries mutations safely because they are transactions (see idempotency below). |
| Scheduled function (`ctx.scheduler.runAfter/runAt`) | **Delayed impulse** | One-shot future work; status is observable in the `_scheduled_functions` system table (proven live in `LOCAL_DEV_EVIDENCE.md`). Scheduling from a mutation is transactional — if the mutation rolls back, nothing was scheduled. |
| Cron | **Rhythm** | Cadence only, carries no payload authority. Declared in `crons.ts`; keep every cron handler internal. |
| Workflow (component) | **Durable multi-step rehearsal** | The `@convex-dev/workflow` component gives durable, resumable multi-step runs (each step journaled; survives restarts). Right home for the migration rehearsal. Component, not core — add only when a real multi-step need lands. |
| Workpool (component) | **Attention / spend** | `@convex-dev/workpool` bounds concurrency and queues work — the natural place to meter generation spend (pair with the supervised envelope's hard ceilings). |
| Action (default isolate) | **External nerve (light)** | May call the network; NOT transactional. Keep effects idempotent; call mutations for any write. |
| Action (`"use node"`) | **External nerve (Node)** | Full Node runtime. Required for the provenance-locked `@aukora/evidence` scanner (`node:crypto`) — our public ingest door. Local backend needs Node 18/20/22/24 present. |

## 1b. Workflow/Workpool dependency decision (R34)

Checked read-only against the npm registry: `@convex-dev/workflow` 0.4.4 and `@convex-dev/workpool` 0.4.8 are
both **Apache-2.0** — license-compatible with this AGPL-3.0 repo (Apache-2.0 code may be incorporated; the
combination ships AGPL). Lock-in assessment: both are Convex **components** — they install into the deployment
and their journals/queues live in component-scoped tables, so they deepen the Convex coupling beyond our two
seams and are NOT portable across backends.

**Decision: add NEITHER this round.** The R34 durable-impulse needs (idempotency, retry state, cancellation,
spend ceiling, receipt linkage) are covered by the hand-rolled `impulses` + `impulseBudget` tables inside the
existing seam (`convex/memory.ts`), fully proven under convex-test and the local deployment. Adopt Workpool
only when real concurrency metering demands it, and Workflow only when a genuinely multi-step durable rehearsal
lands (the migration's live import is the likely trigger) — behind the ReactiveBrainAdapter vocabulary either way.

## 2. Retries + idempotency

- **Mutations** are transactions; Convex may retry them on OCC conflicts — handlers must be deterministic
  (ours are: content-addressed ids, chain hash from prior row, no ambient clock inside handlers).
- **Actions are NOT retried automatically** (they may have external effects). Design: action = scan/refuse +
  `ctx.runMutation`; the mutation is where atomicity lives. If an action is re-run by a caller, ingest stays
  idempotent at the content level (same content ⇒ same `recordId`; duplicate appends are visible in the chain
  and can be deduplicated at recall — a future round may add an explicit same-recordId guard).
- **Scheduled functions** run at-least-once semantics from the caller's perspective; ours (heartbeat/sweep)
  are pure recomputations — safe to repeat.
- **Workpool/Workflow** add configurable retry policies per step; adopt their retry knobs rather than
  hand-rolling loops.

## 3. Reactive state

The single `brainSnapshot` row is the organism's shared reactive state: every reflex recomputes it in the same
transaction, so any subscriber (console, Spatial shell) sees a consistent liveCount/chainLength/head/Merkle
root the instant a reflex commits. Read-only contracts: `memory.snapshot`, `memory.health`, `memory.verify`,
`memory.scheduledStatus`, and the in-process `BrainHealthSnapshotV1`.

## 4. Exports / escape hatches

- `npx convex export` produces a full ZIP snapshot of tables (+ file storage) — the honest bulk escape hatch;
  our migration bridge is the governed inverse (import side).
- Streaming export (Fivetran/Airbyte connectors) exists for continuous sync; not needed this round.
- Our chain is additionally self-verifying outside Convex: rows carry the content-free commitments, so an
  export can be re-verified with the canonical kernel verifier anywhere.

## 5. Local vs self-hosted vs cloud

| Path | What it is | Our stance |
| --- | --- | --- |
| **LOCAL_DEV (anonymous local deployment)** | Official `convex dev` local backend on `127.0.0.1`, no account (`CONVEX_AGENT_MODE=anonymous`). | **Proven this round** (booted, exercised, stopped — see `LOCAL_DEV_EVIDENCE.md`). Development only. |
| **Self-hosted** | Open-source `convex-backend` binary/Docker; you own the database and dashboard; admin key auth (`CONVEX_SELF_HOSTED_URL` / `..._ADMIN_KEY`). | The sovereignty path if the organism must never depend on managed cloud. Costs: self-managed durability, upgrades, scaling. |
| **Managed cloud** | convex.dev deployments (dev/preview/prod), metered. | **Human-gated; not launched.** Would be the lowest-ops production path; requires account + billing decisions by Peter. |

## 6. Metering

Convex meters function calls, database bandwidth/storage, action compute, and file storage. Discipline for a
future live round: route all generation through a Workpool with explicit budgets; keep the supervised
envelope's hard token/time/cost ceilings as the inner fence so vendor metering is the OUTER, not the only,
limit; log spend as receipts so cost is chain-audited.

## 7. Adapter portability

Everything vendor-shaped stays behind two seams: `apps/brain/convex/**` (the persistence target: schema +
functions) and `ReactiveBrainAdapter` (the role vocabulary). The pure law (`@aukora/memory`, `@aukora/kernel`)
never imports Convex — enforced by `test/boundary.test.ts`. Porting to another reactive backend means
re-implementing the two seams; the chain, commitments, recall, forgetting, staleness, and truth gates move
unchanged. The LOCAL_DEV and convex-test twins (same functions, different host) are the standing proof the
seam holds.
