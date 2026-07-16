// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * ReactiveBrainAdapter: the deliberate Convex→brain role map is pinned; a LOCAL_DEV node and a convex-test node
 * are semantic twins (same contract, same behaviour, differing only by deployment label); authority stays
 * outside/above; the adapter grants none.
 */
import { describe, it, expect } from 'vitest';
import {
  ReactiveMemoryStore,
  reactiveBrainAdapter,
  reactiveBrainAdapterGrantsAuthority,
  CONVEX_ROLE_MAP,
  AUTHORITY_LOCATION,
} from '../src/index.js';
import { buildMemoryRecord } from '@aukora/memory';

const rec = buildMemoryRecord({ content: 'a shared sense', createdAt: '2026-07-16T00:00:01.000Z' });

describe('ReactiveBrainAdapter', () => {
  it('pins the deliberate Convex→brain role map and keeps authority outside/above', () => {
    expect(CONVEX_ROLE_MAP['reactive-query']).toBe('sense');
    expect(CONVEX_ROLE_MAP['mutation']).toBe('atomic-reflex');
    expect(CONVEX_ROLE_MAP['scheduled-function']).toBe('delayed-impulse');
    expect(CONVEX_ROLE_MAP['cron']).toBe('rhythm');
    expect(CONVEX_ROLE_MAP['workflow']).toBe('durable-rehearsal');
    expect(CONVEX_ROLE_MAP['workpool']).toBe('attention-spend');
    expect(CONVEX_ROLE_MAP['action']).toBe('external-nerve');
    expect(AUTHORITY_LOCATION).toContain('kernel/AUMLOK');
    expect(reactiveBrainAdapterGrantsAuthority()).toBe(false);
  });

  it('a LOCAL_DEV node and a convex-test node are semantic twins', () => {
    const local = reactiveBrainAdapter(new ReactiveMemoryStore(), 'local-dev');
    const test = reactiveBrainAdapter(new ReactiveMemoryStore(), 'convex-test');
    // same declared role surface, differ only by deployment label
    expect(local.deployment).toBe('local-dev');
    expect(test.deployment).toBe('convex-test');
    expect(local.declared).toEqual(test.declared);
    expect(local.grantsAuthority).toBe(false);
    expect(test.grantsAuthority).toBe(false);

    // identical behaviour: the same atomic reflex yields the same sense (content-free deterministic chain)
    const a = local.reflexes.ingest(rec);
    const b = test.reflexes.ingest(rec);
    expect(a.ok && b.ok).toBe(true);
    expect(local.senses.snapshot().headHash).toBe(test.senses.snapshot().headHash);
    expect(local.senses.snapshot().liveCount).toBe(test.senses.snapshot().liveCount);
    expect(local.senses.health().valid).toBe(true);
    expect(local.senses.recall({ text: 'sense' }).length).toBe(1);
  });
});
