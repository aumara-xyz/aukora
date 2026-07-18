# @aukora/immune — provenance (R55 skunkworks intake)

**Disposition:** `RESEARCH_NEW` — a metaphorical immune-system substrate. Not biology, not aliveness, not
production. Advisory only; grants no authority.

## Donor
- **Source:** draft PR #121 (`convergence/kimi-overnight`) head `8a1107379ca7ebf4728fd7c353f3d6bde164521c`.
- **Base of this package:** public `main@1394321fffd5de6296d44423d097e4e6199ab62b`.

## Extracted (adapted, not verbatim — so no CANONICAL_BLOBS pin claim)
Copied from `packages/immune/src/**` in the donor, then adapted. This package is **NOT byte-identical to the
donor**: beyond the structural repoint below, review rounds R55.1–R55.3 applied **deliberate behavioral
adaptations** (correctness/safety fixes). The record below is exhaustive so the adapted package is honestly
distinguished from the donor prototype — **do NOT read this as "no behavior change."**

- `thymus.ts`, `engagement.ts`, `inflammation.ts`, `killerT.ts`, `antibody.ts`, `memoryB.ts`, `homeostasis.ts`,
  `patrol.ts`, `petriDish.ts` — the pure, offline, advisory substrate.
- **Structural (every module):** the donor's phantom `import … from '@aukora/memory/decay.js'` (a module that never
  existed in the shipped tree) is repointed to a single in-package `./decay.js` (see Decay resolution); `patrol.ts`
  `tilde(...)` → `trigramDistance(...)`.
- **Behavioral adaptations shipped (differ from the donor):**
  - `decay.ts` — `phiDecay` result is CLAMPED to `[PHI_INV, 1]` on every path.
  - `homeostasis.ts` — `computeHomeostasisTarget` thresholds aligned to mirror `computeInflammation` (no stuck
    target-above-current); cooldown math corrected to require elapsed time (a level de-escalates only after ≥1
    half-life, not on every call).
  - `petriDish.ts` — deterministic event timestamps (mandatory injected `timestampMs`, no `Date.now()`);
    cycle-driven antibody binds + memory recalls now persist reinforcement; Killer-T executes only against its exact
    target (content-based fallback removed); homeostasis projection applies only on zero-finding cooldown cycles and
    fresh findings clear stale cooldown; the cycle snapshot is finalized + frozen before emit and reports the
    effective post-homeostasis level; `PetriBus` `maxHistory<=0` retains no history.
  - `engagement.ts` — recommendation-only shape (`recommended` + `advisoryOnly/grantsAuthority:false/executionAllowed:false`);
    `recommended` requires every planned action permitted by the RoE; council approval normalized structurally true
    (no preset bypass, no contradictory markers); deterministic timestamp (required `nowMs`).
  - `killerT.ts` — `executeKillerT` enforces target identity; `checkAutoimmunity` ignores empty self-patterns.
  - `antibody.ts` / `memoryB.ts` — matching fails closed on empty patterns; `patrol.ts` anomaly match is fully
    case-insensitive.

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
