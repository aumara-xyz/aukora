# Architecture

Aukora is a monorepo of small, independent, dependency-light library packages. The design goal
is a *distilled* core: one canonical implementation per primitive, an acyclic dependency graph
that never points at an application, and a hard boundary between pure logic and I/O.

## Package graph

```
  applications (elsewhere: aukora-symbiote, aukora-fu)
        │  import
        ▼
  ┌───────────────┬────────────────┬────────────────┬─────────────────────┐
  │ @aukora/kernel│ @aukora/evidence│ @aukora/council │ @aukora/council-node │
  │  (pure)       │  (pure)         │  (pure)         │  (Node fs adapter)   │
  └───────────────┴────────────────┴────────────────┴─────────────────────┘
        │ @noble/*        │ node:crypto      │ (none)          │ node:fs, node:path
```

- **Every arrow points inward.** Applications depend on these packages; these packages depend
  only on Node built-ins and `@noble/*`. **No package imports another package here, and no
  package imports from any application.** The four are independent leaves.
- **Acyclic by construction** — there is nothing to cycle: the graph is four disconnected nodes.

## The council / council-node split

`@aukora/council` is the advisory core: it verifies which model actually answered, parses the
glyph packets, computes quorum, and *estimates* spend — all pure, offline computation. It must
never touch the filesystem, the network, or ambient authority, so it can be reasoned about and
run anywhere.

The one piece that genuinely needs I/O — a persistent daily spend **ledger** that appends to a
JSONL file — is isolated in `@aukora/council-node`. This keeps the advisory core pure and makes
the impure surface a single, obvious, auditable file. The boundary is enforced mechanically:
`scripts/check-canonical-boundary.mjs` fails if any file under `packages/evidence/src`,
`packages/council/src`, or `packages/council-node/src` imports a forbidden module (network,
`child_process`, `vm`, authority/organism modules), and forbids `fs` everywhere except the
sanctioned ledger file.

## Authority stays out

Nothing in these packages grants, signs, or applies authority. `@aukora/council` is
**advisory only** — its output is evidence for a human/governance decision, never a decision.
`@aukora/kernel` *verifies* authority artifacts deterministically; it does not mint them. There
is no signing key, no live-apply, and no ceremony/custody code in this repository.

## Provenance without imported history

The repository root is a fresh orphan commit — it deliberately carries none of the donor's Git
history. The canonical primitive sources are instead copied byte-identical from the frozen
donor `aukora-kernel` and pinned by their donor git-blob object hash (see
[docs/PROVENANCE.md](docs/PROVENANCE.md)). `npm run verify:provenance` recomputes each blob hash
and fails on any drift, which is what lets us claim "this is exactly the reviewed donor code,
single-sourced" without dragging the donor history — or the donor's applications — along.

## Testing layout

- `@aukora/kernel` self-tests through its own `vitest.config.ts` and is exercised by the full
  `test:kernel` gate (boundary, typecheck, tests, build, compatibility manifest, SBOM, runtime
  matrix, package tarball).
- `@aukora/evidence`, `@aukora/council`, `@aukora/council-node` are tested by the root
  `vitest.config.ts`, alongside a repo-level boundary-script test and a package-export smoke
  test. No test count is borrowed from any application.
