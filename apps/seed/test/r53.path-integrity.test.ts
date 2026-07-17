// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Candidate path collision integrity (#22 overnight · HARDEN GIT). Pins the APFS-equivalence collision check:
 * two candidate paths that differ only in case OR only in Unicode NFC/NFD form collide on disk and must refuse,
 * closing the Unicode-normalization dimension the existing case-fold-only check misses.
 */
import { describe, it, expect } from 'vitest';
import {
  pathCollisionKey, detectCandidatePathCollisions, pathsCollide, candidatePathIntegrityGrantsAuthority,
} from '../src/index.js';

/** Narrow a refused verdict to its reason class (throws if it unexpectedly passed). */
function reasonOf(v: ReturnType<typeof detectCandidatePathCollisions>): string {
  if (v.ok) throw new Error('expected a collision but the set passed');
  return v.reasonClass;
}

// "café.ts" two ways, built from explicit code points so the byte sequences are guaranteed distinct
// regardless of how this file is saved: precomposed \u00e9 vs base 'e' + combining acute \u0301.
const CAFE_NFC = 'apps/seed/src/caf\u00e9.ts';        // NFC (precomposed é)
const CAFE_NFD = 'apps/seed/src/cafe\u0301.ts';       // NFD (e + combining acute)

describe('pathCollisionKey — APFS equivalence (NFC + case-fold)', () => {
  it('folds NFC and NFD forms of the same name to one key', () => {
    expect(CAFE_NFC).not.toBe(CAFE_NFD);                        // the raw strings genuinely differ
    expect(pathCollisionKey(CAFE_NFC)).toBe(pathCollisionKey(CAFE_NFD));
  });
  it('folds letter case to one key', () => {
    expect(pathCollisionKey('apps/seed/src/File.ts')).toBe(pathCollisionKey('apps/seed/src/file.ts'));
  });
  it('keeps genuinely different names distinct', () => {
    expect(pathCollisionKey('a.ts')).not.toBe(pathCollisionKey('b.ts'));
  });
  it('grants no authority', () => {
    expect(candidatePathIntegrityGrantsAuthority()).toBe(false);
  });
});

describe('detectCandidatePathCollisions — fail-closed, order-stable', () => {
  it('a Unicode NFC vs NFD pair collides (the gap the case-fold-only check misses)', () => {
    const v = detectCandidatePathCollisions([CAFE_NFC, CAFE_NFD]);
    expect(v.ok).toBe(false);
    expect(reasonOf(v)).toBe('candidate:path-collision');
    expect((v as { colliding: readonly [string, string] }).colliding).toEqual([CAFE_NFC, CAFE_NFD]);
  });

  it('a case-fold pair collides', () => {
    const v = detectCandidatePathCollisions(['x/File.ts', 'x/file.ts']);
    expect(v.ok).toBe(false);
    expect(reasonOf(v)).toBe('candidate:path-collision');
  });

  it('an exact duplicate string is a distinct duplicate-path refusal', () => {
    const v = detectCandidatePathCollisions(['a.ts', 'a.ts']);
    expect(v.ok).toBe(false);
    expect(reasonOf(v)).toBe('candidate:duplicate-path');
  });

  it('a genuinely distinct set passes', () => {
    expect(detectCandidatePathCollisions(['a.ts', 'b.ts', 'sub/c.ts']).ok).toBe(true);
    expect(detectCandidatePathCollisions([CAFE_NFC]).ok).toBe(true); // a single normalized path is fine
  });

  it('detects a collision between NON-adjacent entries (earliest-seen reported first)', () => {
    const v = detectCandidatePathCollisions(['a.ts', 'b.ts', 'A.ts']);
    expect(v.ok).toBe(false);
    expect((v as { colliding: readonly [string, string] }).colliding).toEqual(['a.ts', 'A.ts']);
  });
});

describe('pathsCollide — pairwise predicate', () => {
  it('true for case/normalization equivalents, false for distinct', () => {
    expect(pathsCollide(CAFE_NFC, CAFE_NFD)).toBe(true);
    expect(pathsCollide('File.ts', 'file.ts')).toBe(true);
    expect(pathsCollide('a.ts', 'b.ts')).toBe(false);
  });
});
