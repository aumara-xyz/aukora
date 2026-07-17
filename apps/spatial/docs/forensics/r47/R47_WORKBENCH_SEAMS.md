<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# R47 — Spatial workbench seams (donor-faithful, no redesign)

- **Canonical base:** `main@937003ea4d53b6a360a4e29a87c16a4984db9ecd` (PR #83 merged).
- **Principle:** the donor shell already renders the inside-out loop. R47 wires the **minimum truthful seams** into the **existing** `launch.mjs` proxy so the donor organs (`aumlok-signing-assistant-v1`, `/api/kira`, `/api/status`) show REAL door/repo state. **Zero donor UI files changed** — `aumlok.js`/`organs.js` are byte-identical; only the NEW launcher gained seam routes. No second console.
- **Evidence:** [`r47-aumlok-live-proposal.jpg`](r47-aumlok-live-proposal.jpg) — the donor AUMLOK organ mounted, "observer only · live", **"At the gate · 1 waiting"** = a live proposal proxied through the workbench.

## The six seams (all witnessed live; transcript below)
| seam | route (served by `launch.mjs`) | truth shown |
| --- | --- | --- |
| repo fingerprint | `GET /api/status` | `state=SIGHTED head=937003ea4d53 branch=… dirty=1` (read-only git; "not promotion-ready: a fingerprint, not a gate") |
| repo read (fenced) | `GET /api/repo/read?path=` | `apps/spatial/package.json` → 714 bytes; **`.env` → 403 refused** (donor #44 law: repo-scoped, no traversal, no secret-shaped paths) |
| repo search (fenced) | `GET /api/repo/search?q=` | `materializeShellModel` → 5 bounded `git grep` hits, deny-filtered |
| pending intents + rehearsal | `POST /api/propose` → display ledger → `GET /api/aumlok` | a real submission returned `ok=false phase=refused-at-owner reasonClass=refused-ungrounded` and surfaced in the donor gate with **affected path** (`docs/r47-teachback.md`), **exact hash** (`cf72a94f5623`), **risk/refusal** (`refused-ungrounded`), **Fu advice** (`none supplied`), **test state** (`refused`), and hard-false `signed/pushed/touchedMain` — an honest refusal, not a fake green |
| KIRA citations | `GET /api/kira` | live shape from the brain door `/snapshot`+`/health` (atomCount/receiptCount/chainLinked); brain door down → **honest `present:false`** "start it and reload" |
| Fu advisory | carried in the propose body (`fuSidecar` bound by `proposalHash`) → risk line | advisory only; the door refuses a Fu outcome that claims authority (`door:fu-authority-claim`) |
| AUMLOK status | `GET /api/aumlok` | `keyPresent:false` truthfully ("custody: owner terminal (never here)"), `publicRootPinned` from door liveness — **never key bytes** |

## Approval seam (submits owner authorization; never holds/creates the key)
`POST /api/aumlok/approve` takes an **already-produced** `candidateAuth` JSON (owner runs the terminal ceremony), reconstitutes the ledger's `proposalInput`, and relays to the door's explicit `/api/materialize`. It refuses without `candidateAuth` ("this surface never creates it") and deletes the ledger row only on `ok:true`. The launcher never mints, holds, or logs a signing key — custody stays in the owner terminal, exactly like the donor's cross-origin `:7094` gate.

## Content-free transcript (this run)
```
/api/status   → SIGHTED · head 937003ea4d53 · branch sam/r47-spatial-workbench · dirty 1
/api/repo/read .env            → 403 refused (secret-shaped)
/api/repo/read package.json    → 714 bytes, truncated=false
POST /api/propose r47-teachback-note → ok=false phase=refused-at-owner hash=cf72a94f… reason=refused-ungrounded
/api/aumlok    → schema aumlok-signing-assistant-v1 · pending 1 · grantsAuthority false
                 • cf72a94f5623 | r47-teachback-note | files [docs/r47-teachback.md] | valid false | risk refused-ungrounded · Fu none
/api/kira      → present=false (brain door reachable check) / live shape reads snapshot+health when up
/api/repo/search materializeShellModel → 5 hits (first: shell-registry.js:43)
DOM: AUMLOK organ → "observer only · live" · "At the gate · 1 waiting" · "no key yet" (honest)
donor :7090 → HTTP 200 before and after (untouched)
```

## Auma Live / Lingwa (assessed separately, per directive)
- **AUMA LIVE:** unchanged; verified in R38/R39 via the supervised existing sidecar (`:7098` same-origin proxy). No voice rewrite this round.
- **AUMA LINGWA lesson app:** the transplanted donor Lingwa lesson organ (`auma/auma.js` + `canon-v16.json`) is byte-identical and mounts — unrelated to the lane below.
- **donor `spatial/lingwaLane.ts` — OWNER-DEFER (explicit, non-blocking).** Boundary PROVEN this round: it is a **chat-door decorator** (imports only `fs`/`path`; derives teaching context from `canon-v16.json` at send time; "injected here… for the chat door (voiceLane)"). Its exact hook point is the chat turn-assembly of the door — which on main is `apps/seed`'s `/api/chat` (Sam 3's lane), and no injection seam exists there yet. **Voice dependency:** none at module level (works with "any voice model"); the dependency is on the CHAT path, not voice. Porting it means adding a canon-injection hook to the seed chat door — beyond R47's "minimum seams," and it does not block the inside-out ceremony. Deferred to an owner-scoped round that owns the seed chat path.
