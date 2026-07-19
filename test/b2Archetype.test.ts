// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R60 — B2 mechanical archetype-applicability predicate + sealed budget (Sam 4 lane). Makes B2b
 * coverage computed, not narrated, and B2 budgets un-raisable after seal. Runs no game, claims no
 * result.
 */
import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain .mjs module
import { archetypeApplies, coverageFraction, sealBudget, verifyBudget } from '../scripts/b2-archetype.mjs';

const maze = { id: 'maze-nav', requires: ['grid', 'walls'], excludes: ['puzzle-attr'] };
const puzzle = { id: 'attr-match', requires: ['puzzle-attr'], excludes: ['moving-hazard'] };

describe('archetypeApplies — mechanical, fail-closed', () => {
  it('applies when all required features present and no excluded feature present', () => {
    expect(archetypeApplies(maze, { id: 'g1', features: ['grid', 'walls', 'moving-hazard'] })).toBe(true);
  });
  it('does not apply when a required feature is missing', () => {
    expect(archetypeApplies(maze, { id: 'g2', features: ['grid'] })).toBe(false);
  });
  it('does not apply when an excluded feature is present', () => {
    expect(archetypeApplies(maze, { id: 'g3', features: ['grid', 'walls', 'puzzle-attr'] })).toBe(false);
  });
  it('malformed archetype or game never applies (fail-closed)', () => {
    expect(archetypeApplies(null, { features: ['grid'] })).toBe(false);
    expect(archetypeApplies(maze, null)).toBe(false);
    expect(archetypeApplies({ requires: [] }, { features: ['grid'] })).toBe(false);
    expect(archetypeApplies({ requires: ['grid'] }, { notFeatures: [] })).toBe(false);
  });
});

describe('coverageFraction — the B2b number is computed', () => {
  it('reports the covered fraction over held-out games', () => {
    const games = [
      { id: 'a', features: ['grid', 'walls'] },        // maze applies
      { id: 'b', features: ['puzzle-attr'] },          // puzzle applies
      { id: 'c', features: ['text-only'] },            // neither applies
      { id: 'd', features: ['grid', 'walls', 'puzzle-attr'] }, // maze excluded; puzzle applies
    ];
    expect(coverageFraction([maze, puzzle], games)).toBeCloseTo(3 / 4);
  });
  it('empty inputs → 0 (never a spurious pass)', () => {
    expect(coverageFraction([], [])).toBe(0);
    expect(coverageFraction([maze], [])).toBe(0);
  });
});

describe('sealed budget — un-raisable after seal', () => {
  const budget = { maxActionsPerLevel: 60, wallClockSeconds: 120, tokenBudget: 0, hardwareClass: 'cpu-1' };
  it('the correct table verifies against its seal', () => {
    const seal = sealBudget(budget);
    expect(seal).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyBudget(budget, seal)).toBe(true);
    // key ordering does not change the seal (canonical)
    expect(verifyBudget({ hardwareClass: 'cpu-1', tokenBudget: 0, wallClockSeconds: 120, maxActionsPerLevel: 60 }, seal)).toBe(true);
  });
  it('a raised budget no longer matches the seal', () => {
    const seal = sealBudget(budget);
    expect(verifyBudget({ ...budget, maxActionsPerLevel: 600 }, seal)).toBe(false);
    expect(verifyBudget({ ...budget, wallClockSeconds: 3600 }, seal)).toBe(false);
  });
  it('a malformed seal is refused', () => {
    expect(verifyBudget(budget, 'short')).toBe(false);
    expect(verifyBudget(budget, null)).toBe(false);
  });
});
