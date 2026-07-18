// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R55 — owner boot boundary + planned provider secret shapes.
 *
 * THE THREAT: the production door composition used to boot on `new HybridOwnerAdapter('local-door-dev')` — a
 * keypair DERIVED FROM A PUBLIC STRING. Anyone with the repo re-derives the same signing key and mints "owner"
 * authorizations the door accepts. Proven here:
 *   - the DEFAULT (no injection, no flag) boot resolution REFUSES — production can never silently boot a fixture;
 *   - the fixture exists ONLY behind the explicit `AUKORA_OWNER_FIXTURE=1` literal;
 *   - an injected root is shape-validated, expiry/revocation-checked, and a KNOWN fixture-derived public root is
 *     refused as an injected trust anchor;
 *   - every refusal is CONTENT-FREE (no file bytes, no key material in the resolution);
 *   - END-TO-END: an attacker who re-derives the public fixture key CANNOT authorize against a real injected
 *     root — the kernel monitor refuses the forged authorization outright.
 * Plus R55 secret shapes: planned Tinker/HuggingFace token prefixes are refused BY SHAPE, reported by PATH only.
 */
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import {
  resolveOwnerBootAuthority, ownerBoundaryGrantsAuthority,
  HybridOwnerAdapter, CandidateReferenceMonitor, candidatePayloadHash,
  deriveDraftHash, deriveIntentId,
  scanForbiddenValues,
  type BranchCandidate,
} from '../src/index.js';

const NOW_ISO = '2026-07-18T12:00:00.000Z';
const NOW_MS = Date.parse(NOW_ISO);
const realOwner = new HybridOwnerAdapter('r55-real-owner-boundary');
const realRootJson = JSON.stringify(realOwner.root);
const fileOf = (content: string) => (path: string) => { if (path !== '/injected/root.json') throw new Error('ENOENT'); return content; };
const NO_FILE = (_: string): string => { throw new Error('ENOENT'); };

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
    const r = resolveOwnerBootAuthority({ AUKORA_OWNER_ROOT_FILE: '/injected/root.json', AUKORA_OWNER_FIXTURE: '1' }, fileOf(realRootJson), NOW_MS);
    expect(r).toEqual({ mode: 'refused', reasonClass: 'owner:boundary-ambiguous' });
  });

  it('a VALID injected PUBLIC root resolves to injected with the exact root', () => {
    const r = resolveOwnerBootAuthority({ AUKORA_OWNER_ROOT_FILE: '/injected/root.json' }, fileOf(realRootJson), NOW_MS);
    expect(r.mode).toBe('injected');
    if (r.mode === 'injected') expect(r.root.rootId).toBe(realOwner.root.rootId);
  });

  it('unreadable / malformed / mis-shaped root files each refuse with a CONTENT-FREE reason (no file bytes leak)', () => {
    const secretMarker = 'SNEAKY-SECRET-BYTES-9f8e7d';
    const cases: Array<[string, (p: string) => string]> = [
      ['owner:root-unreadable', NO_FILE],
      ['owner:root-invalid', fileOf(`{not json ${secretMarker}`)],
      ['owner:root-invalid', fileOf(JSON.stringify({ schema: 'wrong', note: secretMarker }))],
      ['owner:root-invalid', fileOf(JSON.stringify({ ...realOwner.root, publicKeys: { ed25519: 'zz', mlDsa65: 'zz' }, note: secretMarker }))],
    ];
    for (const [reason, readFile] of cases) {
      const r = resolveOwnerBootAuthority({ AUKORA_OWNER_ROOT_FILE: '/injected/root.json' }, readFile, NOW_MS);
      expect(r.mode).toBe('refused');
      if (r.mode === 'refused') expect(r.reasonClass).toBe(reason);
      expect(JSON.stringify(r)).not.toContain(secretMarker); // the refusal carries a class, never the bytes
    }
  });

  it('a REVOKED or EXPIRED injected root refuses (owner:root-revoked / owner:root-expired)', () => {
    const revoked = JSON.stringify({ ...realOwner.root, revoked: true });
    expect(resolveOwnerBootAuthority({ AUKORA_OWNER_ROOT_FILE: '/injected/root.json' }, fileOf(revoked), NOW_MS))
      .toEqual({ mode: 'refused', reasonClass: 'owner:root-revoked' });
    const expired = JSON.stringify({ ...realOwner.root, expiresAt: '2026-07-18T11:00:00.000Z' }); // before NOW
    expect(resolveOwnerBootAuthority({ AUKORA_OWNER_ROOT_FILE: '/injected/root.json' }, fileOf(expired), NOW_MS))
      .toEqual({ mode: 'refused', reasonClass: 'owner:root-expired' });
  });

  it('the KNOWN publicly-derivable fixture roots are refused AS an injected root (owner:root-fixture-derived)', () => {
    for (const label of ['local-door-dev', 'demo']) {
      const fixturePublicRoot = JSON.stringify(new HybridOwnerAdapter(label).root);
      const r = resolveOwnerBootAuthority({ AUKORA_OWNER_ROOT_FILE: '/injected/root.json' }, fileOf(fixturePublicRoot), NOW_MS);
      expect(r, `label=${label}`).toEqual({ mode: 'refused', reasonClass: 'owner:root-fixture-derived' });
    }
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
    // the door's monitor is rooted at the REAL injected root — the derivable fixture signature verifies NOTHING
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
