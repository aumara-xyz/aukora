<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# WAVE 3 — live local demo card (witnessed on main `486322f`)

**For Peter. Everything below was executed and witnessed from a clean worktree on 2026-07-16; transcript:
[`WAVE3_DEMO_TRANSCRIPT.log`](WAVE3_DEMO_TRANSCRIPT.log) (sha256 `95498ae755d4c735c340a0989b9f8075f55b1a3e95f108660370847f5a513caa`, 40 timestamped steps, content-free).**

## 0 · One-time preflight (fresh clone/worktree only)
```
npm ci && npm run build --workspace @aukora/kernel
```
*(The kernel build is MISSING LINK 1 — see below. Node 22 side-install is present on this box; `organism:up` engages it automatically.)*

## 1 · One start command
```
npm run organism:up --workspace @aukora/brain
```
Boots, in order, with readiness probes: local Convex (`:3210/:3211`) → **brain door `:7141` (HELD)** → mind door `:7097` → voice `:7098` (optional; degrades LOUDLY if the sidecar venv isn't on this tree) → Spatial `:7096`.
Optional one external surface: `npm run gateway --workspace @aukora/supervisor` (adds `:7100`).

## 2 · One headless proof command
```
npm run organism:status --workspace @aukora/brain
```
Exit 0 iff core healthy; prints per-service `pid (verified) · port listening=true`.

## 3 · Exact local URLs
| URL | what |
| --- | --- |
| `http://127.0.0.1:7141/health` | canonical brain door (answers with header `x-aukora-source: live`) |
| `http://127.0.0.1:7096/` | Spatial shell (donor UI) |
| `http://127.0.0.1:7096/api/spatial/projection` | **LIVE projection** — witnessed `source:"door"`, `degradedSenses:[]`, real Convex snapshot behind it (first fully-live projection on record) |
| `http://127.0.0.1:7100/aukora/status` · `/aukora/receipts` | the one gateway's status + receipt surfaces |
| `http://127.0.0.1:7097/api/door` | mind door status (lockdown state, event count) |

## 4 · What observably changes
- `organism:up` → five ports go from free to verified-listening; the projection flips from loud-503 to `source:"door"`.
- Any POST to `/api/chat` → the mind door's `events` count grows (witnessed 0→1) — **even refusals are receipted**.
- `organism:down` → all ports freed, pidfiles + lock cleared (witnessed).

## 5 · One shutdown command
```
npm run organism:down --workspace @aukora/brain
```
Reverse-order SIGTERM to recorded, ownership-verified PIDs only. Witnessed: every port freed; donor `:7090` answered HTTP 200 before AND after (untouched, independently available).

## 6 · Honest truth labels
| surface | label |
| --- | --- |
| Convex + brain door `:7141` + projection | **LIVE** (first time; `x-aukora-source: live`) |
| Mind door `:7097` chat | **LIVE, MODEL-FREE** (KIRA memory fallback; no provider configured; speech-to-speech NOT claimed) |
| Spatial shell `:7096` | LIVE UI; CONSOLE strip live; DEMO_FIXTURE panels below it remain **FIXTURE-BACKED, labelled "not live"** |
| Voice `:7098` | **PARKED on this tree** (optional; venv lives on the r29-console checkout; degrades loudly) |
| Gateway chat turn (`:7100 /api/chat`) | **BLOCKED-BY-DESIGN today** — refuses `missing or bad local POST token` (fail-closed, receipted). MISSING LINK 2 |
| AUMLOK `:7094/:7095` | untouched local ceremony doors; gateway REFUSES to front them (403 + law) |
| Supervisor swap/rollback | LIVE (Wave-2 proofs), not re-run this hour |

## Missing links (exact, for Sam 1 — no duplicates built)
1. **`organism:up` has no workspace-build preflight**: on a clean tree, convex deploy fails bundling `@aukora/kernel/merkle` (exports → `dist/`, no dist yet). One line fixes it (build kernel before deploy) — workaround documented above.
2. **`organism-ctl.mjs:162` starts Spatial with `PORT` only** — the mind door's one-time POST token is never handed over, so gateway/browser chat turns refuse (loudly, receipted). `apps/supervisor` already implements the in-memory token handoff (Wave 2); **two lifecycle owners now overlap on main** (checkout-scoped `organism-ctl` vs policy-scoped `apps/supervisor`) — needs an owner ruling/merge rather than a third wrapper.
