// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Hermetic rehearsal (#22 overnight, items 7–9). Pins: a POLICY/BINDING SIMULATION executes nothing; a HERMETIC
 * REHEARSAL runs only APPROVED digest-bound plans (a caller/model names an id — never a command), executes in an
 * injected no-secret/no-network cell OR refuses honestly as `unavailable`, and never fabricates a pass.
 */
import { describe, it, expect } from 'vitest';
import {
  simulatePolicyBinding, runHermeticRehearsal, makeApprovedPlan, ApprovedTestPlans,
  hermeticRehearsalGrantsAuthority,
  type BindingSet, type RehearsalCell, type TestStep, type TestPlan,
} from '../src/index.js';

const HEX64 = 'ab'.repeat(32);
const HEX40 = 'cd'.repeat(20);
const goodBindings: BindingSet = { intentId: HEX64, draftHash: 'ef'.repeat(32), headBefore: HEX40 };

const STEPS: readonly TestStep[] = [
  { kind: 'assert-file-shape', arg: 'apps/seed/src/recursion.ts' },
  { kind: 'typecheck', arg: 'apps/seed' },
  { kind: 'unit', arg: 'recursion.positive' },
];
const PLAN = makeApprovedPlan('seed-smoke-v1', STEPS);
const registry = new ApprovedTestPlans([PLAN]);

const cell = (opts: { fail?: TestStep['kind']; throwOn?: TestStep['kind']; noNetwork?: boolean; noSecrets?: boolean } = {}): RehearsalCell => ({
  noNetwork: (opts.noNetwork ?? true) as true,
  noSecrets: (opts.noSecrets ?? true) as true,
  runStep: (step) => {
    if (opts.throwOn === step.kind) throw new Error('cell exploded');
    return { ok: opts.fail !== step.kind, detail: `${step.kind} ran` };
  },
});

describe('policy/binding simulation — Map-only, executes nothing', () => {
  it('a well-shaped, permitted binding simulates ok WITHOUT executing anything', () => {
    const r = simulatePolicyBinding(goodBindings, new Set([HEX64]));
    expect(r.executed).toBe(false);        // HARD: a simulation is never proof the change works
    expect(r.ok).toBe(true);
    expect(r.reasonClass).toBe('simulation:ok');
    expect(r.grantsAuthority).toBe(false);
  });

  it('malformed bindings and non-permitted intents are refused (still executing nothing)', () => {
    expect(simulatePolicyBinding({ ...goodBindings, headBefore: 'zz' }, new Set([HEX64])).reasonClass).toBe('simulation:binding-malformed');
    expect(simulatePolicyBinding(goodBindings, new Set()).reasonClass).toBe('simulation:intent-not-permitted');
    expect(simulatePolicyBinding(goodBindings, new Set()).executed).toBe(false);
  });
});

describe('hermetic rehearsal — approved plans only; a caller names an id, never a command (item 9)', () => {
  it('an unknown plan id is refused — the caller cannot supply plan content', () => {
    const out = runHermeticRehearsal('evil; rm -rf /', registry, cell());
    expect(out.status).toBe('refused');
    expect(out.reasonClass).toBe('rehearsal:unknown-plan');
  });

  it('a tampered plan (digest ≠ steps) is refused, never run', () => {
    const tampered: TestPlan = { ...PLAN, steps: [...STEPS, { kind: 'unit', arg: 'smuggled-extra' }] }; // steps changed, digest stale
    const out = runHermeticRehearsal('seed-smoke-v1', new ApprovedTestPlans([tampered]), cell());
    expect(out.status).toBe('refused');
    expect(out.reasonClass).toBe('rehearsal:plan-tampered');
  });
});

describe('hermetic rehearsal — honest unavailability, never a fabricated pass (item 8)', () => {
  it('with NO cell armed, the answer is `unavailable` — not a pass', () => {
    const out = runHermeticRehearsal('seed-smoke-v1', registry);
    expect(out.status).toBe('unavailable');
    expect(out.reasonClass).toBe('rehearsal:no-cell-armed');
    expect(out.steps).toEqual([]);
  });

  it('a cell that admits network or secret access is refused (not hermetic)', () => {
    expect(runHermeticRehearsal('seed-smoke-v1', registry, cell({ noNetwork: false })).reasonClass).toBe('rehearsal:cell-not-hermetic');
    expect(runHermeticRehearsal('seed-smoke-v1', registry, cell({ noSecrets: false })).reasonClass).toBe('rehearsal:cell-not-hermetic');
  });
});

describe('hermetic rehearsal — execution results are honest and content-free', () => {
  it('an armed hermetic cell runs the fixed plan and passes only when every step passes', () => {
    const out = runHermeticRehearsal('seed-smoke-v1', registry, cell());
    expect(out.status).toBe('passed');
    expect(out.steps.map((s) => s.kind)).toEqual(['assert-file-shape', 'typecheck', 'unit']);
    expect(out.steps.every((s) => s.ok)).toBe(true);
  });

  it('a failing step fails the rehearsal fail-fast (never a partial pass)', () => {
    const out = runHermeticRehearsal('seed-smoke-v1', registry, cell({ fail: 'typecheck' }));
    expect(out.status).toBe('failed');
    expect(out.reasonClass).toBe('rehearsal:step-failed');
    expect(out.steps.map((s) => s.ok)).toEqual([true, false]); // stopped at the failing typecheck; unit never reached
  });

  it('a throwing cell step is a failure, never a pass; nothing but kind+ok is surfaced', () => {
    const out = runHermeticRehearsal('seed-smoke-v1', registry, cell({ throwOn: 'assert-file-shape' }));
    expect(out.status).toBe('failed');
    expect(Object.keys(out.steps[0])).toEqual(['kind', 'ok']); // content-free: no step output/detail leaks
    expect(hermeticRehearsalGrantsAuthority()).toBe(false);
  });
});
