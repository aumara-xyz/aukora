// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R54 — LIVE EffectOps adapter acceptance. Proves the effect-lifecycle coordinator (`driveEffect`) governs a REAL
 * candidate materialization over the merged primitives (Sam 2 `DurableCandidateReferenceMonitor` + hardened
 * `localCandidateStage` + `refSnapshot` + `effectAudit` + projection-only `effectSettlement`), and that:
 *   - PREPARED durably precedes Git (the durable consume is fsync'd before any git mutation);
 *   - the effect executes exactly once, then reality is observed;
 *   - a restart (durable consume survives) never blindly re-executes — it reconciles by observation;
 *   - two concurrent attempts → exactly one candidate (the durable single-writer lock refuses the loser);
 *   - a projection outage cannot describe the effect as absent (→ reconcile, not quarantine-absent);
 *   - no COMMITTED without a durable completion reference; isolation violation → quarantine;
 *   - main / protected refs are byte-unchanged.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { buildSync } from 'esbuild';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ReactiveMemoryStore } from '@aukora/brain';
import {
  runLiveCandidateEffect, liveEffectOpsGrantsAuthority, liveEffectOps, driveEffect, EffectAuditLedger, verifyIsolation,
  candidatePayloadHash, HybridOwnerAdapter, deriveDraftHash, deriveIntentId, candidateBranchName,
  type BranchCandidate, type LiveEffectInput, type EffectOps, type ProtectedSnapshot,
} from '../src/index.js';
// Protected primary-door module — deliberately NOT in the barrel; imported directly (as localCeremonyRunner does).
import { DurableCandidateReferenceMonitor } from '../src/durableCandidateMonitor.js';

const NOW_ISO = '2026-07-16T12:00:00.000Z';
const NOW_MS = Date.parse(NOW_ISO);
const g = (cwd: string, args: string[]) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();
const tryG = (cwd: string, args: string[]) => { try { return g(cwd, args); } catch { return null; } };

let base: string; let repoRoot: string; let wtBase: string; let owner: HybridOwnerAdapter; let CHILD = '';
beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), 'aukora-r54-live-'));
  repoRoot = join(base, 'repo'); wtBase = join(base, 'candidates');
  mkdirSync(join(repoRoot, 'apps/seed/src'), { recursive: true });
  execFileSync('git', ['init', '-q', '-b', 'main', repoRoot]);
  g(repoRoot, ['config', 'user.name', 'R54 Live']); g(repoRoot, ['config', 'user.email', 'r54@test.local']);
  writeFileSync(join(repoRoot, 'apps/seed/src/notes.ts'), '// original\n');
  g(repoRoot, ['add', '-A']); g(repoRoot, ['commit', '-q', '--no-gpg-sign', '-m', 'init']);
  owner = new HybridOwnerAdapter('r54-live-owner');
  // bundle the live-effect child harness to plain ESM once (bare-node spawn — Node 20 + 22, no experimental flags)
  CHILD = join(base, 'r54-live-child.mjs');
  buildSync({ entryPoints: [fileURLToPath(new URL('./r54-live-child.ts', import.meta.url))], outfile: CHILD, bundle: true, platform: 'node', format: 'esm', target: 'node18' });
});
afterAll(() => rmSync(base, { recursive: true, force: true }));

/** A distinct, valid staged candidate per test (unique candidateId → unique branch + trusted-state effect). */
function makeCandidate(tag: string): BranchCandidate {
  const candidateId = createHash('sha256').update(tag).digest('hex');
  const path = 'apps/seed/src/notes.ts';
  const newContent = `// live effect ${tag}\n`;
  // The stage re-verifies workspace content against the signed draftHash — derive the REAL hashes for the content.
  const prop = { id: 'x', targetPath: path, newContent, createdAt: '2026-01-01T00:00:00.000Z', supersedes: null };
  return {
    schema: 'aukora-branch-candidate-v1', candidateId,
    workspace: new Map([[path, newContent]]),
    files: [{ path, intentId: deriveIntentId(prop), draftHash: deriveDraftHash(prop), diff: '', receiptHash: 'ab'.repeat(32) }],
    explanation: 'r54 live', lineage: [{ intentId: deriveIntentId(prop), depth: 0 }],
    staged: true, pushed: false, signed: false, merged: false, deployed: false, grantsAuthority: false,
  } as unknown as BranchCandidate;
}

function inputFor(tag: string, over: Partial<LiveEffectInput> = {}): LiveEffectInput {
  const candidate = over.candidate ?? makeCandidate(tag);
  // The approval is HEAD-BOUND (R54 v5): the owner signs over candidatePayloadHash(candidate, approvedHead), and the
  // same approved head rides in as expectedHeadBefore — the runtime never substitutes its own observation.
  const approvedHead = over.expectedHeadBefore ?? g(over.repoRoot ?? repoRoot, ['rev-parse', 'HEAD']);
  const ph = candidatePayloadHash(candidate, approvedHead);
  const auth = owner.authorize({ proposalHash: ph, draftHash: ph, nonce: `n-${tag}`, issuedAt: NOW_ISO, expiresAt: null });
  const stateDir = join(base, `state-${tag}`);
  return {
    repoRoot, worktreeBase: wtBase, candidate, candidateAuth: auth, expectedHeadBefore: approvedHead, ownerArmed: true, ownerRoot: owner.root,
    monitor: new DurableCandidateReferenceMonitor(owner.root, stateDir),
    store: new ReactiveMemoryStore(), nowMs: NOW_MS, nowIso: NOW_ISO, ...over,
  };
}

describe('R54 live EffectOps — the one committed path over a real repo + durable monitor', () => {
  it('driveEffect materializes a real candidate → COMMITTED, main byte-unchanged, durable consume journalled', () => {
    const headBefore = g(repoRoot, ['rev-parse', 'HEAD']);
    const inp = inputFor('commit');
    const r = runLiveCandidateEffect(inp);
    expect(r.ok).toBe(true);
    expect(r.phase).toBe('COMMITTED');
    expect(r.completionRef).toMatch(/^[0-9a-f]{64}$/);            // durable completion reference present
    expect(r.stageRefusal).toBeNull();                            // the ONE materialization was not refused
    expect(r.touchedMain).toBe(false);
    expect(liveEffectOpsGrantsAuthority()).toBe(false);
    // the real candidate branch exists, main + tree are byte-identical, working tree clean
    expect(tryG(repoRoot, ['rev-parse', '--verify', '--quiet', `refs/heads/${r.candidateBranch}`])).not.toBeNull();
    expect(g(repoRoot, ['rev-parse', 'HEAD'])).toBe(headBefore);
    expect(g(repoRoot, ['status', '--porcelain'])).toBe('');
    // the durable trusted-state consumed exactly this authorization
    expect(inp.monitor.consumed().length).toBe(1);
    // audit trail is the full governed order
    expect(r.auditTrail.map((a) => a.toPhase)).toEqual(['REHEARSAL', 'PREPARED', 'EXECUTING', 'OBSERVED', 'COMMITTED']);
  });
});

describe('R54 live EffectOps — restart observes reality, never blindly re-executes', () => {
  it('a second run over the SAME durable state does NOT create a second candidate (replay-refused, reconciled)', () => {
    const inp = inputFor('restart');
    const first = runLiveCandidateEffect(inp);
    expect(first.phase).toBe('COMMITTED');
    const branchesAfterFirst = g(repoRoot, ['branch', '--list', 'candidate/*']);
    const headAfterFirst = g(repoRoot, ['rev-parse', 'HEAD']);

    // "restart": a fresh monitor over the SAME trusted-state dir (durable consume survived) re-runs the effect.
    const restart = runLiveCandidateEffect(inputFor('restart', { candidate: inp.candidate, monitor: new DurableCandidateReferenceMonitor(owner.root, join(base, 'state-restart')) }));
    // the existing candidate branch is observed → present but its original completion ref is not re-recoverable
    // this run → EXACTLY RECONCILE_REQUIRED (never COMMITTED-twice, never QUARANTINED-as-a-masking-fallback).
    expect(restart.ok).toBe(false);
    expect(restart.phase).toBe('RECONCILE_REQUIRED');
    // NO second candidate branch, main unchanged
    expect(g(repoRoot, ['branch', '--list', 'candidate/*'])).toBe(branchesAfterFirst);
    expect(g(repoRoot, ['rev-parse', 'HEAD'])).toBe(headAfterFirst);
    expect(inp.monitor.consumed().length).toBe(1); // still exactly one consumption
  });
});

describe('R54 live EffectOps — GENUINE cross-process concurrency → exactly one candidate', () => {
  it('two SEPARATE OS processes, released TOGETHER by a real barrier, race the FULL live-effect path → one COMMITTED, one replay/lock-derived loser, one branch, one consumed, main unchanged', async () => {
    const stateDir = join(base, 'state-concurrent');
    const headBefore = g(repoRoot, ['rev-parse', 'HEAD']);
    // DETERMINISTIC RENDEZVOUS (R54 v6): each child finishes ALL setup, prints READY, and blocks on the release
    // file. The parent creates it only after BOTH are ready, so both children genuinely CONTEND at the durable
    // single-writer decide — the loser loses by lock/replay, never by setup timing.
    const releasePath = join(base, 'release-concurrent');
    interface ChildOutcome { phase: string; stage: string; code: number | null; signal: string | null; err: string }
    const readiness: Array<() => void> = [];
    const bothReady = new Promise<void>((res) => { let n = 0; readiness.push(() => { n += 1; if (n === 2) res(); }); });
    const runChild = (): Promise<ChildOutcome> => new Promise((resolveOutcome) => {
      const c = spawn(process.execPath, [CHILD, repoRoot, wtBase, stateDir, 'r54-live-owner', 'xproc', releasePath], { stdio: ['ignore', 'pipe', 'pipe'] });
      let out = ''; let err = ''; let announced = false;
      c.stdout.on('data', (d) => {
        out += d.toString();
        if (!announced && out.includes('READY')) { announced = true; readiness[0](); }
      });
      c.stderr.on('data', (d) => { err += d.toString(); });
      c.on('close', (code, signal) => resolveOutcome({
        phase: out.match(/PHASE:(\S+)/)?.[1] ?? '', stage: out.match(/STAGE:(\S+)/)?.[1] ?? '', code, signal, err: err.slice(0, 200),
      }));
    });
    const racing = Promise.all([runChild(), runChild()]);
    await bothReady;                       // both children are set up and BLOCKED on the barrier
    writeFileSync(releasePath, 'go');      // ← the release: both cross into the governed effect path together
    const outcomes = await racing;
    // NEITHER child may crash or exit abnormally, and BOTH must emit an explicit governed phase.
    for (const o of outcomes) {
      expect(o.signal, `child killed by signal · err=${o.err}`).toBeNull();
      expect(o.code, `child exit code · err=${o.err}`).toBe(0);
    }
    const phases = outcomes.map((o) => o.phase);
    // exactly one COMMITTED; the LOSER must be a REPLAY/LOCK-derived reconcile — with the rendezvous in place a
    // loser can NEVER be an owner/rehearsal failure (both signed the same valid head-bound approval and both
    // passed rehearsal BEFORE the barrier released them).
    expect(phases.filter((p) => p === 'COMMITTED'), `phases=${JSON.stringify(phases)}`).toHaveLength(1);
    const loser = outcomes.find((o) => o.phase !== 'COMMITTED')!;
    // The loser's terminal is fail-closed and OBSERVATION-derived: RECONCILE_REQUIRED when it observed the
    // winner's completed branch, QUARANTINED(absent) when it observed while the winner was still mid-effect.
    // NEVER an owner/rehearsal failure — both children signed the same valid head-bound approval and passed
    // rehearsal BEFORE the barrier released them, so only the lock/replay contention can decide the loser.
    expect(['RECONCILE_REQUIRED', 'QUARANTINED'], `loser=${JSON.stringify(loser)}`).toContain(loser.phase);
    expect(['REFUSED_AT_OWNER', 'REHEARSAL_FAILED']).not.toContain(loser.phase);
    // the loser's EXACT stage refusal must be lock/replay-derived: the O_EXCL single-writer lock / the durably
    // consumed nonce (reference-monitor-refused), or the winner's branch landing first (already-materialized).
    expect(['candidate:reference-monitor-refused', 'candidate:already-materialized'], `loser stage=${loser.stage}`).toContain(loser.stage);
    // exactly ONE candidate branch FOR THIS candidate id (the repo is shared across tests), one durable consume
    const xprocBranch = candidateBranchName(makeCandidate('xproc'));
    expect(g(repoRoot, ['branch', '--list', xprocBranch]).split('\n').filter((l) => l.trim().length > 0)).toHaveLength(1);
    expect(new DurableCandidateReferenceMonitor(owner.root, stateDir).consumed().length).toBe(1);
    expect(g(repoRoot, ['rev-parse', 'HEAD'])).toBe(headBefore);
    expect(g(repoRoot, ['status', '--porcelain'])).toBe('');
    expect(g(repoRoot, ['remote'])).toBe(''); // no remote exists → nothing could push
  });
});

describe('R54 live EffectOps — projection cannot describe the effect as absent; failure modes quarantine/reconcile', () => {
  it('a projection OUTAGE at settle → RECONCILE_REQUIRED (unsettled), NEVER "absent"/quarantine — the durable consume stands', () => {
    const inp = inputFor('projfail', { project: () => false }); // simulate a Convex projection outage
    const r = runLiveCandidateEffect(inp);
    expect(r.phase).toBe('RECONCILE_REQUIRED');
    expect(r.reasonClass).toBe('coordinator:settlement-unaccepted');
    // the effect really happened (candidate + durable consume) — projection failure did not erase it
    expect(tryG(repoRoot, ['rev-parse', '--verify', '--quiet', `refs/heads/${r.candidateBranch}`])).not.toBeNull();
    expect(inp.monitor.consumed().length).toBe(1);
  });

  it('a projection sink that THROWS after the durable consume → exact RECONCILE_REQUIRED, never an escaped exception', () => {
    const inp = inputFor('projthrow', { project: () => { throw new Error('projection sink down'); } });
    const r = runLiveCandidateEffect(inp);          // must NOT throw — the sink outage is a governed unsettle
    expect(r.ok).toBe(false);
    expect(r.phase).toBe('RECONCILE_REQUIRED');
    expect(r.reasonClass).toBe('coordinator:settlement-unaccepted');
    // the durable consume + candidate stand; only the projection is unsettled (reconcile, never erased/absent)
    expect(tryG(repoRoot, ['rev-parse', '--verify', '--quiet', `refs/heads/${r.candidateBranch}`])).not.toBeNull();
    expect(inp.monitor.consumed().length).toBe(1);
    expect(r.auditTrail.map((a) => a.toPhase)).toContain('RECONCILE_REQUIRED'); // audited terminal, not an exception
  });

  it('the checkout-truth snapshot SEES uncommitted worktree bytes, index staging, and untracked files — HEAD^{tree} alone is blind to all three', () => {
    const inp = inputFor('snaptruth');
    const ops = liveEffectOps(inp, new EffectAuditLedger(), { storeFault: null, stageRefusal: null });
    const snap = () => ops.snapshotBefore() as ProtectedSnapshot;
    const clean = snap();
    const target = join(repoRoot, 'apps/seed/src/notes.ts');
    const orig = readFileSync(target, 'utf8');
    const planted = join(repoRoot, 'PLANTED.txt');
    try {
      writeFileSync(target, '// UNCOMMITTED worktree mutation\n');    // HEAD^{tree} unchanged — bytes differ
      expect(verifyIsolation(clean, snap()).ok).toBe(false);
      g(repoRoot, ['add', '--', 'apps/seed/src/notes.ts']);           // staged: an INDEX mutation
      expect(verifyIsolation(clean, snap()).ok).toBe(false);
      g(repoRoot, ['reset', '-q', '--', 'apps/seed/src/notes.ts']);
      writeFileSync(target, orig);
      writeFileSync(planted, 'untracked payload\n');                  // a planted UNTRACKED file
      expect(verifyIsolation(clean, snap()).ok).toBe(false);
      rmSync(planted);
      expect(verifyIsolation(clean, snap()).ok).toBe(true);           // fully restored ⇒ digest byte-identical again
    } finally {
      writeFileSync(target, orig); rmSync(planted, { force: true }); g(repoRoot, ['reset', '-q']);
    }
  });

  it('an UNCOMMITTED primary mutation landing DURING the effect → isolation violation → QUARANTINED, never COMMITTED', () => {
    const inp = inputFor('mutmid');
    const audit = new EffectAuditLedger();
    const ops = liveEffectOps(inp, audit, { storeFault: null, stageRefusal: null });
    const target = join(repoRoot, 'apps/seed/src/notes.ts');
    const orig = readFileSync(target, 'utf8');
    // The real effect runs clean (branch + durable consume), then an uncommitted primary mutation lands BEFORE the
    // after-snapshot — the honest recapture must catch it and the run must NEVER be credited COMMITTED.
    const hostile: EffectOps = {
      ...ops,
      runGitEffect: (id) => {
        const o = ops.runGitEffect(id);
        writeFileSync(target, '// PLANTED mid-effect, never committed\n');
        return { ...o, snapshotAfter: ops.snapshotBefore() };
      },
    };
    try {
      const r = driveEffect(hostile);
      expect(r.ok).toBe(false);
      expect(r.phase).toBe('QUARANTINED');
      expect(r.reasonClass).toBe('coordinator:isolation-violated');
    } finally {
      writeFileSync(target, orig);
    }
    // the durable consume DID happen (the effect ran) — quarantine hands it to the owner, it never reports clean
    expect(inp.monitor.consumed().length).toBe(1);
  });

  it('a FORGED (non-undefined, one-nibble-flipped signature) authorization refuses at the owner gate BEFORE EXECUTING/audit/Git — no consume, no branch', () => {
    const good = inputFor('forged');
    const auth = good.candidateAuth!;              // 'forged' always builds a present, valid-shaped authorization
    const sig = auth.signatures.ed25519;
    const forged = { ...auth, signatures: { ...auth.signatures, ed25519: (sig[0] === 'a' ? 'b' : 'a') + sig.slice(1) } };
    const r = runLiveCandidateEffect({ ...good, candidateAuth: forged });
    expect(r.ok).toBe(false);
    expect(r.phase).toBe('REFUSED_AT_OWNER');
    // refused at the gate: the audit trail STOPS at REHEARSAL — EXECUTING/PREPARED were never recorded
    expect(r.auditTrail.map((a) => a.toPhase)).not.toContain('EXECUTING');
    expect(r.auditTrail.map((a) => a.toPhase)).not.toContain('PREPARED');
    // no durable consume, no candidate branch, no git effect
    expect(good.monitor.consumed().length).toBe(0);
    expect(tryG(repoRoot, ['rev-parse', '--verify', '--quiet', `refs/heads/${candidateBranchName(good.candidate as never)}`])).toBeNull();
  });

  it('an ABSENT owner authorization → refused at the owner gate; no git, no durable consume', () => {
    const inp = inputFor('noauth', { candidateAuth: undefined });
    const r = runLiveCandidateEffect(inp);
    expect(r.ok).toBe(false);
    expect(r.phase).toBe('REFUSED_AT_OWNER');
    expect(inp.monitor.consumed().length).toBe(0);
  });

  it('a HOSTILE pre-existing candidate/<id> branch (right NAME, forged content) is NEVER credited as the effect — fail closed', () => {
    const candidate = makeCandidate('hostile');
    const branch = candidateBranchName(candidate);
    // an attacker squats the branch NAME pointing at a commit with the WRONG content (the original, not the candidate)
    execFileSync('git', ['-C', repoRoot, 'branch', branch, 'HEAD']);
    try {
      const inp = inputFor('hostile', { candidate, monitor: new DurableCandidateReferenceMonitor(owner.root, join(base, 'state-hostile')) });
      const r = runLiveCandidateEffect(inp);
      // the reconcile/observe path verifies CONTENT identity → the squat mismatches → candidatePresent=false →
      // QUARANTINED (candidate-absent). The forged branch is never COMMITTED, and no durable authority is consumed.
      expect(r.phase).not.toBe('COMMITTED');
      expect(r.phase).toBe('QUARANTINED');
      expect(inp.monitor.consumed().length).toBe(0);
    } finally {
      execFileSync('git', ['-C', repoRoot, 'branch', '-D', branch]); // clean the squat so other tests' counts are unaffected
    }
  });

  it('a candidate/<id> with the RIGHT content over the RIGHT base but ONE EXTRA unauthorized change is NEVER credited — exact change-set identity fails closed', () => {
    const candidate = makeCandidate('extra');
    const branch = candidateBranchName(candidate);
    const wt = mkdtempSync(join(tmpdir(), 'aukora-r54-squat-extra-'));
    // build candidate/<id> at HEAD carrying the authorized content PLUS one unauthorized extra file, then dispose wt
    execFileSync('git', ['-C', repoRoot, 'worktree', 'add', '-q', '-b', branch, wt, 'HEAD']);
    try {
      writeFileSync(join(wt, 'apps/seed/src/notes.ts'), '// live effect extra\n');            // the authorized content
      writeFileSync(join(wt, 'apps/seed/src/EXTRA.ts'), '// unauthorized piggy-backed change\n'); // + an extra change
      g(wt, ['add', '-A']); g(wt, ['commit', '-q', '--no-gpg-sign', '-m', 'candidate+extra']);
      execFileSync('git', ['-C', repoRoot, 'worktree', 'remove', '--force', wt]);
      const inp = inputFor('extra', { candidate, monitor: new DurableCandidateReferenceMonitor(owner.root, join(base, 'state-extra')) });
      const r = runLiveCandidateEffect(inp);
      // materialize refuses (branch already exists) → observe reality: base→branch changes {notes.ts, EXTRA.ts} ≠
      // the authorized {notes.ts} → candidatePresent=false → QUARANTINED, never COMMITTED, no durable consume.
      expect(r.phase).toBe('QUARANTINED');
      expect(inp.monitor.consumed().length).toBe(0);
    } finally {
      if (existsSync(wt)) execFileSync('git', ['-C', repoRoot, 'worktree', 'remove', '--force', wt]);
      tryG(repoRoot, ['branch', '-D', branch]);
    }
  });

  it('a candidate/<id> with the RIGHT content over the WRONG base is NEVER credited — base binding fails closed', () => {
    const candidate = makeCandidate('wrongbase');
    const branch = candidateBranchName(candidate);
    const wt = mkdtempSync(join(tmpdir(), 'aukora-r54-squat-base-'));
    execFileSync('git', ['-C', repoRoot, 'worktree', 'add', '-q', '--detach', wt, 'HEAD']);
    try {
      // a side base commit (NOT equal to repo HEAD), then the authorized candidate content committed ON TOP of it →
      // candidate/<id>'s parent is the side base, not the authorized HEAD.
      writeFileSync(join(wt, 'apps/seed/src/notes.ts'), '// unrelated side base\n');
      g(wt, ['add', '-A']); g(wt, ['commit', '-q', '--no-gpg-sign', '-m', 'side-base']);
      writeFileSync(join(wt, 'apps/seed/src/notes.ts'), '// live effect wrongbase\n');       // the authorized content
      g(wt, ['add', '-A']); g(wt, ['commit', '-q', '--no-gpg-sign', '-m', 'candidate-on-wrong-base']);
      const wrongCommit = g(wt, ['rev-parse', 'HEAD']);
      execFileSync('git', ['-C', repoRoot, 'branch', branch, wrongCommit]); // candidate/<id> → the wrong-base commit
      execFileSync('git', ['-C', repoRoot, 'worktree', 'remove', '--force', wt]);
      const inp = inputFor('wrongbase', { candidate, monitor: new DurableCandidateReferenceMonitor(owner.root, join(base, 'state-wrongbase')) });
      const r = runLiveCandidateEffect(inp);
      // observe reality: parent(candidate) = side-base ≠ authorizedBase(HEAD) → candidatePresent=false → QUARANTINED.
      expect(r.phase).toBe('QUARANTINED');
      expect(inp.monitor.consumed().length).toBe(0);
    } finally {
      if (existsSync(wt)) execFileSync('git', ['-C', repoRoot, 'worktree', 'remove', '--force', wt]);
      tryG(repoRoot, ['branch', '-D', branch]);
    }
  });

  // R54 v5 STALE-APPROVAL ACCEPTANCE — the owner's approval binds a BASE, in the SIGNED BYTES and at the stage.
  // A dedicated repo so advancing HEAD cannot poison the shared fixture.
  describe('stale approval: sign at HEAD A → advance to unrelated B → same signed authorization', () => {
    let staleBase = ''; let staleRepo = ''; let staleWt = ''; let headA = ''; let headB = '';
    beforeAll(() => {
      staleBase = mkdtempSync(join(tmpdir(), 'aukora-r54-stale-'));
      staleRepo = join(staleBase, 'repo'); staleWt = join(staleBase, 'candidates');
      mkdirSync(join(staleRepo, 'apps/seed/src'), { recursive: true });
      execFileSync('git', ['init', '-q', '-b', 'main', staleRepo]);
      g(staleRepo, ['config', 'user.name', 'R54 Stale']); g(staleRepo, ['config', 'user.email', 'stale@test.local']);
      writeFileSync(join(staleRepo, 'apps/seed/src/notes.ts'), '// original\n');
      g(staleRepo, ['add', '-A']); g(staleRepo, ['commit', '-q', '--no-gpg-sign', '-m', 'A']);
      headA = g(staleRepo, ['rev-parse', 'HEAD']); // ← the base the owner approves against
      writeFileSync(join(staleRepo, 'apps/seed/src/unrelated.ts'), '// unrelated later work\n');
      g(staleRepo, ['add', '-A']); g(staleRepo, ['commit', '-q', '--no-gpg-sign', '-m', 'B']);
      headB = g(staleRepo, ['rev-parse', 'HEAD']); // ← main/HEAD advanced AFTER the approval was signed
    });
    afterAll(() => rmSync(staleBase, { recursive: true, force: true }));

    it('EXACT stale-head refusal BEFORE the durable consume — zero consume, no candidate branch, no Git effect', () => {
      const inp = inputFor('stale', { repoRoot: staleRepo, worktreeBase: staleWt, expectedHeadBefore: headA });
      const r = runLiveCandidateEffect(inp);
      expect(r.ok).toBe(false);
      expect(r.stageRefusal).toBe('candidate:stale-head');       // the EXACT refusal, not just a terminal phase
      expect(r.phase).toBe('QUARANTINED');                        // fail-closed terminal; never COMMITTED
      expect(r.completionRef).toBeNull();
      // BEFORE the durable consume: the stage's head-binding precheck refused prior to decide() → nothing consumed
      expect(inp.monitor.consumed().length).toBe(0);
      // no Git effect of any kind
      expect(tryG(staleRepo, ['rev-parse', '--verify', '--quiet', `refs/heads/${candidateBranchName(inp.candidate)}`])).toBeNull();
      expect(g(staleRepo, ['rev-parse', 'HEAD'])).toBe(headB);
      expect(g(staleRepo, ['status', '--porcelain'])).toBe('');
    });

    it('a runtime CLAIMING the moved head (expectedHeadBefore=B) cannot dodge the check — the SIGNED bytes bind base A → refused at the owner gate', () => {
      const signedAtA = inputFor('stale-forge', { repoRoot: staleRepo, worktreeBase: staleWt, expectedHeadBefore: headA });
      // attacker substitutes the CURRENT head to satisfy the stage precheck; the signature stays bound to A
      const r = runLiveCandidateEffect({ ...signedAtA, expectedHeadBefore: headB });
      expect(r.ok).toBe(false);
      expect(r.phase).toBe('REFUSED_AT_OWNER');                   // payload hash over B ≠ signed hash over A
      expect(r.auditTrail.map((a) => a.toPhase)).not.toContain('EXECUTING');
      expect(r.auditTrail.map((a) => a.toPhase)).not.toContain('PREPARED');
      expect(signedAtA.monitor.consumed().length).toBe(0);
      expect(tryG(staleRepo, ['rev-parse', '--verify', '--quiet', `refs/heads/${candidateBranchName(signedAtA.candidate)}`])).toBeNull();
    });

    it('a HEAD-FREE (unbound) signature can never drive the live path — runtime observation alone is insufficient', () => {
      const candidate = makeCandidate('headfree');
      const phUnbound = candidatePayloadHash(candidate); // legacy /1 bytes: no base bound into the signature
      const auth = owner.authorize({ proposalHash: phUnbound, draftHash: phUnbound, nonce: 'n-headfree', issuedAt: NOW_ISO, expiresAt: null });
      const inp = inputFor('headfree', { candidate, candidateAuth: auth }); // live path always supplies expectedHeadBefore
      const r = runLiveCandidateEffect(inp);
      expect(r.ok).toBe(false);
      expect(r.phase).toBe('REFUSED_AT_OWNER');                   // head-bound payload ≠ the unbound signed bytes
      expect(inp.monitor.consumed().length).toBe(0);
      expect(tryG(repoRoot, ['rev-parse', '--verify', '--quiet', `refs/heads/${candidateBranchName(candidate)}`])).toBeNull();
    });
  });

  // A staged candidate carries a PASSED rehearsal only when EVERY file has a real receiptHash. Three ways that can
  // fail — a blank receipt, an absent (undefined) receipt, and a candidate with NO files — must ALL be a
  // REHEARSAL_FAILED refusal: never a pass, never an EXECUTING/PREPARED transition, never a durable consume.
  const rehearsalRefusals: ReadonlyArray<{ label: string; mutate: (b: BranchCandidate) => BranchCandidate }> = [
    { label: 'a BLANK ("") rehearsal receipt', mutate: (b) => ({ ...b, files: b.files.map((f, i) => (i === 0 ? { ...f, receiptHash: '' } : f)) } as unknown as BranchCandidate) },
    { label: 'an ABSENT (undefined) rehearsal receipt', mutate: (b) => ({ ...b, files: b.files.map((f, i) => (i === 0 ? { ...f, receiptHash: undefined } : f)) } as unknown as BranchCandidate) },
    { label: 'an EMPTY candidate (no files at all)', mutate: (b) => ({ ...b, files: [] } as unknown as BranchCandidate) },
  ];
  for (const { label, mutate } of rehearsalRefusals) {
    it(`${label} → REHEARSAL_FAILED (never a pass, no EXECUTING/PREPARED, no durable consume, no branch)`, () => {
      const tag = `rehfail-${label.replace(/\W+/g, '-')}`;
      const candidate = mutate(makeCandidate(tag));
      const inp = inputFor(tag, { candidate });
      const r = runLiveCandidateEffect(inp);
      expect(r.phase).toBe('REHEARSAL_FAILED');
      expect(r.auditTrail.map((a) => a.toPhase)).not.toContain('EXECUTING');
      expect(r.auditTrail.map((a) => a.toPhase)).not.toContain('PREPARED');
      expect(inp.monitor.consumed().length).toBe(0);
      expect(tryG(repoRoot, ['rev-parse', '--verify', '--quiet', `refs/heads/${candidateBranchName(candidate)}`])).toBeNull();
    });
  }

  it('a NON-RETRYABLE durable-store fault (corrupt) → EXACTLY QUARANTINED, no branch/git effect, surfaced as storeFault (Sam 2 advisory)', () => {
    const stateDir = join(base, 'state-corrupt');
    const headBefore = g(repoRoot, ['rev-parse', 'HEAD']);
    // a healthy run first populates the durable trusted-state, then we corrupt every persisted file
    const first = runLiveCandidateEffect(inputFor('corrupt-a', { candidate: makeCandidate('corrupt-a'), monitor: new DurableCandidateReferenceMonitor(owner.root, stateDir) }));
    expect(first.phase).toBe('COMMITTED');
    expect(first.storeFault).toBeNull(); // a healthy store surfaces no fault
    for (const f of readdirSync(stateDir)) writeFileSync(join(stateDir, f), 'CORRUPT-NOT-VALID-STATE');
    // a fresh DIFFERENT candidate over the corrupted store → the durable monitor decide fails corrupt → refused,
    // the effect quarantines, and the non-retryable fault is NAMED for triage.
    const candB = makeCandidate('corrupt-b');
    const r = runLiveCandidateEffect(inputFor('corrupt-b', { candidate: candB, monitor: new DurableCandidateReferenceMonitor(owner.root, stateDir) }));
    expect(r.ok).toBe(false);
    expect(r.phase).toBe('QUARANTINED');                 // exact terminal — the store fault never masquerades as present
    expect(r.storeFault).toBe('trusted_state_corrupt');
    // NO git effect: the corrupt-b candidate branch was never created, HEAD + working tree are byte-unchanged
    expect(tryG(repoRoot, ['rev-parse', '--verify', '--quiet', `refs/heads/${candidateBranchName(candB)}`])).toBeNull();
    expect(g(repoRoot, ['rev-parse', 'HEAD'])).toBe(headBefore);
    expect(g(repoRoot, ['status', '--porcelain'])).toBe('');
  });
});
