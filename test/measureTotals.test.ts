// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R59 — measured-totals parser regression suite (Sam 1 lane).
 *
 * The R58 audit found (VERIFIED cosmetic defect) that the gated-skip regex double-counted: the bare
 * /(\d+) skipped/ matched BOTH the test-level "Tests … N skipped" line and vitest's file-level
 * "Test Files … skipped" summary, publishing 3 where the real test-level skip count is 2. This
 * suite pins the parser to test-level lines only, for both the passed and skipped figures.
 */
import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain .mjs module
import { parseTotals } from '../scripts/measure-test-totals.mjs';

const VITEST_BLOCK = [
  ' Test Files  12 passed | 1 skipped (13)',
  '      Tests  1471 passed | 2 skipped (1473)',
  '   Start at  06:00:00',
  '   Duration  10.0s',
].join('\n');

describe('R59 gated-skip measurement — test-level lines only', () => {
  it('does NOT double-count the "Test Files … skipped" summary line (the audited defect)', () => {
    expect(parseTotals(VITEST_BLOCK)).toEqual({ passed: 1471, gatedSkips: 2 });
  });

  it('sums across multiple suite blocks, still test-level only', () => {
    const log = [
      ' Test Files  3 passed | 2 skipped (5)',
      '      Tests  100 passed | 1 skipped (101)',
      'other output',
      ' Test Files  1 passed (1)',
      '      Tests  25 passed | 1 skipped (26)',
    ].join('\n');
    expect(parseTotals(log)).toEqual({ passed: 125, gatedSkips: 2 });
  });

  it('a block with no skips contributes zero skips', () => {
    const log = [' Test Files  1 passed (1)', '      Tests  43 passed (43)'].join('\n');
    expect(parseTotals(log)).toEqual({ passed: 43, gatedSkips: 0 });
  });

  it('a stray "N skipped" outside a Tests line never counts', () => {
    const log = ['note: 7 skipped due to weather', '      Tests  10 passed | 1 skipped (11)'].join('\n');
    expect(parseTotals(log)).toEqual({ passed: 10, gatedSkips: 1 });
  });
});
