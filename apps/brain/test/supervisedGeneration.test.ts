// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Supervised-generation envelope: hard generation/token/cost/patch ceilings, sandbox-only effect, advisory
 * output, PR-candidate-only egress, and no authority.
 */
import { describe, it, expect } from 'vitest';
import {
  SupervisedGenerationEnvelope,
  offlineGenerator,
  supervisedGenerationGrantsAuthority,
  DeterministicOfflineProvider,
  type SupervisedGenerator,
} from '../src/index.js';

const limits = { maxGenerations: 2, maxWallClockMs: 5000, maxOutputTokens: 100, maxCostMicroUsd: 100000, maxPatchBytes: 32 };
const offlineEnv = (l = limits) => new SupervisedGenerationEnvelope(offlineGenerator(new DeterministicOfflineProvider()), l);

describe('SupervisedGenerationEnvelope', () => {
  it('offline: advisory output, sandbox-only PR-candidate egress, no authority', async () => {
    const res = await offlineEnv().run({ prompt: 'hello', proposedPatch: { targetPath: 'a.ts', diff: 'small' } });
    expect(res.ok).toBe(true);
    expect(res.advisory?.startsWith('advisory:')).toBe(true);   // advisory output
    expect(res.candidate?.applied).toBe(false);                 // PR-candidate-only
    expect(res.candidate?.autonomousMerge).toBe(false);
    expect(res.sandbox.get('a.ts')).toBe('small');              // sandbox-only effect (in-memory, not disk)
    expect(res.grantsAuthority).toBe(false);
    expect(supervisedGenerationGrantsAuthority()).toBe(false);
  });

  it('enforces the patch byte ceiling', async () => {
    const res = await offlineEnv().run({ prompt: 'x', proposedPatch: { targetPath: 'a.ts', diff: 'x'.repeat(64) } });
    expect(res.ok).toBe(false);
    expect(res.refusals[0]).toContain('patch');
  });

  it('enforces the token and cost ceilings from injected usage', async () => {
    const overTokens: SupervisedGenerator = async () => ({ text: 'advisory:x', outputTokens: 999, costMicroUsd: 0 });
    const r1 = await new SupervisedGenerationEnvelope(overTokens, limits).run({ prompt: 'x' });
    expect(r1.ok).toBe(false);
    expect(r1.refusals[0]).toContain('token');
    const overCost: SupervisedGenerator = async () => ({ text: 'advisory:x', outputTokens: 1, costMicroUsd: 999999 });
    const r2 = await new SupervisedGenerationEnvelope(overCost, limits).run({ prompt: 'x' });
    expect(r2.ok).toBe(false);
    expect(r2.refusals[0]).toContain('cost');
  });

  it('enforces the generation-count ceiling', async () => {
    const env = offlineEnv({ ...limits, maxGenerations: 1 });
    expect((await env.run({ prompt: '1' })).ok).toBe(true);
    const second = await env.run({ prompt: '2' });
    expect(second.ok).toBe(false);
    expect(second.refusals[0]).toContain('generation');
  });
});
