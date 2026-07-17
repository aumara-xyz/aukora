// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Effect coordinator (#22 overnight) — the canonical crash-recoverable ORDER composing the overnight primitives.
 * Pins the sequence + cross-step invariants over an injected EffectOps double: the ONLY path to COMMITTED is
 * owner-authorized → PREPARED consumed once → candidate present → isolation intact → durable completion ref →
 * projection-only settlement + audit accepted; every other branch halts or QUARANTINES (never a silent success),
 * and the audit ledger sees every transition.
 */
import { describe, it, expect } from 'vitest';
import {
  driveEffect, effectCoordinatorGrantsAuthority,
  type EffectOps, type RehearsalGate, type EffectObservationLite,
} from '../src/index.js';

const EFFECT_ID = 'ab'.repeat(32);
const BRANCH = 'candidate/abababababab';
const REF = 'cd'.repeat(32);

interface OverridableOps {
  rehearse?: RehearsalGate;
  authorized?: boolean;
  observed?: EffectObservationLite;
  isolationIntact?: boolean;
  settleOk?: boolean;
  auditOk?: (toPhase: string) => boolean;
}
function makeOps(o: OverridableOps = {}): { ops: EffectOps; audits: Array<{ phase: string; hasRef: boolean }>; effectRan: () => number } {
  const audits: Array<{ phase: string; hasRef: boolean }> = [];
  let ran = 0;
  const ops: EffectOps = {
    rehearse: () => o.rehearse ?? { proceed: true, status: 'passed' },
    ownerAuthorize: () => ({ authorized: o.authorized ?? true }),
    prepare: () => ({ effectId: EFFECT_ID, candidateBranch: BRANCH }),
    snapshotBefore: () => ({ head: 'A', tree: 'T' }),
    runGitEffect: () => { ran += 1; return o.observed ?? { candidatePresent: true, completionRef: REF, snapshotAfter: { head: 'A', tree: 'T' } }; },
    verifyIsolation: () => ({ intact: o.isolationIntact ?? true }),
    settle: () => ({ ok: o.settleOk ?? true }),
    audit: (_id, toPhase, hasRef) => { audits.push({ phase: toPhase, hasRef }); return { ok: o.auditOk ? o.auditOk(toPhase) : true }; },
  };
  return { ops, audits, effectRan: () => ran };
}

describe('effect coordinator · the one committed path', () => {
  it('owner-authorized + present candidate + isolation intact + completion ref → COMMITTED, and every transition is audited', () => {
    const { ops, audits, effectRan } = makeOps();
    const r = driveEffect(ops);
    expect(r.ok).toBe(true);
    expect(r.phase).toBe('COMMITTED');
    expect(r.completionRef).toBe(REF);
    expect(r.touchedMain).toBe(false);
    expect(r.grantsAuthority).toBe(false);
    expect(effectRan()).toBe(1);                          // the effect ran exactly once
    expect(audits.map((a) => a.phase)).toContain('COMMITTED');
    expect(audits.map((a) => a.phase)).toEqual(['REHEARSAL', 'PREPARED', 'EXECUTING', 'OBSERVED', 'COMMITTED']);
    expect(effectCoordinatorGrantsAuthority()).toBe(false);
  });
});

describe('effect coordinator · halts before the effect', () => {
  it('a failed rehearsal halts at REHEARSAL_FAILED; the effect never runs', () => {
    const { ops, effectRan } = makeOps({ rehearse: { proceed: false, status: 'failed' } });
    const r = driveEffect(ops);
    expect(r.phase).toBe('REHEARSAL_FAILED');
    expect(r.reasonClass).toBe('coordinator:rehearsal-failed');
    expect(effectRan()).toBe(0);
  });

  it('an unavailable hermetic rehearsal that does not satisfy the gate halts (never a fabricated proceed)', () => {
    const { ops, effectRan } = makeOps({ rehearse: { proceed: false, status: 'unavailable' } });
    expect(driveEffect(ops).reasonClass).toBe('coordinator:rehearsal-unavailable');
    expect(effectRan()).toBe(0);
  });

  it('owner refusal halts at REFUSED_AT_OWNER; the effect never runs', () => {
    const { ops, effectRan } = makeOps({ authorized: false });
    const r = driveEffect(ops);
    expect(r.phase).toBe('REFUSED_AT_OWNER');
    expect(effectRan()).toBe(0);
  });
});

describe('effect coordinator · quarantine every ambiguous outcome (never a silent success)', () => {
  it('an isolation violation → QUARANTINED even though the candidate is present', () => {
    const { ops } = makeOps({ isolationIntact: false });
    const r = driveEffect(ops);
    expect(r.phase).toBe('QUARANTINED');
    expect(r.reasonClass).toBe('coordinator:isolation-violated');
  });

  it('candidate absent after the effect → QUARANTINED, never re-run', () => {
    const { ops, effectRan } = makeOps({ observed: { candidatePresent: false, completionRef: null, snapshotAfter: { head: 'A', tree: 'T' } } });
    const r = driveEffect(ops);
    expect(r.phase).toBe('QUARANTINED');
    expect(r.reasonClass).toBe('coordinator:candidate-absent');
    expect(effectRan()).toBe(1); // ran once; not retried
  });

  it('present candidate but null completion ref → RECONCILE_REQUIRED (no clean success without a receipt)', () => {
    const { ops } = makeOps({ observed: { candidatePresent: true, completionRef: null, snapshotAfter: { head: 'A', tree: 'T' } } });
    expect(driveEffect(ops).phase).toBe('RECONCILE_REQUIRED');
  });

  it('the audit ledger refusing EXECUTING (a second candidate) quarantines and the effect never runs', () => {
    const { ops, effectRan } = makeOps({ auditOk: (phase) => phase !== 'EXECUTING' });
    const r = driveEffect(ops);
    expect(r.phase).toBe('QUARANTINED');
    expect(r.reasonClass).toBe('coordinator:second-candidate-refused');
    expect(effectRan()).toBe(0);
  });

  it('a rejected projection-only settlement → RECONCILE_REQUIRED (unsettled, not a silent commit)', () => {
    const { ops } = makeOps({ settleOk: false });
    const r = driveEffect(ops);
    expect(r.phase).toBe('RECONCILE_REQUIRED');
    expect(r.reasonClass).toBe('coordinator:settlement-unaccepted');
  });
});
