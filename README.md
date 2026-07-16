# Aukora

The fresh, public seed of a **governed recursive digital organism** — distilled to its
constitutional core and built outward under strict governance. The Kernel is the constitutional
spine *inside* Aukora, not a separate product: authority is verified, never minted; evidence is
advisory, never authority; memory grows under consent and governed forgetting; self-change is
proposed, rehearsed, reviewed, and owner-gated before it ever touches anything real.

This repository is a **seed**, and it says so honestly: the constitutional core is implemented
and tested today; the organism surfaces (memory, brain, recursion, console) are scaffolded with
their contracts and built in the open. Every claim maps to code + tests + export or is labelled
scaffold/design. See [docs/CAPABILITY_MATRIX.md](docs/CAPABILITY_MATRIX.md).

## The spine

| | | Status |
| --- | --- | --- |
| **AUMLOK** | owner authority + fail-closed governance: deterministic verification, consumed-authority reducer, Merkle, canonical hashing | implemented in `@aukora/kernel` |
| **AURA** | evidence, receipts, provenance, secret projections; advisory, never authority | implemented in `@aukora/evidence` |
| **Fu** | advisory multi-model council + glyph geometry; grants no authority | implemented in `@aukora/council` (+ `@aukora/council-node` fs ledger) |
| **KIRA** | memory identity, consent-scoped recall, governed forgetting | contract scaffold in `packages/memory` |
| **Convex brain** | persistent growing reactive memory | scaffold in `apps/brain` |
| **Recursion** | propose → ground → rehearse → advisory review → owner-gate → sandbox → receipt | scaffold in `apps/seed` |
| **Console** | read-only operator visibility, no authority leakage | scaffold in `apps/console` |
| **Models** | provider-neutral brain attachment, no bundled weights | scaffold in `models/` |

## Packages (implemented, tested)

| Package | Role | Purity |
| --- | --- | --- |
| [`@aukora/kernel`](packages/kernel) | deterministic authority verifier + reducer, Merkle, canonical encoding, conformance vectors, SBOM | pure (`@noble/*`) |
| [`@aukora/evidence`](packages/evidence) | EvidencePack validation, canonical JSON, digest, secret projections | pure (`node:crypto`) |
| [`@aukora/council`](packages/council) | advisory council + glyph geometry; no authority | pure |
| [`@aukora/council-node`](packages/council-node) | the one Node fs adapter: persistent daily spend ledger | fs adapter |

Packages never import an app, Convex, UI, signer, or deployment code. External consumers
(`aukora-symbiote`, `aukora-fu`) point inward to these — never the reverse.
See [ARCHITECTURE.md](ARCHITECTURE.md).

## Use

```bash
npm install
npm run test:all      # provenance + boundary + package suites + full kernel gate (159 tests)
```

## Provenance and honesty

Fresh root history — no donor commits imported. The canonical sources are byte-identical to the
frozen donor [`aukora-kernel`](https://github.com/aumara-xyz/aukora-kernel) and pinned by
git-blob hash ([docs/PROVENANCE.md](docs/PROVENANCE.md)); `npm run verify:provenance` fails on
drift. What is implemented, scaffolded, and design-only is spelled out in
[docs/CAPABILITY_MATRIX.md](docs/CAPABILITY_MATRIX.md); the disposition of every donor
capability and old issue is in [docs/PUBLIC_CAPABILITY_INVENTORY.md](docs/PUBLIC_CAPABILITY_INVENTORY.md)
and [docs/ISSUE_MIGRATION_INDEX.md](docs/ISSUE_MIGRATION_INDEX.md).

## License

AGPL-3.0-or-later. See [LICENSE](LICENSE) and [NOTICE](NOTICE). Separate commercial terms may be
available under [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md) (which itself grants no license).
Contribution and CLA policy: [CONTRIBUTING.md](CONTRIBUTING.md).
