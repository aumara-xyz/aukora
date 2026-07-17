// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Post-effect settlement is PROJECTION-ONLY (#22 overnight, item 4). Pins: a valid settlement is a content-free
 * projection; a total fail-closed validator names the first bad field and refuses any authority-shaped key, extra
 * key, content field, malformed shape, or a COMMITTED settlement lacking a durable completion reference.
 */
import { describe, it, expect } from 'vitest';
import {
  validateSettlement, isProjectionOnlySettlement, effectSettlementGrantsAuthority,
  type EffectSettlementV1,
} from '../src/index.js';

const HEX64 = 'ab'.repeat(32);
/** Narrow a refused verdict to its field label (throws if it unexpectedly validated). */
function fieldOf(v: ReturnType<typeof validateSettlement>): string {
  if (v.ok) throw new Error('expected a refusal but the settlement validated');
  return v.field;
}
const good = (over: Partial<EffectSettlementV1> = {}): Record<string, unknown> => ({
  schema: 'aukora-effect-settlement-v1', effectId: HEX64, phase: 'AWAITING_OWNER',
  candidateBranch: null, completionRef: null, updatedAtIso: '2026-07-17T00:00:00.000Z',
  advisoryOnly: true, grantsAuthority: false, ...over,
});

describe('effect settlement — projection-only, valid shapes', () => {
  it('a well-formed projection validates and is projection-only', () => {
    const v = validateSettlement(good());
    expect(v.ok).toBe(true);
    expect(isProjectionOnlySettlement(good())).toBe(true);
    expect(effectSettlementGrantsAuthority()).toBe(false);
  });

  it('a COMMITTED settlement with a durable completion ref + candidate branch validates', () => {
    expect(validateSettlement(good({ phase: 'COMMITTED', completionRef: 'cd'.repeat(32), candidateBranch: 'candidate/abababababab' })).ok).toBe(true);
  });

  it('every settleable phase is accepted', () => {
    for (const phase of ['AWAITING_OWNER', 'PREPARED', 'REFUSED', 'REHEARSAL_FAILED', 'CANCELLED_BEFORE_PREPARE', 'RECONCILE_REQUIRED', 'QUARANTINED', 'COMPENSATED'] as EffectSettlementV1['phase'][]) {
      expect(validateSettlement(good({ phase })).ok, phase).toBe(true);
    }
  });
});

describe('effect settlement — fail-closed refusals (names the first bad field)', () => {
  it('refuses non-objects, wrong key sets, and extra keys', () => {
    expect(validateSettlement(null)).toEqual({ ok: false, field: 'not-an-object' });
    expect(validateSettlement([good()])).toEqual({ ok: false, field: 'not-an-object' });
    expect(validateSettlement({ ...good(), extra: 1 })).toEqual({ ok: false, field: 'key-set' });
    const { completionRef, ...missing } = good(); void completionRef;
    expect(validateSettlement(missing)).toEqual({ ok: false, field: 'key-set' });
  });

  it('refuses an authority/content-shaped key even if it displaced a legit one (belt over key-set)', () => {
    // swap `completionRef` for a `signature` key → same key COUNT, but an authority-shaped key present
    const { completionRef, ...rest } = good(); void completionRef;
    expect(validateSettlement({ ...rest, signature: 'ab'.repeat(64) })).toEqual({ ok: false, field: 'authority-shaped-key' });
    const { candidateBranch, ...rest2 } = good(); void candidateBranch;
    expect(validateSettlement({ ...rest2, newContent: 'plaintext' })).toEqual({ ok: false, field: 'authority-shaped-key' });
  });

  it('refuses malformed field shapes', () => {
    expect(fieldOf(validateSettlement(good({ effectId: 'nothex' as string })))).toBe('effectId');
    expect(fieldOf(validateSettlement(good({ phase: 'EXECUTING' as EffectSettlementV1['phase'] })))).toBe('phase'); // EXECUTING is not settleable
    expect(fieldOf(validateSettlement(good({ candidateBranch: 'main' as string })))).toBe('candidateBranch');       // only candidate/* allowed
    expect(fieldOf(validateSettlement(good({ completionRef: 'short' as string })))).toBe('completionRef');
    expect(fieldOf(validateSettlement(good({ advisoryOnly: false as unknown as true })))).toBe('advisoryOnly');
    expect(fieldOf(validateSettlement(good({ grantsAuthority: true as unknown as false })))).toBe('grantsAuthority');
  });

  it('refuses a COMMITTED settlement with a null completion reference (no clean success without a receipt)', () => {
    expect(fieldOf(validateSettlement(good({ phase: 'COMMITTED', completionRef: null })))).toBe('committed-null-completion');
    expect(isProjectionOnlySettlement(good({ phase: 'COMMITTED', completionRef: null }))).toBe(false);
  });
});
