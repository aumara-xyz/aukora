# Public capability inventory (sanitized)

Sanitized cross-repository capability disposition. No full paths, patent substance, IDs, or
private references — those live only in the private master inventory, whose SHA-256 is recorded
in `docs/PROVENANCE.md`. Issue mapping is in `docs/ISSUE_MIGRATION_INDEX.md`.

Truth labels as in `docs/CAPABILITY_MATRIX.md`, plus `PORTABLE_AFTER_SPLIT`,
`PRODUCT_STAYS_SYMBIOTE`, `FRIEND_HARNESS_STAYS_FU`, `PATENT_HOLD`, `RESEARCH_ONLY`,
`QUARANTINE`, `REJECTED`, `SUPERSEDED`.

| Capability | Donor | Truth label | Destination |
| --- | --- | --- | --- |
| Deterministic authority verifier + consumed-authority reducer | aukora-kernel | IMPLEMENTED_CANONICAL | `@aukora/kernel` |
| Canonical hashing + Merkle inclusion/consistency | aukora-kernel | IMPLEMENTED_CANONICAL | `@aukora/kernel` |
| Post-quantum signing-spine verification (ML-DSA vectors) | aukora-kernel | IMPLEMENTED_CANONICAL | `@aukora/kernel` |
| Registries + schemas + conformance vectors + SBOM | aukora-kernel | IMPLEMENTED_CANONICAL | `@aukora/kernel` |
| EvidencePack closed-schema validation + canonical JSON + digest | aukora-fu | IMPLEMENTED_CANONICAL | `@aukora/evidence` |
| Confusable-resistant secret projections + scanners | aukora-fu | IMPLEMENTED_CANONICAL | `@aukora/evidence` |
| Advisory council: served-model verification, quorum, spend estimate | aukora-fu | IMPLEMENTED_CANONICAL | `@aukora/council` |
| Glyph packet geometry (deterministic) | aukora-fu | IMPLEMENTED_CANONICAL | `@aukora/council` |
| Persistent daily spend ledger | aukora-fu | IMPLEMENTED_ADAPTER | `@aukora/council-node` |
| Fu review application (server, dashboard, friend harness, Portal CLI) | aukora-fu | FRIEND_HARNESS_STAYS_FU | external `aukora-fu` |
| Core memory envelope + consent scope + provenance | aukora-symbiote | PORTABLE_AFTER_SPLIT | `packages/memory` (scaffold) |
| Append/recall contracts | aukora-symbiote | PORTABLE_AFTER_SPLIT | `packages/memory` (scaffold) |
| Reactive brain snapshot + Convex append/recall | aukora-symbiote | IMPLEMENTED_ADAPTER (target) | `apps/brain` (scaffold) |
| Receipt-chained memory + Merkle head verification | aukora-symbiote | PORTABLE_AFTER_SPLIT | `packages/{evidence,memory}` |
| Governed forgetting (tombstone, audit-preserving) | aukora-symbiote | PORTABLE_AFTER_SPLIT | `packages/memory` + `apps/brain` |
| Pure proposal intent (id/hash/validation) | aukora-symbiote | PORTABLE_AFTER_SPLIT | `packages/memory` / `apps/seed` |
| Staleness / refusal law | aukora-symbiote (PR #20) | PORTABLE_AFTER_SPLIT | `apps/seed` (Worker Two harvest) |
| Sandbox proposal/rehearsal/review/gate orchestration | aukora-symbiote | PORTABLE_AFTER_SPLIT | `apps/seed` (scaffold) |
| Policy/action-classifier decision core | aukora-symbiote | PORTABLE_AFTER_SPLIT (compare vs kernel reducer first) | `packages/kernel`? |
| Flight recorder (hash-chain schema vs fs append) | aukora-symbiote | schema PORTABLE_AFTER_SPLIT; fs append STAYS_SYMBIOTE | split |
| AUMLOK ceremony / key custody / signing | aukora-symbiote | verify-only IMPLEMENTED_CANONICAL; custody PRODUCT_STAYS_SYMBIOTE | split (no keys in packages) |
| Operator console (full spatial/voice/lander UI) | aukora-symbiote | PRODUCT_STAYS_SYMBIOTE; minimal read-only console is new | `apps/console` (new, scaffold) |
| BrainProvider interface + deterministic offline provider | new | DESIGN_ONLY → scaffold | `models/`, `apps/brain` |
| Qwen2.5-VL + Auma-VL LoRA ladder (v5..v17) | private | AVAILABLE_PRIVATE (weights private; v17 gains UNVERIFIED) | `models/` manifest only |
| Liquid AI candidate | — | REJECTED (licensing; untrained) | — |
| Nemotron | — | BLOCKED (untrained) | — |
| ~3B router / MOPD distillation | — | DESIGN_ONLY | — |
| Proof Portal prototype | aukora-symbiote | PATENT_HOLD + needs execution-evidence hardening | separate review |
| G1 / Nebius generation bundle | aukora-symbiote | QUARANTINE (unarmed) | quarantine |
| Digital metabolism / Borromean / consciousness framing | research | RESEARCH_ONLY (never a shipped claim) | — |

This inventory is a candidate for reviewer falsification (Kimi/Gemini): flag any capability that
is lost, duplicated across destinations, or whose label overstates what code+tests prove.
