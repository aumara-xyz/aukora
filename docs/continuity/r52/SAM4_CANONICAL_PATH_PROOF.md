# SAM 4 · R52 #115 — one-command governed-organism proof (public, self-verifying)

**Lane:** Sam 4 · **Issues:** #23 / #115 · **Base:** canonical `main@5ae15481bf5676ede97aab28b5c16e189358472c`
· **Node:** v26.4.0 / darwin arm64 (local Convex binary present).

One command, one self-verifying evidence bundle for the real canonical path over **production adapters** —
no second mock architecture, provider unarmed.

```
typed input → local Convex settle → governed unsigned proposal → fresh AUMLOK halt
            → isolated candidate → receipt → reactive projection
```

Command: `npm run evaluate --workspace @aukora/spatial` → `apps/spatial/evaluator/artifacts/canonical-path.json`.

## Proof labels (this node — WITH the official local Convex binary)

| Stage | Label | Evidence |
|---|---|---|
| 1 typed input | **PROVEN** | ingested through `@aukora/brain` `ReactiveMemoryStore`; chain hash recorded |
| 2 local Convex settle | **LIVE_LOCAL** | official `convex-local-backend` present; real durable settle proven by the delegated canary (below) |
| 3 governed unsigned proposal | **PROVEN** | `/api/propose` unsigned → grounded then owner-gated; `signed:false`, no candidate |
| 4 fresh AUMLOK halt | **PROVEN** | `/api/materialize` unsigned → **refused at the hybrid AUMLOK gate** (`refused-at-owner`), fail-closed |
| 5 isolated candidate | **TEST_ONLY** | deterministic TEST owner signs → real `candidate/*` branch in a **temp** repo; `touchedMain:false`, `pushed:false` |
| 6 receipt | **PROVEN** | content-free receipt chain verifies (`chainValid:true`) |
| 7 reactive projection | **LIVE_LOCAL** | read-only projection over the same real state; `grantsAuthority:false` |

**Self-verifying anchor:** `coreHash f55b065d4fb1f4ce32b91f7be0aa0c24f0d48a453d4fe2f2046795445aedf4f0` —
re-running the deterministic path reproduces it byte-for-byte (proven across repeated runs; the bundle file is
byte-stable). Live receipt head/merkle hashes bind a real timestamped candidate commit and are therefore kept
OUT of the self-verifying core (the integrity facts `chainValid`/`chainLength` stay in).

## LIVE_LOCAL — actual process death (delegated to Sam 2's canary, reused not copied)

`npm run canary:r51 --workspace @aukora/brain` on this node (real `convex-local-backend`, official FSL-1.1
binary run as a dev runtime):

```
[r51-canary] booting backend #1 (pid 86649) on http://127.0.0.1:3310 …
  PASS  accepted, not deduplicated, seq 0
  PASS  durable log has exactly 1 row
  PASS  all 10 acknowledged; 10 deduplicated (one canonical effect)
  PASS  reactive subscription pushed an eventCount change (…→2)
  PASS  pre-crash SETTLED state: 2 events
[r51-canary] PROOF 3 — actual process death (kill -9) then restart
  PASS  backend pid 86649 is gone (real SIGKILL)
[r51-canary] restarting backend #2 (pid 86735) on the SAME storage …
  PASS  SETTLED state SURVIVED the crash: 2 durable events
  PASS  global durable count unchanged across the crash
  PASS  both redeliveries deduplicate (no new effect)
  PASS  authority-claiming event REFUSED, not persisted
```

This is a **genuine crash** — `kill -9` of the running backend, restart on the same on-disk SQLite, settled
state survives, no duplicate effect. It is **distinguished from the in-process path** (which performs no real
death). Real process death/restart = this canary; in-process = the evaluator's stages 1–7.

## Fails honestly without the binary

On a fresh clone WITHOUT `convex-local-backend`: stage 2 → **PARKED** with the exact prerequisite, stage 7 →
**TEST_ONLY**, and the in-process governed proof (1, 3–6) still runs green. The evaluator never fakes a live
backend. Prerequisite: `export CONVEX_AGENT_MODE=anonymous` + `npm run dev:local --workspace @aukora/brain`
once; Node 18/20/22/24 on `PATH` for `"use node"` actions.

## Fences

Read-only lane. The candidate lands only in a **temp** repo — real `main` byte-identical (verified). No remote
write, no provider armed, no paid call, no secrets in the bundle, `grantsAuthority:false` throughout. The
LIVE_LOCAL Convex evidence is Sam 2's existing canary — bound through the narrow `ConvexWorkflowStore` /
`canary:r51` interface, not duplicated.
