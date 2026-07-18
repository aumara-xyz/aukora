// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R54 child harness — a SEPARATE OS process that consumes a REAL hybrid owner authorization through the
 * DurableCandidateReferenceMonitor over a shared trusted-state dir, so the parent test can `kill -9` it (SIGKILL
 * survival) or race two of us (concurrent exactly-one). Deterministic: the owner root derives from the fixture
 * label, so the parent independently rebuilds the same root + authorization. esbuild-bundled by the test and run
 * with a bare `node` (Node 20 + 22). argv: <stateDir> <nonce> <mode: commit-hang | commit-exit>.
 * Emits via synchronous writeSync (never console.log — a process.exit flush race loses lines on Node 20).
 */
import { writeSync } from 'node:fs';
import { HybridOwnerAdapter } from '../src/ownerFixture.js';
import { DurableCandidateReferenceMonitor } from '../src/durableCandidateMonitor.js';
import { candidatePayloadHash } from '../src/candidateReferenceMonitor.js';
import type { BranchCandidate } from '../src/ideEnvelope.js';

const emit = (line: string) => { writeSync(1, line + '\n'); };
const [stateDir, nonce, mode] = process.argv.slice(2);

const NOW_ISO = '2026-07-16T12:00:00.000Z';
const NOW_MS = Date.parse(NOW_ISO);
const owner = new HybridOwnerAdapter('r54-child'); // deterministic from the label — parent rebuilds the same root

const candidate = {
  schema: 'aukora-branch-candidate-v1', candidateId: 'ab'.repeat(32),
  workspace: new Map([['apps/seed/src/notes.ts', '// c']]),
  files: [{ path: 'apps/seed/src/notes.ts', intentId: 'cd'.repeat(32), draftHash: 'ef'.repeat(32), diff: '', receiptHash: 'ab'.repeat(32) }],
  explanation: 'x', lineage: [{ intentId: 'cd'.repeat(32), depth: 0 }],
  staged: true, pushed: false, signed: false, merged: false, deployed: false, grantsAuthority: false,
} as unknown as BranchCandidate;

const ph = candidatePayloadHash(candidate);
const auth = owner.authorize({ proposalHash: ph, draftHash: ph, nonce, issuedAt: NOW_ISO, expiresAt: null });
const monitor = new DurableCandidateReferenceMonitor(owner.root, stateDir);

// Bounded retry: a concurrent sibling may hold the single-writer lock for a moment.
let decision = monitor.decide(candidate, auth, NOW_MS, { ownerArmed: true });
for (let i = 0; i < 40 && !decision.allowed && decision.code === 'trusted_state_locked'; i++) {
  await new Promise((r) => setTimeout(r, 50));
  decision = monitor.decide(candidate, auth, NOW_MS, { ownerArmed: true });
}
emit(decision.allowed ? `COMMITTED:${monitor.consumed().length}` : `REFUSED:${decision.code}`);

// R54 review repair: hang ONLY on an allowed (durably committed) decision — the whole point of commit-hang is
// letting the parent SIGKILL a process whose consume is already on disk. A REFUSED decision emits and exits;
// hanging on a refusal would orphan the child if the parent ever skipped the kill on a non-COMMITTED line.
if (mode === 'commit-hang' && decision.allowed) {
  setInterval(() => {}, 1000); // stay alive so the parent can SIGKILL us AFTER the commit is durable
} else {
  process.exit(0);
}
