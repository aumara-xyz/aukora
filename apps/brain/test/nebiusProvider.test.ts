// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * The bounded, PARKED Nebius provider adapter. Proves it is prepared but inert this round: the shipped manifest
 * is valid-and-parked, `complete()` refuses without a launch, and every fence (bindings, ceilings, no embedded
 * creds, no autonomous merge, no authority) is enforced. A MOCK transport (a pure function, never a network
 * call) exercises the ceiling logic — Nebius is not launched.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  NebiusBrainProvider,
  NebiusParkedError,
  NebiusCeilingError,
  validateNebiusManifest,
  nebiusProviderGrantsAuthority,
  type NebiusDeploymentManifest,
  type NebiusTransport,
} from '../src/index.js';

const shippedManifest = (): NebiusDeploymentManifest =>
  JSON.parse(readFileSync(new URL('../../../models/nebius/deployment.manifest.json', import.meta.url), 'utf8'));

const enabledBound = (): NebiusDeploymentManifest => ({
  schema: 'aukora-nebius-deployment-v1',
  imageSha256: 'a'.repeat(64),
  codeSha256: 'b'.repeat(64),
  modelChecksumSha256: 'c'.repeat(64),
  ceilings: { maxOutputTokens: 100, maxWallClockMs: 1000, maxCostUsd: 0.1, maxCallsPerSession: 2 },
  credentials: 'env',
  enabled: true,
  autonomousMerge: false,
  grantsAuthority: false,
});

describe('NebiusBrainProvider — bounded & parked', () => {
  it('the shipped manifest is valid and PARKED (enabled:false, credentials:env, no autonomous merge)', () => {
    const m = shippedManifest();
    expect(validateNebiusManifest(m)).toEqual([]); // parked-with-unbound-digests is valid
    expect(m.enabled).toBe(false);
    expect(m.credentials).toBe('env');
    expect(m.autonomousMerge).toBe(false);
    expect(m.grantsAuthority).toBe(false);
  });

  it('parked manifest ⇒ complete() refuses (no launch, no paid call)', async () => {
    const p = new NebiusBrainProvider(shippedManifest());
    await expect(p.complete('hello')).rejects.toBeInstanceOf(NebiusParkedError);
    expect(p.callsUsed()).toBe(0);
  });

  it('enabled manifest MUST pin real digests; unbound digests are rejected', () => {
    const m = { ...enabledBound(), imageSha256: '' };
    const violations = validateNebiusManifest(m);
    expect(violations).toContain('imageSha256_must_be_bound_when_enabled');
  });

  it('credentials are never embedded — enabled+bound but no creds ⇒ refuses', async () => {
    const p = new NebiusBrainProvider(enabledBound(), () => null, async () => ({ text: 'x', outputTokens: 1, costUsd: 0.01, wallClockMs: 10 }));
    await expect(p.complete('hi')).rejects.toThrow(/nebius_no_credentials/);
  });

  it('with creds + a mock transport within ceilings, returns an ADVISORY completion (Nebius not launched)', async () => {
    const transport: NebiusTransport = async (req) => {
      expect(req.apiKey).toBe('env-injected-key');       // creds arrive via injected source, not embedded
      expect(req.maxOutputTokens).toBe(100);
      return { text: 'ok', outputTokens: 10, costUsd: 0.02, wallClockMs: 50 };
    };
    const p = new NebiusBrainProvider(enabledBound(), () => ({ apiKey: 'env-injected-key' }), transport);
    expect(await p.complete('hi')).toBe('advisory:nebius:ok');
  });

  it('enforces the token, cost, and time ceilings (fail-closed, never truncates silently)', async () => {
    const creds = () => ({ apiKey: 'k' });
    const overTokens = new NebiusBrainProvider(enabledBound(), creds, async () => ({ text: 'x', outputTokens: 999, costUsd: 0.01, wallClockMs: 10 }));
    await expect(overTokens.complete('x')).rejects.toBeInstanceOf(NebiusCeilingError);
    const overCost = new NebiusBrainProvider(enabledBound(), creds, async () => ({ text: 'x', outputTokens: 1, costUsd: 9.99, wallClockMs: 10 }));
    await expect(overCost.complete('x')).rejects.toThrow(/cost_ceiling/);
    const overTime = new NebiusBrainProvider(enabledBound(), creds, async () => ({ text: 'x', outputTokens: 1, costUsd: 0.01, wallClockMs: 999999 }));
    await expect(overTime.complete('x')).rejects.toThrow(/time_ceiling/);
  });

  it('enforces the calls-per-session ceiling', async () => {
    const p = new NebiusBrainProvider(enabledBound(), () => ({ apiKey: 'k' }), async () => ({ text: 'x', outputTokens: 1, costUsd: 0.01, wallClockMs: 10 }));
    await p.complete('1');
    await p.complete('2');
    await expect(p.complete('3')).rejects.toThrow(/calls_ceiling/); // ceiling is 2
  });

  it('generated changes return ONLY as Git branch/PR candidates — never applied, never merged, no authority', () => {
    const p = new NebiusBrainProvider(shippedManifest());
    const cand = p.proposeChange('sam/nebius-candidate', 'title', 'body', 'diff --git ...');
    expect(cand.kind).toBe('git-branch-candidate');
    expect(cand.applied).toBe(false);
    expect(cand.autonomousMerge).toBe(false);
    expect(nebiusProviderGrantsAuthority()).toBe(false);
  });
});
