// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
import { describe, it, expect } from 'vitest';
import { ReactiveMemoryStore, DeterministicOfflineProvider, providerGrantsAuthority, MODEL_MANIFEST } from '../src/index.js';
import { buildMemoryRecord } from '@aukora/memory';

const at = (s: number) => `2026-07-16T00:00:${String(s).padStart(2, '0')}.000Z`;

describe('@aukora/brain — reactive receipt-chained growing memory', () => {
  it('grows memory reactively and keeps the chain + merkle head verifiable', () => {
    const store = new ReactiveMemoryStore();
    expect(store.snapshot().liveCount).toBe(0);

    const a = store.ingest(buildMemoryRecord({ content: 'event A: the organism woke', createdAt: at(1) }));
    expect(a.ok).toBe(true);
    expect(store.snapshot().liveCount).toBe(1);
    const rootAfterA = store.snapshot().merkleRootHex;

    const b = store.ingest(buildMemoryRecord({ content: 'event B: it remembered A', createdAt: at(2) }));
    expect(b.ok).toBe(true);
    expect(store.snapshot().liveCount).toBe(2);           // GROWTH proven
    expect(store.snapshot().merkleRootHex).not.toBe(rootAfterA); // reactive root moved
    expect(store.snapshot().headHash).toBe((b as { chainHash: string }).chainHash);

    expect(store.verifyChain().valid).toBe(true);
    const recalled = store.recall({ text: 'remembered' });
    expect(recalled.map((h) => h.content)).toEqual(['event B: it remembered A']);
  });

  it('refuses malformed / authority-shaped memory (fail-closed)', () => {
    const store = new ReactiveMemoryStore();
    const bad = store.ingest({ schema: 'aukora-memory-v1', grantsAuthority: true });
    expect(bad.ok).toBe(false);
    expect(store.snapshot().chainLength).toBe(0);
  });

  it('governed forgetting: owner-authorized tombstone hides content but keeps a content-free audit', () => {
    const store = new ReactiveMemoryStore();
    const r = buildMemoryRecord({ content: 'secret-ish memory to forget', createdAt: at(1) });
    store.ingest(r);
    store.ingest(buildMemoryRecord({ content: 'kept memory', createdAt: at(2) }));

    // refuse forgetting without owner authorization
    const denied = store.forget(r.recordId, () => false, at(3));
    expect(denied.ok).toBe(false);
    expect(store.recall({ text: 'forget' }).length).toBe(1); // still visible

    // owner-authorized forget
    const done = store.forget(r.recordId, () => true, at(4));
    expect(done.ok).toBe(true);
    expect(store.recall({ text: 'forget' }).length).toBe(0);          // content no longer recalled
    expect(store.snapshot().liveCount).toBe(1);                        // shrank by one
    expect(store.snapshot().forgottenCount).toBe(1);
    // chain kept + extended by the content-free tombstone; still verifiable, content not present in tombstone
    expect(store.verifyChain().valid).toBe(true);
    const tomb = store.chain()[store.chain().length - 1].payload as Record<string, unknown>;
    expect(tomb.kind).toBe('tombstone');
    expect(JSON.stringify(tomb)).not.toContain('secret-ish');         // no plaintext in the tombstone
  });

  it('provider boundary is offline/deterministic and grants no authority', async () => {
    const p = new DeterministicOfflineProvider();
    expect(await p.complete('x')).toBe(await p.complete('x'));
    expect(providerGrantsAuthority()).toBe(false);
    expect(MODEL_MANIFEST.find((m) => m.id === 'liquid-candidate')?.truth).toBe('BLOCKED');
  });
});
