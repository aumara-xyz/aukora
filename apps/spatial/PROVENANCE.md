<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# apps/spatial — subtractive transplant provenance

This app is the **donor Symbiote Spatial application** (`aukora-symbiote/spatial/`), transplanted into the
monorepo under the R34 owner correction (issue #23): **not redesigned, not reimplemented — the exact
existing code**, reduced to the required roster.

- **Donor repo:** `github.com/aumara-xyz/aukora-symbiote`
- **Donor commit:** `41707f910d10696482c28ee80346c252a55e9d41` (clean checkout at transplant time)
- **Manifest:** [`provenance.json`](provenance.json) — one entry per file with donor path, donor git blob id,
  sha256, and status. Verified byte-identical against the donor blobs on the transplant box
  (`npm run verify:provenance`, 91/91); CI re-checks the sha256 pins (`test/transplant.test.mjs`).

| status | count | meaning |
| --- | --- | --- |
| VERBATIM | 91 | byte-identical to the donor blob — shell chrome, style.css, thirds state machine, chats lane, all organs (incl. removed-from-menu ones), map, voice (aumalive), Lingwa, AUMLOK ceremony UI, aura, kira, ghp, App-Lab/KNVS law, assets |
| ADAPTED | 1 | `app/shell.js` — registry/menu subtracted to the R34 roster + one import for the CONSOLE organ. Imports, `{a,d}` thirds state machine, corners, mobile, chat wiring, boot: untouched |
| NEW | 5 | ours, not donor: `app/console.js` + `app/console/*` (CONSOLE center-pane organ from the apps/console evidence) and `scripts/launch.mjs` |

## Roster (registry after subtraction)
▲ `aumalive` (AUMA LIVE — donor full-duplex voice), `auma` (AUMA LINGWA — donor Lingwa app) ·
■ `aumlok`, `aura`, `kira`, `map`, `ghp`, `console` (NEW), `settings` ·
● `app-lab` (KNVS — donor safe-lab law, continuity keys `app-lab`/`aukora-canvas-last`).

Unselected donor organs (council, status, forge, media, luminara, graticube, wolf, aukora-xyz, arc3,
browser) were removed **from the registry/menu only**; their files remain in the tree, byte-identical.

## Runtime boundaries (loopback adapters — donor doors, unchanged)
The app keeps the donor's own service endpoints: `:7091` chat door · `:7092` voice sidecar ·
`:7094` AUMLOK approval gate · `:7095` AUMLOK binding door. Custody and signing stay in those local doors;
this app and its launcher never hold a key. The launcher (`npm run launch`) is static-only, canonical
`127.0.0.1:7096`, and **reserves 7090–7095** so it can never shadow the donor stack — note the grounded
correction: R34 said the launcher "may scan 7094–7099", but 7094/7095 are the donor's AUMLOK doors, so the
scan window here is 7096–7099. Same-origin `/api/*` answers 503 so donor organs show their loud offline
states. Convex stays entirely local; no cloud, no paid inference.
