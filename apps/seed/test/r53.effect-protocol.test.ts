// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * The crash-recoverable EFFECT PROTOCOL (#22 overnight) — pure state-machine contract. These tests pin the four
 * structural invariants and the exceptional-state legality, independent of any Git or store implementation:
 *   1. Git begins only after consuming a durable PREPARED effect (the ONE gate into EXECUTING; consume-once).
 *   2. A crash in EXECUTING is recovered by OBSERVING reality, never by re-executing.
 *   3. No clean success carries a null completion receipt (COMMITTED requires a durable completionRef).
 *   4. No crash creates a second candidate (the candidate branch is fixed at PREPARE; reconcile reuses it).
 */
import { describe, it, expect } from 'vitest';
import {
  advance, reconcile, isCleanSuccess, gitMayBegin, TERMINAL_PHASES,
  InMemoryPreparedEffectStore, effectProtocolGrantsAuthority,
  type PreparedEffect, type EffectPhase, type EffectEvent, type EffectObservation,
} from '../src/index.js';

const EFFECT_ID = 'ab'.repeat(32);
/** Narrow a refused step to its reason class (throws if the step unexpectedly succeeded). */
function reasonOf(step: ReturnType<typeof advance>): string {
  if (step.ok) throw new Error('expected a refusal but the step succeeded');
  return step.reasonClass;
}
function seed(over: Partial<PreparedEffect> = {}): PreparedEffect {
  return {
    schema: 'aukora-prepared-effect-v1', effectId: EFFECT_ID, phase: 'PROPOSED',
    candidateBranch: null, consumedForExecution: false, completionRef: null, grantsAuthority: false, ...over,
  };
}
/** Drive the machine through a happy forward path to the requested phase, asserting each step succeeds. */
function driveTo(target: EffectPhase): PreparedEffect {
  let e = seed();
  const path: Array<[EffectEvent, Partial<PreparedEffect>]> = [
    ['qualify', {}], ['policyRehearsalPass', {}], ['hermeticRehearsalPass', {}], ['awaitOwner', {}],
    ['prepare', { candidateBranch: 'candidate/abababababab' }], ['beginEffect', {}],
    ['observe', { completionRef: 'receipt-abc' }], ['commit', {}],
  ];
  for (const [event, patch] of path) {
    e = { ...e, ...patch };
    const step = advance(e, event);
    if (!step.ok) throw new Error(`unexpected refusal at ${event}: ${step.reasonClass}`);
    e = step.effect;
    if (e.phase === target) return e;
  }
  return e;
}

describe('effect protocol · the governed forward path', () => {
  it('walks PROPOSED→…→COMMITTED with each transition legal and terminalizing at COMMITTED', () => {
    const committed = driveTo('COMMITTED');
    expect(committed.phase).toBe('COMMITTED');
    expect(TERMINAL_PHASES.has('COMMITTED')).toBe(true);
    expect(reasonOf(advance(committed, 'observe'))).toBe('effect:already-terminal');
    expect(effectProtocolGrantsAuthority()).toBe(false);
  });

  it('every event illegal from PROPOSED is refused fail-closed (only qualify/refuse/cancel/quarantine legal)', () => {
    for (const event of ['policyRehearsalPass', 'prepare', 'beginEffect', 'observe', 'commit', 'compensate', 'flagReconcile'] as EffectEvent[]) {
      const step = advance(seed(), event);
      expect(step.ok, event).toBe(false);
    }
    expect(advance(seed(), 'qualify').ok).toBe(true);
  });
});

describe('INVARIANT 1+4 · Git begins only after consuming a durable PREPARED; no second candidate', () => {
  it('beginEffect is the ONLY gate into EXECUTING and consumes the PREPARED marker once', () => {
    const prepared = { ...driveTo('PREPARED') };
    expect(prepared.phase).toBe('PREPARED');
    expect(gitMayBegin(prepared)).toBe(true);
    const executing = advance(prepared, 'beginEffect');
    expect(executing.ok).toBe(true);
    expect((executing as { effect: PreparedEffect }).effect.phase).toBe('EXECUTING');
    expect((executing as { effect: PreparedEffect }).effect.consumedForExecution).toBe(true);
    expect(gitMayBegin((executing as { effect: PreparedEffect }).effect)).toBe(false);
  });

  it('a second beginEffect on an already-consumed effect refuses — never mints a second candidate', () => {
    const consumed = { ...driveTo('PREPARED'), phase: 'PREPARED' as EffectPhase, consumedForExecution: true, candidateBranch: 'candidate/abababababab' };
    const step = advance(consumed, 'beginEffect');
    expect(step.ok).toBe(false);
    expect(reasonOf(step)).toBe('effect:prepared-already-consumed');
  });

  it('beginEffect refuses if no candidate branch was bound at PREPARE', () => {
    const noCandidate = { ...seed({ phase: 'PREPARED', candidateBranch: null }) };
    expect(gitMayBegin(noCandidate)).toBe(false);
    expect(reasonOf(advance(noCandidate, 'beginEffect'))).toBe('effect:no-candidate-bound');
  });
});

describe('INVARIANT 2 · a crash in EXECUTING is recovered by OBSERVING, never by re-executing', () => {
  const executing = (): PreparedEffect => seed({ phase: 'EXECUTING', consumedForExecution: true, candidateBranch: 'candidate/abababababab' });

  it('candidate present + completion ref + isolation intact → COMMITTED (applied exactly once)', () => {
    const obs: EffectObservation = { candidatePresent: true, completionRef: 'receipt-xyz', isolationIntact: true };
    const step = reconcile(executing(), obs);
    expect(step.ok).toBe(true);
    expect((step as { effect: PreparedEffect }).effect.phase).toBe('COMMITTED');
    expect((step as { effect: PreparedEffect }).effect.completionRef).toBe('receipt-xyz');
  });

  it('candidate absent → QUARANTINED, never a silent re-execute', () => {
    const step = reconcile(executing(), { candidatePresent: false, completionRef: null, isolationIntact: true });
    expect((step as { effect: PreparedEffect }).effect.phase).toBe('QUARANTINED');
  });

  it('candidate present but no completion ref (or isolation unconfirmed) → RECONCILE_REQUIRED', () => {
    expect((reconcile(executing(), { candidatePresent: true, completionRef: null, isolationIntact: true }) as { effect: PreparedEffect }).effect.phase).toBe('RECONCILE_REQUIRED');
    expect((reconcile(executing(), { candidatePresent: true, completionRef: 'r', isolationIntact: false }) as { effect: PreparedEffect }).effect.phase).toBe('RECONCILE_REQUIRED');
  });

  it('reconcile is refused for a non-crashed phase (it is not a general transition)', () => {
    expect(reconcile(seed({ phase: 'AWAITING_OWNER' }), { candidatePresent: true, completionRef: 'r', isolationIntact: true }).ok).toBe(false);
  });

  it('a crashed EXECUTING effect can NEVER re-enter EXECUTING via advance (consumed marker holds)', () => {
    expect(advance(executing(), 'beginEffect').ok).toBe(false); // already terminal? no — EXECUTING; illegal-transition
    expect(reasonOf(advance(executing(), 'beginEffect'))).toBe('effect:illegal-transition');
  });
});

describe('INVARIANT 3 · no clean success carries a null completion receipt', () => {
  it('commit from OBSERVED with a null completionRef is refused and never recorded as success', () => {
    const observed = seed({ phase: 'OBSERVED', consumedForExecution: true, candidateBranch: 'candidate/abababababab', completionRef: null });
    const step = advance(observed, 'commit');
    expect(step.ok).toBe(false);
    expect(reasonOf(step)).toBe('effect:null-completion-receipt');
    expect(isCleanSuccess(step.effect)).toBe(false);
  });

  it('commit from OBSERVED WITH a completionRef succeeds and is a clean success', () => {
    const observed = seed({ phase: 'OBSERVED', consumedForExecution: true, candidateBranch: 'candidate/abababababab', completionRef: 'receipt-ok' });
    const step = advance(observed, 'commit');
    expect(step.ok).toBe(true);
    expect(isCleanSuccess(step.effect)).toBe(true);
  });

  it('isCleanSuccess is false for any non-COMMITTED phase and for COMMITTED-without-ref', () => {
    expect(isCleanSuccess(seed({ phase: 'EXECUTING' }))).toBe(false);
    expect(isCleanSuccess(seed({ phase: 'COMMITTED', completionRef: null }))).toBe(false);
    expect(isCleanSuccess(seed({ phase: 'COMMITTED', completionRef: 'r' }))).toBe(true);
  });
});

describe('exceptional states are first-class + legality is fail-closed', () => {
  it('refuse/rehearsalFail/cancel are legal only from their allowed phases', () => {
    expect(advance(seed({ phase: 'PROPOSED' }), 'refuse').ok).toBe(true);
    expect(advance(seed({ phase: 'EXECUTING' }), 'refuse').ok).toBe(false);              // too late to plain-refuse
    expect(advance(seed({ phase: 'QUALIFIED' }), 'rehearsalFail').ok).toBe(true);
    expect(advance(seed({ phase: 'AWAITING_OWNER' }), 'rehearsalFail').ok).toBe(false);
    expect(advance(seed({ phase: 'AWAITING_OWNER' }), 'cancel').ok).toBe(true);          // clean cancel before prepare
    expect(advance(seed({ phase: 'EXECUTING' }), 'cancel').ok).toBe(false);              // after prepare → must compensate
  });

  it('compensate is legal only from OBSERVED / RECONCILE_REQUIRED (a landed effect rolled back)', () => {
    expect(advance(seed({ phase: 'OBSERVED' }), 'compensate').ok).toBe(true);
    expect(advance(seed({ phase: 'RECONCILE_REQUIRED' }), 'compensate').ok).toBe(true);
    expect(advance(seed({ phase: 'PREPARED' }), 'compensate').ok).toBe(false);
  });

  it('quarantine is legal from any non-terminal phase; terminals are inert', () => {
    for (const phase of ['PROPOSED', 'PREPARED', 'EXECUTING', 'OBSERVED', 'RECONCILE_REQUIRED'] as EffectPhase[]) {
      expect(advance(seed({ phase }), 'quarantine').ok, phase).toBe(true);
    }
    expect(reasonOf(advance(seed({ phase: 'COMMITTED', completionRef: 'r' }), 'quarantine'))).toBe('effect:already-terminal');
  });
});

describe('durable seam · InMemoryPreparedEffectStore (Sam 2 trusted-state contract spec)', () => {
  it('optimistic concurrency: create requires expectedPhase null; a stale expected phase conflicts', () => {
    const store = new InMemoryPreparedEffectStore();
    const e = seed({ phase: 'PREPARED', candidateBranch: 'candidate/abababababab' });
    expect(store.save(e, null)).toEqual({ ok: true });               // create
    expect(store.save({ ...e, phase: 'EXECUTING' }, 'AWAITING_OWNER')).toEqual({ ok: false, reason: 'conflict' }); // wrong prior
    expect(store.save({ ...e, phase: 'EXECUTING', consumedForExecution: true }, 'PREPARED')).toEqual({ ok: true });
    expect(store.load(EFFECT_ID)?.phase).toBe('EXECUTING');
  });

  it('a non-projection (authority-claiming or wrong schema) is refused at the seam', () => {
    const store = new InMemoryPreparedEffectStore();
    expect(store.save({ ...seed(), grantsAuthority: true as unknown as false }, null)).toEqual({ ok: false, reason: 'refused' });
    expect(store.save({ ...seed(), schema: 'evil' as unknown as PreparedEffect['schema'] }, null)).toEqual({ ok: false, reason: 'refused' });
  });
});
