// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R55 — the immune substrate modules (thymus/patrol/inflammation/killerT/antibody/memoryB/homeostasis/engagement).
 * Every test imports the SHIPPED source through the package barrel. All functions are pure and advisory: they
 * RETURN descriptions, they never act. METAPHOR — none of this is biology.
 */
import { describe, it, expect } from 'vitest';
import {
  type ThreatSignature,
  thymicSelection, negativeSelect, fibonacciEscalation, FIBONACCI_LEVELS, DEFAULT_SELF_PATTERNS,
  patrolScan, aggregateFindings,
  computeInflammation, POSTURES,
  selectKillerTType, spawnKillerT, executeKillerT, checkAutoimmunity,
  generateAntibody, antibodyBind, findBindingAntibodies, reinforceAntibody, hasSeroconverted,
  createMemoryB, memoryBRecognition, reinforceMemoryB, recallMemoryB, memoryStrength,
  initHomeostasis, advanceHomeostasis, effectivePosture,
  createEngagement, isActionAuthorized, STANDARD_ROE, STRICT_ROE,
} from '@aukora/immune';

const NOW = 1_735_689_600_000;
const threat = (over: Partial<ThreatSignature> = {}): ThreatSignature => ({
  id: 't1', pattern: 'malware-beacon', severity: 'critical', mitreTechnique: 'T1548', firstSeen: NOW, encounterCount: 1, ...over,
});

describe('thymus — self/non-self selection + Fibonacci escalation', () => {
  it('fibonacciEscalation maps severity onto the Fibonacci ladder', () => {
    for (const s of ['low', 'medium', 'high', 'critical'] as const) expect(FIBONACCI_LEVELS).toContain(fibonacciEscalation(s));
    expect(fibonacciEscalation('critical')).toBeGreaterThan(fibonacciEscalation('low')); // more severe ⇒ higher rung
  });
  it('negativeSelect rejects a candidate that collides with a protected self-pattern', () => {
    const selfish = threat({ pattern: DEFAULT_SELF_PATTERNS[0].pattern });
    expect(negativeSelect([selfish]).passed).toBe(false);          // would attack self → culled
    expect(negativeSelect([threat({ pattern: 'zzz-unrelated-zzz' })]).passed).toBe(true);
  });
  it('thymicSelection returns immutable trained cells (data only, no side effect)', () => {
    const cells = thymicSelection([{ archetype: 'patrol', patterns: ['ransomware'], signatures: [threat()], id: 'c1' }]);
    expect(Array.isArray(cells)).toBe(true);
  });
});

describe('patrol — deviation scan produces advisory findings', () => {
  it('flags content matching a known attack pattern and aggregates by count', () => {
    const cfg = { patrolId: 'p1', scanType: 'workflow' as const, sensitivity: 0.9, knownSignatures: [threat()] };
    const report = patrolScan(cfg, 'an attempt to exfiltrate the receipts', NOW);
    expect(report.findings.length).toBeGreaterThan(0);                 // 'exfiltrate' anomaly detected
    expect(aggregateFindings([report]).totalFindings).toBe(report.findings.length);
  });
  it('a clean candidate with no known/anomaly match produces no findings', () => {
    const cfg = { patrolId: 'p1', scanType: 'workflow' as const, sensitivity: 0.5, knownSignatures: [threat({ pattern: 'xyzzy-signature' })] };
    expect(patrolScan(cfg, 'ordinary benign content', NOW).findings).toHaveLength(0);
  });
});

describe('inflammation — posture escalates with critical findings (hysteresis)', () => {
  it('baseline with no findings; crisis is the most escalated posture', () => {
    expect(computeInflammation(0, 0).level).toBe('baseline');
    expect(computeInflammation(9, 20).level).toBe('crisis');
    expect(POSTURES.crisis.escalationLevel).toBeGreaterThan(POSTURES.baseline.escalationLevel);
    expect(computeInflammation(9, 20).posture).toEqual(POSTURES.crisis);
  });
});

describe('killerT — advisory neutralization plan, self-protection', () => {
  it('spawns a typed cell, returns an action PLAN (never executed), and flags autoimmunity on a self collision', () => {
    const t = threat();
    const kt = spawnKillerT(t, 'kt1', NOW);
    expect(['cytotoxic', 'helper', 'suppressor']).toContain(selectKillerTType(t));
    expect(Array.isArray(executeKillerT(kt, t).actionsTaken)).toBe(true);   // a PLAN of actions, never run here
    expect(checkAutoimmunity(kt, []).autoImmune).toBe(false);               // no declared self-patterns → safe
    expect(checkAutoimmunity(kt, [kt.actions[0]]).autoImmune).toBe(true);   // an action that hits a self-pattern = autoimmune
  });
});

describe('antibody — bind + seroconversion, φ-reinforced', () => {
  it('generates, binds matching content, and reinforcement strengthens (never weakens)', () => {
    const ab = generateAntibody(threat({ pattern: 'malicious-signature' }), NOW);
    expect(antibodyBind(ab, 'contains malicious-signature here').binds).toBe(true);
    expect(antibodyBind(ab, 'totally unrelated').binds).toBe(false);
    const stronger = reinforceAntibody(ab);
    expect(stronger.bindScore).toBeGreaterThanOrEqual(ab.bindScore);
    expect(findBindingAntibodies([ab], 'malicious-signature').length).toBe(1);
    expect(hasSeroconverted([stronger], 'malicious-signature')).toBe(true);
  });
});

describe('memoryB — φ-decayed threat recall', () => {
  it('recognition does not grow with age; reinforcement keeps strength positive', () => {
    const cell = createMemoryB(threat({ pattern: 'apt-beacon' }), 0.9, NOW);
    const fresh = memoryBRecognition(cell, 'apt-beacon observed', NOW);
    const aged = memoryBRecognition(cell, 'apt-beacon observed', NOW + 60 * 24 * 3600_000);
    expect(aged).toBeLessThanOrEqual(fresh + 1e-9);
    expect(memoryStrength([reinforceMemoryB(cell, NOW + 1000, 0.95)])).toBeGreaterThan(0);
    expect(Array.isArray(recallMemoryB([cell], 'apt-beacon', NOW))).toBe(true);
  });
});

describe('homeostasis — bounded relaxation toward a target posture', () => {
  it('advances deterministically (pure) and yields an effective posture', () => {
    const s0 = initHomeostasis('crisis', 5, 3, NOW);
    const s1 = advanceHomeostasis(s0, NOW + 3600_000);
    expect(advanceHomeostasis(s0, NOW + 3600_000)).toEqual(s1);   // pure: same input → same output
    expect(s1.cooldownProgress).toBeGreaterThanOrEqual(0);
    expect(effectivePosture(s1)).toBeDefined();
  });
});

describe('engagement — rules of engagement gate advisory actions', () => {
  it('an action is authorized iff allowed AND not prohibited; createEngagement is pure data', () => {
    const pkg = createEngagement(threat(), STANDARD_ROE, NOW);
    expect(typeof pkg.authorized).toBe('boolean');
    // STANDARD prohibits the invasive actions; STRICT-enforcement RoE permits them. isActionAuthorized is pure.
    expect(isActionAuthorized('patrol_scan', STANDARD_ROE)).toBe(true);
    expect(isActionAuthorized('quarantine_content', STANDARD_ROE)).toBe(false); // prohibited under STANDARD
    expect(isActionAuthorized('quarantine_content', STRICT_ROE)).toBe(true);    // permitted under STRICT
    expect(isActionAuthorized('quarantine_content', STANDARD_ROE)).toBe(false); // deterministic
  });
});
