<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# Aukora roadmap

Derived from the public Atlas ([#153](https://github.com/aumara-xyz/aukora/issues/153)) and the open issues.
Every item links to a public issue and carries a **truth label** — the honest status today, not an aspiration.
Nothing here is a delivery promise or a capability claim beyond its label.

**Truth labels:** `PROVEN` (in-repo, tested) · `LIVE-LOCAL` (real self-hosted proof on this stack) ·
`PARTIAL` (package/law proven, full runtime wiring open) · `DONOR-PINNED` (provenance-pinned transplant, parity
open) · `EXTERNAL` (outside experiment, reproduction pending) · `RESEARCH_NEW` (advisory research, unwired) ·
`PARKED` (inert by design, `enabled:false`) · `DESIGN` (specified, not built).

## Now — core truth, effect, and containment

| item | truth label | issue |
| --- | --- | --- |
| Hybrid Ed25519 + ML-DSA-65 owner authority; head-bound (`/2`) approval; consumed-authority replay refusal | **PROVEN** | [#5](https://github.com/aumara-xyz/aukora/issues/5), [#8](https://github.com/aumara-xyz/aukora/issues/8) |
| Isolated Git candidate effect — cannot push/merge/deploy/touch `main` | **PROVEN** | [#8](https://github.com/aumara-xyz/aukora/issues/8) |
| Durable self-hosted Convex workflows; real process-death → byte-identical recovery | **LIVE-LOCAL** | [#108](https://github.com/aumara-xyz/aukora/issues/108) |
| Pre-Nebius adapter boundary — Convex direct-ingest / gateway-state / `ownerArmed` falsification | **PARTIAL** (reproductions in flight) | [#158](https://github.com/aumara-xyz/aukora/issues/158) |
| Adversarial canonical encoding + closed-schema proof; one-command organism proof | **PROVEN** | [#116](https://github.com/aumara-xyz/aukora/issues/116), [#115](https://github.com/aumara-xyz/aukora/issues/115) |
| Executable anatomy + AURA receipt/Merkle evidence | **PROVEN** | [#53](https://github.com/aumara-xyz/aukora/issues/53), [#6](https://github.com/aumara-xyz/aukora/issues/6) |

## Next — Nebius shadow cell + Mind/Fu/KIRA cohesion

| item | truth label | issue |
| --- | --- | --- |
| Non-authoritative Nebius shadow cell — pinned digests, env-only creds, egress scrub, full-tree kill/rollback, shadow receipts, PR-candidate-only output | **PARKED** (quarantined, unarmed) | [#15](https://github.com/aumara-xyz/aukora/issues/15) |
| Wire `@aukora/mind` into the governed runtime as one primary chat/proposal path | **PARTIAL** | [#109](https://github.com/aumara-xyz/aukora/issues/109) |
| Fu council + KIRA recall cohesion on the primary path | **PARTIAL** | [#7](https://github.com/aumara-xyz/aukora/issues/7), [#4](https://github.com/aumara-xyz/aukora/issues/4) |
| Portable Proof Portal — independently verifiable approval/execution/artifact evidence | **DESIGN / RESEARCH** | [#152](https://github.com/aumara-xyz/aukora/issues/152), [#14](https://github.com/aumara-xyz/aukora/issues/14) |
| Brain-provider interface + model provenance; local keychain broker for creds | **PARTIAL / DESIGN** | [#10](https://github.com/aumara-xyz/aukora/issues/10), [#30](https://github.com/aumara-xyz/aukora/issues/30) |

## Later — experience + frontier research

| item | truth label | issue |
| --- | --- | --- |
| Donor-exact Spatial restoration, duplex voice, real-time Lingwa (owner parity) | **DONOR-PINNED** (parity open) | [#101](https://github.com/aumara-xyz/aukora/issues/101), [#23](https://github.com/aumara-xyz/aukora/issues/23) |
| Replayable ARC-3 reasoning dojo (onboard worlds — never an official ARC-AGI-3 result) | **PROVEN (onboard)** | [#102](https://github.com/aumara-xyz/aukora/issues/102) |
| External skunkworks qualification (e.g. Fugu Ultra governed crossing) | **EXTERNAL** | [#98](https://github.com/aumara-xyz/aukora/issues/98) |
| Frontier research backlog — Gaussian memory, GHP, Tinker LoRA/RL training | **RESEARCH_NEW** (under patent/publication review) | [#16](https://github.com/aumara-xyz/aukora/issues/16), [#159](https://github.com/aumara-xyz/aukora/issues/159) |

---

Skunkworks and external experiments are indexed with exact provenance and disposition in
[`docs/skunkworks/README.md`](docs/skunkworks/README.md) and [`docs/research/ABSORPTION_LEDGER.md`](docs/research/ABSORPTION_LEDGER.md).
Raw external numbers never become organism test totals. `Later` items are not commitments; they move up only
when their gate is met.
