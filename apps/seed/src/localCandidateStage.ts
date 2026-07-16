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
 * WAVE 3 candidate-write integrity (donor #99/#75/#4 law at the worktree write):
 *   - path IDENTITY: a candidate path must equal its own normalization, and no two candidate files may collide
 *     after case-folding (macOS/APFS is case-insensitive) — `candidate:unsafe-write-path`;
 *   - NO-FOLLOW walk: immediately before each write, every existing path component under the worktree is `lstat`ed
 *     and ANY symlink (leaf or nested) refuses; the resolved real parent directory must be byte-identical to the
 *     expected directory under the worktree's real root (a checked-out symlink dir cannot route a write out);
 *   - ATOMIC leaf create: an existing regular file is unlinked and the write goes through
 *     `O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW` — a path swapped to a symlink between check and write fails EEXIST
 *     (leaf-level race-safe). Directory components are re-verified by realpath immediately before each write; a
 *     concurrent writer INSIDE the milliseconds-old private worktree is outside the threat model and is caught
 *     after the fact by the staging-exactness check and the primary-tree isolation post-check;
 *   - EXACT staging: `git add -- <fence-validated file list>` (NEVER `-A`), then the staged set is read back via
 *     porcelain status and must equal the candidate list exactly — an unrelated/untracked/planted file can never
 *     enter the candidate commit (`candidate:staging-mismatch`);
 *   - NO PARTIAL CANDIDATE: any failure after worktree creation disposes the worktree AND deletes the just-created
 *     candidate branch (the ONLY ref mutation this module may ever perform, hard-coded to that one branch), so a
 *     failed ceremony leaves no residue and no blocked retry — and every refusal is receipted content-free.
 *
 * Everything upstream of this module stays pure; this adapter is excluded from the pure-module containment list and
 * carries its own dedicated containment tests instead.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync, lstatSync, realpathSync, unlinkSync, openSync, writeSync, closeSync, constants as FS } from 'node:fs';
import { join, dirname, resolve, normalize, sep } from 'node:path';
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
  | 'candidate:unsafe-write-path'
  | 'candidate:staging-mismatch'
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

/** Walk every EXISTING component of a candidate path under the worktree with `lstat` (never following): ANY
 *  symlink — leaf or nested — is unsafe, and a non-directory mid-component is unsafe. A missing component ends
 *  the walk (the writer will `mkdir` it fresh). Returns the offending component or null when safe. */
function unsafePathComponent(worktreeRoot: string, relPath: string): string | null {
  let cur = worktreeRoot;
  const parts = relPath.split('/');
  for (let i = 0; i < parts.length; i += 1) {
    cur = join(cur, parts[i]);
    let st;
    try { st = lstatSync(cur); } catch { return null; } // first missing component — nothing below it exists
    if (st.isSymbolicLink()) return cur;
    if (i < parts.length - 1 && !st.isDirectory()) return cur;
  }
  return null;
}

/** Failure cleanup so a refused ceremony leaves NO partial candidate: dispose the disposable worktree and delete
 *  the just-created candidate branch. Deleting THAT ONE branch is the only ref mutation this module may ever
 *  perform — the argv is hard-coded here (not routed through the general allowlist) precisely so the general
 *  surface cannot widen. Best-effort: cleanup failure never masks the original refusal. */
function cleanupFailedCandidate(repoRoot: string, worktreePath: string, branch: string): void {
  try { git(repoRoot, 'worktree', ['remove', '--force', worktreePath]); } catch { /* best-effort */ }
  try { execFileSync('git', ['-C', repoRoot, 'branch', '-D', branch], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch { /* best-effort */ }
}

export function materializeCandidate(input: MaterializeInput): CandidateMaterialization {
  const { candidate, store } = input;

  // Every refusal is receipted content-free (reason class + short candidate prefix only). Best-effort: an
  // unrecordable refusal receipt never masks the refusal itself.
  const refuse = (reasonClass: Exclude<CandidateReasonClass, 'candidate:ok'>, text: string, attemptReceiptHash: string | null = null): CandidateMaterialization => {
    let refusalReceipt: string | null = null;
    try {
      const ing = store.ingest(buildMemoryRecord({
        content: `candidate-refused · reason=${reasonClass} · candidate=${typeof candidate?.candidateId === 'string' ? candidate.candidateId.slice(0, 12) : 'n/a'}`,
        createdAt: input.nowIso, kind: 'receipt', consent: 'owner-only', provenance: 'candidate-stage',
      }));
      refusalReceipt = ing.ok ? ing.chainHash : null;
    } catch { refusalReceipt = null; }
    return { ok: false, reasonClass, text, branch: null, worktreePath: null, commitSha: null, attemptReceiptHash, receiptHash: refusalReceipt, pushed: false, merged: false, signedForOwner: false, grantsAuthority: false };
  };

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

  // 2b. PATH IDENTITY (WAVE 3): a candidate path must equal its own normalization (no `./`, `//`, trailing-slash
  //     or separator games), never contain a backslash, and no two candidate files may collide after case-folding
  //     (macOS/APFS is case-insensitive: `a/B.ts` and `a/b.ts` are the SAME file on disk).
  const seenFolded = new Set<string>();
  for (const f of candidate.files) {
    const segs = f.path.split('/');
    if (f.path.includes('\\') || f.path.endsWith('/') || normalize(f.path) !== f.path
      || segs.some((s) => s === '' || s === '.' || s === '..')) {
      return refuse('candidate:unsafe-write-path', `refused: candidate path changes identity under normalization (${f.path})`);
    }
    const folded = f.path.toLowerCase();
    if (seenFolded.has(folded)) {
      return refuse('candidate:unsafe-write-path', `refused: duplicate candidate target after case-folding (${f.path})`);
    }
    seenFolded.add(folded);
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
  mkdirSync(worktreeBase, { recursive: true });
  if (existsSync(worktreePath)) return refuse('candidate:already-materialized', 'refused: worktree path already exists', attempt.chainHash);
  try {
    git(repoRoot, 'worktree', ['add', '-b', branch, worktreePath, 'HEAD']);
  } catch (e) {
    return refuse('candidate:git-error', `refused: git worktree creation failed (${e instanceof Error ? e.message.slice(0, 160) : 'unknown'})`, attempt.chainHash);
  }
  // From here on, ANY refusal must leave no partial candidate: dispose the worktree + delete the branch.
  const refuseAndCleanup = (reasonClass: Exclude<CandidateReasonClass, 'candidate:ok'>, text: string): CandidateMaterialization => {
    cleanupFailedCandidate(repoRoot, worktreePath, branch);
    return refuse(reasonClass, text, attempt.chainHash);
  };
  try {
    // The worktree's REAL root (worktreeBase itself may sit behind e.g. /tmp → /private/tmp — resolve it once).
    const realRoot = realpathSync(worktreePath);
    for (const f of candidate.files) {
      // (a) worktree-root escape — belt over the lexical fence: the resolved target must sit strictly inside.
      const target = resolve(worktreePath, f.path);
      if (!target.startsWith(resolve(worktreePath) + sep)) {
        return refuseAndCleanup('candidate:unsafe-write-path', `refused: candidate path escapes the worktree root (${f.path})`);
      }
      // (b) NO-FOLLOW component walk immediately before the write: any symlink (leaf or nested) refuses.
      const offending = unsafePathComponent(worktreePath, f.path);
      if (offending !== null) {
        return refuseAndCleanup('candidate:unsafe-write-path', `refused: symlink or non-directory component on the write path (${f.path})`);
      }
      // (c) create parent dirs, then verify the REAL parent is byte-identical to the expected dir under the real
      //     root — a symlinked directory (pre-existing or raced in) cannot route the write elsewhere.
      mkdirSync(dirname(target), { recursive: true });
      const relDir = dirname(f.path);
      const expectedDir = relDir === '.' ? realRoot : resolve(realRoot, relDir);
      let realDir: string;
      try { realDir = realpathSync(dirname(target)); } catch { return refuseAndCleanup('candidate:unsafe-write-path', `refused: write-path parent unresolvable (${f.path})`); }
      if (realDir !== expectedDir) {
        return refuseAndCleanup('candidate:unsafe-write-path', `refused: write-path parent resolves outside its expected directory (${f.path})`);
      }
      // (d) ATOMIC leaf create: an existing REGULAR file (the checked-out original) is unlinked; anything else
      //     (dir, socket, symlink — the walk already refused symlinks) refuses. O_CREAT|O_EXCL|O_NOFOLLOW makes
      //     the create atomic: a path swapped in between check and open fails EEXIST rather than following.
      try {
        const st = lstatSync(target);
        if (!st.isFile()) return refuseAndCleanup('candidate:unsafe-write-path', `refused: existing non-regular-file at write target (${f.path})`);
        unlinkSync(target);
      } catch { /* missing leaf — a NEW file; nothing to unlink */ }
      const fd = openSync(target, FS.O_WRONLY | FS.O_CREAT | FS.O_EXCL | FS.O_NOFOLLOW, 0o644);
      try { writeSync(fd, candidate.workspace.get(f.path) as string, null, 'utf8'); } finally { closeSync(fd); }
    }
    // (e) EXACT staging — the already fence-validated file list, never `-A`; then read the staged set back and
    //     require it to equal the candidate list exactly. An unrelated/untracked/planted file can never enter.
    git(worktreePath, 'add', ['--', ...candidate.files.map((f) => f.path)]);
    const staged = git(worktreePath, 'status', ['--porcelain']).split('\n').filter(Boolean)
      .filter((line) => line[0] !== ' ' && line[0] !== '?')
      .map((line) => line.slice(3).trim())
      .sort();
    const expected = candidate.files.map((f) => f.path).sort();
    if (staged.length !== expected.length || staged.some((p, i) => p !== expected[i])) {
      return refuseAndCleanup('candidate:staging-mismatch', `refused: staged set (${staged.length}) does not equal the candidate file list (${expected.length})`);
    }
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
    return refuseAndCleanup('candidate:git-error', `refused: git materialization failed (${e instanceof Error ? e.message.slice(0, 160) : 'unknown'})`);
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
