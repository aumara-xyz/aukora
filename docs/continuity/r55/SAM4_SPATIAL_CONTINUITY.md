<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# SAM 4 · R55 — Spatial continuity snapshot (`apps/spatial` @ `:7096`)

**Lane:** Sam 4 · **Issue:** #23 · **Base:** canonical `main@1394321fffd5de6296d44423d097e4e6199ab62b` ·
**Donor (owner-approved Symbiote source):** `41707f910d10696482c28ee80346c252a55e9d41`

## What `apps/spatial` is right now — and is not

`apps/spatial` boots the transplanted Spatial shell at `:7096` beside the untouched donor at `:7090`. It is a
**qualified donor transplant** — donor bytes, verbatim where shipped, with a small, tracked boundary
adaptation and a few new-organism files. It is **not** final `:7090` parity: 45 donor surfaces are excluded
by design and await owner-sequenced restoration. This snapshot states the current split exactly. No redesign,
no broad `:7090` merge, no aliveness/production-grade/identity claims — this is a continuity ledger, nothing more.

## Current disposition counts (authoritative: `apps/spatial/provenance.json`, schema `aukora-spatial-provenance-v2`)

| disposition | count | meaning |
| --- | --- | --- |
| **VERBATIM** | **46** | byte-identical to the donor blob in `41707f91` (sha256-pinned) |
| **ADAPTED** | **10** | ours; carries only the noted boundary change (registry subtraction / new-organism door endpoints), self-pinned |
| **NEW** | **8** | ours; no donor origin (Console organ, launcher, verifier, full-turn voice test) |
| **EXCLUDED** | **45** | unreachable from the selected roots — removed from the tree, donor path/blob retained so the owner can ship them as a later brick |
| **total tracked** | **109** | |

**Visible roster: 9 organs** (Console retained on disk but removed from the visible roster per the R50 owner
action). System: AUMLOK · AURA · Kira · Spatial Map · Golden Horizon · Settings. Apps: Auma·Live · Auma·Lingwa.
Yours: + New App.

## Frozen seams (do not move without an owner/Sam-2/Sam-3 contract change)

- **Ports.** `:7096` this shell (fallback `:7099`) · `:7097` the new organism's chat/mind door · `:7098` the
  voice sidecar (`apps/spatial/voice`, loopback-only, Origin-checked, zero egress) · `:7141` the canonical
  brain projection/control door (`apps/brain/src/localDoor.ts`, read over HTTP, **never bound here**).
  `7090–7095` are the donor's own doors — **reserved, never auto-bound**.
- **Projection seam.** `/api/spatial/projection` is a reactive per-request read of the canonical brain door.
  No generated JSON is ever served as live; a door outage returns a **loud 503** and the Console strip flips to
  an explicit `OFFLINE` label — never stale-as-live.
- **Display never authorizes.** Every projected value is `displayOnly:true` / `feedsApply:false`; there is no
  `grantsAuthority:true` anywhere in the payload, and the client re-checks the fence and refuses a projection
  that claims authority.
- **The one adaptation boundary.** `app/shell.js` is the ADAPTED registry (roster subtracted); unselected
  organs are removed from the menu only, their files retained. `app/chat.js`, `app/aumalive*.js`,
  `app/settings.js` carry the door-endpoint / same-origin-proxy adaptations; `app/settings.js` also carries the
  **R55 correction** below.

## R55 change in this snapshot

`app/settings.js` previously told users the terminal alternative was a `core/.env` file. That path does not
exist in this repo, and `.env` is not git-ignored — the guidance pointed at a nonexistent, unignored location.
The OpenRouter key is in fact saved by the Settings card itself, held machine-local by the local door
(`/api/settings/openrouter` via the launcher proxy); nothing reads `core/.env`. The hint now states the true,
machine-local behaviour. `provenance.json`'s `settings.js` sha256 pin + note are updated in the same change;
the file was already **ADAPTED**, so the 46/10/8/45 split is unchanged.

## Next donor-first UI restoration slice (proposed, owner-sequenced)

The smallest honest next brick is the **first-run onboarding + focus overlay**, currently EXCLUDED:

| donor file | donor blob | restore as |
| --- | --- | --- |
| `spatial/app/onboarding.js` | `cc306c85c2` | **VERBATIM** (donor bytes, sha-pinned) |
| `spatial/app/focus.js` | `a600bf47d8` | **VERBATIM** (donor bytes, sha-pinned) |

This is a pure donor-restoration slice — no redesign — flipping two files EXCLUDED → shipped (46→48 VERBATIM),
re-wiring their imports from the selected roots, and updating the provenance manifest + roster test. It stays
inside the transplant contract and touches no door, port, or authority seam.

## Acceptance gates (visual + runtime)

- **Provenance integrity** — `npm run verify:provenance` (donor-box) + `apps/spatial/test/transplant.test.mjs`:
  every SHIPPED file hash-matches its pin; every EXCLUDED file is absent with donor blob retained; roster is
  exactly the 9 visible organs.
- **No dangling imports** — reachability closure from the selected roots resolves every static `/app/*` import
  to a file (tree == manifest); zero dangling references after subtraction.
- **Boundary/egress** — non-loopback `fetch` exists only in unselected organs (unreachable); no key-shaped
  material in the app (`transplant.test.mjs` asserts no `OPENROUTER_API_KEY=` in source).
- **Coexistence** — donor `:7090` `200` and transplant `:7096` `200` simultaneously; donor untouched.
- **No-overclaim fence** — `apps/spatial/evaluator/no-overclaim.mjs` green over all tracked docs (part of
  `npm run test:all`).
