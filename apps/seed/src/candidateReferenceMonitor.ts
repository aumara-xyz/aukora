// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Candidate reference monitor (R39) — the ONE canonical authorization for the single effectful path.
 *
 * The local candidate stage no longer authorizes itself with a bespoke signature check. It routes the decision
 * through the kernel's canonical `decide()` reference monitor, so there is exactly ONE authorization semantics for
 * the whole system — no parallel or weaker path:
 *   - the effect is a `self-modify` ring request. `decide()` refuses it unless `humanClearance` is set (the owner has
 *     explicitly ARMED the materialization), the `consumptionId` (the nonce) has not been consumed (replay), the
 *     `payloadHash` is present and BOTH the authorization's proposalHash AND draftHash equal it (canonical single
 *     bound hash), the owner root is trusted, and the hybrid Ed25519+ML-DSA-65 signature verifies;
 *   - a favorable decision consumes the id (persisted in the monitor's trusted state, so re-materialization replays)
 *     and yields the canonical receiptDraft head — the same receipt lineage the rest of the kernel uses;
 *   - the isolated candidate remains TERMINAL: this monitor authorizes staging a candidate branch, never a live-tree
 *     apply.
 *
 * Pure w.r.t. authority (verify-only): it never signs. It holds the trusted state (consumed ids + receipt head) so
 * the consumed-authority guard is durable across calls.
 */
import { decide } from '@aukora/kernel/reducer';
import { canonicalBytes, canonicalHash } from '@aukora/kernel/canonical';
import type { KernelRequestV1, TrustedStateV1, SignedPromotionV2, AumlokAuthorityRootV2 } from '@aukora/kernel/schemas';
import { deriveIntentId, deriveDraftHash, type Proposal } from './proposal.js';
import type { BranchCandidate } from './ideEnvelope.js';

const CANDIDATE_ACTION = Object.freeze({ namespace: 'aukora', kind: 'candidate', verb: 'materialize' });

/** Canonical single payload hash the owner signs to authorize THIS candidate (binds candidateId + every file). */
export function candidatePayloadHash(candidate: Pick<BranchCandidate, 'candidateId' | 'files'>): string {
  return canonicalHash({
    domain: 'AUKORA-CANDIDATE-PAYLOAD/1',
    candidateId: candidate.candidateId,
    files: candidate.files.map((f) => ({ path: f.path, intentId: f.intentId, draftHash: f.draftHash })),
  });
}

/** Compute the same payload hash from the raw file descriptors (so an owner can pre-sign before assembly). */
export function candidatePayloadHashForFiles(candidateId: string, files: readonly { path: string; intentId: string; draftHash: string }[]): string {
  return canonicalHash({ domain: 'AUKORA-CANDIDATE-PAYLOAD/1', candidateId, files: files.map((f) => ({ path: f.path, intentId: f.intentId, draftHash: f.draftHash })) });
}

/** Candidate id from file descriptors — MUST match ideEnvelope's assembly formula. */
export function candidateIdForFiles(files: readonly { path: string; intentId: string; draftHash: string }[]): string {
  return canonicalHash({ files: files.map((f) => ({ path: f.path, intentId: f.intentId, draftHash: f.draftHash })) });
}

/** The owner pre-signs THIS: derive {candidateId, payloadHash} from the proposals a materialization will stage. */
export function candidatePayloadForProposals(proposals: readonly Proposal[]): { candidateId: string; payloadHash: string } {
  const files = proposals.map((p) => ({ path: p.targetPath, intentId: deriveIntentId(p), draftHash: deriveDraftHash(p) }));
  const candidateId = candidateIdForFiles(files);
  return { candidateId, payloadHash: candidatePayloadHashForFiles(candidateId, files) };
}

/** The ONE candidate policy — exported so every monitor implementation shares identical authorization semantics. */
export function candidatePolicyBytes(): Uint8Array {
  return canonicalBytes({
    schema: 'aukora-policy-v1',
    rules: [{ action: { namespace: CANDIDATE_ACTION.namespace, kind: CANDIDATE_ACTION.kind, verb: CANDIDATE_ACTION.verb }, resourceNamespace: 'candidate', maxRing: 'self-modify', requiresAuthorization: true }],
    sacred: [],
  });
}

/**
 * The ONE canonical kernel request for a candidate materialization — extracted so the durable monitor (R54) and the
 * in-memory monitor submit byte-identical requests to `decide()`. Total: a hostile `auth` getter yields no nonce.
 */
export function buildCandidateKernelRequest(candidate: BranchCandidate, auth: SignedPromotionV2 | undefined, ownerArmed: boolean): { request: KernelRequestV1; payloadHash: string } {
  const payloadHash = candidatePayloadHash(candidate);
  let nonce = '';
  try { const n = auth?.authorization?.nonce; nonce = typeof n === 'string' ? n : ''; } catch { nonce = ''; }
  const request: KernelRequestV1 = {
    schema: 'aukora-kernel-request-v1',
    requestId: `candidate-${candidate.candidateId.slice(0, 24)}`,
    action: { namespace: CANDIDATE_ACTION.namespace, kind: CANDIDATE_ACTION.kind, verb: CANDIDATE_ACTION.verb },
    resource: { namespace: 'candidate', id: candidate.candidateId },
    ring: 'self-modify',
    payloadHash,
    consumptionId: nonce.length > 0 ? nonce : null,
    humanClearance: ownerArmed,
    authorization: (auth as SignedPromotionV2) ?? null,
    evidenceRefs: candidate.files.map((f) => f.receiptHash).filter((x): x is string => typeof x === 'string').sort(),
  };
  return { request, payloadHash };
}

export interface MonitorDecision {
  readonly allowed: boolean;
  /** Canonical kernel decision code (e.g. allowed / self_modify_requires_clearance / replay / authority_invalid). */
  readonly code: string;
  readonly ring: string;
  readonly authorizedRootId: string | null;
  readonly payloadHash: string;
  /** Canonical receipt draft head hash from decide() (the kernel receipt lineage). */
  readonly receiptDraftHash: string | null;
}

export class CandidateReferenceMonitor {
  private consumedIds: string[] = [];
  private receiptHead: { count: number; headHash: string | null } = { count: 0, headHash: null };

  constructor(private readonly ownerRoot: AumlokAuthorityRootV2, seed?: { consumedIds?: readonly string[] }) {
    if (seed?.consumedIds) this.consumedIds = [...seed.consumedIds];
  }

  consumed(): readonly string[] {
    return this.consumedIds.slice();
  }

  /**
   * The ONE canonical authorization for a candidate effect. `ownerArmed` maps to `humanClearance` — an unarmed
   * materialization is refused `self_modify_requires_clearance`. Total: a malformed request/state fails closed.
   */
  decide(candidate: BranchCandidate, auth: SignedPromotionV2 | undefined, nowMs: number, opts: { ownerArmed?: boolean } = {}): MonitorDecision {
    const { request, payloadHash } = buildCandidateKernelRequest(candidate, auth, opts.ownerArmed === true);
    const state: TrustedStateV1 = {
      schema: 'aukora-trusted-state-v1',
      salama: { active: false, reason: null },
      trustedRoots: [this.ownerRoot],
      consumedIds: this.consumedIds,
      receiptHead: this.receiptHead,
    };

    try {
      const result = decide(request, state, candidatePolicyBytes(), nowMs);
      if (result.decision.status === 'allowed') {
        this.consumedIds = result.nextState.consumedIds;
        this.receiptHead = result.nextState.receiptHead;
        return { allowed: true, code: result.decision.code, ring: result.decision.ring, authorizedRootId: result.decision.authorizedRootId, payloadHash, receiptDraftHash: result.receiptDraft.draftHash };
      }
      return { allowed: false, code: result.decision.code, ring: result.decision.ring, authorizedRootId: null, payloadHash, receiptDraftHash: result.receiptDraft.draftHash };
    } catch {
      return { allowed: false, code: 'monitor_malformed', ring: 'self-modify', authorizedRootId: null, payloadHash, receiptDraftHash: null };
    }
  }
}

/** HARD: the monitor verifies + decides; it never signs or mints authority. Constant, by construction. */
export function candidateMonitorGrantsAuthority(): false {
  return false;
}
