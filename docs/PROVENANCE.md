# Provenance

This repository has a **fresh root history**. It imports **no** commits from the donor. Instead,
the canonical primitive sources were copied byte-identical from the frozen donor and their exact
identity is pinned here by donor git-blob object hash. `npm run verify:provenance` recomputes each
file's git-blob hash (`sha1("blob <len>\0<bytes>")`) and fails if any source has drifted from the
donor bytes.

## Donor

- Repository: `github.com/aumara-xyz/aukora-kernel` (public, frozen for this recovery)
- Commit: `b441edc4d17de778d30ae955f46408edae39bffe`
- Tree: `711336558a1398edc5706e9dc600e55351c202ee`

## `@aukora/kernel`

Promoted whole from the donor package `packages/kernel`, byte-identical.

- Donor subtree object (`packages/kernel`): `364d02d3bf452a8d2ee00764a9ef4e02c6eb1bfb`

The kernel carries its own `packages/kernel/PROVENANCE.md`, conformance vectors, and
`SBOM.cdx.json`, all preserved as-is.

## Canonical primitive sources (byte-identical, blob-pinned)

Each row is `this-repo path  ←  donor path @ commit`, with the donor git-blob hash that
`verify-provenance.mjs` checks.

| This repo | Donor path | Donor blob (git sha1) |
| --- | --- | --- |
| `packages/evidence/src/canonical.ts` | `src/evidence/canonical.ts` | `623b008a3cc2fc5350054e75b4ab4b65cbcfea11` |
| `packages/evidence/src/catalogue.ts` | `src/evidence/catalogue.ts` | `2b7ff7f32f8bf403776b5dba624ba5ee1b7c75b0` |
| `packages/evidence/src/digest.ts` | `src/evidence/digest.ts` | `1a07e9d4d2a23c74d9beb438dcd0296feab1016f` |
| `packages/evidence/src/framing.ts` | `src/evidence/framing.ts` | `ec698ba0a704d9d69afbe555b635d3905a4601e2` |
| `packages/evidence/src/index.ts` | `src/evidence/index.ts` | `ba1a9e90e7ddc53b6eb9e327fd737fe51efc96b0` |
| `packages/evidence/src/types.ts` | `src/evidence/types.ts` | `d0e2f4d15c54660d8f2006caff3f58621cbf1d92` |
| `packages/evidence/src/validate.ts` | `src/evidence/validate.ts` | `2d6a247a602cc86fcba52120052a1a972572f640` |
| `packages/council/src/aukoraFuCouncil.ts` | `src/council/aukoraFuCouncil.ts` | `93bc046ab866ad022b82e9dc04aac65eb6ae39dc` |
| `packages/council/src/aukoraFuGlyph.ts` | `src/council/aukoraFuGlyph.ts` | `7081ab39890ce654929d326155d77f85bb585a99` |
| `packages/council-node/src/aukoraFuSpendLedger.ts` | `src/council/aukoraFuSpendLedger.ts` | `60d4407cf4ad8056802e3dbb3be7fd88a0ecec60` |

## Not byte-identical (adapted, and why)

These files are **not** canonical primitives and are not blob-pinned; they are new or relocated
packaging around the pinned sources:

- `packages/council/index.ts` — new package-entry barrel (re-exports the two council primitives;
  no logic).
- `packages/*/test/*.test.ts` — the donor `tests/fu/*` suites, relocated into each package's
  `test/` with import paths updated from `../../src/...` to the package-local `../src/...`. Test
  logic is unchanged; only import paths were adjusted for the new layout.
- `packages/council/test/fixtures/fusion-replies/*` — the five council reply fixtures, copied
  verbatim.
- `packages/*/package.json`, `tsconfig.json`, `vitest.config.ts`, root config, `scripts/*`,
  and the top-level docs — new clean-root scaffolding.

## Why fresh history

Importing the donor history would drag in the applications, organism, quarantine, research, and
private-planning material this repository is defined to exclude. A fresh root plus blob-pinned
provenance gives the same auditable guarantee — "this is exactly the reviewed donor code" —
without any of that payload, and without rewriting or deleting the frozen donor.
