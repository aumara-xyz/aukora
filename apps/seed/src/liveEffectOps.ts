// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Live EffectOps adapter (R54) — the ONE concrete wiring that moves the effect-lifecycle coordinator from
 * FOUNDATION-ONLY to PRIMARY-WIRED, by delegating a real candidate materialization to the existing hardened
 * `localCandidateStage` THROUGH `driveEffect`.
 *
 * It adds NO new state machine, store, or protocol. It composes what already exists on main:
 *   - PREPARED (durable) authority   ← Sam 2's `DurableCandidateReferenceMonitor` (the sole durable PREPARED
 *                                       authority store; consumption + content-free PREPARED descriptor are
 *                                       journalled through `@aukora/kernel-node`'s crash-safe store BEFORE any git);
 *   - the ONE effect (isolated git)  ← `localCandidateStage.materializeCandidate` (hardened trusted-git cell);
 *   - isolation before/after         ← `refSnapshot` (protected refs + tree);
 *   - projection-only settlement     ← `effectSettlement.validateSettlement` (never authority; a projection
 *                                       failure returns unsettled → reconcile, and can NEVER describe the effect
 *                                       as absent — the durable consume is the source of truth);
 *   - content-free audit             ← `effectAudit.EffectAuditLedger`.
 *
 * Crash-safety comes for free from the composition: the durable monitor consumes-once, so `runGitEffect` can never
 * double-run git — a restarted process's `materializeCandidate` REPLAY-refuses, and this adapter then OBSERVES the
 * existing candidate branch instead of re-executing. `driveEffect` turns that observation into COMMITTED (present +
 * durable completion), RECONCILE_REQUIRED (present + ambiguous completion), or QUARANTINED (absent / isolation
 * violated). Grants no authority; the ONE authority remains the kernel `decide()` inside the durable monitor.
 */
import { execFileSync } from 'node:child_process';
import type { ReactiveMemoryStore } from '@aukora/brain';
import type { SignedPromotionV2, AumlokAuthorityRootV2 } from '@aukora/kernel/schemas';
import { driveEffect, type EffectOps, type EffectRunResult, type EffectRunPhase } from './effectCoordinator.js';
import { DurableCandidateReferenceMonitor } from './durableCandidateMonitor.js';
import { CandidateReferenceMonitor } from './candidateReferenceMonitor.js';
import { materializeCandidate, candidateBranchName } from './localCandidateStage.js';
import { snapshotProtected, verifyIsolation, type RefReader, type ProtectedSnapshot } from './refSnapshot.js';
import { EffectAuditLedger } from './effectAudit.js';
import { validateSettlement } from './effectSettlement.js';
import type { BranchCandidate } from './ideEnvelope.js';

/** The protected refs an isolated candidate must never move. */
const PROTECTED_REFS = ['HEAD', 'refs/heads/main'] as const;

/** Observation-only git reader (rev-parse) over the repo root — never mutates, never runs the effect. */
function gitRefReader(repoRoot: string): RefReader {
  const rev = (ref: string): string | null => {
    try {
      const out = execFileSync('git', ['-C', repoRoot, 'rev-parse', '--verify', '--quiet', ref], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      return out.length > 0 ? out : null;
    } catch { return null; }
  };
  return {
    readRef: (name) => rev(name),
    readTreeHash: () => rev('HEAD^{tree}') ?? 'no-head',
  };
}

/** Does the candidate branch already exist in the repo? (post-crash reality check — reads, never writes.) */
function candidateBranchExists(repoRoot: string, branch: string): boolean {
  return gitRefReader(repoRoot).readRef(`refs/heads/${branch}`) !== null;
}

export interface LiveEffectInput {
  readonly repoRoot: string;
  readonly worktreeBase: string;
  /** The passed-rehearsal, staged candidate (its files already carry rehearsal receipts). */
  readonly candidate: BranchCandidate;
  /** The owner's hybrid authorization over the candidate payload hash (verified by the durable monitor). */
  readonly candidateAuth: SignedPromotionV2 | undefined;
  /** The owner has explicitly ARMED materialization (kernel humanClearance). */
  readonly ownerArmed: boolean;
  /** The trusted owner root — used ONLY for the non-consuming pre-authorization verdict at the owner gate. */
  readonly ownerRoot: AumlokAuthorityRootV2;
  /** Sam 2's durable reference monitor over a protected trusted-state dir (the SOLE durable PREPARED store). */
  readonly monitor: DurableCandidateReferenceMonitor;
  readonly store: ReactiveMemoryStore;
  /** Optional projection sink; returns false to simulate a projection outage (→ reconcile, never "absent"). */
  readonly project?: (settlement: unknown) => boolean;
  readonly nowMs: number;
  readonly nowIso: string;
}

/** The two NON-RETRYABLE durable-store faults (Sam 2 advisory): surfaced for operator triage, distinct from a
 *  retryable lock/outage. A corrupt or rolled-back trusted-state store needs attention, not a blind retry. */
const NON_RETRYABLE_STORE_FAULT = /\((trusted_state_(?:rollback|corrupt))\)/;

/** Mutable sink the run entry reads back after `driveEffect` — surfaces a non-retryable store fault for triage. */
export interface LiveEffectSink {
  storeFault: string | null;
}

/** Build the concrete `EffectOps` for one live candidate effect. Pure composition over the merged primitives. */
export function liveEffectOps(input: LiveEffectInput, audit: EffectAuditLedger, sink: LiveEffectSink = { storeFault: null }): EffectOps {
  const { repoRoot, worktreeBase, candidate, candidateAuth, ownerArmed, monitor, store, nowMs, nowIso } = input;
  const branch = candidateBranchName(candidate);
  const reader = gitRefReader(repoRoot);
  let completionRef: string | null = null; // the durable completion receipt from the ONE materialization

  return {
    // The staged candidate already passed rehearsal upstream (its files carry rehearsal receipts).
    rehearse: () => ({ proceed: candidate.files.length > 0 && candidate.files.every((f) => typeof f.receiptHash === 'string'), status: 'passed' }),
    // OWNER GATE = the kernel authorization verdict, NON-CONSUMING (a fresh base monitor with empty consumed state
    // runs the SAME `decide()` logic and its in-memory consume is discarded). A forged/absent/unarmed authorization
    // refuses HERE — before EXECUTING/audit/Git. The ONE DURABLE PREPARED transition (the authoritative consume)
    // remains solely Sam 2's durable monitor inside `runGitEffect` (no second store, no second durable authority).
    // A replayed (already-durably-consumed) but valid authorization still verifies allowed here and flows on to be
    // reconciled by observing reality in `runGitEffect` — the owner gate rejects forgery, not replay.
    ownerAuthorize: () => ({ authorized: new CandidateReferenceMonitor(input.ownerRoot).decide(candidate, candidateAuth, nowMs, { ownerArmed }).allowed }),
    // Identity only; the DURABLE PREPARED consume is journalled inside runGitEffect BEFORE any git (Sam 2's monitor).
    prepare: () => ({ effectId: candidate.candidateId, candidateBranch: branch }),
    snapshotBefore: () => snapshotProtected(reader, PROTECTED_REFS, nowIso),
    runGitEffect: (_effectId) => {
      // The ONE effect. The durable monitor consumes-once BEFORE git; a replay (post-crash restart) refuses here,
      // so git never double-runs — we then OBSERVE the existing candidate rather than re-executing.
      const m = materializeCandidate({ repoRoot, worktreeBase, candidate, candidateAuth, monitor, ownerArmed, store, nowMs, nowIso });
      completionRef = m.ok ? m.receiptHash : null;
      // Advisory (Sam 2): surface a NON-RETRYABLE durable-store fault (rollback/corrupt) for operator triage — a
      // retryable lock/outage is NOT surfaced. The effect still quarantines/reconciles; this only names the fault.
      if (!m.ok && m.reasonClass === 'candidate:reference-monitor-refused') {
        sink.storeFault = NON_RETRYABLE_STORE_FAULT.exec(m.text)?.[1] ?? sink.storeFault;
      }
      // OBSERVE REALITY (not just m.ok): a replay-refused attempt whose branch already exists is present-but-ambiguous.
      const candidatePresent = m.ok ? (m.branch !== null) : candidateBranchExists(repoRoot, branch);
      return { candidatePresent, completionRef, snapshotAfter: snapshotProtected(reader, PROTECTED_REFS, nowIso) };
    },
    verifyIsolation: (before, after) => ({ intact: verifyIsolation(before as ProtectedSnapshot, after as ProtectedSnapshot).ok }),
    // Projection-ONLY: validate the terminal projection; a projection sink outage → unsettled (reconcile), never absent.
    settle: (projection) => {
      const settlement = {
        schema: 'aukora-effect-settlement-v1' as const,
        effectId: projection.effectId, phase: settleablePhase(projection.phase),
        candidateBranch: branch, completionRef: projection.completionRef,
        updatedAtIso: nowIso, advisoryOnly: true as const, grantsAuthority: false as const,
      };
      if (!validateSettlement(settlement).ok) return { ok: false };
      const projected = input.project ? input.project(settlement) : true;
      return { ok: projected };
    },
    audit: (effectId, toPhase, hasCompletionRef) => ({ ok: audit.append({ effectId: effectId ?? candidate.candidateId, fromPhase: null, toPhase, hasCompletionRef, at: nowIso }).ok }),
  };
}

/** Map a coordinator run-phase to the settleable subset (COMMITTED settles; the coordinator never settles a
 *  non-terminal or EXECUTING phase). */
function settleablePhase(phase: EffectRunPhase): 'COMMITTED' | 'QUARANTINED' | 'RECONCILE_REQUIRED' | 'REFUSED' {
  return phase === 'COMMITTED' ? 'COMMITTED' : phase === 'QUARANTINED' ? 'QUARANTINED' : phase === 'RECONCILE_REQUIRED' ? 'RECONCILE_REQUIRED' : 'REFUSED';
}

export interface LiveEffectResult extends EffectRunResult {
  /** The content-free audit trail of the run (phase labels only). */
  readonly auditTrail: ReadonlyArray<{ readonly toPhase: string; readonly hasCompletionRef: boolean }>;
  /** A NON-RETRYABLE durable-store fault (`trusted_state_rollback`/`trusted_state_corrupt`) if one occurred —
   *  for operator triage. `null` when the store was healthy (a retryable lock/outage is not reported here). */
  readonly storeFault: string | null;
}

/**
 * Run ONE live candidate effect through the lifecycle coordinator. This is the PRIMARY-WIRED entry: it drives the
 * real durable monitor + hardened candidate stage through `driveEffect`. Returns the coordinator verdict plus the
 * audit trail. No authority minted here; the durable monitor holds the ONE authorization.
 */
export function runLiveCandidateEffect(input: LiveEffectInput): LiveEffectResult {
  const audit = new EffectAuditLedger();
  const sink: LiveEffectSink = { storeFault: null };
  const result = driveEffect(liveEffectOps(input, audit, sink));
  return { ...result, auditTrail: audit.log().map((e) => ({ toPhase: e.toPhase, hasCompletionRef: e.hasCompletionRef })), storeFault: sink.storeFault };
}

/** HARD: the adapter composes existing governed pieces; it signs nothing, pushes nothing, mints no authority. */
export function liveEffectOpsGrantsAuthority(): false {
  return false;
}
