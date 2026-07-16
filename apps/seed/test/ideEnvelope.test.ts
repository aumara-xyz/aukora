// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Auma's IDE envelope R0–R3 + the repo path fence: confined read over the whole repo (never past the secret/authority
 * fences), integrity-checked recall, draft+rehearse, and a staged branch candidate that never pushes/signs/merges.
 */
import { describe, it, expect } from 'vitest';
import { ReactiveMemoryStore } from '@aukora/brain';
import { buildMemoryRecord } from '@aukora/memory';
import {
  AumaIdeEnvelope, ideEnvelopeGrantsAuthority,
  classifyPath, readAllowed, candidateAllowed,
  deriveIntentId, deriveDraftHash, type Proposal, type RepoReadCapability, type OwnerAuthorization,
} from '../src/index.js';
import { makeWorld, authFor, NOW_ISO } from './support.js';
import type { HybridOwnerAdapter } from '../src/index.js';

function fakeRepo(files: Record<string, string>): RepoReadCapability {
  return {
    list: (dir) => Object.keys(files).filter((p) => dir === '' || dir === '.' || p === dir || p.startsWith(dir.endsWith('/') ? dir : `${dir}/`)),
    read: (p) => { const c = files[p]; if (c === undefined) throw new Error(`no such file: ${p}`); return c; },
    exists: (p) => Object.prototype.hasOwnProperty.call(files, p),
  };
}

const REPO = {
  'apps/seed/src/recursion.ts': 'export function runGovernedRecursion() {}\n// needle here\n',
  'apps/seed/src/proposal.ts': 'export function deriveIntentId() {}\n',
  'LICENSE': 'AGPL-3.0-or-later\n',
  'packages/kernel/src/authority.ts': 'export function verifyAumlokPromotionV2() {}\n',
  'apps/brain/src/reactiveStore.ts': 'export class ReactiveMemoryStore {}\n',
  '.env': 'API_KEY=sk-do-not-read-this-secret-000000\n',
  'secrets/owner.pem': '-----BEGIN PRIVATE KEY-----\n',
};

describe('repo path fence', () => {
  it('classifies allowed / authority / sacred / secret / invalid', () => {
    expect(classifyPath('apps/seed/src/recursion.ts').class).toBe('allowed');
    expect(classifyPath('packages/kernel/src/authority.ts').class).toBe('authority');
    expect(classifyPath('LICENSE').class).toBe('sacred');
    expect(classifyPath('apps/brain/src/reactiveStore.ts').class).toBe('sacred');
    expect(classifyPath('.env').class).toBe('secret');
    expect(classifyPath('secrets/owner.pem').class).toBe('secret');
    expect(classifyPath('/etc/passwd').class).toBe('invalid');
    expect(classifyPath('../../escape').class).toBe('invalid');
  });

  it('readable = everything but secret/invalid; candidate-able = allowed only', () => {
    expect(readAllowed(classifyPath('LICENSE'))).toBe(true);            // sacred is readable
    expect(readAllowed(classifyPath('packages/kernel/src/authority.ts'))).toBe(true); // authority is readable
    expect(readAllowed(classifyPath('.env'))).toBe(false);             // secret never read
    expect(candidateAllowed(classifyPath('apps/seed/src/recursion.ts'))).toBe(true);
    expect(candidateAllowed(classifyPath('LICENSE'))).toBe(false);
    expect(candidateAllowed(classifyPath('packages/kernel/src/authority.ts'))).toBe(false);
    expect(candidateAllowed(classifyPath('.env'))).toBe(false);
  });
});

describe('R0 — confined list / read / search', () => {
  const ide = new AumaIdeEnvelope(fakeRepo(REPO));

  it('reads allowed + sacred + authority source, refuses secret with a visible reason', () => {
    expect(ide.read('apps/seed/src/recursion.ts').ok).toBe(true);
    expect(ide.read('LICENSE').ok).toBe(true);
    expect(ide.read('packages/kernel/src/authority.ts').ok).toBe(true); // may reason over authority source
    const secret = ide.read('.env');
    expect(secret.ok).toBe(false);
    if (!secret.ok) expect(secret.refusal.reasonClass).toBe('fence:secret-path');
    const bad = ide.read('../../escape');
    expect(bad.ok).toBe(false);
  });

  it('list drops secret entries and reports them as refusals', () => {
    const { entries, refusals } = ide.list('');
    expect(entries).toContain('apps/seed/src/recursion.ts');
    expect(entries).not.toContain('.env');
    expect(entries).not.toContain('secrets/owner.pem');
    expect(refusals.some((r) => r.reasonClass === 'fence:secret-path')).toBe(true);
  });

  it('search returns cited hits and never reads secret files', () => {
    const { citations } = ide.search('apps/seed/src', 'needle');
    expect(citations.length).toBe(1);
    expect(citations[0].path).toBe('apps/seed/src/recursion.ts');
    expect(citations[0].line).toBe(2);
    // searching the whole repo never surfaces the secret content
    const all = ide.search('', 'sk-do-not-read');
    expect(all.citations.length).toBe(0);
  });
});

describe('R1 — integrity-checked recall with citations', () => {
  it('recall is content-addressed + cited and gated on chain integrity', () => {
    const store = new ReactiveMemoryStore();
    store.ingest(buildMemoryRecord({ content: 'auma remembers the covenant', createdAt: NOW_ISO }));
    const ide = new AumaIdeEnvelope(fakeRepo(REPO));
    const res = ide.recall(store, { text: 'covenant' });
    expect(res.integrityValid).toBe(true);
    expect(res.hits.length).toBe(1);
    expect(res.hits[0].contentHash).toBe(res.hits[0].recordId); // content-addressed citation
  });
});

describe('R2 / R3 — draft, rehearse, and stage a branch candidate', () => {
  const knownFiles = ['apps/seed/src/recursion.ts', 'apps/seed/src/proposal.ts'];

  it('draft refuses sacred/authority/secret targets, accepts an allowed target', () => {
    const ide = new AumaIdeEnvelope(fakeRepo(REPO));
    expect(ide.draft({ targetPath: 'LICENSE', newContent: '// x', createdAt: NOW_ISO }).ok).toBe(false);
    expect(ide.draft({ targetPath: 'packages/kernel/src/authority.ts', newContent: '// x', createdAt: NOW_ISO }).ok).toBe(false);
    expect(ide.draft({ targetPath: '.env', newContent: '// x', createdAt: NOW_ISO }).ok).toBe(false);
    expect(ide.draft({ targetPath: 'apps/seed/src/recursion.ts', newContent: '// refinement', createdAt: NOW_ISO }).ok).toBe(true);
  });

  it('rehearsal reaches the sandbox only with an owner signature (verbatim refusal otherwise)', () => {
    const { env, owner } = makeWorld({ knownFiles });
    const ide = new AumaIdeEnvelope(fakeRepo(REPO));
    const d = ide.draft({ targetPath: 'apps/seed/src/recursion.ts', newContent: '// refinement', createdAt: NOW_ISO });
    expect(d.ok).toBe(true);
    const proposal = d.proposal as Proposal;
    expect(ide.rehearse(env, proposal /* no auth */).stage).toBe('refused-owner-gate');
    const accepted = ide.rehearse(env, proposal, authFor(owner, proposal, { nonce: 'reh-1' }));
    expect(accepted.stage).toBe('sandbox-applied');
  });

  it('stages a candidate ONLY after passed rehearsals; never pushes/signs/merges/deploys', () => {
    const { env, owner } = makeWorld({ knownFiles });
    const ide = new AumaIdeEnvelope(fakeRepo(REPO));
    const p1 = (ide.draft({ targetPath: 'apps/seed/src/recursion.ts', newContent: '// a', createdAt: NOW_ISO }).proposal) as Proposal;
    const p2 = (ide.draft({ targetPath: 'apps/seed/src/proposal.ts', newContent: '// b', createdAt: NOW_ISO }).proposal) as Proposal;
    const staged = ide.stageBranchCandidate(env, [
      { proposal: p1, auth: authFor(owner, p1, { nonce: 'stg-1' }) },
      { proposal: p2, auth: authFor(owner, p2, { nonce: 'stg-2' }) },
    ], 'refine two notes');
    expect(staged.ok).toBe(true);
    if (!staged.ok) return;
    const c = staged.candidate;
    expect(c.pushed).toBe(false);
    expect(c.signed).toBe(false);
    expect(c.merged).toBe(false);
    expect(c.deployed).toBe(false);
    expect(c.grantsAuthority).toBe(false);
    expect(c.workspace.size).toBe(2);
    expect(c.files.every((f) => f.receiptHash !== null && f.diff.includes('---'))).toBe(true);
    expect(c.lineage.length).toBe(2);
  });

  it('a candidate cannot escape the fence even with a hand-built proposal (sacred/authority target refused)', () => {
    const { env, owner } = makeWorld({ knownFiles: ['apps/brain/src/reactiveStore.ts'] });
    const ide = new AumaIdeEnvelope(fakeRepo(REPO));
    const sacred: Proposal = { id: 'p', targetPath: 'apps/brain/src/reactiveStore.ts', newContent: '// escape', createdAt: NOW_ISO, supersedes: null };
    const staged = ide.stageBranchCandidate(env, [{ proposal: sacred, auth: authFor(owner, sacred, { nonce: 'esc-1' }) }], 'escape attempt');
    expect(staged.ok).toBe(false);
    if (!staged.ok) expect(staged.refusal.reasonClass).toBe('fence:sacred-path');
  });

  it('a draft that fails rehearsal is never staged (receipt-before-effect / not-rehearsed)', () => {
    const { env } = makeWorld({ knownFiles });
    const ide = new AumaIdeEnvelope(fakeRepo(REPO));
    const p = (ide.draft({ targetPath: 'apps/seed/src/recursion.ts', newContent: '// c', createdAt: NOW_ISO }).proposal) as Proposal;
    const staged = ide.stageBranchCandidate(env, [{ proposal: p /* no auth ⇒ rehearsal fails */ }], 'unsigned');
    expect(staged.ok).toBe(false);
    if (!staged.ok) expect(staged.refusal.reasonClass).toBe('ide:not-rehearsed');
  });

  it('capability widening is structurally impossible — no tool-widening method exists', () => {
    const ide = new AumaIdeEnvelope(fakeRepo(REPO)) as unknown as Record<string, unknown>;
    for (const forbidden of ['widen', 'addCapability', 'grantCapability', 'expandCapabilities', 'sign', 'push', 'merge', 'deploy']) {
      expect(typeof ide[forbidden]).toBe('undefined');
    }
    expect(ideEnvelopeGrantsAuthority()).toBe(false);
  });
});

// keep the unused type import meaningful for readers
export type { HybridOwnerAdapter, OwnerAuthorization };
