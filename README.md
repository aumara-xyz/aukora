# Aukora

**Canonical portable core for recursive digital organism governance.**

Post-quantum identity. Consumed-authority reference monitor. Multi-model consensus. Hardened immune gate. Owner-consented self-modification.

## Live development

`main` is the protected release line. Active organism work is published continuously through reviewed draft pull requests and the four durable round feeds:

- [Control / integration](https://github.com/aumara-xyz/aukora/issues/20)
- [Brain / Convex / Nebius](https://github.com/aumara-xyz/aukora/issues/21)
- [Recursion / AUMLOK–AURA](https://github.com/aumara-xyz/aukora/issues/22)
- [Spatial shell / Auma](https://github.com/aumara-xyz/aukora/issues/23)

Feature branches may update ahead of `main`; that means the work is under verification, not absent. Only an exact, tested, independently reviewed integration head is promoted to `main`.

## Packages

| Package | Contents | Tests |
|---------|----------|-------|
| `@aukora/kernel` | Post-quantum crypto (ML-DSA-65), Merkle receipts, authority, schema, registry, staleness law | 80+ |
| `@aukora/evidence` | EvidencePack V1 D6 — 9-projection secret scanner, canonical digest, fail-closed validator | 146 |
| `@aukora/council` | 8-seat Fu Council H1-H8 — geometry-informed verdicts, KL-divergence perceiver, spend metering | 60+ |

## Quick Start

```bash
npm install @aukora/kernel @aukora/evidence @aukora/council
```

## Truth Labels

Every capability in this repository is classified:

- **CANONICAL_PORTABLE** — production code, one implementation, tested, exported
- **DESIGN_ONLY** — specification or roadmap, not implemented
- **RESEARCH_ONLY** — hypothesis or analogy, not engineering proof

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full capability table.

## License

Copyright (c) 2026 Aumara LLC. Licensed under **GNU AGPL-3.0-or-later**. See the complete, unmodified [LICENSE](./LICENSE) text.

## Security

See [SECURITY.md](./SECURITY.md).

## Provenance

See [PROVENANCE.md](./PROVENANCE.md) for donor SHA/blob records.
