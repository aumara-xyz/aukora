<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# WAVE 1 — Complete Symbiote organism forensics (READ-ONLY)

- **Donor:** `github.com/aumara-xyz/aukora-symbiote` @ `41707f910d10696482c28ee80346c252a55e9d41` (the untouched checkout at `/…/aukora-symbiote`, live `:7090` canonical evidence)
- **Main under audit:** `b38d625697470c9da11afdab106c800260245bf8`
- **Method:** every one of the donor's **1139 tracked files** was classified by git-blob identity against main's full tree (identical content ⇒ identical blob id), joined with the spatial transplant provenance (v2) and a hand-audited supersession list. Machine manifest: [`wave1-inventory.json`](wave1-inventory.json) (one entry per donor file: path · blob · status · counterpart · note).
- **This wave changed NO runtime file** — no Spatial edit, no prune, no redesign, no implementation. Docs only.

## 1–2 · Disposition counts (full-organism, blob-level)

| status | count | meaning here |
| --- | --- | --- |
| EXACT_PORT | 46 | byte-identical at the mirrored path `spatial/<x>` → `apps/spatial/<x>` (the R34–R37 transplant VERBATIM set) |
| ADAPTED_BOUNDARY | 10 | byte-divergent ONLY at declared boundaries (ports/origins/same-origin proxy; every edit named in provenance v2 notes) |
| MOVED_UNCHANGED | 13 | byte-identical at a different path — the Fu council slice (`core/src/aukoraFuSpendLedger.ts` → `packages/council-node/src/…`, council tests + fusion-reply fixtures → `packages/council/test/…`), `auma-lingwa/auma-canon-v16.json` → `apps/spatial/app/auma/canon-v16.json`, the AUMARA icon → `apps/spatial/assets/aumara-icon.png`, LICENSE |
| SUPERSEDED_WITH_COMPARATIVE_PROOF | 1 | `spatial/chat-serve.ts` → `apps/seed/src/mindDoor.ts`: the donor door **LAW** (serialized single-driver chain, lazy honest boot, origin+token guards, lockdown short-circuit, model-free memory fallback, bounded receipts) is ported and proven — `apps/seed/test/r38.mind-door.test.ts` green, plus the R39 full speak→mind→speak turn PASS. The donor door's **model routing and identity-anchor injection are NOT part of this proof** (they are MISSING — see §MISSING) |
| EXCLUDED_BY_PETER | 0 donor files | the only owner exclusion is **Console** (WAVE1 §7), which is a monorepo-side organ, not a donor file. **No other exclusion is inferred** |
| MISSING | 1069 | no byte or proven counterpart on main — the honest headline (profile below) |

## 3 · Explicit inventory of everything previously pruned

The R37 round directive ordered a reachability subtraction of the Spatial runtime tree. **45 donor spatial files** were pruned then; every one keeps donor path/blob/sha256 in [`../../provenance.json`](../../provenance.json) with status `EXCLUDED`. Under WAVE 1 vocabulary they are classed **MISSING** (with a "pruned by R37 directive" note), because §7 permits inferring no owner exclusion beyond Console. They are, grouped:
- **Product organs:** `app/agora.js` (+css) · `app/wolf/*` (4) · `app/arc3/*` (5) · `app/luminara.js`+`luminara-data.js`(+css) · `app/graticube.js`(+`graticube-lab.js`) · `app/media.js` · `app/browser.js` · `app/forge.js` · `app/morph.js` · `app/aukora-xyz.js` · `app/shearfield.js` · `app/onboarding.js` · `app/focus.js` · `app/translate.js`
- **Dev/duplex artifacts:** `app/knvs-duplex.js` · `app/knvs-test.js` · `app/map/layout.worker.js` · every excluded organ's `.d.ts`/`.css`/`.json`
Nothing else was ever silently excluded; the R30–R33 console-era files live under `apps/console` (owner-excluded organ, retained as evidence).

## 4 · Core intelligence vs Spatial embodiment (the separation)

| layer | donor systems | on main today |
| --- | --- | --- |
| **CORE — identity/continuity** | `identity/` (anchors deliberately WITHHELD: real PII; mechanism ships, story stays private) · `spatial/identityAnchor.ts` (hash-verified anchor boot; fails LOUD, absence ⇒ "laws without private story") · `~/.aukora-symbiote/` custody home | MISSING (mechanism + custody both) |
| **CORE — authority/custody** | `authority/` (17): AUMLOK ceremony+wordlist, gate (`aukoraGate.ts`, `governedToolBoundary.ts`, risk vectors, sensitive policy, integrity sha), chokepoint (trusted-execs manifest+sha256), egress sandbox, `symbiotePaths.ts` | semantic descendant only: `packages/kernel` (authority schemas) — **no byte port, no gate/chokepoint/egress counterpart** |
| **CORE — intelligence** | `core/src` (203 modules: Fu council/engine, active-inference loop, AUMLOK v2 lifecycle/ceremonies/ledgers, proposers, ACCL/self-mod, rehearsal, ledger-join…) + `core/tests` (276) | 5 name-level matches; byte-identical only the Fu spend-ledger + council tests/fixtures slice. New-organism rewrites (`packages/kernel/council/evidence/memory`, `apps/seed`) are **descendants, not ports** |
| **CORE — memory** | `memory/` (9: `chain.ts`, `cli.ts`, embedder, runtime) + `convex/aumlokMemory.ts` etc. | rewritten as `apps/brain` + `packages/memory` (content-free chain law preserved by design, no byte lineage) |
| **CORE — runtime/receipts (Convex)** | `convex/` (54: core, merkle log, PQC signer, receipts, signed head, rate limit, action registry, token, dojo…) | MISSING (apps/brain uses its own local Convex schema) |
| **BOUNDARY — embodiment doors** | `spatial/*.ts` server adapters (~30): `serve.ts` (7090 + 11 `/api/*` engine surfaces: graph/status/kira/aumlok(+history)/brain/loop/node/council/site-data/events) · `chat-serve.ts` (7091) · voice/lingwa/presence/fusion lanes · `frameGuard.ts` · capability mode/preamble · arc3/aumlok/agora serves · drain/deploy/shadow/self-mod capture | 1 SUPERSEDED (chat-serve LAW→mindDoor), the rest MISSING; my launcher serves only projection/graph/chat-proxy — **10 of the donor's 11 engine surfaces have no counterpart** |
| **EMBODIMENT — Spatial phenotype** | `spatial/app` + `assets` + `voice` (the shell, organs, duplex sidecar) | the transplanted set: 46 EXACT + 10 ADAPTED + 45 pruned (above) |
| **PERIPHERY** | `docs/` (228, incl. SAFETY_LAWS.md), `scripts/` (72), `GHP/` (canon/plans/reviews/runs), `dashboard/`, `lander/`, `website/`, `probes/` (30), `deferred-tests/` (48), `auma-lingwa/` lessons, `dojobrain/`, `fusion/`, `receiver/` | MISSING (inventoried per-file in the JSON) |

## 5 · Secret-shaped / custody material (recorded, contents NOT published)

| what | where | shape |
| --- | --- | --- |
| identity anchors | owner's home (`~/.aukora-symbiote/identity/ANCHOR.md` per voice README; repo `identity/` holds only the README law) | PII-bearing advisory text, hash-verified at boot; publish-denylisted |
| AUMLOK custody | `~/.aukora-symbiote/aumlok/` → `ceremony-journal.jsonl`, `hybrid-v2/` | ceremony journal + hybrid v2 key material (names only recorded here) |
| gate integrity | `authority/gate/.gate-integrity.sha256`, `authority/chokepoint/trusted-execs.sha256` | integrity pins for the protected class (#71's ACCL-write-forbidden set) |
| env/live state | `.env`, `.env.*` (gitignored: "the organism's keys/receipts/session live OUTSIDE git") | never tracked; none copied anywhere by any wave |
| voice model terms | kyutai/pocket-tts is HF-terms-gated | weights local-only after owner acceptance |

## 6 · Future `:7090` parity tests (DEFINED ONLY — no UI change this wave)

1. **Engine-surface parity:** for each of the 11 donor `/api/*` surfaces, a table-driven test asserting the new organism either serves a live equivalent or answers the loud labelled offline state — never a silent 404.
2. **Organ-mount parity:** headless mount of every roster organ on `:7090` and `:7096`, diffing organ title, subtitle, and first-paint state text.
3. **Thirds/corners law parity:** replay `[ ] , .` and corner clicks on both ports; assert identical `{a,d}` sequences and `lane-settled` timing.
4. **Voice-pill/chat-controls parity:** donor chat controls (threads, composer, attachments as typed envelope channels, voice pill roster, fusion-council entry) present and same-shaped on both.
5. **Duplex parity:** `test_full_turn.py` run against donor (7092/7091) and new (7098/7097) stacks; compare frame vocabularies (`ready/vad/final/tts_begin/tts_end/tts_cancelled`) and abort behavior.
6. **Truth-label parity:** the new stack must label model-free/duplex-feel/speech-to-speech honestly wherever the donor had a live model (no silent capability claims either direction).

## 8 · Donor continuity issues + supervisor/doctor design

- **[#71 — ACCL v1.1 B: supervised server swap with health-check rollback](https://github.com/aumara-xyz/aukora-symbiote/issues/71)** (OPEN): a small protected supervisor owns server lifecycle; supervisor binary/config are **ACCL-write-forbidden** (same protected class as gate/signer); server-layer changes boot a fresh process on an alternate port, probe liveness+contract, swap on pass / rollback on fail, receipts both ways with old/new commit hashes; lazy-import staleness solved by process-fresh boot. Invariant: a bad server change can never take the portal down, and the supervisor can never be modified through ACCL.
- **[#26 — local node supervisor + receipt explorer](https://github.com/aumara-xyz/aukora-symbiote/issues/26)** (OPEN): ASI-chain reviewed as *inspiration only* — keep the local-ops patterns (one launcher, phased health checks, observer/read-only surfaces, indexer/receipt-explorer over proposals/sandbox runs/Fusion reviews/Kira captures/AUMLOK rehearsals, service-role map) and explicitly do NOT port consensus/tokens/code/keys or add network surface without its own issue.
- **Shipped doctor design** (`scripts/doctor.ts` + pure `doctorChecks.ts`, Eagle Eye #86): read-only cross-platform preflight — never-throw host probes handed to a pure evaluator; installs nothing, changes no authority, prints no keys/env/usernames/paths; port set {3210, 7089–7095}. `start-node.ts`/`start-mac.command`/`start-windows.bat` are the phase-launcher half. **Together these are the organism-continuity kit the monorepo does not yet have.**

## ADDENDUM · Morphing phenotype, not core authority

**The donor already ships the dynamic-mount mechanism:** `app/app-registry.js` defines `aukora-app-contract-v1` (validated organ key, `/app/*.js` entry regex, tab placement restricted to `yours`) and pure `mergeAppContracts`; `app/shell-registry.js#materializeShellModel` folds contracts into the built-in ORGANS/TABS **without mutating them**, resolves mounts by dynamic `import()` with a safe in-shell load-error organ. `APP_CONTRACTS` is deliberately empty at boot ("Yours is reserved for work a person grows"). KNVS continuity keys (`app-lab`, `aukora-canvas-last`) persist a grown app across sessions. **The body can already morph from registry/state; nothing in the mechanism can touch identity, receipts, or lifecycle — a contract only adds a menu row + sandboxed mount.**

### Per-organ records (core capability · health shown · closure/keys · absence behavior · cannot-authorize proof · removable?)

| organ | core capability consumed | health/readiness shown | dependency closure + continuity keys | when core is absent/stale/isolated/recovering | display-cannot-authorize proof | removable without changing core truth? |
| --- | --- | --- | --- | --- | --- | --- |
| ▲ AUMA LIVE | mind door `/api/presence/stream` (via same-origin proxy) + voice sidecar ws :7098 | orb mode + toast (`model-free — …not speech-to-speech`), `fb` badge when duplex down | `aumalive.js`+`-audio.js`+`field-directives.js`; no storage keys | sidecar down → browser-STT fallback, "type to her"; door down → spoken "channel flickered" line; abort → `endTurn('cut')` | field tags stripped both directions, never in receipts; no write route exists on its path | YES — registry row only |
| ▲ AUMA LINGWA | none live (canon JSON + readers, self-contained) | lesson state in-organ | `auma/auma.js` + canon-v16 + readers.json | fully offline-capable | static content; no fetch to any door | YES |
| ■ AUMLOK | ceremony doors :7094/:7095 (donor's own, untouched) | live gate state or **labelled mock** ("never pretend mock is live") | `aumlok.js` + `mock/aumlok.js` | endpoint unreachable → mock + says so | display fetches status only; signing stays in the local doors; `grantsAuthority:false` throughout | YES — custody is outside the organ |
| ■ AURA | none this round (provisional glyph; donor trace door absent) | "provisional glyph stands, honestly" on unreachable | `aura.js` | provisional state persists | geometry/scores are display math; no authority input path | YES |
| ■ KIRA | brain-door projection (via `/api/spatial/projection`) | live counts or loud offline | `organs.js#mountKira` | offline → donor's own unreachable chrome | read-only sense; display-only fence re-checked | YES |
| ■ SPATIAL MAP | `/api/graph` (launcher-served, brain-door snapshot when up) | node/edge counts + "advisory" subtitle | `map/map.js` + renderer | graph 503 → donor "graph unavailable" line (healthy boot now serves 200) | labelled advisory; excludes-deferred-tests disclosure | YES |
| ■ GHP | none live (donor GHP engine not ported) | organ's own offline chrome | `ghp.js` | offline state stands | display only | YES |
| ■ CONSOLE (ours; owner-excluded organ) | projection + `/api/door` per-call re-check | LIVE/DEGRADED/OFFLINE strips + LOCKDOWN flip ≤2s + turn-mode truth | `console.js` + `console/*`; no keys | door down → OFFLINE strip; fixture stays labelled "not live" | client re-checks `displayOnly/feedsApply/grantsAuthority` and **refuses** a projection claiming authority | YES (and owner-excluded) |
| ■ SETTINGS | door status via same-origin | "unknown — read surface unreachable" fallbacks | `settings.js` | honest unknowns | reads only; key entry is donor-doors' business, never browser state | YES |
| ● KNVS (App-Lab) | none (sandboxed canvas law) | in-organ | `canvas.js` + contract registry; keys `app-lab`, `aukora-canvas-last` | fully local | `allow-scripts` sandbox + CSP; grown apps can't reach doors with authority | YES — contracts are additive rows |

**Proof for the addendum's authorize question, shell-wide:** the only write-shaped routes the embodiment can reach are the proxied `/api/chat` / `/api/presence/stream` / `/api/lockdown` — all guarded upstream by the mind door's origin+token wall and lockdown short-circuit, all `grantsAuthority:false`, and materialization requires a fresh in-process AUMLOK verification that **never trusts persisted or UI state** (mindDoor law). UI geometry, scores, model output, health state, and AURA display have no route by which to authorize anything.

## MISSING profile (the 1069, by system)

`core/` 479 · `docs/` 228 · `scripts/` 72 (incl. doctor/start kit) · `convex/` 54 · `deferred-tests/` 48 · `probes/` 30 · `spatial/` 75 (30 server adapters + 45 R37-pruned) · `authority/` 17 · `lander/` 14 · `dashboard/` 12 · `GHP/` 10 · `memory/` 9 · `auma-lingwa/` 4 (lessons; canon itself is MOVED) · root/meta 8 · `dojobrain/` 2 · `receiver/` 2 · `website/` 2 · `fusion/` 1 · `identity/` 1. Per-file rows in [`wave1-inventory.json`](wave1-inventory.json).

*Clinical/topological research material stays private research; nothing here renders it as diagnosis or proof.*
