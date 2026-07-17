# Architecture

Aukora is a governed digital-organism seed. The design goal is a *distilled* constitutional
spine: one canonical implementation per primitive, an acyclic dependency graph in which every
arrow points inward toward the pure packages, a hard boundary between pure logic and I/O, and
governance (verify authority, don't mint it) baked into the shape rather than bolted on.

## Two layers

```
  external systems (donor Symbiote, model providers, private evolution cells)
        │  import ▼
  apps/ (in-repo governed adapters — own the I/O, demos, and fixtures)
    brain/      deterministic convex-test coverage + real local/self-hosted Convex adapters/canary
    seed/       governed recursion + real hybrid AUMLOK gate + isolated Git candidates
    spatial/    provenance-pinned donor body and loopback client
    supervisor/ protected lifecycle/token custody for local services
    console/    retained read-only fixture app; removed from the visible Spatial roster
        │  import ▼
  packages/ (pure, portable, dependency-light — never import an app)
    kernel/       AUMLOK: authority verification, policy law, Merkle, canonical hashing
    evidence/     AURA: EvidencePack, canonical JSON, digest, secret projections
    council/      Fu: advisory council + glyph geometry; no signer/apply/authority
    council-node/ the one Node fs adapter (spend ledger)
    memory/       KIRA: pure consent-scoped memory envelope + governed forgetting
    mind/         the pure observe→hypothesize→act→verify reasoning loop
                  (advisory; authors proposals, grants nothing)
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
`packages/council/src`, `packages/council-node/src`, or `packages/mind/src` imports a forbidden
module (network, `child_process`, `vm`, authority/organism modules), and forbids `fs` everywhere
except the sanctioned ledger file.

## Governance shape (what the adapters may and may not do)

- **AUMLOK — verify, don't mint.** `@aukora/kernel` deterministically *verifies* authority and
  reduces consumed authority; it holds no keys and performs no signing. The recursion seed's
  owner-gate is a *real hybrid AUMLOK* check that refuses unsigned or stale proposals.
- **AURA — advisory, not authority.** Evidence stays `advisoryOnly` / `grantsAuthority:false`.
- **KIRA — consent + governed forgetting.** Memory carries consent scope and provenance;
  forgetting is a content-free tombstone that removes plaintext from recall while retaining an
  audit trail. Deterministic tests use `convex-test`; the production mind-door uses a **local,
  self-hosted** Convex store whose process-death recovery has been exercised against a real backend.
  Managed Convex is not used.
- **Fu — advice only.** The council produces a verdict with quorum geometry; it never signs,
  applies, or authorizes. Canonical tests are deterministic/offline. External live-model experiments
  remain separately labelled evidence until reproduced through the canonical runtime.
- **Mind — advisory reasoning, never authority.** `@aukora/mind` is the pure
  observe→hypothesize→act→verify loop; its only outlet is the caller-supplied `Env.act` port and
  every trace payload stays `advisoryOnly` / `grantsAuthority:false`. `@aukora/mind` (the pure
  reasoning-loop package) is distinct from the seed's mind DOOR — the governed HTTP surface in
  `apps/seed`.
- **Recursion — isolated candidate only.** Change is proposed, grounded against real files,
  rehearsed, advisorily reviewed, refused on stale/secret/authority, owner-gated via AUMLOK, and
  materialized only into a disposable Git worktree/branch with receipt + lineage. It cannot push,
  merge, deploy, or modify `main`.
- **Console — retained read-only fixture.** It grants nothing and is not in the visible Spatial roster.

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
  `@aukora/mind`, `@aukora/brain` (including deterministic `convex-test` coverage), `@aukora/seed`,
  `@aukora/console`, and `@aukora/spatial`. The separate R51 canary owns a real local Convex backend,
  kills it, and restarts it on the same SQLite state.
- `npm run test:all` runs provenance + continuity + anatomy + boundary + root + kernel + organism.
  No test count is
  borrowed from any external product suite.
