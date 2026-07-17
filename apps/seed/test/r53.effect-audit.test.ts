// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Effect audit ledger (#22 overnight) — enforces the directive's closing invariant across a whole effect life:
 * "No clean success may lack a durable completion reference, and no crash may create a second candidate."
 * Pins: append-time fail-closed refusal of a second EXECUTING and of a COMMITTED without a completion bit, plus
 * an independent verify() over a rehydrated log.
 */
import { describe, it, expect } from 'vitest';
import {
  EffectAuditLedger, verifyAuditLog, effectAuditGrantsAuthority,
  type EffectAuditEntry,
} from '../src/index.js';

const E1 = 'ab'.repeat(32);
const E2 = 'cd'.repeat(32);
const entry = (over: Partial<EffectAuditEntry> & Pick<EffectAuditEntry, 'toPhase'>): EffectAuditEntry => ({
  effectId: E1, fromPhase: null, hasCompletionRef: false, at: '2026-07-17T00:00:00.000Z', ...over,
});

describe('effect audit ledger — append-time enforcement (fail-closed)', () => {
  it('records a normal lifecycle and reports one candidate created', () => {
    const led = new EffectAuditLedger();
    for (const p of ['PROPOSED', 'PREPARED', 'EXECUTING', 'OBSERVED']) {
      expect(led.append(entry({ toPhase: p })).ok).toBe(true);
    }
    expect(led.append(entry({ toPhase: 'COMMITTED', hasCompletionRef: true })).ok).toBe(true);
    expect(led.candidatesCreated(E1)).toBe(1);
    expect(led.log()).toHaveLength(5);
    expect(effectAuditGrantsAuthority()).toBe(false);
  });

  it('INVARIANT A — a SECOND transition into EXECUTING for the same effect is refused (no second candidate)', () => {
    const led = new EffectAuditLedger();
    expect(led.append(entry({ toPhase: 'EXECUTING' })).ok).toBe(true);
    // a crash-restart that tried to EXECUTE again would be a second candidate — refused
    const second = led.append(entry({ fromPhase: 'RECONCILE_REQUIRED', toPhase: 'EXECUTING' }));
    expect(second.ok).toBe(false);
    expect(second).toEqual({ ok: false, reasonClass: 'audit:second-candidate' });
    expect(led.candidatesCreated(E1)).toBe(1); // still exactly one
  });

  it('a DIFFERENT effect may enter EXECUTING independently (per-effect counting)', () => {
    const led = new EffectAuditLedger();
    expect(led.append(entry({ effectId: E1, toPhase: 'EXECUTING' })).ok).toBe(true);
    expect(led.append(entry({ effectId: E2, toPhase: 'EXECUTING' })).ok).toBe(true);
    expect(led.candidatesCreated(E2)).toBe(1);
  });

  it('INVARIANT B — COMMITTED without a completion-ref bit is refused (no clean success with a null receipt)', () => {
    const led = new EffectAuditLedger();
    const bad = led.append(entry({ toPhase: 'COMMITTED', hasCompletionRef: false }));
    expect(bad).toEqual({ ok: false, reasonClass: 'audit:null-completion' });
  });

  it('malformed entries are refused (bad effect id / phase / completion bit)', () => {
    const led = new EffectAuditLedger();
    expect(led.append(entry({ effectId: 'nothex', toPhase: 'PROPOSED' })).ok).toBe(false);
    expect(led.append(entry({ toPhase: '' })).ok).toBe(false);
    expect(led.append({ ...entry({ toPhase: 'PROPOSED' }), hasCompletionRef: 'yes' as unknown as boolean }).ok).toBe(false);
  });
});

describe('verifyAuditLog — independent re-proof over a rehydrated log', () => {
  it('passes a clean log', () => {
    const log: EffectAuditEntry[] = [
      entry({ toPhase: 'EXECUTING' }),
      entry({ toPhase: 'COMMITTED', hasCompletionRef: true }),
      entry({ effectId: E2, toPhase: 'EXECUTING' }),
    ];
    expect(verifyAuditLog(log)).toEqual({ ok: true });
  });

  it('catches a tampered log with two EXECUTING for one effect (bypassing the append guard)', () => {
    const log: EffectAuditEntry[] = [entry({ toPhase: 'EXECUTING' }), entry({ toPhase: 'EXECUTING' })];
    expect(verifyAuditLog(log)).toEqual({ ok: false, reasonClass: 'audit:second-candidate', effectId: E1 });
  });

  it('catches a tampered COMMITTED-without-completion-ref', () => {
    const log: EffectAuditEntry[] = [entry({ toPhase: 'COMMITTED', hasCompletionRef: false })];
    expect(verifyAuditLog(log)).toEqual({ ok: false, reasonClass: 'audit:null-completion', effectId: E1 });
  });
});
