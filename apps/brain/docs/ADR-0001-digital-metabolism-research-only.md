<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# ADR-0001 — Digital metabolism: RESEARCH_ONLY

**Status:** accepted (research-only) · **Scope:** `apps/brain` · **Round:** R32

## Context

The owner provided digital-metabolism research (homeostatic-balance framing, per the Sovereign Compute master
plan). It is treated **RESEARCH_ONLY**. This ADR is a sanitized architecture decision — **not** an authority
implementation. No metabolism signal may ever grant authority, mint a challenge, or widen a budget.

## Decision

If prototyped at all, digital metabolism is a **pure, deterministic, advisory SIMULATOR** with **integer
fixed-point** inputs that can **only CONTRACT a ceiling** (ratchet a budget down) and **never grant authority**.
Authority stays in the kernel/AUMLOK layer, outside and above. The reference prototype is
`apps/brain/src/metabolismSimulator.ts`.

## Hazards corrected BEFORE any code

| Hazard | Correction |
| --- | --- |
| Dimensional mismatch in sensor normalization | Every sample declares `dimension` + integer `unitScale`; normalization is per-sample integer division to canonical budget units. Dimensions are never summed together. |
| Ambient clocks | No ambient clock. Time is an injected integer `timestampMs`; samples must be monotonically non-decreasing or they are refused. |
| Missing event/sample schema | Explicit `MetabolismSampleV1` / `MetabolismStateV1` schemas with total validation; malformed input is refused (fail-closed). |
| Non-canonical floating hashes | State is all-integer; the state hash is the **canonical** hash (`@aukora/kernel`) over integers — no float ever enters a hash. |
| Untrusted sensors | `trusted:false` samples are advisory-only and **cannot** contract the ceiling (no adversarial ratchet or DoS-to-zero); only trusted, in-schema samples contract. |
| Active stress challenges | The simulator issues **no** challenge and **no** effect. It only observes and advises. |
| Unproven "topological isomorphism" | Explicitly **UNPROVEN**. The simulator is a bounded advisory **analogy**, not a proof of isomorphism; no claim rests on it. |

## Consequences

- The ceiling is a **monotone ratchet DOWN**; releasing/raising a budget is a separate, explicit owner action
  outside this module.
- `metabolismGrantsAuthority()` is constant `false`.
- Truth discipline (R32 item 5) is unaffected: no model is claimed trained from this research.
