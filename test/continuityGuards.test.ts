// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R51 continuity guards (issue #106) — the truth-compiler asserted as tests.
 *
 * These prove the three continuity views stay reconciled: the 191-row preservation ledger, the Atlas
 * (refreshed through the merged head), executable anatomy, and the committed GitHub object snapshot. A
 * regression in any count, a stale Atlas, a laundered anatomy scope, or a leaked private title fails here.
 */
import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain .mjs module
import { runContinuity } from '../scripts/verify-continuity.mjs';

const r = runContinuity();

describe('R51 continuity — the whole reconciliation is green', () => {
  it('verify-continuity reports zero reconciliation errors', () => {
    expect(r.errors, r.errors.join('\n')).toEqual([]);
  });
  it('the ledger is exactly the 191-row lossless inventory', () => {
    expect(r.entries).toBe(191);
  });
  it('the Atlas carries every current object plus the historical rows', () => {
    expect(r.atlasRows).toBeGreaterThanOrEqual(301);
    expect(r.currentObjects).toBe(110);
  });
  it('executable anatomy enforces coverage beyond supervisor-only', () => {
    expect(r.scopes).toBeGreaterThanOrEqual(3);
  });
});
