// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R60 M1 — record→root binding for governed erase (convex-test, SIMULATED).
 *
 * The accepted finding: a REGISTERED root A could erase a record belonging to root B, because durable rows
 * did not pin an owner root. Repair: memory rows pin an immutable ownerRootId at ingest; forget requires
 * attestation.ownerRootId === the record's pinned root BEFORE nonce-consume / plaintext deletion; legacy /
 * unbound rows fail closed (never guessed). Vectors: multi-root isolation, wrong-root, unbound, replay,
 * rotation, malformed binding, and no-plaintext-deletion on a refused cross-root erase.
 */
import { convexTest } from 'convex-test';
import { describe, it, expect, beforeAll } from 'vitest';
import schema from '../convex/schema';
import { api } from '../convex/_generated/api';
import { buildMemoryRecord } from '@aukora/memory';
import { signEraseAttestation, mlDsa65PublicKeyFromSeed } from '../src/index.js';

const modules = import.meta.glob('../convex/**/*.*s');
const at = (s: number) => `2026-07-19T00:00:${String(s).padStart(2, '0')}.000Z`;

const SEED_A = 'a'.repeat(64); // root A owner seed (test only)
const SEED_B = 'b'.repeat(64); // root B owner seed (test only)
let PUB_A = '';
let PUB_B = '';
beforeAll(async () => { PUB_A = await mlDsa65PublicKeyFromSeed(SEED_A); PUB_B = await mlDsa65PublicKeyFromSeed(SEED_B); });

async function registerRoot(t: ReturnType<typeof convexTest>, ownerRootId: string, publicKeyHex: string) {
  await t.run(async (ctx) => {
    await ctx.db.insert('eraseRoots', { ownerRootId, publicKeyHex, advisoryOnly: true as const, grantsAuthority: false as const });
  });
}
const eraseBy = (seed: string, ownerRootId: string, recordId: string) =>
  signEraseAttestation(seed, { ownerRootId, key: recordId, eraseReason: 'test erase', timestamp: Date.now() });

async function ingest(t: ReturnType<typeof convexTest>, content: string, ownerRootId?: string) {
  const rec = buildMemoryRecord({ content, createdAt: at(1) });
  const res = (await t.action(api.ingest.ingest, { record: rec, ownerRootId })) as { ok: boolean };
  return { rec, res };
}

describe('R60 M1 — record→root binding', () => {
  it('the bound owner root CAN erase its own record (positive path)', async () => {
    const t = convexTest(schema, modules);
    await registerRoot(t, 'root-A', PUB_A);
    const { rec } = await ingest(t, 'A owns this memory', 'root-A');
    const done = await t.mutation(api.memory.forget, { recordId: rec.recordId, at: at(2), attestation: await eraseBy(SEED_A, 'root-A', rec.recordId) });
    expect(done.ok).toBe(true);
    expect((await t.query(api.memory.recall, { text: 'A owns' })).length).toBe(0);
  });

  it('MULTI-ROOT ISOLATION: registered root B cannot erase root A’s record; plaintext survives', async () => {
    const t = convexTest(schema, modules);
    await registerRoot(t, 'root-A', PUB_A);
    await registerRoot(t, 'root-B', PUB_B);
    const { rec } = await ingest(t, 'A private diary', 'root-A');
    // B is a fully registered root with a valid, self-consistent, correctly-scoped attestation for A's record.
    const attack = await t.mutation(api.memory.forget, { recordId: rec.recordId, at: at(2), attestation: await eraseBy(SEED_B, 'root-B', rec.recordId) });
    expect(attack.ok).toBe(false);
    expect((attack as { refusal: string }).refusal).toContain('record→root mismatch');
    // no-plaintext-deletion: the memory is still fully recallable — nothing was removed on the refused erase.
    expect((await t.query(api.memory.recall, { text: 'diary' })).length).toBe(1);
    const audit = await t.run(async (ctx) => {
      const rows = await ctx.db.query('memoryChain').withIndex('by_record', (q: any) => q.eq('recordId', rec.recordId)).collect();
      return { hasContent: rows.some((r: any) => r.kind === 'memory' && r.content !== undefined), tombstones: rows.filter((r: any) => r.kind === 'tombstone').length };
    });
    expect(audit.hasContent).toBe(true);   // plaintext intact
    expect(audit.tombstones).toBe(0);       // no tombstone appended for a refused erase
  });

  it('UNBOUND legacy row fails closed — no root may erase a record with no pinned owner', async () => {
    const t = convexTest(schema, modules);
    await registerRoot(t, 'root-A', PUB_A);
    const { rec } = await ingest(t, 'legacy unbound memory'); // no ownerRootId at ingest
    const refuse = await t.mutation(api.memory.forget, { recordId: rec.recordId, at: at(2), attestation: await eraseBy(SEED_A, 'root-A', rec.recordId) });
    expect(refuse.ok).toBe(false);
    expect((refuse as { refusal: string }).refusal).toContain('unbound');
    expect((await t.query(api.memory.recall, { text: 'legacy' })).length).toBe(1); // still present
  });

  it('WRONG-ROOT self-claim: an attestation naming the record’s root but signed by a different registered key is refused at the registry pin', async () => {
    const t = convexTest(schema, modules);
    // root-A is registered with A's public key; the attacker signs with B's seed but claims ownerRootId 'root-A'.
    await registerRoot(t, 'root-A', PUB_A);
    const { rec } = await ingest(t, 'A owned', 'root-A');
    const forged = await t.mutation(api.memory.forget, { recordId: rec.recordId, at: at(2), attestation: await eraseBy(SEED_B, 'root-A', rec.recordId) });
    expect(forged.ok).toBe(false); // key_not_pinned: B's key is not the pin for root-A (G1 layer holds under M1)
    expect((await t.query(api.memory.recall, { text: 'A owned' })).length).toBe(1);
  });

  it('ROTATION/REVOCATION: after root A’s pin is revoked, its old attestation no longer erases', async () => {
    const t = convexTest(schema, modules);
    await registerRoot(t, 'root-A', PUB_A);
    const { rec } = await ingest(t, 'rotate me', 'root-A');
    const attestation = await eraseBy(SEED_A, 'root-A', rec.recordId);
    // revoke the pin (remove the eraseRoots row) — e.g. key rotation with no replacement pinned yet
    await t.run(async (ctx) => {
      const row = await ctx.db.query('eraseRoots').first();
      if (row) await ctx.db.delete(row._id);
    });
    const afterRevoke = await t.mutation(api.memory.forget, { recordId: rec.recordId, at: at(2), attestation });
    expect(afterRevoke.ok).toBe(false); // unregistered_root now (fail-closed on empty/rotated registry)
    expect((await t.query(api.memory.recall, { text: 'rotate' })).length).toBe(1);
  });

  it('MALFORMED binding is refused at ingest rather than producing an un-erasable row', async () => {
    const t = convexTest(schema, modules);
    const bad = (await t.action(api.ingest.ingest, { record: buildMemoryRecord({ content: 'x', createdAt: at(1) }), ownerRootId: '' })) as { ok: boolean; refusal?: string };
    expect(bad.ok).toBe(false);
    expect(bad.refusal).toContain('malformed ownerRootId');
  });

  it('REPLAY still fails after a legitimate bound erase (nonce consumed once)', async () => {
    const t = convexTest(schema, modules);
    await registerRoot(t, 'root-A', PUB_A);
    const { rec } = await ingest(t, 'erase once', 'root-A');
    const attestation = await eraseBy(SEED_A, 'root-A', rec.recordId);
    expect((await t.mutation(api.memory.forget, { recordId: rec.recordId, at: at(2), attestation })).ok).toBe(true);
    const replay = await t.mutation(api.memory.forget, { recordId: rec.recordId, at: at(3), attestation });
    expect(replay.ok).toBe(false); // already consumed / already forgotten
  });
});
