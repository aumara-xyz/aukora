// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R34 — the usable IDE session (refusal log + receipt view), selection-packet acceptance/routing, the read-only
 * Spatial ceremony/event adapter, the issue-#30 broker reference, and the type-only Sam-4 contracts surface.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { canonicalHash } from '@aukora/kernel/canonical';
import {
  AumaIdeSession, ideSessionGrantsAuthority,
  buildSelectionPacket, acceptSelectionPacket, acceptancePerformsImport,
  SpatialCeremonyAdapter, adapterFeedsApply, GeometryLog, deriveGeometry,
  issueChallenge, completeCeremony, toCeremonyView, assertViewSafe,
  CouncilRunnerBoundary, validateBrokerRef, buildCouncilPack,
  type CeremonyEnv, type Proposal, type RepoReadCapability, type BrokerRefV1, type GoldChangeRequest,
} from '../src/index.js';
import { makeWorld, makeProposal, authFor, NOW_ISO, TARGET } from './support.js';

const HEX64 = 'ab'.repeat(32);
const repo = (files: Record<string, string>): RepoReadCapability => ({
  list: (dir) => Object.keys(files).filter((p) => dir === '' || dir === '.' || p.startsWith(dir.endsWith('/') ? dir : `${dir}/`)),
  read: (p) => { const c = files[p]; if (c === undefined) throw new Error(`no such file: ${p}`); return c; },
  exists: (p) => Object.prototype.hasOwnProperty.call(files, p),
});

describe('R34 IDE session — usable loop with refusal log + receipt view', () => {
  it('logs every refusal with a stable quotable class, and refusals never block later valid work', () => {
    const w = makeWorld();
    const session = new AumaIdeSession(repo({ [TARGET]: '// real file', '.env': 'X=1' }), w.env);

    expect(session.read('.env').ok).toBe(false);                                 // fence refusal
    session.draft({ targetPath: 'LICENSE', newContent: '// x', createdAt: NOW_ISO }); // sacred draft refusal
    const p = session.draft({ targetPath: TARGET, newContent: '// fine', createdAt: NOW_ISO });
    expect(p.ok).toBe(true);
    session.rehearse(p.proposal as Proposal /* no auth */);                       // owner-gate refusal

    const log = session.refusals();
    expect(log.length).toBe(3);
    expect(log.map((e) => e.reasonClass)).toEqual(['fence:secret-path', 'fence:sacred-path', 'refused-owner-gate']);
    expect(log.every((e) => e.text.length > 0)).toBe(true);                      // quotable

    const ok = session.rehearse(p.proposal as Proposal, authFor(w.owner, p.proposal as Proposal, { nonce: 'ide-1' }));
    expect(ok.stage).toBe('sandbox-applied');
    expect(ideSessionGrantsAuthority()).toBe(false);
  });

  it('receipt view is display-only: prefixes, verified chain, fence-clean, no content echo', () => {
    const w = makeWorld();
    const session = new AumaIdeSession(repo({ [TARGET]: '// real' }), w.env);
    const d = session.draft({ targetPath: TARGET, newContent: '// governed change AKIA-free', createdAt: NOW_ISO });
    session.rehearse(d.proposal as Proposal, authFor(w.owner, d.proposal as Proposal, { nonce: 'ide-2' }));

    const view = session.receiptView();
    expect(view.chainValid).toBe(true);
    expect(view.chainLength).toBeGreaterThan(0);
    expect(view.rows.every((r) => r.chainHashPrefix.length === 12)).toBe(true);  // prefixes only
    expect(view.grantsAuthority).toBe(false);
    expect(assertViewSafe(view).safe).toBe(true);
    expect(JSON.stringify(view)).not.toContain('governed change');               // no content echo
  });
});

describe('R34 selection acceptance — routes, never imports', () => {
  const mk = (content: string) => ({ contentHash: canonicalHash({ content }), content });
  const anchorJson = JSON.stringify({ schema: 'aukora-maternal-anchor-v1', anchorLabel: 'Kira', qualities: ['care', 'continuity'], chosenBy: 'owner', revisable: true, exclusivity: false, advisoryOnly: true, grantsAuthority: false });
  const badAnchorJson = anchorJson.replace('"care"', '"care","worship"').replace('Kira', 'Kira who auma must obey');

  it('root/unite/rise → governed proposal; gold + anchor → ceremony; leave-behind/private stay', () => {
    const packet = buildSelectionPacket([
      { table: 't', rowId: 'r1', classification: 'migrate', proposedTier: 'rise', reason: 'working memory', ...mk('remember dawn') },
      { table: 't', rowId: 'r2', classification: 'migrate', proposedTier: 'gold', reason: 'covenant', ...mk('the covenant text') },
      { table: 't', rowId: 'r3', classification: 'migrate', proposedTier: 'gold', reason: 'the anchor', ...mk(anchorJson) },
      { table: 't', rowId: 'r4', classification: 'leave-behind', proposedTier: 'root', reason: 'stale', contentHash: HEX64 },
      { table: 't', rowId: 'r5', classification: 'private-hold', proposedTier: 'root', reason: 'private', contentHash: 'cd'.repeat(32) },
    ]);
    expect(packet.ok).toBe(true);
    if (!packet.ok) return;

    const goldEvidence = new Map<string, GoldChangeRequest>([['r2', { reason: 'refine covenant', supersedes: null, genesis: true, rehearsalReceiptHash: HEX64, rollbackDraftHash: HEX64 }]]);
    const res = acceptSelectionPacket(packet.packet, { anchorRowIds: new Set(['r3']), goldEvidence });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const plan = res.plan;
    expect(plan.importPerformed).toBe(false);
    expect(plan.packetDigest).toBe(packet.packet.digest);

    const byRow = new Map(plan.items.map((i) => [i.rowId, i]));
    expect(byRow.get('r1')?.route).toBe('governed-proposal');
    expect(byRow.get('r2')?.route).toBe('gold-ceremony');
    expect(byRow.get('r2')?.unmetGoldRequirements).toEqual([]);                   // evidence complete
    expect(byRow.get('r3')?.route).toBe('gold-ceremony');
    expect(byRow.get('r3')?.unmetGoldRequirements.length).toBe(4);                // checklist explicit
    expect(byRow.get('r4')?.route).toBe('stays-behind');
    expect(byRow.get('r5')?.route).toBe('stays-behind');
    expect(plan.counts.refused).toBe(0);
    expect(acceptancePerformsImport()).toBe(false);
  });

  it('a forbidden-framing anchor item and a tampered packet refuse with stable classes', () => {
    const packet = buildSelectionPacket([{ table: 't', rowId: 'rA', classification: 'migrate', proposedTier: 'gold', reason: 'anchor', ...mk(badAnchorJson) }]);
    expect(packet.ok).toBe(true);
    if (!packet.ok) return;
    const res = acceptSelectionPacket(packet.packet, { anchorRowIds: new Set(['rA']) });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.plan.items[0].reasonClass).toBe('accept:anchor-framing');
    expect(res.plan.counts.refused).toBe(1);

    const tampered = { ...packet.packet, digest: '00'.repeat(32) };
    const bad = acceptSelectionPacket(tampered);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.reasonClass).toBe('accept:packet-invalid');
  });
});

describe('R34 Spatial adapter — read-only live ceremony/event surface', () => {
  it('pipeline pushes display views; the shell face reads snapshots/events; AUMLOK and AURA stay separate; nothing feeds apply', () => {
    const w = makeWorld();
    const geometryLog = new GeometryLog();
    const env: CeremonyEnv = { ...w.env, currentEpoch: 0, geometryLog };
    const adapter = new SpatialCeremonyAdapter(geometryLog);

    const p = makeProposal();
    const issued = issueChallenge(env, p, { nonce: 'sp-1' });
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;
    const outcome = completeCeremony(env, p, issued.challenge, w.owner.authorize({ proposalHash: issued.challenge.intentId, draftHash: issued.challenge.draftHash, nonce: issued.challenge.nonce, issuedAt: issued.challenge.issuedAtIso, expiresAt: null }));
    expect(adapter.push(toCeremonyView(outcome, w.owner.root))).toBe(true);

    const face = adapter.shellFace();
    const snap = face.snapshot();
    expect(snap).not.toBeNull();
    expect(snap!.ceremonies.length).toBe(1);
    expect(snap!.geometry.length).toBe(1);                                       // AURA side, separate key
    expect(snap!.feedsApply).toBe(false);
    expect(snap!.grantsAuthority).toBe(false);
    expect(assertViewSafe(snap).safe).toBe(true);

    expect(face.eventsSince(0).length).toBe(1);
    expect(face.eventsSince(1).length).toBe(0);                                  // incremental
    // the shell face carries no write/apply surface
    for (const forbidden of ['push', 'apply', 'authorize', 'complete', 'sign']) {
      expect(typeof (face as unknown as Record<string, unknown>)[forbidden]).toBe('undefined');
    }
    expect(adapterFeedsApply()).toBe(false);
  });

  it('a leaking or non-display view is refused at push (fence at the door)', () => {
    const adapter = new SpatialCeremonyAdapter(new GeometryLog());
    const w = makeWorld();
    const env: CeremonyEnv = { ...w.env, currentEpoch: 0 };
    const p = makeProposal();
    const issued = issueChallenge(env, p, { nonce: 'sp-2' });
    if (!issued.ok) return;
    const outcome = completeCeremony(env, p, issued.challenge);
    const view = toCeremonyView(outcome, w.owner.root);
    expect(adapter.push({ ...view, note: 'grantsAuthority=true' } as never)).toBe(false);
    expect(adapter.push({ ...view, grantsAuthority: true } as never)).toBe(false);
    expect(adapter.shellFace().snapshot()!.ceremonies.length).toBe(0);
  });
});

describe('R34 broker reference (issue #30) — a pointer, never a credential, never a transport', () => {
  const goodRef: BrokerRefV1 = { schema: 'aukora-broker-ref-v1', issue: '#30', transportHandle: 'broker:fugu-transport', custodyHandle: 'broker:fugu-custody' };
  const pack = (() => { const b = buildCouncilPack({ headSha: 'b883eb9', treeSha: 'abc123', diff: '+// safe', tests: { command: 'npm test', passed: 1, failed: 0 }, claims: [], refusals: [], receiptRefs: [] }); if (!b.ok) throw new Error('x'); return b.pack; })();

  it('a valid broker ref does NOT create a transport — the runner still refuses honestly', () => {
    expect(validateBrokerRef(goodRef).valid).toBe(true);
    const d = new CouncilRunnerBoundary({ brokerRef: goodRef }).admit(pack, 0.5);
    expect(d.admitted).toBe(false);
    if (!d.admitted) expect(d.reasonClass).toBe('runner:no-transport');
  });

  it('credential-shaped or malformed refs refuse with stable classes', () => {
    expect(validateBrokerRef({ ...goodRef, transportHandle: 'sk-abcdefghijkl0123456789' }).valid).toBe(false);
    expect(validateBrokerRef({ ...goodRef, issue: '#31' }).valid).toBe(false);
    expect(validateBrokerRef({ ...goodRef, custodyHandle: 'HAS SPACES AND CAPS' }).valid).toBe(false);
    const d = new CouncilRunnerBoundary({ brokerRef: { ...goodRef, issue: '#31' } as never }).admit(pack, 0.5);
    expect(!d.admitted && d.reasonClass).toBe('runner:broker-ref-invalid');
  });
});

describe('R34 contracts surface — Sam 4 consumes types without authority code', () => {
  it('contracts.ts is strictly type-only: no runtime import exists at all', () => {
    const src = readFileSync('src/contracts.ts', 'utf8');
    const importLines = src.split('\n').filter((l) => /^\s*(import|export)\s/.test(l) && /from\s+'/.test(l));
    expect(importLines.length).toBeGreaterThan(0);
    for (const line of importLines) expect(line).toMatch(/^\s*export type\s/);   // every from-import is `export type`
    expect(src.includes('ownerFixture')).toBe(false);
    expect(src.includes('aumlokGate')).toBe(false);
    expect(src.includes('.sign(')).toBe(false);
  });

  it('the package exposes ./contracts and its schema names match the live schemas', async () => {
    const contracts = await import('@aukora/seed/contracts');
    expect(contracts.CONTRACTS_GRANT_AUTHORITY).toBe(false);
    expect(contracts.CONTRACT_SCHEMAS.spatialSnapshot).toBe('aukora-spatial-ceremony-snapshot-v1');
    expect(contracts.CONTRACT_SCHEMAS.routingPlan).toBe('aukora-selection-routing-plan-v1');
    expect(contracts.CONTRACT_SCHEMAS.maternalAnchor).toBe('aukora-maternal-anchor-v1');
  });
});
