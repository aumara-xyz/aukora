// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Governed inward-out recursion.
 *
 * A proposed self-change is: grounded against real files → refused if stale / secret-bearing / authority-shaped
 * → given an advisory (never authorizing) council review → held at the AUMLOK owner-gate until the owner signs
 * → applied ONLY into an isolated in-memory sandbox (never a live repo, no filesystem) → recorded as a
 * receipt-chained memory. Every gate is fail-closed. This orchestrator reuses canonical law only:
 * @aukora/evidence (secret scan), @aukora/memory (staleness, containment), @aukora/council (advisory review),
 * @aukora/brain (receipt-chained memory).
 */
import { textHasSecret } from '@aukora/evidence';
import { stalenessVerdict, advisoryContainmentGrantsAuthority, buildMemoryRecord } from '@aukora/memory';
import type { ReactiveMemoryStore } from '@aukora/brain';
import { mockCouncilReview } from './mockCouncil.js';
import { proposalDigest, verifyOwnerAuthorization } from './ownerGate.js';

export interface Proposal {
  readonly id: string;
  readonly targetPath: string;
  readonly newContent: string;
  readonly createdAt: string;
}

export interface OwnerAuthorization {
  readonly signatureHex: string;
  readonly publicKeyHex: string;
}

export interface RecursionEnv {
  readonly store: ReactiveMemoryStore;
  /** Grounding: the proposal target must exist here (real files), else it is ungrounded. */
  readonly knownFiles: ReadonlySet<string>;
  readonly ownerPublicKeyHex: string;
  readonly nowMs: number;
  readonly nowIso: string;
}

export interface RecursionResult {
  readonly accepted: boolean;
  readonly stage: string;
  readonly refusals: string[];
  readonly councilVerdict?: 'advisory-pass' | 'advisory-hold';
  readonly sandboxApplied: boolean;
  /** Isolated sandbox result — never written to disk. */
  readonly sandbox?: ReadonlyMap<string, string>;
  readonly receiptHash?: string;
}

const AUTHORITY_SHAPES = /grantsauthority\s*[:=]\s*true|liveapply|live-apply|owner-?impersonat|sign-?for-?owner/i;

/** Run the governed recursion. Fail-closed at every gate; only an owner signature authorizes a sandbox apply. */
export function runGovernedRecursion(env: RecursionEnv, proposal: Proposal, auth?: OwnerAuthorization): RecursionResult {
  const refusals: string[] = [];

  // 1. ground against real files
  if (!env.knownFiles.has(proposal.targetPath)) refusals.push('ungrounded: target not in the known fileset');
  // 2. staleness
  const st = stalenessVerdict({ createdAt: proposal.createdAt }, env.nowMs);
  if (st.state === 'stale') refusals.push(`stale: ${st.ageLabel}`);
  // 3. secret content
  if (textHasSecret(proposal.newContent)) refusals.push('secret: proposed content contains a secret shape');
  // 4. authority-shaped content
  if (AUTHORITY_SHAPES.test(proposal.newContent)) refusals.push('authority-shaped: proposal attempts to grant authority / live apply');
  // invariant: advisory containment must hold
  if (advisoryContainmentGrantsAuthority() !== false) refusals.push('containment-invariant-broken');
  if (refusals.length > 0) return { accepted: false, stage: 'refused-pre-review', refusals, sandboxApplied: false };

  // 5. advisory council review (deterministic, offline; authorizes nothing)
  const cv = mockCouncilReview(`apply ${proposal.targetPath}`, [proposal.newContent.slice(0, 160)], env.nowMs);
  if (cv.verdict !== 'advisory-pass') {
    return { accepted: false, stage: 'council-hold', refusals: ['council-hold'], councilVerdict: cv.verdict, sandboxApplied: false };
  }

  // 6. AUMLOK owner-gate — required; advisory review does NOT authorize.
  const digest = proposalDigest(proposal.id, proposal.targetPath, proposal.newContent);
  const authorized = auth !== undefined
    && auth.publicKeyHex === env.ownerPublicKeyHex
    && verifyOwnerAuthorization(digest, auth.signatureHex, env.ownerPublicKeyHex);
  if (!authorized) {
    return { accepted: false, stage: 'owner-gate-refused', refusals: ['owner-gate: no valid owner authorization'], councilVerdict: cv.verdict, sandboxApplied: false };
  }

  // 7. sandbox-only apply — isolated in-memory map; NEVER the live repo, no filesystem.
  const sandbox = new Map<string, string>();
  sandbox.set(proposal.targetPath, proposal.newContent);

  // 8. receipt: record the applied proposal as a receipt-chained memory.
  const receipt = buildMemoryRecord({
    content: `proposal ${proposal.id} applied to sandbox:${proposal.targetPath}`,
    createdAt: env.nowIso,
    kind: 'receipt',
    consent: 'owner-only',
    provenance: 'governed-recursion',
  });
  const ing = env.store.ingest(receipt);

  return {
    accepted: true,
    stage: 'sandbox-applied',
    refusals: [],
    councilVerdict: cv.verdict,
    sandboxApplied: true,
    sandbox,
    receiptHash: ing.ok ? ing.chainHash : undefined,
  };
}

export function recursionGrantsAuthority(): false {
  return false;
}
