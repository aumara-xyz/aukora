<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# Aukora Spatial — Design Constitution (v1)

This is the durable design law for every inside-out Aukora surface. It exists so future rounds **reuse**
primitives instead of restyling. The visual/interaction reference is the donor Symbiote Spatial shell
(`aukora-symbiote/spatial/app`); parity is tracked in [`PARITY_7090.md`](PARITY_7090.md).

> **Prime rule — one base, no dark boxes.** There is exactly one background: the trinity stage. Panes are
> translucent *glass* over it. Depth comes from **borders, translucency, spacing, motion, and geometry** —
> never from darker panels or black regions.

## 1. Versioned design tokens — `public/tokens.css`
`--design-tokens-version: "1.0.0"`. Every surface consumes these variables; nothing hard-codes a colour or
size. To change a value: bump the version and record it here first.

- **Trinity hues** (RGB triplets, used as `rgba(var(--hue-x), a)`): `--hue-l` green (left / inspector),
  `--hue-c` blue (center / canvas), `--hue-r` purple (right / menu).
- **Glass surfaces** (translucent white, never dark): `--glass`, `--glass-bright`, `--glass-border`,
  `--input-fill`, `--btn-fill`, `--code-fill`.
- **Ink**: `--text`, `--dim`, `--faint`.
- **Stage**: `--stage-base` (`#111520`) + `--stage` (three trinity radials at 7–12% over a navy gradient).
- **Motion & geometry**: `--ease` (`cubic-bezier(0.22,1,0.36,1)`), `--lane-glide` 0.5s, `--gap` 6px,
  `--head-h` 52px, `--lane-radius` 22px, `--corner-size` 74px.

## 2. Portal button — the one canonical component (`.row`)
Every portal (menu row, inspector row) is a `.row` carrying a `--row-hue`. States: default → hover (border
brightens + hue glow + lift) → `:focus-visible` (hue ring) → `.selected` (hue fill + glow) → `[disabled]`
(dimmed). `.menu-row` = right / purple; `.inspector-row` = left / green. **Never** invent a second button
shape for navigation.

## 3. Pane contract — three lanes, one state machine
Three glass `.lane`s (left / center=`.lane-c` / right). Widths come from two dividers `state = {a, d}` on a
3-unit track, `0 ≤ a ≤ d ≤ 3`: `left = a/3`, `center = (d−a)/3`, `right = (3−d)/3`. Each lane's `flex-grow`
is its width (or `0.0001` = `.collapsed`). Lanes glide with `--lane-glide`/`--ease`. A collapsed lane leaves
a hue **edge sliver**.

## 4. Center-mount contract — `setOrgan(key) → #organ-host`
The center lane mounts exactly one app. Each app is `mount(host, F)` (see `apps.js`), kept alive in a `Map`
(display toggled, never re-created). Apps are **read-only** and **reuse** the tested panels
(`window.AukoraPanels`) and the shared map (`window.AukoraSpatialMap`) — they never re-implement a panel.
Selecting a portal telescopes to the node-plus-app composition (`a=2, d=3`).

## 5. Telescope / depth (Z) contract — hot corners
Each lane has 74px invisible `.corner` push-buttons with a breathing quarter-bloom in the lane's hue. A
corner **always pushes its pane out a third**; at the far wall it **pulls in a third**. Keyboard parity:
`[` node · `]` menu · `,` center-left · `.` center-right. This telescoping *is* the Z axis — content nests
inward as panes yield.

## 6. Icon & geometry rules
The family selector is the three primitives: **▲ Triangle = Live**, **■ Square = System**, **○ Circle =
Frontier**. Tabs use `.tab-shape` (15px, 1.4px stroke; active = hue-r fill+stroke). Hues map to lane role
(green=left, blue=center, purple=right) everywhere.

## 6b. Button species (keep them distinct — never flatten)
The shell has several CANONICAL, visually-distinct interactive species; do not collapse them into one look:
- **Hot corners** (`.corner`) — invisible 74px pane-push affordances with a breathing hue bloom (X/Z motion).
- **Portal cards** (`.row` + `--row-hue`) — the telescoping app/menu buttons (§2).
- **Tool buttons** (`.tool-btn`) — small glyph-only actions in the chats toolbar / conversation header.
- **Pills** (`.pill`, `.aukora-pill`, `.mode-tag`) — status/label chips, never primary navigation.

## 6c. Left lane — Chats/Auma (always)
The left lane is ALWAYS the Chats/Auma conversation ("one being, one memory"). AUMA LIVE is directly
conversational there; replies are **deterministic offline advisory** (no paid/live call, no network). It
signs/applies nothing — a proposal halts for the AUMLOK signature at the gate. Node/health/provenance belong
in a center organ (CONSOLE), never the chats lane.

## 6d. Upstream contracts (read-only, host-injected → fixture fallback)
Two contracts are consumed read-only via `contracts.js`: Sam 2 `BrainHealthSnapshotV1` and Sam 3
`aumlok-ceremony-design-v0`. A host may INJECT a live value as a plain global (same mechanism as `fixture.js`)
— it is then labelled `LIVE`; otherwise the committed fixture is used and labelled `FIXTURE`. The shell makes
**no network call** (a tested safety property). Fixtures are an explicit, labelled fallback only.

## 6e. Local launcher
`scripts/launch.mjs` (npm `launch`) serves the shell read-only on `127.0.0.1:7093`, alongside — never
touching — the donor `:7090`, the governed door `:7091`, and the voice sidecar `:7092`. Port-configurable
(`PORT=`), reproducible from a fresh clone.

## 7. Advisory law
The whole surface is **read-only**: it mounts apps and renders state, and it **cannot sign, authorize,
apply, merge, deploy, or arm** anything. No private key, token, or secret-shaped data lives in browser
state. The only write authority is the AUMLOK owner signature, which lands **outside** the browser. The KNVS
lab renders pixels in an opaque `allow-scripts` sandbox under a strict in-document CSP; a proposal only
**drafts** (never applies).

## 8. Parity fixtures
- The deterministic `DEMO_FIXTURE` (`public/fixture.json`) — real organism + offline council outputs.
- `docs/spatial-map.svg` — a self-contained snapshot of the data-driven map.
- `docs/PARITY_7090.md` — the explicit attribute-by-attribute checklist against the donor.

## How to add a new inside-out app (the reuse path)
1. Write `mount(host, F)` in `apps.js` using tokens + `.glass-card` + `AukoraPanels` — no new colours.
2. Add one `ORGANS[key]` entry and one `TABS[family].rows` entry in `shell.js`. That is the whole wiring.
3. If it needs a map, call `AukoraSpatialMap`. If it needs a panel, call `AukoraPanels.render.*`.
4. Keep it read-only. Route any change through the AUMLOK gate as a draft — never apply in the browser.
