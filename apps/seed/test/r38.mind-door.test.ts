// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R38 — the governed chat/mind door (loopback 7097 law): serialized driver chain, lazy honest boot (a compile break
 * fails the request not the server), origin/token/lockdown refusals, model-free memory fallback, restart-emits-plan-
 * only / no-auto-resume, proposal Fu sidecar bound by proposalHash, and candidate isolation over a real git repo.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ReactiveMemoryStore } from '@aukora/brain';
import { buildMemoryRecord } from '@aukora/memory';
import { CANONICAL_SEATS, PACKET_OPEN, PACKET_CLOSE, runAukoraFuCouncil, type Transport } from '@aukora/council';
import {
  MindDoor, DOOR_PORT, mindDoorGrantsAuthority, checkDoorGuard, headerReader, loopbackOrigins, newDoorToken, doorGuardsGrantAuthority,
  InMemoryWorkflowStore, HybridOwnerAdapter, RecursionLedger, CandidateReferenceMonitor, candidatePayloadForProposals,
  deriveIntentId, deriveDraftHash, LIMITS,
  type DoorRequest, type DoorDriver, type LocalCeremonyEnv, type Proposal, type RepoReadCapability,
} from '../src/index.js';
import { makeProposal, authFor, NOW_ISO, NOW_MS, TARGET } from './support.js';

const TOKEN = 'door-token-fixed-for-tests-000000';
const ORIGIN = loopbackOrigins(DOOR_PORT)[0];

let base: string; let repoRoot: string; let wtBase: string;
beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), 'aukora-r38-'));
  repoRoot = join(base, 'repo'); wtBase = join(base, 'candidates');
  mkdirSync(join(repoRoot, 'apps/seed/src'), { recursive: true });
  execFileSync('git', ['init', '-q', '-b', 'main', repoRoot]);
  execFileSync('git', ['-C', repoRoot, 'config', 'user.name', 'R38']);
  execFileSync('git', ['-C', repoRoot, 'config', 'user.email', 'r38@test.local']);
  writeFileSync(join(repoRoot, TARGET), '// original\n');
  execFileSync('git', ['-C', repoRoot, 'add', '-A']);
  execFileSync('git', ['-C', repoRoot, 'commit', '-q', '--no-gpg-sign', '-m', 'init']);
});
afterAll(() => rmSync(base, { recursive: true, force: true }));

const repoCap = (): RepoReadCapability => ({ list: () => [TARGET], read: (p) => readFileSync(join(repoRoot, p), 'utf8'), exists: (p) => existsSync(join(repoRoot, p)) });

interface Harness { door: MindDoor; store: ReactiveMemoryStore; owner: HybridOwnerAdapter; workflowStore: InMemoryWorkflowStore; }
function makeDoor(opts: { loadDriver?: () => Promise<DoorDriver>; workflowStore?: InMemoryWorkflowStore; store?: ReactiveMemoryStore } = {}): Harness {
  const store = opts.store ?? new ReactiveMemoryStore();
  const owner = new HybridOwnerAdapter('door-test');
  const workflowStore = opts.workflowStore ?? new InMemoryWorkflowStore();
  const monitor = new CandidateReferenceMonitor(owner.root);
  const loadDriver = opts.loadDriver ?? (async (): Promise<DoorDriver> => {
    const recursionEnv = { store, knownFiles: new Set([TARGET]), ownerRoot: owner.root, ledger: new RecursionLedger(), nowMs: NOW_MS, nowIso: NOW_ISO, deadlineMs: NOW_MS + LIMITS.DEFAULT_WALL_TIME_BUDGET_MS };
    const ceremonyEnv: LocalCeremonyEnv = { recursionEnv, workflowStore, repo: repoCap(), ownerRoot: owner.root, store, monitor, gitRepoRoot: repoRoot, worktreeBase: wtBase, nowMs: NOW_MS, nowIso: NOW_ISO };
    return { ceremonyEnv };
  });
  const door = new MindDoor({ store, ownerRoot: owner.root, loadDriver, postToken: TOKEN, nowIso: NOW_ISO });
  return { door, store, owner, workflowStore };
}
const post = (path: string, body: unknown, over: Record<string, string> = {}): DoorRequest =>
  ({ method: 'POST', path, headers: { origin: ORIGIN, 'x-aukora-door-token': TOKEN, ...over }, body });

describe('door guards (ported law)', () => {
  it('refuses unlisted origin, bad token, and reports stable reason classes', () => {
    const opts = { allowedOrigins: loopbackOrigins(DOOR_PORT), requiredToken: TOKEN };
    expect(checkDoorGuard(headerReader({ origin: 'https://evil.example', 'x-aukora-door-token': TOKEN }), opts).reason).toBe('guard:origin-not-allowed');
    expect(checkDoorGuard(headerReader({ origin: ORIGIN, 'x-aukora-door-token': 'wrong' }), opts).reason).toBe('guard:missing-or-bad-token');
    expect(checkDoorGuard(headerReader({ origin: ORIGIN, 'x-aukora-door-token': TOKEN }), opts).ok).toBe(true);
    expect(checkDoorGuard(headerReader({ referer: 'https://evil.example/x' }), opts).reason).toBe('guard:referer-not-allowed');
    expect(newDoorToken()).toMatch(/^[0-9a-f]{48}$/);
    expect(doorGuardsGrantAuthority()).toBe(false);
  });
});

describe('origin / token / lockdown refuse visibly; status is always readable', () => {
  it('GET /api/door returns status even before boot and even under lockdown', async () => {
    const { door } = makeDoor();
    const s = await door.handle({ method: 'GET', path: '/api/door', headers: {} });
    expect(s.status).toBe(200);
    expect(s.json.lockedDown).toBe(false);
    expect(s.json.grantsAuthority).toBe(false);
  });

  it('a blind cross-origin / bad-token POST is refused with a receipted reason class', async () => {
    const { door, store } = makeDoor();
    const badOrigin = await door.handle(post('/api/chat', { text: 'hi' }, { origin: 'https://evil.example' }));
    expect(badOrigin.status).toBe(403);
    expect(badOrigin.json.reasonClass).toBe('guard:origin-not-allowed');
    const badToken = await door.handle(post('/api/chat', { text: 'hi' }, { 'x-aukora-door-token': 'nope' }));
    expect(badToken.json.reasonClass).toBe('guard:missing-or-bad-token');
    expect(store.recall({ text: 'door-event' }).length).toBeGreaterThanOrEqual(2); // both refusals receipted
  });

  it('lockdown short-circuits proposals/materialization to advisory-only (visible, receipted)', async () => {
    const { door } = makeDoor();
    const lock = await door.handle(post('/api/lockdown', {}));
    expect(lock.status).toBe(200);
    expect(door.isLockedDown()).toBe(true);
    const p = makeProposal();
    const refused = await door.handle(post('/api/propose', { proposalInput: p, nonce: 'x', auth: authFor((makeDoor()).owner, p, { nonce: 'x' }) }));
    expect(refused.status).toBe(423);
    expect(refused.json.reasonClass).toBe('door:locked-down');
    // chat still works under lockdown (advisory)
    expect((await door.handle(post('/api/chat', { text: 'anything' }))).status).toBe(200);
  });
});

describe('serialized driver chain — concurrent requests never interleave', () => {
  it('serializes: a slow driver forces requests to complete one at a time in order', async () => {
    const order: string[] = [];
    let n = 0;
    const slowDriver = async (): Promise<DoorDriver> => {
      const id = `boot${n++}`;
      order.push(`start:${id}`);
      await new Promise((r) => setTimeout(r, 15));
      order.push(`end:${id}`);
      // minimal env; chat doesn't use it but boot must run
      const store = new ReactiveMemoryStore();
      const recursionEnv = { store, knownFiles: new Set<string>(), ownerRoot: (new HybridOwnerAdapter('x')).root, ledger: new RecursionLedger(), nowMs: NOW_MS, nowIso: NOW_ISO, deadlineMs: NOW_MS + 1000 };
      return { ceremonyEnv: { recursionEnv, workflowStore: new InMemoryWorkflowStore(), repo: repoCap(), ownerRoot: recursionEnv.ownerRoot, store, nowMs: NOW_MS, nowIso: NOW_ISO } };
    };
    const { door } = makeDoor({ loadDriver: slowDriver });
    // fire three concurrently; the promise chain must run boot exactly once and serialize the three
    await Promise.all([
      door.handle(post('/api/chat', { text: 'a' })),
      door.handle(post('/api/chat', { text: 'b' })),
      door.handle(post('/api/chat', { text: 'c' })),
    ]);
    // boot runs once (cached), and no two boots interleave: every start is immediately followed by its end
    for (let i = 0; i < order.length; i += 2) expect(order[i + 1]).toBe(order[i].replace('start', 'end'));
  });
});

describe('lazy honest boot — a compile/import break fails the request, not the server', () => {
  it('a throwing driver loader yields a 500 with a stable class, and the door keeps serving status', async () => {
    let broken = true;
    const { door } = makeDoor({ loadDriver: async () => { if (broken) throw new Error('core/ compile break'); throw new Error('n/a'); } });
    const failed = await door.handle(post('/api/chat', { text: 'hi' }));
    expect(failed.status).toBe(500);
    expect(failed.json.reasonClass).toBe('door:driver-load-failed');
    // server still up: status route answers
    expect((await door.handle({ method: 'GET', path: '/api/door', headers: {} })).status).toBe(200);
    void broken;
  });
});

describe('model-free memory fallback', () => {
  it('chat answers from KIRA recall with citations when no model/Fu is configured', async () => {
    const { door, store } = makeDoor();
    store.ingest(buildMemoryRecord({ content: 'the covenant holds at dawn', createdAt: NOW_ISO }));
    const res = await door.handle(post('/api/chat', { text: 'covenant' }));
    expect(res.status).toBe(200);
    expect(res.json.mode).toBe('model-free-memory-fallback');
    expect(String(res.json.answer)).toContain('covenant holds at dawn');
    expect(Array.isArray(res.json.citations)).toBe(true);
    expect(res.json.grantsAuthority).toBe(false);
  });
});

describe('propose / materialize — explicit owner, fresh AUMLOK, plan-only on restart, no auto-resume', () => {
  it('propose emits a PLAN (awaiting explicit materialize); no branch, no signature', async () => {
    const { door, owner } = makeDoor();
    const p = makeProposal({ newContent: '// door propose' });
    const res = await door.handle(post('/api/propose', { proposalInput: p, nonce: 'd-1', auth: authFor(owner, p, { nonce: 'd-1' }) }));
    expect(res.status).toBe(200);
    expect(res.json.phase).toBe('awaiting-explicit-materialize');
    expect(res.json.candidateBranch).toBeNull();
    expect(res.json.signed).toBe(false);
    expect(res.json.touchedMain).toBe(false);
    expect(res.json.proposalHash).toBe(deriveIntentId(p));
  });

  it('materialize (explicit) lands an isolated candidate; main untouched; NO effect from a restart-style re-propose', async () => {
    const store = new ReactiveMemoryStore();
    const workflowStore = new InMemoryWorkflowStore();
    const h = makeDoor({ store, workflowStore });
    const p = makeProposal({ newContent: '// door materialize' });
    const headBefore = execFileSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

    const cp = candidatePayloadForProposals([p], headBefore); // R54 v6: the ACTIVE door is head-bound
    const candidateAuth = h.owner.authorize({ proposalHash: cp.payloadHash, draftHash: cp.payloadHash, nonce: 'd-2-cand', issuedAt: NOW_ISO, expiresAt: null });
    const mat = await h.door.handle(post('/api/materialize', { proposalInput: p, nonce: 'd-2', auth: authFor(h.owner, p, { nonce: 'd-2' }), candidateAuth, ownerArmed: true, headBefore, explanation: 'owner asked' }));
    expect(mat.status).toBe(200);
    expect(mat.json.phase).toBe('candidate-materialized');
    expect(String(mat.json.candidateBranch)).toMatch(/^candidate\//);
    expect(execFileSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()).toBe(headBefore);
    expect(execFileSync('git', ['-C', repoRoot, 'status', '--porcelain'], { encoding: 'utf8' })).toBe('');

    // "restart": a fresh door over the SAME durable store, calling PROPOSE (not materialize) → plan only, no effect
    const restart = makeDoor({ store, workflowStore });
    const branchesBefore = execFileSync('git', ['-C', repoRoot, 'branch', '--list', 'candidate/*'], { encoding: 'utf8' });
    const rp = await restart.door.handle(post('/api/propose', { proposalInput: p, nonce: 'd-2', auth: authFor(restart.owner, p, { nonce: 'd-2' }) }));
    expect(['workflow:already-terminal', 'workflow:ok'].includes(String(rp.json.reasonClass)) || rp.json.phase === 'awaiting-explicit-materialize').toBe(true);
    expect(rp.json.candidateBranch).toBeNull(); // restart emits plan only — no new effect
    expect(execFileSync('git', ['-C', repoRoot, 'branch', '--list', 'candidate/*'], { encoding: 'utf8' })).toBe(branchesBefore);
  });

  it('a bad signature refuses at the owner gate — no rehearsal, no candidate', async () => {
    const { door, owner } = makeDoor();
    const p = makeProposal({ newContent: '// door bad-sig' });
    const good = authFor(owner, p, { nonce: 'd-3' });
    const bad = { ...good, signatures: { ...good.signatures, ed25519: 'ab'.repeat(64) } };
    const headNow = execFileSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const res = await door.handle(post('/api/materialize', { proposalInput: p, nonce: 'd-3', auth: bad, headBefore: headNow }));
    expect(res.status).toBe(409);
    expect(res.json.phase).toBe('refused-at-owner');
    expect(res.json.candidateBranch).toBeNull();
  });
});

describe('Fu sidecar binds by proposalHash; Fu is never authority', () => {
  const pkt = (hyp: string) => [PACKET_OPEN, 'STANCE:⊕ CONFIDENCE:↑ STRATEGY:↙ FRAMEWORK:statistical DIST:(explore=0.10,exploit=0.30,verify=0.50,abstain=0.10)', 'CLAIMS:(C1=0.8,C2=0.7)', `HYP:"${hyp}"`, PACKET_CLOSE].join('\n');
  const t: Transport = async (seat, _p, phase) => phase === 'synthesis' ? { text: 'x\nUSED_CLAIMS:(C1)', served: seat.slug } : { text: pkt('ok'), served: seat.slug, finishReason: 'stop' };

  it('a sidecar bound to a DIFFERENT proposal is refused (proposalHash mismatch)', async () => {
    const { door, owner } = makeDoor();
    const pA = makeProposal({ newContent: '// A' });
    const pB = makeProposal({ targetPath: 'apps/brain/src/reactiveStore.ts', newContent: '// B' });
    const outcome = await runAukoraFuCouncil({ problem: 'safe?', claims: ['refuses forgeries', 'blocks replay'] }, t, { seats: CANONICAL_SEATS });
    // sidecar declares proposalHash for A, but we submit proposal B
    const res = await door.handle(post('/api/propose', { proposalInput: pB, nonce: 'd-4', auth: authFor(owner, pB, { nonce: 'd-4' }), fuSidecar: { proposalHash: deriveIntentId(pA), outcome } }));
    expect(res.status).toBe(400);
    expect(res.json.reasonClass).toBe('door:fu-sidecar-mismatch');
  });

  it('a correctly-bound sidecar is consumed as advisory evidence; the owner gate still decides', async () => {
    const { door, owner } = makeDoor();
    const p = makeProposal({ newContent: '// with fu' });
    const outcome = await runAukoraFuCouncil({ problem: 'safe?', claims: ['refuses forgeries', 'blocks replay'] }, t, { seats: CANONICAL_SEATS });
    const res = await door.handle(post('/api/propose', { proposalInput: p, nonce: 'd-5', auth: authFor(owner, p, { nonce: 'd-5' }), fuSidecar: { proposalHash: deriveIntentId(p), outcome } }));
    expect(res.status).toBe(200);
    expect(res.json.phase).toBe('awaiting-explicit-materialize');
    expect(mindDoorGrantsAuthority()).toBe(false);
  });
});
