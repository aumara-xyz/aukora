# Architecture

Aukora is the seed of a governed recursive organism. The design goal is a *distilled* spine:
one canonical implementation per primitive, an acyclic dependency graph that never points at an
application, a hard boundary between pure logic and I/O, and governance (verify authority, don't
mint it) baked into the shape rather than bolted on.

## Target shape

```
aukora/
  packages/                 pure, portable, dependency-light — never import an app
    kernel/                 AUMLOK: authority verification, policy law, Merkle, canonical hashing   [implemented]
    evidence/               AURA: EvidencePack, receipts, secret scanning                            [implemented]
    council/                Fu: advisory council + glyph geometry; no signer/apply/authority         [implemented]
    council-node/           Node-only spend-ledger adapter (the one fs surface)                       [implemented]
    memory/                 KIRA: pure memory envelope + recall contracts                             [scaffold]
  apps/                     compose packages behind adapters; own the I/O, Convex, and UI
    brain/                  Convex reactive growing memory + receipts + snapshot proof                [scaffold]
    seed/                   governed inward-out recursion (propose/rehearse/review/gate/sandbox)      [scaffold]
    console/                minimal read-only operator UI                                              [scaffold]
  models/                   provider-neutral brain attachment; sanitized manifests, no weights        [scaffold]
  docs/                     ARCHITECTURE, CLAIMS, PROVENANCE, CAPABILITY_MATRIX, ISSUE_MIGRATION_INDEX,
                            PUBLIC_CAPABILITY_INVENTORY
```

## Dependency direction

```
  apps/brain   ─┐
  apps/seed     ├──> packages/*          (apps consume packages)
  apps/console ─┘

  packages/*   ──> Node built-ins + @noble/* only   (leaves; none imports another today)

  later, external consumers:
  aukora-symbiote ─┐
                    ├──> published @aukora/* packages   (never the reverse)
  aukora-fu       ─┘
```

Packages **never** import apps, Convex, Symbiote, Fu, UI, filesystem adapters, signers, or
deployment code. The four implemented packages are independent leaves (none imports another).
`packages/memory` will follow the same rule (pure contracts only). Every app arrow points inward.

## Governance shape (the constitutional guarantees)

- **AUMLOK — verify, don't mint.** `@aukora/kernel` deterministically *verifies* authority
  artifacts and reduces consumed authority; it holds no keys and performs no signing. Key
  custody/signing is a **local owner adapter** outside the portable packages. No model signs for
  the owner; the recursion demo must refuse unsigned or stale proposals.
- **AURA — advisory, not authority.** `@aukora/evidence` validates and digests evidence and binds
  target/digest with Merkle proofs. Artifacts stay `advisoryOnly:true` / `grantsAuthority:false`.
  The console *displays* evidence; it cannot grant authority.
- **KIRA — consent + governed forgetting.** Memory carries consent scope and provenance; forgetting
  is an owner-authorized tombstone that removes plaintext from recall while retaining a content-free
  audit trail. The audit chain is never rewritten or silently deleted.
- **Fu — advice only.** The council produces a verdict with quorum geometry; it never signs,
  applies, or authorizes. The pure council is separate from the Node spend adapter. No live
  provider calls in this seed — demos use deterministic/mock review.
- **Recursion — sandbox-only.** Change is proposed, grounded against real files, rehearsed in a
  sandbox, advisorily reviewed, refused on stale/secret/authority, owner-gated via AUMLOK, and
  applied only into an isolated sandbox with receipt + lineage. No unattended live-repo mutation.

## Boundary enforcement

`scripts/check-canonical-boundary.mjs` fails if any file under `packages/evidence/src`,
`packages/council/src`, or `packages/council-node/src` imports a forbidden module (network,
`child_process`, `vm`, authority/organism modules), and forbids `fs` everywhere except the one
sanctioned ledger file. `scripts/verify-provenance.mjs` pins the canonical sources to the donor by
git-blob hash. As `packages/memory` and the apps land, the boundary and CI extend to them.

## Provenance without imported history

The repository root is a fresh commit that carries none of the donor's history — which would drag
in the applications, organism, quarantine, research, and private planning this seed excludes. The
canonical sources are copied byte-identical from the frozen donor and pinned by blob hash; see
[docs/PROVENANCE.md](docs/PROVENANCE.md).
