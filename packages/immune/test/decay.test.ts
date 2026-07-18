// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R55 — the φ-decay relevance law (the resolution of the donor's phantom `@aukora/memory/decay.js`).
 * Imports the SHIPPED source (no inlined copy).
 */
import { describe, it, expect } from 'vitest';
import { PHI, PHI_INV, RELEVANCE_FLOOR, phiDecay, trigramDistance, decayGrantsAuthority } from '@aukora/immune';

describe('phiDecay — bounded exponential relevance in [PHI_INV, 1]', () => {
  it('is full at/under age 0 and at the floor as age → ∞', () => {
    expect(phiDecay(-5)).toBe(1);
    expect(phiDecay(0)).toBe(1);
    expect(phiDecay(Number.MAX_SAFE_INTEGER)).toBeCloseTo(PHI_INV, 12);
  });
  it('never drops below the PHI_INV archaeological floor, and PHI_INV = 1/φ', () => {
    expect(PHI_INV).toBeCloseTo(1 / PHI, 15);
    expect(RELEVANCE_FLOOR).toBe(PHI_INV);
    for (const age of [0, 1e6, 1e9, 1e12, 1e15]) expect(phiDecay(age)).toBeGreaterThanOrEqual(PHI_INV - 1e-12);
  });
  it('is monotonically non-increasing in age and returns the floor for a non-positive half-life', () => {
    let prev = Infinity;
    for (const age of [0, 1e3, 1e5, 1e7, 1e9]) { const v = phiDecay(age); expect(v).toBeLessThanOrEqual(prev + 1e-12); prev = v; }
    expect(phiDecay(1000, 1, 0)).toBe(PHI_INV);
    expect(phiDecay(1000, 1, -5)).toBe(PHI_INV);
  });
});

describe('trigramDistance — Jaccard distance, the repo keeps exactly one `tilde` (council)', () => {
  it('is 0 for identical, 1 for fully disjoint, symmetric, and in [0,1]', () => {
    expect(trigramDistance('quarantine now', 'quarantine now')).toBe(0);
    expect(trigramDistance('aaaa', 'zzzz')).toBe(1);
    expect(trigramDistance('', '')).toBe(0);
    expect(trigramDistance('abc', '')).toBe(1);
    const d1 = trigramDistance('grant authority', 'grant power');
    expect(d1).toBe(trigramDistance('grant power', 'grant authority')); // symmetric
    expect(d1).toBeGreaterThan(0); expect(d1).toBeLessThan(1);
  });
  it('grants no authority', () => { expect(decayGrantsAuthority()).toBe(false); });
});
