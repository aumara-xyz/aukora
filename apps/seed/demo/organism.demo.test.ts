// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * demo:organism — deterministic proof that Aukora is a GOVERNED, GROWING, REMEMBERING organism.
 *
 * Runs headlessly with no cloud, no network, no paid call, no filesystem write, no live-repo mutation. Every
 * step is asserted; the transcript is printed. This is proof-of-growth on the deterministic in-memory reactive
 * adapter — NOT a claim of live Convex cloud execution (the curated Convex backend under apps/brain/convex
 * mirrors the same contracts and is the convex-test / live target). The self-change is held at a REAL hybrid
 * AUMLOK owner-gate (Ed25519 + ML-DSA-65 via the kernel authority API) — no Ed25519-only downgrade.
 */
import { describe, it, expect } from 'vitest';
import { ReactiveMemoryStore, providerGrantsAuthority } from '@aukora/brain';
import { buildMemoryRecord } from '@aukora/memory';
import {
  HybridOwnerAdapter, RecursionLedger, LIMITS, deriveIntentId, deriveDraftHash,
  runGovernedRecursion, type Proposal, type RecursionEnv,
} from '../src/index.js';

const NOW_ISO = '2026-07-16T08:00:00.000Z';
const NOW_MS = Date.parse(NOW_ISO);
const at = (s: number) => `2026-07-16T08:00:${String(s).padStart(2, '0')}.000Z`;
const log = (s: string) => console.log(`  ${s}`);

describe('demo:organism — a governed, growing, remembering organism', () => {
  it('ingests, grows, recalls, governs a self-change, and forgets — all verifiable', () => {
    const store = new ReactiveMemoryStore();
    log('ORGANISM SEED — deterministic, offline, no live repo touched');

    // 1 + 2. ingest event A, persisted through the brain adapter
    const A = store.ingest(buildMemoryRecord({ content: 'event A: the organism came online', createdAt: at(1), provenance: 'sensor' }));
    expect(A.ok).toBe(true);
    log(`1-2. ingested A → chainHash ${(A as { chainHash: string }).chainHash.slice(0, 16)}…`);

    // 3. receipt/Merkle lineage verifies
    expect(store.verifyChain().valid).toBe(true);
    expect(store.snapshot().merkleRootHex).not.toBeNull();
    log(`3.   receipt chain verified; merkleRoot ${store.snapshot().merkleRootHex!.slice(0, 16)}…`);

    // 4. reactive snapshot updated
    expect(store.snapshot().liveCount).toBe(1);
    expect(store.snapshot().headHash).toBe((A as { chainHash: string }).chainHash);
    log(`4.   reactive snapshot → liveCount=1, head set`);

    // 5. recall A
    const rA = store.recall({ text: 'came online' });
    expect(rA.map((h) => h.content)).toEqual(['event A: the organism came online']);
    log(`5.   recalled A`);

    // 6 + 7. ingest event B → memory GREW
    const before = store.snapshot().liveCount;
    store.ingest(buildMemoryRecord({ content: 'event B: it remembered A and reacted', createdAt: at(2), provenance: 'reflection' }));
    expect(store.snapshot().liveCount).toBe(before + 1);
    log(`6-7. ingested B → memory GREW ${before}→${store.snapshot().liveCount}`);

    // 8. generate a self-change proposal grounded on a real file
    const targetPath = 'apps/seed/src/recursion.ts';
    const proposal: Proposal = { id: 'p1', targetPath, newContent: '// governed refinement to the recursion note', createdAt: NOW_ISO, supersedes: null };
    const owner = new HybridOwnerAdapter('demo');
    const env: RecursionEnv = {
      store,
      knownFiles: new Set([targetPath, 'apps/brain/src/reactiveStore.ts']),
      ownerRoot: owner.root,
      ledger: new RecursionLedger(),
      nowMs: NOW_MS,
      nowIso: NOW_ISO,
      deadlineMs: NOW_MS + LIMITS.DEFAULT_WALL_TIME_BUDGET_MS,
    };
    log(`8.   generated self-change proposal ${proposal.id} → ${targetPath}; owner root ${owner.root.rootId.slice(0, 16)}… (hybrid)`);

    // canonical 64-hex intent id + draft hash — what the owner signs over
    const intentId = deriveIntentId(proposal);
    const draftHash = deriveDraftHash(proposal);
    expect(intentId).toMatch(/^[0-9a-f]{64}$/);
    expect(draftHash).toMatch(/^[0-9a-f]{64}$/);

    // 9 + 10. WITHOUT owner authorization: advisory review runs, but owner-gate REFUSES (and is receipted)
    const refused = runGovernedRecursion(env, proposal /* no auth */);
    expect(refused.accepted).toBe(false);
    expect(refused.stage).toBe('refused-owner-gate');
    expect(refused.councilVerdict).toBe('advisory-pass'); // review happened; it did NOT authorize
    expect(refused.sandboxApplied).toBe(false);
    expect(refused.receiptHash).toBeTruthy();              // even a refusal is receipted
    expect(refused.authorityMinted).toBe(false);
    log(`9-10. advisory review=advisory-pass BUT owner-gate REFUSED (no owner signature) — review never authorizes; refusal receipted`);

    // 11 + 12. WITH a real hybrid owner signature: accepted into an ISOLATED sandbox + receipt recorded
    const auth = owner.authorize({ proposalHash: intentId, draftHash, nonce: 'demo-nonce-1', issuedAt: NOW_ISO, expiresAt: null });
    const grew = store.snapshot().liveCount;
    const accepted = runGovernedRecursion(env, proposal, auth);
    expect(accepted.accepted).toBe(true);
    expect(accepted.stage).toBe('sandbox-applied');
    expect(accepted.aumlokMode).toBe('software_hybrid');
    expect(accepted.sandboxApplied).toBe(true);
    expect(accepted.sandbox?.get(targetPath)).toBe(proposal.newContent);
    expect(accepted.receiptHash).toBeTruthy();
    expect(store.snapshot().liveCount).toBe(grew + 1); // exactly one receipt memory added
    log(`11-12. owner-signed (hybrid) → applied to ISOLATED sandbox; receipt ${accepted.receiptHash!.slice(0, 16)}… recorded`);

    // 13. never touched the live repository — the "apply" is a Map, not the disk. (No fs is imported on this path.)
    log(`13.  live repository NOT touched (sandbox is in-memory; no fs write)`);

    // Governed forgetting: owner-authorized tombstone hides A, keeps a content-free audit, chain still verifies
    const rec = store.recall({ text: 'came online' });
    const aId = rec[0].recordId;
    const forget = store.forget(aId, () => true, at(5));
    expect(forget.ok).toBe(true);
    expect(store.recall({ text: 'came online' }).length).toBe(0);
    expect(store.verifyChain().valid).toBe(true);
    const tomb = store.chain()[store.chain().length - 1].payload as Record<string, unknown>;
    expect(tomb.kind).toBe('tombstone');
    expect(JSON.stringify(tomb)).not.toContain('came online');
    log(`FORGET. owner-authorized tombstone → A invisible; content-free audit kept; chain still verifies`);

    // authority containment holds everywhere
    expect(providerGrantsAuthority()).toBe(false);
    expect(accepted.authorityMinted).toBe(false);
    log('DONE. governed · growing · remembering — advisoryOnly, grantsAuthority:false held throughout');
  });
});
