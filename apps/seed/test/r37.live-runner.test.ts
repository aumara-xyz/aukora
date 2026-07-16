// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R37 — the composed owner-invoked local ceremony, the DI provider transport (no key in repo/output), and the
 * opt-in live smoke (deterministically exercised with an injected fake HTTP layer; real network never touched).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ReactiveMemoryStore } from '@aukora/brain';
import { CANONICAL_SEATS, PACKET_OPEN, PACKET_CLOSE, runAukoraFuCouncil, type Transport } from '@aukora/council';
import {
  makeProviderTransport, redactedTransportInfo, envCredentialSource, providerTransportGrantsAuthority,
  runLocalRecursionCeremony, ceremonyWorkflowId, localCeremonyGrantsAuthority,
  runFuLiveSmoke, fuLiveSmokeGrantsAuthority,
  InMemoryWorkflowStore, deriveIntentId, deriveDraftHash,
  type CredentialSource, type ProviderTransportConfig, type HttpPost, type HttpResponse,
  type LocalCeremonyEnv, type Proposal, type RepoReadCapability, type CeremonyRunResult,
} from '../src/index.js';
import { makeWorld, makeProposal, authFor, NOW_ISO, NOW_MS, TARGET } from './support.js';

const pkt = (hyp: string) => [PACKET_OPEN,
  'STANCE:⊕ CONFIDENCE:↑ STRATEGY:↙ FRAMEWORK:statistical DIST:(explore=0.10,exploit=0.30,verify=0.50,abstain=0.10)',
  'CLAIMS:(C1=0.8,C2=0.7)', `HYP:"${hyp}"`, PACKET_CLOSE].join('\n');

const okHttp = (): HttpPost => async (_url, _headers, body) => {
  const model = (body as { model: string }).model;
  return { status: 200, ok: true, json: { model, choices: [{ message: { content: pkt(`${model} affirms`) } }], usage: { cost: 0.002 } } };
};
const config = (over: Partial<ProviderTransportConfig> = {}): ProviderTransportConfig => ({
  endpoint: 'https://provider.example/v1/chat/completions',
  credentialRef: 'AUKORA_FU_API_KEY',
  modelForSeat: Object.fromEntries(CANONICAL_SEATS.map((s) => [s.slug, s.slug])),
  maxTokens: 200,
  ...over,
});
const fixedCred = (token: string | null): CredentialSource => ({ get: () => token });

describe('provider transport — DI, non-vote on failure, no credential in output', () => {
  it('the bearer token appears ONLY in the Authorization header, never in a return value or the redactor', async () => {
    let seenAuth = '';
    const capture: HttpPost = async (_u, headers) => { seenAuth = headers.authorization ?? ''; return { status: 200, ok: true, json: { model: 'm', choices: [{ message: { content: pkt('x') } }] } }; };
    const t = makeProviderTransport(config({ httpPost: capture }), fixedCred('super-secret-token-123456'));
    const res = await t(CANONICAL_SEATS[0], 'prompt', 'round1', new AbortController().signal);
    expect(seenAuth).toBe('Bearer super-secret-token-123456');       // used in the header…
    expect(JSON.stringify(res)).not.toContain('super-secret-token');  // …never returned
    expect(redactedTransportInfo(config()).token).toBe('[redacted]');
    expect(providerTransportGrantsAuthority()).toBe(false);
  });

  it('HTTP error, malformed JSON, missing credential, and unconfigured seat all become NON-VOTE-shaped responses', async () => {
    const err: HttpPost = async () => ({ status: 500, ok: false, json: null } as HttpResponse);
    expect((await makeProviderTransport(config({ httpPost: err }), fixedCred('t'))(CANONICAL_SEATS[0], 'p', 'round1', new AbortController().signal)).served).toBeUndefined();

    const garbage: HttpPost = async () => ({ status: 200, ok: true, json: { not: 'a chat response' } });
    expect((await makeProviderTransport(config({ httpPost: garbage }), fixedCred('t'))(CANONICAL_SEATS[0], 'p', 'round1', new AbortController().signal)).text).toBe('');

    const noCred = makeProviderTransport(config({ httpPost: okHttp() }), fixedCred(null));
    expect((await noCred(CANONICAL_SEATS[0], 'p', 'round1', new AbortController().signal)).served).toBeUndefined();

    const unconfigured = makeProviderTransport(config({ httpPost: okHttp(), modelForSeat: {} }), fixedCred('t'));
    expect((await unconfigured(CANONICAL_SEATS[0], 'p', 'round1', new AbortController().signal)).text).toBe('');
  });

  it('a well-formed provider drives a REAL council pass to quorum through the transport', async () => {
    const t = makeProviderTransport(config({ httpPost: okHttp() }), fixedCred('t'));
    const outcome = await runAukoraFuCouncil({ problem: 'safe?', claims: ['refuses forgeries', 'blocks replay'] }, t, { seats: CANONICAL_SEATS });
    expect(outcome.quorumMet).toBe(true);
    expect(outcome.grantsAuthority).toBe(false);
  });
});

describe('opt-in live smoke — skipped by default, deterministic with an injected transport', () => {
  it('is SKIPPED without the opt-in flag (no call, zero cost, token redacted)', async () => {
    const res = await runFuLiveSmoke({ liveFlag: undefined, config: config(), credentials: fixedCred('t'), store: new ReactiveMemoryStore(), now: NOW_MS, nowIso: NOW_ISO });
    expect(res.skipped).toBe(true);
    expect(res.ran).toBe(false);
    expect(res.measuredUsd).toBe(0);
    expect(res.transport?.token).toBe('[redacted]');
    expect(fuLiveSmokeGrantsAuthority()).toBe(false);
  });

  it('is SKIPPED when opted-in but no credential resolves (honest refusal, no call)', async () => {
    const res = await runFuLiveSmoke({ liveFlag: '1', config: config(), credentials: fixedCred(null), store: new ReactiveMemoryStore(), now: NOW_MS, nowIso: NOW_ISO });
    expect(res.skipped).toBe(true);
    expect(res.reason).toContain('no credential');
  });

  it('RUNS to a receipted advisory verdict + measured cost when opted-in with an injected (fake) transport', async () => {
    const store = new ReactiveMemoryStore();
    const res = await runFuLiveSmoke({ liveFlag: '1', config: config({ httpPost: okHttp() }), credentials: fixedCred('t'), store, now: NOW_MS, nowIso: NOW_ISO });
    expect(res.ran).toBe(true);
    expect(res.verdict).not.toBeNull();
    expect(res.quorumMet).toBe(true);
    expect(res.measuredUsd).toBeGreaterThan(0);          // measured from usage.cost
    expect(res.transport?.token).toBe('[redacted]');
    expect(store.recall({ text: 'fu-advisory' }).length).toBe(1); // receipted
  });

  it('envCredentialSource reads a reference, never a literal', () => {
    process.env.AUKORA_TEST_CRED = 'from-env';
    expect(envCredentialSource.get('AUKORA_TEST_CRED')).toBe('from-env');
    expect(envCredentialSource.get('AUKORA_MISSING_CRED')).toBeNull();
    delete process.env.AUKORA_TEST_CRED;
  });
});

// ── composed owner-invoked ceremony over a real disposable git repo ─────────────────────────────
let base: string; let repoRoot: string; let wtBase: string;
beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), 'aukora-r37-'));
  repoRoot = join(base, 'repo'); wtBase = join(base, 'candidates');
  mkdirSync(join(repoRoot, 'apps/seed/src'), { recursive: true });
  execFileSync('git', ['init', '-q', '-b', 'main', repoRoot]);
  execFileSync('git', ['-C', repoRoot, 'config', 'user.name', 'R37']);
  execFileSync('git', ['-C', repoRoot, 'config', 'user.email', 'r37@test.local']);
  writeFileSync(join(repoRoot, TARGET), '// original\n');
  execFileSync('git', ['-C', repoRoot, 'add', '-A']);
  execFileSync('git', ['-C', repoRoot, 'commit', '-q', '--no-gpg-sign', '-m', 'init']);
});
afterAll(() => rmSync(base, { recursive: true, force: true }));

const repoCap = (): RepoReadCapability => ({ list: () => [TARGET], read: (p) => readFileSync(join(repoRoot, p), 'utf8'), exists: (p) => existsSync(join(repoRoot, p)) });

function ceremonyEnv(w: ReturnType<typeof makeWorld>, withGit: boolean): LocalCeremonyEnv {
  return {
    recursionEnv: w.env,
    workflowStore: new InMemoryWorkflowStore(),
    repo: repoCap(),
    ownerRoot: w.owner.root,
    store: w.env.store,
    ...(withGit ? { gitRepoRoot: repoRoot, worktreeBase: wtBase } : {}),
    nowMs: NOW_MS, nowIso: NOW_ISO,
  };
}

describe('composed owner-invoked local ceremony', () => {
  it('propose → owner verify → rehearsed; no effect without an explicit materialize', () => {
    const w = makeWorld();
    const env = ceremonyEnv(w, true);
    const proposal = makeProposal({ newContent: '// ceremony refine' });
    const auth = authFor(w.owner, proposal, { nonce: 'cer-1' });

    const out = runLocalRecursionCeremony(env, { proposalInput: proposal, nonce: 'cer-1', auth, materialize: false });
    expect(out.ok).toBe(true);
    expect(out.phase).toBe('awaiting-explicit-materialize'); // owner-verified + rehearsed, but NO effect
    expect(out.rehearsalReceiptHash).toMatch(/^[0-9a-f]{64}$/);
    expect(out.materialization).toBeNull();
    expect(out.signed).toBe(false);
    expect(out.pushed).toBe(false);
    expect(out.touchedMain).toBe(false);
    expect(localCeremonyGrantsAuthority()).toBe(false);
  });

  it('materialize:true + fresh AUMLOK verification lands an isolated candidate; main untouched', () => {
    const w = makeWorld();
    const env = ceremonyEnv(w, true);
    const proposal = makeProposal({ newContent: '// ceremony materialize' });
    const auth = authFor(w.owner, proposal, { nonce: 'cer-2' });
    const headBefore = execFileSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

    const out = runLocalRecursionCeremony(env, { proposalInput: proposal, nonce: 'cer-2', auth, materialize: true, explanation: 'owner-invoked' });
    expect(out.ok).toBe(true);
    expect(out.phase).toBe('candidate-materialized');
    expect(out.materialization?.commitSha).toMatch(/^[0-9a-f]{40}$/);
    expect(out.materialization?.pushed).toBe(false);
    expect(out.materialization?.merged).toBe(false);
    // isolation: main + primary tree untouched
    expect(execFileSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()).toBe(headBefore);
    expect(execFileSync('git', ['-C', repoRoot, 'status', '--porcelain'], { encoding: 'utf8' })).toBe('');
    expect(readFileSync(join(repoRoot, TARGET), 'utf8')).toBe('// original\n');
  });

  it('refuses at the owner gate without a valid signature — no rehearsal, no candidate', () => {
    const w = makeWorld();
    const env = ceremonyEnv(w, true);
    const proposal = makeProposal({ newContent: '// no auth' });
    const badAuth = { ...authFor(w.owner, proposal, { nonce: 'cer-3' }), signatures: { ...authFor(w.owner, proposal, { nonce: 'cer-3' }).signatures, ed25519: 'ab'.repeat(64) } };
    const out = runLocalRecursionCeremony(env, { proposalInput: proposal, nonce: 'cer-3', auth: badAuth, materialize: true });
    expect(out.ok).toBe(false);
    expect(out.phase).toBe('refused-at-owner');
    expect(out.materialization).toBeNull();
  });

  it('NEVER auto-resumes an effect after restart: a re-run over the same durable state materializes nothing unless explicitly asked', () => {
    const w = makeWorld();
    const store = new InMemoryWorkflowStore();
    const shared: LocalCeremonyEnv = { ...ceremonyEnv(w, true), workflowStore: store };
    const proposal = makeProposal({ newContent: '// restart' });
    const auth = authFor(w.owner, proposal, { nonce: 'cer-4' });

    // first invocation applies + rehearses but does NOT materialize (no explicit flag)
    const first = runLocalRecursionCeremony(shared, { proposalInput: proposal, nonce: 'cer-4', auth, materialize: false });
    expect(first.phase).toBe('awaiting-explicit-materialize');

    // "restart": a fresh runner over the SAME durable store, no materialize flag → still no effect
    const restart = runLocalRecursionCeremony({ ...shared }, { proposalInput: proposal, nonce: 'cer-4', auth, materialize: false });
    expect(restart.phase === 'awaiting-explicit-materialize' || restart.reasonClass === 'workflow:already-terminal').toBe(true);
    expect(restart.materialization).toBeNull();
    // git shows no candidate branch was created by any restart
    const branches = execFileSync('git', ['-C', repoRoot, 'branch', '--list', 'candidate/*'], { encoding: 'utf8' });
    expect(branches).not.toContain(ceremonyWorkflowId(proposal, 'cer-4').slice(0, 12));
  });
});
