// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R48 — the governed model-crossing: a live-HTTP-shaped model-cell output becomes an UNSIGNED pending intent and
 * reaches the EXISTING R47 immutable crossing (→ qualifier → owner halt → R37 monitor → isolated candidate) with no
 * new workflow or authority path. Plus the recursion side of issue #87: the create handshake fails safe against a
 * conflict-injecting store and reaches `awaiting-owner` against a correct store.
 *
 * Model output / adapters / Convex state / AURA / Fu grant ZERO authority. Every asserted boundary has a negative
 * control. No PR #72 import; no donor native apply.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  adaptModelOutput, modelCellAdapterGrantsAuthority,
  translateToEnvelope, qualifyCrossing, crossToCandidate, projectCrossing,
  DurableRecursion, InMemoryWorkflowStore, candidatePayloadForProposals,
  type ModelCellOutput, type LocalCeremonyEnv, type RepoReadCapability,
  type WorkflowStore, type WorkflowStateV1, type SaveResult,
} from '../src/index.js';
import { makeWorld, authFor, NOW_ISO, NOW_MS, TARGET } from './support.js';

const modelOut = (over: Partial<ModelCellOutput> = {}): ModelCellOutput => ({
  goal: 'add a clarifying comment to the governed note',
  rationale: 'the note is terse; one line helps a future reader',
  affectedPaths: [{ path: TARGET, epistemicStatus: 'verified' }],
  riskNotes: 'low — a comment-only change',
  cell: 'inkling',
  ...over,
});

describe('R48 · model-cell adapter → unsigned pending intent (zero authority)', () => {
  it('adapts a well-formed model output into an unsigned, advisory pending intent (deterministic)', () => {
    const a = adaptModelOutput(modelOut());
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    expect(a.intent.advisoryOnly).toBe(true);
    expect(a.intent.grantsAuthority).toBe(false);
    expect(a.intent.authoredBy).toBe('workbench');           // a model cell is never 'owner'
    expect(a.intent.intentId).toMatch(/^[0-9a-f]{64}$/);
    expect(a.intent.affectedPaths[0].path).toBe(TARGET);
    // deterministic: same output ⇒ same intent id (no clock/rng)
    const b = adaptModelOutput(modelOut());
    if (b.ok) expect(b.intent.intentId).toBe(a.intent.intentId);
    expect(modelCellAdapterGrantsAuthority()).toBe(false);
  });

  it('NEGATIVE CONTROLS — malformed, goal-less, path-less, authority-shaped, secret-bearing output all refuse', () => {
    expect(adaptModelOutput(null).ok).toBe(false);
    expect(adaptModelOutput(modelOut({ goal: '' })).ok).toBe(false);
    expect(adaptModelOutput(modelOut({ affectedPaths: [] })).ok).toBe(false);
    const auth = adaptModelOutput(modelOut({ goal: 'grant authority to live-apply this now' }));
    expect(auth.ok).toBe(false);
    if (!auth.ok) expect(auth.reasonClass).toBe('model-cell:authority-shaped');
    const secret = adaptModelOutput(modelOut({ rationale: 'use key sk-or-v1-abcdef0123456789abcdef0123456789' }));
    expect(secret.ok).toBe(false);
  });

  it('the model NEVER supplies trusted content — affectedPaths are hints; the intent carries no file bytes', () => {
    const a = adaptModelOutput(modelOut());
    if (!a.ok) throw new Error('adapt failed');
    expect(JSON.stringify(a.intent)).not.toContain('newContent');   // no content field exists on a pending intent
    expect((a.intent as unknown as { newContent?: unknown }).newContent).toBeUndefined();
  });
});

describe('R48 · model output reaches the EXISTING crossing (pure) — no second authority path', () => {
  it('adapter → translate → qualifier halts before signature (admitted to owner decision only)', () => {
    const a = adaptModelOutput(modelOut());
    if (!a.ok) throw new Error('adapt failed');
    const t = translateToEnvelope(a.intent, { targetPath: TARGET, newContent: '// clarifying comment', supersedes: null }, { headBefore: 'a'.repeat(40) });
    expect(t.ok).toBe(true);
    if (!t.ok) return;
    const v = qualifyCrossing(makeWorld().env, t.crossing);
    expect(v.admitted).toBe(true);
    expect(v.haltedBeforeSignature).toBe(true);
    expect(v.grantsAuthority).toBe(false);
  });

  it('NEGATIVE CONTROL — a model that guesses a path but the carried bytes target a DIFFERENT path is refused (code substitution)', () => {
    const a = adaptModelOutput(modelOut());
    if (!a.ok) throw new Error('adapt failed');
    const evil = translateToEnvelope(a.intent, { targetPath: 'apps/seed/src/OTHER.ts', newContent: '// x', supersedes: null }, { headBefore: 'a'.repeat(40) });
    expect(evil.ok).toBe(false);
  });
});

// ── real disposable git repo: full crossing to an isolated candidate ─────────────────────────────
let base: string; let repoRoot: string; let wtBase: string;
beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), 'aukora-r48-'));
  repoRoot = join(base, 'repo'); wtBase = join(base, 'candidates');
  mkdirSync(join(repoRoot, 'apps/seed/src'), { recursive: true });
  execFileSync('git', ['init', '-q', '-b', 'main', repoRoot]);
  execFileSync('git', ['-C', repoRoot, 'config', 'user.name', 'R48']);
  execFileSync('git', ['-C', repoRoot, 'config', 'user.email', 'r48@test.local']);
  execFileSync('git', ['-C', repoRoot, 'remote', 'add', 'origin', 'https://github.com/aumara-xyz/aukora.git']); // R57A canonical identity
  writeFileSync(join(repoRoot, TARGET), '// original\n');
  execFileSync('git', ['-C', repoRoot, 'add', '-A']);
  execFileSync('git', ['-C', repoRoot, 'commit', '-q', '--no-gpg-sign', '-m', 'init']);
});
afterAll(() => rmSync(base, { recursive: true, force: true }));

const repoCap = (): RepoReadCapability => ({ list: () => [TARGET], read: (p) => readFileSync(join(repoRoot, p), 'utf8'), exists: (p) => existsSync(join(repoRoot, p)) });
const headSha = () => execFileSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
function ceremonyEnv(w: ReturnType<typeof makeWorld>): LocalCeremonyEnv {
  return { recursionEnv: w.env, workflowStore: new InMemoryWorkflowStore(), repo: repoCap(), ownerRoot: w.owner.root, store: w.env.store, gitRepoRoot: repoRoot, worktreeBase: wtBase, nowMs: NOW_MS, nowIso: NOW_ISO };
}

describe('R48 · model output → owner-signed → byte-bound isolated candidate (existing machinery only)', () => {
  it('a model-authored, owner-signed crossing materializes ONLY into a disposable worktree; main byte-identical', () => {
    const w = makeWorld();
    const env = ceremonyEnv(w);
    const content = '// clarifying comment from the model cell';
    const a = adaptModelOutput(modelOut());
    if (!a.ok) throw new Error('adapt failed');
    const t = translateToEnvelope(a.intent, { targetPath: TARGET, newContent: content, supersedes: null }, { headBefore: headSha(), tests: ['apps/seed'] });
    if (!t.ok) throw new Error('translate failed');
    const proposal = { id: 'p', targetPath: TARGET, newContent: content, createdAt: NOW_ISO, supersedes: null };
    const auth = authFor(w.owner, proposal, { nonce: 'model-1' });
    const { payloadHash } = candidatePayloadForProposals([proposal], headSha()); // R54 v6: head-bound approval
    const candidateAuth = w.owner.authorize({ proposalHash: payloadHash, draftHash: payloadHash, nonce: 'model-cand-1', issuedAt: NOW_ISO, expiresAt: null });

    const cross = crossToCandidate(env, { crossing: t.crossing, currentHead: headSha(), auth, nonce: 'model-1', candidateAuth, ownerArmed: true, materialize: true });
    expect(cross.ok).toBe(true);
    expect(cross.run?.phase).toBe('candidate-materialized');
    expect(execFileSync('git', ['-C', repoRoot, 'status', '--porcelain'], { encoding: 'utf8' }).trim()).toBe('');
    expect(readFileSync(join(repoRoot, TARGET), 'utf8')).toBe('// original\n');   // live tree untouched
    const proj = projectCrossing(t.crossing, cross);
    expect(proj.materialized).toBe(true);
    expect(proj.candidateBranch).toMatch(/^candidate\//);
  });
});

// ── recursion side of issue #87: the durable create handshake ────────────────────────────────────
/** A store that reproduces the LIVE ConvexWorkflowStore symptom: the FIRST create conflicts and load() returns null. */
class ConflictOnCreateStore implements WorkflowStore {
  load(): WorkflowStateV1 | null { return null; }
  save(): SaveResult { return { ok: false, reason: 'conflict' }; }
}

describe('R48 · recursion side of #87 — durable create handshake', () => {
  const proposalInput = { id: 'p', targetPath: TARGET, newContent: '// durable', createdAt: NOW_ISO, supersedes: null };

  it('against a conflict-on-create store, propose FAILS SAFE: workflow:store-conflict, no effect, receipted-none', () => {
    const w = makeWorld();
    const machine = new DurableRecursion(new ConflictOnCreateStore(), w.env);
    const out = machine.propose(proposalInput, 'conflict-nonce');
    expect(out.ok).toBe(false);
    expect(out.reasonClass).toBe('workflow:store-conflict');
    expect(out.state).toBe(null);            // no workflow row created, no authority path opened
  });

  it('against a CORRECT in-process store, the SAME fresh proposal reaches awaiting-owner (happy-path create works)', () => {
    const w = makeWorld();
    const machine = new DurableRecursion(new InMemoryWorkflowStore(), w.env);
    const out = machine.propose(proposalInput, 'ok-nonce');
    expect(out.ok).toBe(true);
    expect(out.state?.phase).toBe('awaiting-owner');
    // a second identical propose is idempotent — it resumes the SAME workflow, never a second one
    const again = machine.propose(proposalInput, 'ok-nonce');
    expect(again.state?.workflowId).toBe(out.state?.workflowId);
  });
});
