// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R55 — the Petri dish: a PURE, deterministic fold over an immune-cycle input that emits advisory events + action
 * DESCRIPTIONS. This real suite (importing the shipped source) replaces the donor's 1328-line standalone script.
 * METAPHOR: the "dish" is an in-memory reducer; nothing is cultured, alive, or persisted.
 */
import { describe, it, expect } from 'vitest';
import {
  type ThreatSignature, type PetriEvent,
  PetriBus, runPetriCycle, createInitialPetriState, wireAllFeedbackLoops,
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
    bus.emit({ type: 'patrol.finding', source: 'patrol', payload: {}, inflammationLevel: 'baseline' });
    expect(seen).toHaveLength(1);
    off();
    bus.emit({ type: 'patrol.finding', source: 'patrol', payload: {}, inflammationLevel: 'baseline' });
    expect(seen).toHaveLength(1); // no delivery after unsubscribe
  });
});

describe('runPetriCycle — a deterministic PURE fold (advisory only)', () => {
  it('same inputs → byte-identical events + actions + next state (no hidden state, no side effect)', () => {
    const a = runPetriCycle(new PetriBus(), createInitialPetriState(NOW), input());
    const b = runPetriCycle(new PetriBus(), createInitialPetriState(NOW), input());
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
    expect(a.actions).toEqual(b.actions);
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
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
