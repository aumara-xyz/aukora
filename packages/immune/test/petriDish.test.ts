// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R55 — the Petri dish: a PURE, deterministic fold over an immune-cycle input that emits advisory events + action
 * DESCRIPTIONS. This real suite (importing the shipped source) replaces the donor's 1328-line standalone script.
 * METAPHOR: the "dish" is an in-memory reducer; nothing is cultured, alive, or persisted.
 */
import { describe, it, expect } from 'vitest';
import {
  type ThreatSignature, type PetriEvent, type Antibody, type MemoryBCell,
  PetriBus, runPetriCycle, createInitialPetriState, wireAllFeedbackLoops, wireCouncilToPatrol,
  generateAntibody, createMemoryB, initHomeostasis, POSTURES,
} from '@aukora/immune';

const NOW = 1_735_689_600_000;
const threat = (over: Partial<ThreatSignature> = {}): ThreatSignature => ({
  id: 't1', pattern: 'malware-beacon', severity: 'high', mitreTechnique: 'T1071', firstSeen: NOW, encounterCount: 1, ...over,
});
const input = (over: Partial<Parameters<typeof runPetriCycle>[2]> = {}) => ({
  patrolReports: [], newThreats: [threat()], candidateContent: 'a candidate with malware-beacon', nowMs: NOW, ...over,
});

describe('PetriBus — a synchronous in-memory event bus (no I/O)', () => {
  it('delivers emitted events to subscribers and unsubscribes cleanly', () => {
    const bus = new PetriBus();
    const seen: PetriEvent[] = [];
    const off = bus.on('patrol.finding', (e) => seen.push(e));
    bus.emit({ type: 'patrol.finding', source: 'patrol', payload: {}, inflammationLevel: 'baseline', timestampMs: NOW });
    expect(seen).toHaveLength(1);
    off();
    bus.emit({ type: 'patrol.finding', source: 'patrol', payload: {}, inflammationLevel: 'baseline', timestampMs: NOW });
    expect(seen).toHaveLength(1); // no delivery after unsubscribe
  });
  it('maxHistory = 0 retains NO history (guards the slice(-0) === whole-array footgun)', () => {
    const bus = new PetriBus(0);
    bus.emit({ type: 'patrol.finding', source: 'patrol', payload: {}, inflammationLevel: 'baseline', timestampMs: NOW });
    bus.emit({ type: 'patrol.finding', source: 'patrol', payload: {}, inflammationLevel: 'baseline', timestampMs: NOW });
    expect(bus.historyOf()).toHaveLength(0); // disabled, not unbounded
  });
});

describe('cycle reinforcement + immutable snapshot + observable council feedback', () => {
  it('a cycle-driven antibody bind INCREMENTS bindCount; a recalled memory cell is reinforced', () => {
    const ab = generateAntibody(threat({ id: 'tA', pattern: 'malware-beacon' }), NOW); // bindCount 0
    const cell = createMemoryB(threat({ id: 'tA', pattern: 'malware-beacon' }), 0.8, NOW);
    const prev = { ...createInitialPetriState(NOW), antibodies: [ab] as readonly Antibody[], memoryBCells: [cell] as readonly MemoryBCell[] };
    const out = runPetriCycle(new PetriBus(), prev, input({ newThreats: [], candidateContent: 'contains malware-beacon' }));
    const persisted = out.state.antibodies.find((a) => a.id === ab.id)!;
    expect(persisted.bindCount).toBeGreaterThan(ab.bindCount); // reinforcement persisted, not discarded
    const recalled = out.state.memoryBCells.find((c) => c.signatureId === cell.signatureId)!;
    // STRICTLY greater — a `>=` would pass on an unchanged (non-reinforced) cell and miss the regression.
    expect(recalled.encounterTimestamps.length).toBeGreaterThan(cell.encounterTimestamps.length);
    expect(recalled.lastEncounter).toBe(NOW); // the recall updated the encounter state to this cycle
  });
  it('the emitted petri.cycle payload actions EQUAL the returned actions (finalized before emit) + effective level', () => {
    const bus = new PetriBus();
    const out = runPetriCycle(bus, createInitialPetriState(NOW), input());
    const cycleEvent = bus.historyOf('petri.cycle')[0];
    const payload = cycleEvent.payload as { actions: readonly string[]; state: { inflammationLevel: string } };
    expect(payload.actions).toEqual(out.actions);                 // listener saw the COMPLETE action list
    expect(payload.actions).toContain(out.actions[out.actions.length - 1]); // incl. the completion line
    expect(cycleEvent.inflammationLevel).toBe(out.state.inflammationLevel);  // effective (post-homeostasis) level
  });
  it('wireCouncilToPatrol includes the derived patrol sensitivity in its feedback signal (callback is observable)', () => {
    const bus = new PetriBus();
    const seen: PetriEvent[] = [];
    bus.on('inflammation.rise', (e) => { if (e.source === 'council→patrol.feedback') seen.push(e); });
    wireCouncilToPatrol(bus, (inf) => (inf === 'crisis' ? 1.0 : 0.42));
    bus.emit({ type: 'council.decision', source: 'council', payload: { coherence: 0.3, approved: false }, inflammationLevel: 'elevated', timestampMs: NOW });
    expect(seen).toHaveLength(1);
    expect((seen[0].payload as { patrolSensitivity: number }).patrolSensitivity).toBe(0.42);
  });
});

describe('R55.3 · runtime immutability + canonical newThreats scoring + effective fall', () => {
  it('exported POSTURES and returned/emitted cycle snapshots are FROZEN at runtime (no alias leak)', () => {
    expect(Object.isFrozen(POSTURES)).toBe(true);
    expect(Object.isFrozen(POSTURES.crisis)).toBe(true);
    const bus = new PetriBus();
    const out = runPetriCycle(bus, createInitialPetriState(NOW), input());
    expect(Object.isFrozen(out.state)).toBe(true);
    expect(Object.isFrozen(out.state.antibodies)).toBe(true);
    expect(() => { (out.state as { threatScore: number }).threatScore = 999; }).toThrow(TypeError);
    const cycleEvent = bus.historyOf('petri.cycle')[0];
    expect(Object.isFrozen(cycleEvent)).toBe(true);      // stored events are frozen too
  });
  it('a critical newThreats with ZERO patrol findings still RAISES inflammation + a non-zero threat score', () => {
    const out = runPetriCycle(new PetriBus(), createInitialPetriState(NOW), input({
      patrolReports: [], newThreats: [threat({ id: 'tC', severity: 'critical', pattern: 'forge-receipt' })], candidateContent: '',
    }));
    expect(out.state.inflammationLevel).not.toBe('baseline'); // a declared critical threat is counted (was 'baseline' before)
    expect(out.state.threatScore).toBeGreaterThan(0);
  });
  it('a homeostasis de-escalation emits an EFFECTIVE inflammation.fall (high → elevated) on a quiet cycle', () => {
    const prev = { ...createInitialPetriState(NOW), inflammationLevel: 'high' as const, homeostasis: initHomeostasis('elevated', 0, 0, NOW) };
    const bus = new PetriBus();
    const out = runPetriCycle(bus, prev, input({ patrolReports: [], newThreats: [], candidateContent: '' }));
    const fall = bus.historyOf('inflammation.fall').find((e) => (e.payload as { from: string }).from === 'high');
    expect(fall).toBeDefined();
    expect((fall!.payload as { to: string }).to).toBe('elevated');
    expect(out.state.inflammationLevel).toBe('elevated'); // returned state agrees with the emitted transition
  });
});

describe('runPetriCycle — a deterministic PURE fold (advisory only)', () => {
  it('same inputs → byte-identical events + actions + next state + BUS HISTORY (no wall-clock leakage)', () => {
    const busA = new PetriBus();
    const busB = new PetriBus();
    const a = runPetriCycle(busA, createInitialPetriState(NOW), input());
    const b = runPetriCycle(busB, createInitialPetriState(NOW), input());
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
    expect(a.actions).toEqual(b.actions);
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    // the observable BUS HISTORY must also be identical — this catches Date.now() leaking into any cycle emission
    expect(JSON.stringify(busA.historyOf())).toBe(JSON.stringify(busB.historyOf()));
    expect(busA.historyOf().every((e) => e.timestampMs === NOW)).toBe(true); // every emission carries the injected now
  });
  it('a new threat produces advisory events + human-readable action DESCRIPTIONS, never executed effects', () => {
    const out = runPetriCycle(new PetriBus(), createInitialPetriState(NOW), input());
    expect(out.events.length).toBeGreaterThan(0);
    expect(out.actions.every((s) => typeof s === 'string')).toBe(true); // descriptions, not calls
    // the previous state is never mutated (pure fold returns a NEW state)
    const prev = createInitialPetriState(NOW);
    const frozen = JSON.stringify(prev);
    runPetriCycle(new PetriBus(), prev, input());
    expect(JSON.stringify(prev)).toBe(frozen);
  });
  it('an empty cycle (no threats, no findings) is stable and terminates', () => {
    const out = runPetriCycle(new PetriBus(), createInitialPetriState(NOW), input({ newThreats: [], candidateContent: '' }));
    expect(out.state).toBeDefined();
    expect(Array.isArray(out.events)).toBe(true);
  });
  it('feedback loops wire + unwire without throwing (pure closures over the bus)', () => {
    const bus = new PetriBus();
    const offs = wireAllFeedbackLoops(bus);
    expect(offs.length).toBeGreaterThan(0);
    for (const off of offs) expect(() => off()).not.toThrow();
  });
});
