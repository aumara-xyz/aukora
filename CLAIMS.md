# Claims

Every capability below is labelled with exactly one truth label and is backed by canonical
source, tests that execute that source, and a package export. A Markdown document is never
treated as proof that a capability exists.

Labels used here:
- **CANONICAL_PORTABLE** — production library code (a pure/adapter package) in this repository now.
- **DEMONSTRATED_ADAPTER** — an in-repo organism adapter exercised by tests, with an explicit
  honesty caveat (simulated / mock / sandbox-only / parked). It is *not* a live production
  deployment and does not claim to be.

## Pure packages implemented in this repository (CANONICAL_PORTABLE)

| Capability | Source | Tests | Export |
| --- | --- | --- | --- |
| Deterministic authority verification + reducer, canonical encoding, Merkle, registries, schemas, conformance vectors | `packages/kernel/src` | `packages/kernel/test` (21) + conformance vectors | `@aukora/kernel` (built `dist`) |
| EvidencePack closed-schema validation, JCS-aligned canonical JSON, domain-separated length-framed digest | `packages/evidence/src/{canonical,digest,validate,types}.ts` | `packages/evidence/test/evidencePackV1.test.ts` | `@aukora/evidence` |
| Confusable-resistant secret projections + catalogue (NFC/NFKC/NFD, zero-width strip, skeleton), linear JWT/URL/step-budget scanners | `packages/evidence/src/catalogue.ts` | `packages/evidence/test/evidencePackV1.test.ts` | `@aukora/evidence` |
| KIRA memory law: consent-scoped content-addressed envelope, deterministic recall, governed forgetting (content-free tombstone), staleness, advisory containment | `packages/memory/src/envelope.ts` | `packages/memory/test` (17) | `@aukora/memory` |
| Pure reasoning-loop primitives: tolerant single-legal-action reply parsing, bounded plan-step grammar with fail-safe expectation checks, parity-safe bounded turn window, ONE unified rigid-move law shared by diff rendering and plan verification, deterministic plan rollout + donor scoring law over an injected simulator, advisory-only trace payloads | `packages/mind/src` | `packages/mind/test` (51) | `@aukora/mind` |
| Advisory council: served-model verification (no substitution), quorum rule, spend estimation, claim-basis freeze/verify | `packages/council/src/aukoraFuCouncil.ts` | `packages/council/test/aukoraFuCouncil.test.ts` | `@aukora/council` |
| Glyph-packet parsing / perception channel (deterministic, offline) | `packages/council/src/aukoraFuGlyph.ts` | `packages/council/test/aukoraFuGlyph.test.ts` | `@aukora/council` |
| Persistent daily spend ledger (filesystem JSONL) | `packages/council-node/src/aukoraFuSpendLedger.ts` | `packages/council-node/test/aukoraFuSpendLedger.test.ts` | `@aukora/council-node` |
| Canonical-source boundary check (no fs/network/authority in pure packages) | `scripts/check-canonical-boundary.mjs` | `test/boundaryGuard.test.ts` | script |
| Donor byte-identity provenance guard | `scripts/verify-provenance.mjs` | run in `test:all` | script |

## Organism adapters demonstrated in this repository (DEMONSTRATED_ADAPTER)

Each row is exercised by tests, and each carries the honesty caveat that keeps it from
overclaiming. These are governed demonstrations, not live production systems.

| Capability | Source | Tests | Honesty caveat |
| --- | --- | --- | --- |
| Reactive, receipt-chained, growing memory with governed forgetting (content-free chain); corrupt-store fail-closed + reproducible runtime manifest; node print, supervised generation, offline executor, health contract, Nebius preflight | `apps/brain/src`, `apps/brain/convex` | `apps/brain/test` (171; +2 gated smokes) | Deterministic tests use `convex-test`. Convex truth: the live path is **local/self-hosted** Convex, never managed cloud. R50 (#99 closed, PR #105/#110) landed production mind-door → local Convex persistence with a **real process-death acceptance**; durable-workflow hardening continues as #108. |
| Provider-neutral brain attachment incl. a Nebius provider path + fail-closed provider selection policy | `apps/brain/src/nebiusProvider.ts`, `apps/brain/src/providerPolicy.ts` | `apps/brain/test/{nebiusProvider,providerPolicy}.test.ts` | **Bounded and parked**: no live model calls, no weights, no endpoint/job IDs |
| Governed inward-out recursion: propose → ground → sandbox-rehearse → advisory review → refuse(stale/secret/authority) → hybrid AUMLOK owner-gate → isolated candidate → receipt/lineage; AURA trace law + receipt-before-row; governed AUMLOK–AURA ceremony contract | `apps/seed/src` | `apps/seed/test` (338) | Effects stop at an isolated local candidate worktree/branch; never direct `main`, push, or merge |
| Read-only operator console over authority/memory/proposal/verdict/provider-truth/budget/forgetting | `apps/console/public`, `apps/console/tooling` | `apps/console/test` (44) | Renders a deterministic `DEMO_FIXTURE`; **signs, applies, deploys, and arms nothing** |
| Donor Spatial shell transplanted subtractively (46 VERBATIM donor blobs, provenance-pinned + tested; registry subtraction; port law :7096 with donor doors 7090–7095 reserved); R50/#101 removed the CONSOLE organ from the visible roster per owner direction (`console.js` retained on disk, unmounted); R50/#102 added the replayable ARC-3 **onboard-compatible** dojo | `apps/spatial` | `apps/spatial/test` (57) | Donor code, not a recreation; local doors are supervisor-owned and fail honestly when unavailable; custody/signing stays out of the browser and launcher; the ARC-3 dojo runs the donor's **onboard** worlds and is **never** an official ARC-AGI-3 result |

Test totals: 169 (root) + 21 (kernel) + 17 (memory) + 51 (mind) + 171 (brain; +2 gated smokes) + 338 (seed) + 44 (console) + 57 (spatial) + 31 (supervisor) + 1 (fixture-regeneration guard) = **900 passing**, none borrowed from any external product suite. (Counts gated by `test:all`; the continuity guard `scripts/verify-continuity.mjs` keeps this total honest.)

## Deliberately NOT in this repository

These are excluded on purpose and are **not** claimed as shipped capabilities anywhere here:

- Private donor history and unpublished product/research material are not automatically copied
  into this public tree; included `apps/*` and `packages/*` are real in-repo working surfaces.
- Quarantined material and research corpora.
- Private planning, handoffs, continuity notes, strategy, or patent drafts.
- Any biological-isomorphism, consciousness, or "aliveness" claim. `apps/seed/src/metabolism.ts`
  implements only a small contraction-only resource signal: it may add a refusal but can never
  grant authority, widen capability, sign, or release an existing refusal. Larger digital-metabolism
  models remain research and are not claimed as runtime biology.
- Owner signing secrets and key material. The kernel verifies authority; models never mint it.

If a future capability is designed but not built, it belongs in a private issue or a
design record — not in this claims table.
