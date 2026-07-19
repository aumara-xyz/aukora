// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R59 G1 — erase-authority pin. Reproduces the pre-fix hole (a caller-supplied ML-DSA key authorizing a
 * destructive `forget`) and proves the registered-root pin closes it: forged/new-key, unregistered-root,
 * key-not-pinned, replay, wrong-record, and stale-head erasures all FAIL BEFORE any plaintext is deleted.
 * Convex is SIMULATED (convex-test); tests seed the `eraseRoots` allowlist directly (owner-provisioning path).
 */
import { convexTest } from 'convex-test';
import { describe, it, expect, beforeAll } from 'vitest';
import schema from '../convex/schema';
import { api } from '../convex/_generated/api';
import { buildMemoryRecord } from '@aukora/memory';
import {
  signEraseAttestation, verifyEraseAttestation, buildEraseRootRegistry, eraseRootsFromRows,
  mlDsa65PublicKeyFromSeed, type RegisteredEraseRoots,
} from '../src/index.js';

const modules = import.meta.glob('../convex/**/*.*s');
const OWNER_SEED = 'a'.repeat(64);       // the legitimate owner
const ATTACKER_SEED = '9'.repeat(64);    // a stranger who mints their own keypair
const at = (s: number) => `2026-07-16T00:00:${String(s).padStart(2, '0')}.000Z`;

let OWNER_PUB = '';
let ATTACKER_PUB = '';
let REGISTRY: RegisteredEraseRoots;
beforeAll(async () => {
  OWNER_PUB = await mlDsa65PublicKeyFromSeed(OWNER_SEED);
  ATTACKER_PUB = await mlDsa65PublicKeyFromSeed(ATTACKER_SEED);
  REGISTRY = buildEraseRootRegistry([['owner-root', OWNER_PUB]]);
});

const ownerErase = (recordId: string, over: Record<string, unknown> = {}) =>
  signEraseAttestation(OWNER_SEED, { ownerRootId: 'owner-root', key: recordId, eraseReason: 'owner asks', timestamp: Date.now(), ...over });
const attackerErase = (recordId: string, over: Record<string, unknown> = {}) =>
  signEraseAttestation(ATTACKER_SEED, { ownerRootId: 'owner-root', key: recordId, eraseReason: 'let me in', timestamp: Date.now(), ...over });

describe('R59 G1 — verifier pin (unit)', () => {
  it('REPRODUCTION: a self-consistent attacker attestation (own key) is refused, not honored', async () => {
    const now = Date.now();
    const forged = await attackerErase('d'.repeat(64), { timestamp: now });
    // The signature is internally valid against the attacker's OWN carried key…
    const noRegistry = await verifyEraseAttestation(forged, now, buildEraseRootRegistry([]));
    expect(noRegistry).toEqual({ ok: false, reason: 'unregistered_root' }); // empty registry = fail closed
    // …and even with the root registered, the carried key is not the pinned owner key.
    const pinned = await verifyEraseAttestation(forged, now, REGISTRY);
    expect(pinned).toEqual({ ok: false, reason: 'key_not_pinned' });
  });

  it('the legitimate owner attestation still verifies against the pin', async () => {
    const now = Date.now();
    const good = await ownerErase('d'.repeat(64), { timestamp: now });
    const r = await verifyEraseAttestation(good, now, REGISTRY);
    expect(r.ok).toBe(true);
  });

  it('an unregistered ownerRootId is refused even with a valid owner signature', async () => {
    const now = Date.now();
    const good = await signEraseAttestation(OWNER_SEED, { ownerRootId: 'some-other-root', key: 'd'.repeat(64), eraseReason: 'x', timestamp: now });
    expect(await verifyEraseAttestation(good, now, REGISTRY)).toEqual({ ok: false, reason: 'unregistered_root' });
  });

  it('the pin is checked before the signature: a bad-signature + unpinned key still refuses on the pin', async () => {
    const now = Date.now();
    const forged = await attackerErase('d'.repeat(64), { timestamp: now });
    const tampered = { ...forged, signatureHex: '0'.repeat(forged.signatureHex.length) };
    expect(await verifyEraseAttestation(tampered, now, REGISTRY)).toEqual({ ok: false, reason: 'key_not_pinned' });
  });

  it('registry construction is fail-closed on malformed pins', () => {
    expect(() => buildEraseRootRegistry([['', OWNER_PUB]])).toThrow(/erase_root_id_bounds/);
    expect(() => buildEraseRootRegistry([['r', 'nothex']])).toThrow(/erase_root_pubkey_shape/);
    expect(() => buildEraseRootRegistry([['r', OWNER_PUB], ['r', OWNER_PUB]])).toThrow(/erase_root_duplicate/);
    // eraseRootsFromRows skips malformed rows rather than throwing (one bad row cannot brick the gate)
    const reg = eraseRootsFromRows([{ ownerRootId: 'r', publicKeyHex: OWNER_PUB }, { ownerRootId: '', publicKeyHex: 'x' }, { ownerRootId: 'r', publicKeyHex: ATTACKER_PUB }]);
    expect(reg.get('r')).toBe(OWNER_PUB); // first pin wins; a second pin for the same root cannot widen it
    expect(reg.size).toBe(1);
  });
});

describe('R59 G1 — Convex forget honors the pin, and refusals delete NO plaintext', () => {
  async function seedRoot(t: ReturnType<typeof convexTest>, ownerRootId: string, publicKeyHex: string) {
    await t.run(async (ctx) => {
      await ctx.db.insert('eraseRoots', { ownerRootId, publicKeyHex, advisoryOnly: true as const, grantsAuthority: false as const });
    });
  }
  async function seedOne(t: ReturnType<typeof convexTest>, content: string) {
    const rec = buildMemoryRecord({ content, createdAt: at(1) });
    await t.action(api.ingest.ingest, { record: rec });
    return rec;
  }
  const stillPresent = async (t: ReturnType<typeof convexTest>, needle: string) => {
    const dump = await t.run(async (ctx) => JSON.stringify(await ctx.db.query('memoryChain').collect()));
    return dump.includes(needle);
  };

  it('with NO registered root, the owner attestation itself is refused (fail-closed) and plaintext survives', async () => {
    const t = convexTest(schema, modules);
    const rec = await seedOne(t, 'secret-alpha remains');
    const r = await t.mutation(api.memory.forget, { recordId: rec.recordId, at: at(2), attestation: await ownerErase(rec.recordId) });
    expect(r.ok).toBe(false);
    expect(r.refusal).toContain('unregistered_root');
    expect(await stillPresent(t, 'secret-alpha')).toBe(true); // NOT deleted
  });

  it('a forged attacker key cannot erase a registered-root record; plaintext survives', async () => {
    const t = convexTest(schema, modules);
    await seedRoot(t, 'owner-root', OWNER_PUB);
    const rec = await seedOne(t, 'secret-bravo remains');
    const r = await t.mutation(api.memory.forget, { recordId: rec.recordId, at: at(2), attestation: await attackerErase(rec.recordId) });
    expect(r.ok).toBe(false);
    expect(r.refusal).toContain('key_not_pinned');
    expect(await stillPresent(t, 'secret-bravo')).toBe(true);
  });

  it('replay: a consumed owner attestation cannot erase twice (nonce), leaving no second deletion', async () => {
    const t = convexTest(schema, modules);
    await seedRoot(t, 'owner-root', OWNER_PUB);
    const a = await seedOne(t, 'secret-delta');
    const b = await seedOne(t, 'secret-delta-two');
    const attestation = await ownerErase(a.recordId);
    expect((await t.mutation(api.memory.forget, { recordId: a.recordId, at: at(2), attestation })).ok).toBe(true);
    const replay = await t.mutation(api.memory.forget, { recordId: a.recordId, at: at(3), attestation });
    expect(replay.ok).toBe(false);
    expect(replay.refusal).toMatch(/replay|already/);
    expect(await stillPresent(t, 'secret-delta-two')).toBe(true); // the other record untouched
  });

  it('wrong-record: an owner attestation scoped to record X cannot erase record Y', async () => {
    const t = convexTest(schema, modules);
    await seedRoot(t, 'owner-root', OWNER_PUB);
    const x = await seedOne(t, 'secret-echo-X');
    const y = await seedOne(t, 'secret-echo-Y');
    const forX = await ownerErase(x.recordId);
    const r = await t.mutation(api.memory.forget, { recordId: y.recordId, at: at(2), attestation: forX });
    expect(r.ok).toBe(false);
    expect(r.refusal).toContain('scope mismatch');
    expect(await stillPresent(t, 'secret-echo-Y')).toBe(true);
  });

  it('stale/expired: an owner attestation older than the freshness window is refused; plaintext survives', async () => {
    const t = convexTest(schema, modules);
    await seedRoot(t, 'owner-root', OWNER_PUB);
    const rec = await seedOne(t, 'secret-foxtrot');
    const stale = await ownerErase(rec.recordId, { timestamp: Date.now() - 120_000 }); // > 60s window
    const r = await t.mutation(api.memory.forget, { recordId: rec.recordId, at: at(2), attestation: stale });
    expect(r.ok).toBe(false);
    expect(r.refusal).toContain('expired');
    expect(await stillPresent(t, 'secret-foxtrot')).toBe(true);
  });
});
