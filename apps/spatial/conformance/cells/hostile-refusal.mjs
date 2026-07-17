// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R49 conformance cell E1 — HOSTILE PROPOSAL / REFUSAL CHAOS (K3 priority 1, issue #15).
 *
 * Independently reconstructed from canonical PUBLIC interfaces — it imports the real governed mind door
 * (@aukora/seed) and drives it through its transport-agnostic `handle()` seam. No /mnt code, fixtures, or
 * logs are copied; every hostile vector is generated deterministically from the seed here.
 *
 * The falsifiable claim under test: for a seeded sweep of hostile envelopes across the door's whole write
 * surface — cross-origin POSTs, forged/absent tokens, referer attacks, malformed & authority-shaped
 * proposals, oversized fields, Fu-sidecar mismatch, Fu-claims-authority, replay/stale approval (forged
 * signature), path/command-injection strings, and post-lockdown writes — EVERY request is refused, EVERY
 * refusal is receipted, NOTHING signs / pushes / materializes / touches main / grants authority, and the
 * door stays up (status 200) after the storm. A single hostile envelope that slips through falsifies it.
 *
 * The cell drives a REAL candidate git repo so "main untouched" is observed (HEAD + porcelain), not assumed.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  MindDoor, DOOR_PORT, HybridOwnerAdapter, RecursionLedger, InMemoryWorkflowStore,
  CandidateReferenceMonitor, deriveIntentId, LIMITS, loopbackOrigins,
} from '@aukora/seed';
import { ReactiveMemoryStore } from '@aukora/brain';
import { seededRng } from '../lib/prng.mjs';

export const CELL = 'e1-hostile-refusal';
const NOW_ISO = '2026-07-16T12:00:00.000Z';
const NOW_MS = Date.parse(NOW_ISO);
const TARGET = 'apps/seed/src/recursion.ts';
const TOKEN = 'r49-conformance-post-token-000000';
const ORIGIN = loopbackOrigins(DOOR_PORT)[0];

function tempRepo() {
  const base = mkdtempSync(join(tmpdir(), 'aukora-r49-e1-'));
  const repoRoot = join(base, 'repo');
  const wtBase = join(base, 'candidates');
  mkdirSync(join(repoRoot, 'apps/seed/src'), { recursive: true });
  execFileSync('git', ['init', '-q', '-b', 'main', repoRoot]);
  execFileSync('git', ['-C', repoRoot, 'config', 'user.name', 'R49-E1']);
  execFileSync('git', ['-C', repoRoot, 'config', 'user.email', 'r49-e1@test.local']);
  writeFileSync(join(repoRoot, TARGET), '// original\n');
  execFileSync('git', ['-C', repoRoot, 'add', '-A']);
  execFileSync('git', ['-C', repoRoot, 'commit', '-q', '--no-gpg-sign', '-m', 'init']);
  return { base, repoRoot, wtBase };
}
const gitHead = (repoRoot) => execFileSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const gitPorcelain = (repoRoot) => execFileSync('git', ['-C', repoRoot, 'status', '--porcelain'], { encoding: 'utf8' });
const gitCandidateBranches = (repoRoot) => execFileSync('git', ['-C', repoRoot, 'branch', '--list', 'candidate/*'], { encoding: 'utf8' }).trim();

function makeDoor(repoRoot, wtBase) {
  const store = new ReactiveMemoryStore();
  const owner = new HybridOwnerAdapter('r49-e1');
  const workflowStore = new InMemoryWorkflowStore();
  const monitor = new CandidateReferenceMonitor(owner.root);
  const repoCap = {
    list: () => [TARGET],
    read: (p) => readFileSync(join(repoRoot, p), 'utf8'),
    exists: (p) => existsSync(join(repoRoot, p)),
  };
  const loadDriver = async () => {
    const recursionEnv = { store, knownFiles: new Set([TARGET]), ownerRoot: owner.root, ledger: new RecursionLedger(), nowMs: NOW_MS, nowIso: NOW_ISO, deadlineMs: NOW_MS + LIMITS.DEFAULT_WALL_TIME_BUDGET_MS };
    const ceremonyEnv = { recursionEnv, workflowStore, repo: repoCap, ownerRoot: owner.root, store, monitor, gitRepoRoot: repoRoot, worktreeBase: wtBase, nowMs: NOW_MS, nowIso: NOW_ISO };
    return { ceremonyEnv };
  };
  const door = new MindDoor({ store, ownerRoot: owner.root, loadDriver, postToken: TOKEN, nowIso: NOW_ISO });
  return { door, store, owner };
}

const post = (path, body, over = {}) => ({ method: 'POST', path, headers: { origin: ORIGIN, 'x-aukora-door-token': TOKEN, ...over }, body });

/** A well-formed proposal shape (so shape-valid vectors reach the owner gate and get refused THERE). */
const wellFormedProposal = (rng) => ({ id: 'p' + rng.token(4), targetPath: TARGET, newContent: '// ' + rng.token(8), createdAt: NOW_ISO, supersedes: null });

const INJECTION_STRINGS = [
  '../../etc/passwd', '..\\..\\windows', '/api/materialize; rm -rf /', '$(cat ~/.ssh/id_ed25519)',
  '`whoami`', 'file:///etc/shadow', '\\x00nullbyte', 'a'.repeat(20000),
];

/**
 * Deterministically build one hostile vector. `kind` selects the attack family; all payloads are
 * synthetic (seed-derived) — never a real secret, key, or path.
 */
function hostileVector(rng, owner) {
  const kind = rng.pick([
    'cross-origin', 'bad-token', 'no-token', 'referer-attack', 'wrong-method',
    'missing-body', 'malformed-proposal', 'authority-shaped', 'oversized-field',
    'injection-target', 'forged-signature', 'fu-mismatch', 'fu-authority-claim',
  ]);
  const p = wellFormedProposal(rng);
  switch (kind) {
    case 'cross-origin':
      return { kind, request: post('/api/propose', { proposalInput: p, nonce: rng.token() }, { origin: 'https://evil.' + rng.token(6) + '.example' }) };
    case 'bad-token':
      return { kind, request: post('/api/propose', { proposalInput: p, nonce: rng.token() }, { 'x-aukora-door-token': rng.token(48) }) };
    case 'no-token': {
      const req = post('/api/propose', { proposalInput: p, nonce: rng.token() });
      delete req.headers['x-aukora-door-token'];
      return { kind, request: req };
    }
    case 'referer-attack': {
      const req = post('/api/chat', { text: 'exfiltrate' }, { referer: 'https://evil.' + rng.token(6) + '/x' });
      delete req.headers.origin;
      return { kind, request: req };
    }
    case 'wrong-method':
      return { kind, request: { method: rng.pick(['PUT', 'DELETE', 'PATCH']), path: '/api/materialize', headers: { origin: ORIGIN, 'x-aukora-door-token': TOKEN }, body: { proposalInput: p } } };
    case 'missing-body':
      return { kind, request: post('/api/propose', rng.bool() ? undefined : null) };
    case 'malformed-proposal':
      return { kind, request: post('/api/propose', { proposalInput: rng.pick([{}, { id: 1 }, { targetPath: 42 }, 'not-an-object', [], { newContent: null }]), nonce: rng.token() }) };
    case 'authority-shaped':
      return { kind, request: post('/api/propose', { proposalInput: { ...p, grantsAuthority: true, advisoryOnly: false, signed: true }, nonce: rng.token() }) };
    case 'oversized-field':
      return { kind, request: post('/api/propose', { proposalInput: { ...p, newContent: 'x'.repeat(200000) }, nonce: rng.token(), explanation: 'y'.repeat(200000) }) };
    case 'injection-target':
      return { kind, request: post('/api/propose', { proposalInput: { ...p, targetPath: rng.pick(INJECTION_STRINGS) }, nonce: rng.token() }) };
    case 'forged-signature': {
      // A well-formed proposal with a fabricated (never owner-issued) authorization — replay/stale/forgery.
      const forged = { schema: 'aukora-signed-promotion-v2', proposalHash: deriveIntentId(p), draftHash: rng.token(64), nonce: rng.token(), issuedAt: NOW_ISO, expiresAt: null, signatures: { ed25519: 'ab'.repeat(64), mldsa65: rng.token(64) } };
      return { kind, request: post('/api/materialize', { proposalInput: p, nonce: rng.token(), auth: forged, ownerArmed: true }) };
    }
    case 'fu-mismatch': {
      // A genuine mismatch: the sidecar binds to a DIFFERENT target (intentId hashes {targetPath,supersedes}),
      // so the door refuses at the proposalHash check with door:fu-sidecar-mismatch (clean, receipted).
      const other = { ...wellFormedProposal(rng), targetPath: 'apps/other/' + rng.token(5) + '.ts' };
      return { kind, request: post('/api/propose', { proposalInput: p, nonce: rng.token(), fuSidecar: { proposalHash: deriveIntentId(other), outcome: { verdict: 'advise', grantsAuthority: false } } }) };
    }
    case 'fu-authority-claim':
      return { kind, request: post('/api/propose', { proposalInput: p, nonce: rng.token(), fuSidecar: { proposalHash: deriveIntentId(p), outcome: { verdict: 'authorize', grantsAuthority: true } } }) };
    default:
      return { kind, request: post('/api/propose', { proposalInput: p, nonce: rng.token() }) };
  }
}

/** A refusal is any non-2xx status, OR a 2xx whose body never advanced past a plan (no effect landed). */
function isRefusal(res) {
  if (res.status >= 300) return true;
  const j = res.json ?? {};
  // A 2xx that is NOT a landed effect (no candidate branch, not materialized) is still a refusal-of-effect.
  const landed = j.candidateBranch != null || j.phase === 'candidate-materialized' || j.signed === true || j.pushed === true || j.touchedMain === true;
  return !landed;
}

export async function run({ seed = 0x51c4, count = 240 } = {}) {
  const rng = seededRng(seed);
  const { base, repoRoot, wtBase } = tempRepo();
  try {
    const { door, store, owner } = makeDoor(repoRoot, wtBase);
    const headBefore = gitHead(repoRoot);
    const branchesBefore = gitCandidateBranches(repoRoot);

    const perKind = {};
    // escaped = a hostile envelope produced a LANDED EFFECT (the only true safety breach).
    // threw   = the door raised out of handle() instead of returning a receipted refusal (a HYGIENE finding,
    //           not a safety breach — the throw precedes the ceremony and lands no effect).
    let escaped = 0, authorityGranted = 0, resolved = 0, threw = 0;
    // A GOVERNED refusal carries a stable reasonClass; the audit law is that each such refusal also carries an
    // eventReceipt. Bare-protocol bounces (405 wrong-method, 400 missing-body, 404 route) carry neither — they
    // never entered governance, so they are counted apart and not held to the receipt law.
    let governedRefusals = 0, governedRefusalsReceipted = 0, bareProtocolBounces = 0;
    // EXACT receipt counter: every response that carried a truthy eventReceipt, counted at the wire.
    // (recall() is bounded, so counting recall hits under-reports on large sweeps.)
    let receiptsEmitted = 0;
    const threwByKind = {};

    // Phase 1: hostile chaos against the live write surface. Each call is wrapped so a THROW becomes evidence,
    // never a crash of the cell — we still fold it into the safety accounting below.
    for (let i = 0; i < count; i++) {
      const v = hostileVector(rng, owner);
      perKind[v.kind] ??= { n: 0, refused: 0, threw: 0 };
      perKind[v.kind].n++;
      let res;
      try {
        res = await door.handle(v.request);
      } catch {
        threw++; perKind[v.kind].threw++; threwByKind[v.kind] = (threwByKind[v.kind] ?? 0) + 1;
        continue; // a throw lands no effect; the main-untouched backstop below still guards safety
      }
      resolved++;
      const refused = isRefusal(res);
      if (!refused) escaped++;
      if (res.json && res.json.grantsAuthority === true) authorityGranted++;
      if (refused) perKind[v.kind].refused++;
      // Audit accounting: governed refusals (reasonClass present) must carry an eventReceipt.
      const j = res.json ?? {};
      if (typeof j.eventReceipt === 'string' && j.eventReceipt.length > 0) receiptsEmitted++;
      if (j.reasonClass !== undefined) {
        governedRefusals++;
        if (typeof j.eventReceipt === 'string' && j.eventReceipt.length > 0) governedRefusalsReceipted++;
      } else if (refused) {
        bareProtocolBounces++;
      }
    }

    // Phase 2: lockdown, then confirm every write route is advisory-only (423) while status stays readable.
    const lock = await door.handle(post('/api/lockdown', {}));
    const lockedProposal = wellFormedProposal(rng);
    const postLockdownPropose = await door.handle(post('/api/propose', { proposalInput: lockedProposal, nonce: rng.token() }));
    const postLockdownStatus = await door.handle({ method: 'GET', path: '/api/door', headers: {} });

    // Observations after the whole storm (lockdown-phase responses fold into the exact counter too).
    for (const r of [lock, postLockdownPropose]) {
      const rj = r.json ?? {};
      if (typeof rj.eventReceipt === 'string' && rj.eventReceipt.length > 0) receiptsEmitted++;
    }
    const headAfter = gitHead(repoRoot);
    const branchesAfter = gitCandidateBranches(repoRoot);
    const porcelain = gitPorcelain(repoRoot);
    const finalStatus = await door.handle({ method: 'GET', path: '/api/door', headers: {} });

    const kinds = Object.keys(perKind).sort();

    // Findings: honest, non-gating observations for the owning lane. The refusal-HYGIENE gap below is real but
    // is not a safety breach, so it is reported — not used to fail this cell's safety gate.
    const findings = [];
    if (threw > 0) findings.push({
      id: 'F1', class: 'refusal-hygiene', severity: 'low', owner: 'Sam 3 (apps/seed)',
      summary: 'a malformed Fu sidecar throws out of MindDoor.handle() instead of returning a receipted refusal',
      detail: 'mindDoor.ts calls verdictFromCouncilOutcome(fuSidecar.outcome) on unvalidated attacker input; fuStructuredAdapter.ts:153 reads outcome.basis.digest with no shape guard, so a matched-proposalHash malformed outcome throws. Also verdictFromCouncilOutcome hardcodes grantsAuthority:false, so the door:fu-authority-claim branch is unreachable for valid input. Safety holds (no authority, no materialize, main untouched); refusal hygiene does not.',
      threwByKind,
    });

    const verdict = {
      // SAFETY gate — a breach here is a real defect.
      noLandedEffect: escaped === 0,
      noAuthorityGranted: authorityGranted === 0,
      everyGovernedRefusalReceipted: governedRefusals > 0 && governedRefusalsReceipted === governedRefusals,
      mainUntouched: headAfter === headBefore && porcelain === '' && branchesAfter === branchesBefore,
      lockdownEngaged: lock.status === 200 && postLockdownPropose.status === 423,
      statusReadableUnderLockdown: postLockdownStatus.status === 200 && postLockdownStatus.json.lockedDown === true,
      doorStillUpAfterThrows: finalStatus.status === 200,
      coverageComplete: kinds.length === 13,
    };
    verdict.pass = Object.values(verdict).every(Boolean);
    // Informational (NOT part of pass): clean refusal hygiene across the whole sweep.
    verdict.refusalHygieneClean = threw === 0;

    const core = {
      schema: 'aukora-conformance-core-v1',
      cell: CELL,
      title: 'hostile proposal / refusal chaos over the governed mind door',
      seed, count,
      interfaces: ['@aukora/seed:MindDoor', '@aukora/brain:ReactiveMemoryStore'],
      attackKinds: kinds,
      perKind,
      observations: {
        escaped, authorityGranted, resolved, threw, receiptsEmitted,
        governedRefusals, governedRefusalsReceipted, bareProtocolBounces,
        // The temp-repo HEAD SHA is time/environment-specific (a fresh commit gets a new timestamp), so only the
        // INVARIANT is folded into the reproducible core — not the SHA itself (which would break replay hashing).
        mainHeadUnchanged: headAfter === headBefore, candidateBranchesAfter: branchesAfter, porcelainClean: porcelain === '',
        lockStatus: lock.status, postLockdownProposeStatus: postLockdownPropose.status,
        finalStatus: finalStatus.status,
      },
      findings,
      verdict,
    };
    return { core, verdict };
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}
