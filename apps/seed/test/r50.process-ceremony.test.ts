// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R50 — the ceremony/process half of issue #99, CI side (issue #22 R50).
 *
 * The LIVE supervised proof (real SIGKILL, real supervisor restart, real local Convex) runs OUTSIDE vitest and
 * is committed as a sanitized transcript under docs/r50/. THIS file pins the same laws deterministically:
 *
 *   1. F1 (R49 refusal hygiene): a MALFORMED matched-hash Fu sidecar is a stable receipted refusal
 *      (`door:fu-sidecar-malformed`) — it never escapes `MindDoor.handle()` as a throw — and NOTHING else
 *      escapes either (`door:ceremony-uncaught` belt). Fu advisory-only and AUMLOK separation unweakened.
 *   2. Durability over the REAL `ConvexWorkflowStore` (Sam 2's adapter, real hydrate/settle) against a
 *      deterministic async io that mirrors the convex `saveWorkflow` isolate law (subset validation + OCC):
 *      store refused ≠ conflict preserved; a killed-and-restarted process (fresh adapter cache, fresh ledger,
 *      fresh door — only the io survives, like the real backend) REHYDRATES the workflow byte-identically and
 *      resumes idempotently; a racing writer landing between hydrate and settle FAILS CLOSED as a receipted
 *      `door:settle-divergence`; a durable row that passes the isolate subset but fails the FULL validator is
 *      a receipted `door:hydration-failed`; an unreachable backend is a receipted `door:store-unavailable`.
 *   3. Head binding: /api/materialize REQUIRES the 40-hex HEAD the approval was made against
 *      (`door:head-missing`), a moved head refuses (`candidate:stale-head`) WITHOUT consuming the owner's
 *      candidate authorization, and the same authorization then materializes against the true head.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ReactiveMemoryStore, ConvexWorkflowStore } from '@aukora/brain';
import type { CouncilOutcome } from '@aukora/council';
import {
  MindDoor, InMemoryWorkflowStore, HybridOwnerAdapter, RecursionLedger, CandidateReferenceMonitor,
  candidatePayloadForProposals, deriveIntentId, validateWorkflowState, LIMITS,
  type DoorRequest, type DoorDriver, type DoorDurability, type LocalCeremonyEnv, type RepoReadCapability,
  type WorkflowStore, type WorkflowStateV1,
} from '../src/index.js';
import { makeProposal, authFor, NOW_ISO, NOW_MS, TARGET } from './support.js';

const TOKEN = 'r50-process-door-fixed-for-tests';
const HEX64 = /^[0-9a-f]{64}$/;
const PHASES = new Set(['awaiting-owner', 'applied', 'refused', 'cancelled']);

/**
 * Deterministic async io mirroring apps/brain/convex/workflows.ts `saveWorkflow`: the isolate-expressible
 * subset law (schema/ids/phase/version/flags) + authoritative OCC. The io IS the "backend process" in these
 * tests — it survives while adapters, ledgers, and doors are killed and rebuilt around it.
 */
class FakeConvexIo {
  readonly rows = new Map<string, WorkflowStateV1>();
  unreachableLoads = false;
  unreachableSaves = false;
  /** One-shot racing writer: applied right after the next successful load (i.e., between hydrate and settle). */
  raceOnce: WorkflowStateV1 | null = null;

  async load(workflowId: string): Promise<WorkflowStateV1 | null> {
    if (this.unreachableLoads) throw new Error('fetch failed: ECONNREFUSED 127.0.0.1:3210');
    const row = this.rows.get(workflowId) ?? null;
    const out = row === null ? null : (structuredClone(row) as WorkflowStateV1);
    if (this.raceOnce !== null) {
      this.rows.set(this.raceOnce.workflowId, structuredClone(this.raceOnce) as WorkflowStateV1);
      this.raceOnce = null;
    }
    return out;
  }

  async save(state: WorkflowStateV1, expectedVersion: number): Promise<{ ok: true } | { ok: false; reason: 'conflict' | 'refused' }> {
    if (this.unreachableSaves) throw new Error('fetch failed: ECONNREFUSED 127.0.0.1:3210');
    const s = state as unknown as Record<string, unknown>;
    if (
      s === null || typeof s !== 'object' ||
      s.schema !== 'aukora-recursion-workflow-v1' ||
      typeof s.workflowId !== 'string' || !HEX64.test(s.workflowId) ||
      typeof s.intentId !== 'string' || !HEX64.test(s.intentId) ||
      typeof s.draftHash !== 'string' || !HEX64.test(s.draftHash) ||
      typeof s.phase !== 'string' || !PHASES.has(s.phase) ||
      !Number.isSafeInteger(s.version) || (s.version as number) < 1 ||
      s.advisoryOnly !== true || s.grantsAuthority !== false
    ) return { ok: false, reason: 'refused' };
    const current = this.rows.get(state.workflowId)?.version ?? 0;
    if (current !== expectedVersion || state.version !== current + 1) return { ok: false, reason: 'conflict' };
    this.rows.set(state.workflowId, structuredClone(state) as WorkflowStateV1);
    return { ok: true };
  }
}

let base: string; let repoRoot: string; let wtBase: string;
beforeAll(() => {
  base = realpathSync(mkdtempSync(join(tmpdir(), 'aukora-r50-')));
  repoRoot = join(base, 'repo'); wtBase = join(base, 'candidates');
  mkdirSync(join(repoRoot, 'apps/seed/src'), { recursive: true });
  execFileSync('git', ['init', '-q', '-b', 'main', repoRoot]);
  execFileSync('git', ['-C', repoRoot, 'config', 'user.name', 'R50']);
  execFileSync('git', ['-C', repoRoot, 'config', 'user.email', 'r50@test.local']);
  execFileSync('git', ['-C', repoRoot, 'remote', 'add', 'origin', 'https://github.com/aumara-xyz/aukora.git']); // R57A canonical identity
  writeFileSync(join(repoRoot, TARGET), '// original\n');
  execFileSync('git', ['-C', repoRoot, 'add', '-A']);
  execFileSync('git', ['-C', repoRoot, 'commit', '-q', '--no-gpg-sign', '-m', 'init']);
});
afterAll(() => rmSync(base, { recursive: true, force: true }));

const repoCap = (): RepoReadCapability => ({ list: () => [TARGET], read: (p) => readFileSync(join(repoRoot, p), 'utf8'), exists: (p) => existsSync(join(repoRoot, p)) });
const headOf = (): string => execFileSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

interface Harness { door: MindDoor; owner: HybridOwnerAdapter; store: ReactiveMemoryStore; convexStore: ConvexWorkflowStore | null }
/** One "process": a door + adapter cache + ledger. Kill it by dropping it; only the injected io survives. */
function bootProcess(io: FakeConvexIo | null, over: { workflowStore?: WorkflowStore; owner?: HybridOwnerAdapter; durabilityOverride?: DoorDurability | null } = {}): Harness {
  const store = new ReactiveMemoryStore();
  const owner = over.owner ?? new HybridOwnerAdapter('r50-door');
  const monitor = new CandidateReferenceMonitor(owner.root);
  const convexStore = io === null ? null : new ConvexWorkflowStore(io, validateWorkflowState as never);
  const workflowStore = over.workflowStore ?? (convexStore === null ? new InMemoryWorkflowStore() : (convexStore as unknown as WorkflowStore));
  const defaultDurability: DoorDurability | undefined = convexStore === null ? undefined : {
    hydrate: (id) => convexStore.hydrate(id),
    settle: () => convexStore.settle(),
  };
  // durabilityOverride: undefined ⇒ default; null ⇒ force no durability; a value ⇒ inject that contract exactly.
  const durability: DoorDurability | undefined = over.durabilityOverride === undefined ? defaultDurability : (over.durabilityOverride ?? undefined);
  const loadDriver = async (): Promise<DoorDriver> => {
    const recursionEnv = { store, knownFiles: new Set([TARGET]), ownerRoot: owner.root, ledger: new RecursionLedger(), nowMs: NOW_MS, nowIso: NOW_ISO, deadlineMs: NOW_MS + LIMITS.DEFAULT_WALL_TIME_BUDGET_MS };
    const ceremonyEnv: LocalCeremonyEnv = { recursionEnv, workflowStore, repo: repoCap(), ownerRoot: owner.root, store, monitor, gitRepoRoot: repoRoot, worktreeBase: wtBase, nowMs: NOW_MS, nowIso: NOW_ISO };
    return { ceremonyEnv, durability };
  };
  const door = new MindDoor({ store, ownerRoot: owner.root, loadDriver, postToken: TOKEN, nowIso: NOW_ISO });
  return { door, owner, store, convexStore };
}
const post = (path: string, body: unknown): DoorRequest => ({ method: 'POST', path, headers: { 'x-aukora-door-token': TOKEN }, body });

// ── 1. F1 refusal hygiene: nothing escapes handle() as a throw ───────────────────────────────────

describe('R50 · F1 — malformed matched-hash Fu sidecar is a receipted refusal, never a throw', () => {
  it('an empty-object outcome bound to the right proposalHash refuses with door:fu-sidecar-malformed', async () => {
    const h = bootProcess(null);
    const p = makeProposal({ newContent: '// f1-a\n' });
    const res = await h.door.handle(post('/api/propose', { proposalInput: p, nonce: 'f1-a', fuSidecar: { proposalHash: deriveIntentId(p), outcome: {} as CouncilOutcome } }));
    expect(res.status).toBe(400);
    expect(res.json.reasonClass).toBe('door:fu-sidecar-malformed');
    expect(res.json.eventReceipt).toBeTruthy(); // receipted, not thrown
    // the door is still up and still serves
    expect((await h.door.handle({ method: 'GET', path: '/api/door', headers: {} })).status).toBe(200);
  });

  it('a null-basis outcome (quorum flags present, basis broken) also refuses with the same stable class', async () => {
    const h = bootProcess(null);
    const p = makeProposal({ newContent: '// f1-b\n' });
    const malformed = { quorumMet: true, grantsAuthority: false, verdict: 'consensus', votes: [], votingFamilies: 0, basis: null } as unknown as CouncilOutcome;
    const res = await h.door.handle(post('/api/propose', { proposalInput: p, nonce: 'f1-b', fuSidecar: { proposalHash: deriveIntentId(p), outcome: malformed } }));
    expect(res.status).toBe(400);
    expect(res.json.reasonClass).toBe('door:fu-sidecar-malformed');
  });

  it('BELT: a throwing store inside the ceremony becomes a receipted door:ceremony-uncaught 500; the door stays up', async () => {
    const throwing: WorkflowStore = { load: () => { throw new Error('exploding store'); }, save: () => { throw new Error('exploding store'); } };
    const h = bootProcess(null, { workflowStore: throwing });
    const p = makeProposal({ newContent: '// f1-c\n' });
    const res = await h.door.handle(post('/api/propose', { proposalInput: p, nonce: 'f1-c' }));
    expect(res.status).toBe(500);
    expect(res.json.reasonClass).toBe('door:ceremony-uncaught');
    expect(res.json.eventReceipt).toBeTruthy();
    expect((await h.door.handle({ method: 'GET', path: '/api/door', headers: {} })).status).toBe(200);
  });
});

// ── 2. durability over the REAL ConvexWorkflowStore (the io is the surviving "backend") ─────────

describe('R50 · durable ceremony over the real ConvexWorkflowStore + process death at the seam', () => {
  const owner = new HybridOwnerAdapter('r50-door');
  const io = new FakeConvexIo();
  const p1 = makeProposal({ newContent: '// r50 durable crossing\n' });
  const N1 = 'r50-nonce-1';
  let workflowId = '';
  let rowBeforeDeath: WorkflowStateV1 | null = null;

  it('tokened propose reaches DURABLE awaiting-owner: the row lives in the backend, fully settled', async () => {
    const h = bootProcess(io, { owner });
    const res = await h.door.handle(post('/api/propose', { proposalInput: p1, nonce: N1 }));
    expect(res.status).toBe(409);
    expect(res.json.phase).toBe('refused-at-owner');
    expect(res.json.reasonClass).toBe('refused-owner-gate'); // durable wait, not a terminal
    workflowId = String(res.json.workflowId);
    const row = io.rows.get(workflowId);
    expect(row?.phase).toBe('awaiting-owner');
    expect(h.convexStore?.pendingCount()).toBe(0); // settled — nothing only-in-cache
    rowBeforeDeath = structuredClone(row!) as WorkflowStateV1;
  });

  it('PROCESS DEATH at the seam: a fresh process (new adapter cache/ledger/door; same backend) rehydrates BYTE-IDENTICALLY and resumes idempotently', async () => {
    const h2 = bootProcess(io, { owner }); // the old door/adapter/ledger are gone — only the io survived
    const rehydrated = await h2.convexStore!.hydrate(workflowId);
    expect(rehydrated).toEqual(rowBeforeDeath); // byte-identical durable truth
    const sizeBefore = io.rows.size;
    const res = await h2.door.handle(post('/api/propose', { proposalInput: p1, nonce: N1 }));
    expect(String(res.json.workflowId)).toBe(workflowId); // resumed, never a second workflow
    expect(io.rows.size).toBe(sizeBefore);                // no duplicate row
    expect(io.rows.get(workflowId)?.phase).toBe('awaiting-owner');
  });

  it('fresh owner authorization + explicit materialize with the TRUE head lands exactly one candidate; a WRONG head refuses stale WITHOUT consuming the authorization', async () => {
    const h3 = bootProcess(io, { owner }); // another restart — durable truth still drives
    const applied = await h3.door.handle(post('/api/propose', { proposalInput: p1, nonce: N1, auth: authFor(owner, p1, { nonce: N1 }) }));
    expect(applied.status).toBe(200);
    expect(applied.json.phase).toBe('awaiting-explicit-materialize');
    expect(io.rows.get(workflowId)?.phase).toBe('applied'); // durably applied

    // R54 v6: the ACTIVE door is mandatorily head-bound — the owner signs over the HEAD-BOUND payload (/2).
    const approvedHead = headOf();
    const cp = candidatePayloadForProposals([p1], approvedHead);
    const candidateAuth = owner.authorize({ proposalHash: cp.payloadHash, draftHash: cp.payloadHash, nonce: `${N1}-cand`, issuedAt: NOW_ISO, expiresAt: null });
    const bodyBase = { proposalInput: p1, nonce: N1, auth: authFor(owner, p1, { nonce: N1 }), candidateAuth, ownerArmed: true };

    // head-missing: refused at the door with its own name
    const noHead = await h3.door.handle(post('/api/materialize', { ...bodyBase }));
    expect(noHead.status).toBe(400);
    expect(noHead.json.reasonClass).toBe('door:head-missing');

    // Claimed head (valid shape, wrong value) while the authorization was SIGNED over the true head. R56: the
    // ceremony now runs through the crash-recoverable effect coordinator, whose NON-CONSUMING owner verify
    // catches the claim/signature mismatch EARLIER than the stage's head precheck — the head-bound payload over
    // the claimed 'aaaa…' base does not verify → refused `candidate:reference-monitor-refused`. The security
    // properties are identical to (stronger than) the old `candidate:stale-head`: refused BEFORE the durable
    // consume, zero Git. (A genuine repo-moved-under-a-correct-claim still yields `candidate:stale-head` from the
    // stage — proven in r56.primary-effect.)
    const stale = await h3.door.handle(post('/api/materialize', { ...bodyBase, headBefore: 'a'.repeat(40) }));
    expect(stale.json.ok).toBe(false);
    expect(stale.json.reasonClass).toBe('candidate:reference-monitor-refused');
    expect(execFileSync('git', ['-C', repoRoot, 'branch', '--list', 'candidate/*'], { encoding: 'utf8' }).trim()).toBe('');

    // true head with the SAME authorization: exactly one isolated candidate
    const headBefore = headOf();
    const mat = await h3.door.handle(post('/api/materialize', { ...bodyBase, headBefore }));
    expect(mat.status).toBe(200);
    expect(mat.json.phase).toBe('candidate-materialized');
    expect(String(mat.json.candidateBranch)).toMatch(/^candidate\//);
    expect(headOf()).toBe(headBefore); // main untouched
    const worktrees = execFileSync('git', ['-C', repoRoot, 'worktree', 'list', '--porcelain'], { encoding: 'utf8' })
      .split('\n').filter((l) => l.startsWith('worktree ')).map((l) => l.slice('worktree '.length)).filter((w) => w.startsWith(wtBase));
    expect(worktrees.length).toBe(1); // exactly one
  });

  it('A→B BYPASS (R54 v6): approval SIGNED at HEAD A; main advances to unrelated B; the SAME auth claiming B refuses at the consuming monitor — zero consume, zero Git', async () => {
    const pB = makeProposal({ newContent: '// r54v6 active-door bypass\n' });
    const NB = 'r50-nonce-bypass';
    const h = bootProcess(io, { owner });
    await h.door.handle(post('/api/propose', { proposalInput: pB, nonce: NB }));
    const applied = await h.door.handle(post('/api/propose', { proposalInput: pB, nonce: NB, auth: authFor(owner, pB, { nonce: NB }) }));
    expect(applied.status).toBe(200);

    // the owner approves AT base A: the signed candidate payload BINDS headA
    const headA = headOf();
    const cpB = candidatePayloadForProposals([pB], headA);
    const candidateAuth = owner.authorize({ proposalHash: cpB.payloadHash, draftHash: cpB.payloadHash, nonce: `${NB}-cand`, issuedAt: NOW_ISO, expiresAt: null });

    // main/HEAD advances to an unrelated B AFTER the approval was signed
    writeFileSync(join(repoRoot, 'advanced-after-approval.txt'), '// unrelated later work\n');
    execFileSync('git', ['-C', repoRoot, 'add', '-A']);
    execFileSync('git', ['-C', repoRoot, 'commit', '-q', '--no-gpg-sign', '-m', 'unrelated B']);
    const headB = headOf();
    expect(headB).not.toBe(headA);
    const branchesBefore = execFileSync('git', ['-C', repoRoot, 'branch', '--list', 'candidate/*'], { encoding: 'utf8' }).trim();

    try {
      // THE BYPASS ATTEMPT: same signed auth, CLAIMING the current head B. The stage's stale-head check passes
      // (claim == actual), but the SIGNED bytes bind A → the ONE consuming decide() refuses authority_invalid
      // BEFORE any durable consume or git mutation. The old unbound-/1 acceptance is gone: this exact request
      // materialized on the pre-v6 door.
      const bypass = await h.door.handle(post('/api/materialize', { proposalInput: pB, nonce: NB, auth: authFor(owner, pB, { nonce: NB }), candidateAuth, ownerArmed: true, headBefore: headB }));
      expect(bypass.json.ok).toBe(false);
      expect(bypass.json.reasonClass).toBe('candidate:reference-monitor-refused');
      // zero Git: no new candidate branch, HEAD still B, tree clean
      expect(execFileSync('git', ['-C', repoRoot, 'branch', '--list', 'candidate/*'], { encoding: 'utf8' }).trim()).toBe(branchesBefore);
      expect(headOf()).toBe(headB);
      expect(execFileSync('git', ['-C', repoRoot, 'status', '--porcelain'], { encoding: 'utf8' }).trim()).toBe('');
    } finally {
      execFileSync('git', ['-C', repoRoot, 'reset', '-q', '--hard', headA]); // restore base A for later tests
    }

    // ZERO CONSUME, proven behaviorally: back at base A, the SAME authorization still materializes — the refused
    // bypass burned nothing. (A consumed nonce would replay-refuse here.)
    const honest = await h.door.handle(post('/api/materialize', { proposalInput: pB, nonce: NB, auth: authFor(owner, pB, { nonce: NB }), candidateAuth, ownerArmed: true, headBefore: headA }));
    expect(honest.status).toBe(200);
    expect(honest.json.phase).toBe('candidate-materialized');
    expect(headOf()).toBe(headA); // main untouched by the isolated effect
  });

  it('SETTLE DIVERGENCE: a racing writer landing between hydrate and settle fails closed as a receipted door:settle-divergence', async () => {
    const p2 = makeProposal({ newContent: '// r50 divergence\n' });
    const N2 = 'r50-nonce-2';
    const h = bootProcess(io, { owner });
    const first = await h.door.handle(post('/api/propose', { proposalInput: p2, nonce: N2 }));
    const wid2 = String(first.json.workflowId);
    const settledRow = io.rows.get(wid2)!;
    // the racing writer's row: a VALID full state one version ahead, applied by the io right after the next load
    io.raceOnce = { ...(structuredClone(settledRow) as WorkflowStateV1), version: settledRow.version + 1 };
    const res = await h.door.handle(post('/api/propose', { proposalInput: p2, nonce: N2, auth: authFor(owner, p2, { nonce: N2 }) }));
    expect(res.status).toBe(409);
    expect(res.json.reasonClass).toBe('door:settle-divergence');
    expect(res.json.eventReceipt).toBeTruthy();
    expect((res.json.divergentWorkflowPrefixes as string[])).toContain(wid2.slice(0, 12));
    // fail-closed convergence: the durable truth (the winner's row) is what a re-read now sees
    expect(io.rows.get(wid2)?.version).toBe(settledRow.version + 1);
  });

  it('HYDRATION-FAILED: a durable row that passes the isolate subset but fails the FULL validator refuses with door:hydration-failed', async () => {
    const p3 = makeProposal({ newContent: '// r50 bad row\n' });
    const N3 = 'r50-nonce-3';
    const h = bootProcess(io, { owner });
    // plant the bad row at the exact workflowId this (proposal, nonce) pair will hydrate
    const probe = await h.door.handle(post('/api/propose', { proposalInput: p3, nonce: N3 }));
    const wid3 = String(probe.json.workflowId);
    const good = io.rows.get(wid3)!;
    io.rows.set(wid3, { ...(structuredClone(good) as WorkflowStateV1), nonce: '' }); // subset-passing, full-failing
    const h4 = bootProcess(io, { owner }); // fresh cache so hydrate must consult the backend
    const res = await h4.door.handle(post('/api/propose', { proposalInput: p3, nonce: N3 }));
    expect(res.status).toBe(409);
    expect(res.json.reasonClass).toBe('door:hydration-failed');
    expect(res.json.eventReceipt).toBeTruthy();
    io.rows.set(wid3, good); // restore for later tests
  });

  it('STORE-UNAVAILABLE: an unreachable backend at hydrate AND at settle are both receipted door:store-unavailable; the door stays up', async () => {
    const p4 = makeProposal({ newContent: '// r50 backend down\n' });
    const h = bootProcess(io, { owner });
    io.unreachableLoads = true;
    const atHydrate = await h.door.handle(post('/api/propose', { proposalInput: p4, nonce: 'r50-nonce-4' }));
    expect(atHydrate.status).toBe(503);
    expect(atHydrate.json.reasonClass).toBe('door:store-unavailable');
    io.unreachableLoads = false;
    io.unreachableSaves = true;
    const atSettle = await h.door.handle(post('/api/propose', { proposalInput: p4, nonce: 'r50-nonce-5' }));
    expect(atSettle.status).toBe(503);
    expect(atSettle.json.reasonClass).toBe('door:store-unavailable');
    io.unreachableSaves = false;
    expect((await h.door.handle({ method: 'GET', path: '/api/door', headers: {} })).status).toBe(200);
  });

  it('refused ≠ conflict is preserved END-TO-END through the composed adapter (isolate refusal names the store validator)', async () => {
    // a state the CACHE accepts but the isolate subset refuses cannot be built (the injected full validator is
    // stricter) — so the adapter-level law is: full-validator refusal at save() → workflow:state-refused:<field>,
    // OCC loss at the authoritative mutation → divergence. Both are proven above; here we pin the machine-visible
    // class for a cache-level refusal through the REAL adapter.
    const h = bootProcess(io, { owner });
    const store = h.convexStore! as unknown as WorkflowStore;
    const bad = { schema: 'aukora-recursion-workflow-v1' } as unknown as WorkflowStateV1;
    expect(store.save(bad, 0)).toEqual({ ok: false, reason: 'refused' });
  });
});

// ── 3. settle-contract convergence: a REPORTED outage stays store-unavailable, never divergence ──
// The current `ConvexWorkflowStore.settle()` reports a backend outage as data (`SettleResult.unavailable`)
// instead of throwing. These tests inject that exact contract shape at the door's `DoorDurability` seam so the
// mapping is proven WITHOUT depending on which store version is present (this branch's base still throws; the
// merged tree reports) — the same fact must always carry the same 503 class, never a 409 conflict.

describe('R50 · settle contract — a reported outage is door:store-unavailable, not a concurrent-writer conflict', () => {
  const WID = 'ab'.repeat(32); // a stand-in 64-hex workflow id; the door only ever exposes a 12-hex prefix

  /** Boot a durable door whose settle() returns EXACTLY the given result shape (no throw) — the reporting contract. */
  const settleReporting = (result: { ok: boolean; pushed: number; divergence: readonly string[]; unavailable?: readonly string[] }) =>
    bootProcess(null, {
      workflowStore: new InMemoryWorkflowStore(), // ceremony runs in-process; only the settle RESULT is under test
      durabilityOverride: { hydrate: async () => null, settle: async () => result },
    });
  const proposeNoAuth = (h: Harness) => h.door.handle(post('/api/propose', { proposalInput: makeProposal({ newContent: '// r50 settle-contract\n' }), nonce: 'r50-settle-1' }));

  it('settle reports unavailable (ok:false, divergence:[]) → 503 door:store-unavailable with content-free prefixes', async () => {
    const h = settleReporting({ ok: false, pushed: 0, divergence: [], unavailable: [WID] });
    const res = await proposeNoAuth(h);
    expect(res.status).toBe(503);
    expect(res.json.reasonClass).toBe('door:store-unavailable'); // NOT door:settle-divergence
    expect(res.json.unavailableWorkflowPrefixes).toEqual([WID.slice(0, 12)]);
    expect(res.json.eventReceipt).toBeTruthy();
    // the exact merged-tree regression Sam 1 pinned: an empty divergence list must never surface as a conflict
    expect(res.json.divergentWorkflowPrefixes).toBeUndefined();
  });

  it('ORDERING: unavailable is checked BEFORE divergence — a settle with both reports store-unavailable (the retryable truth)', async () => {
    const h = settleReporting({ ok: false, pushed: 0, divergence: [WID], unavailable: [WID] });
    const res = await proposeNoAuth(h);
    expect(res.status).toBe(503);
    expect(res.json.reasonClass).toBe('door:store-unavailable');
  });

  it('REGRESSION: a genuine divergence (unavailable empty/absent) still maps to 409 door:settle-divergence', async () => {
    const h = settleReporting({ ok: false, pushed: 0, divergence: [WID], unavailable: [] });
    const res = await proposeNoAuth(h);
    expect(res.status).toBe(409);
    expect(res.json.reasonClass).toBe('door:settle-divergence');
    expect(res.json.divergentWorkflowPrefixes).toEqual([WID.slice(0, 12)]);
  });

  it('a store that still THROWS on an outage (older settle contract) maps to the SAME 503 class', async () => {
    const h = bootProcess(null, {
      workflowStore: new InMemoryWorkflowStore(),
      durabilityOverride: { hydrate: async () => null, settle: async () => { throw new Error('ECONNREFUSED 127.0.0.1:3210'); } },
    });
    const res = await proposeNoAuth(h);
    expect(res.status).toBe(503);
    expect(res.json.reasonClass).toBe('door:store-unavailable');
  });

  it('a fully-settled result (ok:true) lets the ceremony result stand (here: refused-owner-gate, no durability override of the verdict)', async () => {
    const h = settleReporting({ ok: true, pushed: 1, divergence: [], unavailable: [] });
    const res = await proposeNoAuth(h);
    expect(res.status).toBe(409); // the ceremony's own refused-owner-gate, untouched by a clean settle
    expect(res.json.reasonClass).toBe('refused-owner-gate');
  });
});
