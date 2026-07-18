// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R54 — PROTECTED PRIMARY-DOOR AUTHORITY BRICK acceptance suite.
 *
 * The live path (mindDoor → localCeremonyRunner → durableRecursion → localCandidateStage) now consumes the
 * owner's candidate authorization through the DURABLE reference monitor (`DurableCandidateReferenceMonitor` over
 * `@aukora/kernel-node`'s crash-safe TrustedStateStore) at stage step 4b — BEFORE the attempt receipt and every
 * git mutation. Convex receives only projections afterward. This suite proves the owner's acceptance list:
 *   1. valid owner authorization → exactly one durable PREPARED (real git repo, real hybrid signature);
 *   2. the same authorization after REAL SIGKILL / restart → replay refusal (separate OS process, kill -9);
 *   3. disk/journal failure → NO git effect and NO "applied"/materialized projection;
 *   4. stale/forged/expired authorization → no durable mutation;
 *   5. two concurrent attempts (separate OS processes) → exactly one winner;
 *   6. AUMLOK v2 vectors byte-identical (kernel suite — re-run alongside this one);
 *   7. no key / signature / proposal plaintext in the durable trusted state or any Convex-bound surface;
 *   8. exact primary-runtime import/reachability proof (door boot reaches kernel-node; Convex handlers never do).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, execFileSync } from 'node:child_process';
import { buildSync } from 'esbuild';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, readdirSync, type Dirent } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ReactiveMemoryStore } from '@aukora/brain';
import { runLocalRecursionCeremony, type LocalCeremonyEnv, type LocalCeremonyInvocation } from '../src/localCeremonyRunner.js';
import { DurableCandidateReferenceMonitor } from '../src/durableCandidateMonitor.js';
import { candidatePayloadForProposals, candidatePayloadHash } from '../src/candidateReferenceMonitor.js';
import { InMemoryWorkflowStore } from '../src/durableRecursion.js';
import { HybridOwnerAdapter } from '../src/ownerFixture.js';
import type { BranchCandidate } from '../src/ideEnvelope.js';
import { makeWorld, makeProposal, authFor, NOW_MS, NOW_ISO } from './support.js';

const g = (cwd: string, args: string[]) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();
const tryG = (cwd: string, args: string[]) => { try { return g(cwd, args); } catch { return null; } };

let base: string; let repoRoot: string; let wtBase: string; let CHILD = '';
beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), 'aukora-r54-'));
  repoRoot = join(base, 'repo');
  wtBase = join(base, 'candidates');
  mkdirSync(repoRoot, { recursive: true });
  execFileSync('git', ['init', '-q', '-b', 'main', repoRoot]);
  g(repoRoot, ['config', 'user.name', 'R54 Test']);
  g(repoRoot, ['config', 'user.email', 'r54@test.local']);
  mkdirSync(join(repoRoot, 'apps/seed/src'), { recursive: true });
  writeFileSync(join(repoRoot, 'apps/seed/src/recursion.ts'), '// original content\n');
  g(repoRoot, ['add', '-A']);
  g(repoRoot, ['commit', '-q', '--no-gpg-sign', '-m', 'init']);
  // bundle the child harness to plain ESM once (bare-node spawn — Node 20 + 22, no experimental flags)
  CHILD = join(base, 'r54-child.mjs');
  buildSync({
    entryPoints: [fileURLToPath(new URL('./r54-child.ts', import.meta.url))],
    outfile: CHILD, bundle: true, platform: 'node', format: 'esm', target: 'node18',
  });
});
afterAll(() => { rmSync(base, { recursive: true, force: true }); });

/** A full live-path ceremony env over a REAL git repo + a durable trusted-state dir. */
function ceremonyEnv(stateDir: string, over: Partial<LocalCeremonyEnv> = {}): { env: LocalCeremonyEnv; w: ReturnType<typeof makeWorld> } {
  const w = makeWorld({ ownerLabel: 'r54-owner' }); // deterministic owner — replays reconstruct the same root
  const env: LocalCeremonyEnv = {
    recursionEnv: w.env,
    workflowStore: new InMemoryWorkflowStore(),
    repo: { list: () => [], read: (p: string) => readFileSync(join(repoRoot, p), 'utf8'), exists: (p: string) => existsSync(join(repoRoot, p)) },
    ownerRoot: w.owner.root,
    store: new ReactiveMemoryStore(),
    trustedStateDir: stateDir,
    gitRepoRoot: repoRoot,
    worktreeBase: wtBase,
    nowMs: NOW_MS, nowIso: NOW_ISO,
    ...over,
  };
  return { env, w };
}

/** One owner-armed materializing invocation: proposal auth + candidate auth from the same deterministic owner.
 *  R54 v6: the ACTIVE door is mandatorily head-bound — the candidate auth signs the head-bound payload and the
 *  invocation carries the same approved base. */
function invocationFor(w: ReturnType<typeof makeWorld>, nonce: string, candNonce: string, over: Partial<LocalCeremonyInvocation> = {}): LocalCeremonyInvocation {
  const proposal = makeProposal({ newContent: `// r54 governed refinement (${nonce})` });
  const approvedHead = g(repoRoot, ['rev-parse', 'HEAD']);
  const { payloadHash } = candidatePayloadForProposals([proposal], approvedHead);
  const candidateAuth = w.owner.authorize({ proposalHash: payloadHash, draftHash: payloadHash, nonce: candNonce, issuedAt: NOW_ISO, expiresAt: null });
  return { proposalInput: proposal, nonce, auth: authFor(w.owner, proposal, { nonce: `${nonce}-owner` }), materialize: true, candidateAuth, ownerArmed: true, expectedHeadBefore: approvedHead, ...over };
}

const readState = (dir: string) => JSON.parse(readFileSync(join(dir, 'trusted-state.json'), 'utf8'));
const cleanupCandidate = (branch: string, worktree: string) => {
  tryG(repoRoot, ['worktree', 'remove', '--force', worktree]);
  tryG(repoRoot, ['branch', '-D', branch]);
};

describe('R54 · 1+7: a valid owner authorization → exactly ONE durable PREPARED, content-free on disk', () => {
  it('materializes through the durable monitor and journals the consumption BEFORE git ran', () => {
    const stateDir = join(base, 'state-accept');
    const { env, w } = ceremonyEnv(stateDir);
    const res = runLocalRecursionCeremony(env, invocationFor(w, 'r54-n1', 'r54-cand-1'));
    expect(res.phase).toBe('candidate-materialized');
    expect(res.ok).toBe(true);
    // exactly one durable PREPARED, bound by hash to THIS candidate effect
    const persisted = readState(stateDir);
    expect(persisted.prepared).toHaveLength(1);
    expect(persisted.state.consumedIds).toEqual(['r54-cand-1']);
    expect(persisted.state.receiptHead.count).toBe(1);
    expect(persisted.prepared[0].descriptorKind).toBe('git-candidate');
    expect(persisted.prepared[0].targetPath).toBe(res.materialization!.branch);
    // the git effect actually happened (branch exists) — and the durable row precedes it by construction
    expect(tryG(repoRoot, ['rev-parse', '--verify', `refs/heads/${res.materialization!.branch}`])).not.toBeNull();
    // 7: NOTHING secret in the durable state: no signatures, no private keys, no proposal text
    const raw = readFileSync(join(stateDir, 'trusted-state.json'), 'utf8');
    expect(raw).not.toMatch(/"signatures"|secretKey|privateKey|BEGIN |newContent|governed refinement/);
    cleanupCandidate(res.materialization!.branch!, res.materialization!.worktreePath!);
  });

  it('a SECOND ceremony reusing the same candidate authorization replays against the DURABLE state (fresh process-equivalent)', () => {
    const stateDir = join(base, 'state-replay');
    const first = ceremonyEnv(stateDir);
    const inv = invocationFor(first.w, 'r54-n2', 'r54-cand-2');
    const res1 = runLocalRecursionCeremony(first.env, inv);
    expect(res1.phase).toBe('candidate-materialized');
    // remove the branch + worktree so the git prechecks CANNOT be the refusal — only durable replay can refuse
    cleanupCandidate(res1.materialization!.branch!, res1.materialization!.worktreePath!);
    // a completely fresh env (new monitor instance, new ledger, new stores) over the SAME trusted-state dir
    const second = ceremonyEnv(stateDir);
    const res2 = runLocalRecursionCeremony(second.env, { ...inv, auth: authFor(second.w.owner, inv.proposalInput as never, { nonce: 'r54-n2-owner-b' }) });
    expect(res2.phase).toBe('refused-at-candidate');
    expect(res2.text).toContain('replay');
    // still exactly one durable consumption — never doubled
    expect(readState(stateDir).state.receiptHead.count).toBe(1);
    expect(tryG(repoRoot, ['rev-parse', '--verify', `refs/heads/${res1.materialization!.branch}`])).toBeNull();
  });
});

describe('R54 · 3: disk/journal failure → NO git effect, NO materialized projection, nothing consumed', () => {
  it('a crash at the atomic-rename journal step refuses the ceremony before any git mutation', () => {
    const stateDir = join(base, 'state-crash');
    const { env, w } = ceremonyEnv(stateDir, {});
    const crashing = new DurableCandidateReferenceMonitor(w.owner.root, stateDir, (label) => { if (label === 'rename') throw new Error('injected disk failure'); });
    const res = runLocalRecursionCeremony({ ...env, monitor: crashing }, invocationFor(w, 'r54-n3', 'r54-cand-3'));
    expect(res.phase).toBe('refused-at-candidate');
    expect(res.text).toContain('trusted_state_unavailable');
    expect(res.materialization?.ok ?? false).toBe(false);          // no materialized projection anywhere
    expect(existsSync(join(stateDir, 'trusted-state.json'))).toBe(false); // crash before rename ⇒ nothing durable
    // NO candidate branch and NO worktree were ever created
    expect(g(repoRoot, ['branch', '--list', 'candidate/*'])).toBe('');
    expect(g(repoRoot, ['worktree', 'list'])).not.toContain('wt-');
  });
});

describe('R54 · 4: stale/forged/expired authorization → no durable mutation', () => {
  const cases: readonly { name: string; tag: string; mutate: (inv: LocalCeremonyInvocation, w: ReturnType<typeof makeWorld>) => LocalCeremonyInvocation }[] = [
    {
      name: 'FORGED (one nibble of the ML-DSA half flipped)', tag: 'forged',
      mutate: (inv) => {
        const a = inv.candidateAuth!;
        const orig = a.signatures.mlDsa65;
        return { ...inv, candidateAuth: { ...a, signatures: { ...a.signatures, mlDsa65: (orig[0] === '0' ? '1' : '0') + orig.slice(1) } } };
      },
    },
    {
      name: 'EXPIRED (authorization TTL in the past)', tag: 'expired',
      mutate: (inv, w) => {
        const ph = candidatePayloadForProposals([inv.proposalInput as never]).payloadHash;
        return { ...inv, candidateAuth: w.owner.authorize({ proposalHash: ph, draftHash: ph, nonce: 'r54-cand-expired', issuedAt: '2026-07-01T00:00:00.000Z', expiresAt: '2026-07-02T00:00:00.000Z' }) };
      },
    },
    {
      name: 'STALE HEAD (approved against a head the repo has moved past)', tag: 'stale',
      mutate: (inv) => ({ ...inv, expectedHeadBefore: 'f'.repeat(40) }),
    },
  ];
  for (const c of cases) {
    it(`${c.name} refuses with zero durable mutation and zero git effect`, () => {
      const stateDir = join(base, `state-${c.tag}`);
      const { env, w } = ceremonyEnv(stateDir);
      // nonces stay in the kernel's lowercase identifier charset — an uppercase tag would malform the AUTH itself
      const res = runLocalRecursionCeremony(env, c.mutate(invocationFor(w, `r54-${c.tag}`, `r54-cand-${c.tag}`), w));
      expect(res.phase).toBe('refused-at-candidate');
      // nothing durable was written (or, for stale-head, the store was never even reached)
      expect(existsSync(join(stateDir, 'trusted-state.json'))).toBe(false);
      expect(g(repoRoot, ['branch', '--list', 'candidate/*'])).toBe('');
    });
  }
});

describe('R54 · 2+5 LIVE: real process death + concurrent OS processes (bare-node bundled child)', () => {
  it('[LIVE] consumed candidate authority survives a REAL kill -9 — a fresh process replays', async () => {
    const stateDir = join(base, 'state-sigkill');
    const child = spawn(process.execPath, [CHILD, stateDir, 'auth-sigkill', 'commit-hang'], { stdio: ['ignore', 'pipe', 'pipe'] });
    const line = await new Promise<string>((resolve, reject) => {
      let buf = '';
      child.stdout!.on('data', (d) => { buf += d.toString(); const nl = buf.indexOf('\n'); if (nl >= 0) resolve(buf.slice(0, nl).trim()); });
      child.on('close', () => { if (buf.trim()) resolve(buf.trim()); else reject(new Error('child exited with no output')); });
      child.on('error', reject);
    });
    expect(line).toBe('COMMITTED:1');                 // the child fsync-committed the consumption, then hangs
    child.kill('SIGKILL');                             // REAL process death
    await new Promise<void>((r) => child.on('close', () => r()));
    // a FRESH process (this one) rebuilds the same deterministic owner + authorization and replays
    const owner = new HybridOwnerAdapter('r54-child');
    const candidate = {
      schema: 'aukora-branch-candidate-v1', candidateId: 'ab'.repeat(32),
      workspace: new Map([['apps/seed/src/notes.ts', '// c']]),
      files: [{ path: 'apps/seed/src/notes.ts', intentId: 'cd'.repeat(32), draftHash: 'ef'.repeat(32), diff: '', receiptHash: 'ab'.repeat(32) }],
      explanation: 'x', lineage: [{ intentId: 'cd'.repeat(32), depth: 0 }],
      staged: true, pushed: false, signed: false, merged: false, deployed: false, grantsAuthority: false,
    } as unknown as BranchCandidate;
    const ph = candidatePayloadHash(candidate);
    const auth = owner.authorize({ proposalHash: ph, draftHash: ph, nonce: 'auth-sigkill', issuedAt: NOW_ISO, expiresAt: null });
    const fresh = new DurableCandidateReferenceMonitor(owner.root, stateDir);
    const replay = fresh.decide(candidate, auth, NOW_MS, { ownerArmed: true });
    expect(replay.allowed).toBe(false);
    expect(replay.code).toBe('replay');               // consumed authority REMAINS consumed across real death
    expect(fresh.consumed()).toEqual(['auth-sigkill']); // exactly one, not doubled
  }, 30_000);

  it('[LIVE] two CONCURRENT OS processes on the same authorization → exactly one winner, BOTH exit cleanly', async () => {
    const stateDir = join(base, 'state-race');
    interface ChildResult { readonly out: string; readonly err: string; readonly code: number | null; readonly signal: NodeJS.Signals | null }
    const run = () => new Promise<ChildResult>((resolve) => {
      const p = spawn(process.execPath, [CHILD, stateDir, 'auth-race', 'commit-exit'], { stdio: ['ignore', 'pipe', 'pipe'] });
      let out = ''; let err = '';
      p.stdout!.on('data', (d) => { out += d.toString(); });
      p.stderr!.on('data', (d) => { err += d.toString(); });
      p.on('close', (code, signal) => resolve({ out: out.trim(), err: err.trim(), code, signal })); // close ⇒ all stdio flushed
    });
    const [a, b] = await Promise.all([run(), run()]);
    // finding #2: a child that emitted an expected line and THEN crashed must fail — assert clean termination.
    for (const c of [a, b]) {
      expect(c.signal, `child terminated by signal ${c.signal} (stderr: ${c.err})`).toBeNull(); // no crash/SIGSEGV/etc.
      expect(c.code, `child exit code ${c.code} (stderr: ${c.err})`).toBe(0);                    // graceful exit
      expect(c.err, 'child wrote to stderr').toBe('');                                           // no thrown error
      expect(c.out).toMatch(/^(COMMITTED:1|REFUSED:(replay|trusted_state_locked))$/);            // exactly one governed line
    }
    expect([a, b].filter((c) => c.out === 'COMMITTED:1')).toHaveLength(1);                        // EXACTLY one prepared
    expect([a, b].filter((c) => c.out.startsWith('REFUSED:'))).toHaveLength(1);                   // the loser is contained
    expect(readState(stateDir).state.receiptHead.count).toBe(1);
  }, 30_000);
});

describe('R54 review repair · trusted-state path isolation is ENFORCED at runtime (not just documented)', () => {
  const hostile: readonly { name: string; dir: () => string }[] = [
    { name: 'INSIDE the repo working tree', dir: () => join(repoRoot, '.aukora-trusted') },
    { name: 'EQUAL to the repo root', dir: () => repoRoot },
    { name: 'INSIDE the disposable worktree base', dir: () => join(wtBase, 'trusted') },
  ];
  for (const h of hostile) {
    it(`refuses a trustedStateDir ${h.name} — nothing durable, no git effect`, () => {
      const { env, w } = ceremonyEnv(h.dir());
      const res = runLocalRecursionCeremony(env, invocationFor(w, `r54-iso-${h.name.slice(0, 3).toLowerCase().replace(/\W/g, 'x')}`, `r54-cand-iso-${h.name.slice(0, 3).toLowerCase().replace(/\W/g, 'x')}`));
      expect(res.phase).toBe('refused-at-candidate');
      expect(res.reasonClass).toBe('candidate:trusted-state-inside-repo');
      expect(existsSync(join(h.dir(), 'trusted-state.json'))).toBe(false); // the store was never even opened
      expect(g(repoRoot, ['branch', '--list', 'candidate/*'])).toBe('');
    });
  }

  it('a SYMLINKED "outside" path that resolves inside the repo is refused after canonicalization', () => {
    const linkParent = join(base, 'link-parent');
    mkdirSync(linkParent, { recursive: true });
    const link = join(linkParent, 'looks-outside');
    execFileSync('ln', ['-s', repoRoot, link]); // looks-outside → repoRoot
    const evasive = join(link, 'trusted'); // lexically outside base/repo…; canonically INSIDE the repo
    const { env, w } = ceremonyEnv(evasive);
    const res = runLocalRecursionCeremony(env, invocationFor(w, 'r54-iso-sym', 'r54-cand-iso-sym'));
    expect(res.phase).toBe('refused-at-candidate');
    expect(res.reasonClass).toBe('candidate:trusted-state-inside-repo');
    expect(g(repoRoot, ['branch', '--list', 'candidate/*'])).toBe('');
  });

  it('a valid OUTSIDE path still materializes (the fence refuses containment, not distance)', () => {
    const stateDir = join(base, 'state-outside-ok');
    const { env, w } = ceremonyEnv(stateDir);
    const res = runLocalRecursionCeremony(env, invocationFor(w, 'r54-iso-ok', 'r54-cand-iso-ok'));
    expect(res.phase).toBe('candidate-materialized');
    cleanupCandidate(res.materialization!.branch!, res.materialization!.worktreePath!);
  });
});

describe('R54 review repair · a REFUSED child decision exits — never orphans/hangs', () => {
  it('[LIVE] commit-hang on a replayed (refused) authorization emits REFUSED and exits promptly', async () => {
    const stateDir = join(base, 'state-refusal-exit');
    // consume once (commit-exit) so the second child’s decision is a durable replay REFUSAL
    const first = await new Promise<string>((resolve) => {
      const p = spawn(process.execPath, [CHILD, stateDir, 'auth-hangtest', 'commit-exit'], { stdio: ['ignore', 'pipe', 'ignore'] });
      let buf = ''; p.stdout!.on('data', (d) => { buf += d.toString(); }); p.on('close', () => resolve(buf.trim()));
    });
    expect(first).toBe('COMMITTED:1');
    // commit-hang mode + refused decision ⇒ MUST exit on its own (no SIGKILL sent here)
    const child = spawn(process.execPath, [CHILD, stateDir, 'auth-hangtest', 'commit-hang'], { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = ''; child.stdout!.on('data', (d) => { out += d.toString(); });
    const exited = await Promise.race([
      new Promise<boolean>((r) => child.on('close', () => r(true))),
      new Promise<boolean>((r) => setTimeout(() => r(false), 10_000)),
    ]);
    if (!exited) child.kill('SIGKILL'); // cleanup only on failure — the assertion below then reports it
    expect(exited).toBe(true);                    // refused ⇒ exited, never hung
    expect(out.trim()).toBe('REFUSED:replay');
  }, 30_000);
});

describe('R54 · 8: exact primary-runtime import/reachability proof', () => {
  const read = (p: string) => readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), 'utf8');
  it('the ACTIVE door boot reaches @aukora/kernel-node through the runner-fenced durable monitor (each hop verified)', () => {
    // hop 1 (R54 v3/v4): the live door boot passes trustedStateDir and NEVER constructs the monitor directly —
    // direct construction would bypass the runner's canonical fence (the v3 blocker). QUOTE- and ALIAS-safe: the
    // class identifier must not appear via ANY route (`new X`, `import {… as X}`, `ns.DurableCandidateReferenceMonitor`)
    // and the monitor module must not be imported by ANY specifier (single/double quotes, static import or require).
    const doorSrc = read('scripts/mind-door-7097.ts');
    expect(doorSrc).toMatch(/trustedStateDir:\s*doorTrustedStateDir/);
    expect(doorSrc).not.toMatch(/DurableCandidateReferenceMonitor/); // no identifier route at all (incl. aliases/namespaces)
    expect(doorSrc).not.toMatch(/durableCandidateMonitor/);          // module never imported by any specifier route
    // hop 2: the ceremony runner RUNS the canonical fence, then constructs the ONE durable monitor
    const runnerSrc = read('src/localCeremonyRunner.ts');
    expect(runnerSrc).toMatch(/trustedStateDirInsideFence/);
    expect(runnerSrc).toMatch(/new DurableCandidateReferenceMonitor\(env\.ownerRoot, env\.trustedStateDir\)/);
    // hop 3: the durable monitor consumes THROUGH the protected kernel-node store
    const monitorSrc = read('src/durableCandidateMonitor.ts');
    expect(monitorSrc).toMatch(/from '@aukora\/kernel-node'/);
    expect(monitorSrc).toMatch(/authorizeAndPrepare/);
  });

  it('DOOR-SHAPED sibling symlink attack: ../aukora-door-trusted-state → inside the repo is rejected BEFORE monitor use, durable mutation, receipts, or Git', () => {
    // Reproduce the exact active-door layout: repoRoot with a SIBLING named aukora-door-trusted-state that an
    // attacker pre-planted as a symlink resolving back inside the repo working tree.
    const doorBase = join(base, 'door-layout');
    const doorRepo = join(doorBase, 'repo');
    mkdirSync(doorRepo, { recursive: true });
    execFileSync('git', ['init', '-q', '-b', 'main', doorRepo]);
    g(doorRepo, ['config', 'user.name', 'R54 Door']);
    g(doorRepo, ['config', 'user.email', 'r54door@test.local']);
    mkdirSync(join(doorRepo, 'apps/seed/src'), { recursive: true });
    writeFileSync(join(doorRepo, 'apps/seed/src/recursion.ts'), '// original content\n');
    g(doorRepo, ['add', '-A']); g(doorRepo, ['commit', '-q', '--no-gpg-sign', '-m', 'init']);
    const sibling = join(doorBase, 'aukora-door-trusted-state'); // = resolve(repoRoot, '..', 'aukora-door-trusted-state')
    execFileSync('ln', ['-s', join(doorRepo, '.hidden-authority'), sibling]);
    // Build the env EXACTLY as the door does: trustedStateDir passed, monitor NOT injected.
    const w = makeWorld({ ownerLabel: 'r54-owner' });
    const env: LocalCeremonyEnv = {
      recursionEnv: w.env, workflowStore: new InMemoryWorkflowStore(),
      repo: { list: () => [], read: (p: string) => readFileSync(join(doorRepo, p), 'utf8'), exists: (p: string) => existsSync(join(doorRepo, p)) },
      ownerRoot: w.owner.root, store: new ReactiveMemoryStore(),
      trustedStateDir: sibling, gitRepoRoot: doorRepo, worktreeBase: join(doorBase, 'candidates'),
      nowMs: NOW_MS, nowIso: NOW_ISO,
    };
    const res = runLocalRecursionCeremony(env, invocationFor(w, 'r54-door-sym', 'r54-cand-door-sym'));
    expect(res.phase).toBe('refused-at-candidate');
    expect(res.reasonClass).toBe('candidate:trusted-state-inside-repo');
    expect(res.materialization).toBeNull();                                  // the stage never ran ⇒ no attempt receipt, no monitor use
    expect(existsSync(join(doorRepo, '.hidden-authority'))).toBe(false);     // no durable mutation inside the repo
    expect(existsSync(join(sibling, 'trusted-state.json'))).toBe(false);     // nothing journalled through the symlink
    expect(g(doorRepo, ['branch', '--list', 'candidate/*'])).toBe('');       // no Git effect
    expect(g(doorRepo, ['status', '--porcelain'])).toBe('');                 // repo tree untouched
  });
  it('NO Convex surface imports kernel-node: authority consumption cannot live in a Convex handler', () => {
    const brainRoot = fileURLToPath(new URL('../../brain', import.meta.url));
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true }) as Dirent[]) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (/\.(ts|js)$/.test(entry.name) && readFileSync(p, 'utf8').includes('@aukora/kernel-node')) offenders.push(p);
      }
    };
    walk(join(brainRoot, 'convex'));
    expect(offenders).toEqual([]); // no Convex handler can verify/consume authority
    // and the ConvexWorkflowStore adapter stays non-authoritative (projections only)
    expect(readFileSync(join(brainRoot, 'src/convexWorkflowStore.ts'), 'utf8')).not.toContain('@aukora/kernel-node');
  });
});
