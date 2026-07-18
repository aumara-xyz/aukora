// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R49 — the complete REAL HTTP ceremony over loopback (issue #22 R49; closes the recursion side of issue #87).
 *
 * Two halves:
 *   1. refused ≠ conflict, NAMED (#87): the live symptom — a nonce-less `POST /api/propose` surfacing as
 *      `workflow:store-conflict` — is pinned to its exact field (`nonce`, coerced to '' at the door) and now names
 *      itself: `door:nonce-missing` at the door, `workflow:state-refused:<field>` at the machine. A GENUINE
 *      OCC conflict still reports `workflow:store-conflict` (the distinction is preserved, per the R49 directive).
 *   2. the smallest complete LIVE loopback sequence over a REAL 127.0.0.1 socket: tokened /api/propose →
 *      durable awaiting-owner → fresh byte-bound hybrid AUMLOK authorization → explicit /api/materialize →
 *      DISPOSABLE candidate worktree only → receipts/plan projection. With controls: main HEAD/tree byte-identical,
 *      no remote exists to push/merge to, replay inert, stale/forged authorization refused, restart (fresh door,
 *      same durable stores, same port) emits the PLAN only with byte-identical durable state, and NO key/signature/
 *      token bytes in any response, receipt, or persisted row.
 *
 * Everything is offline: the only socket is 127.0.0.1 on an ephemeral port, inside this process.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ReactiveMemoryStore } from '@aukora/brain';
import {
  MindDoor, InMemoryWorkflowStore, HybridOwnerAdapter, RecursionLedger, CandidateReferenceMonitor,
  DurableRecursion, explainWorkflowState, candidatePayloadForProposals, LIMITS,
  type DoorRequest, type DoorDriver, type LocalCeremonyEnv, type RepoReadCapability,
  type WorkflowStore, type WorkflowStateV1, type SaveResult, type OwnerAuthorization,
} from '../src/index.js';
import { makeProposal, makeWorld, authFor, NOW_ISO, NOW_MS, TARGET } from './support.js';

const TOKEN = 'r49-live-door-fixed-for-tests-00';

// ── half 1: refused ≠ conflict, with the failing field NAMED (machine level) ────────────────────

class RefuseOnCreateStore implements WorkflowStore {
  load(): WorkflowStateV1 | null { return null; }
  save(): SaveResult { return { ok: false, reason: 'refused' }; }
}
class ConflictOnCreateStore implements WorkflowStore {
  load(): WorkflowStateV1 | null { return null; }
  save(): SaveResult { return { ok: false, reason: 'conflict' }; }
}

describe('R49 · #87 — validation refusals name their exact field; conflicts stay conflicts', () => {
  it('the LIVE reproducer, pinned: an empty nonce is workflow:state-refused:nonce (was workflow:store-conflict)', () => {
    const machine = new DurableRecursion(new InMemoryWorkflowStore(), makeWorld().env);
    const out = machine.propose(makeProposal(), ''); // exactly what the door used to feed downstream on a nonce-less body
    expect(out.ok).toBe(false);
    expect(out.reasonClass).toBe('workflow:state-refused:nonce'); // the exact live field, named
    expect(out.state).toBe(null);
  });

  it('a store whose OWN validator refuses a locally-valid state names the divergence: store-validator', () => {
    const out = new DurableRecursion(new RefuseOnCreateStore(), makeWorld().env).propose(makeProposal(), 'r49-m1');
    expect(out.ok).toBe(false);
    expect(out.reasonClass).toBe('workflow:state-refused:store-validator');
    expect(out.state).toBe(null);
  });

  it('a GENUINE conflict on create still reports workflow:store-conflict — the distinction is preserved', () => {
    const out = new DurableRecursion(new ConflictOnCreateStore(), makeWorld().env).propose(makeProposal(), 'r49-m2');
    expect(out.ok).toBe(false);
    expect(out.reasonClass).toBe('workflow:store-conflict');
    expect(out.state).toBe(null);
  });

  it('explainWorkflowState names the first failing check with content-free labels', () => {
    const store = new InMemoryWorkflowStore();
    const good = new DurableRecursion(store, makeWorld().env).propose(makeProposal(), 'r49-m3').state as WorkflowStateV1;
    expect(explainWorkflowState(good).ok).toBe(true);
    expect(explainWorkflowState(null)).toEqual({ ok: false, field: 'not-an-object' });
    expect(explainWorkflowState({ ...good, nonce: '' })).toEqual({ ok: false, field: 'nonce' });
    expect(explainWorkflowState({ ...good, signature: 'deadbeef' })).toEqual({ ok: false, field: 'key-set' }); // smuggled key
    expect(explainWorkflowState({ ...good, grantsAuthority: true })).toEqual({ ok: false, field: 'authority-flags' });
    expect(explainWorkflowState({ ...good, updatedAtIso: 7 })).toEqual({ ok: false, field: 'timestamps' });

    // Key-count checks alone do not prove density: `length` + `extra` can replace
    // the missing index while Array#some/every silently skips the hole.
    const sparseRefusals = Array<string>(1);
    (sparseRefusals as string[] & { extra: string }).extra = 'benign';
    expect(explainWorkflowState({ ...good, refusals: sparseRefusals })).toEqual({ ok: false, field: 'refusals' });
  });
});

// ── half 2: the complete live loopback ceremony over a REAL socket ───────────────────────────────

let base: string; let repoRoot: string; let wtBase: string;
let store: ReactiveMemoryStore; let workflowStore: InMemoryWorkflowStore; let ledger: RecursionLedger;
let owner: HybridOwnerAdapter; let monitor: CandidateReferenceMonitor;
let door: MindDoor; let server: Server; let port: number;
const doors: MindDoor[] = [];
const transcript: string[] = [];      // every RESPONSE body that crossed the wire
const sensitiveHex: string[] = [];    // every signature actually minted this run (ML-DSA signing is randomized)

function mkAuth(proposal: ReturnType<typeof makeProposal>, over: Parameters<typeof authFor>[2] = {}): OwnerAuthorization {
  const auth = authFor(owner, proposal, over);
  sensitiveHex.push(auth.signatures.ed25519, auth.signatures.mlDsa65);
  return auth;
}

const repoCap = (): RepoReadCapability => ({
  list: () => [TARGET],
  read: (p) => readFileSync(join(repoRoot, p), 'utf8'),
  exists: (p) => existsSync(join(repoRoot, p)),
});

const makeDriver = async (): Promise<DoorDriver> => {
  const recursionEnv = { store, knownFiles: new Set([TARGET]), ownerRoot: owner.root, ledger, nowMs: NOW_MS, nowIso: NOW_ISO, deadlineMs: NOW_MS + LIMITS.DEFAULT_WALL_TIME_BUDGET_MS };
  const ceremonyEnv: LocalCeremonyEnv = { recursionEnv, workflowStore, repo: repoCap(), ownerRoot: owner.root, store, monitor, gitRepoRoot: repoRoot, worktreeBase: wtBase, nowMs: NOW_MS, nowIso: NOW_ISO };
  return { ceremonyEnv };
};

function newDoor(): MindDoor {
  const d = new MindDoor({ store, ownerRoot: owner.root, loadDriver: makeDriver, postToken: TOKEN, nowIso: NOW_ISO, port });
  doors.push(d);
  return d;
}

function git(...args: string[]): string {
  return execFileSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8' });
}

async function post(path: string, body: unknown, headers: Record<string, string> = {}): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-aukora-door-token': TOKEN, ...headers },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  transcript.push(`${path} ${res.status} ${raw}`);
  return { status: res.status, json: JSON.parse(raw) as Record<string, unknown> };
}

beforeAll(async () => {
  // realpath: on macOS tmpdir() is a symlink (/var → /private/var) and git reports canonical worktree paths.
  base = realpathSync(mkdtempSync(join(tmpdir(), 'aukora-r49-')));
  repoRoot = join(base, 'repo'); wtBase = join(base, 'candidates');
  mkdirSync(join(repoRoot, 'apps/seed/src'), { recursive: true });
  execFileSync('git', ['init', '-q', '-b', 'main', repoRoot]);
  git('config', 'user.name', 'R49');
  git('config', 'user.email', 'r49@test.local');
  writeFileSync(join(repoRoot, TARGET), '// original\n');
  git('add', '-A');
  git('commit', '-q', '--no-gpg-sign', '-m', 'init');

  store = new ReactiveMemoryStore();
  workflowStore = new InMemoryWorkflowStore();
  ledger = new RecursionLedger();
  owner = new HybridOwnerAdapter('r49-live-door');
  monitor = new CandidateReferenceMonitor(owner.root);

  // A REAL loopback HTTP server — the same adapter shape as scripts/mind-door-7097.ts, on an ephemeral port.
  // The handler routes to the CURRENT `door`, so the restart test can swap in a fresh door behind the same port.
  server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c as Buffer));
    req.on('end', () => {
      let body: unknown;
      try { body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined; } catch { body = undefined; }
      const headers: Record<string, string | undefined> = {};
      for (const [k, v] of Object.entries(req.headers)) headers[k] = Array.isArray(v) ? v.join(',') : v;
      const doorReq: DoorRequest = { method: req.method ?? 'GET', path: (req.url ?? '/').split('?')[0], headers, body };
      door.handle(doorReq).then((out) => {
        res.writeHead(out.status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        res.end(JSON.stringify(out.json));
      }).catch(() => { res.writeHead(500); res.end('{"error":"door error"}'); });
    });
  });
  await new Promise<void>((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  port = (server.address() as AddressInfo).port;
  door = newDoor();
});

afterAll(async () => {
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  rmSync(base, { recursive: true, force: true });
});

describe('R49 · the complete live loopback ceremony (real 127.0.0.1 socket)', () => {
  const p1 = makeProposal({ newContent: '// r49 live crossing\n' });
  const N1 = 'r49-live-nonce-1';
  let headBefore = '';
  let workflowId = '';
  let candidateBranch = '';
  let branchesAfterMaterialize = '';
  let materializeBody: Record<string, unknown> = {};

  it('CONTROLS over the wire: tokenless and cross-origin posts refuse visibly with stable classes', async () => {
    headBefore = git('rev-parse', 'HEAD').trim();
    const noToken = await post('/api/propose', { proposalInput: p1, nonce: N1 }, { 'x-aukora-door-token': '' });
    expect(noToken.status).toBeGreaterThanOrEqual(400);
    expect(noToken.json.reasonClass).toBe('guard:missing-or-bad-token');
    const evil = await post('/api/chat', { text: 'hi' }, { origin: 'https://evil.example' });
    expect(evil.status).toBeGreaterThanOrEqual(400);
    expect(evil.json.reasonClass).toBe('guard:origin-not-allowed');
  });

  it('the R47/R48 live symptom now names itself: a nonce-less tokened propose → door:nonce-missing (not store-conflict)', async () => {
    const res = await post('/api/propose', { proposalInput: p1 }); // Sam 1's reproducer shape: well-formed, NO nonce
    expect(res.status).toBe(400);
    expect(res.json.reasonClass).toBe('door:nonce-missing');
    expect(String(res.json.error)).toContain('nonce');
    expect(res.json.eventReceipt).toBeTruthy(); // refusal receipted
  });

  it('an OVERSIZED nonce (129 chars) refuses with its own distinct class: door:nonce-too-long', async () => {
    const res = await post('/api/propose', { proposalInput: p1, nonce: 'a'.repeat(129) });
    expect(res.status).toBe(400);
    expect(res.json.reasonClass).toBe('door:nonce-too-long'); // not conflated with door:nonce-missing
    expect(res.json.eventReceipt).toBeTruthy(); // refusal receipted
  });

  it('tokened /api/propose (no authorization yet) → the workflow is DURABLY awaiting-owner', async () => {
    const res = await post('/api/propose', { proposalInput: p1, nonce: N1 });
    expect(res.status).toBe(409);
    expect(res.json.phase).toBe('refused-at-owner');
    expect(res.json.reasonClass).toBe('refused-owner-gate'); // retryable: the durable workflow WAITS for the owner
    workflowId = String(res.json.workflowId);
    const row = workflowStore.load(workflowId);
    expect(row?.phase).toBe('awaiting-owner'); // durable awaiting-owner, over the wire
    expect(row?.grantsAuthority).toBe(false);
  });

  it('a FRESH byte-bound hybrid AUMLOK authorization completes the durable step — still ZERO effect', async () => {
    const res = await post('/api/propose', { proposalInput: p1, nonce: N1, auth: mkAuth(p1, { nonce: N1 }) });
    expect(res.status).toBe(200);
    expect(res.json.phase).toBe('awaiting-explicit-materialize');
    expect(res.json.rehearsalReceiptPrefix).toBeTruthy();
    expect(res.json.candidateBranch).toBeNull();
    expect(res.json.signed).toBe(false);
    expect(git('rev-parse', 'HEAD').trim()).toBe(headBefore);
    expect(git('branch', '--list', 'candidate/*').trim()).toBe(''); // no effect without the explicit invocation
  });

  it('explicit /api/materialize lands the candidate in a DISPOSABLE worktree only; main stays byte-identical', async () => {
    const cp = candidatePayloadForProposals([p1], headBefore); // R54 v6: the ACTIVE door is head-bound
    const candidateAuth = owner.authorize({ proposalHash: cp.payloadHash, draftHash: cp.payloadHash, nonce: `${N1}-cand`, issuedAt: NOW_ISO, expiresAt: null });
    sensitiveHex.push(candidateAuth.signatures.ed25519, candidateAuth.signatures.mlDsa65);
    materializeBody = { proposalInput: p1, nonce: N1, auth: mkAuth(p1, { nonce: N1 }), candidateAuth, ownerArmed: true, headBefore, explanation: 'r49 live loopback ceremony' };
    const res = await post('/api/materialize', materializeBody);
    expect(res.status).toBe(200);
    expect(res.json.phase).toBe('candidate-materialized');
    candidateBranch = String(res.json.candidateBranch);
    expect(candidateBranch).toMatch(/^candidate\//);
    expect(String(res.json.candidateCommitPrefix)).toMatch(/^[0-9a-f]{12}$/);
    expect(res.json.touchedMain).toBe(false);

    // main HEAD + tree byte-identical; the ONLY new ref is the candidate branch; worktree is OUTSIDE the repo root
    expect(git('rev-parse', 'HEAD').trim()).toBe(headBefore);
    expect(git('status', '--porcelain')).toBe('');
    expect(readFileSync(join(repoRoot, TARGET), 'utf8')).toBe('// original\n');
    const worktrees = git('worktree', 'list', '--porcelain').split('\n').filter((l) => l.startsWith('worktree ')).map((l) => l.slice('worktree '.length));
    const candidateWt = worktrees.find((w) => w.startsWith(wtBase));
    expect(candidateWt).toBeTruthy();
    // byte-bound: the candidate worktree carries EXACTLY the authorized draft bytes
    expect(readFileSync(join(candidateWt as string, TARGET), 'utf8')).toBe(p1.newContent);
    branchesAfterMaterialize = git('branch', '--list', 'candidate/*');
  });

  it('no push/merge is even possible: the repo has NO remote, and main’s log is untouched', () => {
    expect(git('remote').trim()).toBe('');
    expect(git('rev-list', '--count', 'main').trim()).toBe('1'); // still only the init commit on main
  });

  it('REPLAY of the exact same materialize is inert: refused, no second worktree/branch, main unchanged', async () => {
    const res = await post('/api/materialize', materializeBody);
    expect(res.json.ok).toBe(false);
    expect(res.json.phase).toBe('refused-at-candidate');
    expect(git('branch', '--list', 'candidate/*')).toBe(branchesAfterMaterialize);
    expect(git('rev-parse', 'HEAD').trim()).toBe(headBefore);
  });

  it('a FORGED authorization (one nibble flipped, correct length) refuses with zero effect', async () => {
    const p2 = makeProposal({ newContent: '// r49 forged attempt\n' });
    const good = mkAuth(p2, { nonce: 'r49-live-nonce-2' });
    const sig = good.signatures.ed25519;
    const forged = { ...good, signatures: { ...good.signatures, ed25519: (sig[0] === 'a' ? 'b' : 'a') + sig.slice(1) } };
    const res = await post('/api/materialize', { proposalInput: p2, nonce: 'r49-live-nonce-2', auth: forged, ownerArmed: true, headBefore });
    expect(res.status).toBe(409);
    expect(res.json.phase).toBe('refused-at-owner');
    expect(res.json.candidateBranch).toBeNull();
    expect(git('branch', '--list', 'candidate/*')).toBe(branchesAfterMaterialize);
  });

  it('a STALE (expired) authorization refuses with zero effect', async () => {
    const p2 = makeProposal({ newContent: '// r49 forged attempt\n' });
    const stale = mkAuth(p2, { nonce: 'r49-live-nonce-2', expiresAt: '2026-07-16T11:00:00.000Z' }); // before NOW_ISO
    const res = await post('/api/propose', { proposalInput: p2, nonce: 'r49-live-nonce-2', auth: stale });
    expect(res.json.ok).toBe(false);
    expect(res.json.phase).toBe('refused-at-owner');
    expect(git('branch', '--list', 'candidate/*')).toBe(branchesAfterMaterialize);
  });

  it('RESTART: a fresh door over the SAME durable stores (same port) emits the PLAN only; durable state byte-identical', async () => {
    const rowBefore = workflowStore.load(workflowId);
    door = newDoor(); // fresh MindDoor instance behind the same socket — a supervisor respawn
    const res = await post('/api/propose', { proposalInput: p1, nonce: N1, auth: mkAuth(p1, { nonce: N1 }) });
    expect(res.status).toBe(200);
    expect(res.json.phase).toBe('awaiting-explicit-materialize'); // PLAN only
    expect(res.json.candidateBranch).toBeNull();                  // NO auto-resumed effect
    expect(git('branch', '--list', 'candidate/*')).toBe(branchesAfterMaterialize);
    expect(workflowStore.load(workflowId)).toEqual(rowBefore);    // restart state identical
  });

  it('TRANSCRIPT HYGIENE: no signature, key, or token bytes in any response, door receipt, or durable row', () => {
    const everything = [
      transcript.join('\n'),
      JSON.stringify(doors.map((d) => d.events())),
      JSON.stringify(workflowStore.load(workflowId)),
      store.recall({ text: 'door-event' }).map((r) => r.content).join('\n'),
    ].join('\n');
    expect(sensitiveHex.length).toBeGreaterThanOrEqual(8); // signatures were really minted this run
    for (const forbiddenValue of [...sensitiveHex, owner.root.publicKeys.ed25519, owner.root.publicKeys.mlDsa65, TOKEN]) {
      expect(everything.includes(forbiddenValue)).toBe(false);
    }
  });

  it('receipts/live projection: the door status + event stream advanced, every terminal receipted', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/door`);
    const raw = await res.text();
    transcript.push(`/api/door ${res.status} ${raw}`);
    const json = JSON.parse(raw) as Record<string, unknown>;
    expect(res.status).toBe(200);
    expect(json.grantsAuthority).toBe(false);
    const kinds = doors.flatMap((d) => d.events().map((e) => e.kind));
    for (const expected of ['refused', 'proposed', 'materialized']) expect(kinds).toContain(expected);
    expect(doors.flatMap((d) => d.events()).every((e) => e.receiptHash === null || /^[0-9a-f]{64}$/.test(e.receiptHash))).toBe(true);
  });
});
