# Claims

Every capability below is labelled with exactly one truth label and is backed by canonical
source, tests that execute that source, and a package export. A Markdown document is never
treated as proof that a capability exists.

Labels used here: **CANONICAL_PORTABLE** — production library code in this repository now.

## Implemented in this repository (CANONICAL_PORTABLE)

| Capability | Source | Tests | Export |
| --- | --- | --- | --- |
| Deterministic authority verification + reducer, canonical encoding, Merkle, registries, schemas, conformance vectors | `packages/kernel/src` | `packages/kernel/test` (14) + conformance vectors | `@aukora/kernel` (built `dist`) |
| EvidencePack closed-schema validation, JCS-aligned canonical JSON, domain-separated length-framed digest | `packages/evidence/src/{canonical,digest,validate,types}.ts` | `packages/evidence/test/evidencePackV1.test.ts` | `@aukora/evidence` |
| Confusable-resistant secret projections + catalogue (NFC/NFKC/NFD, zero-width strip, skeleton), linear JWT/URL/step-budget scanners | `packages/evidence/src/catalogue.ts` | `packages/evidence/test/evidencePackV1.test.ts` | `@aukora/evidence` |
| Advisory council: served-model verification (no substitution), quorum rule, spend estimation, claim-basis freeze/verify | `packages/council/src/aukoraFuCouncil.ts` | `packages/council/test/aukoraFuCouncil.test.ts` | `@aukora/council` |
| Glyph-packet parsing / perception channel (deterministic, offline) | `packages/council/src/aukoraFuGlyph.ts` | `packages/council/test/aukoraFuGlyph.test.ts` | `@aukora/council` |
| Persistent daily spend ledger (filesystem JSONL) | `packages/council-node/src/aukoraFuSpendLedger.ts` | `packages/council-node/test/aukoraFuSpendLedger.test.ts` | `@aukora/council-node` |
| Canonical-source boundary check (no fs/network/authority in pure packages) | `scripts/check-canonical-boundary.mjs` | `test/boundaryGuard.test.ts` | script |
| Donor byte-identity provenance guard | `scripts/verify-provenance.mjs` | run in `test:all` | script |

Test totals: 145 (root suite) + 14 (kernel) = **159**, none borrowed from any application suite.

## Deliberately NOT in this repository

These are excluded on purpose and are **not** claimed as shipped capabilities anywhere here:

- Any application: the Symbiote product organism, the Fu review application, Convex
  backend/reference app, dashboards, servers, friend harness, Portal CLI.
- Product/UI surfaces: spatial UI, lander, voice, chat, board/creative surfaces.
- Quarantined material and research corpora.
- Private planning, handoffs, continuity notes, strategy, or patent drafts.
- Any "digital metabolism", biological-isomorphism, consciousness, or "aliveness" claim. Such
  material, where it exists at all, is research/design in other repositories and is **not**
  implemented capability. It does not appear here as a claim.
- Signing, live-apply, key generation, ceremony/custody. This core verifies authority; it never
  mints or applies it.

If a future capability is designed but not built, it belongs in a private issue or a
design record — not in this claims table.
