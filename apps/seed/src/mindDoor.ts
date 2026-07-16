// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * The governed Aukora chat/mind door (R38) — loopback 7097.
 *
 * It composes the durable machine, the KIRA memory store, the Fu live runner, the durable ceremony, and the local
 * candidate stage behind ONE governed HTTP surface, porting the donor door's LAW (not its secret/custody material):
 *   - SERIALIZED driver chain: every request runs through a single promise chain, so concurrent requests can never
 *     clobber shared session state mid-await (the donor's single-driver REPL invariant);
 *   - LAZY, HONEST boot: heavy work is loaded through an injected `driver` loader; a compile/import failure fails
 *     THIS request with an honest 500 and keeps the door up (never kills the server at boot);
 *   - strict ORIGIN allowlist + a per-boot local POST TOKEN ([[doorGuards]]) — blind cross-origin POSTs refuse visibly;
 *   - LOCKDOWN short-circuit: once engaged, every write-shaped route becomes advisory-only, decided with no model;
 *   - model-free MEMORY FALLBACK: chat answers from KIRA recall when no advisory voice/Fu is configured or it fails;
 *   - bounded RECEIPTS for refusals and door events.
 *
 * Governance invariants (enforced, tested): no request signs, merges, pushes, mutates main, treats Fu as authority,
 * or auto-resumes an effect. Proposal and materialization are EXPLICIT owner invocations; materialization requires a
 * FRESH in-process AUMLOK verification (never trusts persisted/UI state). A restart emits the PLAN only. The Fu
 * advisory sidecar binds to a proposal by its proposalHash. AURA stays display-only (not surfaced as an apply input).
 *
 * This module is transport-agnostic: `handle(request)` takes a normalized `DoorRequest` and returns a `DoorResponse`,
 * so it is unit-tested with no socket. `scripts/mind-door-7097.ts` adapts Node http to it (not part of CI).
 */
import type { ReactiveMemoryStore } from '@aukora/brain';
import type { AumlokAuthorityRootV2, SignedPromotionV2 } from '@aukora/kernel/schemas';
import type { CouncilOutcome } from '@aukora/council';
import { buildMemoryRecord } from '@aukora/memory';
import { checkDoorGuard, headerReader, loopbackOrigins, newDoorToken, type DoorGuardReason } from './doorGuards.js';
import { validateProposalShape, deriveIntentId } from './proposal.js';
import { runLocalRecursionCeremony, type LocalCeremonyEnv, type CeremonyRunResult } from './localCeremonyRunner.js';
import { verdictFromCouncilOutcome } from './fuStructuredAdapter.js';

export const DOOR_PORT = 7097;
const MAX_RECEIPTS = 512;
const MAX_BODY_FIELD = 8192;

export interface DoorRequest {
  readonly method: string;
  readonly path: string;
  readonly headers: Record<string, string | undefined>;
  readonly body?: unknown;
}

export interface DoorResponse {
  readonly status: number;
  readonly json: Record<string, unknown>;
}

export interface DoorEvent {
  readonly seq: number;
  readonly kind: string;
  readonly path: string;
  readonly reasonClass: string;
  readonly receiptHash: string | null;
}

/** Injected lazy driver: the heavy composition modules. A throwing loader models a compile/import break. */
export interface DoorDriver {
  readonly ceremonyEnv: LocalCeremonyEnv;
}
export type DoorDriverLoader = () => Promise<DoorDriver>;

export interface MindDoorConfig {
  readonly store: ReactiveMemoryStore;
  readonly ownerRoot: AumlokAuthorityRootV2;
  /** Loads the composed ceremony env lazily; may throw — a break fails the request, not the door. */
  readonly loadDriver: DoorDriverLoader;
  readonly port?: number;
  /** Per-boot local POST token; default a fresh CSPRNG token. */
  readonly postToken?: string;
  /** Extra allowed origins (the shell's origin), in addition to the door's own loopback origins. */
  readonly extraOrigins?: readonly string[];
  readonly nowIso?: string;
}

interface ProposeBody {
  readonly proposalInput?: unknown;
  readonly nonce?: string;
  readonly auth?: SignedPromotionV2;
  /** Advisory Fu sidecar, bound to the proposal by proposalHash. */
  readonly fuSidecar?: { readonly proposalHash?: string; readonly outcome?: CouncilOutcome };
  readonly materialize?: boolean;
  /** Owner's authorization over the candidate PAYLOAD hash (required to materialize; verified by the kernel monitor). */
  readonly candidateAuth?: SignedPromotionV2;
  /** Owner explicitly ARMED materialization (kernel humanClearance). */
  readonly ownerArmed?: boolean;
  readonly explanation?: string;
}

export class MindDoor {
  private readonly port: number;
  private readonly postGuard: string;
  private readonly allowedOrigins: string[];
  private readonly receipts: DoorEvent[] = [];
  private driver: DoorDriver | null = null;
  private lockedDown = false;
  private queue: Promise<void> = Promise.resolve();
  private seq = 0;

  constructor(private readonly config: MindDoorConfig) {
    this.port = config.port ?? DOOR_PORT;
    this.postGuard = config.postToken ?? newDoorToken();
    this.allowedOrigins = [...loopbackOrigins(this.port), ...(config.extraOrigins ?? [])];
  }

  /** The per-boot token a local tool must present (never printed to a browser; surfaced only to the operator). */
  get localPostToken(): string {
    return this.postGuard;
  }

  events(): readonly DoorEvent[] {
    return this.receipts.slice();
  }

  isLockedDown(): boolean {
    return this.lockedDown;
  }

  private receipt(kind: string, path: string, reasonClass: string): DoorEvent {
    this.seq += 1;
    const nowIso = this.config.nowIso ?? new Date(0).toISOString();
    const ing = this.config.store.ingest(buildMemoryRecord({
      content: `door-event · seq=${this.seq} · kind=${kind} · path=${path} · reason=${reasonClass}`,
      createdAt: nowIso, kind: 'receipt', consent: 'owner-only', provenance: 'mind-door',
    }));
    const ev: DoorEvent = { seq: this.seq, kind, path, reasonClass, receiptHash: ing.ok ? ing.chainHash : null };
    this.receipts.push(ev);
    if (this.receipts.length > MAX_RECEIPTS) this.receipts.shift();
    return ev;
  }

  /** Handle one request. Serialized: it runs after all prior requests complete (single-driver invariant). */
  handle(request: DoorRequest): Promise<DoorResponse> {
    const run = this.queue.then(() => this.process(request));
    // keep the chain alive regardless of this request's fate; never reject the chain.
    this.queue = run.then(() => undefined, () => undefined);
    return run;
  }

  private async process(request: DoorRequest): Promise<DoorResponse> {
    const h = headerReader(request.headers);
    const path = request.path;

    // Read-only status is always available (even under lockdown) — GET, no token needed.
    if (request.method === 'GET' && path === '/api/door') {
      return this.respond(200, { schema: 'aukora-door-status-v1', enabled: true, lockedDown: this.lockedDown, booted: this.driver !== null, events: this.receipts.length, grantsAuthority: false });
    }

    if (request.method !== 'POST') return this.respond(405, { error: 'method not allowed' });

    // Origin allowlist + local POST token — blind cross-origin POSTs refuse visibly.
    const guard = checkDoorGuard(h, { allowedOrigins: this.allowedOrigins, requiredToken: this.postGuard, allowNoBrowserOrigin: true });
    if (!guard.ok) {
      const ev = this.receipt('refused', path, guard.reason);
      return this.respond(guard.status, { error: guard.text, reasonClass: guard.reason, eventReceipt: ev.receiptHash });
    }

    // LOCKDOWN short-circuit — engage is allowed; every other write becomes advisory-only, decided with no model.
    if (path === '/api/lockdown') {
      this.lockedDown = true;
      const ev = this.receipt('lockdown', path, 'door:lockdown-engaged');
      return this.respond(200, { lockedDown: true, text: 'Lockdown engaged. Proposals and materialization are paused — advisory-only until you lift it in your terminal.', eventReceipt: ev.receiptHash, grantsAuthority: false });
    }
    if (this.lockedDown && (path === '/api/propose' || path === '/api/materialize')) {
      const ev = this.receipt('refused', path, 'door:locked-down');
      return this.respond(423, { error: 'locked down — advisory-only; proposals/materialization are paused', reasonClass: 'door:locked-down', eventReceipt: ev.receiptHash });
    }

    // LAZY, HONEST boot — a compile/import break fails THIS request, not the door.
    let driver: DoorDriver;
    try {
      driver = await this.ensureDriver();
    } catch (e) {
      const ev = this.receipt('boot-error', path, 'door:driver-load-failed');
      return this.respond(500, { error: `driver load failed (server stays up): ${e instanceof Error ? e.message.slice(0, 160) : 'unknown'}`, reasonClass: 'door:driver-load-failed', eventReceipt: ev.receiptHash });
    }

    if (path === '/api/chat') return this.chat(request.body, driver);
    if (path === '/api/propose') return this.proposeOrMaterialize(request.body as ProposeBody, driver, false);
    if (path === '/api/materialize') return this.proposeOrMaterialize(request.body as ProposeBody, driver, true);
    return this.respond(404, { error: 'unknown door route' });
  }

  private async ensureDriver(): Promise<DoorDriver> {
    if (this.driver === null) this.driver = await this.config.loadDriver();
    return this.driver;
  }

  /** ADVISORY voice: never applies. Uses Fu evidence if supplied, else the model-free KIRA memory fallback. */
  private chat(body: unknown, _driver: DoorDriver): DoorResponse {
    const text = typeof (body as { text?: unknown })?.text === 'string' ? (body as { text: string }).text.slice(0, MAX_BODY_FIELD) : '';
    const query = text.trim();
    const hits = query.length > 0 ? this.config.store.recall({ text: query }).slice(0, 5) : [];
    const ev = this.receipt('chat', '/api/chat', 'door:advisory');
    // MODEL-FREE FALLBACK: recall-backed answer; the voice has no tools and no authority.
    const answer = hits.length > 0
      ? `From memory (advisory, no model): ${hits.map((hHit) => hHit.content).join(' · ').slice(0, 1200)}`
      : 'I have no memory matching that yet. (Advisory voice; I cannot read files or apply anything.)';
    return this.respond(200, { schema: 'aukora-door-chat-v1', mode: 'model-free-memory-fallback', answer, citations: hits.map((hHit) => hHit.recordId), advisoryOnly: true, grantsAuthority: false, eventReceipt: ev.receiptHash });
  }

  /**
   * PROPOSE (materialize=false) or MATERIALIZE (materialize=true): an EXPLICIT owner invocation. The composed
   * ceremony re-verifies AUMLOK in process; a restart re-reads durable state and emits the PLAN only (never
   * auto-resumes an effect). The Fu sidecar must bind to THIS proposal by proposalHash.
   */
  private proposeOrMaterialize(body: ProposeBody | undefined, driver: DoorDriver, materialize: boolean): DoorResponse {
    if (body === undefined || body === null) return this.respond(400, { error: 'missing body' });

    const shape = validateProposalShape(body.proposalInput);
    if (!shape.ok) {
      const ev = this.receipt('refused', materialize ? '/api/materialize' : '/api/propose', 'door:proposal-shape');
      return this.respond(400, { error: shape.reason, reasonClass: 'door:proposal-shape', eventReceipt: ev.receiptHash });
    }
    const intentId = deriveIntentId(shape.proposal);

    // Fu sidecar binds by proposalHash — a sidecar for a different proposal is refused.
    let fuOutcome: CouncilOutcome | undefined;
    if (body.fuSidecar) {
      if (body.fuSidecar.proposalHash !== intentId) {
        const ev = this.receipt('refused', materialize ? '/api/materialize' : '/api/propose', 'door:fu-sidecar-mismatch');
        return this.respond(400, { error: 'Fu advisory sidecar does not bind to this proposal (proposalHash mismatch)', reasonClass: 'door:fu-sidecar-mismatch', eventReceipt: ev.receiptHash });
      }
      fuOutcome = body.fuSidecar.outcome;
      // Fu is advisory, never authority: we consume the outcome only as evidence; the owner gate still decides.
      if (fuOutcome && verdictFromCouncilOutcome(fuOutcome).grantsAuthority !== false) {
        const ev = this.receipt('refused', '/api/propose', 'door:fu-authority-claim');
        return this.respond(400, { error: 'Fu can never be authority', reasonClass: 'door:fu-authority-claim', eventReceipt: ev.receiptHash });
      }
    }

    const nonce = typeof body.nonce === 'string' ? body.nonce : '';
    const result: CeremonyRunResult = runLocalRecursionCeremony(driver.ceremonyEnv, {
      proposalInput: body.proposalInput,
      nonce,
      auth: body.auth as SignedPromotionV2,
      fuOutcome,
      materialize, // materialization only on the explicit /api/materialize route
      candidateAuth: body.candidateAuth,
      ownerArmed: body.ownerArmed === true,
      explanation: typeof body.explanation === 'string' ? body.explanation.slice(0, MAX_BODY_FIELD) : undefined,
    });

    const ev = this.receipt(result.ok ? (materialize ? 'materialized' : 'proposed') : 'refused', materialize ? '/api/materialize' : '/api/propose', result.reasonClass);
    return this.respond(result.ok ? 200 : 409, {
      schema: 'aukora-door-plan-v1',
      ok: result.ok,
      phase: result.phase,
      reasonClass: result.reasonClass,
      text: result.text,
      proposalHash: intentId,
      // PLAN fields — never a signature, key, or content dump.
      workflowId: result.workflowId,
      rehearsalReceiptPrefix: result.rehearsalReceiptHash ? result.rehearsalReceiptHash.slice(0, 12) : null,
      candidateBranch: result.materialization?.branch ?? null,
      candidateCommitPrefix: result.materialization?.commitSha ? result.materialization.commitSha.slice(0, 12) : null,
      signed: false, pushed: false, touchedMain: false, grantsAuthority: false,
      eventReceipt: ev.receiptHash,
    });
  }

  private respond(status: number, json: Record<string, unknown>): DoorResponse {
    return { status, json };
  }
}

/** HARD: the door composes governed surfaces; no request through it mints authority. Constant, by construction. */
export function mindDoorGrantsAuthority(): false {
  return false;
}
