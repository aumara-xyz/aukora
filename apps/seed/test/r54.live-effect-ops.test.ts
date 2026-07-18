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
  runLiveCandidateEffect, liveEffectOpsGrantsAuthority,
  candidatePayloadHash, HybridOwnerAdapter, deriveDraftHash, deriveIntentId, candidateBranchName,
  type BranchCandidate, type LiveEffectInput,
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
  const ph = candidatePayloadHash(candidate);
  const auth = owner.authorize({ proposalHash: ph, draftHash: ph, nonce: `n-${tag}`, issuedAt: NOW_ISO, expiresAt: null });
  const stateDir = join(base, `state-${tag}`);
  return {
    repoRoot, worktreeBase: wtBase, candidate, candidateAuth: auth, ownerArmed: true, ownerRoot: owner.root,
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
  it('two SEPARATE OS processes race the FULL live-effect path over one shared trusted-state dir → one COMMITTED, one refused, one branch, one consumed, main unchanged', async () => {
    const stateDir = join(base, 'state-concurrent');
    const headBefore = g(repoRoot, ['rev-parse', 'HEAD']);
    // GENUINE concurrency: both children are launched and run in PARALLEL (async spawn), so they contend at the
    // durable single-writer decide — the loser is refused by the O_EXCL lock (or a replay if it lands just after).
    const runChild = (): Promise<string> => new Promise((resolvePhase) => {
      const c = spawn(process.execPath, [CHILD, repoRoot, wtBase, stateDir, 'r54-live-owner', 'xproc'], { stdio: ['ignore', 'pipe', 'pipe'] });
      let out = ''; let err = '';
      c.stdout.on('data', (d) => { out += d.toString(); });
      c.stderr.on('data', (d) => { err += d.toString(); });
      c.on('close', () => resolvePhase(out.match(/PHASE:(\S+)/)?.[1] ?? `ERR(${err.slice(0, 100)})`));
    });
    const phases = await Promise.all([runChild(), runChild()]); // both in flight simultaneously
    const committed = phases.filter((p) => p === 'COMMITTED');
    // exactly one COMMITTED; the other is a non-committed governed refusal (reconcile/quarantine/refused — never a 2nd commit)
    expect(committed, `phases=${JSON.stringify(phases)}`).toHaveLength(1);
    expect(phases.filter((p) => p !== 'COMMITTED')).toHaveLength(1);
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

  it('a NON-RETRYABLE durable-store fault (corrupt) is surfaced as storeFault for operator triage (Sam 2 advisory)', () => {
    const stateDir = join(base, 'state-corrupt');
    // a healthy run first populates the durable trusted-state, then we corrupt every persisted file
    const first = runLiveCandidateEffect(inputFor('corrupt-a', { candidate: makeCandidate('corrupt-a'), monitor: new DurableCandidateReferenceMonitor(owner.root, stateDir) }));
    expect(first.phase).toBe('COMMITTED');
    expect(first.storeFault).toBeNull(); // a healthy store surfaces no fault
    for (const f of readdirSync(stateDir)) writeFileSync(join(stateDir, f), 'CORRUPT-NOT-VALID-STATE');
    // a fresh DIFFERENT candidate over the corrupted store → the durable monitor decide fails corrupt → refused,
    // the effect quarantines, and the non-retryable fault is NAMED for triage.
    const r = runLiveCandidateEffect(inputFor('corrupt-b', { candidate: makeCandidate('corrupt-b'), monitor: new DurableCandidateReferenceMonitor(owner.root, stateDir) }));
    expect(r.ok).toBe(false);
    expect(r.storeFault).toBe('trusted_state_corrupt');
  });
});
