// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R57A — executable canonical-repository identity gate (Sam 4 spatial lane).
 *
 * Proves, on REAL temp repositories driven through the actual CLI (`scripts/verify-repo-identity.mjs`):
 *   honest canonical origin passes; wrong / donor / missing / ambiguous / rewritten / extra-remote
 *   origins, non-repos, and non-toplevel roots exit 1 with the expected typed code; EVERY refusal
 *   leaves the target repository byte-identical (refs, tree state, raw config); the manifest's shared
 *   adversarial vector table holds in the .mjs twin; the gate's own wiring self-check catches a
 *   package.json decoy (`echo npm run verify:repo-identity` does not count) and manifest tampering.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, readdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-expect-error — plain .mjs module
import { loadManifest, classifyOriginUrl, evaluateRemoteConfig, checkVectors, parseZConfig } from '../scripts/repo-identity-core.mjs';

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const CLI = join(REPO_ROOT, 'scripts', 'verify-repo-identity.mjs');
const MANIFEST_PATH = join(REPO_ROOT, 'repository-identity.json');
const CANON = 'https://github.com/aumara-xyz/aukora.git';
const DONOR = 'https://github.com/aumara-xyz/aukora-symbiote.git';

const g = (cwd: string, args: string[]) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();

const bases: string[] = [];
afterAll(() => { for (const b of bases) rmSync(b, { recursive: true, force: true }); });

function tmpBase(): string {
  const b = mkdtempSync(join(tmpdir(), 'aukora-repoid-'));
  bases.push(b);
  return b;
}

function mkRepo(origin: string | null): string {
  const repoRoot = join(tmpBase(), 'repo');
  mkdirSync(repoRoot, { recursive: true });
  execFileSync('git', ['init', '-q', '-b', 'main', repoRoot]);
  g(repoRoot, ['config', 'user.name', 'RepoId Test']);
  g(repoRoot, ['config', 'user.email', 'repoid@test.local']);
  if (origin !== null) g(repoRoot, ['remote', 'add', 'origin', origin]);
  mkdirSync(join(repoRoot, 'sub'), { recursive: true });
  writeFileSync(join(repoRoot, 'sub/file.txt'), 'content\n');
  g(repoRoot, ['add', '-A']);
  g(repoRoot, ['commit', '-q', '--no-gpg-sign', '-m', 'init']);
  return repoRoot;
}

/** Run the CLI; capture exit code + combined output (typed line goes to stderr on refusal). */
function runCli(args: string[], cliPath = CLI): { status: number; out: string } {
  try {
    const out = execFileSync(process.execPath, [cliPath, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { status: 0, out };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { status: err.status ?? -1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

/** Byte snapshot of everything a refusal must leave untouched. */
function snapshot(repoRoot: string) {
  return {
    refs: g(repoRoot, ['for-each-ref']),
    porcelain: g(repoRoot, ['status', '--porcelain']),
    config: readFileSync(join(repoRoot, '.git', 'config'), 'utf8'),
    entries: readdirSync(repoRoot).sort().join(','),
  };
}

function expectRefusal(repoRoot: string, code: string) {
  const before = snapshot(repoRoot);
  const r = runCli(['--root', repoRoot]);
  expect(r.status, r.out).toBe(1);
  expect(r.out).toContain(`REFUSED code=${code}`);
  expect(snapshot(repoRoot), `refusal [${code}] must leave the target unchanged`).toEqual(before);
}

// ── the .mjs twin against the manifest's shared truth table ─────────────────
describe('repo-identity core: manifest + vector table', () => {
  const loaded = loadManifest(MANIFEST_PATH);

  it('the manifest validates and its truth table self-check passes', () => {
    expect(loaded.ok).toBe(true);
    expect(checkVectors(loaded.manifest).ok).toBe(true);
  });

  it('acceptance is byte-identity ONLY: each accepted form passes, every reject vector refuses', () => {
    for (const v of loaded.manifest.acceptedOriginForms) {
      expect(classifyOriginUrl(v, loaded.manifest).verdict).toBe('canonical');
    }
    for (const v of loaded.manifest.vectors.reject) {
      expect(classifyOriginUrl(v.url, loaded.manifest).verdict, `${v.why}: ${v.url}`).not.toBe('canonical');
    }
  });

  it('the donor repository classifies with the donor-specific verdict in both url shapes', () => {
    expect(classifyOriginUrl(DONOR, loaded.manifest).verdict).toBe('donor-repository');
    expect(classifyOriginUrl('git@github.com:aumara-xyz/aukora-symbiote.git', loaded.manifest).verdict).toBe('donor-repository');
  });

  it('-z config parsing is exact: NUL-terminated key/value entries, newline-in-value safe', () => {
    const entries = parseZConfig(`remote.origin.url\n${CANON}\0remote.origin.fetch\n+refs/heads/*:refs/remotes/origin/*\0`);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({ key: 'remote.origin.url', value: CANON });
    const verdict = evaluateRemoteConfig(`remote.origin.url\n${CANON}\0`, loaded.manifest);
    expect(verdict.ok).toBe(true);
  });
});

// ── the CLI on real temp repositories ───────────────────────────────────────
describe('verify-repo-identity CLI: typed outcomes on real repositories, refusals leave no trace', () => {
  it('honest canonical origin → OK, exit 0', () => {
    const repo = mkRepo(CANON);
    const r = runCli(['--root', repo]);
    expect(r.status, r.out).toBe(0);
    expect(r.out).toContain('repo-identity: OK');
    expect(r.out).toContain(CANON);
  });

  it('the REAL repository root passes the gate end-to-end (wiring check included)', () => {
    const r = runCli([]);
    expect(r.status, r.out).toBe(0);
    expect(r.out).toContain('repo-identity: OK');
  });

  it('wrong origin → wrong-repository', () => { expectRefusal(mkRepo('https://github.com/evil-owner/aukora.git'), 'wrong-repository'); });
  it('donor origin → donor-repository', () => { expectRefusal(mkRepo(DONOR), 'donor-repository'); });
  it('missing origin → missing-origin', () => { expectRefusal(mkRepo(null), 'missing-origin'); });
  it('lookalike host-suffix origin → wrong-repository', () => { expectRefusal(mkRepo('https://github.com.evil.com/aumara-xyz/aukora'), 'wrong-repository'); });
  it('suffix-trick origin → wrong-repository', () => { expectRefusal(mkRepo('https://github.com/aumara-xyz/aukora.git.git'), 'wrong-repository'); });

  it('extra remote → extra-remote', () => {
    const repo = mkRepo(CANON);
    g(repo, ['remote', 'add', 'upstream', 'https://github.com/evil-owner/aukora.git']);
    expectRefusal(repo, 'extra-remote');
  });

  it('multi-value origin → ambiguous-origin', () => {
    const repo = mkRepo(CANON);
    g(repo, ['config', '--add', 'remote.origin.url', 'https://github.com/evil-owner/aukora.git']);
    expectRefusal(repo, 'ambiguous-origin');
  });

  it('repo-config insteadOf rewrite → url-rewrite (a byte-canonical origin cannot mask it)', () => {
    const repo = mkRepo(CANON);
    g(repo, ['config', 'url.https://evil.com/.insteadOf', 'https://github.com/']);
    expectRefusal(repo, 'url-rewrite');
  });

  it('divergent pushurl → pushurl-mismatch', () => {
    const repo = mkRepo(CANON);
    g(repo, ['config', 'remote.origin.pushurl', 'https://github.com/evil-owner/aukora.git']);
    expectRefusal(repo, 'pushurl-mismatch');
  });

  it('not a repository → not-a-repository (fail closed)', () => {
    const dir = join(tmpBase(), 'plain');
    mkdirSync(dir, { recursive: true });
    const r = runCli(['--root', dir]);
    expect(r.status).toBe(1);
    expect(r.out).toContain('REFUSED code=not-a-repository');
    expect(readdirSync(dir)).toHaveLength(0); // nothing was created in the target
  });

  it('a SUBDIRECTORY of an honest repo → root-mismatch (identity is of the root, not a subtree)', () => {
    const repo = mkRepo(CANON);
    const before = snapshot(repo);
    const r = runCli(['--root', join(repo, 'sub')]);
    expect(r.status).toBe(1);
    expect(r.out).toContain('REFUSED code=root-mismatch');
    expect(snapshot(repo)).toEqual(before);
  });

  it('dirty state does not bypass identity: wrong origin + dirty tree still refuses wrong-repository, dirt intact', () => {
    const repo = mkRepo('https://github.com/evil-owner/aukora.git');
    writeFileSync(join(repo, 'untracked.txt'), 'dirty\n');
    expectRefusal(repo, 'wrong-repository');
    expect(readFileSync(join(repo, 'untracked.txt'), 'utf8')).toBe('dirty\n'); // refusal touched nothing
  });

  it('dirty state on an HONEST repo still passes identity (this gate reads; state law lives elsewhere)', () => {
    const repo = mkRepo(CANON);
    writeFileSync(join(repo, 'untracked.txt'), 'dirty\n');
    const r = runCli(['--root', repo]);
    expect(r.status, r.out).toBe(0);
    expect(readFileSync(join(repo, 'untracked.txt'), 'utf8')).toBe('dirty\n');
  });
});

// ── the gate's own self-checks: wiring + manifest tamper ────────────────────
describe('verify-repo-identity CLI: self-checks fail closed', () => {
  /** Copy the gate (CLI + core + manifest) into an isolated tree so its SELF checks can be tampered. */
  function mkGateTree(mutate: (root: string) => void): string {
    const root = join(tmpBase(), 'gate');
    mkdirSync(join(root, 'scripts'), { recursive: true });
    copyFileSync(CLI, join(root, 'scripts', 'verify-repo-identity.mjs'));
    copyFileSync(join(REPO_ROOT, 'scripts', 'repo-identity-core.mjs'), join(root, 'scripts', 'repo-identity-core.mjs'));
    copyFileSync(MANIFEST_PATH, join(root, 'repository-identity.json'));
    writeFileSync(join(root, 'package.json'), JSON.stringify({
      name: 'gate-tree', private: true,
      scripts: {
        'verify:repo-identity': 'node scripts/verify-repo-identity.mjs',
        'test:all': 'npm run verify:repo-identity && npm run test',
      },
    }, null, 2));
    execFileSync('git', ['init', '-q', '-b', 'main', root]);
    g(root, ['config', 'user.name', 'Gate']);
    g(root, ['config', 'user.email', 'gate@test.local']);
    g(root, ['remote', 'add', 'origin', CANON]);
    mutate(root);
    return root;
  }

  it('a faithful copy of the gate tree passes its own wiring check (and really ran)', () => {
    const root = mkGateTree(() => { /* untampered */ });
    const r = runCli([], join(root, 'scripts', 'verify-repo-identity.mjs'));
    expect(r.status, r.out).toBe(0);
    expect(r.out).toContain('repo-identity: OK'); // a silent exit-0 (main never ran) must not pass
  });

  it('an `echo` decoy segment in test:all → gate-unwired (exact-segment law)', () => {
    const root = mkGateTree((rt) => {
      const pkg = JSON.parse(readFileSync(join(rt, 'package.json'), 'utf8'));
      pkg.scripts['test:all'] = 'echo npm run verify:repo-identity && npm run test';
      writeFileSync(join(rt, 'package.json'), JSON.stringify(pkg, null, 2));
    });
    const r = runCli([], join(root, 'scripts', 'verify-repo-identity.mjs'));
    expect(r.status).toBe(1);
    expect(r.out).toContain('REFUSED code=gate-unwired');
  });

  it('a missing verify:repo-identity script entry → gate-unwired', () => {
    const root = mkGateTree((rt) => {
      const pkg = JSON.parse(readFileSync(join(rt, 'package.json'), 'utf8'));
      delete pkg.scripts['verify:repo-identity'];
      writeFileSync(join(rt, 'package.json'), JSON.stringify(pkg, null, 2));
    });
    const r = runCli([], join(root, 'scripts', 'verify-repo-identity.mjs'));
    expect(r.status).toBe(1);
    expect(r.out).toContain('REFUSED code=gate-unwired');
  });

  it('a tampered manifest (broken schema) → manifest-invalid, refusing to certify anything', () => {
    const root = mkGateTree((rt) => {
      const m = JSON.parse(readFileSync(join(rt, 'repository-identity.json'), 'utf8'));
      m.schema = 'evil/v1';
      writeFileSync(join(rt, 'repository-identity.json'), JSON.stringify(m, null, 2));
    });
    const r = runCli([], join(root, 'scripts', 'verify-repo-identity.mjs'));
    expect(r.status).toBe(1);
    expect(r.out).toContain('REFUSED code=manifest-invalid');
  });

  it('an accept-form injection that fails the truth table → vector-drift, refusing to certify anything', () => {
    const root = mkGateTree((rt) => {
      const m = JSON.parse(readFileSync(join(rt, 'repository-identity.json'), 'utf8'));
      // the injected form names the canonical owner/repo (passes manifest validation) but is NOT in
      // the accept vectors; the reject table still contains it as a vector → drift is caught.
      m.vectors.reject.push({ url: 'https://github.com/aumara-xyz/aukora', why: 'injected-contradiction' });
      writeFileSync(join(rt, 'repository-identity.json'), JSON.stringify(m, null, 2));
    });
    const r = runCli([], join(root, 'scripts', 'verify-repo-identity.mjs'));
    expect(r.status).toBe(1);
    expect(r.out).toContain('REFUSED code=vector-drift');
  });

  it('an empty --root argument refuses instead of silently checking the wrong tree', () => {
    const r = runCli(['--root']);
    expect(r.status).toBe(1);
    expect(r.out).toContain('REFUSED');
  });
});
