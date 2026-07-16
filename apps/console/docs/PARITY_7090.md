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

## Intentional differences (the only sanctioned ones)
| area | donor 7090 | this build | why |
| --- | --- | --- | --- |
| app roster | ~19 apps across families | **fewer apps** per directive: ▲ AUMA LIVE · ■ AUMLOK/AURA/SPATIAL MAP/CONSOLE/SETTINGS · ○ KNVS | ROUND_DIRECTIVE R31 §1, §5 |
| left lane | Chats (live threads) | **Node** read-only inspector (status + now-showing) | no chat data in this lane; keeps 3-pane framing + hue-l inspector role |
| writes | AUMLOK signing ceremony writes | **none** — fully read-only; signature lands outside the browser | R31 §7, §10 |
| KNVS | App-Lab canvas (`canvas.js`) | same safe law, hardened: opaque `allow-scripts` sandbox + strict in-document CSP + draft-only + continuity keys `aukora-canvas-last`/`app-lab` | R31 §9 |

## Not yet at exact parity (honest gaps)
- Per-organ **internal** chrome (e.g., the donor Settings/Auma pages) is not reproduced pixel-for-pixel; the
  center apps here mount the tested operator panels re-scoped to glass. The **shell** primitives match; some
  app-body layouts are MATCH·adapted, not pixel-identical.
- The donor's mobile pane-navigation is reproduced in contract (one pane at a time, corners navigate) but
  not exhaustively state-tested.
