<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# LOCAL_DEV boot evidence (R33) — sanitized

**Label: LOCAL_DEV. Development only — an anonymous LOCAL deployment on `127.0.0.1`. Not cloud, not
production, no Convex account, no managed deployment, no paid resources.** Executed once on 2026-07-16 from
`apps/brain`, then stopped cleanly. Sanitization: no tokens existed (anonymous mode); the only generated env
file (`.env.local`, gitignored) holds local-deployment pointers (`CONVEX_DEPLOYMENT` / `CONVEX_URL` /
`CONVEX_SITE_URL` → `127.0.0.1`), never credentials.

## Boot (official path, agent mode)

```
$ export CONVEX_AGENT_MODE=anonymous          # official anonymous local development (beta)
$ npx convex init                              # created .env.local (gitignored); no account, "dashboard: null"
$ npx convex dev --once --codegen disable --typecheck disable
▌ Developing against deployment:
▌ [Local] Port 3210 • No Convex account
▌ └─ http://127.0.0.1:3210
✔ Added table indexes: forgotten.by_record · memoryChain.by_index · memoryChain.by_record
✔ Convex functions ready! (516.78ms)
```

Environment note: the local backend executes `"use node"` actions with Node 18/20/22/24; this machine runs
Node 26, so Node 22 was installed alongside (`brew install node@22`) and prepended to `PATH` for these
commands. Recorded in the runbook.

## End-to-end exercise (reactive query → mutation → scheduled status)

```
$ npx convex run ingest:ingest '{ "record": { …valid content-addressed record… } }'   # "use node" ACTION
{ "ok": true, "recordId": "892e4f42…", "chainHash": "85d4ea87…", "snapshot": { "liveCount": 1, … } }

$ npx convex run memory:snapshot                                                      # reactive QUERY (sense)
{ "liveCount": 1, "chainLength": 1, "headHash": "85d4ea87…", "merkleRootHex": "e48fade9…", … }

$ npx convex run ingest:ingest '{ "record": { …content carrying AKIAIOSFODNN7EXAMPLE… } }'
{ "ok": false, "refusal": "refused: memory content carries a secret; not persisted in plaintext" }
   ← the CANONICAL @aukora/evidence scanner refusing LIVE in the Node runtime

$ npx convex run memory:scheduleHeartbeat '{"delayMs": 500}'                          # MUTATION (atomic reflex)
{ "ok": true, "scheduledId": "kc22dh9m…" }

$ npx convex run memory:scheduledStatus '{"scheduledId": "kc22dh9m…"}'                # QUERY over scheduler state
{ "name": "memory.js:heartbeat", "state": "success", … }                              ← DELAYED IMPULSE ran

$ npx convex run memory:health   → { "ok": true,  "chainLength": 1, "headHash": "85d4ea87…" }
$ npx convex run memory:verify   → { "valid": true, "merkleRootHex": "e48fade9…" }
```

## Clean stop

The local backend runs per-command under the CLI; after the last command nothing listens on port 3210
(verified with `lsof`). Deployment state lives under the CLI's local anonymous-backend directory, outside the
repository. Nothing was committed except source, the CLI's standard `convex/tsconfig.json`, and a `.gitignore`
covering `.env.local`.

## R34 — durability evidence (same anonymous LOCAL deployment, sanitized)

All on `127.0.0.1:3210`, no account, no cloud; stopped cleanly afterwards (port empty).

**Reactive subscription (cross-process push):** a standalone Node subscriber (`ConvexClient.onUpdate` on
`memory.snapshot`) received the current state, then was PUSHED the new state when a *different process* ran a
mutation:

```
UPDATE 1: liveCount=2 chainLength=2 head=30bfdb3b5935
UPDATE 2: liveCount=3 chainLength=3 head=bb6ea2b4ae5a      ← pushed on ingest from another process
```

**Crash/restart recovery:** the backend process was killed with `kill -9` (verified: nothing listening on
3210), then a fresh CLI command restarted it:

```
snapshot → liveCount=3, chainLength=3, head=bb6ea2b4…      ← ALL data persisted through the crash
verify   → valid: true, merkleRootHex=c952db49…
health   → ok: true
```

**Durable impulse with REAL retry (live):** scheduled with `failFirstAttempts:1, maxAttempts:3`:

```
impulseStatus → status=success, attempts=2                  ← failed once, retried, succeeded
                chainHeadAtCompletion=bb6ea2b4…             ← receipt linkage to the observed chain head
impulseBudgetRemaining → 62 (of 64)                          ← spend ceiling decremented per RUN
```

**Idempotent ingest** is proven under convex-test (same content-addressed record twice ⇒ one row, same
receipt), as are cancellation and the exhausted-ceiling refusal (fail-closed).

## R35 — durable rehearsal (workflow) evidence (same anonymous LOCAL deployment, sanitized)

**Forced restart/RESUME mid-workflow:** a 32-step rehearsal was started (idempotent, consumed-authority
evidence reference recorded) and the backend was killed with `kill -9` while it was RUNNING at step 3:

```
before crash → status=running, currentStep=3, effectsApplied=3
kill -9      → nothing listening on 3210
restart      → status=running, currentStep=6   ← the overdue scheduled continuation FIRED on restart
(held up)    → status=completed, currentStep=32, effectsApplied=32   ← EXACTLY 32 effects: none lost,
                                                                        none duplicated through the crash
verifyReceiptEvents → valid: true, eventCount=66                     ← started + 32 receipts + 32 effects
                                                                        + completed; kernel chain intact
```

**Zero outbound network:** during the exercise the backend process held ONLY its two local listeners —
`TCP *:3210 (LISTEN)` and `TCP *:3211 (LISTEN)` — and **zero established/outbound connections** to any
external host (`lsof -a -p <pid> -i -nP`). The stubbed external nerve refused LIVE:

```
nerves:external {"target":"https://example.com"}
→ { ok: false, refusal: "disabled: external nerves are stubbed this round — no outbound I/O …",
    networkPerformed: false }
```

Two-phase receipt-before-effect, idempotent start, exactly-once effects, bounded attention, cancellation, and
logical-time receipt chaining are proven under convex-test (`test/rehearsal.test.ts`). Clean stop verified
(port empty).

## R36 — WorkflowStore persistence evidence (same anonymous LOCAL deployment, sanitized)

The `workflows` table + `loadWorkflow`/`saveWorkflow` (OCC) implement Sam 3's `WorkflowStore` contract
(projections only — no authorization/signature/key/content ever crosses the seam).

```
saveWorkflow (create, expectedVersion 0)      → { ok: true }
kill -9 backend                               → nothing listening on 3210
restart (fresh CLI command)                   → loadWorkflow: phase=awaiting-owner, version=1,
                                                 ownerVerified=false          ← workflow PERSISTED through crash
memory:snapshot after the same crash          → liveCount=3, chainLength=3; verify → valid: true
                                                 ← memory ALSO persisted (R34 data still intact)
stale saveWorkflow (expectedVersion 0 again)  → { ok: false, reason: "conflict" }   ← OCC authoritative LIVE
```

Zero-outbound: this round the backend ran per-command only (no long-lived process at observation time); the
R35 observation of the SAME binary stands — only local listeners (`*:3210`, `*:3211`), zero outbound
connections — and the deployed function set gained no network call sites (`workflows.ts` is pure db logic;
external nerves remain stubbed). Clean stop verified (port empty).

Adapter-level laws (spec parity with `InMemoryWorkflowStore` using the REAL seed validator, the REAL
`DurableRecursion` machine end-to-end, at-most-once apply, cancellation persistence, tampered-projection
harmlessness with durable correction, and two-writer divergence deferring to the winner) are proven under
convex-test in `test/convexWorkflowStore.test.ts`.

## Architecture note surfaced by the REAL runtime

The Convex isolate does not provide `node:crypto`, which the provenance-locked `@aukora/evidence` digest module
requires — a fact `convex-test` (Node-hosted) could not reveal. Resolution, preserving both reuse and
fail-closed structure: the canonical secret scan runs in the **`"use node"` action** `convex/ingest.ts` (the
ONLY public ingest door), and the guarded write is the **INTERNAL** mutation `memory.ingestValidated`, which a
client can never call directly. Proven both under convex-test and live on the local deployment above.
