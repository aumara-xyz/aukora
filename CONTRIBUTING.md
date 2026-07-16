# Contributing

Aukora is the distilled canonical core. Contributions should keep it small, pure, and honest.

## Ground rules

- **One canonical implementation per primitive.** Do not add a second copy of anything that
  already exists in a package. Applications consume these packages; they are not mirrored here.
- **Canonical sources are donor-pinned.** The primitive sources under `packages/*/src` are
  byte-identical to the reviewed donor and pinned by git-blob hash in `docs/PROVENANCE.md`.
  `npm run verify:provenance` fails on drift. A behavioural change to a pinned primitive must
  land in the donor first (or a later application rebase), then be re-promoted here — not edited
  in place.
- **Keep pure packages pure.** No `fs`, network, `child_process`, `vm`, or authority/organism
  imports in `@aukora/evidence` or `@aukora/council`. New I/O goes in a clearly-named adapter
  package (as `@aukora/council-node` is for the ledger). `npm run boundary` enforces this.
- **No authority.** No signing, live-apply, key generation, or ceremony/custody code enters
  these packages.
- **Claims must be earned.** Anything added to `CLAIMS.md` needs source, tests that exercise it,
  and a package export. Designs and hypotheses stay in issues, not in the claims table.

## Outside contributions and licensing

Aukora is licensed **AGPL-3.0-or-later** (see [LICENSE](LICENSE)), and the copyright holder also
offers separate commercial terms (see [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md)). Because
those two tracks depend on the project holding clear rights to every line it ships, **outside code
contributions cannot be accepted until a counsel-reviewed Contributor License Agreement (CLA) or
an equivalent written relicensing/inbound grant is in place.**

Until that agreement exists:

- Please do not open pull requests that add or modify source code from outside the maintainers.
- Bug reports, reproductions, security disclosures ([SECURITY.md](SECURITY.md)), documentation
  fixes, and design discussion in issues are welcome and unaffected.
- Do not paste third-party or AI-generated code whose license or provenance you cannot vouch for.

This policy is about keeping provenance honest, not about discouraging interest. It will be
updated here once a CLA/grant reviewed by counsel is available.

## Running the gate

```bash
npm install
npm run test:all
```

`test:all` runs provenance, the canonical boundary, the package suites, and the full kernel gate
(typecheck, tests, build, compatibility manifest, SBOM, runtime matrix, package tarball).
