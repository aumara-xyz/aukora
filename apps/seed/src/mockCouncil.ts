// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Deterministic advisory review (offline).
 *
 * Uses the canonical @aukora/council claim-basis primitives to freeze and verify the review basis, then returns
 * an ADVISORY verdict only. No live provider, no paid call, no authority: even a passing review authorizes
 * nothing — only the owner-gate does.
 */
import { freezeClaimBasis, verifyClaimBasis } from '@aukora/council';

export interface CouncilVerdict {
  readonly verdict: 'advisory-pass' | 'advisory-hold';
  readonly grantsAuthority: false;
  readonly basisValid: boolean;
  readonly reason: string;
}

/**
 * Deterministic offline review. `now` is injected (no ambient clock). Passes only when the frozen claim basis
 * verifies and there is a claim to review; the verdict is purely advisory.
 */
export function mockCouncilReview(problem: string, claimTexts: readonly string[], now: number): CouncilVerdict {
  const basis = freezeClaimBasis(problem, claimTexts, now);
  const basisValid = verifyClaimBasis(basis, problem);
  const pass = basisValid && claimTexts.length > 0;
  return {
    verdict: pass ? 'advisory-pass' : 'advisory-hold',
    grantsAuthority: false,
    basisValid,
    reason: pass
      ? 'advisory review passed (deterministic offline; no live provider contacted)'
      : 'advisory hold (basis invalid or no claim)',
  };
}

export function councilGrantsAuthority(): false {
  return false;
}
