// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R32 controls — read-only Spatial stream, monotonic metabolism contraction, CouncilEvidencePackV1 scrubbing,
 * and the canonical staleness law exercised through the governed gate (unknown-age + stale replay).
 */
import { describe, it, expect } from 'vitest';
import {
  spatialStream, spatialStreamGrantsAuthority, GeometryLog, deriveGeometry,
  Metabolism, metabolismDecision, METABOLISM_FLOOR,
  buildCouncilPack, verifyCouncilPack, scrubText, councilVerdictWaivesGates,
  runGovernedRecursion, type RecursionEnv,
} from '../src/index.js';
import { makeWorld, makeProposal, authFor, NOW_ISO } from './support.js';

describe('read-only Spatial event stream — one-way, never feeds an apply', () => {
  it('exposes reads only, returns copies, and asserts feedsApply:false', () => {
    const log = new GeometryLog();
    log.push(deriveGeometry({ epoch: 0, phase: 'sandbox-applied', applied: true, lineageDepth: 0, attemptsUsed: 1, intentId: null }));
    log.push(deriveGeometry({ epoch: 1, phase: 'refused-stale', applied: false, lineageDepth: 0, attemptsUsed: 2, intentId: null }));

    const stream = spatialStream(log);
    expect(stream.feedsApply).toBe(false);
    expect(stream.grantsAuthority).toBe(false);
    expect(stream.geometry.length).toBe(2);
    expect(stream.geometry.since(1).length).toBe(1);

    const snap = stream.geometry.snapshot();
    expect(snap.length).toBe(2);
    // the stream contract has no write/apply surface
    for (const forbidden of ['push', 'apply', 'authorize', 'mutate', 'set']) {
      expect(typeof (stream.geometry as unknown as Record<string, unknown>)[forbidden]).toBe('undefined');
    }
    expect(spatialStreamGrantsAuthority()).toBe(false);
  });
});

describe('metabolism — monotonic contraction, refuse-only', () => {
  it('capacity only decreases and low capacity refuses, never grants', () => {
    const m = new Metabolism(1);
    expect(m.capacity).toBe(1);
    m.contract(0.3);
    expect(m.capacity).toBeCloseTo(0.7);
    m.contract(-5); // negative contraction is a no-op — capacity never increases
    expect(m.capacity).toBeCloseTo(0.7);
    m.contract(1);
    expect(m.capacity).toBe(0);
    expect(m.admits()).toBe(false);
    expect(m.grantsAuthority()).toBe(false);

    expect(metabolismDecision(METABOLISM_FLOOR).admit).toBe(false);
    expect(metabolismDecision(0.9).admit).toBe(true);
    expect(metabolismDecision(0.2, 0.1).admit).toBe(false); // job cost would breach the floor
  });

  it('the gate refuses under contraction even with a valid owner signature (refuse-only)', () => {
    const w = makeWorld();
    const proposal = makeProposal();
    const auth = authFor(w.owner, proposal, { nonce: 'metab-1' });

    const contracted: RecursionEnv = { ...w.env, metabolismCapacity: 0.1 };
    const refused = runGovernedRecursion(contracted, proposal, auth);
    expect(refused.accepted).toBe(false);
    expect(refused.stage).toBe('refused-metabolic-contraction');
    expect(refused.authorityMinted).toBe(false);

    // healthy capacity + the (unburned) same auth applies — contraction only ever ADDED a refusal
    const healthy: RecursionEnv = { ...w.env, metabolismCapacity: 0.9 };
    expect(runGovernedRecursion(healthy, proposal, auth).stage).toBe('sandbox-applied');
  });
});

describe('CouncilEvidencePackV1 — scrubbed, digested, advisory', () => {
  it('redacts secret/authority lines, digests, verifies, and never waives gates', () => {
    expect(scrubText('a\nAKIAIOSFODNN7EXAMPLE\nb')).toBe('a\n[REDACTED:secret]\nb');
    expect(scrubText('x\ngrantsAuthority=true\ny')).toContain('[REDACTED:false-authority]');
    expect(scrubText('m\n' + 'ab'.repeat(32) + '\nn')).toContain('[REDACTED:forbidden-value]');

    const built = buildCouncilPack({
      headSha: 'c961d2f',
      treeSha: 'bbf57e1',
      diff: '--- apps/seed/src/x.ts\n+// safe change\nAKIAIOSFODNN7EXAMPLE',
      tests: { command: 'npm test', passed: 98, failed: 0 },
      claims: ['hybrid AUMLOK load-bearing', 'runtime never self-signs'],
      refusals: ['refused-owner-gate', 'refused-secret'],
      receiptRefs: ['deadbeef', 'cafef00d'],
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.pack.diff).toContain('[REDACTED:secret]'); // the smuggled key is scrubbed
    expect(built.pack.advisory).toBe(true);
    expect(built.pack.grantsAuthority).toBe(false);
    expect(verifyCouncilPack(built.pack).valid).toBe(true);

    // a non-hex head is refused; a tampered pack fails verification
    expect(buildCouncilPack({ headSha: 'zzz', treeSha: 'bbf57e1', diff: '', tests: { command: 'x', passed: 0, failed: 0 }, claims: [], refusals: [], receiptRefs: [] }).ok).toBe(false);
    const tampered = { ...built.pack, diff: built.pack.diff + '\n+extra' };
    expect(verifyCouncilPack(tampered).valid).toBe(false);
    expect(councilVerdictWaivesGates()).toBe(false);
  });
});

describe('canonical staleness through the governed gate', () => {
  it('unknown-age (non-canonical createdAt) is refused, and a stale draft cannot mint on replay', () => {
    const w = makeWorld();
    // '2026-07-16' is NOT canonical ISO under the strict kernel parser ⇒ unknown age ⇒ stale
    expect(runGovernedRecursion(w.env, makeProposal({ createdAt: '2026-07-16' })).stage).toBe('refused-stale');

    // an old (canonical) draft is stale; re-running never mints an apply
    const stale = makeProposal({ createdAt: '2026-07-01T00:00:00.000Z' });
    const a1 = runGovernedRecursion(w.env, stale, authFor(w.owner, stale, { nonce: 's-1' }));
    expect(a1.stage).toBe('refused-stale');
    const a2 = runGovernedRecursion(w.env, stale, authFor(w.owner, stale, { nonce: 's-2' }));
    expect(a2.accepted).toBe(false);
    expect(a2.stage).toBe('refused-stale');

    // a fresh canonical draft still passes the staleness gate
    expect(runGovernedRecursion(w.env, makeProposal({ createdAt: NOW_ISO }), authFor(w.owner, makeProposal({ createdAt: NOW_ISO }), { nonce: 'fresh-1' })).stage).toBe('sandbox-applied');
  });
});
