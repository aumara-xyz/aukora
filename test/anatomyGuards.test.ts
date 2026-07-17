// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/** R46 amendment proofs — the three owner-hold items, each pinned by a test. */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
// @ts-expect-error — plain .mjs module
import { norm, inScope } from '../scripts/verify-anatomy.mjs';

describe('R46 amend 1 — boundary-aware scope membership', () => {
  it('a sibling directory sharing a prefix is NOT inside the scope', () => {
    expect(inScope('apps/supervisor/src2/x.mjs', 'apps/supervisor/src')).toBe(false);
    expect(inScope('apps/supervisor/srcX', 'apps/supervisor/src')).toBe(false);
  });
  it('the exact scope and true descendants ARE inside', () => {
    expect(inScope('apps/supervisor/src', 'apps/supervisor/src')).toBe(true);
    expect(inScope('apps/supervisor/src/engine.mjs', 'apps/supervisor/src')).toBe(true);
  });
  it('norm folds backslashes and trailing slashes', () => {
    expect(norm('a\\b\\c.mjs')).toBe('a/b/c.mjs');
    expect(norm('a/b/')).toBe('a/b');
  });
});

describe('R46 amend 2 — atlas capability field carries no disposition aliases', () => {
  it('no row.capability is a disposition alias; unresolved rows carry family_status', () => {
    const atlas = JSON.parse(readFileSync('docs/atlas/ATLAS.json', 'utf8'));
    const aliases = new Set(['done/verified', 'blocked/owner', 'research/parked', 'product/pending-owner-ruling', 'nebius/parked-local-phase', 'core/restore-queue', 'core/active']);
    for (const r of atlas.rows) {
      expect(aliases.has(r.capability), `row ${r.source}#${r.number} capability is a disposition alias`).toBe(false);
      if (r.capability === 'uncategorized') expect(typeof r.family_status).toBe('string');
    }
  });
});

describe('R46 amend 3 — workbench readiness stdout is pure JSON', () => {
  it('stdout parses as a single JSON document; the human summary is not on stdout', () => {
    const stdout = execFileSync('node', ['scripts/workbench-readiness.mjs'], { encoding: 'utf8' });
    const profile = JSON.parse(stdout); // throws if contaminated
    expect(profile.schema).toBe('aukora-workbench-readiness-v0');
    expect(stdout).not.toMatch(/READY-or-PARTIAL/);
  });
});
