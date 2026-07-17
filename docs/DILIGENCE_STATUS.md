# DILIGENCE STATUS — public diligence projection (R51 / #106)

The maximum safe **sanitized** projection of where Aukora actually stands, at head
`5aae90d6a84d2aedf9e5df3ebc5744d8b9c2fb7d`. Every claim here is backed by an in-repo artifact and a
gate; a Markdown document is never treated as proof. Sensitive titles, notes, paths, rationales, and
owner material stay in the private Symbiote ledger and are **not** reproduced here.

Four labels:

- **PROVEN** — canonical source + tests that execute it + a package export, green in `test:all`.
- **DEMONSTRATED** — an in-repo organism adapter exercised by tests with an explicit honesty caveat
  (governed demonstration, not a live production deployment).
- **PARKED** — designed/prepared but deliberately inert (no live calls, weights, spend, or authority).
- **MISSING** — a named gap with no current runtime counterpart; honest, and it blocks the next profile.

## PROVEN (pure packages, in-gate)

| Capability | Source | Tests | Export |
|---|---|---|---|
| Deterministic authority verification + reducer, canonical encoding, Merkle, registries, schemas, conformance vectors | `packages/kernel/src` (10 blob-pinned) | kernel (21) + conformance | `@aukora/kernel` |
| EvidencePack schema, JCS canonical JSON, domain-separated digest; confusable-resistant secret scanners | `packages/evidence/src` | evidence | `@aukora/evidence` |
| KIRA memory law: content-addressed envelope, deterministic recall, governed forgetting (content-free tombstone) | `packages/memory/src` | memory (17) | `@aukora/memory` |
| Pure reasoning-loop organ (reply parse, bounded plan grammar, rigid-move law, rollout, trace) | `packages/mind/src` | mind (51) | `@aukora/mind` |
| Advisory council (served-model verification, quorum, spend, claim-basis freeze); glyph perception | `packages/council/src` | council | `@aukora/council` |
| Persistent daily spend ledger | `packages/council-node/src` | council-node | `@aukora/council-node` |
| Continuity truth-compiler (191 ledger ↔ Atlas ↔ anatomy ↔ current objects) | `scripts/verify-continuity.mjs` | `test/continuityGuards.test.ts` | gate |

## DEMONSTRATED (organism adapters, governed, not production)

| Capability | Source | Tests | Honesty caveat |
|---|---|---|---|
| Reactive receipt-chained memory + governed forgetting; production mind-door → **local** Convex persistence with real process-death acceptance | `apps/brain` | brain (171) | `convex-test` for determinism; the live path is **local/self-hosted** Convex, never managed cloud. #99 closed (PR #105/#110); durable-workflow hardening continues as **#108** |
| Governed inward-out recursion: propose → ground → rehearse → advisory review → refuse → hybrid AUMLOK gate → isolated candidate | `apps/seed` | seed (338) | effects stop at an isolated local candidate branch; never direct `main`, push, or merge |
| Read-only operator console (`apps/console`) over authority/memory/proposal/verdict/budget | `apps/console` | console (44) | renders a deterministic `DEMO_FIXTURE`; signs/applies/deploys/arms nothing |
| Donor Spatial shell (subtractive transplant, 46 VERBATIM blobs); R50/#101 CONSOLE organ removed from the visible roster (file retained) | `apps/spatial` | spatial (57) | donor code, not a recreation; doors are supervisor-owned and fail honestly offline |
| Supervisor lifecycle owner (envelope-closed, restart-safe, foreign-occupant safe) | `apps/supervisor` | supervisor (21) | protected-class; owns worker PIDs (**#107** hardening) |
| **ARC-3 dojo** — replayable reasoning proof over the donor's **onboard** worlds through `@aukora/mind` | `apps/spatial/arc3-dojo` | in spatial (57) | **ONBOARD_ARC3_COMPATIBLE only — never an official ARC-AGI-3 win.** Deterministic replay; mutating one action/frame/terminal breaks it |

## PARKED (prepared, deliberately inert)

| Item | Status | Note |
|---|---|---|
| **Inkling-NVFP4 on Nebius** | `enabled:false` | `models/nebius/inkling/inkling-nvfp4.serving.manifest.json` conforms; every reproducibility binding is a `REQUIRED_AT_PIN` slot; `validateNebiusManifest` refuses `enabled:true` without real 64-hex digests. No live model calls, weights, endpoint/job IDs, or spend. |
| G1 / Nebius canary | UNARMED | tracked at #15; no arm/deploy/canary/generation this phase |
| Nebius provider path | bounded + parked | `apps/brain/src/nebiusProvider.ts` fail-closed; no live calls |
| Tinker post-training | not a contract | separate future training contract; **no real transcript exists → nothing claimed** |

## MISSING (named gaps, honest)

| Gap | Anatomy entry | Note |
|---|---|---|
| Lingwa real-time translation lane | `lingwa-lane-realtime` (MISSING) | donor real-time lane has no current runtime counterpart |
| Duplex-voice supervised runtime | `duplex-voice-supervision` (RUNTIME_UNPROVEN) | files exist; default supervised reachability unproven |

## Wording corrections ratified this round (#106 req 10)

- **ARC:** the ARC-3 dojo (R50/#102) runs the donor's **onboard ARC-3-compatible** worlds. It is
  labelled `ONBOARD_ARC3_COMPATIBLE` and is **never** an official ARC-AGI-3 result. An official run
  needs a machine-local ARC key + the official harness + retrieved platform scorecard — none present.
- **Fugu ≠ Inkling.** **Fugu Ultra** is an *external* model whose governed-crossing report is being
  *qualified only* under skunkworks **#98** — not an Aukora capability. **Inkling** (`thinkingmachines/Inkling-NVFP4`)
  is the *parked* frontier-cortex serving manifest (`enabled:false`). They are different things; neither
  is deployed. Do not conflate the #98 Fugu qualification with the parked Inkling manifest.
- **Convex:** the proven live path is **local/self-hosted** Convex, never managed cloud. R50 landed
  production first-create durability + real process-death (#99 closed); #108 continues durable workflows.
- **#87 vs #99/#108:** #87 was closed for the **nonce mislabel only**. Production first-create
  **durability** is the separate track #99 (landed) → #108 (open). #87-closed ≠ durability-proven.
- **Nebius:** every Nebius surface is **PARKED / UNARMED**. No spend, no live inference, no managed cloud.
- **Test total:** **869 passing** at this head (was stated 774) — gated by `verify-continuity.mjs`.

## Set-equality result (#106 req 1–2)

Preservation ledger = **191** historical issues: **169** `aukora-symbiote` + **13** `aukora-kernel` +
**9** `aukora-fu`. Kernel and fu number sets proven **equal** to live GitHub; Symbiote **169 settled by
owner ratification** (numbers/titles private). Zero missing, zero ledger-only. Atlas refreshed to **301**
rows through current object **#110**; freshness anchored by `docs/atlas/CURRENT_OBJECTS.json`.
