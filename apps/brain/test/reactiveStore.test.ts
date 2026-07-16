// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
import { describe, it, expect } from 'vitest';
import { ReactiveMemoryStore, DeterministicOfflineProvider, providerGrantsAuthority, MODEL_MANIFEST, resolveTruth } from '../src/index.js';
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

  it('governed forgetting REMOVES the plaintext from the store (not just read-time hiding)', () => {
    const store = new ReactiveMemoryStore();
    const r = buildMemoryRecord({ content: 'a private thought to erase', createdAt: at(1) });
    store.ingest(r);
    expect(store.plaintextRetained(r.recordId)).toBe(true);
    store.forget(r.recordId, () => true, at(2));
    expect(store.plaintextRetained(r.recordId)).toBe(false); // plaintext gone
    // chain still verifies and carries no plaintext of the forgotten memory
    expect(store.verifyChain().valid).toBe(true);
    expect(JSON.stringify(store.chain())).not.toContain('private thought');
  });

  it('health() valid on a healthy chain; a corrupted chain fails closed on ingest/forget', () => {
    const store = new ReactiveMemoryStore();
    const a = buildMemoryRecord({ content: 'alpha', createdAt: at(1) });
    store.ingest(a);
    store.ingest(buildMemoryRecord({ content: 'beta', createdAt: at(2) }));
    expect(store.health().valid).toBe(true);
    // white-box corruption of a prior entry's stored hash
    (store as unknown as { entries: { chainHash: string }[] }).entries[0].chainHash = '0'.repeat(64);
    expect(store.health().valid).toBe(false);
    expect(store.ingest(buildMemoryRecord({ content: 'gamma', createdAt: at(3) })).ok).toBe(false);
    expect(store.forget(a.recordId, () => true, at(4)).ok).toBe(false);
  });

  it('refuses a memory whose content carries a secret (canonical @aukora/evidence scanner reuse)', () => {
    const store = new ReactiveMemoryStore();
    const withSecret = buildMemoryRecord({ content: 'note: AKIAIOSFODNN7EXAMPLE is my access key', createdAt: at(1) });
    const res = store.ingest(withSecret);
    expect(res.ok).toBe(false);
    expect(store.snapshot().chainLength).toBe(0); // never entered the chain
  });

  it('provider boundary is offline/deterministic, grants no authority, and truth labels are honest', async () => {
    const p = new DeterministicOfflineProvider();
    expect(await p.complete('x')).toBe(await p.complete('x'));
    expect(providerGrantsAuthority()).toBe(false);
    const truth = (id: string) => MODEL_MANIFEST.find((m) => m.id === id)?.truth;
    // R29 truth table (mission-specified).
    expect(truth('liquid-candidate')).toBe('UNVERIFIED_OR_PARKED');
    expect(truth('nemotron')).toBe('BLOCKED');
    expect(truth('router-3b-seed')).toBe('DESIGN_ONLY');
    expect(truth('mopd-distillation')).toBe('DESIGN_ONLY');
    // Qwen / Auma-VL CLAIM AVAILABLE_PRIVATE but resolve to UNVERIFIED_OR_PARKED without an in-repo checksum-bound
    // manifest — no model may self-certify from a design/out-of-repo pointer alone.
    expect(truth('qwen2.5-vl-32b-instruct')).toBe('UNVERIFIED_OR_PARKED');
    expect(truth('auma-vl-lora')).toBe('UNVERIFIED_OR_PARKED');
    // The gate is real: an in-repo checksum-bound manifest WOULD earn AVAILABLE_PRIVATE.
    expect(resolveTruth('AVAILABLE_PRIVATE', {})).toBe('UNVERIFIED_OR_PARKED');
    expect(resolveTruth('AVAILABLE_PRIVATE', { inRepoManifestSha256: 'a'.repeat(64) })).toBe('AVAILABLE_PRIVATE');
    // R35: Kimi is off the external crew — recorded in provider truth; the Fu roster is not altered here.
    expect(truth('kimi')).toBe('REJECTED');
  });
});
