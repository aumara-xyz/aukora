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

## R35 verification (proofs on head, no features added)

| proof | result |
| --- | --- |
| donor blob manifest | 91/91 VERBATIM byte-identical (`npm run verify:provenance` on the donor box; CI re-checks sha256 pins) |
| exact import graph | **tested**: every static `/app/*` + relative import in the app resolves to a file — zero dangling imports after subtraction; CONSOLE loads resolve; `index.html` boots donor `shell.js` |
| thirds/corners law | keyboard `[`→2/1/0 · `]`→1/1/1 · `,`→0/2/1 · `.`→0/3/0 reproduced live; `lane-settled` fires after the 0.5s glide |
| menu/telescope/mount | ▲ menu → selecting **Auma · Live** mounts the donor duplex-voice organ (verified text: "her mind… her voice… open the channel and talk"); select-collapse law matches donor (`a=2,d=3` only when `d<3`) |
| voice (AUMA LIVE) | donor organ mounts in its idle/offline fallback with the `:7092` sidecar down — **loopback-only, tested**: all `ws://` literals are `127.0.0.1`; `aumalive*/knvs-duplex/chat` endpoints loopback-only |
| external-network law | **tested**: non-loopback `fetch` targets exist ONLY in the unselected `wolf` organ (removed from registry, unreachable); `openrouter.ai` appears only as `<a href>` links in donor settings; no key-shaped material in the app |
| mobile behavior | one pane at a time, corners navigate (canvas→threads→canvas reproduced live at 375×812) |
| desktop screenshots | [`donor-7090.jpg`](screens/donor-7090.jpg) vs [`transplant-7096.jpg`](screens/transplant-7096.jpg) (1440×900) |
| mobile screenshots | [`donor-mobile-375.jpg`](screens/donor-mobile-375.jpg) vs [`transplant-mobile-375.jpg`](screens/transplant-mobile-375.jpg) (375×812) |
| AUMA LIVE evidence | [`transplant-aumalive-desktop.jpg`](screens/transplant-aumalive-desktop.jpg) |
| coexistence | donor `:7090` 200 and transplant `:7096` 200 simultaneously (donor untouched) |

## R36 live wiring (loopback projection seam)
| proof | result |
| --- | --- |
| projection seam | `/api/spatial/projection` serves the live-local payload generated by `npm run launch:live` — the REAL merged-main organism (`DurableRecursion` + `ReactiveMemoryStore`): workflow held at **awaiting-owner** (council digest pinned), an **owner-completed applied candidate**, content-free receipts, verified brain health. Missing payload → **loud 503**, never stale-as-live |
| six surfaces LIVE in CONSOLE | verified in-browser: brain · workflow · Fu advisory · AUMLOK awaiting-owner · candidate · receipts, under a `LIVE-LOCAL ORGANISM · generated <instant>` banner; the DEMO_FIXTURE panels below are explicitly labelled "not live" ([`screens/transplant-live-console.jpg`](screens/transplant-live-console.jpg)) |
| display never authorizes | tested: `displayOnly:true`, `feedsApply:false`, zero `grantsAuthority:true` anywhere in the payload; the client re-checks the fence and refuses a projection that claims authority |
| offline truth | verified live: with the projection removed the strip flips to `OFFLINE — live-local projection unavailable` + the `launch:live` hint (fixture stays labelled) |
| port map | :7090 donor spatial · :7091 chat door · :7092 voice · :7093 arc3 · :7094 AUMLOK gate · :7095 AUMLOK bind (all reserved, untouched) · **:7096 this organism** (scan 7096–7099) |
