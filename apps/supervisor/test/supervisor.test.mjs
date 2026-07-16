// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * WAVE 2 supervisor laws (donor #71/#26 restoration) — every law tested on the PURE engine, no sockets.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { planUp, planDown, planSwap, planContract, deriveStatus, classifyService, ENVELOPE, FORBIDDEN } from '../src/engine.mjs';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const policy = JSON.parse(readFileSync(join(APP, 'policy.json'), 'utf8'));

const DOWN = { portOpen: false, identityOk: null };
const OURS = { portOpen: true, identityOk: true };
const FOREIGN = { portOpen: true, identityOk: false };
const allDown = Object.fromEntries(policy.services.map((s) => [s.name, DOWN]));
const allUp = Object.fromEntries(policy.services.map((s) => [s.name, OURS]));

describe('closed envelope', () => {
  it('the envelope is exactly the pre-authorized action set; the forbidden verbs are not expressible', () => {
    expect([...ENVELOPE].sort()).toEqual([...policy.envelope.actions].sort());
    for (const verb of FORBIDDEN) expect(ENVELOPE).not.toContain(verb);
    expect(FORBIDDEN).toContain('sign');
    expect(FORBIDDEN).toContain('promote');
    expect(FORBIDDEN).toContain('widen-authority');
    expect(FORBIDDEN).toContain('route-aumlok');
  });
  it('no plan can ever contain a non-envelope action', () => {
    const plans = [planUp(policy, allDown), planDown(policy, allUp), planSwap(policy, 'spatial-shell', null)];
    for (const plan of plans) for (const s of plan) expect(ENVELOPE).toContain(s.action);
  });
});

describe('phased boot + dependency ordering (donor start-kit behavior)', () => {
  it('boots in phase order with dependencies before dependents', () => {
    const plan = planUp(policy, allDown);
    const idx = (name, action) => plan.findIndex((p) => p.service === name && p.action === action);
    expect(idx('brain-door', 'probe')).toBeGreaterThanOrEqual(0);         // external: probe only
    expect(plan.some((p) => p.service === 'brain-door' && p.action === 'start')).toBe(false); // never started by us
    expect(idx('mind-door', 'start')).toBeLessThan(idx('spatial-shell', 'start')); // dependency ordering
    expect(idx('spatial-shell', 'start')).toBeLessThan(idx('spatial-shell', 'probe') + 1);
  });
  it('is idempotent: services already UP-OURS plan only probes (re-running up is a no-op start-wise)', () => {
    const plan = planUp(policy, allUp);
    expect(plan.every((p) => p.action !== 'start')).toBe(true);
    expect(plan.filter((p) => p.action === 'probe').length).toBe(policy.services.length);
  });
  it('is restart-safe: status is derived from observation only (no memory input exists)', () => {
    const afterCrash = deriveStatus(policy, { ...allDown, 'mind-door': OURS });
    expect(afterCrash.services.find((s) => s.name === 'mind-door').state).toBe('UP-OURS');
    expect(afterCrash.services.find((s) => s.name === 'spatial-shell').state).toBe('DOWN');
    expect(afterCrash.grantsAuthority).toBe(false);
  });
});

describe('stale PID / port-squatting defense', () => {
  it('a foreign occupant is classified OCCUPIED-FOREIGN and only isolated — never killed, never adopted', () => {
    expect(classifyService(policy.services[3], FOREIGN)).toBe('OCCUPIED-FOREIGN');
    const up = planUp(policy, { ...allDown, 'spatial-shell': FOREIGN });
    const shellSteps = up.filter((p) => p.service === 'spatial-shell');
    expect(shellSteps).toHaveLength(1);
    expect(shellSteps[0].action).toBe('isolate');
    const down = planDown(policy, { ...allUp, 'spatial-shell': FOREIGN });
    expect(down.find((p) => p.service === 'spatial-shell').action).toBe('isolate');
  });
});

describe('#71 supervised swap', () => {
  it('phase 1: candidate boots on the ALTERNATE port and is probed before any swap', () => {
    const plan = planSwap(policy, 'spatial-shell', null);
    expect(plan[0]).toMatchObject({ action: 'start', candidate: true, port: 7099 });
    expect(plan[1]).toMatchObject({ action: 'probe', candidate: true, port: 7099 });
  });
  it('verified candidate → swap, and the OLD process is stopped only AFTER the grace window', () => {
    const plan = planSwap(policy, 'spatial-shell', { portOpen: true, identityOk: true });
    expect(plan[0]).toMatchObject({ action: 'swap', from: 7096, to: 7099, graceMs: policy.swap.graceMs });
    expect(plan[1]).toMatchObject({ action: 'stop', port: 7096, afterGraceMs: policy.swap.graceMs });
  });
  it('failed candidate probe → candidate killed, old keeps serving, rollback receipted', () => {
    const plan = planSwap(policy, 'spatial-shell', { portOpen: true, identityOk: false });
    expect(plan[0]).toMatchObject({ action: 'stop', candidate: true, port: 7099 });
    expect(plan[1]).toMatchObject({ action: 'rollback', keep: 7096 });
  });
  it('swap is refused for services without a pre-authorized candidate port', () => {
    expect(() => planSwap(policy, 'mind-door', null)).toThrow(/not pre-authorized/);
  });
});

describe('contraction law', () => {
  it('contract is in-envelope; silent release is a refusal; explicit owner release is receipted', () => {
    expect(planContract(policy, 'voice-sidecar')[0].action).toBe('contract');
    expect(() => planContract(policy, 'voice-sidecar', { release: true })).toThrow(/silent release is forbidden/);
    const released = planContract(policy, 'voice-sidecar', { release: true, ownerExplicit: true });
    expect(released[0]).toMatchObject({ action: 'status', contractionReleased: true, ownerExplicit: true });
  });
});

describe('clean down', () => {
  it('stops in reverse phase order, ours only, no-ops for DOWN (idempotent)', () => {
    const plan = planDown(policy, allUp);
    const names = plan.filter((p) => p.action === 'stop').map((p) => p.service);
    expect(names[0]).toBe('spatial-shell'); // phase 3 first
    expect(names).not.toContain('brain-door'); // external never touched
    expect(planDown(policy, allDown)).toHaveLength(0);
  });
});

describe('manifest is a claim + protected class', () => {
  it('policy declares grantsAuthority:false, the closed envelope, and the AUMLOK refusal', () => {
    expect(policy.grantsAuthority).toBe(false);
    expect(policy.envelope.forbidden).toContain('execute-manifest-content');
    expect(policy.gateway.refusedUpstreams).toEqual([7094, 7095]);
    expect(policy.gateway.declaredRoutes).not.toContain('/api/aumlok');
  });
  it('protected.sha256 pins the whole supervisor surface and matches it byte-for-byte', () => {
    const pins = readFileSync(join(APP, 'protected.sha256'), 'utf8').trim().split('\n');
    expect(pins.length).toBe(5);
    for (const line of pins) {
      const [sha, rel] = line.split(/\s+/);
      const actual = createHash('sha256').update(readFileSync(join(APP, rel))).digest('hex');
      expect(actual, rel + ' drifted from the protected pin').toBe(sha);
    }
  });
  it('the gateway source refuses AUMLOK-shaped routing and opens no CORS', () => {
    const gw = readFileSync(join(APP, 'src', 'gateway.mjs'), 'utf8');
    expect(gw).toMatch(/never sits in front of AUMLOK|never fronted/i);
    expect(gw).toMatch(/aumlok\|ceremony\|bind\|approve/);
    expect(gw).not.toMatch(/Access-Control-Allow-Origin/);
  });
  it('spawn failure of an optional service cannot kill the plan (R44 live catch)', () => {
    const sup = readFileSync(join(APP, 'src', 'supervisor.mjs'), 'utf8');
    expect(sup).toMatch(/child\.on\('error'/);
  });
  it('the supervisor has no network control surface and no signing/promotion verbs anywhere', () => {
    const sup = readFileSync(join(APP, 'src', 'supervisor.mjs'), 'utf8');
    expect(sup).not.toMatch(/createServer|listen\(/);
    for (const src of ['engine.mjs', 'supervisor.mjs', 'gateway.mjs']) {
      const text = readFileSync(join(APP, 'src', src), 'utf8');
      expect(text).not.toMatch(/\bsignPromotion|promoteAuthority|widenAuthority\b/);
    }
  });
});
