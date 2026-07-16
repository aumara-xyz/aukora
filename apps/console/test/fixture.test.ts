// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Validates the committed DEMO_FIXTURE the console renders: every required operator surface is present, the
 * governance invariants hold (advisory-only, grants-authority-false, fail-closed, $0 offline), and the whole
 * thing is honestly labelled. These are ASSERTIONS over the committed fixture; regeneration is a separate
 * step (`npm run fixture`) so `npm test` never mutates what it checks.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(join(here, '..', 'public', 'fixture.json'), 'utf-8'));

const PANEL_TRUTHS = new Set(['IMPLEMENTED', 'ROADMAP', 'UNARMED']);
const MANIFEST_TRUTHS = new Set([
  'IMPLEMENTED',
  'AVAILABLE_PRIVATE',
  'UNVERIFIED_OR_PARKED',
  'BLOCKED',
  'DESIGN_ONLY',
  'REJECTED',
]);

describe('DEMO_FIXTURE — honest labelling', () => {
  it('is labelled DEMO_FIXTURE and read-only', () => {
    expect(fixture.schema).toBe('aukora-console-fixture-v1');
    expect(fixture.label).toBe('DEMO_FIXTURE');
    expect(fixture.readOnly).toBe(true);
    expect(String(fixture.provenance)).toMatch(/no cloud, no paid call/i);
  });

  it('every panel carries a valid truth label', () => {
    for (const key of ['authority', 'memory', 'lineage', 'recursion', 'council', 'providers', 'budget', 'convex']) {
      expect(PANEL_TRUTHS.has(fixture[key].truth), `${key}.truth=${fixture[key].truth}`).toBe(true);
    }
    expect(fixture.g1.truth).toBe('UNARMED');
    expect(fixture.forgetting.truth).toBe('IMPLEMENTED');
  });
});

describe('DEMO_FIXTURE — every required operator surface is present', () => {
  it('1. AUMLOK authority / lock state', () => {
    expect(fixture.authority.lockState).toBe('LOCKED');
    expect(fixture.authority.grantsAuthority).toBe(false);
    expect(fixture.authority.noModelCanSign).toBe(true);
    expect(fixture.authority.ownerPublicKeyHex).toMatch(/^[0-9a-f]{64}$/);
  });
  it('2. memory count + chain head', () => {
    expect(fixture.memory.liveCount).toBeGreaterThan(0);
    expect(fixture.memory.headHashShort).toMatch(/…$/);
    expect(fixture.memory.merkleRootShort).toMatch(/…$/);
  });
  it('3. reactive memory growth', () => {
    expect(Array.isArray(fixture.memory.growth)).toBe(true);
    const counts = fixture.memory.growth.map((g: any) => g.liveCount);
    expect(counts[1]).toBeGreaterThan(counts[0]); // strictly grew across ingests
  });
  it('4. receipt & Merkle lineage', () => {
    expect(fixture.lineage.verified).toBe(true);
    expect(fixture.lineage.entries.length).toBeGreaterThanOrEqual(3);
    expect(fixture.lineage.merkleRootShort).toMatch(/…$/);
  });
  it('5. proposal lifecycle + staleness', () => {
    expect(fixture.recursion.pipeline).toContain('AUMLOK owner-gate');
    expect(fixture.recursion.refusedWithoutOwner.accepted).toBe(false);
    expect(fixture.recursion.refusedWithoutOwner.stage).toBe('refused-owner-gate');
    expect(fixture.recursion.refusedWithoutOwner.councilVerdict).toBe('advisory-pass');
    expect(fixture.recursion.acceptedWithOwner.accepted).toBe(true);
    expect(fixture.recursion.acceptedWithOwner.liveRepoTouched).toBe(false);
    expect(fixture.recursion.staleness.stale.state).toBe('stale');
    expect(fixture.recursion.staleness.unknownAge.flagged).toBe(true);
  });
  it('6. Fu council roster, quorum, disagreement, advisory verdict', () => {
    expect(fixture.council.roster.length).toBe(8);
    expect(fixture.council.quorumMet).toBe(true);
    expect(fixture.council.votingFamilies).toBe(8);
    expect(fixture.council.geometry.shearMagnitude).toBeGreaterThan(0); // disagreement is surfaced
    expect(['consensus', 'consensus-suspect', 'divergence', 'insufficient-quorum']).toContain(fixture.council.verdict);
    expect(fixture.council.advisory).toBe(true);
    expect(fixture.council.grantsAuthority).toBe(false);
  });
  it('7. provider status with truthful labels', () => {
    expect(fixture.providers.grantsAuthority).toBe(false);
    expect(fixture.providers.manifest.length).toBeGreaterThan(0);
    for (const m of fixture.providers.manifest) {
      expect(MANIFEST_TRUTHS.has(m.truth), `${m.id}=${m.truth}`).toBe(true);
    }
    // roadmap vs implemented is distinguished, not blurred
    expect(fixture.providers.manifest.some((m: any) => m.truth === 'BLOCKED')).toBe(true);
    expect(fixture.providers.manifest.some((m: any) => m.truth === 'DESIGN_ONLY')).toBe(true);
  });
  it('8. budget / hard-stop', () => {
    expect(fixture.budget.perPassUsd).toBe(2);
    expect(fixture.budget.perDayUsd).toBe(10);
    expect(fixture.budget.failClosed).toBe(true);
    expect(fixture.budget.actualUsd).toBe(0); // offline pass spent nothing
    expect(fixture.budget.estimatedUsd).toBeLessThanOrEqual(fixture.budget.perPassUsd);
  });
  it('9. Convex mode', () => {
    expect(fixture.convex.modes).toEqual(['live', 'convex-test', 'in-memory', 'unavailable']);
    expect(fixture.convex.current).toBe('in-memory');
    expect(fixture.convex.modes).toContain(fixture.convex.current);
  });
  it('10. G1 / Nebius clearly UNARMED', () => {
    expect(fixture.g1.state).toBe('UNARMED');
    expect(String(fixture.g1.note)).toMatch(/not claimed.*(alive|conscious|self-replicating)/i);
  });
  it('11. governed forgetting outcome', () => {
    expect(fixture.forgetting.recallBefore).toBeGreaterThan(0);
    expect(fixture.forgetting.recallAfter).toBe(0);
    expect(fixture.forgetting.chainStillVerifies).toBe(true);
    expect(fixture.forgetting.tombstoneContentFree).toBe(true);
    expect(fixture.forgetting.chainRewritten).toBe(false);
  });
});
