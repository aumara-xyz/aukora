// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * AURA portable trace law — recursive forbidden-field/value refusal, positive allowlist, verbatim TRACE_LIMITS,
 * and erasure-honest verification. Evidence never authority.
 */
import { describe, it, expect } from 'vitest';
import {
  sanitizeTraceEvent, AuraTraceLog, TRACE_LIMITS, auraTraceGrantsAuthority,
  scanForbiddenKeys, scanForbiddenValues, scanForbiddenAuthorityClaims, forbiddenContentGrantsAuthority,
} from '../src/index.js';

const cleanRaw = () => ({ eventId: 'e1', timestampMs: 1, phase: 'refused', stage: 'refused-secret', receiptMode: 'witness', source: 'governedRecursion' });

describe('recursive forbidden-content scanners', () => {
  it('finds a forbidden KEY at any depth (nested objects + arrays)', () => {
    expect(scanForbiddenKeys({ apiKey: 'x' }).length).toBe(1);
    expect(scanForbiddenKeys({ a: { b: [{ secretKey: 'x' }] } }).length).toBe(1);
    expect(scanForbiddenKeys({ 'private-key': 'x' }).length).toBe(1); // normalized regex variant
    expect(scanForbiddenKeys({ ok: 1, nested: { fine: 'value' } }).length).toBe(0);
  });

  it('finds forbidden secret/production VALUES in strings at any depth', () => {
    expect(scanForbiddenValues({ v: 'ab'.repeat(32) }).length).toBe(1);            // 64-hex
    expect(scanForbiddenValues({ v: 'sk-abcdefghij0123456789' }).length).toBe(1);   // openai-shaped
    expect(scanForbiddenValues({ v: '-----BEGIN RSA PRIVATE KEY-----' }).length).toBe(1);
    expect(scanForbiddenValues({ nested: ['fine', { deep: 'x.convex.cloud' }] }).length).toBe(1);
    expect(scanForbiddenValues({ v: 'a safe short label' }).length).toBe(0);
  });

  it('finds false-authority CONTENT in strings', () => {
    expect(scanForbiddenAuthorityClaims({ s: 'grantsAuthority=true' }).length).toBe(1);
    expect(scanForbiddenAuthorityClaims({ s: 'advisoryOnly=false' }).length).toBe(1);
    expect(scanForbiddenAuthorityClaims({ s: 'a normal refusal category' }).length).toBe(0);
  });

  it('grants no authority', () => {
    expect(forbiddenContentGrantsAuthority()).toBe(false);
    expect(auraTraceGrantsAuthority()).toBe(false);
  });
});

describe('sanitizeTraceEvent — allowlist + recursive forbidden refusal + bounds', () => {
  it('accepts a clean event and stamps the containment literals', () => {
    const res = sanitizeTraceEvent(cleanRaw());
    expect(res.ok).toBe(true);
    expect(res.event?.classification).toBe('TRACE_ONLY');
    expect(res.event?.advisoryOnly).toBe(true);
    expect(res.event?.grantsAuthority).toBe(false);
  });

  it('drops a harmless UNKNOWN field, but REJECTS an unknown field that is a forbidden key', () => {
    const dropped = sanitizeTraceEvent({ ...cleanRaw(), harmlessUnknown: 'x' });
    expect(dropped.ok).toBe(true);
    expect(dropped.droppedFields).toContain('harmlessUnknown');
    expect(Object.keys(dropped.event as object)).not.toContain('harmlessUnknown');

    const rejected = sanitizeTraceEvent({ ...cleanRaw(), apiKey: 'x' }); // forbidden key at top level
    expect(rejected.ok).toBe(false);
  });

  it('REJECTS the whole record if a forbidden key or secret value appears at any depth', () => {
    expect(sanitizeTraceEvent({ ...cleanRaw(), refusalCause: 'ab'.repeat(32) }).ok).toBe(false); // 64-hex value
    // a forbidden key can only arrive via a nested unknown blob; the recursive scan still catches it.
    expect(sanitizeTraceEvent({ ...cleanRaw(), meta: { nested: { apiKey: 'x' } } }).ok).toBe(false);
    expect(sanitizeTraceEvent({ ...cleanRaw(), stage: 'grantsAuthority=true' }).ok).toBe(false); // authority-shaped output
  });

  it('bounds strings to TRACE_LIMITS and keeps only a SHORT hex intent prefix', () => {
    const res = sanitizeTraceEvent({ ...cleanRaw(), refusalCause: 'z'.repeat(200), intentPrefix: '4ac84bf07eb3' });
    expect(res.ok).toBe(true);
    expect(res.event?.refusalCause?.length).toBe(TRACE_LIMITS.MAX_REASON);
    expect(res.event?.intentPrefix).toBe('4ac84bf07eb3');
    // a non-hex or over-long "prefix" is dropped
    expect(sanitizeTraceEvent({ ...cleanRaw(), intentPrefix: 'not-hex!!' }).event?.intentPrefix).toBeUndefined();
  });

  it('rejects non-plain-object input', () => {
    expect(sanitizeTraceEvent(null).ok).toBe(false);
    expect(sanitizeTraceEvent([1, 2]).ok).toBe(false);
    expect(sanitizeTraceEvent('x').ok).toBe(false);
  });
});

describe('AuraTraceLog — bounded store, self-audit, and honest erasure', () => {
  it('records clean events, refuses forbidden ones, and self-audits clean', () => {
    const log = new AuraTraceLog();
    expect(log.record(cleanRaw()).ok).toBe(true);
    expect(log.record({ ...cleanRaw(), eventId: 'e2', refusalCause: 'ab'.repeat(32) }).ok).toBe(false); // not stored
    expect(log.count()).toBe(1);
    expect(log.audit().clean).toBe(true);
  });

  it('ring-buffers at TRACE_LIMITS.MAX_TRACES (live emission cannot grow memory)', () => {
    const log = new AuraTraceLog();
    for (let i = 0; i < TRACE_LIMITS.MAX_TRACES + 5; i += 1) log.record({ ...cleanRaw(), eventId: `e${i}` });
    expect(log.count()).toBe(TRACE_LIMITS.MAX_TRACES);
  });

  it('erasure is HONEST and VERIFIABLE — a content-free tombstone remains, no residue', () => {
    const log = new AuraTraceLog();
    log.record({ ...cleanRaw(), eventId: 'to-erase', refusalCause: 'refused-secret' });
    const before = log.count();

    const erased = log.erase('to-erase');
    expect(erased.ok).toBe(true);
    expect(log.count()).toBe(before); // the tombstone stays — the audit that it existed is preserved

    const verdict = log.verifyErasure('to-erase');
    expect(verdict.honest).toBe(true);

    // the stored tombstone carries no content field, and no live copy remains
    const tomb = log.traces().find((t) => t.eventId === 'to-erase') as unknown as Record<string, unknown>;
    expect(tomb.erased).toBe(true);
    expect(tomb.refusalCause).toBeUndefined();
    expect(tomb.stage).toBeUndefined();
    expect(log.audit().clean).toBe(true);
  });

  it('verifyErasure is false for an un-erased or unknown id', () => {
    const log = new AuraTraceLog();
    log.record({ ...cleanRaw(), eventId: 'live' });
    expect(log.verifyErasure('live').honest).toBe(false);   // still live
    expect(log.verifyErasure('nope').honest).toBe(false);   // unknown
    expect(log.erase('nope').ok).toBe(false);
  });
});
