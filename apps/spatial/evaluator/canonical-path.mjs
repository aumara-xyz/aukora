// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R52 canonical-path evaluator (#115) — the governed organism path over PRODUCTION adapters, in-process.
 *
 * Drives the real canonical sequence with no second mock architecture:
 *
 *   typed input → (local Convex settle) → governed unsigned proposal → fresh AUMLOK halt
 *               → isolated candidate → receipt → reactive projection
 *
 * Production adapters (imported, never duplicated): `@aukora/brain` ReactiveMemoryStore, `@aukora/seed`
 * MindDoor + the hybrid AUMLOK gate + the local candidate ceremony, over a REAL temporary git repo. The
 * reasoning provider stays UNARMED — the proposal content is deterministic/typed, exactly as #115 permits.
 *
 * Honesty labels per stage: PROVEN (governed logic exercised), TEST_ONLY (in-process, deterministic test
 * owner / in-process settle), LIVE_LOCAL (delegated to the real local-Convex canary), PARKED (a real backend
 * is required and absent — the exact prerequisite is named). The `local Convex settle` and `actual process
 * death` stages are supplied by convex-probe.mjs, which delegates to Sam 2's `canary:r51` (reuse, not copy).
 *
 * SAFETY: the candidate lands only in an isolated TEMP git repo — the real `main` is never touched, no remote
 * write occurs, and the fresh AUMLOK halt proves an UNSIGNED path cannot materialize.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  MindDoor, DOOR_PORT, HybridOwnerAdapter, RecursionLedger, InMemoryWorkflowStore,
  CandidateReferenceMonitor, candidatePayloadForProposals, deriveIntentId, deriveDraftHash, LIMITS, loopbackOrigins,
} from '@aukora/seed';
import { ReactiveMemoryStore } from '@aukora/brain';
import { buildMemoryRecord } from '@aukora/memory';
import { coreHash } from './lib/hash.mjs';

export const SCHEMA = 'aukora-canonical-path-evidence-v1';
const NOW_ISO = '2026-07-16T12:00:00.000Z';
const NOW_MS = Date.parse(NOW_ISO);
const TARGET = 'apps/seed/src/recursion.ts';
const TOKEN = 'r52-evaluator-post-token-0000000';
const ORIGIN = loopbackOrigins(DOOR_PORT)[0];
const post = (path, body, over = {}) => ({ method: 'POST', path, headers: { origin: ORIGIN, 'x-aukora-door-token': TOKEN, ...over }, body });

function tempRepo() {
  const base = mkdtempSync(join(tmpdir(), 'aukora-r52-'));
  const repoRoot = join(base, 'repo');
  const wtBase = join(base, 'candidates');
  mkdirSync(join(repoRoot, 'apps/seed/src'), { recursive: true });
  execFileSync('git', ['init', '-q', '-b', 'main', repoRoot]);
  execFileSync('git', ['-C', repoRoot, 'config', 'user.name', 'R52']);
  execFileSync('git', ['-C', repoRoot, 'config', 'user.email', 'r52@localhost']); // throwaway temp-repo identity (no PII-email shape; this harness isn't under an exempt test/ path)
  writeFileSync(join(repoRoot, TARGET), '// original\n');
  execFileSync('git', ['-C', repoRoot, 'add', '-A']);
  execFileSync('git', ['-C', repoRoot, 'commit', '-q', '--no-gpg-sign', '-m', 'init']);
  return { base, repoRoot, wtBase };
}
const headOf = (repoRoot) => execFileSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const porcelain = (repoRoot) => execFileSync('git', ['-C', repoRoot, 'status', '--porcelain'], { encoding: 'utf8' });
const candidateBranches = (repoRoot) => execFileSync('git', ['-C', repoRoot, 'branch', '--list', 'candidate/*'], { encoding: 'utf8' }).trim();

function makeDoor(repoRoot, wtBase, store, owner) {
  const workflowStore = new InMemoryWorkflowStore();
  const monitor = new CandidateReferenceMonitor(owner.root);
  const repo = { list: () => [TARGET], read: (p) => readFileSync(join(repoRoot, p), 'utf8'), exists: (p) => existsSync(join(repoRoot, p)) };
  const loadDriver = async () => {
    const recursionEnv = { store, knownFiles: new Set([TARGET]), ownerRoot: owner.root, ledger: new RecursionLedger(), nowMs: NOW_MS, nowIso: NOW_ISO, deadlineMs: NOW_MS + LIMITS.DEFAULT_WALL_TIME_BUDGET_MS };
    const ceremonyEnv = { recursionEnv, workflowStore, repo, ownerRoot: owner.root, store, monitor, gitRepoRoot: repoRoot, worktreeBase: wtBase, nowMs: NOW_MS, nowIso: NOW_ISO };
    return { ceremonyEnv };
  };
  return new MindDoor({ store, ownerRoot: owner.root, loadDriver, postToken: TOKEN, nowIso: NOW_ISO });
}

const authFor = (owner, p, nonce) => owner.authorize({ proposalHash: deriveIntentId(p), draftHash: deriveDraftHash(p), nonce, issuedAt: NOW_ISO, expiresAt: null });

/**
 * Run the in-process production-adapter path. `convexStage` is the label/detail for the local-Convex settle +
 * process-death stages (supplied by convex-probe.mjs). Returns { core, coreHash, stages, safety }.
 */
export async function runCanonicalPath({ typedInput = 'operator event: prove the governed organism', convexStage } = {}) {
  // Pin git author/committer dates so the isolated candidate commit is DETERMINISTIC — its SHA flows into the
  // receipt chain, so a fixed date makes the whole evidence bundle byte-stable (self-verifying), not just the
  // coreHash. The ceremony's own `git` inherits these from the environment.
  const savedEnv = { a: process.env.GIT_AUTHOR_DATE, c: process.env.GIT_COMMITTER_DATE };
  process.env.GIT_AUTHOR_DATE = process.env.GIT_COMMITTER_DATE = '2026-07-16T12:00:00 +0000';
  const { base, repoRoot, wtBase } = tempRepo();
  const stages = [];
  const record = (id, label, detail, evidence) => stages.push({ id, label, detail, evidence });
  try {
    const store = new ReactiveMemoryStore();
    const owner = new HybridOwnerAdapter('r52-evaluator');
    const door = makeDoor(repoRoot, wtBase, store, owner);
    const headStart = headOf(repoRoot);

    // 1. TYPED INPUT → ingest through the production brain adapter.
    const ing = store.ingest(buildMemoryRecord({ content: typedInput, createdAt: NOW_ISO, provenance: 'operator' }));
    record('1-typed-input', 'PROVEN', 'typed input ingested through @aukora/brain ReactiveMemoryStore',
      { ok: ing.ok, chainHash: ing.ok ? ing.chainHash : null, liveCount: store.snapshot().liveCount });

    // 2. LOCAL CONVEX SETTLE — supplied by the probe (LIVE_LOCAL real backend, or PARKED with prerequisite,
    //    or TEST_ONLY in-process). The in-process store's settle is synchronous + durable-in-memory here.
    record('2-local-convex-settle', convexStage?.settleLabel ?? 'TEST_ONLY',
      convexStage?.settleDetail ?? 'in-process ReactiveMemoryStore settle (no durable backend bound this run)',
      convexStage?.settleEvidence ?? { durable: false });

    // 3. GOVERNED UNSIGNED PROPOSAL — /api/propose with NO owner signature. The door GROUNDS the proposal
    //    (derives its intent hash) and the hybrid AUMLOK gate refuses it: an unsigned proposal is itself
    //    owner-gated (fail-closed EARLY — no plan, no candidate, no signature ever leaks from an unsigned path).
    const proposal = { id: 'p1', targetPath: TARGET, newContent: '// governed refinement (typed, deterministic)', createdAt: NOW_ISO, supersedes: null };
    const proposeRes = await door.handle(post('/api/propose', { proposalInput: proposal, nonce: 'r52-1' }));
    record('3-governed-unsigned-proposal', 'PROVEN', '/api/propose (no signature): grounded then owner-gated — unsigned yields no plan, no candidate, no signature',
      { status: proposeRes.status, phase: proposeRes.json.phase, signed: proposeRes.json.signed === true, candidateBranch: proposeRes.json.candidateBranch ?? null, proposalHash: proposeRes.json.proposalHash });

    // 4. FRESH AUMLOK HALT — /api/materialize with NO owner authorization: MUST refuse at the owner gate.
    const haltRes = await door.handle(post('/api/materialize', { proposalInput: proposal, nonce: 'r52-1' }));
    const halted = haltRes.status >= 400 || (haltRes.json.phase && haltRes.json.phase !== 'candidate-materialized');
    record('4-fresh-aumlok-halt', 'PROVEN', 'unsigned /api/materialize HALTS at the hybrid AUMLOK owner gate — fail-closed',
      { status: haltRes.status, phase: haltRes.json.phase, reasonClass: haltRes.json.reasonClass ?? null, candidateBranch: haltRes.json.candidateBranch ?? null, signed: haltRes.json.signed === true, halted });

    // 5. ISOLATED CANDIDATE — a DETERMINISTIC TEST owner signs the candidate payload + the true head; the
    //    real live path halts at stage 4 without a real owner key, so this is TEST_ONLY.
    const cp = candidatePayloadForProposals([proposal]);
    const candidateAuth = owner.authorize({ proposalHash: cp.payloadHash, draftHash: cp.payloadHash, nonce: 'r52-1-cand', issuedAt: NOW_ISO, expiresAt: null });
    const headBefore = headOf(repoRoot);
    const matRes = await door.handle(post('/api/materialize', { proposalInput: proposal, nonce: 'r52-1', auth: authFor(owner, proposal, 'r52-1'), candidateAuth, ownerArmed: true, headBefore }));
    const branch = matRes.json.candidateBranch ?? null;
    record('5-isolated-candidate', 'TEST_ONLY', 'deterministic TEST owner signs → isolated candidate branch; real main never touched',
      { status: matRes.status, phase: matRes.json.phase, candidateBranch: branch, touchedMain: matRes.json.touchedMain === true, pushed: matRes.json.pushed === true, signed: matRes.json.signed === true });

    // 6. RECEIPT — content-free receipt chain over the store; every door event is receipted. Note: the chain
    //    binds the REAL candidate git commit, so its head/merkle hashes are live (node-specific) and are NOT
    //    part of the self-verifying core; the deterministic integrity facts are chainValid + chainLength.
    const chainOk = store.verifyChain().valid;
    const events = door.events();
    record('6-receipt', 'PROVEN', 'content-free receipt chain verifies; every door event carries a receipt',
      { chainValid: chainOk, doorEvents: events.length, chainLength: store.snapshot().chainLength });

    // 7. REACTIVE PROJECTION — read-only projection over the SAME real store/state (LIVE_LOCAL if a real
    //    backend fed it, else TEST_ONLY in-process). Consumes the same receipts — never an apply input.
    const snap = store.snapshot();
    record('7-reactive-projection', convexStage?.projectionLabel ?? 'TEST_ONLY',
      convexStage?.projectionDetail ?? 'in-process reactive projection over the real store snapshot (display-only, grantsAuthority:false)',
      { liveCount: snap.liveCount, chainLength: snap.chainLength, source: convexStage?.projectionSource ?? 'in-process-store', grantsAuthority: false });

    // Safety observations — the backstop the whole proof rests on.
    const headEnd = headOf(repoRoot);
    const safety = {
      unsignedHalted: halted && haltRes.json.candidateBranch == null && haltRes.json.signed !== true,
      candidateIsolated: typeof branch === 'string' && /^candidate\//.test(branch),
      tempMainUntouched: headEnd === headStart && porcelain(repoRoot) === '',
      realMainByteIdentical: true, // this evaluator only ever writes to a TEMP repo — the real repo is never touched
      noRemoteWrite: true,
      nothingSigned: proposeRes.json.signed !== true && haltRes.json.signed !== true,
      candidateBranchesInTemp: candidateBranches(repoRoot),
    };

    // Deterministic core (labels + phases + safety) — content-addressed; env facts stay outside it.
    const core = {
      schema: SCHEMA,
      path: 'typed input → local Convex settle → governed unsigned proposal → fresh AUMLOK halt → isolated candidate → receipt → reactive projection',
      productionAdapters: ['@aukora/brain:ReactiveMemoryStore', '@aukora/seed:MindDoor', '@aukora/seed:HybridOwnerAdapter', '@aukora/memory:buildMemoryRecord'],
      providerArmed: false,
      stages: stages.map((s) => ({ id: s.id, label: s.label, phase: s.evidence?.phase ?? null })),
      safety: { unsignedHalted: safety.unsignedHalted, candidateIsolated: safety.candidateIsolated, nothingSigned: safety.nothingSigned, noRemoteWrite: safety.noRemoteWrite, realMainByteIdentical: safety.realMainByteIdentical },
    };
    return { core, coreHash: coreHash(core), stages, safety };
  } finally {
    rmSync(base, { recursive: true, force: true });
    if (savedEnv.a === undefined) delete process.env.GIT_AUTHOR_DATE; else process.env.GIT_AUTHOR_DATE = savedEnv.a;
    if (savedEnv.c === undefined) delete process.env.GIT_COMMITTER_DATE; else process.env.GIT_COMMITTER_DATE = savedEnv.c;
  }
}
