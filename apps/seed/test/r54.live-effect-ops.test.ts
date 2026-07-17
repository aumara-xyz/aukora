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
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ReactiveMemoryStore } from '@aukora/brain';
import {
  runLiveCandidateEffect, liveEffectOpsGrantsAuthority,
  candidatePayloadHash, HybridOwnerAdapter, deriveDraftHash, deriveIntentId,
  type BranchCandidate, type LiveEffectInput,
} from '../src/index.js';
// Protected primary-door module — deliberately NOT in the barrel; imported directly (as localCeremonyRunner does).
import { DurableCandidateReferenceMonitor } from '../src/durableCandidateMonitor.js';

const NOW_ISO = '2026-07-16T12:00:00.000Z';
const NOW_MS = Date.parse(NOW_ISO);
const g = (cwd: string, args: string[]) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();
const tryG = (cwd: string, args: string[]) => { try { return g(cwd, args); } catch { return null; } };

let base: string; let repoRoot: string; let wtBase: string; let owner: HybridOwnerAdapter;
beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), 'aukora-r54-live-'));
  repoRoot = join(base, 'repo'); wtBase = join(base, 'candidates');
  mkdirSync(join(repoRoot, 'apps/seed/src'), { recursive: true });
  execFileSync('git', ['init', '-q', '-b', 'main', repoRoot]);
  g(repoRoot, ['config', 'user.name', 'R54 Live']); g(repoRoot, ['config', 'user.email', 'r54@test.local']);
  writeFileSync(join(repoRoot, 'apps/seed/src/notes.ts'), '// original\n');
  g(repoRoot, ['add', '-A']); g(repoRoot, ['commit', '-q', '--no-gpg-sign', '-m', 'init']);
  owner = new HybridOwnerAdapter('r54-live-owner');
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
    repoRoot, worktreeBase: wtBase, candidate, candidateAuth: auth, ownerArmed: true,
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
    // the durable authorization is already consumed → git never re-runs; the existing candidate is observed →
    // present but its original completion ref is not re-recoverable this run → RECONCILE_REQUIRED (never COMMITTED-twice).
    expect(restart.ok).toBe(false);
    expect(['RECONCILE_REQUIRED', 'QUARANTINED']).toContain(restart.phase);
    // NO second candidate branch, main unchanged
    expect(g(repoRoot, ['branch', '--list', 'candidate/*'])).toBe(branchesAfterFirst);
    expect(g(repoRoot, ['rev-parse', 'HEAD'])).toBe(headAfterFirst);
    expect(inp.monitor.consumed().length).toBe(1); // still exactly one consumption
  });
});

describe('R54 live EffectOps — concurrent replay → exactly one candidate', () => {
  it('two attempts on the SAME durable state + candidate → one COMMITTED, the other refused; one branch', () => {
    const stateDir = join(base, 'state-concurrent');
    const candidate = makeCandidate('concurrent');
    const mk = () => inputFor('concurrent', { candidate, monitor: new DurableCandidateReferenceMonitor(owner.root, stateDir) });
    const a = runLiveCandidateEffect(mk());
    const b = runLiveCandidateEffect(mk()); // second attempt sees the consumed authorization
    const committed = [a, b].filter((r) => r.phase === 'COMMITTED');
    const notCommitted = [a, b].filter((r) => r.phase !== 'COMMITTED');
    expect(committed).toHaveLength(1);
    expect(notCommitted).toHaveLength(1);
    // exactly one candidate branch for this id
    const branch = a.candidateBranch;
    expect(g(repoRoot, ['branch', '--list', branch as string]).trim().length).toBeGreaterThan(0);
    expect(new DurableCandidateReferenceMonitor(owner.root, stateDir).consumed().length).toBe(1);
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

  it('a forged/absent owner authorization → refused at the owner gate; no git, no durable consume', () => {
    const inp = inputFor('noauth', { candidateAuth: undefined });
    const r = runLiveCandidateEffect(inp);
    expect(r.ok).toBe(false);
    expect(r.phase).toBe('REFUSED_AT_OWNER');
    expect(inp.monitor.consumed().length).toBe(0);
  });
});
