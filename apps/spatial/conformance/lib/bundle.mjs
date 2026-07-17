// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Content-addressed evidence bundle for the R49 conformance cells (K3 artifact protocol, issue #15).
 *
 * Two parts, deliberately separated:
 *
 *   1. CORE — the deterministic result of a cell: schema, cell name, base commit, seed, exact inputs,
 *      per-vector outcomes, and the aggregate verdict. The core is canonicalized (sorted keys) and
 *      sha256-addressed. This `coreHash` is what MUST MATCH across two independent nodes — it is the
 *      "deterministic replay" crossing the promotion contract asks for.
 *
 *   2. ENVIRONMENT — the node fingerprint (node version, platform, arch). This is EXPECTED to differ
 *      between nodes; it is what proves a matching coreHash came from two DIFFERENT machines. It is
 *      recorded OUTSIDE the hashed core precisely so it never perturbs the replay hash.
 *
 * No secrets, keys, tokens, or absolute home paths ever enter a bundle — the cells only ever fabricate
 * hostile/synthetic values from the seed, and refusals are recorded as stable reason CLASSES, not payloads.
 */
import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ARTIFACT_DIR = join(HERE, '..', 'artifacts');

/** Canonical JSON: object keys sorted recursively, so the hash is stable regardless of insertion order. */
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

/** The reproducible content address of a cell's deterministic core. */
export function coreHash(core) {
  return sha256Hex(JSON.stringify(canonicalize(core)));
}

/** The machine fingerprint — recorded, never hashed into the core. */
export function nodeFingerprint() {
  return {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
  };
}

/**
 * Build a full bundle object. `core` is the deterministic result; `firstHand` declares whether the cell
 * actually executed the interface (true here — every cell runs the real code in-process).
 */
export function makeBundle({ core, firstHand = true, surface }) {
  const hash = coreHash(core);
  return {
    schema: 'aukora-conformance-bundle-v1',
    coreHash: hash,
    core,
    environment: nodeFingerprint(),
    execution: { firstHand, mode: 'in-process' },
    // Explicit authority / network / secret surface declaration (K3 contract).
    surface: {
      grantsAuthority: false,
      network: 'none (in-process, no sockets)',
      secretsTouched: 'none',
      mutatesMain: false,
      ...surface,
    },
  };
}

/** Write a bundle to artifacts/<cell>.json. Deterministic core ⇒ committing it is safe and re-runs replay it. */
export function writeBundle(cellName, bundle) {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  const path = join(ARTIFACT_DIR, `${cellName}.json`);
  writeFileSync(path, JSON.stringify(bundle, null, 2) + '\n');
  return path;
}
