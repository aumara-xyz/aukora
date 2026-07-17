<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# R51 CORE TRUTH FREEZE — Convex nervous system (issue #108)

Base `main@5aae90d6a84d`. Narrow. Local/self-hosted Convex only; no managed Convex, no keys/authority in Convex,
no metabolism, no CRDT, no mind/UI/Nebius/Inkling/Tinker. **The working custom store is NOT replaced tonight.**

## 1. Verified active production workflow-store path (from code, not docs)

Traced by reading the code, not inferring:

- `apps/seed/scripts/mind-door-7097.ts:50` — `storeMode` defaults to **`convex`** (only `AUKORA_WORKFLOW_STORE=memory`
  opts out). In convex mode it constructs `new ConvexWorkflowStore(liveWorkflowIo(stringClient), validateWorkflowState)`
  against `http://127.0.0.1:${convexLocalDeployment}` with `assertLoopbackUrl` (fail-closed, loopback only) and
  exposes a `DoorDurability = { hydrate, settle }`.
- `apps/seed/src/mindDoor.ts:286` hydrates the durable projection into the cache **before** the ceremony;
  `:320` settles accepted saves through the authoritative OCC mutation **after** the ceremony. An unreachable
  durability point or a lost race **fails closed** with a receipted `door:store-unavailable` / `door:settle-divergence`
  (mindDoor.ts:327/336) — a mutating request is never reported durable before its save settles.
- Authoritative store = `apps/brain/src/convexWorkflowStore.ts` (cache facade + OCC) over `apps/brain/convex/workflows.ts`
  (`saveWorkflow`/`loadWorkflow`, isolate-subset validation + OCC; rows are projections only).

**Conclusion:** the production path already persists through local self-hosted Convex with hydrate-before /
settle-after and fail-closed durability. R51 does not change it; it (a) proves it against a REAL backend and
(b) specifies the append-only-events + atomic-snapshot evolution as a verified pilot.

## 2. Real-backend proof (NOT convex-test)

`apps/brain/scripts/r51-canary.mjs` owns the whole backend lifecycle: it boots the official
`convex-local-backend` binary (loopback 3310/3311, temp SQLite), deploys the pilot, runs the five laws, then
`process.kill(pid,'SIGKILL')` — a genuine crash — and restarts on the **same on-disk SQLite**. Transcript +
exit code 0 in [`R51_REAL_BACKEND_TRANSCRIPT.md`](R51_REAL_BACKEND_TRANSCRIPT.md). Reproduce:
`npm run canary:r51 --workspace @aukora/brain` (Node 22). Proven laws:

1. typed event accepted once (seq 0, one durable row);
2. **10 identical submissions → one canonical effect** (9/10 dedup by content address; log stays 1 row);
3. **actual `kill -9` loses no settled state** (2 durable events survive; snapshot agrees);
4. **restart produces no duplicate effect** (post-crash redelivery deduplicates; log stays 2 rows);
5. **one narrow reactive projection changes** (a live `onUpdate` subscription pushes the snapshot `eventCount 1→2`).
Plus: an authority-claiming event is refused, never persisted.

## 3. Append-only workflow events + atomic current snapshot (spec, pilot verified)

`apps/brain/canary/convex/schema.ts` + `nervous.ts`:

- **`wf_events`** — append-only log. Rows never mutate or delete. `eventId` is the sha256 content address of
  the typed submission (the idempotency key, `by_eventId`); `by_workflow_seq` gives append order.
- **`wf_snapshot`** — exactly one row per workflow, advanced in the **same serializable transaction** as its
  event append, so snapshot and log can never disagree (the single reactive projection).
- **`appendEventOnce`** — one mutation: refuse-shape / refuse-authority (grantsAuthority===true → refused,
  never written) → dedup by `eventId` (returns the existing effect) → else append + advance snapshot atomically.
  Every row is `grantsAuthority:false`.

This is the smallest schema that makes "accept-once, 10→1, crash-durable, restart-idempotent, reactive" provable
on a real backend. It carries no keys, signatures, authority, or proposal content.

## 4. Official Convex Workflow / Workpool — versions, APIs, licenses (read-only inspection)

| Package | Latest version | License | What it is |
| --- | --- | --- | --- |
| `convex` (client/CLI) | 1.42.2 (pinned) · 1.42.3 available | **Apache-2.0** | reactive client, codegen, dev CLI |
| `@convex-dev/workflow` | **0.4.4** | **Apache-2.0** | durable, resumable multi-step runs (each step journaled; survives restart). Component, installed via `app.use(workflow)` + `new WorkflowManager(components.workflow)`; steps are `step.runMutation/Action`. Pre-1.0 (0.x API may change). |
| `@convex-dev/workpool` | **0.4.8** | **Apache-2.0** | bounded-concurrency queue (`new Workpool(components.workpool, { maxParallelism })`, `pool.enqueueMutation/Action`). Pre-1.0. |
| local `convex-backend` binary | precompiled-2026-07-06-44f7aa7 | **FSL-1.1-Apache-2.0** | the runtime; run externally as a dev binary (use, not source incorporation — never import its source into this AGPL repo). |

Both components are **Apache-2.0** (AGPL-compatible to depend on) but are **components, not core**, and are
**pre-1.0** (0.x). Neither is installed today (`@convex-dev/*` absent from every package.json).

## 5. Adoption decision + exact seam (goal 5)

**Decision: do NOT adopt the official Workflow/Workpool components tonight, and do NOT replace `ConvexWorkflowStore`.**
Rationale (evidence, not preference): the current store is ~130 lines, already proven durable on a real backend
(§2 + the preserved R50 SIGKILL transcript), and the official Workflow component is *larger and pre-1.0* — it is
not "genuinely smaller," which is the directive's bar for adding a pilot in its place. The R51 pilot (§3) is the
smaller thing, and it is additive (a separate `canary/` deployment), not a replacement.

**Exact adoption seam (documented under #108, for when a real multi-step need lands):** the migration is at
`apps/brain/src/convexWorkflowStore.ts` — its `WorkflowIo { load, save }` seam already isolates persistence from
the machine. An events-backed implementation would keep that interface, back `load` with the `wf_snapshot`
projection and `save` with an `appendEventOnce`-style atomic (event + snapshot) mutation, and add a bounded
replay for reconstruction. The OCC `version` maps to `wf_snapshot.eventCount`. No machine, door, or seed change
is required — only a second `WorkflowIo` implementation, gated behind an env flag exactly like `storeMode`.

## Boundaries held
Local self-hosted only (127.0.0.1, temp storage discarded); no managed Convex; no signing keys or authority in
Convex (the pilot refuses authority-claiming events); no metabolism, CRDT, mind, UI, Nebius, Inkling, or Tinker;
no convex-test-only green — §2 is a real binary with a real SIGKILL. Production store unchanged; R50 preserved.
