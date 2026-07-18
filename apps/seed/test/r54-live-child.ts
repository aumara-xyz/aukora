// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R54 live-effect child harness — a SEPARATE OS process that runs the COMPLETE live-effect path
 * (`runLiveCandidateEffect` → `driveEffect` → durable PREPARED + hardened candidate stage) against a SHARED
 * trusted-state dir + repo, so the parent test can race two of us for genuine cross-process contention. The
 * owner root + candidate derive deterministically from the argv so every child + the parent reconstruct the
 * identical root, authorization, and candidate. esbuild-bundled by the test, run with a bare `node` (Node 20 + 22).
 * argv: <repoRoot> <worktreeBase> <stateDir> <ownerLabel> <tag>. Emits `PHASE:<phase>` via synchronous writeSync.
 */
import { writeSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ReactiveMemoryStore } from '@aukora/brain';
import {
  runLiveCandidateEffect, HybridOwnerAdapter, candidatePayloadHash, deriveDraftHash, deriveIntentId,
  type BranchCandidate,
} from '../src/index.js';
import { DurableCandidateReferenceMonitor } from '../src/durableCandidateMonitor.js';

const NOW_ISO = '2026-07-16T12:00:00.000Z';
const NOW_MS = Date.parse(NOW_ISO);
const [repoRoot, worktreeBase, stateDir, ownerLabel, tag] = process.argv.slice(2);

// Deterministic candidate (identical across children + parent) — real draftHash/intentId for the content.
function makeCandidate(t: string): BranchCandidate {
  const candidateId = createHash('sha256').update(t).digest('hex');
  const path = 'apps/seed/src/notes.ts';
  const newContent = `// live effect ${t}\n`;
  const prop = { id: 'x', targetPath: path, newContent, createdAt: '2026-01-01T00:00:00.000Z', supersedes: null };
  return {
    schema: 'aukora-branch-candidate-v1', candidateId,
    workspace: new Map([[path, newContent]]),
    files: [{ path, intentId: deriveIntentId(prop), draftHash: deriveDraftHash(prop), diff: '', receiptHash: 'ab'.repeat(32) }],
    explanation: 'r54 live', lineage: [{ intentId: deriveIntentId(prop), depth: 0 }],
    staged: true, pushed: false, signed: false, merged: false, deployed: false, grantsAuthority: false,
  } as unknown as BranchCandidate;
}

const owner = new HybridOwnerAdapter(ownerLabel);
const candidate = makeCandidate(tag);
const ph = candidatePayloadHash(candidate);
const auth = owner.authorize({ proposalHash: ph, draftHash: ph, nonce: `n-${tag}`, issuedAt: NOW_ISO, expiresAt: null });

const r = runLiveCandidateEffect({
  repoRoot, worktreeBase, candidate, candidateAuth: auth, ownerArmed: true, ownerRoot: owner.root,
  monitor: new DurableCandidateReferenceMonitor(owner.root, stateDir),
  store: new ReactiveMemoryStore(), nowMs: NOW_MS, nowIso: NOW_ISO,
});
writeSync(1, `PHASE:${r.phase}\n`);
