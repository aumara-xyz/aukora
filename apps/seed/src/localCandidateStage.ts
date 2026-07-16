// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Local Git candidate stage (R36) — the ONE deliberately effectful adapter in this lane.
 *
 * It materializes a staged BranchCandidate (which already required a PASSED, receipted rehearsal) into a
 * DISPOSABLE git worktree on a `candidate/<id>` branch — and nothing else. Its law:
 *   - a passed intent may materialize ONLY after a FRESH in-process AUMLOK hybrid verification of every draft,
 *     performed here at materialization time — persisted candidate/UI/Convex state is never trusted;
 *   - the effect is ISOLATED: the worktree lives OUTSIDE the repo root, the branch is created at HEAD without
 *     touching the current checkout, and HEAD/main refs plus the primary working tree are verified unchanged after;
 *   - it NEVER signs, pushes, merges, fetches, pulls, resets, rebases, or mutates main — the git surface is a
 *     runtime-enforced subcommand allowlist (`status`, `rev-parse`, `worktree`, `add`, `commit`), and the commit is
 *     `--no-gpg-sign` (a record, not a signature);
 *   - RECEIPT-BEFORE-EFFECT: an attempt receipt is chained before any git mutation (an unrecordable receipt refuses
 *     the materialization), and the completion receipt binds the commit sha + intent lineage;
 *   - replay-safe: an existing candidate branch refuses (`candidate:already-materialized`); a dirty primary tree
 *     refuses (`candidate:dirty-tree`); forbidden targets are re-fenced here (defense in depth).
 *
 * Everything upstream of this module stays pure; this adapter is excluded from the pure-module containment list and
 * carries its own dedicated containment tests instead.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import type { ReactiveMemoryStore } from '@aukora/brain';
import { buildMemoryRecord } from '@aukora/memory';
import type { SignedPromotionV2 } from '@aukora/kernel/schemas';
import { deriveDraftHash } from './proposal.js';
import { classifyPath, candidateAllowed } from './pathFence.js';
import { scrubText } from './councilPack.js';
import { CandidateReferenceMonitor } from './candidateReferenceMonitor.js';
import type { BranchCandidate } from './ideEnvelope.js';

export type CandidateReasonClass =
  | 'candidate:ok'
  | 'candidate:shape-invalid'
  | 'candidate:forbidden-target'
  | 'candidate:fresh-verification-failed'
  | 'candidate:not-a-repo'
  | 'candidate:dirty-tree'
  | 'candidate:already-materialized'
  | 'candidate:reference-monitor-refused'
  | 'candidate:receipt-unrecordable'
  | 'candidate:isolation-violated'
  | 'candidate:git-error';

export interface CandidateMaterialization {
  readonly ok: boolean;
  readonly reasonClass: CandidateReasonClass;
  readonly text: string;
  readonly branch: string | null;
  readonly worktreePath: string | null;
  readonly commitSha: string | null;
  readonly attemptReceiptHash: string | null;
  readonly receiptHash: string | null;
  readonly pushed: false;
  readonly merged: false;
  readonly signedForOwner: false;
  readonly grantsAuthority: false;
}

export interface MaterializeInput {
  readonly repoRoot: string;
  /** Disposable-worktree base directory — MUST be outside repoRoot (isolation is checked, not assumed). */
  readonly worktreeBase: string;
  readonly candidate: BranchCandidate;
  /** The owner's authorization over the candidate PAYLOAD hash (proposalHash===draftHash===candidatePayloadHash). */
  readonly candidateAuth: SignedPromotionV2 | undefined;
  /** The canonical kernel reference monitor (durable consumed-id state). The ONE authorization path. */
  readonly monitor: CandidateReferenceMonitor;
  /** The owner has explicitly ARMED this materialization (maps to the kernel's humanClearance for self-modify). */
  readonly ownerArmed: boolean;
  readonly store: ReactiveMemoryStore;
  readonly nowMs: number;
  readonly nowIso: string;
}

/** The ONLY git subcommands this module may run. Everything outward-facing or history-mutating is absent. */
const ALLOWED_GIT_SUBCOMMANDS: ReadonlySet<string> = new Set(['status', 'rev-parse', 'worktree', 'add', 'commit']);

function git(cwd: string, subcommand: string, args: readonly string[], config: readonly string[] = []): string {
  if (!ALLOWED_GIT_SUBCOMMANDS.has(subcommand)) throw new Error(`git subcommand '${subcommand}' is outside the candidate-stage allowlist`);
  return execFileSync('git', ['-C', cwd, ...config, subcommand, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function tryGit(cwd: string, subcommand: string, args: readonly string[]): string | null {
  try {
    return git(cwd, subcommand, args).trim();
  } catch {
    return null;
  }
}

export function candidateBranchName(candidate: BranchCandidate): string {
  return `candidate/${candidate.candidateId.slice(0, 12)}`;
}

export function materializeCandidate(input: MaterializeInput): CandidateMaterialization {
  const refuse = (reasonClass: Exclude<CandidateReasonClass, 'candidate:ok'>, text: string, attemptReceiptHash: string | null = null): CandidateMaterialization =>
    ({ ok: false, reasonClass, text, branch: null, worktreePath: null, commitSha: null, attemptReceiptHash, receiptHash: null, pushed: false, merged: false, signedForOwner: false, grantsAuthority: false });

  const { candidate, store } = input;

  // 1. Candidate shape — hard-false literals must actually be false; every file must carry its rehearsal receipt.
  if (candidate.staged !== true || candidate.pushed !== false || candidate.signed !== false || candidate.merged !== false
    || candidate.deployed !== false || candidate.grantsAuthority !== false || candidate.files.length === 0) {
    return refuse('candidate:shape-invalid', 'refused: candidate is not a well-formed staged branch candidate');
  }
  if (candidate.files.some((f) => typeof f.receiptHash !== 'string' || !/^[0-9a-f]{64}$/.test(f.receiptHash))) {
    return refuse('candidate:shape-invalid', 'refused: every candidate file requires its PASSED-rehearsal receipt hash');
  }

  // 2. Forbidden targets — re-fenced at the door (defense in depth; the envelope checked already).
  for (const f of candidate.files) {
    const v = classifyPath(f.path);
    if (!candidateAllowed(v)) return refuse('candidate:forbidden-target', `refused: ${v.text} (${f.path})`);
  }

  // 3. WORKSPACE INTEGRITY — the content that would be written must match the signed draftHash (no post-sign swap).
  //    (The kernel monitor authorizes over the candidate payload, which binds these draftHashes.)
  for (const f of candidate.files) {
    const content = candidate.workspace.get(f.path);
    if (typeof content !== 'string') return refuse('candidate:shape-invalid', `refused: no workspace content for ${f.path}`);
    const recomputed = deriveDraftHash({ id: 'candidate', targetPath: f.path, newContent: content, createdAt: '2026-01-01T00:00:00.000Z', supersedes: null });
    if (recomputed !== f.draftHash) return refuse('candidate:fresh-verification-failed', `refused: workspace content does not match the signed draftHash for ${f.path}`);
  }

  // 4. Repo + isolation preconditions.
  const repoRoot = resolve(input.repoRoot);
  const worktreeBase = resolve(input.worktreeBase);
  if (worktreeBase === repoRoot || worktreeBase.startsWith(repoRoot + '/')) {
    return refuse('candidate:shape-invalid', 'refused: the disposable worktree base must live OUTSIDE the repo root');
  }
  if (tryGit(repoRoot, 'rev-parse', ['--is-inside-work-tree']) !== 'true') {
    return refuse('candidate:not-a-repo', 'refused: repoRoot is not a git working tree');
  }
  const porcelain = tryGit(repoRoot, 'status', ['--porcelain']);
  if (porcelain === null) return refuse('candidate:git-error', 'refused: git status failed');
  if (porcelain.length > 0) return refuse('candidate:dirty-tree', 'refused: the primary working tree is dirty — commit or stash before materializing a candidate');

  const branch = candidateBranchName(candidate);
  if (tryGit(repoRoot, 'rev-parse', ['--verify', '--quiet', `refs/heads/${branch}`]) !== null) {
    return refuse('candidate:already-materialized', `refused: candidate branch ${branch} already exists — one materialization per candidate`);
  }

  const headBefore = tryGit(repoRoot, 'rev-parse', ['HEAD']);
  if (headBefore === null) return refuse('candidate:git-error', 'refused: repo has no HEAD commit');
  const mainBefore = tryGit(repoRoot, 'rev-parse', ['--verify', '--quiet', 'refs/heads/main']);

  // 4b. CANONICAL AUTHORIZATION — the ONE reference monitor (kernel decide()): owner-armed self-modify, hybrid
  //     AUMLOK verify, consumed-once. No parallel or weaker path exists. Placed after the cheap git prechecks so a
  //     dirty-tree / already-exists refusal never consumes the authorization nonce.
  const decision = input.monitor.decide(candidate, input.candidateAuth, input.nowMs, { ownerArmed: input.ownerArmed });
  if (!decision.allowed) return refuse('candidate:reference-monitor-refused', `refused: kernel reference monitor denied materialization (${decision.code})`);

  // 5. RECEIPT-BEFORE-EFFECT — the attempt is chained before any git mutation.
  const lineage = candidate.files.map((f) => f.intentId.slice(0, 12)).join(',');
  const attempt = store.ingest(buildMemoryRecord({
    content: `candidate-materializing · candidate=${candidate.candidateId.slice(0, 12)} · branch=${branch} · files=${candidate.files.length} · lineage=${lineage}`,
    createdAt: input.nowIso, kind: 'receipt', consent: 'owner-only', provenance: 'candidate-stage',
  }));
  if (!attempt.ok) return refuse('candidate:receipt-unrecordable', 'refused: the attempt receipt could not be recorded — no effect without a receipt');

  // 6. Materialize: disposable worktree + candidate branch at HEAD (the current checkout is never touched).
  const worktreePath = join(worktreeBase, `wt-${candidate.candidateId.slice(0, 12)}`);
  try {
    mkdirSync(worktreeBase, { recursive: true });
    if (existsSync(worktreePath)) return refuse('candidate:already-materialized', 'refused: worktree path already exists', attempt.chainHash);
    git(repoRoot, 'worktree', ['add', '-b', branch, worktreePath, 'HEAD']);
    for (const f of candidate.files) {
      const target = join(worktreePath, f.path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, candidate.workspace.get(f.path) as string, 'utf8');
    }
    git(worktreePath, 'add', ['-A']);
    const message = [
      `aukora candidate ${candidate.candidateId.slice(0, 12)}`,
      '',
      `intents: ${lineage}`,
      `rehearsal-receipts: ${candidate.files.map((f) => (f.receiptHash as string).slice(0, 12)).join(',')}`,
      `explanation: ${scrubText(candidate.explanation).slice(0, 512)}`,
      'staged-only: never pushed, never merged, never signed for the owner',
    ].join('\n');
    git(worktreePath, 'commit', ['--no-gpg-sign', '-m', message], ['-c', 'user.name=Auma Candidate Stage', '-c', 'user.email=candidate@localhost']);
  } catch (e) {
    return refuse('candidate:git-error', `refused: git materialization failed (${e instanceof Error ? e.message.slice(0, 160) : 'unknown'})`, attempt.chainHash);
  }

  const commitSha = tryGit(worktreePath, 'rev-parse', ['HEAD']);

  // 7. Isolation post-conditions — HEAD/main refs and the primary tree must be exactly as before.
  const headAfter = tryGit(repoRoot, 'rev-parse', ['HEAD']);
  const mainAfter = tryGit(repoRoot, 'rev-parse', ['--verify', '--quiet', 'refs/heads/main']);
  const porcelainAfter = tryGit(repoRoot, 'status', ['--porcelain']);
  if (headAfter !== headBefore || mainAfter !== mainBefore || porcelainAfter !== '') {
    return refuse('candidate:isolation-violated', 'REFUSED AND FLAGGED: the primary checkout changed during materialization — investigate before trusting this candidate', attempt.chainHash);
  }

  // 8. Completion receipt binds the commit sha + lineage + the canonical kernel-monitor receipt draft head.
  const done = store.ingest(buildMemoryRecord({
    content: `candidate-materialized · candidate=${candidate.candidateId.slice(0, 12)} · branch=${branch} · commit=${(commitSha ?? '').slice(0, 12)} · files=${candidate.files.length} · lineage=${lineage} · monitorReceipt=${(decision.receiptDraftHash ?? '').slice(0, 12)} · rootId=${(decision.authorizedRootId ?? '').slice(0, 12)}`,
    createdAt: input.nowIso, kind: 'receipt', consent: 'owner-only', provenance: 'candidate-stage',
  }));

  return {
    ok: true,
    reasonClass: 'candidate:ok',
    text: `candidate materialized in a disposable worktree on ${branch} (never pushed, never merged)`,
    branch,
    worktreePath,
    commitSha,
    attemptReceiptHash: attempt.chainHash,
    receiptHash: done.ok ? done.chainHash : null,
    pushed: false,
    merged: false,
    signedForOwner: false,
    grantsAuthority: false,
  };
}

/** Dispose of a candidate WORKTREE (the branch and its commit remain as evidence). Receipted. */
export function disposeCandidateWorktree(repoRoot: string, worktreePath: string, store: ReactiveMemoryStore, nowIso: string): { ok: boolean; text: string } {
  try {
    git(resolve(repoRoot), 'worktree', ['remove', '--force', resolve(worktreePath)]);
    const ing = store.ingest(buildMemoryRecord({ content: `candidate-worktree-disposed · path=${worktreePath.slice(-64)}`, createdAt: nowIso, kind: 'receipt', consent: 'owner-only', provenance: 'candidate-stage' }));
    return { ok: true, text: ing.ok ? 'worktree disposed (receipted); the candidate branch remains as evidence' : 'worktree disposed; receipt refused' };
  } catch (e) {
    return { ok: false, text: `dispose failed (${e instanceof Error ? e.message.slice(0, 120) : 'unknown'})` };
  }
}

/** HARD: the candidate stage never pushes, merges, or signs for the owner. Constant, by construction. */
export function candidateStageGrantsAuthority(): false {
  return false;
}
