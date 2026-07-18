# @aukora/immune — provenance (R55 skunkworks intake)

**Disposition:** `RESEARCH_NEW` — a metaphorical immune-system substrate. Not biology, not aliveness, not
production. Advisory only; grants no authority.

## Donor
- **Source:** draft PR #121 (`convergence/kimi-overnight`) — extracted from commit `8a1107379ca7ebf4728fd7c353f3d6bde164521c` (the `MERGE_BRIEF_IMMUNE_SYSTEM.md` extraction-source commit, NOT PR #121's head; that PR's current head is `70639ac01dcb`).
- **Base of this package:** public `main@1394321fffd5de6296d44423d097e4e6199ab62b`.

## Extracted (adapted, not verbatim — so no CANONICAL_BLOBS pin claim)
Copied from `packages/immune/src/**` in the donor, then adapted:
- `thymus.ts`, `engagement.ts`, `inflammation.ts`, `killerT.ts`, `antibody.ts`, `memoryB.ts`, `homeostasis.ts`,
  `patrol.ts`, `petriDish.ts` — the pure, offline, advisory substrate.
- Adaptation applied to every module: the donor's phantom `import … from '@aukora/memory/decay.js'` (a module that
  never existed in the shipped tree) is repointed to a single in-package `./decay.js`.
- `petriDish.ts`: one strict-mode fix (`readonly` widening on `matchedAntibodies`); no behavior change.
- `patrol.ts`: `tilde(...)` → `trigramDistance(...)` (see Decay resolution).

## Decay resolution (the phantom `@aukora/memory/decay.js`)
`@aukora/memory` defines no decay/φ primitives, and the repo's ONE `tilde` is `@aukora/council`'s glyph-shear
operator over GlyphPackets — a *different* operation from the donor's string-trigram `tilde`. To resolve WITHOUT
creating a second incompatible decay/tilde, `src/decay.ts`:
- provides only the golden-ratio relevance decay the substrate uses (`PHI`, `PHI_INV`, `phiDecay`) — the first
  φ-relevance-decay in the shipped tree (council's `decayShear` decays a different quantity);
- renames the trigram-distance operator to `trigramDistance` so `@aukora/council` remains the one and only `tilde`.

## Deliberately REJECTED (not extracted)
- `proprioception.ts` — a system prompt ("hand in glove" for Inkling/K3). Excluded: the directive forbids live
  prompt wiring; a prompt is not substrate.
- The donor's `test/immune-standalone.ts` (1328 lines) — a standalone script that *inlined* copies of the modules.
  Deleted and replaced by four real suites under `test/**` that import the SHIPPED source (`@aukora/immune`).
  The donor's "14 Petri tests" claim is retired; the shipped `petriDish.test.ts` re-proves the dish as a pure fold.
- No council / swarm / ARC / KIRA modules, no Convex, no actuator, no raw donor reports were imported (verified: the
  only imports in `src/**` are relative siblings — see `test/advisory-boundary.test.ts`).

## Boundaries (test-enforced)
Advisory only (`immuneGrantsAuthority(): false`); no actuator (no process/fs/net); no persistence (no Convex/KIRA);
no prompt wiring; terminology explicitly metaphorical; no aliveness/production-grade claim.
