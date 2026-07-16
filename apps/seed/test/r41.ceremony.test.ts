// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * WAVE 2 — the complete AUMLOK ceremony / custody / onboarding as the P0 authority membrane.
 *
 * Covers the directive's required matrix: exact donor ceremony vectors; forged Ed25519/PQC halves; replay/stale/
 * expired challenge; wrong draft/root/owner; interrupted ceremony restart; custody absent; browser/Convex tampering;
 * proposal flood; self-protection; and zero effect before receipt/authorization.
 */
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { ReactiveMemoryStore } from '@aukora/brain';
import {
  // approve challenge
  mintChallenge, verifyAndConsumeChallenge, sweepExpiredChallenges, generateChallengePhrase,
  challengeGrantsAuthority, DEFAULT_CHALLENGE_TTL_MS, type ChallengeStore,
  // approve guard
  evaluateApprovalGate, approvalGateReasonClass, approvalGateGrantsAuthority, type ApprovalGateInputs,
  // owner custody
  custodyStatus, ownerSigningGuidance, ownerCustodyGrantsAuthority, CUSTODY_FILES,
  type CustodyProbe, type CustodyStatus,
  // bond ceremony
  createUnboundBond, revealPhrase, pinPublicFingerprint, witnessVoicePresence, markReadyForSignature,
  generateVoiceChallenge, validateBond, sanitizeBondForArtifact, deriveCeremonyProjection,
  rejectForbiddenProjection, advisoryBondStateFromProjection, isPublicFingerprint,
  legalAuthorityFromPromotion, bondGrantsAuthority, isBondApplyEligible,
  // door
  handleApprove, handleBind, approveDoorGrantsAuthority, type ApproveDoorEnv,
  // monitor + fence
  CandidateReferenceMonitor, candidatePayloadHash, isSelfProtecting,
  type BranchCandidate,
} from '../src/index.js';
import { makeWorld, NOW_MS, NOW_ISO, type World } from './support.js';

const HOST = '127.0.0.1:7099';
const ORIGIN = 'http://127.0.0.1:7099';
const ALLOWED_HOSTS = new Set([HOST]);
const ALLOWED_ORIGINS = new Set([ORIGIN]);
const PHRASE = 'amber-otter-seven-quartz';

const allPresent: CustodyProbe = { isFile: () => true };
const nonePresent: CustodyProbe = { isFile: () => false };
const COMPLETE_CUSTODY: CustodyStatus = custodyStatus({ homeDir: '/fixture' }, allPresent);

function candidate(path = 'apps/seed/src/notes.ts'): BranchCandidate {
  return {
    schema: 'aukora-branch-candidate-v1', candidateId: 'ab'.repeat(32),
    workspace: new Map([[path, '// c']]),
    files: [{ path, intentId: 'cd'.repeat(32), draftHash: 'ef'.repeat(32), diff: '', receiptHash: 'ab'.repeat(32) }],
    explanation: 'x', lineage: [{ intentId: 'cd'.repeat(32), depth: 0 }],
    staged: true, pushed: false, signed: false, merged: false, deployed: false, grantsAuthority: false,
  } as BranchCandidate;
}

interface Rig {
  readonly w: World;
  readonly store: ReactiveMemoryStore;
  readonly challengeStore: ChallengeStore;
  readonly monitor: CandidateReferenceMonitor;
  readonly env: ApproveDoorEnv;
}

function rig(over: Partial<{ enabled: boolean; advisory: boolean; custody: CustodyStatus; nowMs: number; monitor: CandidateReferenceMonitor }> = {}): Rig {
  const w = makeWorld();
  const store = new ReactiveMemoryStore();
  const challengeStore: ChallengeStore = new Map();
  const monitor = over.monitor ?? new CandidateReferenceMonitor(w.owner.root);
  const env: ApproveDoorEnv = {
    store, nowIso: NOW_ISO, nowMs: over.nowMs ?? NOW_MS, challengeStore, monitor,
    gate: { enabled: over.enabled ?? true, advisory: over.advisory ?? true, allowedHosts: ALLOWED_HOSTS, allowedOrigins: ALLOWED_ORIGINS },
    custody: over.custody ?? COMPLETE_CUSTODY,
  };
  return { w, store, challengeStore, monitor, env };
}

/** Mint a live challenge bound to a candidate and produce a matching owner authorization (nonce-bound). */
function armForApproval(r: Rig, c: BranchCandidate, nonce = 'nonce-approve-1', signer = r.w.owner) {
  const ph = candidatePayloadHash(c);
  mintChallenge(r.challengeStore, ph, r.env.nowMs, DEFAULT_CHALLENGE_TTL_MS, { phrase: PHRASE, nonce });
  const auth = signer.authorize({ proposalHash: ph, draftHash: ph, nonce, issuedAt: NOW_ISO, expiresAt: null });
  return { ph, auth };
}

const req = (c: BranchCandidate, phrase: string, authorization: any, ownerArmed = true, over: Partial<{ host: string | null; origin: string | null; secFetchSite: string | null }> = {}) => ({
  host: over.host ?? HOST, origin: over.origin ?? ORIGIN, secFetchSite: over.secFetchSite ?? 'same-origin',
  candidate: c, phrase, authorization, ownerArmed,
});

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('WAVE 2 · exact donor ceremony vectors', () => {
  it('voice presence challenge hashes exactly like the donor (aumlok-voice-challenge|id|nonce|pos)', () => {
    const v = generateVoiceChallenge('cid', '4827', 3);
    expect(v.spokenChallengeHash).toBe('85c6fb8e22a407fc83d9618c2faebe5a90b5a68929bcfaef4a4bee8227fbeef5');
    expect(v.spokenChallengeHash).toBe(createHash('sha256').update('aumlok-voice-challenge|cid|4827|3').digest('hex'));
    expect(v.transcriptChallenge).toBe('Speak key-word #3, then the number 4827');
    expect(v.voiceIsAuthority).toBe(false);
    // positions clamp to 1..6 (never 0) — donor invariant
    expect(generateVoiceChallenge('c', '1', 0).transcriptChallenge).toContain('#1');
    expect(generateVoiceChallenge('c', '1', 99).transcriptChallenge).toContain('#6');
  });

  it('challenge phrase is 4 lowercase words joined by hyphens (donor shape)', () => {
    for (let i = 0; i < 25; i++) {
      const phrase = generateChallengePhrase();
      const words = phrase.split('-');
      expect(words).toHaveLength(4);
      for (const wrd of words) expect(wrd).toMatch(/^[a-z]+$/);
    }
  });

  it('public fingerprint discipline: short public hex only; long/blank/non-hex refused (donor)', () => {
    expect(isPublicFingerprint('deadbeefdeadbeef')).toBe(true);
    expect(isPublicFingerprint('ab'.repeat(80))).toBe(false); // 160 hex ⇒ looks like key material
    expect(isPublicFingerprint('xyz')).toBe(false);
    expect(isPublicFingerprint('')).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('WAVE 2 · challenge — replay / stale / expired / mismatch (single-use, short-TTL)', () => {
  it('verify consumes once; replay refuses already_used; wrong phrase never consumes; expired swept', () => {
    const store: ChallengeStore = new Map();
    const c = mintChallenge(store, 'ab'.repeat(32), NOW_MS, DEFAULT_CHALLENGE_TTL_MS, { phrase: PHRASE, nonce: 'n' });
    // no_challenge for a different binding
    expect(verifyAndConsumeChallenge(store, 'ff'.repeat(32), PHRASE, NOW_MS).ok).toBe(false);
    // wrong phrase does not consume
    expect(verifyAndConsumeChallenge(store, 'ab'.repeat(32), 'wrong', NOW_MS)).toEqual({ ok: false, reason: 'phrase_mismatch' });
    expect(store.get('ab'.repeat(32))!.used).toBe(false);
    // correct phrase consumes
    const ok = verifyAndConsumeChallenge(store, 'ab'.repeat(32), PHRASE, NOW_MS);
    expect(ok).toEqual({ ok: true, nonce: 'n' });
    // replay refused
    expect(verifyAndConsumeChallenge(store, 'ab'.repeat(32), PHRASE, NOW_MS)).toEqual({ ok: false, reason: 'already_used' });
    // expired path (fresh mint, read past expiry)
    mintChallenge(store, 'cd'.repeat(32), NOW_MS, 1000, { phrase: PHRASE, nonce: 'n2' });
    expect(verifyAndConsumeChallenge(store, 'cd'.repeat(32), PHRASE, NOW_MS + 2000)).toEqual({ ok: false, reason: 'expired' });
    // sweep drops expired entries
    mintChallenge(store, 'ee'.repeat(32), NOW_MS, 1000, { phrase: PHRASE, nonce: 'n3' });
    sweepExpiredChallenges(store, NOW_MS + 5000);
    expect(store.has('ee'.repeat(32))).toBe(false);
    expect(c.bindingHash).toBe('ab'.repeat(32));
    expect(challengeGrantsAuthority()).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('WAVE 2 · approve guard — browser/CSRF tampering (armed, loopback, same-origin)', () => {
  const base = (over: Partial<ApprovalGateInputs>): ApprovalGateInputs => ({
    enabled: true, advisory: true, host: HOST, origin: ORIGIN, secFetchSite: 'same-origin',
    allowedHosts: ALLOWED_HOSTS, allowedOrigins: ALLOWED_ORIGINS, ...over,
  });
  it('refuses off, lockdown, foreign host (DNS-rebind), cross-origin, cross-site; allows the armed same-origin case', () => {
    expect(evaluateApprovalGate(base({}))).toEqual({ ok: true });
    expect(evaluateApprovalGate(base({ enabled: false })).ok).toBe(false);
    expect(approvalGateReasonClass(base({ enabled: false }))).toBe('gate:not-armed');
    expect(approvalGateReasonClass(base({ advisory: false }))).toBe('gate:lockdown');
    expect(approvalGateReasonClass(base({ host: 'evil.example' }))).toBe('gate:host-not-loopback');
    expect(approvalGateReasonClass(base({ host: null }))).toBe('gate:host-not-loopback');
    expect(approvalGateReasonClass(base({ origin: 'http://evil.example' }))).toBe('gate:cross-origin');
    expect(approvalGateReasonClass(base({ secFetchSite: 'cross-site' }))).toBe('gate:cross-site');
    // a no-Origin curl is not blocked by origin alone (still needs the unguessable phrase downstream)
    expect(evaluateApprovalGate(base({ origin: null })).ok).toBe(true);
    expect(approvalGateGrantsAuthority()).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('WAVE 2 · owner custody boundary — existence-only, never reads a key', () => {
  it('custody complete only when both public AND both private halves exist; absent otherwise', () => {
    expect(custodyStatus({ homeDir: '/x' }, allPresent).custodyComplete).toBe(true);
    expect(custodyStatus({ homeDir: '/x' }, nonePresent).reasonClass).toBe('custody:absent');
    // private-absent: publics present, privates missing
    const pubOnly: CustodyProbe = { isFile: (p) => p.endsWith('.pub') };
    const st = custodyStatus({ homeDir: '/x' }, pubOnly);
    expect(st.publicPresent).toBe(true);
    expect(st.privatePresent).toBe(false);
    expect(st.reasonClass).toBe('custody:private-absent');
  });
  it('signing guidance is display-only, offers only when custody complete, and never carries key material', () => {
    const g = ownerSigningGuidance('ab'.repeat(32), { homeDir: '/x' }, allPresent);
    expect(g.canOffer).toBe(true);
    expect(g.keygenCommand).toBeNull();
    expect(g.signCommand).toContain('sign-hybrid');
    expect(JSON.stringify(g)).not.toMatch(/-----BEGIN|[0-9a-f]{160,}/);
    expect(ownerSigningGuidance('ab'.repeat(32), { homeDir: '/x' }, nonePresent).keygenCommand).toContain('keygen');
    expect(CUSTODY_FILES.edKey).toBe('authority-ed25519.key');
    expect(ownerCustodyGrantsAuthority()).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('WAVE 2 · bond ceremony — advisory shadow boundary (N_t → B_t → A_t)', () => {
  it('state machine advances, artifact carries only public material, and never grants authority', () => {
    let b = createUnboundBond(NOW_ISO);
    b = revealPhrase(b, NOW_ISO);
    expect(b.phraseRevealedOnce).toBe(true);
    b = pinPublicFingerprint(b, 'deadbeefcafebabe', NOW_ISO);
    b = witnessVoicePresence(b, generateVoiceChallenge('c', '77', 2), NOW_ISO);
    b = markReadyForSignature(b, NOW_ISO);
    expect(b.bondState).toBe('ready_for_signature');
    expect(validateBond(b).valid).toBe(true);
    const art = sanitizeBondForArtifact(b);
    expect(JSON.stringify(art)).not.toMatch(/spokenChallengeHash/); // hash dropped from the public artifact
    expect(bondGrantsAuthority(b)).toBe(false);
    expect(isBondApplyEligible(b).eligible).toBe(false);
    // ready before pin throws (fails closed)
    expect(() => markReadyForSignature(revealPhrase(createUnboundBond(NOW_ISO), NOW_ISO), NOW_ISO)).toThrow();
    // pin refuses key-material-shaped input
    expect(() => pinPublicFingerprint(createUnboundBond(NOW_ISO), 'ab'.repeat(90), NOW_ISO)).toThrow();
  });

  it('projection is deterministic in N_t; a tampered projection (extra/hidden key) is rejected', () => {
    const b = pinPublicFingerprint(revealPhrase(createUnboundBond(NOW_ISO), NOW_ISO), 'deadbeef', NOW_ISO);
    const n = deriveCeremonyProjection(b);
    expect(rejectForbiddenProjection(n).ok).toBe(true);
    expect(advisoryBondStateFromProjection(n)).toBe(b.bondState);
    expect(rejectForbiddenProjection({ ...n, smuggled: 'x' }).ok).toBe(false);
    expect(rejectForbiddenProjection({ ...n, publicFingerprint: 'sk-abcdef1234567890abcd' }).ok).toBe(false);
  });

  it('validateBond rejects any forbidden key-material field (browser/Convex tampering)', () => {
    const b = pinPublicFingerprint(revealPhrase(createUnboundBond(NOW_ISO), NOW_ISO), 'deadbeef', NOW_ISO);
    const tampered = { ...b, privateKey: 'deadbeef' } as any;
    expect(validateBond(tampered).valid).toBe(false);
  });

  it('A_t hinge: authority is 1 ONLY for a valid hybrid signature bound to the exact intent/draft/root', () => {
    const w = makeWorld();
    const c = candidate();
    const ph = candidatePayloadHash(c);
    const auth = w.owner.authorize({ proposalHash: ph, draftHash: ph, nonce: 'n', issuedAt: NOW_ISO, expiresAt: null });
    const binding = { rootId: w.owner.root.rootId, proposalHash: ph, draftHash: ph };
    expect(legalAuthorityFromPromotion(auth, w.owner.root, binding, NOW_MS)).toBe(1);
    // wrong binding ⇒ 0
    expect(legalAuthorityFromPromotion(auth, w.owner.root, { ...binding, draftHash: 'ff'.repeat(32) }, NOW_MS)).toBe(0);
    // verifier absent (null) ⇒ 0
    expect(legalAuthorityFromPromotion(null, w.owner.root, binding, NOW_MS)).toBe(0);
    // wrong owner root ⇒ 0
    const attacker = makeWorld({ ownerLabel: 'attacker' }).owner;
    expect(legalAuthorityFromPromotion(auth, attacker.root, { ...binding, rootId: attacker.root.rootId }, NOW_MS)).toBe(0);
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('WAVE 2 · approve door — the one authorization, zero effect before it', () => {
  it('the full ceremony authorizes exactly once and consumes the nonce', () => {
    const r = rig();
    const c = candidate();
    const { auth } = armForApproval(r, c);
    const res = handleApprove(r.env, req(c, PHRASE, auth, true));
    expect(res.authorized).toBe(true);
    expect(res.reasonClass).toBe('approve:authorized');
    expect(res.decisionCode).toBe('allowed');
    expect(res.decisionReceiptHash).toMatch(/^[0-9a-f]{64}$/);
    expect(res.receiptHash).toMatch(/^[0-9a-f]{64}$/);
    expect(r.monitor.consumed()).toHaveLength(1);
    expect(approveDoorGrantsAuthority()).toBe(false);
  });

  it('every refusal path receipts AND burns no authority (zero effect before authorization)', () => {
    // gate refusals
    for (const over of [{ enabled: false }, { advisory: false }] as const) {
      const r = rig(over);
      const c = candidate();
      const { auth } = armForApproval(r, c);
      const res = handleApprove(r.env, req(c, PHRASE, auth, true));
      expect(res.authorized).toBe(false);
      expect(res.reasonClass.startsWith('approve:gate:')).toBe(true);
      expect(res.receiptHash).toMatch(/^[0-9a-f]{64}$/); // receipted
      expect(r.monitor.consumed()).toHaveLength(0);        // no authority burned
    }
    // cross-origin / DNS-rebind host / cross-site
    for (const bad of [{ origin: 'http://evil.example' }, { host: 'evil.example' }, { secFetchSite: 'cross-site' }] as const) {
      const r = rig();
      const c = candidate();
      const { auth } = armForApproval(r, c);
      const res = handleApprove(r.env, req(c, PHRASE, auth, true, bad));
      expect(res.authorized).toBe(false);
      expect(res.reasonClass.startsWith('approve:gate:')).toBe(true);
      expect(r.monitor.consumed()).toHaveLength(0);
    }
  });

  it('custody absent refuses before any monitor decision', () => {
    const r = rig({ custody: custodyStatus({ homeDir: '/x' }, nonePresent) });
    const c = candidate();
    const { auth } = armForApproval(r, c);
    const res = handleApprove(r.env, req(c, PHRASE, auth, true));
    expect(res.reasonClass).toBe('approve:custody:absent');
    expect(res.receiptHash).toMatch(/^[0-9a-f]{64}$/);
    expect(r.monitor.consumed()).toHaveLength(0);
  });

  it('self-protection: a candidate targeting the ceremony membrane is refused', () => {
    const r = rig();
    const c = candidate('apps/seed/src/approveDoor.ts');
    const { auth } = armForApproval(r, c);
    const res = handleApprove(r.env, req(c, PHRASE, auth, true));
    expect(res.reasonClass).toBe('approve:self-protected-path');
    expect(r.monitor.consumed()).toHaveLength(0);
    // all WAVE 2 membranes are self-protecting
    for (const f of ['approveDoor', 'approveGuard', 'approveChallenge', 'ownerCustody', 'bondCeremony']) {
      expect(isSelfProtecting(`apps/seed/src/${f}.ts`)).toBe(true);
    }
  });

  it('unarmed approval (no humanClearance) is refused by the monitor', () => {
    const r = rig();
    const c = candidate();
    const { auth } = armForApproval(r, c);
    const res = handleApprove(r.env, req(c, PHRASE, auth, false));
    expect(res.reasonClass).toBe('approve:monitor-refused:self_modify_requires_clearance');
    expect(r.monitor.consumed()).toHaveLength(0);
  });

  it('forged Ed25519 / ML-DSA halves are refused authority_invalid (no consume)', () => {
    for (const half of ['ed25519', 'mlDsa65'] as const) {
      const r = rig();
      const c = candidate();
      const { auth } = armForApproval(r, c);
      // corrupt ONE nibble of the real signature — same length, so it fails verification (not a shape error)
      const orig = auth.signatures[half];
      const forgedHex = (orig[0] === '0' ? '1' : '0') + orig.slice(1);
      const forged = { ...auth, signatures: { ...auth.signatures, [half]: forgedHex } };
      const res = handleApprove(r.env, req(c, PHRASE, forged, true));
      expect(res.reasonClass).toBe('approve:monitor-refused:authority_invalid');
      expect(r.monitor.consumed()).toHaveLength(0);
    }
  });

  it('wrong owner (untrusted root) is refused authority_root_unknown', () => {
    const r = rig();
    const c = candidate();
    const ph = candidatePayloadHash(c);
    mintChallenge(r.challengeStore, ph, r.env.nowMs, DEFAULT_CHALLENGE_TTL_MS, { phrase: PHRASE, nonce: 'n' });
    const attacker = makeWorld({ ownerLabel: 'attacker' }).owner;
    const attackerAuth = attacker.authorize({ proposalHash: ph, draftHash: ph, nonce: 'n', issuedAt: NOW_ISO, expiresAt: null });
    const res = handleApprove(r.env, req(c, PHRASE, attackerAuth, true));
    expect(res.reasonClass).toBe('approve:monitor-refused:authority_root_unknown');
    expect(r.monitor.consumed()).toHaveLength(0);
  });

  it('nonce-unbound: a valid signature carrying a DIFFERENT nonce than the challenge is refused', () => {
    const r = rig();
    const c = candidate();
    const ph = candidatePayloadHash(c);
    mintChallenge(r.challengeStore, ph, r.env.nowMs, DEFAULT_CHALLENGE_TTL_MS, { phrase: PHRASE, nonce: 'challenge-nonce' });
    const auth = r.w.owner.authorize({ proposalHash: ph, draftHash: ph, nonce: 'a-different-nonce', issuedAt: NOW_ISO, expiresAt: null });
    const res = handleApprove(r.env, req(c, PHRASE, auth, true));
    expect(res.reasonClass).toBe('approve:nonce-unbound');
    expect(r.monitor.consumed()).toHaveLength(0);
  });

  it('proposal flood: repeated wrong-phrase attempts never consume the challenge or burn authority; a good phrase still works', () => {
    const r = rig();
    const c = candidate();
    const { auth } = armForApproval(r, c);
    for (let i = 0; i < 50; i++) {
      const res = handleApprove(r.env, req(c, `guess-${i}`, auth, true));
      expect(res.reasonClass).toBe('approve:challenge-phrase_mismatch');
      expect(res.receiptHash).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(r.monitor.consumed()).toHaveLength(0);
    // the live challenge survived the flood — a correct phrase authorizes
    expect(handleApprove(r.env, req(c, PHRASE, auth, true)).authorized).toBe(true);
    expect(r.monitor.consumed()).toHaveLength(1);
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('WAVE 2 · interrupted ceremony restart — consume-once is durable', () => {
  it('a monitor rebuilt from persisted consumed ids refuses the replayed authorization', () => {
    const r = rig();
    const c = candidate();
    const { auth } = armForApproval(r, c);
    expect(handleApprove(r.env, req(c, PHRASE, auth, true)).authorized).toBe(true);
    const persisted = r.monitor.consumed();
    expect(persisted).toHaveLength(1);

    // RESTART: a fresh monitor seeded with the persisted consumed ids + a re-minted live challenge
    const restarted = new CandidateReferenceMonitor(r.w.owner.root, { consumedIds: persisted });
    const store2 = new ReactiveMemoryStore();
    const cs2: ChallengeStore = new Map();
    const ph = candidatePayloadHash(c);
    mintChallenge(cs2, ph, NOW_MS, DEFAULT_CHALLENGE_TTL_MS, { phrase: PHRASE, nonce: 'nonce-approve-1' });
    const env2: ApproveDoorEnv = {
      store: store2, nowIso: NOW_ISO, nowMs: NOW_MS, challengeStore: cs2, monitor: restarted,
      gate: { enabled: true, advisory: true, allowedHosts: ALLOWED_HOSTS, allowedOrigins: ALLOWED_ORIGINS },
      custody: COMPLETE_CUSTODY,
    };
    const res = handleApprove(env2, req(c, PHRASE, auth, true));
    expect(res.reasonClass).toBe('approve:monitor-refused:replay');
    expect(restarted.consumed()).toHaveLength(1); // unchanged — no double effect
  });

  it('a guard refusal consumes nothing, so a fresh valid attempt after "restart" still authorizes', () => {
    const r = rig({ enabled: false }); // door not armed ⇒ gate refuses
    const c = candidate();
    const { auth } = armForApproval(r, c);
    expect(handleApprove(r.env, req(c, PHRASE, auth, true)).authorized).toBe(false);
    expect(r.monitor.consumed()).toHaveLength(0);
    // arm the door and re-mint the challenge (the previous attempt burned nothing)
    const armed: ApproveDoorEnv = { ...r.env, gate: { ...r.env.gate, enabled: true } };
    const ph = candidatePayloadHash(c);
    mintChallenge(r.challengeStore, ph, NOW_MS, DEFAULT_CHALLENGE_TTL_MS, { phrase: PHRASE, nonce: 'nonce-approve-1' });
    expect(handleApprove(armed, req(c, PHRASE, auth, true)).authorized).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('WAVE 2 · bind door — advisory transitions behind the same perimeter, grants nothing', () => {
  it('reveal → pin → ready returns public artifacts; a cross-origin bind and an invalid transition refuse', () => {
    const r = rig();
    const b0 = createUnboundBond(NOW_ISO);
    const revealed = handleBind(r.env, { host: HOST, origin: ORIGIN, secFetchSite: 'same-origin', action: 'reveal', bond: b0 });
    expect(revealed.ok).toBe(true);
    expect(revealed.grantsAuthority).toBe(false);
    const pinned = handleBind(r.env, { host: HOST, origin: ORIGIN, secFetchSite: 'same-origin', action: 'pin', bond: revealPhrase(b0, NOW_ISO), fingerprint: 'deadbeefcafe' });
    expect(pinned.reasonClass).toBe('bind:public_fingerprint_pinned');
    expect(pinned.artifact!.publicFingerprint).toBe('deadbeefcafe');
    // cross-origin bind refused
    const x = handleBind(r.env, { host: HOST, origin: 'http://evil.example', secFetchSite: 'same-origin', action: 'reveal', bond: b0 });
    expect(x.ok).toBe(false);
    expect(x.reasonClass).toBe('bind:gate:cross-origin');
    // invalid transition (ready before pin) fails closed with a receipt
    const bad = handleBind(r.env, { host: HOST, origin: ORIGIN, secFetchSite: 'same-origin', action: 'ready', bond: revealPhrase(b0, NOW_ISO) });
    expect(bad.ok).toBe(false);
    expect(bad.reasonClass).toBe('bind:invalid-transition');
    expect(bad.receiptHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
