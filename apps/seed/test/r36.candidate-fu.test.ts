// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R36 — the real governed local candidate: fresh in-process AUMLOK verification → disposable worktree/candidate
 * branch (isolated, never pushed/merged), and the operational Fu adapter over the REAL council engine (offline
 * transport): invalid JSON → non-vote, partial council → hold, spend ceilings, Fugu-Ultra exclusion, receipts.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CANONICAL_SEATS, PACKET_OPEN, PACKET_CLOSE, type Transport, type SeatResponse } from '@aukora/council';
import {
  AumaIdeEnvelope, materializeCandidate, disposeCandidateWorktree, candidateBranchName, candidateStageGrantsAuthority,
  runFuAdvisory, verdictFromCouncilOutcome, reviewerFor, fuAdapterGrantsAuthority, councilOutcomeDigest,
  DurableRecursion, InMemoryWorkflowStore, deriveWorkflowId,
  deriveIntentId, deriveDraftHash, FUGU_REVIEWER,
  type BranchCandidate, type Proposal, type RepoReadCapability, type MaterializeInput,
} from '../src/index.js';
import { makeWorld, makeProposal, authFor, NOW_ISO, NOW_MS, TARGET } from './support.js';

const g = (cwd: string, args: string[]) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();

// ── a real disposable git repo for the whole suite ──────────────────────────
let base: string; let repoRoot: string; let wtBase: string;
beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), 'aukora-r36-'));
  repoRoot = join(base, 'repo');
  wtBase = join(base, 'candidates');
  mkdirSync(repoRoot, { recursive: true });
  execFileSync('git', ['init', '-q', '-b', 'main', repoRoot]);
  g(repoRoot, ['config', 'user.name', 'R36 Test']);
  g(repoRoot, ['config', 'user.email', 'r36@test.local']);
  mkdirSync(join(repoRoot, 'apps/seed/src'), { recursive: true });
  writeFileSync(join(repoRoot, 'apps/seed/src/recursion.ts'), '// original content\n');
  writeFileSync(join(repoRoot, 'apps/seed/src/proposal.ts'), '// original proposal\n');
  g(repoRoot, ['add', '-A']);
  g(repoRoot, ['commit', '-q', '--no-gpg-sign', '-m', 'init']);
});
afterAll(() => { rmSync(base, { recursive: true, force: true }); });

const fakeRepoCap = (): RepoReadCapability => ({
  list: () => [TARGET, 'apps/seed/src/proposal.ts'],
  read: (p) => readFileSync(join(repoRoot, p), 'utf8'),
  exists: (p) => existsSync(join(repoRoot, p)),
});

/** Stage a real candidate through the R0–R3 envelope (PASSED, receipted rehearsals). */
function stagedCandidate(nonceTag: string, content = `// candidate ${nonceTag}`) {
  const w = makeWorld();
  const ide = new AumaIdeEnvelope(fakeRepoCap());
  const d = ide.draft({ targetPath: TARGET, newContent: content, createdAt: NOW_ISO });
  if (!d.ok) throw new Error('draft failed');
  const proposal = d.proposal as Proposal;
  const auth = authFor(w.owner, proposal, { nonce: `stage-${nonceTag}` });
  const staged = ide.stageBranchCandidate(w.env, [{ proposal, auth }], `governed refinement ${nonceTag}`);
  if (!staged.ok) throw new Error('stage failed');
  return { w, candidate: staged.candidate, proposal, auth };
}

const matInput = (x: ReturnType<typeof stagedCandidate>, over: Partial<MaterializeInput> = {}): MaterializeInput => ({
  repoRoot, worktreeBase: wtBase, candidate: x.candidate,
  drafts: [{ proposal: x.proposal, auth: x.auth }],
  ownerRoot: x.w.owner.root, store: x.w.env.store, nowMs: NOW_MS, nowIso: NOW_ISO, ...over,
});

describe('local candidate stage — real git, fresh verification, total isolation', () => {
  it('materializes a rehearsed candidate into a disposable worktree + candidate branch; main and HEAD untouched; exact receipt lineage', () => {
    const x = stagedCandidate('happy');
    const headBefore = g(repoRoot, ['rev-parse', 'HEAD']);
    const mainBefore = g(repoRoot, ['rev-parse', 'refs/heads/main']);

    const out = materializeCandidate(matInput(x));
    expect(out.ok).toBe(true);
    expect(out.branch).toBe(candidateBranchName(x.candidate));
    expect(out.commitSha).toMatch(/^[0-9a-f]{40}$/);
    expect(out.pushed).toBe(false);
    expect(out.merged).toBe(false);
    expect(out.signedForOwner).toBe(false);

    // isolation: primary checkout + refs untouched; worktree outside the repo; no remotes exist at all
    expect(g(repoRoot, ['rev-parse', 'HEAD'])).toBe(headBefore);
    expect(g(repoRoot, ['rev-parse', 'refs/heads/main'])).toBe(mainBefore);
    expect(g(repoRoot, ['status', '--porcelain'])).toBe('');
    expect(readFileSync(join(repoRoot, TARGET), 'utf8')).toBe('// original content\n');
    expect(out.worktreePath!.startsWith(wtBase)).toBe(true);
    expect(readFileSync(join(out.worktreePath as string, TARGET), 'utf8')).toBe('// candidate happy');
    expect(execFileSync('git', ['-C', repoRoot, 'remote'], { encoding: 'utf8' }).trim()).toBe('');

    // exact receipt lineage — the receipt CHAIN is content-free by design (only recordId hashes), so lineage is
    // read via recall (full content) + the content-free chain proves ordering/integrity.
    const rehearsal = x.w.env.store.recall({ text: 'governed-recursion applied' });
    const attempt = x.w.env.store.recall({ text: 'candidate-materializing' });
    const done = x.w.env.store.recall({ text: 'candidate-materialized' });
    expect(rehearsal.length).toBe(1);                         // PASSED rehearsal receipted
    expect(attempt.length).toBe(1);                           // attempt receipt BEFORE the effect
    expect(done.length).toBe(1);                              // completion receipt after
    expect(done[0].content).toContain(`commit=${(out.commitSha as string).slice(0, 12)}`);
    expect(done[0].content).toContain(deriveIntentId(x.proposal).slice(0, 12));
    expect(attempt[0].content).toContain(x.candidate.candidateId.slice(0, 12));
    expect(x.w.env.store.chain().length).toBeGreaterThanOrEqual(3); // rehearsal + attempt + done (content-free)
    expect(x.w.env.store.verifyChain().valid).toBe(true);

    // the candidate commit message records lineage and staged-only truth
    const msg = g(out.worktreePath as string, ['rev-parse', 'HEAD']) && execFileSync('git', ['-C', out.worktreePath as string, 'log', '-1', '--format=%B'], { encoding: 'utf8' });
    expect(msg).toContain('rehearsal-receipts:');
    expect(msg).toContain('never pushed, never merged, never signed for the owner');

    // crash/restart idempotency + replay: a fresh process re-materializing the same candidate refuses
    const again = materializeCandidate(matInput(x));
    expect(again.ok).toBe(false);
    expect(again.reasonClass).toBe('candidate:already-materialized');

    // disposable: the worktree can be removed; the branch (evidence) remains
    const disposed = disposeCandidateWorktree(repoRoot, out.worktreePath as string, x.w.env.store, NOW_ISO);
    expect(disposed.ok).toBe(true);
    expect(g(repoRoot, ['rev-parse', '--verify', `refs/heads/${out.branch}`])).toMatch(/^[0-9a-f]{40}$/);
    expect(candidateStageGrantsAuthority()).toBe(false);
  });

  it('refuses without fresh authorization, with a forged signature, and with a stale approval', () => {
    const x = stagedCandidate('fresh');
    expect(materializeCandidate(matInput(x, { drafts: [] })).reasonClass).toBe('candidate:fresh-verification-failed');

    const forged = { ...x.auth, signatures: { ...x.auth.signatures, ed25519: 'ab'.repeat(64) } };
    expect(materializeCandidate(matInput(x, { drafts: [{ proposal: x.proposal, auth: forged }] })).reasonClass).toBe('candidate:fresh-verification-failed');

    const stale = x.w.owner.authorize({ proposalHash: deriveIntentId(x.proposal), draftHash: deriveDraftHash(x.proposal), nonce: 'stale', issuedAt: '2026-07-16T06:00:00.000Z', expiresAt: '2026-07-16T07:00:00.000Z' });
    const out = materializeCandidate(matInput(x, { drafts: [{ proposal: x.proposal, auth: stale }] }));
    expect(out.reasonClass).toBe('candidate:fresh-verification-failed');
    expect(out.text).toContain('expired');
    expect(g(repoRoot, ['status', '--porcelain'])).toBe(''); // nothing happened
  });

  it('refuses a dirty tree and a forbidden target; a tampered candidate flag fails shape', () => {
    const x = stagedCandidate('dirty');
    writeFileSync(join(repoRoot, 'untracked.tmp'), 'dirt');
    expect(materializeCandidate(matInput(x)).reasonClass).toBe('candidate:dirty-tree');
    rmSync(join(repoRoot, 'untracked.tmp'));

    const evil: BranchCandidate = {
      ...x.candidate,
      files: [{ ...x.candidate.files[0], path: 'packages/kernel/src/authority.ts' }],
      workspace: new Map([['packages/kernel/src/authority.ts', '// escape']]),
    };
    expect(materializeCandidate(matInput(x, { candidate: evil })).reasonClass).toBe('candidate:forbidden-target');

    const lying = { ...x.candidate, pushed: true } as unknown as BranchCandidate;
    expect(materializeCandidate(matInput(x, { candidate: lying })).reasonClass).toBe('candidate:shape-invalid');

    const insideRepo = materializeCandidate(matInput(x, { worktreeBase: join(repoRoot, 'nested') }));
    expect(insideRepo.reasonClass).toBe('candidate:shape-invalid'); // worktree must live OUTSIDE the repo
  });
});

// ── the REAL Fu council through the structured adapter (offline transport) ──────────────────────
const pkt = (hyp: string) => [PACKET_OPEN,
  'STANCE:⊕ CONFIDENCE:↑ STRATEGY:↙ FRAMEWORK:statistical DIST:(explore=0.10,exploit=0.30,verify=0.50,abstain=0.10)',
  'CLAIMS:(C1=0.8,C2=0.7)', `HYP:"${hyp}"`, PACKET_CLOSE].join('\n');

const goodTransport: Transport = async (seat, _prompt, phase): Promise<SeatResponse> => {
  if (phase === 'synthesis') return { text: 'The gate holds.\nUSED_CLAIMS:(C1,C2)', served: seat.slug, finishReason: 'stop' };
  return { text: pkt(`${seat.id} affirms the gate`), served: seat.slug, finishReason: 'stop', costUsd: 0.01 };
};

describe('Fu structured adapter — the real engine, operational and contained', () => {
  it('a full pass reaches quorum, is receipted, and its verdict flows into the durable gate as REAL evidence', async () => {
    const w = makeWorld();
    const res = await runFuAdvisory({ problem: 'apply the refinement?', claims: ['refuses forged sigs', 'blocks replay'] }, goodTransport, w.env.store, { now: NOW_MS, nowIso: NOW_ISO });
    expect(res.ok).toBe(true);
    expect(res.outcome?.quorumMet).toBe(true);
    expect(res.receiptHash).toMatch(/^[0-9a-f]{64}$/);
    expect(res.outcomeDigest).toBe(councilOutcomeDigest(res.outcome!));
    expect(res.grantsAuthority).toBe(false);

    const verdict = verdictFromCouncilOutcome(res.outcome!);
    expect(verdict.verdict).toBe('advisory-pass');
    expect(verdict.evidenceDigest).toBe(res.outcomeDigest);

    // convergence: the durable machine consumes the real verdict; the owner gate still decides
    const store = new InMemoryWorkflowStore();
    const p = makeProposal();
    const machine = new DurableRecursion(store, { ...w.env, review: reviewerFor(res.outcome!) });
    const proposed = machine.propose(p, 'fu-1');
    expect(proposed.state?.phase).toBe('awaiting-owner');
    expect(proposed.state?.councilEvidenceDigest).toBe(res.outcomeDigest); // REAL Fu evidence in the workflow
    const done = machine.complete(p, deriveWorkflowId(deriveIntentId(p), deriveDraftHash(p), 'fu-1'), authFor(w.owner, p, { nonce: 'fu-1' }));
    expect(done.state?.phase).toBe('applied');
    expect(fuAdapterGrantsAuthority()).toBe(false);
  });

  it('invalid JSON/garbage replies become NON-VOTES; a partial council is an insufficient-quorum HOLD that the gate refuses', async () => {
    const w = makeWorld();
    const partial: Transport = async (seat, _p, phase): Promise<SeatResponse> => {
      if (phase === 'synthesis') return { text: 'x\nUSED_CLAIMS:(C1)', served: seat.slug, finishReason: 'stop' };
      const idx = CANONICAL_SEATS.findIndex((s) => s.id === seat.id);
      if (idx >= 3) return { text: '{"not":"a packet" garbage', served: seat.slug, finishReason: 'stop' }; // invalid → non-vote
      return { text: pkt('ok'), served: seat.slug, finishReason: 'stop' };
    };
    const res = await runFuAdvisory({ problem: 'q', claims: ['c1'] }, partial, w.env.store, { now: NOW_MS, nowIso: NOW_ISO });
    expect(res.ok).toBe(true);
    expect(res.outcome?.quorumMet).toBe(false);
    expect(res.outcome?.nonVotes.length).toBeGreaterThanOrEqual(5);
    expect(res.outcome?.verdict).toBe('insufficient-quorum');

    const verdict = verdictFromCouncilOutcome(res.outcome!);
    expect(verdict.verdict).toBe('advisory-hold');
    expect(verdict.evidenceDigest).toBe('');

    const machine = new DurableRecursion(new InMemoryWorkflowStore(), { ...w.env, review: reviewerFor(res.outcome!) });
    const proposed = machine.propose(makeProposal(), 'fu-2');
    expect(proposed.state?.phase).toBe('refused');
    expect(proposed.state?.stage).toBe('refused-council-evidence'); // no owner wait without real evidence
  });

  it('spend ceilings refuse BEFORE any call; Fugu Ultra can never sit; no transport = no call', async () => {
    const w = makeWorld();
    let calls = 0;
    const counting: Transport = async (seat, _p, phase) => { calls += 1; return phase === 'synthesis' ? { text: 'x\nUSED_CLAIMS:(C1)', served: seat.slug } : { text: pkt('ok'), served: seat.slug }; };

    const tooExpensive = await runFuAdvisory({ problem: 'q', claims: ['c'] }, counting, w.env.store, { now: NOW_MS, nowIso: NOW_ISO, maxTokensPerCall: 900_000 });
    expect(tooExpensive.reasonClass).toBe('fu:spend-ceiling');
    expect(calls).toBe(0); // projection refused before any seat was called

    const fuguSeated = await runFuAdvisory({ problem: 'q', claims: ['c'] }, counting, w.env.store, { now: NOW_MS, nowIso: NOW_ISO, seats: [...CANONICAL_SEATS.slice(0, 7), FUGU_REVIEWER as never] });
    expect(fuguSeated.reasonClass).toBe('fu:external-reviewer-in-roster');
    expect(calls).toBe(0);

    const noTransport = await runFuAdvisory({ problem: 'q', claims: ['c'] }, undefined, w.env.store, { now: NOW_MS, nowIso: NOW_ISO });
    expect(noTransport.reasonClass).toBe('fu:no-transport');
  });
});
