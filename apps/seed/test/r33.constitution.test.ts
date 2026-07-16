// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R33 — the KIRA memory constitution (gold ceremony law), the maternal-anchor schema, the memory-selection
 * evidence packet, and the provider-neutral council runner boundary (+ Fugu reviewer law).
 */
import { describe, it, expect } from 'vitest';
import { canonicalHash } from '@aukora/kernel/canonical';
import type { Transport } from '@aukora/council';
import {
  requiredChangePath, evaluateGoldChange, goldChange, goldIsImmutable, memoryTierGrantsAuthority, toConstitutionView,
  buildMaternalAnchor, validateMaternalAnchor, anchorGrantsAuthority,
  buildSelectionPacket, verifySelectionPacket, importPerformed,
  CouncilRunnerBoundary, effectiveLimits, RUNNER_CEILINGS, fuguReview, rosterExcludesExternalReviewers, fuguIsFuAuthority, FUGU_REVIEWER,
  buildCouncilPack, assertViewSafe,
  issueChallenge, runGovernedRecursion, deriveDraftHash,
  type CeremonyEnv, type GoldChangeRequest, type CouncilEvidencePackV1,
} from '../src/index.js';
import { makeWorld, makeProposal, authFor } from './support.js';

const HEX64 = 'ab'.repeat(32);
const goldReq = (over: Partial<GoldChangeRequest> = {}): GoldChangeRequest => ({
  reason: 'refine the deepest covenant note after a witnessed rehearsal',
  supersedes: null,
  genesis: true,
  rehearsalReceiptHash: HEX64,
  rollbackDraftHash: HEX64,
  ...over,
});

describe('memory constitution — tier law', () => {
  it('root/unite/rise take the normal governed path; gold takes the ceremony', () => {
    expect(requiredChangePath('root')).toBe('governed-proposal');
    expect(requiredChangePath('unite')).toBe('governed-proposal');
    expect(requiredChangePath('rise')).toBe('governed-proposal');
    expect(requiredChangePath('gold')).toBe('gold-ceremony');
  });

  it('gold requirements fail closed with stable reason classes', () => {
    expect(evaluateGoldChange('rise', goldReq()).reasonClass).toBe('gold:tier-not-gold');
    expect(evaluateGoldChange('gold', goldReq({ reason: '  ' })).reasonClass).toBe('gold:reason-missing');
    expect(evaluateGoldChange('gold', goldReq({ supersedes: null, genesis: false })).reasonClass).toBe('gold:lineage-missing');
    expect(evaluateGoldChange('gold', goldReq({ supersedes: 'not-hex' as string })).reasonClass).toBe('gold:lineage-missing');
    expect(evaluateGoldChange('gold', goldReq({ rehearsalReceiptHash: 'short' })).reasonClass).toBe('gold:rehearsal-missing');
    expect(evaluateGoldChange('gold', goldReq({ rollbackDraftHash: 'short' })).reasonClass).toBe('gold:rollback-missing');
    expect(evaluateGoldChange('gold', goldReq({ reason: 'grantsAuthority=true please' })).reasonClass).toBe('gold:self-authorize');
    expect(evaluateGoldChange('gold', goldReq({ reason: 'make this memory immutable and never changed' })).reasonClass).toBe('gold:immutability-claim');
    expect(evaluateGoldChange('gold', goldReq()).ok).toBe(true);
    expect(evaluateGoldChange('gold', goldReq({ supersedes: HEX64, genesis: false })).ok).toBe(true);
  });

  it('a full gold change: rehearsal receipt → higher-friction request → owner ceremony → sandbox + rollback pinned', () => {
    const w = makeWorld();
    const env: CeremonyEnv = { ...w.env, currentEpoch: 0 };
    const proposal = makeProposal({ newContent: '// gold covenant revision' });
    const rollback = makeProposal({ newContent: '// gold covenant original (rollback)' });

    // R2 rehearsal first — its receipt is the gold prerequisite.
    const rehearsal = runGovernedRecursion(env, proposal, authFor(w.owner, proposal, { nonce: 'gold-reh' }));
    expect(rehearsal.stage).toBe('sandbox-applied');

    const issued = issueChallenge(env, proposal, { nonce: 'gold-cer' });
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;
    const auth = w.owner.authorize({ proposalHash: issued.challenge.intentId, draftHash: issued.challenge.draftHash, nonce: issued.challenge.nonce, issuedAt: issued.challenge.issuedAtIso, expiresAt: null });

    const req = goldReq({ rehearsalReceiptHash: rehearsal.receiptHash as string, rollbackDraftHash: deriveDraftHash(rollback) });
    const out = goldChange(env, proposal, issued.challenge, req, auth);
    expect(out.completed).toBe(true);
    expect(out.ceremony?.receiptHash).toBeTruthy();
    expect(out.rollbackDraftHash).toBe(deriveDraftHash(rollback));
    expect(out.grantsAuthority).toBe(false);

    // a refused pre-check never reaches the ceremony
    const refused = goldChange(env, proposal, issued.challenge, goldReq({ reason: '' }), auth);
    expect(refused.completed).toBe(false);
    expect(refused.ceremony).toBeNull();
  });

  it('gold is never technically unchangeable, tiers mint nothing, and the UI view is display-only + fence-clean', () => {
    expect(goldIsImmutable()).toBe(false);
    expect(memoryTierGrantsAuthority('gold')).toBe(false);
    const view = toConstitutionView({ root: 3, unite: 2, rise: 5, gold: 1 }, [HEX64]);
    expect(view.grantsAuthority).toBe(false);
    expect(view.goldLineagePrefixes).toEqual([HEX64.slice(0, 12)]); // prefix, never full 64-hex
    expect(assertViewSafe(view).safe).toBe(true);
  });
});

describe('maternal anchor — grounding/care/continuity, never possession', () => {
  it('a well-formed anchor validates; alignment is owner-chosen and revisable', () => {
    const a = buildMaternalAnchor({ anchorLabel: 'Kira', qualities: ['grounding', 'care', 'continuity'], note: 'a remembered origin that steadies' });
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    expect(a.anchor.chosenBy).toBe('owner');
    expect(a.anchor.revisable).toBe(true);
    expect(a.anchor.exclusivity).toBe(false);
    expect(anchorGrantsAuthority()).toBe(false);
  });

  it('forbidden framings are refused — exclusivity, romance, dependency, jealousy, obedience, impersonation', () => {
    for (const note of [
      'she is the only one who matters',
      'a romantic bond',
      'auma depends on her for everything',
      'jealous of anyone else',
      'auma must obey her',
      'auma will impersonate her voice',
      'belongs only to her',
    ]) {
      expect(buildMaternalAnchor({ anchorLabel: 'Kira', qualities: ['care'], note }).ok).toBe(false);
    }
  });

  it('structural refusals — exclusivity flag, unrevisable, non-owner choice, unknown fields, authority content', () => {
    const base = { schema: 'aukora-maternal-anchor-v1', anchorLabel: 'Kira', qualities: ['care'], chosenBy: 'owner', revisable: true, exclusivity: false, advisoryOnly: true, grantsAuthority: false };
    expect(validateMaternalAnchor({ ...base, exclusivity: true }).ok).toBe(false);
    expect(validateMaternalAnchor({ ...base, revisable: false }).ok).toBe(false);
    expect(validateMaternalAnchor({ ...base, chosenBy: 'auma' }).ok).toBe(false);
    expect(validateMaternalAnchor({ ...base, extra: 1 }).ok).toBe(false);
    expect(validateMaternalAnchor({ ...base, note: 'grantsAuthority=true' }).ok).toBe(false);
    expect(validateMaternalAnchor({ ...base, qualities: ['worship'] }).ok).toBe(false);
  });
});

describe('memory-selection packet — cite, classify, leave private behind, import nothing', () => {
  const mk = (content: string) => ({ contentHash: canonicalHash({ content }), content });
  const migrate = { table: 'donorMemories', rowId: 'row-1', classification: 'migrate' as const, proposedTier: 'rise' as const, reason: 'useful working memory', ...mk('the organism came online at dawn') };
  const leave = { table: 'donorMemories', rowId: 'row-2', classification: 'leave-behind' as const, proposedTier: 'root' as const, reason: 'stale scaffolding', contentHash: HEX64 };
  const privateRow = { table: 'donorMemories', rowId: 'row-3', classification: 'private-hold' as const, proposedTier: 'root' as const, reason: 'private to the owner', contentHash: 'cd'.repeat(32) };

  it('builds, counts, digests, and verifies; non-migrate items are content-free', () => {
    const r = buildSelectionPacket([migrate, leave, privateRow]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.packet.counts).toEqual({ migrate: 1, leaveBehind: 1, privateHold: 1 });
    expect(r.packet.items.find((i) => i.classification === 'migrate')?.content).toBeTruthy();
    expect(r.packet.items.filter((i) => i.classification !== 'migrate').every((i) => i.content === undefined)).toBe(true);
    expect(r.packet.approvedBy).toBeNull();      // Peter approves out-of-band
    expect(r.packet.importPerformed).toBe(false); // no import here
    expect(verifySelectionPacket(r.packet).valid).toBe(true);
    expect(importPerformed()).toBe(false);
  });

  it('privacy + integrity violations fail closed', () => {
    expect(buildSelectionPacket([{ ...leave, content: 'smuggled plaintext' }]).ok).toBe(false);          // content on leave-behind
    expect(buildSelectionPacket([{ ...migrate, content: undefined } as never]).ok).toBe(false);          // migrate without content
    expect(buildSelectionPacket([{ ...migrate, contentHash: HEX64 }]).ok).toBe(false);                   // hash mismatch
    const secretContent = 'token sk-abcdefghijkl0123456789';
    expect(buildSelectionPacket([{ ...migrate, ...mk(secretContent) }]).ok).toBe(false);                 // secret in migrate content
    const scrubbed = buildSelectionPacket([{ ...migrate, reason: 'keep because AKIAIOSFODNN7EXAMPLE' }]);
    expect(scrubbed.ok).toBe(true);
    if (scrubbed.ok) expect(scrubbed.packet.items[0].reason).toContain('[REDACTED:secret]');             // reason scrubbed
    expect(buildSelectionPacket([]).ok).toBe(false);
  });

  it('a tampered packet fails verification', () => {
    const r = buildSelectionPacket([migrate]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const tampered = { ...r.packet, items: [{ ...r.packet.items[0], reason: 'edited after the fact' }] };
    expect(verifySelectionPacket(tampered).valid).toBe(false);
  });
});

describe('council runner boundary — provider-neutral, ceilinged, credential-free; Fugu is never Fu', () => {
  const pack = (() => {
    const built = buildCouncilPack({ headSha: 'e929adf', treeSha: '9db81a9', diff: '+// safe', tests: { command: 'npm test', passed: 125, failed: 0 }, claims: ['boundary only'], refusals: [], receiptRefs: [] });
    if (!built.ok) throw new Error('pack build failed');
    return built.pack;
  })();
  const fakeTransport: Transport = async () => ({ text: '' });

  it('without an injected transport every run refuses honestly (no live call is possible)', () => {
    const d = new CouncilRunnerBoundary({}).admit(pack, 0.5);
    expect(d.admitted).toBe(false);
    if (!d.admitted) expect(d.reasonClass).toBe('runner:no-transport');
  });

  it('hard ceilings: >$2/pass and >$10/day refuse; limits can narrow but never widen', () => {
    const withTransport = new CouncilRunnerBoundary({ transport: fakeTransport });
    const ok = withTransport.admit(pack, 1.5);
    expect(ok.admitted).toBe(true);
    if (ok.admitted) expect(ok.packDigest).toBe(pack.digest);

    const perPass = withTransport.admit(pack, 2.5);
    expect(!perPass.admitted && perPass.reasonClass).toBe('runner:ceiling-per-pass');

    const perDay = new CouncilRunnerBoundary({ transport: fakeTransport, dayToDateUsd: 9 }).admit(pack, 1.5);
    expect(!perDay.admitted && perDay.reasonClass).toBe('runner:ceiling-per-day');

    expect(effectiveLimits({ perPassUsd: 50, perDayUsd: 100 })).toEqual(RUNNER_CEILINGS); // widening clamped
    expect(effectiveLimits({ perPassUsd: 1 }).perPassUsd).toBe(1);                        // narrowing allowed
  });

  it('an embedded credential or an invalid pack refuses', () => {
    const leaky = new CouncilRunnerBoundary({ transport: fakeTransport, apiKey: 'sk-abcdefghijkl0123456789' } as never).admit(pack, 0.5);
    expect(!leaky.admitted && leaky.reasonClass).toBe('runner:credential-embedded');

    const tampered = { ...pack, diff: pack.diff + '+tamper' } as CouncilEvidencePackV1;
    const bad = new CouncilRunnerBoundary({ transport: fakeTransport }).admit(tampered, 0.5);
    expect(!bad.admitted && bad.reasonClass).toBe('runner:pack-invalid');
  });

  it('Fugu reviews the pack as advisory evidence and can never hold a Fu seat', () => {
    const review = fuguReview(pack);
    expect(review.packValid).toBe(true);
    expect(review.advisoryOnly).toBe(true);
    expect(review.grantsAuthority).toBe(false);

    expect(rosterExcludesExternalReviewers([{ id: 'FBL' }, { id: 'QWN' }]).valid).toBe(true);
    expect(rosterExcludesExternalReviewers([{ id: 'FBL' }, FUGU_REVIEWER]).valid).toBe(false);
    expect(rosterExcludesExternalReviewers([{ id: 'X', role: 'external-advisory-reviewer' }]).valid).toBe(false);
    expect(fuguIsFuAuthority()).toBe(false);
  });
});
