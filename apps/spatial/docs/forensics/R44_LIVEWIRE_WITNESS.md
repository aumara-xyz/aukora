<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# R44 — independent live-wire witness (main `d0bb625`)

Transcript: [`R44_LIVEWIRE_TRANSCRIPT.log`](R44_LIVEWIRE_TRANSCRIPT.log) — sha256 `0c078d9e715e165f0bfc219aee767c0b77f25deccac78404f6e71fca38ebf9c2`, content-free (hygiene-scanned: no emails, no token, only content-free receipt hashes).

## Pinned current failure (operator-token / compose boundary)
Reproduced on clean main: under `organism:up`, a chat POST via `:7096` refuses `missing or bad local POST token` — `organism-ctl.mjs:162` spawns Spatial with `PORT` only and captures no mind-door stdout, so the one-time token is **unobtainable under organism-ctl**. Refusal is loud and receipted; the token is never disclosed. (Sam 2's bounded fix: no branch/issue visible on origin at witness time — this evidence stands independently.)

## The live wire (assembled from each lane's real entrypoints, no forged shortcut, no new wrapper)
`local:hold` (persistent Convex — **note: `local:up` deploys-then-EXITS; hold is the serving mode**) → `doorServerMain` (`:7141`, `x-aukora-source: live`) → `apps/supervisor up` (token handoff in memory) → gateway `:7100`.

| witnessed | result |
| --- | --- |
| chat turn via gateway | model-free answer end-to-end; token enforced server-side, never held by browser/gateway |
| `/api/propose` + `/api/materialize` via gateway | **loud undeclared-interface refusal** (enumerated declared list); door events unchanged — the attempt never reached the door. **The exact remaining link:** under supervised boot, the write-shaped door routes are reachable by NO running surface (token lives only in the launcher env; launcher proxies only chat/presence/lockdown). Declaring them at the gateway is an owner ruling — routing must not become authority |
| direct `:7097` propose, NO token | `guard:missing-or-bad-token` + eventReceipt — **receipt BEFORE any effect**; door events 0→2 (chat, refusal) |
| candidate isolation | no `aukora-door-candidates` dir ever appeared — nothing materialized |
| projection ↔ store | `:7141 /snapshot chainLength:0` == projection `source:"door" · degraded:[] · chainLength:0` — **the visible state IS the store state** |
| bounded shutdown | supervisor down (owned PIDs) → door → `local:down`; all five ports freed |
| donor `:7090` | HTTP **200 before and after** — untouched, independently available |

## Live catch fixed in-lane (my Wave-2 component, minimal + tested, protected re-pin same commit)
`apps/supervisor` crashed mid-plan when an OPTIONAL service's spawn path was absent (voice `.venv` not on a clean tree): the child's async `error` event was unhandled → the lifecycle owner died → Spatial never started (receipts ended at `started voice-sidecar`). Fix: handle the spawn `error` event; the readiness probe then reports `not-ready` and optional services **degrade loudly instead of killing the plan**. Regression test added (17/17). Witnessed post-fix: voice `not-ready` → plan continued → full wire green.

## Demo-card corrections (for the Wave-3 card)
1. Persistent backend = `npm run local:hold` (not `local:up`) when running the door outside `organism-ctl`.
2. The supervisor path (mind+spatial+token+gateway) and `organism-ctl` (convex+door) currently COMPOSE; the lifecycle-owner merge ruling from Wave 3 stands.
