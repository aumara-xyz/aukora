// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Sam 4 read-only local contracts: live vs fixture visibly labelled; subscription fires on ingest/forget and
 * unsubscribes cleanly; selection catalog is content-free; nothing grants authority.
 */
import { describe, it, expect } from 'vitest';
import {
  SubscribableMemoryStore,
  liveBrainContract,
  fixtureBrainContract,
  GovernedMemoryMigration,
  legacyContentHash,
  type BrainEvent,
  type LegacyMemoryRecordV1,
} from '../src/index.js';
import { buildMemoryRecord } from '@aukora/memory';

const at = (s: number) => `2026-07-16T06:00:0${s}.000Z`;

describe('BrainLocalContractV1 for Sam 4', () => {
  it('live contract: reads project the real store; events fire on ingest/forget; unsubscribe works', () => {
    const store = new SubscribableMemoryStore();
    const contract = liveBrainContract({ store });
    expect(contract.source).toBe('live'); // visible label
    const events: BrainEvent[] = [];
    const unsubscribe = contract.subscribe((e) => events.push(e));

    const rec = buildMemoryRecord({ content: 'sensed by the shell', createdAt: at(1) });
    store.ingest(rec);
    expect(events).toEqual([{ kind: 'ingested', recordId: rec.recordId }]);
    expect(contract.recall({ text: 'shell' }).length).toBe(1);

    store.forget(rec.recordId, () => true, at(2));
    expect(events[1]).toEqual({ kind: 'forgotten', recordId: rec.recordId });

    unsubscribe();
    store.ingest(buildMemoryRecord({ content: 'after unsubscribe', createdAt: at(3) }));
    expect(events.length).toBe(2); // no further events
    expect(contract.grantsAuthority).toBe(false);
  });

  it('a broken listener never breaks a reflex', () => {
    const store = new SubscribableMemoryStore();
    store.subscribe(() => { throw new Error('observer bug'); });
    const verdict = store.ingest(buildMemoryRecord({ content: 'still ingests', createdAt: at(1) }));
    expect(verdict.ok).toBe(true);
  });

  it('fixture fallback is VISIBLY labelled and carries provider truth', () => {
    const fixture = fixtureBrainContract();
    expect(fixture.source).toBe('fixture'); // the honesty label
    expect(fixture.kiraCounts.ROOT).toBe(2);
    expect(fixture.providerTruth.find((p) => p.id === 'nemotron')?.truth).toBe('BLOCKED');
    expect(fixture.recall({ text: 'anything' })).toEqual([]);
  });
});

describe('selectionCatalog — content-free choices for Auma and Peter', () => {
  it('lists refs/classes/hashes without any plaintext; flags secret-quarantined rows', () => {
    const rows: LegacyMemoryRecordV1[] = [
      { chainKey: 'mem:o:d', seq: 0, content: 'a private thing', contentHash: legacyContentHash('a private thing'), createdAt: at(1), status: 'active', hash: legacyContentHash('h0'), prevHash: null },
      { chainKey: 'mem:o:d', seq: 1, content: 'key AKIAIOSFODNN7EXAMPLE here', contentHash: legacyContentHash('key AKIAIOSFODNN7EXAMPLE here'), createdAt: at(2), status: 'active', hash: legacyContentHash('h1'), prevHash: null },
    ];
    const catalog = new GovernedMemoryMigration({ exportAll: () => rows }).selectionCatalog(() => 'UNITE');
    expect(catalog.length).toBe(2);
    expect(catalog[0].kiraClass).toBe('UNITE');
    expect(catalog[1].secretQuarantined).toBe(true);
    const dump = JSON.stringify(catalog);
    expect(dump).not.toContain('private thing');
    expect(dump).not.toContain('AKIA');
  });
});
