// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * HARDEN GIT (#22 overnight) — the candidate-stage Git cell must run the EXACT trusted binary in a minimal,
 * hostile-config-proof environment. These are adversarial tests: a fake `git` planted first on PATH, a malicious
 * repo `.git/hooks/pre-commit`, and a hostile global git config (`GIT_CONFIG_GLOBAL` + `HOME/.gitconfig`) each
 * carry a SENTINEL side effect that must NEVER fire, while a legitimate candidate still materializes correctly and
 * leaves the primary tree untouched. Sentinel commands from hostile Git configuration must never execute.
 *
 * Real disposable git repo (like r43). The candidate stage is driven through the real `materializeCandidate`.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  AumaIdeEnvelope, materializeCandidate, candidatePayloadHash,
  CandidateReferenceMonitor,
  type Proposal, type RepoReadCapability, type MaterializeInput, type BranchCandidate,
} from '../src/index.js';
import { makeWorld, authFor, NOW_ISO, NOW_MS, TARGET } from './support.js';

// The TEST's own git helper must itself be immune to the hostile PATH/config the tests plant — pin an absolute
// binary and a clean env, or the harness's own setup/cleanup calls would fire the sentinel (a test-only artifact,
// not a hardening failure). This is separate from the candidate stage's internal hardening under test.
const TEST_GIT = existsSync('/usr/bin/git') ? '/usr/bin/git' : '/opt/homebrew/bin/git';
const g = (cwd: string, args: string[]): string => execFileSync(TEST_GIT, ['-C', cwd, ...args], {
  encoding: 'utf8',
  env: { PATH: '/usr/bin:/bin', HOME: base, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0' },
}).trim();

let base: string; let repoRoot: string; let wtBase: string; let sentinelDir: string;
const SENTINEL = (): string => join(sentinelDir, 'PWNED');
const savedEnv: Record<string, string | undefined> = {};

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), 'aukora-r53-'));
  repoRoot = join(base, 'repo');
  wtBase = join(base, 'candidates');
  sentinelDir = join(base, 'sentinels');
  mkdirSync(join(repoRoot, 'apps/seed/src'), { recursive: true });
  mkdirSync(sentinelDir, { recursive: true });
  execFileSync('git', ['init', '-q', '-b', 'main', repoRoot]);
  g(repoRoot, ['config', 'user.name', 'R53 Test']);
  g(repoRoot, ['config', 'user.email', 'r53@test.local']);
  writeFileSync(join(repoRoot, 'apps/seed/src/recursion.ts'), '// original content\n');
  g(repoRoot, ['add', '-A']);
  g(repoRoot, ['commit', '-q', '--no-gpg-sign', '-m', 'init']);
});
afterAll(() => rmSync(base, { recursive: true, force: true }));
afterEach(() => {
  for (const k of Object.keys(savedEnv)) { if (savedEnv[k] === undefined) delete process.env[k]; else process.env[k] = savedEnv[k]; }
  for (const k of Object.keys(savedEnv)) delete savedEnv[k];
  try { rmSync(SENTINEL(), { force: true }); } catch { /* fine */ }
});
const setEnv = (k: string, v: string | undefined): void => { savedEnv[k] = process.env[k]; if (v === undefined) delete process.env[k]; else process.env[k] = v; };

/** An executable shell script at `path` that touches the SENTINEL, then (for a fake git) exits 0 doing nothing. */
function writeExecutable(path: string, body: string): void {
  writeFileSync(path, `#!/bin/sh\ntouch "${SENTINEL()}"\n${body}\n`);
  chmodSync(path, 0o755);
}

const repoCap = (): RepoReadCapability => ({
  list: () => [TARGET],
  read: (p) => readFileSync(join(repoRoot, p), 'utf8'),
  exists: (p) => existsSync(join(repoRoot, p)),
});

function stagedCandidate(tag: string): { w: ReturnType<typeof makeWorld>; candidate: BranchCandidate } {
  const w = makeWorld();
  const ide = new AumaIdeEnvelope(repoCap());
  const d = ide.draft({ targetPath: TARGET, newContent: `// candidate ${tag}\n`, createdAt: NOW_ISO });
  if (!d.ok) throw new Error('draft failed');
  const proposal = d.proposal as Proposal;
  const auth = authFor(w.owner, proposal, { nonce: `stage-${tag}` });
  const staged = ide.stageBranchCandidate(w.env, [{ proposal, auth }], `governed refinement ${tag}`);
  if (!staged.ok) throw new Error('stage failed');
  return { w, candidate: staged.candidate as BranchCandidate };
}

function matInput(x: { w: ReturnType<typeof makeWorld>; candidate: BranchCandidate }): MaterializeInput {
  const ph = candidatePayloadHash(x.candidate);
  return {
    repoRoot, worktreeBase: wtBase, candidate: x.candidate,
    candidateAuth: x.w.owner.authorize({ proposalHash: ph, draftHash: ph, nonce: `cand-${x.candidate.candidateId.slice(0, 8)}`, issuedAt: NOW_ISO, expiresAt: null }),
    monitor: new CandidateReferenceMonitor(x.w.owner.root),
    ownerArmed: true, store: x.w.env.store, nowMs: NOW_MS, nowIso: NOW_ISO,
  };
}

/** Materialize a fresh candidate and clean up its worktree/branch; returns the outcome. */
function materializeOnce(tag: string) {
  const x = stagedCandidate(tag);
  const out = materializeCandidate(matInput(x));
  if (out.ok && out.worktreePath) {
    try { g(repoRoot, ['worktree', 'remove', '--force', out.worktreePath]); } catch { /* fine */ }
    try { g(repoRoot, ['branch', '-D', out.branch as string]); } catch { /* fine */ }
  }
  return out;
}

describe('HARDEN GIT · fake `git` on PATH is never invoked', () => {
  it('a fake git first on PATH does not run; the real candidate still materializes; sentinel never fires', () => {
    const fakeDir = join(base, 'fakebin');
    mkdirSync(fakeDir, { recursive: true });
    writeExecutable(join(fakeDir, 'git'), 'exit 0'); // a fake git that no-ops would break materialize IF used
    setEnv('PATH', `${fakeDir}:${process.env.PATH ?? ''}`);
    const out = materializeOnce('fakepath');
    expect(existsSync(SENTINEL())).toBe(false);   // the fake git was never executed
    expect(out.ok).toBe(true);                    // the real trusted git did the work
    expect(String(out.branch)).toMatch(/^candidate\//);
  });
});

describe('HARDEN GIT · repo hooks are disabled (core.hooksPath=/dev/null)', () => {
  it('a malicious .git/hooks/pre-commit does NOT execute on the candidate commit', () => {
    const hooksDir = join(repoRoot, '.git', 'hooks');
    mkdirSync(hooksDir, { recursive: true });
    writeExecutable(join(hooksDir, 'pre-commit'), 'exit 0');
    try {
      const out = materializeOnce('hooks');
      expect(existsSync(SENTINEL())).toBe(false);  // the pre-commit hook never ran
      expect(out.ok).toBe(true);
    } finally {
      rmSync(join(hooksDir, 'pre-commit'), { force: true });
    }
  });
});

describe('HARDEN GIT · hostile global/system config is neutralized', () => {
  it('a malicious GIT_CONFIG_GLOBAL pointing core.hooksPath at a sentinel hook is ignored', () => {
    const evilHooks = join(base, 'evil-hooks');
    mkdirSync(evilHooks, { recursive: true });
    writeExecutable(join(evilHooks, 'pre-commit'), 'exit 0');
    const evilConfig = join(base, 'evil.gitconfig');
    writeFileSync(evilConfig, `[core]\n\thooksPath = ${evilHooks}\n`);
    setEnv('GIT_CONFIG_GLOBAL', evilConfig);
    const out = materializeOnce('evilglobal');
    expect(existsSync(SENTINEL())).toBe(false);   // disabled by GIT_CONFIG_GLOBAL=/dev/null + -c core.hooksPath=/dev/null
    expect(out.ok).toBe(true);
  });

  it('a hostile HOME/.gitconfig (core.hooksPath sentinel) is ignored because HOME is reset + global config disabled', () => {
    const evilHome = join(base, 'evil-home');
    const evilHooks = join(evilHome, 'hooks');
    mkdirSync(evilHooks, { recursive: true });
    writeExecutable(join(evilHooks, 'pre-commit'), 'exit 0');
    writeFileSync(join(evilHome, '.gitconfig'), `[core]\n\thooksPath = ${evilHooks}\n`);
    setEnv('HOME', evilHome);
    setEnv('XDG_CONFIG_HOME', evilHome);
    const out = materializeOnce('evilhome');
    expect(existsSync(SENTINEL())).toBe(false);
    expect(out.ok).toBe(true);
  });
});

describe('HARDEN GIT · all hostilities at once, primary tree untouched', () => {
  it('fake PATH git + repo hook + hostile global config together: sentinel never fires, main byte-identical', () => {
    const headBefore = g(repoRoot, ['rev-parse', 'HEAD']);
    const fakeDir = join(base, 'fakebin2'); mkdirSync(fakeDir, { recursive: true });
    writeExecutable(join(fakeDir, 'git'), 'exit 0');
    const hooksDir = join(repoRoot, '.git', 'hooks'); mkdirSync(hooksDir, { recursive: true });
    writeExecutable(join(hooksDir, 'pre-commit'), 'exit 0');
    const evilConfig = join(base, 'evil2.gitconfig');
    writeFileSync(evilConfig, `[core]\n\thooksPath = ${hooksDir}\n[alias]\n\tstatus = !${SENTINEL()}\n`);
    setEnv('PATH', `${fakeDir}:${process.env.PATH ?? ''}`);
    setEnv('GIT_CONFIG_GLOBAL', evilConfig);
    try {
      const out = materializeOnce('allhostile');
      expect(existsSync(SENTINEL())).toBe(false);                 // nothing hostile executed
      expect(out.ok).toBe(true);                                  // legitimate work still succeeded
      expect(g(repoRoot, ['rev-parse', 'HEAD'])).toBe(headBefore); // main HEAD unchanged
      expect(g(repoRoot, ['status', '--porcelain'])).toBe('');    // primary tree clean
    } finally {
      rmSync(join(hooksDir, 'pre-commit'), { force: true });
    }
  });
});
