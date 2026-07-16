// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * KIRA memory classes (R33): ROOT/UNITE/RISE/GOLD classification in the migration bridge, Auma/Peter selection
 * for dry-run (unselected actives reported content-free, never imported), and the GOLD registry — protected,
 * versioned, receipted, changeable ONLY through an explicit owner AUMLOK ceremony, never literally immutable.
 */
import { describe, it, expect } from 'vitest';
import {
  GovernedMemoryMigration,
  GoldMemoryRegistry,
  goldGrantsAuthority,
  legacyContentHash,
  KIRA_CLASSES,
  type KiraClassifier,
  type LegacyMemoryRecordV1,
} from '../src/index.js';
import { deriveRecordId } from '@aukora/memory';

function legacy(seq: number, content: string): LegacyMemoryRecordV1 {
  return {
    chainKey: 'mem:owner1:diary', seq, content, contentHash: legacyContentHash(content),
    createdAt: `2026-07-16T00:00:0${seq}.000Z`, status: 'active', hash: legacyContentHash(`h${seq}`), prevHash: null,
  };
}

const ROWS = [legacy(0, 'root: bedrock fact'), legacy(1, 'unite: our agreement'), legacy(2, 'rise: the purpose'), legacy(3, 'gold: constitutional clause')];
const classify: KiraClassifier = (r) =>
  r.content.startsWith('gold') ? 'GOLD' : r.content.startsWith('rise') ? 'RISE' : r.content.startsWith('unite') ? 'UNITE' : 'ROOT';

describe('KIRA classes + selection in the migration bridge', () => {
  it('classifies ROOT/UNITE/RISE/GOLD; only the class reaches the (content-free) report', () => {
    const report = new GovernedMemoryMigration({ exportAll: () => ROWS }).dryRun({ classify });
    expect(report.kiraCounts).toEqual({ ROOT: 1, UNITE: 1, RISE: 1, GOLD: 1 });
    expect(KIRA_CLASSES.GOLD.color).toBe('amber');
    expect(report.entries.map((e) => e.kiraClass)).toEqual(['ROOT', 'UNITE', 'RISE', 'GOLD']);
    expect(JSON.stringify(report)).not.toContain('bedrock'); // still no plaintext
  });

  it('selection: Auma/Peter choose what migrates — unselected actives are reported but never imported', () => {
    const bridge = new GovernedMemoryMigration({ exportAll: () => ROWS });
    const report = bridge.dryRun({ classify, selection: { includeClasses: ['ROOT', 'GOLD'], excludeRefs: [] } });
    expect(report.counts.activeMigrated).toBe(2);       // ROOT + GOLD only
    expect(report.counts.excludedBySelection).toBe(2);  // UNITE + RISE reported, not imported
    const unite = report.entries.find((e) => e.kiraClass === 'UNITE');
    expect(unite?.selected).toBe(false);
    expect(unite?.newRecordId).toBeNull();
    expect(bridge.isolatedStore().snapshot().liveCount).toBe(2);
    // excludeRefs wins over include
    const r2 = new GovernedMemoryMigration({ exportAll: () => ROWS }).dryRun({ classify, selection: { includeClasses: ['ROOT'], excludeRefs: ['mem:owner1:diary#0'] } });
    expect(r2.counts.activeMigrated).toBe(0);
  });
});

describe('GOLD registry — protected, versioned, receipted; owner AUMLOK ceremony required', () => {
  it('refuses a change without the ceremony; versions + receipts on ceremony; history never rewritten', () => {
    const gold = new GoldMemoryRegistry();
    const denied = gold.change({ key: 'constitution', newContent: 'v1: the organism serves', at: '2026-07-16T01:00:00.000Z', reason: 'genesis' }, () => false);
    expect(denied.ok).toBe(false);
    expect((denied as { refusal: string }).refusal).toContain('AUMLOK ceremony');
    expect(gold.current('constitution')).toBeNull();

    // ceremony attests the EXACT content-addressed change
    const v1 = gold.change({ key: 'constitution', newContent: 'v1: the organism serves', at: '2026-07-16T01:00:00.000Z', reason: 'genesis' },
      (a) => a.key === 'constitution' && a.newRecordId === deriveRecordId('v1: the organism serves'));
    expect(v1.ok).toBe(true);
    const v2 = gold.change({ key: 'constitution', newContent: 'v2: amended by the owner', at: '2026-07-16T02:00:00.000Z', reason: 'amendment-1' }, () => true);
    expect(v2.ok).toBe(true);
    expect((v2 as { version: number }).version).toBe(2); // NOT immutable — amendable through ceremony
    expect(gold.current('constitution')?.content).toBe('v2: amended by the owner');
    expect(gold.history('constitution').length).toBe(2); // v1 preserved, never rewritten
    expect(gold.history('constitution')[0].content).toContain('v1');
    expect(gold.verifyReceipts().valid).toBe(true);      // every change receipted on the canonical chain
    expect(goldGrantsAuthority()).toBe(false);
  });
});
