<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# @aukora/supervisor — protected lifecycle owner + the one gateway (WAVE 2)

Internally modular, externally **one Aukora**: one identity, one external gateway (`127.0.0.1:7100`),
one lifecycle owner, one receipt/status surface. Restores the donor's #71/#26 + doctor/start-kit
design for the NEW organism.

- `policy.json` — owner-ratified deterministic lifecycle policy (a CLAIM the supervisor reconciles
  against probed reality; never executed as content). Protected class → [`PROTECTED.md`](PROTECTED.md).
- `src/engine.mjs` — the PURE engine: closed envelope (`start/probe/stop/isolate/swap/contract/rollback/status`),
  phased boot, dependency ordering, #71 probe-before-swap/rollback, port-squat defense, idempotent + restart-safe plans.
- `src/supervisor.mjs` — owner-CLI adapter (NO network control surface): observes, executes, receipts
  (`state/receipts.jsonl`, content-free). R47: the supervisor is the ONE lifecycle owner — it also owns the
  local Convex backend (3210) and the brain door (7141), and MINTS the per-boot mind-door token (R44 law:
  child env + one 0600 file under the gitignored `apps/brain/.local/organism/`; value never logged, never in
  a receipt, never served; stdout capture kept only as a pre-R44b fallback, and R51-unref'd so the one-shot
  CLI exits). **R51 process-group custody (issue #107):** every service is spawned as a `detached` group
  leader; the pid record (`state/<svc>.<port>.pid`, JSON `v1`) carries the wrapper pid, the **pgid**, and the
  **actual listener pid** captured after readiness — R50 twice-witnessed that the `npx` wrapper pid and the
  real listener diverge (and the Convex backend outlived its wrapper). `down` signals the whole owned GROUP
  (`kill(-pgid)`, SIGTERM→grace→SIGKILL), then a port-verified belt reaps any listener that escaped the group
  into its own session — **only when provably ours** (still in our group, or the recorded boot listener still
  holding our owned port); a foreign listener is neither, so it is reported (`residueForeign`), never killed.
  `down` then verifies **every owned port is empty**, receipting `teardown-verified` or a loud `teardown-residue`
  (non-zero exit). The **gateway** (`src/gateway.mjs`, started by the operator via `npm run gateway`) is a single
  in-process `node` listener — pid == listener, no wrapper indirection — so the wrapper/worker custody defect
  never applied to it; brought under supervision it is already a group leader and reaped by the same mechanism.
- `src/gateway.mjs` — the one external origin: declared interfaces only, same-origin preserved, **AUMLOK
  never fronted**, `/aukora/status` + `/aukora/receipts` read-only.
- `docs/CONSENT_SURFACES.md` — every ambient context that can trigger billed/governed work + its gates.

**Runtime lane (R51, evidence-only — no unsupported policy claim):** the supervisor lifecycle suite passes
`31/31` on Node 22 (`v22.23.1`) and on Node 26; `convexHold` declares supported runtimes `[18, 20, 22, 24]`
and side-installs Node 22 for the Convex subprocess when the ambient runtime is outside that set; the brain-door
bundle targets `node20`. Node 22 is therefore evidenced as a viable canonical runtime, with Node 20 remaining in
the declared compatibility set (the Convex `SUPPORTED` list + the door bundle target). Node 20 was not installed
on the box this round, so no Node-20 result is asserted here — only that it stays declared-supported.

```
npm run doctor  --workspace @aukora/supervisor   # read-only preflight (never-throw probes)
npm run up      --workspace @aukora/supervisor   # phased supervised boot
npm run gateway --workspace @aukora/supervisor   # the one external surface :7100
npm run swap    --workspace @aukora/supervisor -- spatial-shell   # #71 candidate swap (auto-rollback on failed probe)
npm run down    --workspace @aukora/supervisor   # clean reverse-order down
```
