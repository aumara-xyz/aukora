// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Governed dry-run legacy-memory migration bridge: corruption fails loud; secret quarantine + no plaintext in
 * the public report; tombstone preserved with NO resurrection; verified counts/hashes/recall/forgetting/tamper/
 * rollback; and a real import blocked without a distinct AUMLOK owner approval.
 */
import { describe, it, expect } from 'vitest';
import {
  GovernedMemoryMigration,
  MemoryBridgeCorruptionError,
  legacyContentHash,
  type LegacyMemoryRecordV1,
  type LegacyMemorySource,
} from '../src/index.js';

const H = '0'.repeat(64);
function legacy(partial: Partial<LegacyMemoryRecordV1> & { content: string; seq: number }): LegacyMemoryRecordV1 {
  return {
    chainKey: 'mem:owner1:diary',
    seq: partial.seq,
    content: partial.content,
    contentHash: partial.contentHash ?? legacyContentHash(partial.content),
    createdAt: `2026-07-16T00:00:0${partial.seq}.000Z`,
    status: partial.status ?? 'active',
    hash: partial.hash ?? legacyContentHash(`h${partial.seq}`),
    prevHash: partial.prevHash ?? null,
    receiptHash: partial.receiptHash,
    gateArgsHash: partial.gateArgsHash,
    tier: partial.tier,
    visibility: partial.visibility,
  };
}

const source = (rows: LegacyMemoryRecordV1[]): LegacyMemorySource => ({ exportAll: () => rows });

const CLEAN = [
  legacy({ seq: 0, content: 'the organism first stirred', visibility: 'private', receiptHash: 'r'.repeat(64), gateArgsHash: 'g'.repeat(64) }),
  legacy({ seq: 1, content: 'it recalled the morning light', visibility: 'shared' }),
  legacy({ seq: 2, content: 'a forgotten thing', status: 'tombstoned' }),
  legacy({ seq: 3, content: 'my aws key AKIAIOSFODNN7EXAMPLE lives here', visibility: 'private' }), // secret
];

describe('GovernedMemoryMigration (dry-run)', () => {
  it('classifies, content-addresses, verifies, and keeps NO plaintext in the public report', () => {
    const report = new GovernedMemoryMigration(source(CLEAN)).dryRun();
    expect(report.dryRun).toBe(true);
    expect(report.committed).toBe(false);
    expect(report.counts).toEqual({ exported: 4, activeMigrated: 2, excludedBySelection: 0, secretQuarantined: 1, tombstonesPreserved: 1 });
    // every verification passes
    expect(report.verified).toEqual({ counts: true, hashes: true, recall: true, forgetting: true, tamperRefused: true, rollback: true });
    // provenance preserved (content-free) on the active entry that had refs
    const withRefs = report.entries.find((e) => e.receiptHash);
    expect(withRefs?.gateArgsHash).toBe('g'.repeat(64));
    // tombstone preserved, NOT resurrected; secret quarantined — neither imports plaintext
    expect(report.entries.find((e) => e.status === 'tombstoned')?.classification).toBe('tombstone-preserved');
    expect(report.entries.find((e) => e.classification === 'tombstone-preserved')?.newRecordId).toBeNull();
    expect(report.entries.find((e) => e.classification === 'secret-quarantined')?.newRecordId).toBeNull();
    // NO plaintext of any record survives in the public report.
    const dump = JSON.stringify(report);
    for (const frag of ['first stirred', 'morning light', 'forgotten thing', 'AKIAIOSFODNN7EXAMPLE']) {
      expect(dump).not.toContain(frag);
    }
  });

  it('corruption fails LOUD (content-hash mismatch throws)', () => {
    const corrupt = [legacy({ seq: 0, content: 'tampered payload', contentHash: H })]; // wrong hash
    expect(() => new GovernedMemoryMigration(source(corrupt)).dryRun()).toThrowError(MemoryBridgeCorruptionError);
  });

  it('a real import is blocked without a distinct AUMLOK owner approval', () => {
    const bridge = new GovernedMemoryMigration(source(CLEAN));
    bridge.dryRun();
    const denied = bridge.commitImport(() => false);
    expect(denied.committed).toBe(false);
    expect(denied.refusal).toContain('AUMLOK owner approval');
    // even approved, a dry-run with no durable target imports nothing
    const noTarget = bridge.commitImport(() => true);
    expect(noTarget.committed).toBe(false);
    // approved WITH a durable target imports content-addressed ids only (never rewrites the legacy source)
    const received: string[] = [];
    const ok = bridge.commitImport(() => true, { importRecordIds: (ids) => received.push(...ids) });
    expect(ok.committed).toBe(true);
    expect(received.length).toBe(2); // the two active records
    expect(received.every((id) => /^[0-9a-f]{64}$/.test(id))).toBe(true);
  });

  it('read-only: the bridge never writes back to the legacy source', () => {
    const rows = [...CLEAN];
    const snapshot = JSON.stringify(rows);
    new GovernedMemoryMigration(source(rows)).dryRun();
    expect(JSON.stringify(rows)).toBe(snapshot); // source untouched — old chain never rewritten
  });
});
