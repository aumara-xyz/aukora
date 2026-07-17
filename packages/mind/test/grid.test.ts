// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
// Frame rendering is observation, not interpretation: segmentation finds the
// connected regions, renderDiff reports exactly what changed (no-ops loudly),
// and renderFrame assembles the one legible frame the mind reasons over.
// Re-authored from the ARC-AGI-3 reasoning engine, aukora-symbiote branch
// fable/arc3-reasoning-engine-20260710 @ e5768a2f.
import { describe, expect, it } from 'vitest';
import { renderDiff, renderFrame, renderGrid, segment, type Obs } from '../index.js';

describe('segment — connected color regions, background = most common color', () => {
  it('finds regions with size, box, and centroid, largest first', () => {
    const grid = [
      [0, 0, 0, 0],
      [0, 9, 9, 0],
      [0, 9, 9, 0],
      [0, 0, 8, 0],
    ];
    const seg = segment(grid);
    expect(seg.background).toBe(0);
    expect(seg.regions.length).toBe(2);
    expect(seg.regions[0]).toEqual({ color: 9, size: 4, box: { x0: 1, y0: 1, x1: 2, y1: 2 }, cx: 1.5, cy: 1.5 });
    expect(seg.regions[1].color).toBe(8);
    expect(seg.regions[1].size).toBe(1);
  });

  it('splits same-color cells that are not 4-connected into separate regions', () => {
    const grid = [
      [9, 0, 9],
      [0, 0, 0],
    ];
    const seg = segment(grid);
    expect(seg.regions.filter((r) => r.color === 9).length).toBe(2);
  });

  it('is safe on an empty grid', () => {
    expect(segment([])).toEqual({ background: 0, regions: [] });
  });
});

describe('renderGrid — cropped hex view with a background legend', () => {
  it('renders hex digits for colors and dots for background', () => {
    const text = renderGrid([
      [0, 0, 0],
      [0, 14, 0],
      [0, 0, 0],
    ], 0);
    expect(text).toContain('.e.'); // color 14 as hex, background as dots
    expect(text).toContain("'.' = background color 0 white");
  });
});

describe('renderDiff / renderFrame — observation, not interpretation', () => {
  it('reports a true no-op with changedCount 0', () => {
    const g = [[1, 2], [3, 4]];
    const d = renderDiff(g.map((r) => [...r]), g);
    expect(d.changedCount).toBe(0);
    expect(d.text).toContain('NO-OP');
  });

  it('reports the first frame with changedCount -1', () => {
    const d = renderDiff(null, [[1]]);
    expect(d.changedCount).toBe(-1);
    expect(d.text).toContain('first frame');
  });

  it('lists changed cells with from->to colors', () => {
    const d = renderDiff([[1, 2]], [[1, 5]]);
    expect(d.changedCount).toBe(1);
    expect(d.text).toContain('(1,0)2->5');
  });

  it('renders a full frame with state, actions, regions and grid', () => {
    const obs: Obs = {
      state: 'NOT_FINISHED',
      levelsCompleted: 0,
      winLevels: 2,
      availableActions: [1, 2, 3, 4],
      grid: [
        [0, 0, 0],
        [0, 9, 0],
        [0, 0, 0],
      ],
    };
    const r = renderFrame(obs, null);
    expect(r.changedCount).toBe(-1); // first frame: no prior
    expect(r.text).toContain('state NOT_FINISHED');
    expect(r.text).toContain('levels completed 0/2');
    expect(r.text).toContain('actions available this turn: 1, 2, 3, 4');
    expect(r.text).toContain('regions (non-background)');
    expect(r.text).toContain("'.' = background");
  });

  it('uses pre-computed segments when the observation carries them', () => {
    const obs: Obs = {
      state: 'NOT_FINISHED',
      levelsCompleted: 0,
      winLevels: 1,
      availableActions: [1],
      grid: [[0, 9]],
      segments: { background: 0, regions: [{ color: 9, size: 1, box: { x0: 1, y0: 0, x1: 1, y1: 0 }, cx: 1, cy: 0 }] },
    };
    const r = renderFrame(obs, null);
    expect(r.text).toContain('color  9');
  });
});
