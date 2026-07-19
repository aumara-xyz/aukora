// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R57A — canonical repository identity at the candidate stage (Sam 4 spatial lane).
 *
 * Proves, on REAL temp repositories:
 *   1. TWIN PARITY: the compiled-in constants of src/repoIdentity.ts equal repository-identity.json
 *      byte-for-byte, and the TS twin and the root-gate twin (scripts/repo-identity-core.mjs) return
 *      identical verdicts over the manifest's ENTIRE shared adversarial vector table;
 *   2. the stage refuses `candidate:wrong-repository` for wrong / donor / missing / ambiguous /
 *      rewritten / extra-remote origins and for a non-toplevel repoRoot — fail closed;
 *   3. PRE-AUTH + PRE-MUTATION ORDERING: an identity refusal happens BEFORE the reference monitor is
 *      consulted (nonce never consumed) and BEFORE any git mutation (refs, tree, config, worktree
 *      base all byte-identical after the refusal);
 *   4. identity precedes state: wrong origin + dirty tree refuses wrong-repository, canonical origin
 *      + dirty tree still refuses dirty-tree (the existing state law is intact behind the guard);
 *   5. disposal is gated by the same law and the honest path still materializes end-to-end.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  AumaIdeEnvelope, materializeCandidate, disposeCandidateWorktree,
  CandidateReferenceMonitor, candidatePayloadHash,
  ACCEPTED_ORIGIN_FORMS, CANONICAL_REPOSITORY_IDENTITY, FORBIDDEN_REPOSITORY_IDENTITIES,
  classifyOriginUrl, evaluateRemoteConfig, parseZConfig, repoIdentityGrantsAuthority,
  type Proposal, type RepoReadCapability, type MaterializeInput,
} from '../src/index.js';
import type { DurableEffectMonitor } from '../src/candidateReferenceMonitor.js';
import { makeWorld, authFor, NOW_ISO, NOW_MS, TARGET } from './support.js';

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const CANON = 'https://github.com/aumara-xyz/aukora.git';
const DONOR = 'https://github.com/aumara-xyz/aukora-symbiote.git';

const g = (cwd: string, args: string[]) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();

// The root-gate twin, loaded dynamically (a plain .mjs module outside the workspace).
const core: {
  classifyOriginUrl: (u: string, m: unknown) => { verdict: string };
  evaluateRemoteConfig: (z: string, m: unknown) => { ok: boolean; code?: string };
  loadManifest: (p: string) => { ok: boolean; manifest?: unknown };
} = await import(pathToFileURL(join(REPO_ROOT, 'scripts', 'repo-identity-core.mjs')).href);

const manifest = JSON.parse(readFileSync(join(REPO_ROOT, 'repository-identity.json'), 'utf8')) as {
  identity: { host: string; owner: string; repository: string };
  acceptedOriginForms: string[];
  forbidden: { owner: string; repository: string; reason: string }[];
  vectors: { accept: string[]; reject: { url: string; why: string }[] };
};

// ── temp-repo case factory ──────────────────────────────────────────────────
const bases: string[] = [];
afterAll(() => { for (const b of bases) rmSync(b, { recursive: true, force: true }); });

function mkRepo(origin: string | null): { repoRoot: string; wtBase: string } {
  const base = mkdtempSync(join(tmpdir(), 'aukora-r57-'));
  bases.push(base);
  const repoRoot = join(base, 'repo');
  mkdirSync(repoRoot, { recursive: true });
  execFileSync('git', ['init', '-q', '-b', 'main', repoRoot]);
  g(repoRoot, ['config', 'user.name', 'R57 Test']);
  g(repoRoot, ['config', 'user.email', 'r57@test.local']);
  if (origin !== null) g(repoRoot, ['remote', 'add', 'origin', origin]);
  mkdirSync(join(repoRoot, 'apps/seed/src'), { recursive: true });
  writeFileSync(join(repoRoot, 'apps/seed/src/recursion.ts'), '// original content\n');
  writeFileSync(join(repoRoot, 'apps/seed/src/proposal.ts'), '// original proposal\n');
  g(repoRoot, ['add', '-A']);
  g(repoRoot, ['commit', '-q', '--no-gpg-sign', '-m', 'init']);
  return { repoRoot, wtBase: join(base, 'candidates') };
}

const repoCap = (repoRoot: string): RepoReadCapability => ({
  list: () => [TARGET, 'apps/seed/src/proposal.ts'],
  read: (p) => readFileSync(join(repoRoot, p), 'utf8'),
  exists: (p) => existsSync(join(repoRoot, p)),
});

function stagedFor(repoRoot: string, tag: string) {
  const w = makeWorld();
  const ide = new AumaIdeEnvelope(repoCap(repoRoot));
  const d = ide.draft({ targetPath: TARGET, newContent: `// candidate ${tag}`, createdAt: NOW_ISO });
  if (!d.ok) throw new Error('draft failed');
  const proposal = d.proposal as Proposal;
  const auth = authFor(w.owner, proposal, { nonce: `stage-${tag}` });
  const staged = ide.stageBranchCandidate(w.env, [{ proposal, auth }], `r57 identity ${tag}`);
  if (!staged.ok) throw new Error('stage failed');
  return { w, candidate: staged.candidate };
}

/** A spy over the REAL monitor: proves whether decide() (the authorization consumption) ran. */
function spyMonitor(x: ReturnType<typeof stagedFor>): { monitor: DurableEffectMonitor; calls: () => number } {
  const real = new CandidateReferenceMonitor(x.w.owner.root);
  let n = 0;
  return {
    monitor: {
      decide: (c, a, t, o) => { n += 1; return real.decide(c, a, t, o); },
      consumed: () => real.consumed(),
    },
    calls: () => n,
  };
}

function matInput(repoRoot: string, wtBase: string, x: ReturnType<typeof stagedFor>, monitor: DurableEffectMonitor): MaterializeInput {
  const ph = candidatePayloadHash(x.candidate);
  return {
    repoRoot, worktreeBase: wtBase, candidate: x.candidate,
    candidateAuth: x.w.owner.authorize({ proposalHash: ph, draftHash: ph, nonce: `cand-${x.candidate.candidateId.slice(0, 8)}`, issuedAt: NOW_ISO, expiresAt: null }),
    monitor, ownerArmed: true, store: x.w.env.store, nowMs: NOW_MS, nowIso: NOW_ISO,
  };
}

/** Byte snapshot of everything a refusal must leave untouched. */
function snapshot(repoRoot: string, wtBase: string) {
  return {
    refs: g(repoRoot, ['for-each-ref']),
    head: g(repoRoot, ['rev-parse', 'HEAD']),
    porcelain: g(repoRoot, ['status', '--porcelain']),
    config: readFileSync(join(repoRoot, '.git', 'config'), 'utf8'),
    target: readFileSync(join(repoRoot, TARGET), 'utf8'),
    wtEntries: existsSync(wtBase) ? readdirSync(wtBase).sort().join(',') : '(absent)',
  };
}

/** One refusal case: run materialize, expect wrong-repository, prove nothing changed and no auth consumed. */
function expectIdentityRefusal(origin: string | null, detailFragment: string, mutateRepo?: (repoRoot: string) => void) {
  const { repoRoot, wtBase } = mkRepo(origin);
  if (mutateRepo) mutateRepo(repoRoot);
  const x = stagedFor(repoRoot, `case-${detailFragment}`);
  const spy = spyMonitor(x);
  const before = snapshot(repoRoot, wtBase);

  const out = materializeCandidate(matInput(repoRoot, wtBase, x, spy.monitor));

  expect(out.ok).toBe(false);
  expect(out.reasonClass).toBe('candidate:wrong-repository');
  expect(out.text).toContain(detailFragment);
  expect(out.branch).toBeNull();
  expect(out.commitSha).toBeNull();
  // PRE-AUTH: the reference monitor was never consulted — the nonce survives for the honest repo.
  expect(spy.calls()).toBe(0);
  expect(spy.monitor.consumed()).toHaveLength(0);
  // PRE-MUTATION: refs, HEAD, tree state, raw config, target bytes, and the worktree base are untouched.
  expect(snapshot(repoRoot, wtBase)).toEqual(before);
  // the refusal is receipted (content-free) with the typed reason; NO attempt receipt exists.
  expect(x.w.env.store.recall({ text: 'candidate-refused' }).some((r) => r.content.includes('candidate:wrong-repository'))).toBe(true);
  expect(x.w.env.store.recall({ text: 'candidate-materializing' })).toHaveLength(0);
  return { repoRoot, wtBase, x };
}

// ── 1. twin parity over the shared manifest vector table ────────────────────
describe('R57 · twin parity: src/repoIdentity.ts ≡ repository-identity.json ≡ scripts/repo-identity-core.mjs', () => {
  it('compiled-in constants equal the manifest byte-for-byte', () => {
    expect(CANONICAL_REPOSITORY_IDENTITY.host).toBe(manifest.identity.host);
    expect(CANONICAL_REPOSITORY_IDENTITY.owner).toBe(manifest.identity.owner);
    expect(CANONICAL_REPOSITORY_IDENTITY.repository).toBe(manifest.identity.repository);
    expect([...ACCEPTED_ORIGIN_FORMS]).toEqual(manifest.acceptedOriginForms);
    expect(FORBIDDEN_REPOSITORY_IDENTITIES.map((f) => `${f.owner}/${f.repository}`))
      .toEqual(manifest.forbidden.map((f) => `${f.owner}/${f.repository}`));
  });

  it('every ACCEPT vector is canonical in BOTH twins; every REJECT vector is non-canonical in BOTH', () => {
    expect(manifest.vectors.accept.length).toBeGreaterThanOrEqual(6);
    expect(manifest.vectors.reject.length).toBeGreaterThanOrEqual(40);
    for (const v of manifest.vectors.accept) {
      expect(classifyOriginUrl(v).verdict, `TS accept: ${v}`).toBe('canonical');
      expect(core.classifyOriginUrl(v, manifest).verdict, `mjs accept: ${v}`).toBe('canonical');
    }
    for (const v of manifest.vectors.reject) {
      expect(classifyOriginUrl(v.url).verdict, `TS reject (${v.why}): ${v.url}`).not.toBe('canonical');
      expect(core.classifyOriginUrl(v.url, manifest).verdict, `mjs reject (${v.why}): ${v.url}`).not.toBe('canonical');
    }
  });

  it('evaluateRemoteConfig verdict codes agree across the twins on every refusal class', () => {
    const z = (pairs: [string, string][]) => pairs.map(([k, v]) => `${k}\n${v}\0`).join('');
    const cases: [string, string][] = [
      ['', 'missing-origin'],
      [z([['remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*']]), 'missing-origin'],
      [z([['remote.origin.url', CANON], ['remote.upstream.url', CANON]]), 'extra-remote'],
      [z([['remote.origin.url', CANON], ['remote.origin.url', CANON]]), 'ambiguous-origin'],
      [z([['remote.origin.url', CANON], ['url.https://evil.com/.insteadof', 'https://github.com/']]), 'url-rewrite'],
      [z([['remote.origin.url', CANON], ['remote.origin.pushurl', 'https://github.com/evil-owner/aukora.git']]), 'pushurl-mismatch'],
      [z([['remote.origin.url', DONOR]]), 'donor-repository'],
      [z([['remote.origin.url', 'https://github.com/evil-owner/aukora.git']]), 'wrong-repository'],
      [z([['remote.origin.url', CANON], ['remote.pushdefault', 'upstream']]), 'malformed-remote-config'],
      [z([['remote.Origin.url', CANON]]), 'extra-remote'], // remote names are case-sensitive — 'Origin' is NOT origin
    ];
    for (const [raw, code] of cases) {
      const ts = evaluateRemoteConfig(raw);
      const js = core.evaluateRemoteConfig(raw, manifest);
      expect(ts.ok, `TS should refuse [${code}]`).toBe(false);
      expect(js.ok, `mjs should refuse [${code}]`).toBe(false);
      if (!ts.ok) expect(ts.code).toBe(code);
      expect((js as { code?: string }).code).toBe(code);
    }
    for (const okRaw of [
      z([['remote.origin.url', CANON]]),
      z([['remote.origin.url', CANON], ['remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*'], ['remote.pushdefault', 'origin']]),
      z([['remote.origin.url', CANON], ['remote.origin.pushurl', CANON]]),
    ]) {
      expect(evaluateRemoteConfig(okRaw).ok).toBe(true);
      expect(core.evaluateRemoteConfig(okRaw, manifest).ok).toBe(true);
    }
  });

  it('-z parsing is value-robust (spaces and newlines inside values cannot smuggle a key)', () => {
    const raw = `remote.origin.url\n${CANON}\nhttps://evil.example/second\0`;
    expect(parseZConfig(raw)).toHaveLength(1); // ONE entry whose value contains the newline
    const v = evaluateRemoteConfig(raw);
    expect(v.ok).toBe(false); // the composite value is not byte-canonical
    if (!v.ok) expect(v.code).toBe('wrong-repository');
  });

  it('identity verdicts grant nothing, constitutionally', () => {
    expect(repoIdentityGrantsAuthority()).toBe(false);
  });
});

// ── 2-4. candidate-stage behavior on real temp repositories ─────────────────
describe('R57 · the candidate stage refuses every non-canonical repository BEFORE auth and BEFORE mutation', () => {
  it('wrong origin refuses; monitor never consulted; repo byte-identical', () => {
    expectIdentityRefusal('https://github.com/evil-owner/aukora.git', 'wrong-repository');
  });

  it('donor origin (aukora-symbiote) refuses with the donor-specific detail', () => {
    expectIdentityRefusal(DONOR, 'donor-repository');
  });

  it('missing origin refuses — identity that cannot be established is a refusal, not a pass', () => {
    expectIdentityRefusal(null, 'missing-origin');
  });

  it('a lookalike origin refuses (host-suffix trick)', () => {
    expectIdentityRefusal('https://github.com.evil.com/aumara-xyz/aukora', 'wrong-repository');
  });

  it('an extra remote refuses even when origin itself is canonical', () => {
    expectIdentityRefusal(CANON, 'extra-remote', (repoRoot) => {
      g(repoRoot, ['remote', 'add', 'upstream', 'https://github.com/evil-owner/aukora.git']);
    });
  });

  it('an ambiguous multi-value origin refuses', () => {
    expectIdentityRefusal(CANON, 'ambiguous-origin', (repoRoot) => {
      g(repoRoot, ['config', '--add', 'remote.origin.url', 'https://github.com/evil-owner/aukora.git']);
    });
  });

  it('a repo-config insteadOf rewrite refuses even when origin reads canonical', () => {
    expectIdentityRefusal(CANON, 'url-rewrite', (repoRoot) => {
      g(repoRoot, ['config', 'url.https://evil.com/.insteadOf', 'https://github.com/']);
    });
  });

  it('a divergent pushurl refuses even when the fetch url is canonical', () => {
    expectIdentityRefusal(CANON, 'pushurl-mismatch', (repoRoot) => {
      g(repoRoot, ['config', 'remote.origin.pushurl', 'https://github.com/evil-owner/aukora.git']);
    });
  });

  it('DIRTY + WRONG origin: identity refuses first (state is never evaluated), tree untouched', () => {
    expectIdentityRefusal('https://github.com/evil-owner/aukora.git', 'wrong-repository', (repoRoot) => {
      writeFileSync(join(repoRoot, 'untracked.txt'), 'dirty\n');
    });
  });

  it('DIRTY + CANONICAL origin: identity passes and the existing dirty-tree law still refuses', () => {
    const { repoRoot, wtBase } = mkRepo(CANON);
    writeFileSync(join(repoRoot, 'untracked.txt'), 'dirty\n');
    const x = stagedFor(repoRoot, 'dirty-canonical');
    const spy = spyMonitor(x);
    const out = materializeCandidate(matInput(repoRoot, wtBase, x, spy.monitor));
    expect(out.ok).toBe(false);
    expect(out.reasonClass).toBe('candidate:dirty-tree');
    expect(spy.calls()).toBe(0); // dirty-tree also refuses before the monitor — ordering preserved
  });

  it('repoRoot pointing INSIDE the repo (not the toplevel) refuses — identity is of the root, not a subtree', () => {
    const { repoRoot, wtBase } = mkRepo(CANON);
    const x = stagedFor(repoRoot, 'subdir');
    const spy = spyMonitor(x);
    const out = materializeCandidate({ ...matInput(repoRoot, wtBase, x, spy.monitor), repoRoot: join(repoRoot, 'apps') });
    expect(out.ok).toBe(false);
    expect(out.reasonClass).toBe('candidate:wrong-repository');
    expect(out.text).toContain('toplevel');
    expect(spy.calls()).toBe(0);
  });

  it('HONEST canonical origin: the full ceremony still materializes end-to-end (monitor consulted exactly once)', () => {
    const { repoRoot, wtBase } = mkRepo(CANON);
    const x = stagedFor(repoRoot, 'honest');
    const spy = spyMonitor(x);
    const before = snapshot(repoRoot, wtBase);
    const out = materializeCandidate(matInput(repoRoot, wtBase, x, spy.monitor));
    expect(out.ok).toBe(true);
    expect(out.reasonClass).toBe('candidate:ok');
    expect(out.commitSha).toMatch(/^[0-9a-f]{40}$/);
    expect(spy.calls()).toBe(1);
    expect(spy.monitor.consumed()).toHaveLength(1);
    // primary checkout still untouched (the effect lives in the disposable worktree + candidate branch)
    expect(g(repoRoot, ['rev-parse', 'HEAD'])).toBe(before.head);
    expect(g(repoRoot, ['status', '--porcelain'])).toBe('');
    expect(readFileSync(join(repoRoot, TARGET), 'utf8')).toBe(before.target);

    // 5. disposal is gated by the same identity law
    const disposedOk = disposeCandidateWorktree(repoRoot, out.worktreePath as string, x.w.env.store, NOW_ISO);
    expect(disposedOk.ok).toBe(true);
  });

  it('disposal refuses on a non-canonical repository (same law, fail closed)', () => {
    const wrong = mkRepo('https://github.com/evil-owner/aukora.git');
    const disposed = disposeCandidateWorktree(wrong.repoRoot, join(wrong.wtBase, 'nope'), makeWorld().env.store, NOW_ISO);
    expect(disposed.ok).toBe(false);
    expect(disposed.text).toContain('not the canonical repository');
  });
});
