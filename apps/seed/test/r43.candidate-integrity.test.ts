// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * WAVE 3 — candidate-write integrity (donor #99/#75/#4 law at the worktree write). Adversarial: a pre-existing
 * in-repo symlink checked out into the fresh worktree (leaf AND nested-directory), an out-of-worktree-root /
 * identity-changing target, and case-fold duplicate variants must ALL refuse with a content-free reason-classed
 * receipt, leave NO partial candidate (worktree removed + candidate branch deleted), and keep the primary tree +
 * the out-of-tree secret byte-identical. The happy path commits EXACTLY the candidate file list.
 *
 * Uses a real disposable git repo (like r36). The symlinks are COMMITTED into HEAD, so `git worktree add`
 * materializes them into the candidate worktree exactly as the donor threat describes — the no-follow walk must
 * catch them at write time.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, symlinkSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  AumaIdeEnvelope, materializeCandidate, candidateBranchName,
  CandidateReferenceMonitor, candidatePayloadHash, deriveDraftHash,
  type Proposal, type RepoReadCapability, type MaterializeInput, type BranchCandidate,
} from '../src/index.js';
import { makeWorld, authFor, NOW_ISO, NOW_MS, TARGET } from './support.js';

const g = (cwd: string, args: string[]) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();
const tryG = (cwd: string, args: string[]): string | null => { try { return g(cwd, args); } catch { return null; } };

let base: string; let repoRoot: string; let wtBase: string; let outsideDir: string;
beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), 'aukora-r43-'));
  repoRoot = join(base, 'repo');
  wtBase = join(base, 'candidates');
  outsideDir = join(base, 'outside'); // a secret dir OUTSIDE the worktree that a symlink would try to reach
  mkdirSync(repoRoot, { recursive: true });
  mkdirSync(outsideDir, { recursive: true });
  writeFileSync(join(outsideDir, 'secret.txt'), 'DO NOT TOUCH\n');
  execFileSync('git', ['init', '-q', '-b', 'main', repoRoot]);
  g(repoRoot, ['config', 'user.name', 'R43 Test']);
  g(repoRoot, ['config', 'user.email', 'r43@test.local']);
  g(repoRoot, ['config', 'core.symlinks', 'true']);
  mkdirSync(join(repoRoot, 'apps/seed/src'), { recursive: true });
  writeFileSync(join(repoRoot, 'apps/seed/src/recursion.ts'), '// original content\n');
  // COMMIT two hostile symlinks into HEAD (absolute targets → the out-of-tree secret):
  //   leaf:   apps/seed/src/leaked.ts  → outside/secret.txt
  //   nested: apps/seed/src/linked     → outside/            (a directory component that escapes)
  symlinkSync(join(outsideDir, 'secret.txt'), join(repoRoot, 'apps/seed/src/leaked.ts'));
  symlinkSync(outsideDir, join(repoRoot, 'apps/seed/src/linked'));
  g(repoRoot, ['add', '-A']);
  g(repoRoot, ['commit', '-q', '--no-gpg-sign', '-m', 'init (with committed symlinks)']);
});
afterAll(() => { rmSync(base, { recursive: true, force: true }); });

const fakeRepoCap = (): RepoReadCapability => ({
  list: () => [TARGET],
  read: (p) => readFileSync(join(repoRoot, p), 'utf8'),
  exists: (p) => existsSync(join(repoRoot, p)),
});

/** A genuine rehearsed candidate (single file → TARGET), through the real R0–R3 envelope. */
function stagedCandidate(nonceTag: string, content = `// candidate ${nonceTag}`) {
  const w = makeWorld();
  const ide = new AumaIdeEnvelope(fakeRepoCap());
  const d = ide.draft({ targetPath: TARGET, newContent: content, createdAt: NOW_ISO });
  if (!d.ok) throw new Error('draft failed');
  const proposal = d.proposal as Proposal;
  const auth = authFor(w.owner, proposal, { nonce: `stage-${nonceTag}` });
  const staged = ide.stageBranchCandidate(w.env, [{ proposal, auth }], `governed refinement ${nonceTag}`);
  if (!staged.ok) throw new Error('stage failed: ' + (staged as { refusal?: { text: string } }).refusal?.text);
  return { w, candidate: staged.candidate as BranchCandidate };
}

/** Rebuild a candidate so its single file targets `relPath` with matching workspace content (draftHash recomputed),
 *  reusing a genuine rehearsal receipt hash. Lets us aim the write at a hostile on-disk shape. */
function candidateForPath(relPath: string, content: string): { w: ReturnType<typeof makeWorld>; candidate: BranchCandidate } {
  const x = stagedCandidate('victim');
  const src = x.candidate.files[0];
  const draftHash = deriveDraftHash({ id: 'candidate', targetPath: relPath, newContent: content, createdAt: '2026-01-01T00:00:00.000Z', supersedes: null });
  const files = [{ ...src, path: relPath, draftHash }];
  const workspace = new Map<string, string>([[relPath, content]]);
  return { w: x.w, candidate: { ...x.candidate, files, workspace } as BranchCandidate };
}

const matInput = (x: { w: ReturnType<typeof makeWorld>; candidate: BranchCandidate }, over: Partial<MaterializeInput> = {}): MaterializeInput => {
  const ph = candidatePayloadHash(x.candidate);
  return {
    repoRoot, worktreeBase: wtBase, candidate: x.candidate,
    candidateAuth: x.w.owner.authorize({ proposalHash: ph, draftHash: ph, nonce: `cand-${x.candidate.candidateId.slice(0, 8)}`, issuedAt: NOW_ISO, expiresAt: null }),
    monitor: new CandidateReferenceMonitor(x.w.owner.root),
    ownerArmed: true,
    store: x.w.env.store, nowMs: NOW_MS, nowIso: NOW_ISO, ...over,
  };
};

function assertNoResidue(candidate: BranchCandidate) {
  const branch = candidateBranchName(candidate);
  expect(g(repoRoot, ['status', '--porcelain'])).toBe('');                             // primary tree clean
  expect(readFileSync(join(repoRoot, 'apps/seed/src/recursion.ts'), 'utf8')).toBe('// original content\n');
  expect(tryG(repoRoot, ['rev-parse', '--verify', `refs/heads/${branch}`])).toBeNull(); // candidate branch deleted
  expect(g(repoRoot, ['worktree', 'list'])).not.toContain(`wt-${candidate.candidateId.slice(0, 12)}`);
  expect(readFileSync(join(outsideDir, 'secret.txt'), 'utf8')).toBe('DO NOT TOUCH\n');   // out-of-tree secret untouched
  expect(readdirSync(outsideDir).sort()).toEqual(['secret.txt']);                        // nothing written into it
}

describe('WAVE 3 · candidate-write integrity — pre-write no-follow deny + exact staging', () => {
  it('happy path commits EXACTLY the candidate file list (never git add -A)', () => {
    const x = stagedCandidate('exact');
    const out = materializeCandidate(matInput(x));
    expect(out.ok).toBe(true);
    const committed = g(out.worktreePath as string, ['show', '--name-only', '--format=', 'HEAD']).split('\n').filter(Boolean).sort();
    expect(committed).toEqual([TARGET]);           // only the candidate file entered — no stray/symlink files swept
    g(repoRoot, ['worktree', 'remove', '--force', out.worktreePath as string]);
    g(repoRoot, ['branch', '-D', out.branch as string]);
  });

  it('LEAF symlink (committed → out-of-tree secret) at the write target refuses; secret untouched, no residue', () => {
    const x = candidateForPath('apps/seed/src/leaked.ts', '// attempt to write through a symlink\n');
    const out = materializeCandidate(matInput(x));
    expect(out.ok).toBe(false);
    expect(out.reasonClass).toBe('candidate:unsafe-write-path');
    expect(out.receiptHash).toMatch(/^[0-9a-f]{64}$/);   // content-free refusal receipt
    assertNoResidue(x.candidate);
  });

  it('NESTED symlinked directory component refuses and cannot route the write outside the worktree', () => {
    const x = candidateForPath('apps/seed/src/linked/pwn.ts', '// should never be written\n');
    const out = materializeCandidate(matInput(x));
    expect(out.ok).toBe(false);
    expect(out.reasonClass).toBe('candidate:unsafe-write-path');
    assertNoResidue(x.candidate);
    expect(existsSync(join(outsideDir, 'pwn.ts'))).toBe(false);
  });

  it('out-of-worktree-root / identity-changing target refuses BEFORE any write (layered: fence ∪ identity), content-free receipt', () => {
    const x = candidateForPath('apps/seed/../../escape.ts', '// escape');
    const out = materializeCandidate(matInput(x));
    expect(out.ok).toBe(false);
    // the lexical fence catches `..` first; the stage identity check is the belt behind it — either is a valid deny
    expect(['candidate:unsafe-write-path', 'candidate:forbidden-target']).toContain(out.reasonClass);
    expect(out.receiptHash).toMatch(/^[0-9a-f]{64}$/);
    assertNoResidue(x.candidate);
  });

  it('backslash / non-normalized path variants all refuse (layered: fence ∪ identity), no write', () => {
    for (const bad of ['apps/seed/./src/x.ts', 'apps/seed//src/x.ts', 'apps\\seed\\x.ts', 'apps/seed/src/x.ts/']) {
      const x = candidateForPath(bad, '// bad');
      const out = materializeCandidate(matInput(x));
      expect(out.ok).toBe(false);
      expect(['candidate:unsafe-write-path', 'candidate:forbidden-target']).toContain(out.reasonClass);
    }
  });

  it('duplicate candidate targets after case-folding refuse (APFS is case-insensitive)', () => {
    const x = stagedCandidate('dup');
    const f = x.candidate.files[0];
    const files = [f, { ...f, path: f.path.toUpperCase() }];
    const workspace = new Map(x.candidate.workspace);
    workspace.set(f.path.toUpperCase(), workspace.get(f.path) as string);
    const candidate = { ...x.candidate, files, workspace } as BranchCandidate;
    const out = materializeCandidate(matInput({ w: x.w, candidate }));
    expect(out.ok).toBe(false);
    expect(out.reasonClass).toBe('candidate:unsafe-write-path');
  });
});
