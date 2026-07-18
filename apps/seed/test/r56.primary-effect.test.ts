// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R56 brick 2 — `runLiveCandidateEffect()` is now the PRIMARY ceremony materialization path.
 *
 * `localCeremonyRunner` used to call `materializeCandidate()` directly; it now delegates the effect to the
 * crash-recoverable coordinator (`runLiveCandidateEffect` → `driveEffect`), and direct `materializeCandidate()`
 * lives ONLY inside the effect adapter. This proves the runner-level acceptance over a REAL git repo + a durable
 * trusted-state monitor:
 *   - HAPPY: exactly one isolated candidate; public main + HEAD byte-identical; durable consume == 1; the
 *     proposal's plaintext content never appears in the materialization/receipt (content-free);
 *   - AUTHORITY-NEGATIVE MATRIX (each → refused, ZERO Git, ZERO durable consume): missing / forged / wrong-base
 *     candidate authorization refuses at the non-consuming owner gate BEFORE any effect;
 *   - GENUINE stale head (correct claim, repo moved after approval) → exact `candidate:stale-head` from the stage;
 *   - REPLAY (crash-after-consume equivalent): a second ceremony over the same durable state never double-effects
 *     — no second candidate, consume stays == 1.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ReactiveMemoryStore } from '@aukora/brain';
import {
  runLocalRecursionCeremony, InMemoryWorkflowStore, RecursionLedger, HybridOwnerAdapter,
  candidatePayloadForProposals, deriveIntentId, deriveDraftHash,
  type LocalCeremonyEnv, type LocalCeremonyInvocation, type RepoReadCapability, type Proposal,
} from '../src/index.js';
import { DurableCandidateReferenceMonitor } from '../src/durableCandidateMonitor.js';

const NOW_ISO = '2026-07-18T12:00:00.000Z';
const NOW_MS = Date.parse(NOW_ISO);
const TARGET = 'apps/seed/src/notes.ts';
const g = (cwd: string, args: string[]) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();
const tryG = (cwd: string, args: string[]) => { try { return g(cwd, args); } catch { return null; } };
const candidateBranches = (repo: string) => g(repo, ['branch', '--list', 'candidate/*']).split('\n').filter((l) => l.trim().length > 0);

let base: string; let repoRoot: string; let wtBase: string;
beforeAll(() => {
  base = realpathSync(mkdtempSync(join(tmpdir(), 'aukora-r56-primary-')));
  repoRoot = join(base, 'repo'); wtBase = join(base, 'candidates');
  mkdirSync(join(repoRoot, 'apps/seed/src'), { recursive: true });
  execFileSync('git', ['init', '-q', '-b', 'main', repoRoot]);
  g(repoRoot, ['config', 'user.name', 'R56']); g(repoRoot, ['config', 'user.email', 'r56@test.local']);
  writeFileSync(join(repoRoot, TARGET), '// original\n');
  g(repoRoot, ['add', '-A']); g(repoRoot, ['commit', '-q', '--no-gpg-sign', '-m', 'init']);
});
afterAll(() => rmSync(base, { recursive: true, force: true }));

const headOf = () => g(repoRoot, ['rev-parse', 'HEAD']);
const owner = new HybridOwnerAdapter('r56-primary-owner');

function ceremonyEnv(stateDir: string): LocalCeremonyEnv {
  const store = new ReactiveMemoryStore();
  const recursionEnv = { store, knownFiles: new Set([TARGET]), ownerRoot: owner.root, ledger: new RecursionLedger(), nowMs: NOW_MS, nowIso: NOW_ISO, deadlineMs: NOW_MS + 60_000 };
  const repo: RepoReadCapability = { list: () => [TARGET], read: (p) => readFileSync(join(repoRoot, p), 'utf8'), exists: (p) => existsSync(join(repoRoot, p)) };
  return { recursionEnv, workflowStore: new InMemoryWorkflowStore(), repo, ownerRoot: owner.root, store, trustedStateDir: stateDir, gitRepoRoot: repoRoot, worktreeBase: wtBase, nowMs: NOW_MS, nowIso: NOW_ISO };
}

/** One materializing invocation, head-bound over `signBase` (default = the current true head). */
function inv(tag: string, over: Partial<LocalCeremonyInvocation> & { signBase?: string } = {}): LocalCeremonyInvocation {
  const proposal: Proposal = { id: `p-${tag}`, targetPath: TARGET, newContent: `// governed refinement ${tag}`, createdAt: NOW_ISO, supersedes: null };
  const signBase = over.signBase ?? headOf();
  const { payloadHash } = candidatePayloadForProposals([proposal], signBase);
  const candidateAuth = owner.authorize({ proposalHash: payloadHash, draftHash: payloadHash, nonce: `${tag}-cand`, issuedAt: NOW_ISO, expiresAt: null });
  // The proposal-intent (owner AUMLOK) auth the durable machine verifies at owner-gate step 2.
  const auth = owner.authorize({ proposalHash: deriveIntentId(proposal), draftHash: deriveDraftHash(proposal), nonce: `${tag}-owner`, issuedAt: NOW_ISO, expiresAt: null });
  const { signBase: _sb, ...rest } = over;
  return { proposalInput: proposal, nonce: `${tag}-n`, auth, materialize: true, candidateAuth, ownerArmed: true, expectedHeadBefore: headOf(), ...rest };
}

describe('R56 · the primary ceremony materializes through the crash-recoverable effect coordinator', () => {
  it('HAPPY: exactly one isolated candidate, main+HEAD byte-identical, durable consume == 1, content-free', () => {
    const stateDir = join(base, 'state-happy');
    const monitor = new DurableCandidateReferenceMonitor(owner.root, stateDir);
    const headBefore = headOf();
    const invocation = inv('happy');
    const res = runLocalRecursionCeremony({ ...ceremonyEnv(stateDir), monitor }, invocation);
    expect(res.ok).toBe(true);
    expect(res.phase).toBe('candidate-materialized');
    expect(res.reasonClass).toBe('candidate:ok');
    expect(res.materialization?.commitSha).toMatch(/^[0-9a-f]{40}$/);
    // exactly one candidate branch for this id; main + HEAD unmoved; working tree clean
    expect(tryG(repoRoot, ['rev-parse', '--verify', '--quiet', `refs/heads/${res.materialization!.branch}`])).not.toBeNull();
    expect(headOf()).toBe(headBefore);
    expect(g(repoRoot, ['status', '--porcelain'])).toBe('');
    expect(monitor.consumed().length).toBe(1);                       // exactly one durable consume
    // content-free: the proposal's plaintext refinement text never rides into the materialization/receipt fields
    expect(JSON.stringify(res.materialization)).not.toContain('governed refinement happy');
  });

  it('AUTHORITY-NEGATIVE: missing / forged / wrong-base candidate auth each refuse with ZERO Git and ZERO consume', () => {
    const cases: Array<{ tag: string; mutate: (i: LocalCeremonyInvocation) => LocalCeremonyInvocation }> = [
      { tag: 'noauth', mutate: (i) => ({ ...i, candidateAuth: undefined }) },
      { tag: 'forged', mutate: (i) => {
        const sig = i.candidateAuth!.signatures.ed25519;
        return { ...i, candidateAuth: { ...i.candidateAuth!, signatures: { ...i.candidateAuth!.signatures, ed25519: (sig[0] === 'a' ? 'b' : 'a') + sig.slice(1) } } };
      } },
      // wrong-base: signed over a DIFFERENT base than the claimed expectedHeadBefore (the A→B bypass shape)
      { tag: 'wrongbase', mutate: (i) => i },
    ];
    for (const c of cases) {
      const stateDir = join(base, `state-${c.tag}`);
      const monitor = new DurableCandidateReferenceMonitor(owner.root, stateDir);
      const branchesBefore = candidateBranches(repoRoot).length;
      const headBefore = headOf();
      const invocation = c.tag === 'wrongbase'
        ? c.mutate(inv(c.tag, { signBase: 'a1'.repeat(20) }))   // sign over a base that is not the current head
        : c.mutate(inv(c.tag));
      const res = runLocalRecursionCeremony({ ...ceremonyEnv(stateDir), monitor }, invocation);
      expect(res.ok, c.tag).toBe(false);
      expect(res.phase, c.tag).toBe('refused-at-candidate');
      expect(res.reasonClass, c.tag).toBe('candidate:reference-monitor-refused');
      expect(candidateBranches(repoRoot).length, `${c.tag} no new branch`).toBe(branchesBefore);
      expect(headOf(), `${c.tag} HEAD unmoved`).toBe(headBefore);
      expect(monitor.consumed().length, `${c.tag} zero consume`).toBe(0);
    }
  });

  it('GENUINE stale head: a correct claim whose repo moved after approval → exact candidate:stale-head, ZERO Git, ZERO consume', () => {
    const stateDir = join(base, 'state-genuine-stale');
    const monitor = new DurableCandidateReferenceMonitor(owner.root, stateDir);
    const approvedHead = headOf();
    const invocation = inv('genstale', { signBase: approvedHead, expectedHeadBefore: approvedHead });
    // the repo advances AFTER the (correct) approval — an unrelated commit so the claim itself is honest
    writeFileSync(join(repoRoot, 'unrelated.txt'), '// later work\n');
    g(repoRoot, ['add', '-A']); g(repoRoot, ['commit', '-q', '--no-gpg-sign', '-m', 'moved']);
    const movedHead = headOf();
    expect(movedHead).not.toBe(approvedHead);
    const branchesBefore = candidateBranches(repoRoot).length;
    const res = runLocalRecursionCeremony({ ...ceremonyEnv(stateDir), monitor }, invocation);
    expect(res.ok).toBe(false);
    expect(res.reasonClass).toBe('candidate:stale-head');           // owner gate passes (claim matches sig); stage precheck refuses
    expect(candidateBranches(repoRoot).length).toBe(branchesBefore);
    expect(headOf()).toBe(movedHead);
    expect(monitor.consumed().length).toBe(0);
    g(repoRoot, ['reset', '-q', '--hard', approvedHead]);            // restore the base for later tests
  });

  it('REPLAY (crash-after-consume equivalent): a second ceremony over the same durable state never double-effects', () => {
    const stateDir = join(base, 'state-replay');
    const first = runLocalRecursionCeremony({ ...ceremonyEnv(stateDir), monitor: new DurableCandidateReferenceMonitor(owner.root, stateDir) }, inv('replay'));
    expect(first.phase).toBe('candidate-materialized');
    const branchesAfterFirst = candidateBranches(repoRoot).length;
    const headAfterFirst = headOf();
    // a fresh monitor over the SAME durable dir = a restarted process; the consume survived → replay-refuses
    const second = runLocalRecursionCeremony({ ...ceremonyEnv(stateDir), monitor: new DurableCandidateReferenceMonitor(owner.root, stateDir) }, inv('replay'));
    expect(second.ok).toBe(false);
    expect(second.phase).toBe('refused-at-candidate');
    expect(candidateBranches(repoRoot).length).toBe(branchesAfterFirst); // NO second candidate
    expect(headOf()).toBe(headAfterFirst);
    expect(new DurableCandidateReferenceMonitor(owner.root, stateDir).consumed().length).toBe(1); // still exactly one
  });
});
