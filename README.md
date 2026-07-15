# Aukora

The canonical, portable core of Aukora — a small set of dependency-light TypeScript packages
for deterministic authority verification, tamper-evident evidence, and advisory multi-model
review. **Library code only.** There is no application, product UI, game, organism, research
corpus, or cloud backend in this repository, and there never will be — those consume these
packages from their own repositories, never the other way around.

## Packages

| Package | What it is | Purity | Depends on |
| --- | --- | --- | --- |
| [`@aukora/kernel`](packages/kernel) | Deterministic authority verifier + reducer, canonical encoding, Merkle, registries, conformance vectors, SBOM. Runs on Edge/Bun/browser. | pure | `@noble/*` only |
| [`@aukora/evidence`](packages/evidence) | EvidencePack: closed-schema validation, JCS-aligned canonical JSON, domain-separated digest, confusable-resistant secret projections. | pure, offline | none (`node:crypto`) |
| [`@aukora/council`](packages/council) | Advisory multi-model council core: seat verification, glyph-packet parsing, quorum, spend estimation. **Never grants authority.** | pure, offline | none |
| [`@aukora/council-node`](packages/council-node) | The one Node-only I/O adapter: a filesystem-backed persistent daily spend ledger, kept out of the pure council. | Node fs adapter | none |

The four packages are independent leaves — none imports another, and none imports from any
application. See [ARCHITECTURE.md](ARCHITECTURE.md).

## Use

```bash
npm install
npm run test:all      # provenance + boundary + package suites + full kernel gate
```

Individual gates:

```bash
npm run verify:provenance   # canonical sources are byte-identical to the reviewed donor
npm run boundary            # evidence/council/council-node import no fs/network/authority
npm test                    # evidence + council + council-node + export/boundary smoke (145)
npm run test:kernel         # kernel: boundary, typecheck, tests, build, compat, SBOM, runtimes, package
```

`@aukora/kernel` publishes built `dist`; `@aukora/evidence`, `@aukora/council`, and
`@aukora/council-node` publish TypeScript source consumed by a bundler (the same way the
Symbiote and Fu applications consume them).

## Provenance and honesty

This repository has a **fresh root history** — no donor commits are imported. The canonical
sources were copied byte-identical from the frozen public donor
[`aukora-kernel`](https://github.com/aumara-xyz/aukora-kernel) and pinned by donor git-blob
hash in [docs/PROVENANCE.md](docs/PROVENANCE.md); `npm run verify:provenance` fails if any
source drifts. Every capability the docs call implemented has source, tests that exercise it,
and a package export — see [CLAIMS.md](CLAIMS.md). Anything not built is absent from these
claims, not described as if it exists.

## License

AGPL-3.0-or-later. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
