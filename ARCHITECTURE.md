# Architecture

Aukora is a governed digital-organism seed. The design goal is a *distilled* constitutional
spine: one canonical implementation per primitive, an acyclic dependency graph in which every
arrow points inward toward the pure packages, a hard boundary between pure logic and I/O, and
governance (verify authority, don't mint it) baked into the shape rather than bolted on.

## Two layers

```
  external products (elsewhere: aukora-symbiote, aukora-fu, product UI/games, cloud)
        │  import ▼
  apps/ (in-repo governed adapters — own the I/O, demos, and fixtures)
    brain/    reactive receipt-chained memory over a SIMULATED Convex backend (convex-test)
    seed/     sandbox-only governed recursion + real hybrid AUMLOK owner-gate
    console/  read-only operator view; renders a deterministic DEMO_FIXTURE
        │  import ▼
  packages/ (pure, portable, dependency-light — never import an app)
    kernel/       AUMLOK: authority verification, policy law, Merkle, canonical hashing
    evidence/     AURA: EvidencePack, canonical JSON, digest, secret projections
    council/      Fu: advisory council + glyph geometry; no signer/apply/authority
    council-node/ the one Node fs adapter (spend ledger)
    memory/       KIRA: pure consent-scoped memory envelope + governed forgetting
        │  depends only on ▼
  Node built-ins + @noble/*
```

- **Every arrow points inward.** `apps/*` consume `packages/*`; the pure packages consume only
  Node built-ins and `@noble/*`. No package imports an app; the pure packages take no ambient
  I/O. `apps/*` are the sanctioned place for adapters, demos, and fixtures.
- **Acyclic by construction.** The pure packages are leaves; `apps/*` sit strictly above them.

## The council / council-node split

`@aukora/council` is the advisory core: it verifies which model actually answered, parses the
glyph packets, computes quorum, and *estimates* spend — all pure, offline computation. It must
never touch the filesystem, the network, or ambient authority. The one piece that genuinely
needs I/O — a persistent daily spend **ledger** — is isolated in `@aukora/council-node`.
`scripts/check-canonical-boundary.mjs` fails if any file under `packages/evidence/src`,
`packages/council/src`, or `packages/council-node/src` imports a forbidden module (network,
`child_process`, `vm`, authority/organism modules), and forbids `fs` everywhere except the
sanctioned ledger file.

## Governance shape (what the adapters may and may not do)

- **AUMLOK — verify, don't mint.** `@aukora/kernel` deterministically *verifies* authority and
  reduces consumed authority; it holds no keys and performs no signing. The recursion seed's
  owner-gate is a *real hybrid AUMLOK* check that refuses unsigned or stale proposals.
- **AURA — advisory, not authority.** Evidence stays `advisoryOnly` / `grantsAuthority:false`.
- **KIRA — consent + governed forgetting.** Memory carries consent scope and provenance;
  forgetting is a content-free tombstone that removes plaintext from recall while retaining an
  audit trail. `apps/brain` demonstrates this over a **simulated** Convex backend, not live cloud.
- **Fu — advice only.** The council produces a verdict with quorum geometry; it never signs,
  applies, or authorizes. In `apps/seed` the review is **mock/deterministic** — no live providers.
- **Recursion — sandbox-only.** Change is proposed, grounded against real files, rehearsed in a
  sandbox, advisorily reviewed, refused on stale/secret/authority, owner-gated via AUMLOK, and
  applied only into an isolated sandbox with receipt + lineage. **No live-repo mutation.**
- **Console — read-only.** It renders a fixture and grants nothing; it signs/applies/deploys nothing.

## Provenance without imported history

The repository root is a fresh orphan commit that carries none of the donor's Git history. The
canonical primitive sources are copied byte-identical from the frozen donor `aukora-kernel` and
pinned by donor git-blob object hash (see [docs/PROVENANCE.md](docs/PROVENANCE.md));
`npm run verify:provenance` recomputes each blob hash and fails on any drift.

## Testing layout

- `@aukora/kernel` self-tests through its own config and the full `test:kernel` gate (boundary,
  typecheck, tests, build, compatibility manifest, SBOM, runtime matrix, package tarball).
- `@aukora/evidence`, `@aukora/council`, `@aukora/council-node` and the repo-level boundary/export
  smoke tests run under the root `vitest.config.ts` (`npm test`).
- The organism suites run per-workspace under `npm run test:organism`: `@aukora/memory`,
  `@aukora/brain` (including the `convex-test` simulated backend), `@aukora/seed`, `@aukora/console`.
- `npm run test:all` runs provenance + boundary + root + kernel + organism. No test count is
  borrowed from any external product suite.
