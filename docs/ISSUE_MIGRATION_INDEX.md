# Issue migration index

Preservation is by **disposition**, not by copying the whole Symbiote or duplicating every old
GitHub issue. Every significant donor source/issue gets exactly one machine-readable disposition.
Raw private/patent-sensitive issue bodies stay in the private master inventory (its SHA-256 is
recorded in `docs/PROVENANCE.md`); only sanitized names appear here.

## Schema

Each migrated row records:

| field | meaning |
| --- | --- |
| `donor_repo` | aukora-kernel / aukora-fu / aukora-symbiote |
| `donor_issue` | donor issue number (or `—` for source-only items) |
| `title` | sanitized title (no patent substance, no IDs) |
| `disposition` | one of the labels below |
| `destination` | target package/app in Aukora (or `—`) |
| `aukora_issue` | new Aukora issue number once migrated |
| `reason` | why, especially for exclusions |
| `verification` | `verified` / `pending` / `n/a` |

Dispositions: `IMPLEMENTED_CANONICAL` · `IMPLEMENTED_ADAPTER` · `PORTABLE_AFTER_SPLIT` ·
`PRODUCT_STAYS_SYMBIOTE` · `FRIEND_HARNESS_STAYS_FU` · `DESIGN_ONLY` · `RESEARCH_ONLY` ·
`QUARANTINE` · `PATENT_HOLD` · `REJECTED` · `SUPERSEDED`.

## Umbrella issue families (public, sanitized)

These are the initial public issue families opened on `aumara-xyz/aukora`. Detailed per-source
rows are appended under the relevant family as migration proceeds.

| # | Family | Primary destination |
| --- | --- | --- |
| 1 | Canonical package convergence | `packages/*` |
| 2 | Convex reactive brain | `apps/brain` |
| 3 | KIRA memory envelope + governed forgetting | `packages/memory`, `apps/brain` |
| 4 | AUMLOK owner gate | `packages/kernel`, local adapter |
| 5 | AURA receipt / Merkle evidence | `packages/evidence` |
| 6 | Fu advisory council integration | `packages/council`, `apps/seed` |
| 7 | Governed inward-out recursion | `apps/seed` |
| 8 | Minimal organism console | `apps/console` |
| 9 | Brain-provider interface + model provenance | `models/`, `apps/brain` |
| 10 | Symbiote consumer rebase | external `aukora-symbiote` |
| 11 | Fu friend-harness consumer rebase | external `aukora-fu` |
| 12 | Old issue migration + preservation | this index |
| 13 | Proof Portal hardening | `apps/seed` / separate review |
| 14 | G1 / Nebius canary + generation lineage | quarantine (unarmed) |
| 15 | Research/design backlog (patent/publication review) | `PATENT_HOLD` / `RESEARCH_ONLY` |

## Migrated rows (verified this round)

| donor_repo | donor_issue | title | disposition | destination | aukora_issue | verification |
| --- | --- | --- | --- | --- | --- | --- |
| aukora-kernel | — | Deterministic authority verifier + reducer | IMPLEMENTED_CANONICAL | `packages/kernel` | 1 | verified (14 tests + conformance) |
| aukora-kernel | — | Merkle inclusion/consistency + canonical hashing | IMPLEMENTED_CANONICAL | `packages/kernel` | 5 | verified |
| aukora-fu | — | EvidencePack + secret projections | IMPLEMENTED_CANONICAL | `packages/evidence` | 5 | verified |
| aukora-fu | — | Advisory council + glyph geometry + quorum | IMPLEMENTED_CANONICAL | `packages/council` | 6 | verified |
| aukora-fu | — | Persistent daily spend ledger | IMPLEMENTED_ADAPTER | `packages/council-node` | 6 | verified |
| aukora-symbiote | — | Core memory envelope + append/recall | PORTABLE_AFTER_SPLIT | `packages/memory` | 3 | pending (Worker Two) |
| aukora-symbiote | — | Convex reactive brain snapshot | IMPLEMENTED_ADAPTER (target) | `apps/brain` | 2 | pending (Worker Two) |
| aukora-symbiote | — | Proposal intent / staleness / recursion | PORTABLE_AFTER_SPLIT | `packages/memory` + `apps/seed` | 3, 7 | pending |
| aukora-symbiote (PR #20) | — | Staleness/refusal law | PORTABLE_AFTER_SPLIT | `apps/seed` | 7 | pending (Worker Two harvest) |
| aukora-symbiote | — | Full spatial/lander/voice/games UI | PRODUCT_STAYS_SYMBIOTE | external | — | n/a |
| aukora-symbiote | — | Flight recorder (fs append) | PORTABLE_AFTER_SPLIT (schema) + STAYS_SYMBIOTE (fs) | `packages/evidence`? / `apps` | 5, 7 | pending |
| aukora-symbiote | — | AUMLOK ceremony / key custody / signing | PRODUCT_STAYS_SYMBIOTE (custody) + IMPLEMENTED_CANONICAL (verify only) | local adapter / `packages/kernel` | 4 | partial |
| — | — | Qwen/Auma-VL model provenance | AVAILABLE_PRIVATE / PATENT_HOLD | `models/` | 9, 15 | pending |
| aukora-symbiote | — | Proof Portal prototype | PATENT_HOLD / needs hardening | separate review | 13 | pending |
| aukora-symbiote | — | G1 / Nebius bundle | QUARANTINE (unarmed) | quarantine | 14 | n/a this round |
| — | — | Digital metabolism / Borromean / aliveness | RESEARCH_ONLY | not shipped | 15 | n/a |

Reviewers (Kimi, Gemini, Sam) should treat this as a candidate and flag any capability that is
lost, duplicated, or mislabelled.
