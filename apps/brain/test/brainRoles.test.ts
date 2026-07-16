// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * 32B verification gate + brain-role assignment (R33): the 32B becomes remote primary voice/routing ONLY when
 * license + checksum + code/image digests + runnable manifest + eval evidence are ALL present; otherwise
 * UNVERIFIED_OR_PARKED and roles fail closed to deterministic-offline. No launch, no paid inference, no authority.
 */
import { describe, it, expect } from 'vitest';
import { verify32bClaim, assignBrainRoles, brainRolesGrantAuthority } from '../src/index.js';

const FULL = {
  license: 'Apache-2.0',
  modelChecksumSha256: 'a'.repeat(64),
  codeSha256: 'b'.repeat(64),
  imageDigestSha256: 'c'.repeat(64),
  runnableManifestSha256: 'd'.repeat(64),
  evalEvidenceSha256: 'e'.repeat(64),
};

describe('verify32bClaim + assignBrainRoles', () => {
  it('this round (no credentials, no reachable evidence): UNVERIFIED_OR_PARKED with every element missing', () => {
    const v = verify32bClaim({});
    expect(v.truth).toBe('UNVERIFIED_OR_PARKED');
    expect(v.missing).toEqual(['license', 'model_checksum', 'code_digest', 'image_digest', 'runnable_manifest', 'eval_evidence']);
    expect(v.launched).toBe(false);
    expect(v.paidInference).toBe(false);
  });

  it('any single missing element keeps it parked (all five+eval are required)', () => {
    const { evalEvidenceSha256: _e, ...noEval } = FULL;
    expect(verify32bClaim(noEval).truth).toBe('UNVERIFIED_OR_PARKED');
    expect(verify32bClaim(noEval).missing).toEqual(['eval_evidence']);
    expect(verify32bClaim({ ...FULL, modelChecksumSha256: 'nothex' }).missing).toContain('model_checksum');
  });

  it('full evidence verifies; roles: verified 32B = remote primary voice/routing, vision fallback optional', () => {
    const v = verify32bClaim(FULL);
    expect(v.truth).toBe('AVAILABLE_PRIVATE');
    const roles = assignBrainRoles(v, true);
    expect(roles.primary).toBe('remote-primary-voice-routing');
    expect(roles.fallbacks).toEqual(['local-vision-fallback', 'deterministic-offline']);
    expect(roles.grantsAuthority).toBe(false);
    expect(brainRolesGrantAuthority()).toBe(false);
  });

  it('unverified 32B fails closed to deterministic-offline (vision fallback still optional)', () => {
    const roles = assignBrainRoles(verify32bClaim({}), false);
    expect(roles.primary).toBe('deterministic-offline');
    expect(roles.fallbacks).toEqual(['deterministic-offline']);
    expect(roles.reason).toContain('fail-closed');
  });
});
