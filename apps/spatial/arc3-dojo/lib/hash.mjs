// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Canonical content-addressing for ARC-3 Dojo receipts (#102 evidence protocol).
 *
 * A receipt's `coreHash` is sha256 over the canonicalized (sorted-key) deterministic core — the exact code
 * SHA, world/version, seeds, per-step actions + bounded reasons + frame-hash chain, and the terminal result.
 * The arcade session `guid` (a `Math.random()` value) and the node fingerprint are recorded OUTSIDE the hashed
 * core, so the coreHash replays byte-for-byte on a second node while the fingerprint proves it was a different
 * machine — the same separation used by the R49 conformance bundles.
 */
import { createHash } from 'node:crypto';

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value).sort()) out[k] = canonicalize(value[k]);
    return out;
  }
  return value;
}

export function sha256Hex(text) {
  return createHash('sha256').update(text).digest('hex');
}

export function coreHash(core) {
  return sha256Hex(JSON.stringify(canonicalize(core)));
}

export function nodeFingerprint() {
  return { node: process.version, platform: process.platform, arch: process.arch };
}
