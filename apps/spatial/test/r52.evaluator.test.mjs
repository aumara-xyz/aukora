// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R52 · canonical-path evaluator (#115) — the one-command governed-organism proof, asserted as a gate.
 *
 * Drives the REAL canonical path over production adapters and asserts the honest labels + the fail-closed
 * AUMLOK halt + main-untouched + self-verifying replay. Under AUKORA_EVAL_WRITE=1 it also writes the evidence
 * bundle to evaluator/artifacts/ (the same code path the fresh-clone command uses).
 */
import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCanonicalPath, SCHEMA } from '../evaluator/canonical-path.mjs';
import { probeConvex } from '../evaluator/convex-probe.mjs';
import { nodeFingerprint } from '../evaluator/lib/hash.mjs';
import { scanOverclaims, checkText } from '../evaluator/no-overclaim.mjs';

const ART = join(dirname(fileURLToPath(import.meta.url)), '..', 'evaluator', 'artifacts');
const WRITE = process.env.AUKORA_EVAL_WRITE === '1';

const convex = probeConvex();
const result = await runCanonicalPath({ convexStage: convex });
const byId = Object.fromEntries(result.stages.map((s) => [s.id, s]));

describe('R52 · canonical path — production adapters, honest labels', () => {
  it('stage 1 typed input is PROVEN (ingested through @aukora/brain)', () => {
    expect(byId['1-typed-input'].label).toBe('PROVEN');
    expect(byId['1-typed-input'].evidence.ok).toBe(true);
  });

  it('stage 2 local Convex settle is labelled honestly by the binary probe', () => {
    const s = byId['2-local-convex-settle'];
    expect(['LIVE_LOCAL', 'PARKED', 'TEST_ONLY']).toContain(s.label);
    expect(s.label).toBe(convex.available ? 'LIVE_LOCAL' : 'PARKED');
    if (!convex.available) expect(s.evidence.prerequisite).toMatch(/convex/i); // fails honestly with the prerequisite
  });

  it('stage 3 governed unsigned proposal is PROVEN and UNSIGNED (no candidate)', () => {
    const s = byId['3-governed-unsigned-proposal'];
    expect(s.label).toBe('PROVEN');
    expect(s.evidence.signed).toBe(false);
    expect(s.evidence.candidateBranch).toBeNull();
  });

  it('stage 4 fresh AUMLOK halt: unsigned materialize is REFUSED, no candidate, nothing signed', () => {
    const s = byId['4-fresh-aumlok-halt'];
    expect(s.label).toBe('PROVEN');
    expect(s.evidence.halted).toBe(true);
    expect(s.evidence.candidateBranch).toBeNull();
    expect(s.evidence.signed).toBe(false);
    expect(s.evidence.phase).not.toBe('candidate-materialized');
  });

  it('stage 5 isolated candidate: TEST owner lands a candidate/* branch; main untouched, nothing pushed', () => {
    const s = byId['5-isolated-candidate'];
    expect(s.label).toBe('TEST_ONLY');
    expect(s.evidence.phase).toBe('candidate-materialized');
    expect(String(s.evidence.candidateBranch)).toMatch(/^candidate\//);
    expect(s.evidence.touchedMain).toBe(false);
    expect(s.evidence.pushed).toBe(false);
  });

  it('stage 6 receipt: content-free chain verifies', () => {
    expect(byId['6-receipt'].label).toBe('PROVEN');
    expect(byId['6-receipt'].evidence.chainValid).toBe(true);
  });

  it('stage 7 reactive projection consumes the same real state, grants no authority', () => {
    const s = byId['7-reactive-projection'];
    expect(s.label).toBe(convex.available ? 'LIVE_LOCAL' : 'TEST_ONLY');
    expect(s.evidence.grantsAuthority).toBe(false);
    expect(s.evidence.liveCount).toBeGreaterThanOrEqual(1);
  });

  it('SAFETY: unsigned path halted, candidate isolated, real main byte-identical, no remote write', () => {
    expect(result.safety.unsignedHalted).toBe(true);
    expect(result.safety.candidateIsolated).toBe(true);
    expect(result.safety.tempMainUntouched).toBe(true);
    expect(result.safety.realMainByteIdentical).toBe(true);
    expect(result.safety.noRemoteWrite).toBe(true);
    expect(result.safety.nothingSigned).toBe(true);
  });

  it('SELF-VERIFYING: re-running the deterministic path reproduces the same coreHash', async () => {
    const again = await runCanonicalPath({ convexStage: convex });
    expect(again.coreHash).toBe(result.coreHash);
  });

  it('actual process death is DISTINGUISHED from in-process simulation', () => {
    // the in-process path performs no real death; the real kill -9 is the delegated canary, binary-gated
    expect(convex.processDeath.label).toBe(convex.available ? 'LIVE_LOCAL' : 'PARKED');
    expect(convex.processDeath.delegatedCommand).toMatch(/canary:r51/);
    expect(convex.processDeath.detail).toMatch(/in-process/i);
  });

  it('no-overclaim guard: the repo asserts NO bare external skunkworks claims', () => {
    const r = scanOverclaims();
    expect(r.violations, r.violations.join('\n')).toEqual([]);
    expect(r.files).toBeGreaterThan(50);
  });

  it('no-overclaim guard CATCHES a bare claim (falsification) but passes a qualified one', () => {
    expect(checkText('Aukora is unbreakable.').length).toBeGreaterThan(0);
    expect(checkText('The external harness claimed 86% recall; this is unverified simulation.')).toEqual([]);
    expect(checkText('Fugu Ultra is not Inkling.')).toEqual([]);
  });

  it('writes the self-verifying evidence bundle', () => {
    const bundle = {
      schema: 'aukora-canonical-path-bundle-v1',
      coreHash: result.coreHash,
      core: result.core,
      stages: result.stages,
      safety: result.safety,
      convex: { available: convex.available, settleLabel: convex.settleLabel, projectionLabel: convex.projectionLabel, processDeath: convex.processDeath, prerequisite: convex.prerequisite, binaryPresent: convex.available },
      environment: nodeFingerprint(),
      reproduction: 'AUKORA_EVAL_WRITE=1 npm run evaluate --workspace @aukora/spatial',
      surface: { grantsAuthority: false, providerArmed: false, remoteWrite: false, realMainTouched: false, secretsTouched: 'none' },
    };
    expect(bundle.core.schema).toBe(SCHEMA);
    if (WRITE) { mkdirSync(ART, { recursive: true }); writeFileSync(join(ART, 'canonical-path.json'), JSON.stringify(bundle, null, 2) + '\n'); }
    expect(bundle.coreHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
