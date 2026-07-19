// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R58 — no-overclaim guard regression suite (Sam 4 lane).
 *
 * The R57A public audit found the guard's phrase list predated the ARC/AGRE claims (coverage gap):
 * "beats ARC-AGI-3", "5 levels beaten", and "189KB engine" style assertions sailed through. This
 * suite pins the new ARC result/size patterns AND the allowance law: quoted, refuted, discussed,
 * and explicitly truth-labeled lines stay legal, so truth-repair documents can name the claims they
 * refute. This file is itself a scanner fixture (registered in SCANNER_FIXTURES): every assertion
 * string below is hostile VECTOR DATA for the guard, never a claim made by this repository.
 */
import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain .mjs module
import { scanAddedLines, allowedReason, OVERCLAIMS } from '../scripts/verify-no-overclaim.mjs';

const diffOf = (file: string, lines: string[]): string =>
  `diff --git a/${file} b/${file}\n--- a/${file}\n+++ b/${file}\n@@ -0,0 +1,${lines.length} @@\n${lines.map((l) => `+${l}`).join('\n')}\n`;

const names = (violations: { phrase: string }[]): string[] => violations.map((v) => v.phrase).sort();

describe('R58 ARC/AGRE overclaim coverage — assertion forms fail', () => {
  it('bare beaten-level assertions are violations', () => {
    expect(names(scanAddedLines(diffOf('docs/x.md', ['The engine beats level 4 of the dojo consistently.'])))).toContain('arc-level-beaten');
    expect(names(scanAddedLines(diffOf('docs/x.md', ['5 levels beaten in round 1.'])))).toContain('arc-level-beaten');
  });

  it('solved/won-game assertions naming TU93/LS20/ARC-AGI are violations', () => {
    expect(names(scanAddedLines(diffOf('docs/x.md', ['We solved TU93 with pure BFS.'])))).toContain('arc-game-solved');
    expect(names(scanAddedLines(diffOf('docs/x.md', ['Our engine beats ARC-AGI-3 with source analysis.'])))).toContain('arc-game-solved');
    expect(names(scanAddedLines(diffOf('docs/x.md', ['v14 won LS20 on the second try.'])))).toContain('arc-game-solved');
  });

  it('official-result assertions are violations', () => {
    expect(names(scanAddedLines(diffOf('docs/x.md', ['This constitutes an official ARC-AGI-3 result.'])))).toContain('arc-official-result');
  });

  it('size-boast assertions are violations', () => {
    expect(names(scanAddedLines(diffOf('docs/x.md', ['Total: 189KB of falsifiable source-first reasoning engine.'])))).toContain('arc-size-boast');
    expect(names(scanAddedLines(diffOf('docs/x.md', ['ships a 44KB integration engine'])))).toContain('arc-size-boast');
  });
});

describe('R58 allowance law — quoted / refuted / discussed / truth-labeled lines stay legal', () => {
  it('a quoted phrase is allowed', () => {
    expect(scanAddedLines(diffOf('docs/x.md', ['The report said "levels beaten" without evidence attached.']))).toHaveLength(0);
  });

  it('a refuted/negated assertion is allowed', () => {
    expect(scanAddedLines(diffOf('docs/x.md', ['It never beats level 4; the run was not reproducible.']))).toHaveLength(0);
    expect(scanAddedLines(diffOf('docs/x.md', ['This is never an official ARC-AGI-3 result.']))).toHaveLength(0);
  });

  it('discussing the claim as a claim is allowed', () => {
    expect(scanAddedLines(diffOf('docs/x.md', ['The claim that the engine beats level 4 has no receipts.']))).toHaveLength(0);
    expect(scanAddedLines(diffOf('docs/x.md', ['They claimed 189KB of reasoning engine modules.']))).toHaveLength(0);
    expect(scanAddedLines(diffOf('docs/x.md', ['The report asserted the engine beats level 4 of TU93.']))).toHaveLength(0);
  });

  it('an explicit UPPERCASE truth label unlocks the line (the labeling law in action)', () => {
    expect(scanAddedLines(diffOf('docs/x.md', ['Beats level 4: UNPROVEN — no artifact on any branch.']))).toHaveLength(0);
    expect(scanAddedLines(diffOf('docs/x.md', ['189KB reasoning engine — FALSIFIED by the audit.']))).toHaveLength(0);
  });

  it('lowercase "inference"/"stale" prose does NOT unlock an assertion (label allowance is case-sensitive)', () => {
    const v = scanAddedLines(diffOf('docs/x.md', ['The inference engine beats level 4 every time.']));
    expect(names(v)).toContain('arc-level-beaten');
    expect(allowedReason('The inference engine beats level 4 every time.', 'beats level', 21, 11)).toBeNull();
  });
});

describe('pre-R58 behavior preserved', () => {
  it('the original patterns still fire on bare boasts', () => {
    expect(names(scanAddedLines(diffOf('docs/x.md', ['This subsystem is production-grade now.'])))).toContain('production-grade');
    expect(names(scanAddedLines(diffOf('docs/x.md', ['The gate is unbreakable.'])))).toContain('unbreakable');
  });

  it('process-liveness "alive" stays legal', () => {
    expect(scanAddedLines(diffOf('docs/x.md', ['the daemon is alive and serving on port 7096']))).toHaveLength(0);
  });

  it('scanner fixtures (the guard + this suite) are exempt as vector carriers', () => {
    expect(scanAddedLines(diffOf('test/noOverclaimGuards.test.ts', ['The engine beats level 4 and is production-grade.']))).toHaveLength(0);
    expect(scanAddedLines(diffOf('scripts/verify-no-overclaim.mjs', ['unbreakable production-grade']))).toHaveLength(0);
    // but the exemption does not travel to other paths
    expect(scanAddedLines(diffOf('docs/other.md', ['The engine beats level 4 flawlessly.'])).length).toBeGreaterThan(0);
  });

  it('the pattern table carries the R58+R59 ARC patterns exactly once each', () => {
    const arc = (OVERCLAIMS as { name: string }[]).filter((o) => o.name.startsWith('arc-')).map((o) => o.name).sort();
    expect(arc).toEqual(['arc-bare-solved', 'arc-game-solved', 'arc-level-beaten', 'arc-levels-cleared', 'arc-official-result', 'arc-size-boast']);
  });
});

describe('R60 ARC "solved/cleared/won/completed N levels" bypass closed (R59 audit P1)', () => {
  it('the four achievement verbs with a numeric level count are violations', () => {
    expect(names(scanAddedLines(diffOf('docs/x.md', ['The agent solved 5 levels of TU93 blind.'])))).toContain('arc-levels-cleared');
    expect(names(scanAddedLines(diffOf('docs/x.md', ['We cleared 12 levels in the dojo.'])))).toContain('arc-levels-cleared');
    expect(names(scanAddedLines(diffOf('docs/x.md', ['The engine won 3 levels on the first try.'])))).toContain('arc-levels-cleared');
    expect(names(scanAddedLines(diffOf('docs/x.md', ['It completed all 5 levels unaided.'])))).toContain('arc-levels-cleared');
  });
  it('determiner and reversed forms fire', () => {
    expect(names(scanAddedLines(diffOf('docs/x.md', ['It solved the first 3 levels.'])))).toContain('arc-levels-cleared');
    expect(names(scanAddedLines(diffOf('docs/x.md', ['5 levels solved with pure BFS.'])))).toContain('arc-levels-cleared');
    expect(names(scanAddedLines(diffOf('docs/x.md', ['12 levels were completed in one run.'])))).toContain('arc-levels-cleared');
  });
  it('ordinary prose with "level" but no achievement-verb+numeric-count stays legal', () => {
    expect(scanAddedLines(diffOf('docs/x.md', ['The config has 3 levels of nesting.'])).length).toBe(0);
    expect(scanAddedLines(diffOf('docs/x.md', ['Escalated to level 2 support after triage.'])).length).toBe(0);
    expect(scanAddedLines(diffOf('docs/x.md', ['We completed the second level of review.'])).length).toBe(0);
    expect(scanAddedLines(diffOf('docs/x.md', ['The planner cleared the cache at level 5.'])).length).toBe(0);
    expect(scanAddedLines(diffOf('docs/x.md', ['The menu nests four levels deep.'])).length).toBe(0);
  });
  it('quoted / refuted / discussed / truth-labeled level-count claims stay legal', () => {
    expect(scanAddedLines(diffOf('docs/x.md', ['The report "solved 5 levels" with no receipts attached.'])).length).toBe(0);
    expect(scanAddedLines(diffOf('docs/x.md', ['It never solved 5 levels; the run failed.'])).length).toBe(0);
    expect(scanAddedLines(diffOf('docs/x.md', ['The claim that it cleared 12 levels has no artifact.'])).length).toBe(0);
    expect(scanAddedLines(diffOf('docs/x.md', ['Completed 5 levels: UNPROVEN — no scorecard on any branch.'])).length).toBe(0);
  });
});

describe('R59 bare-"ARC" bypass closed (R58 audit VERIFIED gap)', () => {
  it('"solved the ARC game" is a violation (the exact audited bypass)', () => {
    expect(names(scanAddedLines(diffOf('docs/x.md', ['We solved the ARC game with pure source analysis.'])))).toContain('arc-bare-solved');
  });
  it('reversed form and other verbs fire too', () => {
    expect(names(scanAddedLines(diffOf('docs/x.md', ['The ARC game was finally won by the planner.'])))).toContain('arc-bare-solved');
    expect(names(scanAddedLines(diffOf('docs/x.md', ['Our engine beats ARC consistently.'])))).toContain('arc-bare-solved');
  });
  it('lowercase "arc" prose stays legal (case-sensitive token)', () => {
    expect(scanAddedLines(diffOf('docs/x.md', ['the arc of the story was won by patience'])).length).toBe(0);
    expect(scanAddedLines(diffOf('docs/x.md', ['she solved the arc-welding alignment problem'])).length).toBe(0);
  });
  it('ARC-AGI forms stay owned by arc-game-solved (patterns disjoint)', () => {
    const v = names(scanAddedLines(diffOf('docs/x.md', ['Our engine beats ARC-AGI-3 with source analysis.'])));
    expect(v).toContain('arc-game-solved');
    expect(v).not.toContain('arc-bare-solved');
  });
  it('quoted / refuted / truth-labeled bare-ARC lines stay legal', () => {
    expect(scanAddedLines(diffOf('docs/x.md', ['The claim "solved the ARC game" carries no receipts.'])).length).toBe(0);
    expect(scanAddedLines(diffOf('docs/x.md', ['We never solved the ARC game; the run was not reproducible.'])).length).toBe(0);
    expect(scanAddedLines(diffOf('docs/x.md', ['Solved the ARC game: UNPROVEN — no artifact on any branch.'])).length).toBe(0);
  });
});
