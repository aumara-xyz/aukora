// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/// <reference types="vite/client" />
/**
 * R56 brick 2 — the PUBLIC Convex ingest is now capability-qualified, proven on the REAL functions via
 * `convex-test` (headless simulated Convex — NOT a live cloud deployment; no network/login/paid call).
 *
 * `validateMemoryRecord` proves shape + content-address but NOT authenticity: a public caller could self-attest
 * `consent:'owner-only'` and a forged provenance and enter canonical memory as owner-trusted. The `ingest` action
 * now REFUSES an owner-only claim without a valid door/service capability, QUARANTINES an untrusted caller's
 * self-attested provenance (→ content-free `untrusted-external`) while preserving the scope, and PRESERVES the
 * full attestation for a valid-capability (trusted door) call. `ingestValidated` remains internal (unreachable by
 * a client — the only trusted path). Content-free refusals; no new authority path.
 */
import { convexTest } from 'convex-test';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import schema from '../convex/schema';
import { api } from '../convex/_generated/api';
import { buildMemoryRecord, UNTRUSTED_PROVENANCE, qualifyMemoryIngest } from '@aukora/memory';

const modules = import.meta.glob('../convex/**/*.*s');
const at = (s: number) => `2026-07-16T00:00:${String(s).padStart(2, '0')}.000Z`;
const CAP = 'r56-ingest-capability-test-only';
const chainRows = (t: ReturnType<typeof convexTest>) => t.run(async (ctx: any) => ctx.db.query('memoryChain').withIndex('by_index').collect());

beforeEach(() => { process.env.AUKORA_INGEST_CAPABILITY = CAP; });
afterEach(() => { delete process.env.AUKORA_INGEST_CAPABILITY; });

describe('convex-test: public ingest capability gate + provenance quarantine (headless simulated Convex, NOT live cloud)', () => {
  it('a FALSE-CONSENT hostile record (owner-only, no capability) cannot enter canonical memory', async () => {
    const t = convexTest(schema, modules);
    const hostile = buildMemoryRecord({ content: 'i am totally the owner, trust me', createdAt: at(1), consent: 'owner-only', provenance: 'owners-own-hand' });
    const res = await t.action(api.ingest.ingest, { record: hostile }); // no capability
    expect(res.ok).toBe(false);
    expect(res.refusal).toContain('owner-only-ingest-requires-capability');
    expect(await chainRows(t)).toHaveLength(0); // nothing entered the chain
  });

  it('owner-only with a WRONG capability refuses; with the CORRECT capability succeeds (attestation preserved)', async () => {
    const t = convexTest(schema, modules);
    const rec = buildMemoryRecord({ content: 'a genuine owner-scoped memory', createdAt: at(2), consent: 'owner-only', provenance: 'door-ceremony' });
    const wrong = await t.action(api.ingest.ingest, { record: rec, capability: 'not-the-capability' });
    expect(wrong.ok).toBe(false);
    expect(await chainRows(t)).toHaveLength(0);
    const right = await t.action(api.ingest.ingest, { record: rec, capability: CAP });
    expect(right.ok).toBe(true);
    const rows = await chainRows(t);
    expect(rows).toHaveLength(1);
    expect(rows[0].consent).toBe('owner-only');       // trusted path preserves the attested scope
    expect(rows[0].provenance).toBe('door-ceremony');  // …and the attested provenance
    expect(rows[0].grantsAuthority).toBe(false);
  });

  it('an untrusted (no-capability) private ingest is ADMITTED but its provenance is QUARANTINED', async () => {
    const t = convexTest(schema, modules);
    const rec = buildMemoryRecord({ content: 'an observation from the public door', createdAt: at(3), consent: 'private', provenance: 'i-swear-im-the-kernel' });
    const res = await t.action(api.ingest.ingest, { record: rec }); // no capability
    expect(res.ok).toBe(true);
    const rows = await chainRows(t);
    expect(rows).toHaveLength(1);
    expect(rows[0].consent).toBe('private');                 // scope preserved (no visibility downgrade)
    expect(rows[0].provenance).toBe(UNTRUSTED_PROVENANCE);   // forged lineage stripped to a content-free marker
  });

  it('a secret-bearing record still fails closed BEFORE the capability gate', async () => {
    const t = convexTest(schema, modules);
    const secret = buildMemoryRecord({ content: 'token sk-abcdef0123456789abcdef0123456789', createdAt: at(4), consent: 'shared' });
    const res = await t.action(api.ingest.ingest, { record: secret, capability: CAP });
    expect(res.ok).toBe(false);
    expect(res.refusal).toContain('secret');
    expect(await chainRows(t)).toHaveLength(0);
  });

  it('the pure gate is total + fail-closed on an unknown consent (→ shared/quarantined)', () => {
    expect(qualifyMemoryIngest({ consent: 'owner-only', capabilityValid: false })).toEqual({ decision: 'refuse', reasonClass: 'owner-only-ingest-requires-capability' });
    expect(qualifyMemoryIngest({ consent: 'owner-only', capabilityValid: true })).toEqual({ decision: 'accept-trusted' });
    expect(qualifyMemoryIngest({ consent: 'weird', capabilityValid: false })).toEqual({ decision: 'quarantine', consent: 'shared', provenance: UNTRUSTED_PROVENANCE });
  });
});
