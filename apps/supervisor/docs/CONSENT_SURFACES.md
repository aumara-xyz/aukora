<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# Consent-surface inventory (WAVE 2 §consent)

Every ambient context in the new organism that can trigger **billed or governed work**, and the consent
gate in front of it. "Billed" today is theoretical — no provider is configured (model-free); the gates
are inventoried for the day one is.

| surface | ambient trigger | can start | consent gate(s) | receipt |
| --- | --- | --- | --- | --- |
| AUMA LIVE microphone | open channel → VAD hears END of an utterance | a mind turn (`/api/presence/stream` → door `/api/chat`) — governed; billed IF a provider is ever configured | (1) the channel is opened by an explicit click; (2) VAD final only fires on the owner's own speech; (3) the launcher proxy holds the token — no page can mint a turn cross-origin; (4) barge-in abort cancels upstream work; (5) door LOCKDOWN short-circuits writes | door event receipt per turn |
| Chats composer (typed) | Enter in the composer | a mind turn (`/api/chat`) | explicit keystroke; same-origin + token proxy; lockdown | door event receipt |
| App-Lab drive (`html:`/build prompts) | Enter in the composer while App-Lab focused | a mind turn that RENDERS into the sandboxed canvas | explicit keystroke; canvas is `allow-scripts` sandboxed; no door reach from grown apps | door event receipt |
| Voice sidecar TTS | any `tts` frame from the shell | LOCAL compute only (never billed, zero egress) | ws origin allowlist (shell origins only); barge-in `tts_cancel` | sidecar is stateless; no receipts by design (ephemeral audio) |
| `/api/lockdown` | button/fetch from the shell | STOPS work (never starts it) | same-origin; engaging is one-way from the UI — release is terminal-only | door receipt (`door:lockdown`) |
| Supervisor CLI (`up/down/swap/status/doctor`) | none — OWNER terminal invocation only | process lifecycle inside the pre-authorized envelope | no network control surface exists; protected.sha256 must verify before ANY action | append-only `state/receipts.jsonl` |
| Gateway `/aukora/*` | any browser | read-only status/receipt projection | GET only; content-free receipts; `grantsAuthority:false` pinned | n/a (it IS the receipt surface) |
| Projection strip (CONSOLE) | organ mount + 2s re-check | loopback GETs only (brain door :7141, door status) — read-only, never billed | display-only fence re-checked client-side | none needed (reads) |

**Not consent surfaces (by construction):** UI geometry, thirds state, scores, model output, health
state, AURA display — none has a route by which to start governed work or authorize anything
(WAVE 1 addendum proof; the mind door additionally requires the origin/token wall + lockdown check
per POST). Field/body-language events are ephemeral: stripped before speech, never sent to the mind,
never receipted.

**External continuity homes** are verified by **existence/hash policy only** (`doctor` reports an
existence boolean for `~/.aukora-symbiote`; the identity-anchor mechanism, when it ships, verifies by
sha-pin exactly as the donor's `identityAnchor.ts` law: absent → loud "laws without private story",
never silent truncation). No owner-private identity content is copied anywhere by this wave.
