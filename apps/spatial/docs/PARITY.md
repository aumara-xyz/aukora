<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# Transplant parity — donor `:7090` vs `apps/spatial` (R34)

Reproducible evidence: [`screens/donor-7090.jpg`](screens/donor-7090.jpg) and
[`screens/transplant-7096.jpg`](screens/transplant-7096.jpg) — both captured at the **same 1440×900
viewport**, same procedure (in-page foreignObject render; note this capture technique cannot embed external
images, so the trinity-knot icons appear blank in BOTH files equally — the live pages show them; verified
interactively). Reproduce: `npm run launch --workspace @aukora/spatial` → http://127.0.0.1:7096/ beside the
donor at :7090.

| area | status | detail |
| --- | --- | --- |
| stage/background, tokens, style.css | **MATCH** | byte-identical donor file (provenance sha) |
| thirds `{a,d}` state machine, hot corners, glide/settle, mobile panes, keyboard `[ ] , .` | **MATCH** | donor `shell.js` logic untouched (only the registry block below changed) |
| Chats/Auma left lane (threads, composer, voice pill, attachments) | **MATCH** | donor `chat.js` verbatim |
| AUMA LIVE full-duplex voice (field directives, sanitization) | **MATCH** | donor `aumalive.js` + `aumalive-audio.js` + `field-directives.js` verbatim; talks to the donor `:7092` sidecar |
| AUMA LINGWA | **MATCH** | donor `auma/auma.js` + canon/readers JSON verbatim |
| AUMLOK ceremony UI | **MATCH** | donor `aumlok.js` verbatim; gate `:7094` / bind `:7095` doors unchanged (custody stays in the local doors) |
| AURA, KIRA, SPATIAL MAP, GHP, SETTINGS | **MATCH** | donor files verbatim (`aura.js`, `organs.js` mountKira, `map/*`, `ghp.js`, `settings.js`) |
| KNVS (App-Lab) + continuity keys | **MATCH** | donor `canvas.js`/`knvs-*.js`/`app-registry.js` verbatim; `app-lab`/`aukora-canvas-last` keys intact |
| registry/menu | **ADAPTED** | the ONE adapted file: `shell.js` registry subtracted to the roster (▲ aumalive, auma · ■ aumlok, aura, kira, map, ghp, console, settings · ● app-lab); unselected organs removed from menu only, files retained |
| CONSOLE organ | **NEW (ours)** | center-pane organ mounting the ten tested read-only panels in a ShadowRoot (no donor-CSS interference); from the apps/console evidence |
| launcher | **NEW (ours)** | static-only, canonical `:7096`, reserves 7090–7095. **Grounded correction to R34 §8:** the scan window cannot start at 7094 — `:7094`/`:7095` are the donor's own AUMLOK approval/binding doors (donor `aumlok.js`), so binding them would shadow the ceremony |
| same-origin `/api/*` engine endpoints | **GAP (by design this round)** | the static launcher answers 503 → donor organs show their own loud offline chrome (verified: SPATIAL MAP renders donor "ENGINE UNREACHABLE · graph 503"). Live wiring remains the donor doors `:7091`/`:7092`/`:7094`/`:7095`; a monorepo engine door is future work |
| Convex | **local-only** | nothing here contacts managed Convex, Nebius, or any paid inference |
