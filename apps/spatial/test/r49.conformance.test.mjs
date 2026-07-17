// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R49 — K3 conformance reconstruction (issue #15): drive the three reconstructed cells against the REAL
 * canonical public interfaces and assert their falsifiable verdicts. This is the gate-run path (test:spatial
 * → test:all). Under AUKORA_CONFORMANCE_WRITE=1 it also writes each cell's content-addressed evidence bundle
 * to conformance/artifacts/, so `npm run conformance` and the gate share one code path and one set of numbers.
 *
 * These cells import @aukora/seed / @aukora/brain / @aukora/supervisor — the canonical interfaces — so a
 * regression in the real governed door, lifecycle engine, or memory chain fails THIS suite, not just a copy.
 */
import { describe, it, expect } from 'vitest';
import { makeBundle, writeBundle } from '../conformance/lib/bundle.mjs';
import * as e1 from '../conformance/cells/hostile-refusal.mjs';
import * as e2 from '../conformance/cells/supervisor-lifecycle.mjs';
import * as e3 from '../conformance/cells/kira-chain.mjs';

const WRITE = process.env.AUKORA_CONFORMANCE_WRITE === '1';

async function runCell(mod, surface) {
  const { core, verdict } = await mod.run({});
  if (WRITE) writeBundle(mod.CELL, makeBundle({ core, surface }));
  return { core, verdict };
}

describe('R49 · E1 — hostile proposal / refusal chaos over the governed mind door', () => {
  it('lands no effect from any hostile envelope, receipts each resolved refusal, and leaves main untouched', async () => {
    const { core, verdict } = await runCell(e1, { network: 'none (in-process door handle())' });
    // SAFETY gate — the properties that must never break.
    expect(verdict.noLandedEffect, JSON.stringify(core.observations)).toBe(true);
    expect(verdict.noAuthorityGranted).toBe(true);
    expect(verdict.everyGovernedRefusalReceipted).toBe(true);
    expect(verdict.mainUntouched).toBe(true);
    expect(verdict.lockdownEngaged).toBe(true);
    expect(verdict.statusReadableUnderLockdown).toBe(true);
    expect(verdict.doorStillUpAfterThrows).toBe(true);
    expect(verdict.coverageComplete).toBe(true);
    expect(verdict.pass).toBe(true);
    // Every attack family that RESOLVED was refused every time; families that THREW are recorded as a finding.
    for (const [kind, s] of Object.entries(core.perKind)) expect(s.refused + s.threw, kind).toBe(s.n);
    // The refusal-hygiene finding (malformed Fu sidecar throws) is reported honestly, not hidden.
    if (!verdict.refusalHygieneClean) expect(core.findings.some((f) => f.id === 'F1')).toBe(true);
  });
});

describe('R49 · E2 — supervisor lifecycle: envelope closure, restart-safety, foreign + swap discipline', () => {
  it('never escapes the closed envelope, stays pure/restart-safe, and isolates foreign occupants', async () => {
    const { core, verdict } = await runCell(e2, { network: 'none (pure engine)' });
    expect(verdict.envelopeClosed).toBe(true);
    expect(verdict.noForbiddenLeak).toBe(true);
    expect(verdict.foreignOccupantSafe).toBe(true);
    expect(verdict.pureRestartSafe).toBe(true);
    expect(verdict.scenarioAllHold, JSON.stringify(core.scenario)).toBe(true);
    expect(verdict.pass).toBe(true);
  });
});

describe('R49 · E3 — KIRA content-free chain: growth, governed forgetting, no-resurrection, tamper', () => {
  it('grows monotonically, forgets under owner authority, refuses resurrection, and detects tamper', async () => {
    const { core, verdict } = await runCell(e3, { network: 'none (in-memory store)' });
    expect(verdict.growthMonotonic).toBe(true);
    expect(verdict.integrityAfterEveryOp).toBe(true);
    expect(verdict.forgetDeletesPlaintext).toBe(true);
    expect(verdict.forgetUnrecallable).toBe(true);
    expect(verdict.forgetKeepsChainValid).toBe(true);
    expect(verdict.forgetAppendsTombstone).toBe(true);
    expect(verdict.forgetRequiresOwner).toBe(true);
    expect(verdict.noResurrection).toBe(true);
    expect(verdict.secretFailClosed).toBe(true);
    expect(verdict.tamperDetected).toBe(true);
    expect(verdict.corruptStoreRefusesIngest).toBe(true);
    expect(verdict.pass, JSON.stringify(core.counters)).toBe(true);
  });
});
