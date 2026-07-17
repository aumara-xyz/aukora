// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Content-addressing for the R52 canonical-path evidence bundle (#115).
 *
 * `coreHash` is sha256 over the canonicalized (sorted-key) deterministic core — the per-stage labels + the
 * governed receipt/candidate/projection hashes the in-process production path produces. Environment-specific
 * facts (node fingerprint, live Convex pids, timestamps) are recorded OUTSIDE the hashed core, so the bundle
 * is SELF-VERIFYING: a fresh clone re-running the deterministic path reproduces the SAME coreHash.
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

export const sha256Hex = (text) => createHash('sha256').update(text).digest('hex');
export const coreHash = (core) => sha256Hex(JSON.stringify(canonicalize(core)));
export const nodeFingerprint = () => ({ node: process.version, platform: process.platform, arch: process.arch });
