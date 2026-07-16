# Aukora

A **governed recursive digital-organism seed**. Its constitutional spine is the **AUMLOK
authority kernel** — authority is *verified, never minted*; evidence is advisory, never
authority; memory grows under consent and governed forgetting; self-change is proposed,
rehearsed, reviewed, and owner-gated before it ever touches anything real.

This repository is a **seed** and says so honestly. The pure constitutional packages are
production library code; the organism adapters (memory brain, recursion seed, spatial operator
console) are **demonstrated in-repo with tests and explicit honesty labels** — where a surface is
simulated, mock, sandbox-only, fixture-fed, or parked, [CLAIMS.md](CLAIMS.md) says exactly that.
Product applications, research corpora, and cloud deployments live in other repositories and
consume these packages — never the other way around.

## Live development

`main` is the protected release line. Active organism work is published continuously through
reviewed draft pull requests and the four durable round feeds:

- [Control / integration](https://github.com/aumara-xyz/aukora/issues/20)
- [Brain / Convex / Nebius](https://github.com/aumara-xyz/aukora/issues/21)
- [Recursion / AUMLOK–AURA](https://github.com/aumara-xyz/aukora/issues/22)
- [Spatial shell / Auma](https://github.com/aumara-xyz/aukora/issues/23)

Feature branches may update ahead of `main`; that means the work is under verification, not
absent. Only an exact, tested, independently reviewed integration head is promoted to `main`.

## Pure packages (portable, dependency-light)

| Package | What it is | Purity |
| --- | --- | --- |
| [`@aukora/kernel`](packages/kernel) | AUMLOK: deterministic authority verifier + reducer, canonical encoding, Merkle, registries, staleness law, conformance vectors, SBOM. Edge/Bun/browser. | pure (`@noble/*`) |
| [`@aukora/evidence`](packages/evidence) | AURA: EvidencePack closed-schema validation, JCS-aligned canonical JSON, domain-separated digest, confusable-resistant secret projections. | pure, offline |
| [`@aukora/council`](packages/council) | Fu: advisory multi-model council — seat verification, glyph parsing, quorum, spend estimation. **Grants no authority.** | pure, offline |
| [`@aukora/council-node`](packages/council-node) | The one Node fs adapter: a persistent daily spend ledger, kept out of the pure council. | Node fs adapter |
| [`@aukora/memory`](packages/memory) | KIRA: consent-scoped content-addressed memory envelope, deterministic recall, governed forgetting, staleness, advisory containment. | pure |

## Organism adapters (in-repo, demonstrated with honesty labels)

| Adapter | What it demonstrates | Honesty label |
| --- | --- | --- |
| [`apps/brain`](apps/brain) | Reactive, receipt-chained, growing memory with content-free forgetting; KIRA memory classes; reactive brain adapter; local-dev path. | **Simulated** Convex backend via `convex-test` (headless, in-process) — **not** a live cloud deploy. The Nebius provider path is **bounded and parked**; no live model calls. |
| [`apps/seed`](apps/seed) | Governed inward-out recursion: propose → ground → sandbox-rehearse → advisory Fu → refuse(stale/secret/authority) → **real hybrid AUMLOK owner-gate** → sandbox-only apply → receipt + lineage; memory constitution (ROOT/UNITE/RISE/GOLD); council-runner boundary. | Council review is **mock/deterministic** (no live providers; no transport embedded); apply is **sandbox-only** — never mutates a live repository. |
| [`apps/console`](apps/console) | Spatial operator shell (▲ AUMA LIVE / LINGWA · ■ AUMLOK / AURA / KIRA / SPATIAL MAP / GHP / CONSOLE / SETTINGS · ● KNVS) over authority, growing memory, proposals, the advisory council, provider truth-labels, budgets, and governed forgetting. | Read-only; panels are **fixture-fed** and labelled FIXTURE where a live adapter is not injected; it **signs, applies, deploys, and arms nothing**. Local launcher binds `127.0.0.1:7094`; donor `:7090` untouched. |

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
npm test                    # evidence + council + council-node + export/boundary smoke
npm run test:kernel         # kernel: boundary, typecheck, tests, build, compat, SBOM, runtimes, package
npm run test:organism       # memory + brain + seed + console
```

## Provenance and honesty

Fresh root history — no donor commits imported. The canonical primitive sources are copied
byte-identical from the frozen public donor
[`aukora-kernel`](https://github.com/aumara-xyz/aukora-kernel) and pinned by donor git-blob hash
in [docs/PROVENANCE.md](docs/PROVENANCE.md); `npm run verify:provenance` fails on drift. Every
capability the docs call implemented has source, tests that exercise it, and an export — and
every simulated, mock, sandbox-only, fixture-fed, or parked surface is labelled as such in
[CLAIMS.md](CLAIMS.md). Nothing unbuilt is described as if it exists.

## License

Copyright (c) 2026 Aumara LLC. Licensed under **GNU AGPL-3.0-or-later** — see the complete,
unmodified [LICENSE](LICENSE) text and [NOTICE](NOTICE). Separate commercial terms may be
available under [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md) (which itself grants no license).
Contribution and CLA policy: [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

See [SECURITY.md](SECURITY.md).
