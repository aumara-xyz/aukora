// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Digital-metabolism simulator (RESEARCH_ONLY): integer fixed-point, deterministic, contract-only ceiling,
 * untrusted sensors advisory-only, out-of-order refused, no authority.
 */
import { describe, it, expect } from 'vitest';
import {
  initialMetabolismState,
  stepMetabolism,
  runMetabolism,
  validateSample,
  metabolismGrantsAuthority,
  BUDGET_BASE,
  type MetabolismSampleV1,
} from '../src/index.js';

const sample = (p: Partial<MetabolismSampleV1> & { value: number; timestampMs: number }): MetabolismSampleV1 => ({
  schema: 'aukora-metabolism-sample-v1',
  sensorId: p.sensorId ?? 's1',
  dimension: p.dimension ?? 'energy',
  unitScale: p.unitScale ?? 1,
  value: p.value,
  timestampMs: p.timestampMs,
  trusted: p.trusted ?? true,
});

describe('metabolismSimulator', () => {
  it('rejects non-integer / floating inputs (no floats in a hash)', () => {
    expect(validateSample(sample({ value: 1.5, timestampMs: 1 }))).toContain('value_not_nonnegative_integer');
    expect(validateSample(sample({ value: 1, timestampMs: 1, unitScale: 0 }))).toContain('unitScale_not_positive_integer');
  });

  it('a trusted sample can only CONTRACT the ceiling (monotone ratchet down)', () => {
    let s = initialMetabolismState(BUDGET_BASE);
    // pressure = value*BASE/unitScale = 500000 → contracts
    s = stepMetabolism(s, sample({ value: 500_000, unitScale: 1_000_000, timestampMs: 1 })).state;
    expect(s.budgetCeiling).toBe(500_000);
    // a HIGHER pressure cannot raise the ceiling
    const r = stepMetabolism(s, sample({ value: 999_999, unitScale: 1_000_000, timestampMs: 2 }));
    expect(r.applied).toBe(true);
    expect(r.state.budgetCeiling).toBe(500_000); // never rises
    expect(r.state.stateHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('untrusted sensors are advisory-only — they never contract the ceiling', () => {
    let s = initialMetabolismState(BUDGET_BASE);
    const r = stepMetabolism(s, sample({ value: 0, unitScale: 1, timestampMs: 1, trusted: false }));
    expect(r.applied).toBe(false);
    expect(r.reason).toContain('untrusted');
    expect(r.state.budgetCeiling).toBe(BUDGET_BASE); // unchanged
  });

  it('refuses out-of-order timestamps (no ambient clock)', () => {
    let s = initialMetabolismState(BUDGET_BASE);
    s = stepMetabolism(s, sample({ value: 100, unitScale: 1, timestampMs: 10 })).state;
    const r = stepMetabolism(s, sample({ value: 100, unitScale: 1, timestampMs: 5 }));
    expect(r.applied).toBe(false);
    expect(r.reason).toContain('out-of-order');
  });

  it('is deterministic and grants no authority', () => {
    const samples = [sample({ value: 800_000, unitScale: 1_000_000, timestampMs: 1 }), sample({ value: 300_000, unitScale: 1_000_000, timestampMs: 2 })];
    const a = runMetabolism(BUDGET_BASE, samples);
    const b = runMetabolism(BUDGET_BASE, samples);
    expect(a).toEqual(b);
    expect(a.budgetCeiling).toBe(300_000); // ratcheted down to the tighter pressure
    expect(a.grantsAuthority).toBe(false);
    expect(metabolismGrantsAuthority()).toBe(false);
  });
});
