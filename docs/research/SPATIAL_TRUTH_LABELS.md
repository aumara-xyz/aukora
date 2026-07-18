<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# Spatial affordance truth-label audit (Sam 4 · R56 brick 1)

**Base:** public `main@2543044d93a943f050b6131e0c5e3ef8aee15ab2`. **Scope:** `apps/spatial/**`, read-only audit.
**Rule honored:** honest OFFLINE / FIXTURE / PARKED / MISSING labels are *kept*; no feature is restored merely to
remove a truthful label. Label vocabulary in use: **LIVE-LOCAL** · **FIXTURE/DEMO_FIXTURE** · **OFFLINE** ·
**PARKED** · **MISSING**.

## README workbench caption — VERIFIED EXACT
`README.md:96–100` still reads: image alt *"Experimental :7090 Symbiote Spatial workbench"*, caption *"the
experimental `:7090` Symbiote Spatial **design direction** — not the canonical live Aukora runtime; the shipped
`apps/spatial` shell is a provenance-pinned subtractive transplant … full parity … remain open."* Unchanged on
this SHA. No edit needed.

## Visible affordance → truth label

| affordance (visible roster) | truth label | exact justification in source | verdict |
| --- | --- | --- | --- |
| **Console strip / projection** (`/api/spatial/projection`) | LIVE-LOCAL **or** OFFLINE | `console.js:108` `"OFFLINE — brain door unreachable"`; a door outage returns a loud 503 and the strip flips — never stale-as-live | **EXACT** |
| **Console DEMO panels** | FIXTURE | `console.js:111` `"not live."`; 6× `DEMO_FIXTURE` markers; panels render a deterministic fixture below the live strip | **EXACT** |
| **AUMLOK · authority** | LIVE (presence booleans) / advisory | `aumlok.js:272` *"it can only watch: nothing here can sign, apply, unlock, or read your key"*; `:313` `advisoryOnly:true · grantsAuthority:false` | **EXACT** — custody stays in the local doors |
| **AURA · evidence** | advisory | evidence/trace/receipt geometry; advisory, never authority (organs render advisory pills) | **EXACT** |
| **KIRA · memory** | FIXTURE→LIVE | recall surfaces `model-free memory fallback = answers from KIRA recall, no model`; live recall is door-backed, fixture until wired | **EXACT** |
| **Spatial Map** | LIVE / OFFLINE | data-driven from the projection; door down → `ENGINE UNREACHABLE`/graph 503 (honest offline chrome) | **EXACT** |
| **GHP · Golden Horizon** | RESEARCH | `ghp.js` 7× `research`; framed as boundary research + scoreboard, not a capability claim | **EXACT** |
| **Settings** | LIVE (read-only) | key card is machine-local via the local door (R55 fix); shows provider mode + read-only health, never raw secrets | **EXACT** |
| **AUMA · Live** (voice) | LIVE / OFFLINE / model-free fallback | `aumalive.js` *"model-free — answering from memory (streamed for duplex feel; not speech-to-speech)"*; sidecar down → offline fallback | **EXACT** (see note) |
| **AUMA · Lingwa** | FIXTURE | donor canon/readers JSON verbatim; static content, no live model | **EXACT** |
| **App-Lab (KNVS)** | LIVE (local canvas) | donor App-Lab safe law; local-only creative canvas, grants nothing | **EXACT** |
| **Nebius / Inkling / Tinker** (not a visible organ) | PARKED | 3× `PARKED`; never surfaced as a live Spatial affordance | **EXACT** |

## Findings

- **No mislabeled affordance found.** Every visible surface carries a truthful live / fixture / offline / parked
  label backed by exact source. Nothing needs a label removed, and nothing should be feature-restored to hide an
  honest OFFLINE/FIXTURE state.
- **Note (AUMA · Live, cross-lane):** the R56 plan gap #4 — Spatial posts `owner_text` while the door reads
  `text`, so a real voice/UI turn can silently fall into the model-free path — is a **door/runtime seam (Sam 2
  lane)**, not a Spatial label defect. The Spatial UI *already* names that outcome honestly
  (`model-free — answering from memory … not speech-to-speech`), so the label is correct today regardless of how
  the seam is repaired. Flagged for the door lane; no Spatial label change made.

**Verdict: Spatial truth labels are EXACT at `2543044d`.** Brick complete; no code change required beyond
publishing this audit.
