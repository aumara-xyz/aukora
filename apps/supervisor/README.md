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
  a receipt, never served; stdout capture kept only as a pre-R44b fallback). `organism-ctl` now delegates here.
- `src/gateway.mjs` — the one external origin: declared interfaces only, same-origin preserved, **AUMLOK
  never fronted**, `/aukora/status` + `/aukora/receipts` read-only.
- `docs/CONSENT_SURFACES.md` — every ambient context that can trigger billed/governed work + its gates.

```
npm run doctor  --workspace @aukora/supervisor   # read-only preflight (never-throw probes)
npm run up      --workspace @aukora/supervisor   # phased supervised boot
npm run gateway --workspace @aukora/supervisor   # the one external surface :7100
npm run swap    --workspace @aukora/supervisor -- spatial-shell   # #71 candidate swap (auto-rollback on failed probe)
npm run down    --workspace @aukora/supervisor   # clean reverse-order down
```
