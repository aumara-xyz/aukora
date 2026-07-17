// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Crash recovery planner (#22 overnight · SIGKILL at every effect phase). Exhaustively pins the recovery action
 * for a crash at EVERY phase, and the two hard safety laws: recovery never blindly re-executes, and never creates
 * a second candidate. The `couldReExecuteOnResume` witness proves the planner never picks RESUME_FORWARD where a
 * re-execute is possible.
 */
import { describe, it, expect } from 'vitest';
import {
  planRecovery, couldReExecuteOnResume, recoveryPlannerGrantsAuthority,
  type RecoveryAction,
} from '../src/index.js';

const ALL_PHASES = [
  'PROPOSED', 'QUALIFIED', 'POLICY_REHEARSAL_PASSED', 'HERMETIC_REHEARSAL_PASSED', 'AWAITING_OWNER',
  'PREPARED', 'EXECUTING', 'OBSERVED', 'COMMITTED',
  'REFUSED', 'REHEARSAL_FAILED', 'CANCELLED_BEFORE_PREPARE', 'RECONCILE_REQUIRED', 'QUARANTINED', 'COMPENSATED',
] as const;

describe('recovery planner · exhaustive crash-at-every-phase table (not consumed)', () => {
  const expected: Record<(typeof ALL_PHASES)[number], RecoveryAction> = {
    PROPOSED: 'RESUME_FORWARD', QUALIFIED: 'RESUME_FORWARD', POLICY_REHEARSAL_PASSED: 'RESUME_FORWARD',
    HERMETIC_REHEARSAL_PASSED: 'RESUME_FORWARD', AWAITING_OWNER: 'RESUME_FORWARD',
    PREPARED: 'RESUME_FORWARD',                 // durable but not consumed → first begin is safe
    EXECUTING: 'RECONCILE_BY_OBSERVATION',      // crash mid-effect → observe, never re-run
    OBSERVED: 'RESUME_FORWARD',                 // effect done → only settle/commit remain
    COMMITTED: 'TERMINAL_NOOP',
    REFUSED: 'TERMINAL_NOOP', REHEARSAL_FAILED: 'TERMINAL_NOOP', CANCELLED_BEFORE_PREPARE: 'TERMINAL_NOOP',
    RECONCILE_REQUIRED: 'RECONCILE_BY_OBSERVATION', QUARANTINED: 'TERMINAL_NOOP', COMPENSATED: 'TERMINAL_NOOP',
  };
  it.each(ALL_PHASES)('crash at %s (not consumed) → the pinned safe action', (phase) => {
    expect(planRecovery(phase, false).action).toBe(expected[phase]);
  });
  it('grants no authority', () => {
    expect(recoveryPlannerGrantsAuthority()).toBe(false);
  });
});

describe('recovery planner · the consume marker changes only the PREPARED case', () => {
  it('PREPARED + consumed → RECONCILE (the effect may have begun before EXECUTING was recorded)', () => {
    expect(planRecovery('PREPARED', true).action).toBe('RECONCILE_BY_OBSERVATION');
    expect(planRecovery('PREPARED', true).reasonClass).toBe('recovery:prepared-consumed-ambiguous');
    expect(planRecovery('PREPARED', false).action).toBe('RESUME_FORWARD');
  });

  it('a consume marker on a PRE-PREPARE phase is incoherent → QUARANTINE (fail closed)', () => {
    expect(planRecovery('AWAITING_OWNER', true).action).toBe('QUARANTINE');
    expect(planRecovery('PROPOSED', true).reasonClass).toBe('recovery:incoherent-consume-before-prepare');
  });

  it('EXECUTING reconciles regardless of the marker', () => {
    expect(planRecovery('EXECUTING', true).action).toBe('RECONCILE_BY_OBSERVATION');
    expect(planRecovery('EXECUTING', false).action).toBe('RECONCILE_BY_OBSERVATION');
  });
});

describe('recovery planner · the two hard safety laws', () => {
  it('NEVER blindly re-executes: no phase where a re-execute is possible is ever planned RESUME_FORWARD', () => {
    for (const phase of ALL_PHASES) {
      for (const consumed of [false, true]) {
        const plan = planRecovery(phase, consumed);
        if (couldReExecuteOnResume(phase, consumed)) {
          expect(plan.action, `${phase}/${consumed}`).not.toBe('RESUME_FORWARD');
          expect(plan.action, `${phase}/${consumed}`).toBe('RECONCILE_BY_OBSERVATION');
        }
      }
    }
  });

  it('an unknown phase fails closed to QUARANTINE', () => {
    expect(planRecovery('WAT', false).action).toBe('QUARANTINE');
    expect(planRecovery('', true).action).toBe('QUARANTINE');
    expect(planRecovery('WAT', false).reasonClass).toBe('recovery:unknown-phase');
  });

  it('couldReExecuteOnResume is true exactly for EXECUTING/RECONCILE_REQUIRED and PREPARED+consumed', () => {
    expect(couldReExecuteOnResume('EXECUTING', false)).toBe(true);
    expect(couldReExecuteOnResume('RECONCILE_REQUIRED', false)).toBe(true);
    expect(couldReExecuteOnResume('PREPARED', true)).toBe(true);
    expect(couldReExecuteOnResume('PREPARED', false)).toBe(false);
    expect(couldReExecuteOnResume('OBSERVED', true)).toBe(false);
    expect(couldReExecuteOnResume('AWAITING_OWNER', true)).toBe(false);
  });
});
