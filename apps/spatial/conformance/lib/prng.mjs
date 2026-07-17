// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Deterministic seeded PRNG for the R49 conformance cells.
 *
 * The K3 test-cell contract (issue #15) requires "exact test/task seed" so a run can be replayed
 * byte-for-byte on a second node. A wall-clock or Math.random() source would make every run unique
 * and unreproducible — the opposite of what conformance evidence needs. So every hostile vector,
 * every observation world, every stress record here is drawn from this pure function of the seed.
 *
 * mulberry32: a small, well-distributed 32-bit generator. Not cryptographic — it does not need to be;
 * it only needs to be DETERMINISTIC and portable across Node versions and platforms.
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A tiny seeded helper bundle: floats, ints, picks, and a deterministic hex-ish token. */
export function seededRng(seed) {
  const next = mulberry32(seed);
  const int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
  const pick = (arr) => arr[int(0, arr.length - 1)];
  const bool = (p = 0.5) => next() < p;
  // deterministic pseudo-token (NOT a secret; used only to fabricate hostile tokens/nonces)
  const token = (n = 12) => {
    const hex = '0123456789abcdef';
    let s = '';
    for (let i = 0; i < n; i++) s += hex[int(0, 15)];
    return s;
  };
  return { next, int, pick, bool, token };
}
