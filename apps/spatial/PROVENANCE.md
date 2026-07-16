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
| VERBATIM | 46 | byte-identical to the donor blob — shell chrome, style.css, chats lane, map, voice (aumalive closure), Lingwa closure, AUMLOK ceremony UI (+mock), aura, kira/organs, ghp, App-Lab/KNVS law, operate, assets |
| ADAPTED | 10 | `shell.js` (registry subtraction + dead-import removal), `chat.js`/`settings.js`/`aumalive.js` (R39: SAME-ORIGIN — the launcher proxies to the governed mind door :7097 with the per-boot token server-side; the browser never holds it; donor :7091/:7092 dialable nowhere), `aumalive-audio.js` (comment), plus the R38 voice sidecar retargets (`voice/sidecar.py` → :7098 + NEW-shell origins; `voice/test_*` + `voice/README.md` → :7097/:7098). Nothing else changed in any of them |
| NEW | 7 | ours, not donor: `app/console.js` + `app/console/*` (CONSOLE center-pane organ), `scripts/launch.mjs` (canonical-door client + statics), `scripts/verify-provenance.mjs`, and R39's `voice/test_full_turn.py` (the speak→mind→speak harness). R38 adds `voice/` — the donor voice sidecar transplanted (VERBATIM `requirements.txt`/`run.sh`/`setup.sh`/`.gitignore`; ADAPTED per above); its runtime `.venv/`+`models/` are gitignored local artefacts |
| EXCLUDED | 45 | R37 reachability subtraction from the selected roots — unreachable product organs and dev artifacts (agora, wolf/*, arc3/*, luminara*, graticube*, media, browser, forge, morph, aukora-xyz, knvs-duplex/test, onboarding, focus, translate, shearfield, *.d.ts, unused css/json) removed from the tree; donor path/blob/sha256 retained per entry |

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
