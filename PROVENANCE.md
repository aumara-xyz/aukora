# Provenance Manifest

This repository was created as a clean-root orphan from the donor repository `github.com/aumara-xyz/aukora-kernel`. No git history was imported. All material is traced by blob SHA-1 from the donor.

## Donor Repository

- **Repository**: `github.com/aumara-xyz/aukora-kernel`
- **Final frozen main**: `b441edc4d17de778d30ae955f46408edae39bffe`
- **Final frozen tree**: `711336558a1398edc5706e9dc600e55351c202ee`
- **Frozen at**: 2026-07-15

## Source Manifest

### `@aukora/kernel` — from `packages/kernel/src/` (donor)

| File | Donor Path | Donor Blob SHA |
|------|-----------|----------------|
| `authority.ts` | `packages/kernel/src/authority.ts` | `eaee87f3` |
| `canonical.ts` | `packages/kernel/src/canonical.ts` | `45830df8` |
| `errors.ts` | `packages/kernel/src/errors.ts` | `4331c3cf` |
| `evidence.ts` | `packages/kernel/src/evidence.ts` | `a52b46a2` |
| `index.ts` | `packages/kernel/src/index.ts` | `ee97c70f` |
| `merkle.ts` | `packages/kernel/src/merkle.ts` | `537eda73` |
| `reducer.ts` | `packages/kernel/src/reducer.ts` | `782333d8` |
| `registry.ts` | `packages/kernel/src/registry.ts` | `d091b88d` |
| `schema.ts` | `packages/kernel/src/schema.ts` | `35335acf` |

### `@aukora/kernel` — from PR #20 (staleness brick, unmerged)

| File | Source | Source Blob SHA |
|------|--------|-----------------|
| `staleness.ts` | PR #20 `packages/kernel/src/staleness.ts` | `65f75483` |

- **PR #20 head**: `3e7ec3b25c474c5b54570b71f12acc515aac9aee`
- **PR #20 tree**: `e0b599e6af7330319f0d3f3c1c909374648f93e3`
- **Harvested without merge**: the PR remains open on the donor

### `@aukora/evidence` — from `src/evidence/` (donor)

| File | Donor Path | Donor Blob SHA |
|------|-----------|----------------|
| `types.ts` | `src/evidence/types.ts` | `d0e2f4d1` |
| `canonical.ts` | `src/evidence/canonical.ts` | `623b008a` |
| `digest.ts` | `src/evidence/digest.ts` | `1a07e9d4` |
| `framing.ts` | `src/evidence/framing.ts` | `ec698ba0` |
| `catalogue.ts` | `src/evidence/catalogue.ts` | `2b7ff7f3` |
| `validate.ts` | `src/evidence/validate.ts` | `2d6a247a` |
| `index.ts` | `src/evidence/index.ts` | `ba1a9e90` |

### `@aukora/council` — from `src/council/` (donor)

| File | Donor Path | Donor Blob SHA |
|------|-----------|----------------|
| `aukoraFuCouncil.ts` | `src/council/aukoraFuCouncil.ts` | `93bc046a` |
| `aukoraFuGlyph.ts` | `src/council/aukoraFuGlyph.ts` | `7081ab39` |
| `aukoraFuSpendLedger.ts` | `src/council/aukoraFuSpendLedger.ts` | `60d4407c` |

## Excluded Material

The following was present in the donor but intentionally excluded from the clean root:

- `apps/fu/` — Fu application (preserved in donor, will consume packages via rebase)
- `apps/symbiote/` — Symbiote organism (preserved in donor, will consume packages via rebase)
- `quarantine/nebius-g1/` — G1 governed evolution bundle (quarantined, unarmed)
- `research/energy-sensing/` — Digital metabolism / Borromean bridge (research only)
- `docs/design/RESOURCE_GOVERNOR.md` — Resource governor design (design only)
- `deferred-tests/`, `legacy/`, `dashboard/`, `server/`

## Verification

To verify provenance, compare blob SHAs:

```bash
git ls-tree HEAD packages/kernel/src/authority.ts | awk '{print $3}'
# Should match: eaee87f391b92a5a326f8ab9daa364f72a6963dc
```
