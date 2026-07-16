// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * NebiusBrainProvider — a BOUNDED, PARKED, provider-neutral adapter for a Nebius-hosted brain.
 *
 * It is prepared, not launched. Every dangerous capability is fenced structurally:
 *   - Exact BINDINGS: an image SHA, a code SHA, and a model-checksum SHA are pinned in the deployment manifest.
 *     Going live REQUIRES all three to be real 64-hex digests — an unbound (empty) digest may only ship PARKED.
 *   - Hard CEILINGS: max output tokens, max wall-clock ms, max cost USD, max calls/session — checked before and
 *     after any generation; a breach refuses (throws), never truncates silently.
 *   - NO embedded credentials: the API key is fetched from an injected `credentials()` source at call time
 *     (env-backed by the manifest's `credentials: "env"`); no secret is ever stored in this module.
 *   - NO live authority, NO autonomous merge: generated changes return ONLY as Git branch / PR *candidates*
 *     (`GitChangeCandidate`, `applied:false`, `autonomousMerge:false`). Nothing here mutates a repo or merges.
 *   - INERT this round: `enabled:false` in the manifest and no injected transport ⇒ `complete()` refuses. The
 *     network client is a dependency (`NebiusTransport`) supplied by a future round; this module performs no I/O.
 */
import type { BrainProvider } from './brainProvider.js';

export interface NebiusCeilings {
  readonly maxOutputTokens: number;
  readonly maxWallClockMs: number;
  readonly maxCostUsd: number;
  readonly maxCallsPerSession: number;
}

export interface NebiusDeploymentManifest {
  readonly schema: 'aukora-nebius-deployment-v1';
  /** Exact container image digest (sha256, 64 hex). '' = unbound (only allowed while PARKED). */
  readonly imageSha256: string;
  /** Exact code / commit digest binding (sha256, 64 hex). '' = unbound (only allowed while PARKED). */
  readonly codeSha256: string;
  /** Exact model checksum binding (sha256, 64 hex). '' = unbound (only allowed while PARKED). */
  readonly modelChecksumSha256: string;
  readonly ceilings: NebiusCeilings;
  /** Credentials are env-sourced at call time, never embedded. */
  readonly credentials: 'env';
  /** Live generation gate. `false` = PARKED (this round). */
  readonly enabled: boolean;
  /** Structurally false — this adapter never merges anything. */
  readonly autonomousMerge: false;
  /** Structurally false — a provider grants no authority. */
  readonly grantsAuthority: false;
}

export interface NebiusCredentials {
  readonly apiKey: string;
}

export interface NebiusRequest {
  readonly prompt: string;
  readonly maxOutputTokens: number;
  readonly apiKey: string;
  readonly imageSha256: string;
  readonly modelChecksumSha256: string;
}

export interface NebiusResponse {
  readonly text: string;
  readonly outputTokens: number;
  readonly costUsd: number;
  readonly wallClockMs: number;
}

/** The network client is a DEPENDENCY, injected only when a round deliberately goes live. Absent ⇒ inert. */
export type NebiusTransport = (req: NebiusRequest) => Promise<NebiusResponse>;

const HEX64 = /^[0-9a-f]{64}$/;
const isPosFinite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

/**
 * Validate a manifest. Returns a list of violations (empty = valid). A PARKED manifest (`enabled:false`) may
 * carry unbound ('') digests; an ENABLED manifest MUST pin all three real 64-hex digests. `autonomousMerge` and
 * `grantsAuthority` must be structurally false; `credentials` must be `env`.
 */
export function validateNebiusManifest(m: unknown): string[] {
  const v: string[] = [];
  if (m === null || typeof m !== 'object') return ['manifest_not_object'];
  const o = m as Record<string, unknown>;
  if (o.schema !== 'aukora-nebius-deployment-v1') v.push('schema_invalid');
  if (o.credentials !== 'env') v.push('credentials_must_be_env_never_embedded');
  if (o.autonomousMerge !== false) v.push('autonomous_merge_must_be_false');
  if (o.grantsAuthority !== false) v.push('grants_authority_must_be_false');
  if (typeof o.enabled !== 'boolean') v.push('enabled_must_be_boolean');
  const c = o.ceilings as Record<string, unknown> | undefined;
  if (!c || typeof c !== 'object') v.push('ceilings_missing');
  else {
    if (!isPosFinite(c.maxOutputTokens)) v.push('ceiling_maxOutputTokens_invalid');
    if (!isPosFinite(c.maxWallClockMs)) v.push('ceiling_maxWallClockMs_invalid');
    if (!isPosFinite(c.maxCostUsd)) v.push('ceiling_maxCostUsd_invalid');
    if (!isPosFinite(c.maxCallsPerSession)) v.push('ceiling_maxCallsPerSession_invalid');
  }
  const digests: [string, unknown][] = [['imageSha256', o.imageSha256], ['codeSha256', o.codeSha256], ['modelChecksumSha256', o.modelChecksumSha256]];
  for (const [name, d] of digests) {
    if (typeof d !== 'string') { v.push(`${name}_invalid`); continue; }
    if (o.enabled === true && !HEX64.test(d)) v.push(`${name}_must_be_bound_when_enabled`);
    if (o.enabled !== true && d !== '' && !HEX64.test(d)) v.push(`${name}_invalid`);
  }
  return v;
}

export class NebiusParkedError extends Error {}
export class NebiusCeilingError extends Error {}

export interface GitChangeCandidate {
  readonly kind: 'git-branch-candidate';
  readonly branch: string;
  readonly title: string;
  readonly body: string;
  readonly diff: string;
  /** Structurally false — a candidate is never applied by this adapter. */
  readonly applied: false;
  /** Structurally false — never auto-merged. */
  readonly autonomousMerge: false;
}

/**
 * The bounded, parked Nebius provider. `credentials` and `transport` are injected — the module holds neither a
 * secret nor a network client. With the shipped PARKED manifest (enabled:false, no transport) `complete()`
 * refuses, so this round performs no paid call and no cloud mutation.
 */
export class NebiusBrainProvider implements BrainProvider {
  readonly id: string;
  private calls = 0;

  constructor(
    private readonly manifest: NebiusDeploymentManifest,
    private readonly credentials: () => NebiusCredentials | null = () => null,
    private readonly transport?: NebiusTransport,
  ) {
    this.id = `nebius:${manifest.modelChecksumSha256 ? manifest.modelChecksumSha256.slice(0, 12) : 'unbound'}`;
  }

  async complete(prompt: string): Promise<string> {
    const violations = validateNebiusManifest(this.manifest);
    if (violations.length > 0) throw new NebiusParkedError(`nebius_manifest_invalid: ${violations.join(',')}`);
    if (!this.manifest.enabled) throw new NebiusParkedError('nebius_parked: live generation disabled (enabled:false) this round');
    if (!this.transport) throw new NebiusParkedError('nebius_no_transport: no network client injected; adapter is inert');
    const creds = this.credentials();
    if (creds === null || typeof creds.apiKey !== 'string' || creds.apiKey.length === 0) {
      throw new NebiusParkedError('nebius_no_credentials: env-injected credentials absent; refusing (never embedded)');
    }
    if (this.calls >= this.manifest.ceilings.maxCallsPerSession) {
      throw new NebiusCeilingError('nebius_calls_ceiling: max calls/session reached');
    }
    this.calls += 1;
    const started = Date.now();
    const res = await this.transport({
      prompt,
      maxOutputTokens: this.manifest.ceilings.maxOutputTokens,
      apiKey: creds.apiKey,
      imageSha256: this.manifest.imageSha256,
      modelChecksumSha256: this.manifest.modelChecksumSha256,
    });
    const elapsed = Date.now() - started;
    if (res.outputTokens > this.manifest.ceilings.maxOutputTokens) throw new NebiusCeilingError('nebius_token_ceiling: output exceeded ceiling');
    if (res.costUsd > this.manifest.ceilings.maxCostUsd) throw new NebiusCeilingError('nebius_cost_ceiling: cost exceeded ceiling');
    if (elapsed > this.manifest.ceilings.maxWallClockMs || res.wallClockMs > this.manifest.ceilings.maxWallClockMs) {
      throw new NebiusCeilingError('nebius_time_ceiling: wall clock exceeded ceiling');
    }
    // Output is ADVISORY only — never authority.
    return `advisory:nebius:${res.text}`;
  }

  /**
   * A generated change is returned ONLY as a Git branch / PR candidate — never applied, never merged. The caller
   * decides; this adapter has no authority to write a repo.
   */
  proposeChange(branch: string, title: string, body: string, diff: string): GitChangeCandidate {
    return { kind: 'git-branch-candidate', branch, title, body, diff, applied: false, autonomousMerge: false };
  }

  callsUsed(): number {
    return this.calls;
  }
}

/** A provider grants no authority. Constant. */
export function nebiusProviderGrantsAuthority(): false {
  return false;
}
