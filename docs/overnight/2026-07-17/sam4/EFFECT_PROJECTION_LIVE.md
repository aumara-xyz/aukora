# Sam 4 · overnight · LIVE effect-projection crash + rebuild proof

**Answers outsider gap #1** (real crash of the actual effect projection, not the pilot's built-in laws or
convex-test). Base `5ae15481`. Node v22 for the convex CLI; real `convex-local-backend` (FSL-1.1 official
binary, run as a dev runtime — used, not source-incorporated).

## What it proves (against a REAL self-hosted backend, NOT convex-test)

Run: `node apps/brain/scripts/effect-projection-canary.mjs` (with Node 18/20/22/24 on `PATH`).

The effect-projection root is computed by `apps/brain/scripts/lib/effectRoot.mjs`, which is **locked byte-for-byte
to the TS law** `apps/brain/src/effectEvent.ts` by the gated test `effectRootCrosscheck.test.ts` — so the live
canary and the in-repo law can never drift.

## Live transcript (this node)

```
[effect-canary] REAL backend: precompiled-2026-07-06-44f7aa7/convex-local-backend · storage (temp)
[effect-canary] booting backend #1 (pid 22708) on http://127.0.0.1:3312 …
[effect-canary] appending durable effects (with at-least-once redelivery)…
  PASS  10+ redeliveries collapsed to exactly 3 durable rows (idempotent)
[effect-canary] effect-projection root R1 = 6cff146877cfbae48f3ed491…
  PASS  projection has 3 canonical effects
[effect-canary] PROOF — actual process death (kill -9) then restart on the SAME storage
  PASS  backend pid 22708 is gone (real SIGKILL)
[effect-canary] restarting backend #2 (pid 22743) …
  PASS  effect projection SURVIVED the crash: R2 === R1
  PASS  durable rows unchanged across the crash (3)
[effect-canary] PROOF — destroy the derived projection, rebuild from the durable stream → identical root
  PASS  rebuild from the durable event stream: R3 === R1

[effect-canary] RESULT: ALL LIVE PROOFS PASS
```

## HARD ACCEPTANCE closed (live)

- **10 identical projection deliveries → one canonical result:** 9 at-least-once redeliveries collapsed to 3
  durable rows (one per distinct effect); the projection has 3 canonical effects.
- **SIGKILL/restart preserves settled workflow/effect state:** real `kill -9` of the running backend, restart on
  the **same on-disk SQLite**, and the effect-projection root is unchanged (`R2 === R1`).
- **Destroy the projection, rebuild from the trusted event stream, obtain identical state/root:** `R3 === R1`.

## Honesty + safety

- Self-contained: temporary SQLite/storage (discarded), the canary **self-kills** its backend in a `finally`,
  verified no orphan process remained. Exits `2` with a named prerequisite if the binary is absent — never a
  fabricated live result.
- The canary reuses Sam 2's pilot `apps/brain/canary` convex module (the append-only `wf_events` durable log) as
  the protected event stream — not duplicated. Authority stays entirely outside Convex; every projected row is
  `grantsAuthority:false`.
- This is a **local self-hosted** backend only — no managed Convex, no external cloud.
