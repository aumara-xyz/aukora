# Capability truth matrix

The organism spine — AUMLOK, AURA, KIRA, Fu, Convex brain, governed recursion, operator
console — mapped to what is actually in this repository **today**. Every "implemented" row has
source, tests that exercise it, and a package export. Scaffolds and designs are labelled as
such and make no capability claim.

Labels: `IMPLEMENTED_CANONICAL` (production library code here now) · `IMPLEMENTED_ADAPTER`
(Node/IO adapter here now) · `SCAFFOLD` (directory + contract reserved, no logic yet) ·
`DESIGN_ONLY` (planned) · `RESEARCH_ONLY` · `STAYS_SYMBIOTE` / `STAYS_FU` (belongs in the
consumer app, not here).

## Constitutional core — implemented today

| Spine | Capability | Where | Source | Tests | Export | Label |
| --- | --- | --- | --- | --- | --- | --- |
| AUMLOK | Deterministic authority verification + reducer, policy/consumed-authority checks | kernel | `packages/kernel/src` | `packages/kernel/test` (14) + conformance vectors | `@aukora/kernel` | IMPLEMENTED_CANONICAL |
| AUMLOK | Canonical hashing, Merkle inclusion/consistency, registries, schemas | kernel | `packages/kernel/src/{canonical,merkle,registry,schema}.ts` | `packages/kernel/test` + conformance | `@aukora/kernel` | IMPLEMENTED_CANONICAL |
| AURA | EvidencePack closed-schema validation, JCS canonical JSON, domain-separated digest | evidence | `packages/evidence/src` | `packages/evidence/test` | `@aukora/evidence` | IMPLEMENTED_CANONICAL |
| AURA | Confusable-resistant secret projections + scanners (JWT/URL/step-budget) | evidence | `packages/evidence/src/catalogue.ts` | `packages/evidence/test` | `@aukora/evidence` | IMPLEMENTED_CANONICAL |
| Fu | Advisory council: served-model verification, quorum, spend estimation, claim-basis freeze | council | `packages/council/src/aukoraFuCouncil.ts` | `packages/council/test` | `@aukora/council` | IMPLEMENTED_CANONICAL |
| Fu | Glyph packet parsing / geometry (deterministic, offline) | council | `packages/council/src/aukoraFuGlyph.ts` | `packages/council/test` | `@aukora/council` | IMPLEMENTED_CANONICAL |
| Fu | Persistent daily spend ledger (the one fs adapter, isolated) | council-node | `packages/council-node/src` | `packages/council-node/test` | `@aukora/council-node` | IMPLEMENTED_ADAPTER |

Advisory guarantee: `@aukora/council` grants no authority (`advisoryOnly` / `grantsAuthority:false`),
performs no I/O, and is verified pure by `scripts/check-canonical-boundary.mjs`.

## Organism surfaces — scaffolded this round (no logic yet)

| Spine | Capability | Where | Owner lane | Label |
| --- | --- | --- | --- | --- |
| KIRA | Pure memory envelope, consent scope, append/recall contracts | `packages/memory` | Worker Two | SCAFFOLD |
| KIRA + Convex | Reactive growing memory, receipt-chained append/recall, snapshot, growth proof, governed forgetting (tombstone) | `apps/brain` | Worker Two | SCAFFOLD |
| Recursion | Propose → ground → rehearse → advisory Fu → refuse(stale/secret/authority) → AUMLOK gate → sandbox-only apply → receipt/lineage | `apps/seed` | Worker Two | SCAFFOLD |
| Console | Read-only operator view of authority/memory/proposal/verdict/lineage/model/budget | `apps/console` | Opus Local (after brain/seed shapes) | SCAFFOLD |
| Models | `BrainProvider` contract + deterministic offline provider; sanitized manifests | `models/`, Worker Two provider lane | Worker Two | SCAFFOLD |

## Model provenance (no weights, no IDs)

| Model | Label | Note |
| --- | --- | --- |
| deterministic-offline test provider | IMPLEMENTED (scaffold contract) | no network; for tests/demos |
| Qwen2.5-VL-32B + Auma-VL LoRA v5..v17 | AVAILABLE_PRIVATE | weights private; v17 evaluation gains UNVERIFIED pending provenance |
| Liquid AI candidate | REJECTED | licensing concerns; untrained |
| Nemotron | BLOCKED | untrained |
| ~3B router seed / MOPD distillation | DESIGN_ONLY | not built |

## Explicitly absent (by design, not loss)

Full Symbiote organism, Fu review application, Convex product backend, board/creative games,
spatial/voice/lander UI, quarantine bundle, research corpora, private planning, signing/
live-apply/key-generation, and any "aliveness"/biological-isomorphism claim. These live in the
consumer repositories or are research/design elsewhere — see `docs/PUBLIC_CAPABILITY_INVENTORY.md`
and `docs/ISSUE_MIGRATION_INDEX.md` for the disposition of each.
