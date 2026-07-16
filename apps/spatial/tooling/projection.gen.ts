// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R36 — live-local Spatial projection generator (the loopback brain/recursion projection seam).
 *
 * Runs the REAL merged-main organism in-process — @aukora/brain ReactiveMemoryStore + @aukora/seed
 * DurableRecursion over an InMemoryWorkflowStore — and writes the display-only projection the Spatial
 * launcher serves at /api/spatial/projection. Every value is a real package output: a workflow held at
 * AWAITING-OWNER (with its council evidence digest), an owner-completed candidate with its receipt, the
 * content-free receipt lineage, and the live brain snapshot.
 *
 * Truth: this is LIVE-LOCAL state generated at launch time (`npm run launch:live` regenerates it), not a
 * committed demo fixture — and it is labelled with its generation instant so no stale snapshot can pass as
 * fresher than it is. Display-only end to end: grantsAuthority:false / feedsApply:false at every level; the
 * shell can render this but nothing in it can authorize anything. When Sam 2's durable Convex-backed door
 * exists it supersedes this in-process source under the same schema (source: 'door').
 *
 * Offline, deterministic given the seed instant, no cloud, no paid call, no signing beyond the local
 * fixture-labelled owner adapter completing the demo candidate in an isolated sandbox.
 */
import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';

import { ReactiveMemoryStore } from '@aukora/brain';
import { buildMemoryRecord } from '@aukora/memory';
import {
  DurableRecursion, InMemoryWorkflowStore, deriveWorkflowId,
  HybridOwnerAdapter, RecursionLedger, LIMITS,
  deriveIntentId, deriveDraftHash, durableWorkflowGrantsAuthority,
  type Proposal, type RecursionEnv,
} from '@aukora/seed';

const NOW_ISO = new Date().toISOString(); // live-local: the projection carries its real generation instant
const NOW_MS = Date.parse(NOW_ISO);
const short = (h: string | null | undefined, n = 16) => (h ? `${h.slice(0, n)}…` : null);

const TARGET = 'apps/seed/src/recursion.ts';

function makeProposal(id: string, note: string): Proposal {
  return { id, targetPath: TARGET, newContent: `// ${note}`, createdAt: NOW_ISO, supersedes: null };
}

// ── the real organism, in-process ────────────────────────────────────────────────────────────────
// Two demonstration workflows, each in its OWN world (store + ledger + workflow store), matching the
// proven single-workflow pattern from the seed suite.
function makeWorld(label: string) {
  const store = new ReactiveMemoryStore();
  const owner = new HybridOwnerAdapter(label);
  const env: RecursionEnv = {
    store,
    knownFiles: new Set([TARGET, 'apps/brain/src/reactiveStore.ts']),
    ownerRoot: owner.root,
    ledger: new RecursionLedger(),
    nowMs: NOW_MS,
    nowIso: NOW_ISO,
    deadlineMs: NOW_MS + LIMITS.DEFAULT_WALL_TIME_BUDGET_MS,
  };
  return { store, owner, env, machine: new DurableRecursion(new InMemoryWorkflowStore(), env) };
}

// NOTE (learned the hard way): authorization nonces are kernel-canonical IDENTIFIERs — lowercase
// /^[a-z0-9][a-z0-9._:-]{0,127}$/. An uppercase nonce fails closed as "malformed" (the assert code
// authorization_nonce_invalid is masked by the catch-all), so nonces here stay lowercase.

// Workflow B — the full governed path: propose, owner-sign, complete into the isolated sandbox.
const worldB = makeWorld('spatial-projection-candidate');
worldB.store.ingest(buildMemoryRecord({ content: `spatial projection boot at ${NOW_ISO}`, createdAt: NOW_ISO, provenance: 'sensor' }));
worldB.store.ingest(buildMemoryRecord({ content: 'the shell asked the organism how it is', createdAt: NOW_ISO, provenance: 'reflection' }));
const pB = makeProposal('proj-candidate', 'governed refinement toward a staged candidate');
worldB.machine.propose(pB, 'spatial-proj-b');
const authB = worldB.owner.authorize({
  proposalHash: deriveIntentId(pB),
  draftHash: deriveDraftHash(pB),
  nonce: 'spatial-proj-b',
  issuedAt: NOW_ISO,
  expiresAt: null,
});
const completed = worldB.machine.complete(pB, deriveWorkflowId(deriveIntentId(pB), deriveDraftHash(pB), 'spatial-proj-b'), authB);

// Workflow A — held at the gate: real advisory review ran, owner has NOT signed. This is the
// AUMLOK "awaiting-owner" surface; displayed state cannot complete it.
const worldA = makeWorld('spatial-projection-awaiting');
const pA = makeProposal('proj-awaiting', 'governed refinement, awaiting the owner signature');
const awaiting = worldA.machine.propose(pA, 'spatial-proj-a');

const store = worldB.store; // brain health + receipts come from the world that carries the full lineage
const snap = store.snapshot();
const lineage = store.chain().map((e, i) => {
  const p = e.payload as Record<string, unknown>;
  const isTomb = p.kind === 'tombstone';
  return {
    index: i,
    kind: isTomb ? 'tombstone' : 'memory',
    provenance: isTomb ? null : (typeof p.provenance === 'string' ? p.provenance : 'unspecified'),
    chainHashShort: short(e.chainHash),
  };
});

let baseMain = 'unknown';
try { baseMain = execSync('git rev-parse HEAD').toString().trim(); } catch { /* fine — label stays unknown */ }

const projection = {
  schema: 'aukora-spatial-projection-v1',
  source: 'live-local' as const, // in-process real organism; Sam 2's durable door supersedes as source:'door'
  generatedAt: NOW_ISO,
  baseMain,
  displayOnly: true,
  feedsApply: false,
  advisoryOnly: true,
  grantsAuthority: false,

  brainHealth: {
    schema: 'BrainHealthSnapshotV1',
    mode: 'in-memory',
    liveCount: snap.liveCount,
    chainLength: snap.chainLength,
    forgottenCount: snap.forgottenCount,
    headHashShort: short(snap.headHash),
    merkleRootShort: short(snap.merkleRootHex),
    verified: store.verifyChain().valid,
    grantsAuthority: false,
  },

  workflow: {
    awaiting: {
      phase: awaiting.state?.phase ?? null,
      reasonClass: awaiting.reasonClass,
      councilEvidenceDigestShort: short(awaiting.state?.councilEvidenceDigest, 12),
      proposal: pA.id,
      note: 'held durably at the gate — a restart resumes this exact workflow without duplication',
    },
    completed: {
      phase: completed.state?.phase ?? null,
      reasonClass: completed.reasonClass,
      proposal: pB.id,
      note: 'owner-signed, applied once into the isolated sandbox; completing again is a terminal no-op',
    },
  },

  fuAdvisory: {
    boundary: 'deterministic offline advisory (in-process council reviewer)',
    verdict: awaiting.state?.phase === 'awaiting-owner' ? 'advisory-pass' : 'advisory-hold',
    evidenceDigestShort: short(awaiting.state?.councilEvidenceDigest, 12),
    advisoryOnly: true,
    grantsAuthority: false,
    note: 'the review is evidence pinned by digest — it never authorizes; only the owner signature does',
  },

  aumlok: {
    phase: 'awaiting-owner',
    workflowProposal: pA.id,
    custody: 'the owner key never enters this projection, the browser, or the launcher',
    grantsAuthority: false,
  },

  receipts: lineage,

  candidate: {
    proposal: pB.id,
    phase: completed.state?.phase ?? null,
    liveRepoTouched: false,
    note: 'sandbox-only candidate; materialization into a disposable worktree is Sam 3\'s R36 lane',
  },
} as const;

describe('generate the live-local spatial projection', () => {
  it('runs the real organism and writes a display-only projection', () => {
    expect(awaiting.ok).toBe(true);
    expect(awaiting.state?.phase).toBe('awaiting-owner');
    expect(completed.ok).toBe(true);
    expect(projection.brainHealth.verified).toBe(true);
    expect(durableWorkflowGrantsAuthority()).toBe(false);
    // fence: nothing in the projection may claim authority
    expect(JSON.stringify(projection)).not.toMatch(/"grantsAuthority":\s*true/);

    const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'projection');
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'projection.json'), JSON.stringify(projection, null, 2) + '\n');
    // eslint-disable-next-line no-console
    console.log(`  wrote projection.json (awaiting-owner + ${String(completed.state?.phase)} · ${snap.liveCount} live memories)`);
  });
});
