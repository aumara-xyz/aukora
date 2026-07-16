// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Reproducible offline executor harness: runs a node offline end-to-end, is deterministic (same print + seed ⇒
 * identical output), and fails closed for a live provider mode without bound hashes (no fake digest).
 */
import { describe, it, expect } from 'vitest';
import { runOfflineNode, buildNodePrint } from '../src/index.js';

const budgets = { maxGenerations: 4, maxWallClockMs: 30000, maxOutputTokens: 512, maxCostMicroUsd: 500000, maxPatchBytes: 65536 };
const seed = {
  content: 'first light',
  createdAt: '2026-07-16T00:00:01.000Z',
  receiptAt: '2026-07-16T00:00:02.000Z',
  proposedPatch: { targetPath: 'note.txt', diff: 'hello' },
};

describe('runOfflineNode — reproducible offline executor', () => {
  it('runs offline end-to-end: advisory + sandbox PR candidate + receipt + read-only health', async () => {
    const run = await runOfflineNode(buildNodePrint({ providerMode: 'deterministic-offline', budgets }), seed);
    expect(run.ok).toBe(true);
    expect(run.advisory?.startsWith('advisory:')).toBe(true);
    expect(run.candidate?.applied).toBe(false);
    expect(run.candidate?.autonomousMerge).toBe(false);
    expect(run.receiptHash).toMatch(/^[0-9a-f]{64}$/);
    expect(run.health?.health.ok).toBe(true);
    expect(run.health?.snapshot.liveCount).toBe(2); // seed + receipt
  });

  it('is deterministic/reproducible: same print + seed ⇒ identical output', async () => {
    const print = buildNodePrint({ providerMode: 'deterministic-offline', budgets });
    const a = await runOfflineNode(print, seed);
    const b = await runOfflineNode(print, seed);
    expect(a.advisory).toBe(b.advisory);
    expect(a.receiptHash).toBe(b.receiptHash);
    expect(a.printId).toBe(b.printId);
  });

  it('fails closed for a live provider mode without bound hashes (no fake digest synthesised)', async () => {
    const run = await runOfflineNode(buildNodePrint({ providerMode: 'nebius', budgets }), seed);
    expect(run.ok).toBe(false);
    expect(run.refusal).toContain('fail-closed');
  });
});
