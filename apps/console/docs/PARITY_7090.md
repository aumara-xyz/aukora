<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# Parity checklist — this shell vs. the donor at `http://127.0.0.1:7090/`

Reference: the running Symbiote Spatial app (`aukora-symbiote/spatial/app`). Verified by reading the donor
source (`style.css`, `shell.js`, `canvas.js`) and comparing live in the browser. **"Similar" is a failure**
— so each row states MATCH (exact primitive reused), MATCH·adapted (same contract, our content), or
INTENTIONAL DIFF (the only sanctioned difference: fewer apps + no chat + no signing).

## Design tokens & stage
| attribute | donor 7090 | this build | status |
| --- | --- | --- | --- |
| base background | `html,body #111520` | `--stage-base: #111520` | ✅ MATCH |
| stage gradient | 3 trinity radials (10/12/7%) + `linear-gradient(160deg,#090a12,#0b0d18,#080910)` | copied verbatim into `--stage` | ✅ MATCH |
| trinity hues | `129,212,180` / `150,180,255` / `196,170,255` | identical | ✅ MATCH |
| glass surfaces | `rgba(255,255,255,.045/.06/.10)` | identical | ✅ MATCH |
| ink | `.92 / .60 / .34` white | identical | ✅ MATCH |
| depth model | borders + translucency + motion, **no dark boxes** | same; reused panels re-scoped to glass inside `#shell` | ✅ MATCH |

## Geometry & panes
| attribute | donor 7090 | this build | status |
| --- | --- | --- | --- |
| layout | 3 flex lanes, `#shell` padding 10px | identical | ✅ MATCH |
| lane radius / gap | 22px / 6px | `--lane-radius` 22px / `--gap` 6px | ✅ MATCH |
| lane fill | `--glass`, center `--glass-bright`, `backdrop-filter: blur(20px) saturate(1.1)` | identical | ✅ MATCH |
| head height | 52px | `--head-h` 52px | ✅ MATCH |
| width model | two dividers `{a,d}` on a 3-unit track; widths `[a, d−a, 3−d]` | ported verbatim | ✅ MATCH |
| collapsed lane | `flex-grow:.0001; opacity:0` + edge sliver | identical | ✅ MATCH |
| glide | `flex-grow .5s cubic-bezier(.22,1,.36,1)` | identical (`--lane-glide`/`--ease`) | ✅ MATCH |

## Hot corners / telescoping (Z)
| attribute | donor 7090 | this build | status |
| --- | --- | --- | --- |
| corner size / shape | 74px, quarter-round, hue glow, breathing `cornerPulse 3.8s` | identical | ✅ MATCH |
| push rule | corner pushes its pane out a third; at the wall, pulls in | ported verbatim (`node/menu/canvasLeft/canvasRight`) | ✅ MATCH |
| keyboard | `[` `]` `,` `.` | identical | ✅ MATCH |
| verified states | 1/1/1 → 2/1/0 → 3/0/0 | reproduced live | ✅ MATCH |

## Portal menu (right lane)
| attribute | donor 7090 | this build | status |
| --- | --- | --- | --- |
| family selector | ▲ ■ ○ `.tab-btn`/`.tab-shape`, active = hue-r fill+stroke | identical | ✅ MATCH |
| portal button | one `.row` w/ `--row-hue`; `.menu-row` right-aligned purple; hover glow `0 0 16px` | identical | ✅ MATCH |
| selected state | hue border + fill + glow | identical | ✅ MATCH |
| micro label | tracks active family | tracks active family (Live/System/Frontier) | ✅ MATCH·adapted |

## Center mount
| attribute | donor 7090 | this build | status |
| --- | --- | --- | --- |
| organ title | 30px / weight 300 / hue-c | identical (`.organ-title`) | ✅ MATCH |
| mount model | `setOrgan` → `#organ-host`, kept alive in a Map, select telescopes to `a=2,d=3` | ported verbatim | ✅ MATCH |
| center app | one app at a time | one app at a time | ✅ MATCH |

## Chrome
| attribute | donor 7090 | this build | status |
| --- | --- | --- | --- |
| hint card | "Corners size · nodes open. `[ ] , .`" bottom-center glass | identical | ✅ MATCH |
| edge slivers | hue gradient on collapsed side | identical | ✅ MATCH |
| theme | dark-only (`theme-color #111520`) | dark-only | ✅ MATCH |
| motion / reduced-motion | breathing corners; transitions | same + `prefers-reduced-motion` guard | ✅ MATCH |

## Left lane — Chats/Auma (R32 AMEND fix)
| attribute | donor 7090 | this build | status |
| --- | --- | --- | --- |
| lane role | Chats (ALWAYS) — one being, one memory | Chats (ALWAYS) — Aukora pinned/live + soon rows | ✅ MATCH |
| button species | tool-btn (+/filters), aukora-pill, thread rows, composer | tool-btn, thread rows (pin + unread dot + soon pill), composer | ✅ MATCH (fewer tools) |
| conversation | live engine session via chat door :7091 | AUMA LIVE directly conversational — **deterministic OFFLINE advisory** (no paid/live call) | ✅ MATCH·adapted (offline by design) |
| composer | textarea + send + voice/attach | textarea + send (Enter to send); voice lives in KNVS session | ✅ MATCH (fewer controls) |
| chat-back corner | corner-chat-back on the left lane | corner-chat-back present | ✅ MATCH |
| node/health | (not in the chats lane) | moved to CONSOLE (BrainHealthSnapshotV1) | ✅ MATCH (correct home) |

## Intentional differences (the only sanctioned ones)
| area | donor 7090 | this build | why |
| --- | --- | --- | --- |
| app roster | ~19 apps across families | **fewer apps** per directive: ▲ AUMA LIVE · ■ AUMLOK/AURA/SPATIAL MAP/CONSOLE/SETTINGS · ○ KNVS | R31 §1/§5, R32 §4 |
| model calls | live provider via the chat door | **offline only** — advisory chat + KNVS session are deterministic offline demos; no paid/live call until a checksum/licensed provider is approved | R32 §5/§8 |
| writes | AUMLOK signing ceremony writes | **none** — fully read-only; signature lands outside the browser; KNVS submit = proposal intent only | R32 §5/§8 |

## Screens
- `docs/screens/shell-console.jpg` — a committed screenshot of this build (Console view: Chats lane · brain-health · panels · ▲■○ menu), captured at 1440×900. The donor `:7090` cannot be captured to a committed file in this environment (no headless browser; its `/assets` images taint an in-page canvas). Both servers run locally for a direct live side-by-side (`npm run launch` → :7093/:7099 alongside the donor :7090).

## Not yet at exact parity (honest gaps)
- **Per-organ internal chrome** (the donor Settings/Auma/etc. page bodies) is not reproduced pixel-for-pixel;
  the center apps mount the tested operator panels re-scoped to glass. Shell primitives match; several
  app-body layouts are MATCH·adapted, **not** Peter-approved-exact.
- **Contracts**: Sam 2 `BrainHealthSnapshotV1` and Sam 3 `aumlok-ceremony-design-v0` are wired via a
  host-injected global with the committed fixture as the labelled fallback (no browser network). Live
  end-to-end wiring awaits those services exposing an injectable global.
- **KNVS voice/vision**: bounded session UI + limits + sidecar interface + proposal-intent-only are shipped
  as a deterministic OFFLINE demo; no live audio/vision provider is wired this round (by directive).
- **Committed side-by-side PNG**: only this build's screenshot is committed; a true donor-vs-mine PNG needs a
  headless browser (not installed) or an authorized hosting path.
