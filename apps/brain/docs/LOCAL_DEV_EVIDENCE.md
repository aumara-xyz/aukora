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

## R37 — real composition + local door evidence (same anonymous LOCAL deployment, sanitized)

**NEW-AUKORA port map** (`src/ports.ts` — collision-free, loopback only): `7141` brain projection/control door
· `7142` keychain broker (contract default) · `3210`/`3211` local Convex backend (upstream defaults, dev-only)
· donor `7090–7093` reserved, never reused as new services.

**Live composition (`npm run compose:live`, gated `AUKORA_LIVE_COMPOSE=1`) — PASSED against the running
backend:** Sam 3's real `DurableRecursion` over `ConvexWorkflowStore(liveWorkflowIo(ConvexHttpClient))`:
propose → settle (durable) → owner-gated complete → applied read back over live HTTP; stale duplicate save →
**OCC `conflict` live**; memory ingest via the node action + chain `verify: true` live; a rehearsal's receipt
stream and its **cancellation driven through the DOOR on `127.0.0.1:7141`** (responses carry
`x-aukora-source: live` — the door has NO fixture path; no generated projection file can be served as live).

**Forced-restart transcript (CLI reads through the real backend):**

```
saveWorkflow v1 (awaiting-owner)      → { ok: true }
kill -9 <backend pid>                 → nothing listening on 3210
restart (fresh CLI command)           → loadWorkflow: phase=awaiting-owner, version=1   ← workflow persisted
                                        memory:verify → valid: true                     ← memory persisted
                                        verifyReceiptEvents → valid: true, 69 events    ← receipts persisted
                                        (includes the live-composition rehearsal's started…cancelled events)
```

**Zero-outbound:** the held backend process carried ONLY `TCP *:3210` + `*:3211` LISTENers — zero
established/outbound connections (`lsof -a -p <pid> -i -nP`); the door binds `127.0.0.1` only; the sole
permitted external transport remains the explicitly injected Fu-lane model transport (untouched, parked).
Clean stop verified (port empty).

**Composable commands for Sam 1** (`--workspace @aukora/brain`): `npm run local:up` (deploy once) ·
`local:hold` (hold the backend) · `local:health` (health read) · `local:down` (stop) · `compose:live`
(the gated live composition proof) · `verify` (typecheck + full suite).

## R38 — safe orchestration + reactive door contract (sanitized)

**SINGLE-DOOR CONTRACT:** `127.0.0.1:7141` is the ONE documented brain projection/control door for consumers
(Spatial shell, chat door). Port `3210` is the local Convex backend's INTERNAL port — only the composition and
the door's own live backend talk to it; **consumers must never call 3210 directly.** The door is loopback,
**origin-closed** (no `Access-Control-Allow-*` header is ever emitted — proven by test), projections-only plus
two bounded cancellation reflexes; no authority.

**Reactive projections served (all `x-aukora-source: live`; no generated projection file can be called live):**
`/health` · `/snapshot` · `/workflow/:id` · `/workflows?phase=` · `/memory/recall?text=` · `/fu` (canonical
council seats + provider truth) · `/aumlok` (awaiting-owner view; authority stays outside) · `/candidates`
(applied = PR-candidate outputs) · `/receipts` · `/truth` · **`/events` (SSE reactive stream over an injected
subscription seam)** · POST `/control/cancel-rehearsal` · POST `/control/cancel-impulse`.

**Checkout-scoped process control (`scripts/local-ctl.mjs` — up · hold · health · status · down):** the held
CLI's PID is recorded in `apps/brain/.local/brain.pid` (+ lockfile naming THIS checkout, both gitignored);
`down` signals ONLY that PID group after verifying the live process belongs to this checkout (command line or
`lsof` cwd) — **no global `pkill`; concurrent Aukora checkouts cannot kill each other** (unverified PIDs on the
port are left running, logged). Node preflight: unsupported Node (this box: 26) triggers the side-installed
Node 22 or a LOUD refusal with instructions.

**Transcript (2026-07-16):**
```
local-ctl up      → deploy ok ("Convex functions ready!")
local-ctl hold    → preflight: node 26 → side-installed Node 22 · holding backend (cli pid recorded)
local-ctl status  → held cli pid verified · backend listening on 3210: true
compose:live      → 1 passed (real machine + door on 7141, live)
zero-outbound     → backend sockets: *:3210 LISTEN · *:3211 LISTEN · one 127.0.0.1→127.0.0.1 ESTABLISHED
                    (the compose client's own loopback connection; nothing external)
kill -9 backend   → recovery reads: memory verify valid · receipt events 72, valid   ← restart-proof again
local-ctl down    → SIGTERM to the OWNED pid group only · pidfile+lockfile cleared · port empty
local-ctl status  → exits 1 when nothing is held (scriptable by Sam 1)
```

## R39 — root organism supervisor + always-held 7141 (clean-machine transcript, sanitized)

**One command** (`npm run organism:up --workspace @aukora/brain`) started and owns the whole local organism:

```
organism:up      → convex healthy on 3210/3211 · door HELD on 7141 · mind healthy on 7097 ·
                   spatial healthy on 7096 (projections via the 7141 door) ·
                   voice: optional, not present — DEGRADED(optional)  ← loud, never silent
organism:status  → all four pids (verified) · all ports listening · exit 0
Spatial /api/spatial/projection → {"source":"door","degradedSenses":[], …}   ← through the HELD 7141 door;
                                                                                never ENGINE UNREACHABLE
door /events     → ": connected" (SSE reactive seam wired via one shared Convex WebSocket subscription)
```

**Two concurrent checkouts do not kill or reuse each other** (checkout B = a worktree of the same commit):

```
B organism:up    → "port 3210 is held by pid … which does NOT verify as this checkout — refusing to kill
                    or reuse it" → REFUSED, nothing else started
B organism:down  → "spatial: pid … does NOT verify as ours — left running" · B's own files cleared only
A organism:status→ all services (verified), exit 0                          ← A untouched throughout
```

**Crash/restart preserves everything and executes nothing automatically:**

```
before crash     → receiptEvents=72 · chainLength=5
kill -9 backend  → door STILL HELD on 7141, answering honest 502 per request  ← the shell sees degradation,
                                                                                 never an unreachable engine
organism:up      → restarts ONLY convex (door keeps its original pid — idempotent ownership)
after restart    → receiptEvents=72 · chainLength=5 (identical) · backend ok:true
                   ← workflow/receipts preserved; NOTHING executed automatically
organism:down    → reverse-order SIGTERM to owned pid groups · all four ports empty
```

Supervisor laws: recorded PID groups only (`.local/organism/*.pid` + lock naming this checkout, gitignored);
per-pid ownership verification before ANY signal; no global process matching anywhere; loud Node preflight
(side-installed Node 22 engaged on this Node-26 box).

## Architecture note surfaced by the REAL runtime

The Convex isolate does not provide `node:crypto`, which the provenance-locked `@aukora/evidence` digest module
requires — a fact `convex-test` (Node-hosted) could not reveal. Resolution, preserving both reuse and
fail-closed structure: the canonical secret scan runs in the **`"use node"` action** `convex/ingest.ts` (the
ONLY public ingest door), and the guarded write is the **INTERNAL** mutation `memory.ingestValidated`, which a
client can never call directly. Proven both under convex-test and live on the local deployment above.
