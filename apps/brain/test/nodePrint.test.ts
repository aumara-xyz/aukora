// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * AukoraNodePrintV1: secret-free canonical print; deterministic printId; and the proof that a local node and a
 * Nebius node are stamped from the SAME print/schema, differing ONLY through an explicit adapter — with the
 * Nebius node fail-closed until real digests + a matching enabled runtime manifest exist.
 */
import { describe, it, expect } from 'vitest';
import {
  buildNodePrint,
  validateNodePrint,
  nodePrintId,
  instantiateNode,
  nodePrintGrantsAuthority,
  type NebiusDeploymentManifest,
} from '../src/index.js';

const budgets = { maxGenerations: 4, maxWallClockMs: 30000, maxOutputTokens: 512, maxCostMicroUsd: 500000, maxPatchBytes: 65536 };
const offlinePrint = () => buildNodePrint({ providerMode: 'deterministic-offline', budgets, packageVersions: { '@aukora/brain': '0.1.0' } });

describe('AukoraNodePrintV1', () => {
  it('is valid, secret-free, canonical, and grants no authority', () => {
    const p = offlinePrint();
    expect(validateNodePrint(p)).toEqual([]);
    expect(p.outputContract).toBe('pr-only');
    expect(p.grantsAuthority).toBe(false);
    expect(nodePrintGrantsAuthority()).toBe(false);
    expect(nodePrintId(p)).toMatch(/^[0-9a-f]{64}$/);
    expect(nodePrintId(offlinePrint())).toBe(nodePrintId(offlinePrint())); // deterministic
  });

  it('rejects a print that embeds a secret shape (canonical @aukora/evidence scan)', () => {
    const bad = { ...offlinePrint(), packageVersions: { note: 'AKIAIOSFODNN7EXAMPLE' } };
    expect(validateNodePrint(bad)).toContain('secret_detected');
  });

  it('rejects bad digests and non-integer (non-canonical) budgets', () => {
    expect(validateNodePrint({ ...offlinePrint(), codeSha256: 'nothex' })).toContain('codeSha256_invalid');
    expect(validateNodePrint({ ...offlinePrint(), budgets: { ...budgets, maxCostMicroUsd: 0.5 } })).toContain('budget_maxCostMicroUsd_invalid');
  });

  it('local and Nebius nodes are stamped from the SAME print and differ only via the adapter', () => {
    const p = offlinePrint();
    const local = instantiateNode(p, 'local');
    const nebius = instantiateNode(p, 'nebius');
    expect(local.printId).toBe(nebius.printId);
    expect(local.print).toEqual(nebius.print);                 // identical print/schema
    expect(local.adapter.kind).not.toBe(nebius.adapter.kind);  // ONLY the adapter differs
    expect(local.live).toBe(true);                             // local offline is always live
    expect(nebius.live).toBe(false);                          // fail-closed: unbound + no manifest
    expect(nebius.reasons).toContain('digests_unbound');
  });

  it('a Nebius node becomes live only with bound digests + a matching enabled runtime manifest', () => {
    const checksum = 'c'.repeat(64);
    const p = buildNodePrint({ providerMode: 'nebius', budgets, codeSha256: 'a'.repeat(64), imageDigestSha256: 'b'.repeat(64), modelChecksumSha256: checksum });
    const manifest: NebiusDeploymentManifest = {
      schema: 'aukora-nebius-runtime-v1', imageSha256: 'b'.repeat(64), codeSha256: 'a'.repeat(64), modelChecksumSha256: checksum,
      ceilings: { maxOutputTokens: 100, maxWallClockMs: 1000, maxCostUsd: 0.1, maxCallsPerSession: 2 },
      credentials: 'env', outputContract: 'pr-only', runtime: { entrypoint: 'x', reproducible: true, networkPolicy: 'pinned-only' },
      enabled: true, autonomousMerge: false, grantsAuthority: false,
    };
    expect(instantiateNode(p, 'nebius', { runtimeManifest: manifest }).live).toBe(true);
    const mismatch = instantiateNode(p, 'nebius', { runtimeManifest: { ...manifest, modelChecksumSha256: 'd'.repeat(64) } });
    expect(mismatch.live).toBe(false);
    expect(mismatch.reasons).toContain('model_checksum_mismatch');
  });
});
