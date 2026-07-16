# Aukora

A **governed recursive digital-organism seed**. Its constitutional spine is the **AUMLOK
authority kernel** — authority is *verified, never minted*; evidence is advisory, never
authority; memory grows under consent and governed forgetting; self-change is proposed,
rehearsed, reviewed, and owner-gated before it ever touches anything real.

This repository is a **seed** and says so honestly. The pure constitutional packages are
production library code; the organism adapters (memory brain, recursion seed, operator console)
are **demonstrated in-repo with tests and explicit honesty labels** — where a surface is
simulated, mock, sandbox-only, or parked, [CLAIMS.md](CLAIMS.md) says exactly that. Product
applications, UI/games, research corpora, and cloud deployments live in other repositories and
consume these packages — never the other way around.

## Pure packages (portable, dependency-light)

| Package | What it is | Purity |
| --- | --- | --- |
| [`@aukora/kernel`](packages/kernel) | AUMLOK: deterministic authority verifier + reducer, canonical encoding, Merkle, registries, conformance vectors, SBOM. Edge/Bun/browser. | pure (`@noble/*`) |
| [`@aukora/evidence`](packages/evidence) | AURA: EvidencePack closed-schema validation, JCS-aligned canonical JSON, domain-separated digest, confusable-resistant secret projections. | pure, offline |
| [`@aukora/council`](packages/council) | Fu: advisory multi-model council — seat verification, glyph parsing, quorum, spend estimation. **Grants no authority.** | pure, offline |
| [`@aukora/council-node`](packages/council-node) | The one Node fs adapter: a persistent daily spend ledger, kept out of the pure council. | Node fs adapter |
| [`@aukora/memory`](packages/memory) | KIRA: consent-scoped content-addressed memory envelope, deterministic recall, governed forgetting, staleness, advisory containment. | pure |

## Organism adapters (in-repo, demonstrated with honesty labels)

| Adapter | What it demonstrates | Honesty label |
| --- | --- | --- |
| [`apps/brain`](apps/brain) | Reactive, receipt-chained, growing memory with content-free forgetting, built on `@aukora/memory` + `@aukora/kernel`. | **Simulated** Convex backend via `convex-test` (headless, in-process) — **not** a live cloud deploy. The Nebius provider path is **bounded and parked**; no live model calls. |
| [`apps/seed`](apps/seed) | Governed inward-out recursion: propose → ground → sandbox-rehearse → advisory Fu → refuse(stale/secret/authority) → **real hybrid AUMLOK owner-gate** → sandbox-only apply → receipt + lineage. | Council review is **mock/deterministic** (no live providers); apply is **sandbox-only** — never mutates a live repository. |
| [`apps/console`](apps/console) | Read-only operator view of authority/lock, growing memory, proposal governance, the advisory council, provider truth-labels, budget hard-stops, and governed forgetting. | Renders a deterministic `DEMO_FIXTURE` derived from the organism; it **signs, applies, deploys, and arms nothing**. |

Every arrow points inward: adapters consume packages; packages consume only Node built-ins and
`@noble/*`. See [ARCHITECTURE.md](ARCHITECTURE.md).

## Use

```bash
npm install
npm run test:all      # provenance + boundary + package suites + kernel gate + organism suites
```

Individual gates:

```bash
npm run verify:provenance   # canonical sources byte-identical to the reviewed donor
npm run boundary            # evidence/council/council-node import no fs/network/authority
npm test                    # evidence + council + council-node + export/boundary smoke (145)
npm run test:kernel         # kernel: boundary, typecheck, tests, build, compat, SBOM, runtimes, package (14)
npm run test:organism       # memory (4) + brain (55) + seed (98) + console (21)
```

## Provenance and honesty

Fresh root history — no donor commits imported. The canonical primitive sources are copied
byte-identical from the frozen public donor
[`aukora-kernel`](https://github.com/aumara-xyz/aukora-kernel) and pinned by donor git-blob hash
in [docs/PROVENANCE.md](docs/PROVENANCE.md); `npm run verify:provenance` fails on drift. Every
capability the docs call implemented has source, tests that exercise it, and an export — and
every simulated, mock, sandbox-only, or parked surface is labelled as such in
[CLAIMS.md](CLAIMS.md). Nothing unbuilt is described as if it exists.

## License

AGPL-3.0-or-later. See [LICENSE](LICENSE) and [NOTICE](NOTICE). Separate commercial terms may be
available under [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md) (which itself grants no license).
Contribution and CLA policy: [CONTRIBUTING.md](CONTRIBUTING.md).
