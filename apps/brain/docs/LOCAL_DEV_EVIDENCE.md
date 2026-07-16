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

## Architecture note surfaced by the REAL runtime

The Convex isolate does not provide `node:crypto`, which the provenance-locked `@aukora/evidence` digest module
requires — a fact `convex-test` (Node-hosted) could not reveal. Resolution, preserving both reuse and
fail-closed structure: the canonical secret scan runs in the **`"use node"` action** `convex/ingest.ts` (the
ONLY public ingest door), and the guarded write is the **INTERNAL** mutation `memory.ingestValidated`, which a
client can never call directly. Proven both under convex-test and live on the local deployment above.
