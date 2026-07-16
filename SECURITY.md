# Security

## Reporting

Please report suspected vulnerabilities privately to **auma@aumara.xyz** rather than opening a
public issue. Include the affected package, a minimal reproduction, and the impact you observed.
We aim to acknowledge within a few days.

## Security model

- **The advisory council grants no authority.** `@aukora/council` produces evidence for a
  human/governance decision; it never signs, applies, or authorizes anything. Treat its output
  as advice, never as a control decision.
- **EvidencePack is a boundary, not a permission.** `@aukora/evidence` validates and digests
  evidence deterministically and refuses secret-shaped or authority-shaped content; it does not
  confer trust by itself.
- **The kernel verifies, it does not mint.** `@aukora/kernel` deterministically checks authority
  artifacts. There is no signing key, live-apply, or key generation in this repository.
- **Pure packages take no ambient I/O.** `@aukora/evidence` and `@aukora/council` perform no
  filesystem or network access; the only sanctioned filesystem surface is the spend ledger in
  `@aukora/council-node`. This is enforced by `scripts/check-canonical-boundary.mjs`.
- **No secrets in the tree.** The evidence secret projections exist to *detect* secret-shaped
  content; the repository itself contains no credentials, keys, or infrastructure identifiers.

## Supported versions

Pre-1.0. Security fixes land on the default branch.
