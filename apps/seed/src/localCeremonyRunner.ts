// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * The composed, owner-invoked local recursion ceremony (R37).
 *
 * ONE flow ties together the durable machine, the real store, the Fu structured adapter, and the LocalCandidateStage:
 *
 *   1. PROPOSE (durable) — a proposal-bound Fu SIDECAR advisory is consumed as `env.review` (real Fu evidence when
 *      a completed outcome is supplied, else the deterministic offline review). Council-hold terminalizes; a pass
 *      persists `awaiting-owner`.
 *   2. OWNER VERIFY (durable complete) — the canonical gate re-verifies EVERYTHING in process against the owner's
 *      hybrid signature. Advisory review never authorizes; the owner does.
 *   3. REHEARSAL LADDER — the accepted apply IS the sandbox rehearsal; its receipt is the ladder rung the candidate
 *      stage requires (per lineage: intent → draft → rehearsal receipt).
 *   4. CANDIDATE STAGE — ONLY on an explicit `materialize:true` invocation AND a FRESH in-process AUMLOK verification
 *      does the passed intent land in a disposable worktree/candidate branch. It never signs, pushes, merges, or
 *      touches main.
 *
 * NO AUTO-RESUME OF AN EFFECT AFTER RESTART: a restarted ceremony re-reads durable state and re-verifies from
 * scratch. It will NEVER materialize a candidate on its own — materialization requires an explicit owner invocation
 * with `materialize:true` and a fresh authorization each time; a durable state alone can never trigger an effect.
 *
 * This runner composes; it never signs. AURA stays display-only (the runner emits geometry/trace but reads nothing
 * back into a decision). Every terminal is receipted with a stable reason class.
 */
import type { ReactiveMemoryStore } from '@aukora/brain';
import type { AumlokAuthorityRootV2, SignedPromotionV2 } from '@aukora/kernel/schemas';
import type { CouncilOutcome } from '@aukora/council';
import { DurableRecursion, deriveWorkflowId, type WorkflowStore, type WorkflowStateV1 } from './durableRecursion.js';
import { runGovernedRecursion, type RecursionEnv } from './recursion.js';
import { AumaIdeEnvelope, type RepoReadCapability, type BranchCandidate } from './ideEnvelope.js';
import { deriveIntentId, deriveDraftHash, type Proposal } from './proposal.js';
import { reviewerFor } from './fuStructuredAdapter.js';
import { materializeCandidate, type CandidateMaterialization } from './localCandidateStage.js';
import { CandidateReferenceMonitor } from './candidateReferenceMonitor.js';
import { DurableCandidateReferenceMonitor, trustedStateDirInsideFence } from './durableCandidateMonitor.js';
import type { CouncilReviewer } from './mockCouncil.js';

export type CeremonyRunPhase =
  | 'proposed-awaiting-owner'
  | 'refused-at-proposal'
  | 'owner-verified-rehearsed'
  | 'refused-at-owner'
  | 'candidate-materialized'
  | 'refused-at-candidate'
  | 'awaiting-explicit-materialize';

export interface CeremonyRunResult {
  readonly ok: boolean;
  readonly phase: CeremonyRunPhase;
  readonly reasonClass: string;
  readonly text: string;
  readonly workflowId: string;
  readonly workflowState: WorkflowStateV1 | null;
  readonly rehearsalReceiptHash: string | null;
  readonly candidate: BranchCandidate | null;
  readonly materialization: CandidateMaterialization | null;
  /** Never signs / pushes / merges / touches main — hard-false literals. */
  readonly signed: false;
  readonly pushed: false;
  readonly touchedMain: false;
  readonly grantsAuthority: false;
}

export interface LocalCeremonyEnv {
  readonly recursionEnv: RecursionEnv;
  readonly workflowStore: WorkflowStore;
  readonly repo: RepoReadCapability;
  readonly ownerRoot: AumlokAuthorityRootV2;
  readonly store: ReactiveMemoryStore;
  /** The canonical kernel reference monitor for the candidate effect (durable consumed-id state). Constructed if absent. */
  readonly monitor?: CandidateReferenceMonitor;
  /**
   * R54: protected trusted-state directory for the DURABLE reference monitor. When set (and no explicit `monitor`
   * is injected), the ceremony consumes authority through `@aukora/kernel-node`'s crash-safe TrustedStateStore —
   * the consumption + PREPARED descriptor are journalled BEFORE any git effect. MUST live outside the repo root
   * and outside the disposable worktree base (it must survive candidate cleanup and process death).
   */
  readonly trustedStateDir?: string;
  /** For candidate materialization (effectful). Omit to keep the ceremony non-materializing. */
  readonly gitRepoRoot?: string;
  readonly worktreeBase?: string;
  readonly nowMs: number;
  readonly nowIso: string;
}

export interface LocalCeremonyInvocation {
  readonly proposalInput: unknown;
  readonly nonce: string;
  readonly auth: SignedPromotionV2;
  /** Proposal-bound Fu sidecar: a COMPLETED advisory outcome for THIS proposal. Omitted ⇒ deterministic offline review. */
  readonly fuOutcome?: CouncilOutcome;
  /** Explicit owner intent to materialize a candidate this invocation. Never inferred from durable state. */
  readonly materialize?: boolean;
  /** The owner's authorization over the HEAD-BOUND candidate payload hash (required to materialize; verified by
   *  the monitor). R54 v6: it MUST be signed over `candidatePayloadHash(candidate, expectedHeadBefore)` — the
   *  head-free `/1` payload no longer authorizes a materialization through this ACTIVE door. */
  readonly candidateAuth?: SignedPromotionV2;
  /** The owner has explicitly ARMED materialization (maps to the kernel's humanClearance). */
  readonly ownerArmed?: boolean;
  /** The exact HEAD this materialization was approved against — REQUIRED to materialize (R54 v6): it is enforced
   *  against the ACTUAL repo head before the durable consume (R50 stale-head), AND it is bound inside the SIGNED
   *  candidate payload, so an approval for base A can never be replayed while claiming a later base B. A missing
   *  value refuses before the durable consume. */
  readonly expectedHeadBefore?: string;
  readonly explanation?: string;
}

function result(over: Partial<CeremonyRunResult> & Pick<CeremonyRunResult, 'ok' | 'phase' | 'reasonClass' | 'text' | 'workflowId'>): CeremonyRunResult {
  return {
    workflowState: null, rehearsalReceiptHash: null, candidate: null, materialization: null,
    signed: false, pushed: false, touchedMain: false, grantsAuthority: false, ...over,
  };
}

/**
 * Run one owner-invoked local recursion ceremony. Idempotent + restart-safe via the durable machine; an EFFECT
 * (candidate materialization) happens only on an explicit `materialize:true` invocation with a fresh authorization.
 */
export function runLocalRecursionCeremony(env: LocalCeremonyEnv, invocation: LocalCeremonyInvocation): CeremonyRunResult {
  const review: CouncilReviewer | undefined = invocation.fuOutcome ? reviewerFor(invocation.fuOutcome) : env.recursionEnv.review;
  const recursionEnv: RecursionEnv = { ...env.recursionEnv, review };
  const machine = new DurableRecursion(env.workflowStore, recursionEnv);

  // 1. PROPOSE — proposal-bound Fu sidecar consumed as advisory evidence.
  const proposed = machine.propose(invocation.proposalInput, invocation.nonce);
  if (!proposed.ok || proposed.state === null) {
    return result({ ok: false, phase: 'refused-at-proposal', reasonClass: proposed.reasonClass, text: proposed.text, workflowId: proposed.state?.workflowId ?? 'n/a', workflowState: proposed.state });
  }
  const workflowId = proposed.state.workflowId;

  // 2. OWNER VERIFY — the canonical gate decides; a durable projection can never authorize.
  const completed = machine.complete(invocation.proposalInput, workflowId, invocation.auth);
  const state = completed.state;
  if (state === null || state.phase !== 'applied') {
    return result({ ok: false, phase: 'refused-at-owner', reasonClass: completed.gate?.stage ?? completed.reasonClass, text: completed.text, workflowId, workflowState: state });
  }
  const rehearsalReceiptHash = state.receiptHash;

  // 3. REHEARSAL LADDER — build the staged candidate from the SAME governed apply (its receipt is the ladder rung).
  const ide = new AumaIdeEnvelope(env.repo);
  const draft = ide.draft(proposalToDraftInput(invocation.proposalInput));
  if (!draft.ok || draft.proposal === null) {
    return result({ ok: true, phase: 'owner-verified-rehearsed', reasonClass: 'workflow:ok', text: 'owner-verified + rehearsed; candidate draft unavailable', workflowId, workflowState: state, rehearsalReceiptHash });
  }

  // 4. CANDIDATE STAGE — ONLY on explicit materialize + fresh AUMLOK verification (never auto-resumed).
  if (invocation.materialize !== true) {
    return result({ ok: true, phase: 'awaiting-explicit-materialize', reasonClass: 'workflow:ok', text: 'owner-verified + rehearsed; awaiting an explicit materialize invocation (no effect without one)', workflowId, workflowState: state, rehearsalReceiptHash });
  }
  if (env.gitRepoRoot === undefined || env.worktreeBase === undefined) {
    return result({ ok: false, phase: 'refused-at-candidate', reasonClass: 'candidate:not-a-repo', text: 'refused: materialize requested but no git repoRoot/worktreeBase configured', workflowId, workflowState: state, rehearsalReceiptHash });
  }
  const proposal = draft.proposal;
  // The durable owner-verify WAS the sandbox rehearsal; its receipt is the ladder rung. Assemble the candidate from
  // that passed rehearsal (never re-run the gate — that would double-apply / re-consume the nonce).
  if (rehearsalReceiptHash === null) {
    return result({ ok: false, phase: 'refused-at-candidate', reasonClass: 'ide:not-rehearsed', text: 'refused: applied workflow carries no rehearsal receipt', workflowId, workflowState: state, rehearsalReceiptHash });
  }
  const depth = env.recursionEnv.ledger.knownIntentDepth(deriveIntentId(proposal));
  const staged = ide.assembleRehearsedCandidate([{ proposal, rehearsalReceiptHash, depth }], invocation.explanation ?? 'owner-invoked local ceremony candidate');
  if (!staged.ok) {
    return result({ ok: false, phase: 'refused-at-candidate', reasonClass: staged.refusal.reasonClass, text: staged.refusal.text, workflowId, workflowState: state, rehearsalReceiptHash });
  }
  // R54: prefer the DURABLE monitor whenever a protected state dir is configured — the consumption is then
  // crash-safe on disk before the stage's first git mutation. An explicit injected monitor still wins (tests).
  // RUNTIME ISOLATION (R54 review repair): the trusted-state dir must sit OUTSIDE the repo working tree and
  // OUTSIDE the disposable worktree base, checked AFTER canonical/symlink resolution — a docstring is not a
  // fence. Inside the repo it could ride a candidate/commit or be swept by git clean; inside the worktree base
  // it would be disposed with a failed candidate — either way consumed authority could be erased or exfiltrated.
  // (The canonicalization itself lives in durableCandidateMonitor — this runner is a RUNTIME module and, per the
  // structural containment law, must not import fs; it composes the verdict, the effect-adjacent module resolves.)
  if (env.monitor === undefined && env.trustedStateDir !== undefined
    && trustedStateDirInsideFence(env.trustedStateDir, [env.gitRepoRoot, env.worktreeBase])) {
    return result({ ok: false, phase: 'refused-at-candidate', reasonClass: 'candidate:trusted-state-inside-repo', text: 'refused: trustedStateDir resolves inside the repo or the disposable worktree base — the durable authority store must live outside both', workflowId, workflowState: state, rehearsalReceiptHash });
  }
  const monitor = env.monitor ?? (env.trustedStateDir !== undefined
    ? new DurableCandidateReferenceMonitor(env.ownerRoot, env.trustedStateDir)
    : new CandidateReferenceMonitor(env.ownerRoot));
  // R54 v6 — the ACTIVE door is MANDATORILY head-bound: the stage verifies the owner's signature over the
  // head-bound payload (`AUKORA-CANDIDATE-PAYLOAD/2` with expectedHeadBefore). A missing expectedHeadBefore
  // refuses inside the stage BEFORE the durable consume (its head-bound precondition), and a head-free or
  // wrong-base signature refuses `authority_invalid` at the ONE consuming decide(). No unbound approval can
  // materialize through this door.
  const materialization = materializeCandidate({
    repoRoot: env.gitRepoRoot,
    worktreeBase: env.worktreeBase,
    candidate: staged.candidate,
    candidateAuth: invocation.candidateAuth, // owner's signature over the HEAD-BOUND candidate payload hash
    monitor,                                  // the ONE canonical kernel reference monitor
    ownerArmed: invocation.ownerArmed === true,
    expectedHeadBefore: invocation.expectedHeadBefore,
    authBindsHead: true,
    store: env.store,
    nowMs: env.nowMs,
    nowIso: env.nowIso,
  });
  if (!materialization.ok) {
    return result({ ok: false, phase: 'refused-at-candidate', reasonClass: materialization.reasonClass, text: materialization.text, workflowId, workflowState: state, rehearsalReceiptHash, candidate: staged.candidate, materialization });
  }
  return result({ ok: true, phase: 'candidate-materialized', reasonClass: 'candidate:ok', text: materialization.text, workflowId, workflowState: state, rehearsalReceiptHash, candidate: staged.candidate, materialization });
}

/** Extract the draft input from an already-validated proposal input (the durable gate validated it). */
function proposalToDraftInput(proposalInput: unknown): { targetPath: string; newContent: string; createdAt: string; supersedes?: string | null; id?: string } {
  const p = proposalInput as Partial<Proposal>;
  return { targetPath: String(p.targetPath ?? ''), newContent: String(p.newContent ?? ''), createdAt: String(p.createdAt ?? ''), supersedes: p.supersedes ?? null, id: p.id };
}

/** Re-derive the workflow id for a proposal + nonce — for a restarted ceremony to locate its durable state. */
export function ceremonyWorkflowId(proposal: Proposal, nonce: string): string {
  return deriveWorkflowId(deriveIntentId(proposal), deriveDraftHash(proposal), nonce);
}

/** HARD: the runner composes; it never signs, pushes, merges, or mints authority. Constant, by construction. */
export function localCeremonyGrantsAuthority(): false {
  return false;
}
