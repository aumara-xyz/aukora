// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Read-only health/snapshot contract for the Spatial shell: a stable, UI-agnostic shape; `ok` reflects the
 * canonical chain verdict; and reading it never mutates the store.
 */
import { describe, it, expect } from 'vitest';
import { ReactiveMemoryStore, brainHealthSnapshot } from '../src/index.js';
import { buildMemoryRecord } from '@aukora/memory';

describe('brainHealthSnapshot — read-only UI-agnostic contract', () => {
  it('projects health + snapshot; ok on a healthy chain; read-only', () => {
    const store = new ReactiveMemoryStore();
    store.ingest(buildMemoryRecord({ content: 'a', createdAt: '2026-07-16T00:00:01.000Z' }));
    const before = store.snapshot().chainLength;
    const hs = brainHealthSnapshot(store, { providerMode: 'deterministic-offline', nodePrintId: 'x'.repeat(64) });
    expect(hs.schema).toBe('aukora-brain-health-v1');
    expect(hs.health.ok).toBe(true);
    expect(hs.health.chainLength).toBe(1);
    expect(hs.snapshot.liveCount).toBe(1);
    expect(hs.providerMode).toBe('deterministic-offline');
    expect(hs.grantsAuthority).toBe(false);
    expect(store.snapshot().chainLength).toBe(before); // read-only: no mutation
  });

  it('reports ok:false for a corrupted chain', () => {
    const store = new ReactiveMemoryStore();
    store.ingest(buildMemoryRecord({ content: 'a', createdAt: '2026-07-16T00:00:01.000Z' }));
    store.ingest(buildMemoryRecord({ content: 'b', createdAt: '2026-07-16T00:00:02.000Z' }));
    (store as unknown as { entries: { chainHash: string }[] }).entries[0].chainHash = '0'.repeat(64);
    expect(brainHealthSnapshot(store).health.ok).toBe(false);
  });
});
