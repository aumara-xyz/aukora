// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R55 (hardened R55.1) — owner boot boundary + planned provider secret shapes.
 *
 * THE THREAT: the production door composition used to boot on `new HybridOwnerAdapter('local-door-dev')` — a
 * keypair DERIVED FROM A PUBLIC STRING. Anyone with the repo re-derives the same signing key and mints "owner"
 * authorizations the door accepts. Proven here:
 *   - the DEFAULT (no injection, no flag) boot resolution REFUSES — production can never silently boot a fixture;
 *   - the fixture exists ONLY behind the explicit `AUKORA_OWNER_FIXTURE=1` literal;
 *   - CLASSIFICATION: only an operator-PROVISIONED envelope resolves. A bare authority root — what the fixture
 *     adapter emits for ANY label, not a finite denylist — refuses `owner:root-unprovisioned`; kernel-form
 *     identity/integrity and expiry/revocation are checked (a MALFORMED non-null expiresAt fails closed); the
 *     two repo-committed dev labels are refused even if deliberately provisioned (tripwire);
 *   - every refusal is CONTENT-FREE (no file bytes, no key material in the resolution);
 *   - END-TO-END: an attacker who re-derives the public fixture key CANNOT authorize against a real injected
 *     root — the kernel monitor refuses the forged authorization outright.
 *
 * The "real owner" in these tests is modeled with a RUNTIME-RANDOM label (never committed anywhere), so no test
 * asserts that a committed-label-derivable key is a valid production anchor. What code cannot prove — and these
 * tests do not claim — is non-derivability of a deliberately provisioned key: key custody stays with the owner.
 *
 * Plus R55 secret shapes: planned Tinker/HuggingFace token prefixes are refused BY SHAPE, reported by PATH only.
 */
import { describe, it, expect } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import {
  resolveOwnerBootAuthority, provisionOwnerRoot, ownerBoundaryGrantsAuthority,
  HybridOwnerAdapter, CandidateReferenceMonitor, candidatePayloadHash,
  deriveDraftHash, deriveIntentId,
  scanForbiddenValues,
  type BranchCandidate,
} from '../src/index.js';

const NOW_ISO = '2026-07-18T12:00:00.000Z';
const NOW_MS = Date.parse(NOW_ISO);
// The "real owner": a RUNTIME-RANDOM label — never committed, so nothing in the repo can re-derive this key.
// (Custody in a real deployment is the owner's offline keypair; the random label stands in for that here.)
const realOwner = new HybridOwnerAdapter(`r55-${randomUUID()}`);
const realEnvelope = provisionOwnerRoot(realOwner.root, NOW_ISO);
const realEnvelopeJson = JSON.stringify(realEnvelope);
const fileOf = (content: string) => (path: string) => { if (path !== '/injected/root.json') throw new Error('ENOENT'); return content; };
const NO_FILE = (_: string): string => { throw new Error('ENOENT'); };
const INJ = { AUKORA_OWNER_ROOT_FILE: '/injected/root.json' };

describe('R55 · owner boot boundary — the production default REFUSES; fixture only behind the explicit flag', () => {
  it('DEFAULT PRODUCTION BOOT (no env at all) → refused owner:root-missing — never a silent fixture', () => {
    const r = resolveOwnerBootAuthority({}, NO_FILE, NOW_MS);
    expect(r).toEqual({ mode: 'refused', reasonClass: 'owner:root-missing' });
  });

  it('only the LITERAL "1" selects the fixture; truthy look-alikes still refuse', () => {
    expect(resolveOwnerBootAuthority({ AUKORA_OWNER_FIXTURE: '1' }, NO_FILE, NOW_MS)).toEqual({ mode: 'fixture' });
    for (const v of ['true', 'yes', '2', 'on', ' 1', '1 ']) {
      expect(resolveOwnerBootAuthority({ AUKORA_OWNER_FIXTURE: v }, NO_FILE, NOW_MS).mode, `flag=${JSON.stringify(v)}`).toBe('refused');
    }
  });

  it('AMBIGUOUS (root file AND fixture flag) → refused owner:boundary-ambiguous — one env var cannot downgrade the boot', () => {
    const r = resolveOwnerBootAuthority({ ...INJ, AUKORA_OWNER_FIXTURE: '1' }, fileOf(realEnvelopeJson), NOW_MS);
    expect(r).toEqual({ mode: 'refused', reasonClass: 'owner:boundary-ambiguous' });
  });

  it('a VALID PROVISIONED envelope resolves to injected with the exact inner root', () => {
    const r = resolveOwnerBootAuthority(INJ, fileOf(realEnvelopeJson), NOW_MS);
    expect(r.mode).toBe('injected');
    if (r.mode === 'injected') expect(r.root.rootId).toBe(realOwner.root.rootId);
  });

  it('CLASSIFICATION: a BARE authority root — what the fixture adapter emits, for ANY label — refuses owner:root-unprovisioned', () => {
    // not a finite denylist: a committed dev label, an arbitrary label, and even the runtime-random "real" label
    // are ALL refused when injected bare — nothing an adapter emits is ever a trust anchor by itself.
    for (const bare of [new HybridOwnerAdapter('local-door-dev').root, new HybridOwnerAdapter('any-arbitrary-label').root, realOwner.root]) {
      const r = resolveOwnerBootAuthority(INJ, fileOf(JSON.stringify(bare)), NOW_MS);
      expect(r).toEqual({ mode: 'refused', reasonClass: 'owner:root-unprovisioned' });
    }
  });

  it('TRIPWIRE: the repo-committed dev labels are refused even if DELIBERATELY provisioned (owner:root-fixture-derived)', () => {
    for (const label of ['local-door-dev', 'demo']) {
      const envelope = provisionOwnerRoot(new HybridOwnerAdapter(label).root, NOW_ISO);
      const r = resolveOwnerBootAuthority(INJ, fileOf(JSON.stringify(envelope)), NOW_MS);
      expect(r, `label=${label}`).toEqual({ mode: 'refused', reasonClass: 'owner:root-fixture-derived' });
    }
  });

  it('a TAMPERED envelope refuses: edited public keys → unprovisioned (stamp mismatch) or invalid (kernel forms)', () => {
    // flip a nibble in the ed25519 public key AFTER provisioning: kernel rootId/integrity forms break → invalid
    const k = realOwner.root.publicKeys.ed25519;
    const tamperedRoot = { ...realOwner.root, publicKeys: { ...realOwner.root.publicKeys, ed25519: (k[0] === 'a' ? 'b' : 'a') + k.slice(1) } };
    const tamperedKeys = { ...realEnvelope, root: tamperedRoot };
    expect(resolveOwnerBootAuthority(INJ, fileOf(JSON.stringify(tamperedKeys)), NOW_MS))
      .toEqual({ mode: 'refused', reasonClass: 'owner:root-invalid' });
    // forge the provisionedAt AFTER stamping: kernel forms hold, but the provisioning stamp no longer recomputes
    const tamperedStamp = { ...realEnvelope, provisionedAt: '2026-07-18T13:00:00.000Z' };
    expect(resolveOwnerBootAuthority(INJ, fileOf(JSON.stringify(tamperedStamp)), NOW_MS))
      .toEqual({ mode: 'refused', reasonClass: 'owner:root-unprovisioned' });
  });

  it('unreadable / malformed / mis-shaped files each refuse with a CONTENT-FREE reason (no file bytes leak)', () => {
    const secretMarker = 'SNEAKY-SECRET-BYTES-9f8e7d';
    const cases: Array<[string, (p: string) => string]> = [
      ['owner:root-unreadable', NO_FILE],
      ['owner:root-invalid', fileOf(`{not json ${secretMarker}`)],
      ['owner:root-invalid', fileOf(JSON.stringify({ schema: 'wrong', note: secretMarker }))],
      ['owner:root-invalid', fileOf(JSON.stringify({ ...realEnvelope, root: { ...realOwner.root, publicKeys: { ed25519: 'zz', mlDsa65: 'zz' } }, note: secretMarker }))],
    ];
    for (const [reason, readFile] of cases) {
      const r = resolveOwnerBootAuthority(INJ, readFile, NOW_MS);
      expect(r.mode).toBe('refused');
      if (r.mode === 'refused') expect(r.reasonClass).toBe(reason);
      expect(JSON.stringify(r)).not.toContain(secretMarker); // the refusal carries a class, never the bytes
    }
  });

  it('REVOKED, EXPIRED, and — fail-closed — MALFORMED expiresAt each refuse with their exact class', () => {
    const revoked = new HybridOwnerAdapter(`r55-${randomUUID()}`, { revoked: true });
    expect(resolveOwnerBootAuthority(INJ, fileOf(JSON.stringify(provisionOwnerRoot(revoked.root, NOW_ISO))), NOW_MS))
      .toEqual({ mode: 'refused', reasonClass: 'owner:root-revoked' });
    const expired = new HybridOwnerAdapter(`r55-${randomUUID()}`, { expiresAt: '2026-07-18T11:00:00.000Z' }); // before NOW
    expect(resolveOwnerBootAuthority(INJ, fileOf(JSON.stringify(provisionOwnerRoot(expired.root, NOW_ISO))), NOW_MS))
      .toEqual({ mode: 'refused', reasonClass: 'owner:root-expired' });
    // MALFORMED non-null expiresAt: Date.parse → NaN must FAIL CLOSED as invalid, never pass as "not expired"
    const malformed = new HybridOwnerAdapter(`r55-${randomUUID()}`, { expiresAt: 'not-a-timestamp' });
    expect(resolveOwnerBootAuthority(INJ, fileOf(JSON.stringify(provisionOwnerRoot(malformed.root, NOW_ISO))), NOW_MS))
      .toEqual({ mode: 'refused', reasonClass: 'owner:root-invalid' });
  });

  it('END-TO-END THREAT: an attacker re-deriving the public fixture key CANNOT authorize against a real injected root', () => {
    // the attacker's cheap move: rebuild the fixture from its public label and sign an "owner" authorization
    const attacker = new HybridOwnerAdapter('local-door-dev');
    const path = 'apps/seed/src/notes.ts';
    const prop = { id: 'x', targetPath: path, newContent: '// attacker payload\n', createdAt: NOW_ISO, supersedes: null };
    const candidate = {
      schema: 'aukora-branch-candidate-v1', candidateId: createHash('sha256').update('r55-threat').digest('hex'),
      workspace: new Map([[path, prop.newContent]]),
      files: [{ path, intentId: deriveIntentId(prop), draftHash: deriveDraftHash(prop), diff: '', receiptHash: 'ab'.repeat(32) }],
      explanation: 'r55 threat', lineage: [{ intentId: deriveIntentId(prop), depth: 0 }],
      staged: true, pushed: false, signed: false, merged: false, deployed: false, grantsAuthority: false,
    } as unknown as BranchCandidate;
    const head = 'a1'.repeat(20);
    const ph = candidatePayloadHash(candidate, head);
    const forged = attacker.authorize({ proposalHash: ph, draftHash: ph, nonce: 'r55-threat', issuedAt: NOW_ISO, expiresAt: null });
    // the door's monitor is rooted at the REAL injected root (random label, non-committed) — the derivable
    // fixture signature verifies NOTHING against it
    const verdict = new CandidateReferenceMonitor(realOwner.root).decide(candidate, forged, NOW_MS, { ownerArmed: true, headBefore: head });
    expect(verdict.allowed).toBe(false);
    // and the same signature DOES verify against its own fixture root — proving the key really is derivable,
    // i.e. the old boot composition (fixture root as trust anchor) was genuinely ownable by anyone.
    const devVerdict = new CandidateReferenceMonitor(attacker.root).decide(candidate, forged, NOW_MS, { ownerArmed: true, headBefore: head });
    expect(devVerdict.allowed).toBe(true);
  });

  it('HARD: resolving the boundary grants no authority', () => {
    expect(ownerBoundaryGrantsAuthority()).toBe(false);
  });
});

describe('R55 · planned provider secret shapes — refused by SHAPE, reported by PATH only', () => {
  it('HuggingFace and Tinker token shapes are flagged; the report carries paths, never the matched bytes', () => {
    const tokens = {
      hf: 'hf_ABCDefghIJKLmnopQRSTuvwx12345678',
      tinkerSk: 'sk-tinker-Abc123_def-456xyz',
      tinkerRaw: 'tinker_ABCdef123456789012',
      tml: 'tml_ZYXwvu987654321098',
    };
    const flagged = scanForbiddenValues({ note: `deploy with ${tokens.hf}`, deep: { a: [tokens.tinkerSk], b: tokens.tinkerRaw, c: tokens.tml } });
    expect(flagged.sort()).toEqual(['deep.a[0]', 'deep.b', 'deep.c', 'note']);
    // content-free: the scanner output is the PATH list — assert no token bytes ride along
    const out = JSON.stringify(flagged);
    for (const t of Object.values(tokens)) expect(out).not.toContain(t.slice(3));
  });

  it('benign near-misses stay clean (no over-refusal)', () => {
    expect(scanForbiddenValues({
      a: 'hf_short',                       // too short to be a token
      b: 'the shelf_label is fine',        // hf_ must be word-anchored
      c: 'tinker with the settings',       // prose, no underscore-token shape
      d: 'html_encode helper',             // tml_ must be word-anchored
      e: 'skip sk-live note',              // sk- needs 12+ token chars
    })).toEqual([]);
  });
});
