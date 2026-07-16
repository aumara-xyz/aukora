// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Pure proposal law: exact-shape validation (anti-smuggling), canonical 64-hex identity, and supersedes lineage.
 */
import { describe, it, expect } from 'vitest';
import {
  validateProposalShape, deriveIntentId, deriveDraftHash, evaluateLineage, patchByteLength, LIMITS, isHex64,
  proposalGrantsAuthority, type Proposal,
} from '../src/index.js';

const HEX_64 = /^[0-9a-f]{64}$/;
const good = (): Record<string, unknown> => ({ id: 'p1', targetPath: 'apps/seed/src/recursion.ts', newContent: '// note', createdAt: '2026-07-16T12:00:00.000Z', supersedes: null });

describe('proposal shape validation — exact-key, data-only, snapshot-first', () => {
  it('accepts a well-formed proposal and returns a fresh frozen plain snapshot', () => {
    const r = validateProposalShape(good());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Object.isFrozen(r.proposal)).toBe(true);
    expect(Object.getPrototypeOf(r.proposal)).toBe(Object.prototype);
    expect(r.proposal.newContent).toBe('// note');
  });

  it('rejects non-objects, arrays, and non-plain prototypes', () => {
    for (const bad of [null, undefined, 42, 'x', true]) expect(validateProposalShape(bad).ok).toBe(false);
    expect(validateProposalShape([1, 2, 3]).ok).toBe(false);
    class Weird { id = 'p1'; }
    expect(validateProposalShape(new Weird()).ok).toBe(false);
    expect(validateProposalShape(Object.create({ hi: 1 })).ok).toBe(false);
  });

  it('rejects an UNKNOWN extra key (count mismatch)', () => {
    const r = validateProposalShape({ ...good(), extra: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/key-count/);
  });

  it('rejects a MISSING key', () => {
    const o = good();
    delete o.supersedes;
    expect(validateProposalShape(o).ok).toBe(false);
  });

  it('rejects a SYMBOL-keyed field (Reflect.ownKeys sees it)', () => {
    const o: Record<PropertyKey, unknown> = { id: 'p1', targetPath: 'apps/seed/src/recursion.ts', newContent: '// note', createdAt: '2026-07-16T12:00:00.000Z' };
    o[Symbol('supersedes')] = null; // 5 own keys, one is a symbol → smuggling
    const r = validateProposalShape(o);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/symbol-keyed/);
  });

  it('rejects a NON-ENUMERABLE data property', () => {
    const o: Record<string, unknown> = { id: 'p1', targetPath: 'apps/seed/src/recursion.ts', newContent: '// note', createdAt: '2026-07-16T12:00:00.000Z' };
    Object.defineProperty(o, 'supersedes', { value: null, enumerable: false, configurable: true, writable: true });
    const r = validateProposalShape(o);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/non-enumerable/);
  });

  it('rejects a GETTER (accessor) property', () => {
    const o: Record<string, unknown> = { id: 'p1', targetPath: 'apps/seed/src/recursion.ts', createdAt: '2026-07-16T12:00:00.000Z', supersedes: null };
    Object.defineProperty(o, 'newContent', { get: () => '// smuggled', enumerable: true, configurable: true });
    const r = validateProposalShape(o);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/accessor/);
  });

  it('NEUTRALISES a read-varying proxy: it is read exactly once, so validate-clean/use-dirty cannot diverge', () => {
    let reads = 0;
    const target = { id: 'p1', targetPath: 'apps/seed/src/recursion.ts', newContent: '// clean', createdAt: '2026-07-16T12:00:00.000Z', supersedes: null };
    const proxy = new Proxy(target, {
      get(t, k, r) {
        if (k === 'newContent') { reads += 1; return reads === 1 ? '// clean' : 'AKIAIOSFODNN7EXAMPLE'; }
        return Reflect.get(t, k, r);
      },
    });
    const res = validateProposalShape(proxy);
    const readsDuringValidation = reads; // capture immediately — later assertions must not touch the proxy
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(readsDuringValidation).toBe(1);                   // validation performed exactly one [[Get]] on newContent
    expect(res.proposal.newContent).toBe('// clean');        // the captured (first-read) value, forever
    expect(Object.getPrototypeOf(res.proposal)).toBe(Object.prototype); // a fresh plain snapshot, not the proxy
    expect(Object.isFrozen(res.proposal)).toBe(true);
    // The snapshot is the ONLY thing downstream ever sees, so a 2nd-read "DIRTY" value can never surface.
    expect(res.proposal.newContent).toBe('// clean');
  });

  it('rejects a supersedes that is neither null nor 64-hex', () => {
    expect(validateProposalShape({ ...good(), supersedes: 'not-hex' }).ok).toBe(false);
    expect(validateProposalShape({ ...good(), supersedes: 'ABCD'.repeat(16) }).ok).toBe(false); // uppercase → not [0-9a-f]
    expect(validateProposalShape({ ...good(), supersedes: 'ab'.repeat(32) }).ok).toBe(true);     // 64 lowercase hex
  });
});

describe('canonical identity + lineage', () => {
  const p: Proposal = { id: 'p1', targetPath: 'apps/seed/src/recursion.ts', newContent: '// note', createdAt: '2026-07-16T12:00:00.000Z', supersedes: null };

  it('intentId and draftHash are canonical 64-hex and deterministic', () => {
    expect(deriveIntentId(p)).toMatch(HEX_64);
    expect(deriveDraftHash(p)).toMatch(HEX_64);
    expect(deriveIntentId(p)).toBe(deriveIntentId({ ...p }));
    expect(isHex64(deriveIntentId(p))).toBe(true);
  });

  it('intentId ignores content (same intent across re-drafts) but draftHash binds content', () => {
    const redraft = { ...p, newContent: '// a different draft of the same intent' };
    expect(deriveIntentId(redraft)).toBe(deriveIntentId(p));       // same target + supersedes ⇒ same intent
    expect(deriveDraftHash(redraft)).not.toBe(deriveDraftHash(p)); // different bytes ⇒ different draft
  });

  it('intentId changes with target and with supersedes', () => {
    expect(deriveIntentId({ ...p, targetPath: 'apps/brain/src/reactiveStore.ts' })).not.toBe(deriveIntentId(p));
    expect(deriveIntentId({ ...p, supersedes: 'ab'.repeat(32) })).not.toBe(deriveIntentId(p));
  });

  it('lineage: null supersedes ⇒ depth 0; unknown ancestor ⇒ refused; over-deep ⇒ refused', () => {
    expect(evaluateLineage(null, () => undefined)).toEqual({ ok: true, depth: 0 });
    const unknown = evaluateLineage('ab'.repeat(32), () => undefined);
    expect(unknown.ok).toBe(false);
    const deep = evaluateLineage('ab'.repeat(32), () => LIMITS.MAX_LINEAGE_DEPTH);
    expect(deep.ok).toBe(false); // parent at max ⇒ child depth max+1 > max
    const ok = evaluateLineage('ab'.repeat(32), () => 0);
    expect(ok).toEqual({ ok: true, depth: 1 });
  });

  it('patchByteLength counts UTF-8 bytes', () => {
    expect(patchByteLength('abc')).toBe(3);
    expect(patchByteLength('é')).toBe(2);   // 2-byte UTF-8
    expect(patchByteLength('😀')).toBe(4);  // 4-byte UTF-8
  });

  it('proposal law grants no authority', () => {
    expect(proposalGrantsAuthority()).toBe(false);
  });
});
