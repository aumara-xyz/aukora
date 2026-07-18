// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * EVOLUTIONARY PETRI DISH — Inter-module communication substrate.
 *
 * The Petri Dish is where Aukora's modules talk to each other:
 * - Immune patrol findings → trigger inflammation → raise council thresholds
 * - Memory B activation → inform council decisions → strengthen with φ-decay
 * - Council decisions → feed into immune engagement packages
 * - Swarm coordination → distribute patrol coverage
 * - Inflammation → homeostasis cooldown → φ-governed return to normal
 *
 * This is NOT a controller. It is a SIGNALING SUBSTRATE — modules emit events,
 * other modules listen. No module commands another. All communication is
 * advisory, like hormone signaling in biology.
 *
 * grantsAuthority: false
 * advisoryOnly: true
 */

import { PHI, PHI_INV, phiDecay } from './decay.js';
import type { ThreatSignature, ImmuneCell } from './thymus.js';
import type { ScanReport, ScanFinding } from './patrol.js';
import type { InflammationLevel, SecurityPosture } from './inflammation.js';
import { computeInflammation, applyPostureToCouncil, POSTURES } from './inflammation.js';
import type { MemoryBCell } from './memoryB.js';
import { createMemoryB, memoryBRecognition, recallMemoryB, reinforceMemoryB, memoryStrength } from './memoryB.js';
import type { HomeostasisState } from './homeostasis.js';
import { initHomeostasis, advanceHomeostasis, computeHomeostasisTarget, effectivePosture } from './homeostasis.js';
import type { EngagementPackage, RoE } from './engagement.js';
import { createEngagement, STANDARD_ROE } from './engagement.js';
import type { KillerT } from './killerT.js';
import { spawnKillerT, executeKillerT } from './killerT.js';
import type { Antibody } from './antibody.js';
import { generateAntibody, antibodyBind, findBindingAntibodies, reinforceAntibody } from './antibody.js';

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT BUS — Hormone-style signaling (no commands, only signals)
// ═══════════════════════════════════════════════════════════════════════════════

export type PetriEventType =
  | 'patrol.finding'      // patrol detected something
  | 'inflammation.rise'   // security posture increased
  | 'inflammation.fall'   // security posture decreased
  | 'memoryB.formed'      // new memory B cell created
  | 'memoryB.recalled'    // existing memory recognized threat
  | 'council.decision'    // council reached a decision
  | 'killerT.spawned'     // killer T cell dispatched
  | 'killerT.executed'    // killer T completed action
  | 'antibody.generated'  // new antibody created
  | 'antibody.bound'      // antibody bound to threat
  | 'engagement.created'  // engagement package formed
  | 'homeostasis.advance' // cooldown cycle completed
  | 'petri.cycle';        // full petri cycle completed

export interface PetriEvent {
  readonly type: PetriEventType;
  readonly timestampMs: number;
  readonly source: string;        // which module emitted
  readonly payload: unknown;
  readonly inflammationLevel: InflammationLevel; // snapshot at event time
}

export type PetriListener = (event: PetriEvent) => void;

/** The event bus — modules subscribe, modules emit. No controller. */
export class PetriBus {
  private listeners: Map<PetriEventType, Set<PetriListener>> = new Map();
  private history: PetriEvent[] = [];
  private maxHistory: number;

  constructor(maxHistory: number = 1000) {
    this.maxHistory = maxHistory;
    for (const et of this.allEventTypes()) {
      this.listeners.set(et, new Set());
    }
  }

  private allEventTypes(): PetriEventType[] {
    return [
      'patrol.finding', 'inflammation.rise', 'inflammation.fall',
      'memoryB.formed', 'memoryB.recalled', 'council.decision',
      'killerT.spawned', 'killerT.executed', 'antibody.generated',
      'antibody.bound', 'engagement.created', 'homeostasis.advance', 'petri.cycle',
    ];
  }

  on(type: PetriEventType, listener: PetriListener): () => void {
    const set = this.listeners.get(type)!;
    set.add(listener);
    return () => set.delete(listener);
  }

  onAll(listener: PetriListener): () => void {
    const unsubscribes = this.allEventTypes().map(et => this.on(et, listener));
    return () => unsubscribes.forEach(u => u());
  }

  emit(event: Omit<PetriEvent, 'timestampMs'> & { timestampMs?: number }): void {
    const fullEvent: PetriEvent = {
      ...event,
      timestampMs: event.timestampMs ?? Date.now(),
    };
    this.history.push(fullEvent);
    // maxHistory <= 0 means "retain NO history" — `slice(-0)` is `slice(0)` (the WHOLE array), so guard it
    // explicitly rather than leaving history unbounded.
    if (this.maxHistory <= 0) this.history = [];
    else if (this.history.length > this.maxHistory) this.history = this.history.slice(-this.maxHistory);
    const set = this.listeners.get(fullEvent.type);
    if (set) {
      for (const listener of set) {
        try { listener(fullEvent); } catch (e) { /* advisory — failures don't break bus */ }
      }
    }
  }

  historyOf(type?: PetriEventType): readonly PetriEvent[] {
    if (type) return this.history.filter(e => e.type === type);
    return [...this.history];
  }

  eventCounts(): Record<PetriEventType, number> {
    const counts: Partial<Record<PetriEventType, number>> = {};
    for (const et of this.allEventTypes()) counts[et] = 0;
    for (const e of this.history) { counts[e.type] = (counts[e.type] ?? 0) + 1; }
    return counts as Record<PetriEventType, number>;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PETRI DISH STATE — the current immune-model projection (metaphor; not an organism)
// ═══════════════════════════════════════════════════════════════════════════════

export interface PetriState {
  readonly inflammationLevel: InflammationLevel;
  readonly securityPosture: SecurityPosture;
  readonly homeostasis: HomeostasisState | null;
  readonly memoryBCells: readonly MemoryBCell[];
  readonly antibodies: readonly Antibody[];
  readonly killerTCells: readonly KillerT[];
  readonly patrolReports: readonly ScanReport[];
  readonly engagements: readonly EngagementPackage[];
  readonly cycleCount: number;
  readonly threatScore: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PETRI CYCLE — one deterministic fold of the immune model (metaphor; not a heartbeat)
// ═══════════════════════════════════════════════════════════════════════════════

export interface PetriCycleInput {
  readonly patrolReports: readonly ScanReport[];
  readonly newThreats: readonly ThreatSignature[];
  readonly candidateContent: string;
  readonly nowMs: number;
}

export interface PetriCycleOutput {
  readonly state: PetriState;
  readonly events: readonly PetriEvent[];
  readonly actions: readonly string[];
}

export function runPetriCycle(
  bus: PetriBus,
  previousState: PetriState,
  input: PetriCycleInput,
): PetriCycleOutput {
  const actions: string[] = [];
  const events: PetriEvent[] = [];
  const now = input.nowMs;
  // DETERMINISTIC emissions: stamp EVERY bus emission with the injected cycle timestamp `now`, so the bus history
  // (`historyOf()`) is reproducible across runs and never falls back to wall-clock time.
  const emitNow = (e: Omit<PetriEvent, 'timestampMs'>): void => bus.emit({ ...e, timestampMs: now });

  // Step 1: Aggregate patrol findings
  const totalFindings = input.patrolReports.reduce((s, r) => s + r.findings.length, 0);
  const criticalFindings = input.patrolReports.reduce(
    (s, r) => s + r.findings.filter(f => f.severity === 'critical').length, 0
  );
  for (const report of input.patrolReports) {
    emitNow({ type: 'patrol.finding', source: 'patrol', payload: report, inflammationLevel: previousState.inflammationLevel });
    events.push({ type: 'patrol.finding', timestampMs: now, source: 'patrol', payload: report, inflammationLevel: previousState.inflammationLevel });
  }
  if (totalFindings > 0) actions.push(`[PATROL] ${totalFindings} findings (${criticalFindings} critical) across ${input.patrolReports.length} scans`);

  // Step 2: Compute inflammation
  const { level: newInflammation, posture: newPosture } = computeInflammation(criticalFindings, totalFindings, previousState.inflammationLevel);
  if (newInflammation !== previousState.inflammationLevel) {
    const isRise = ['baseline', 'elevated', 'high', 'crisis'].indexOf(newInflammation) > ['baseline', 'elevated', 'high', 'crisis'].indexOf(previousState.inflammationLevel);
    emitNow({ type: isRise ? 'inflammation.rise' : 'inflammation.fall', source: 'inflammation', payload: { from: previousState.inflammationLevel, to: newInflammation }, inflammationLevel: newInflammation });
    events.push({ type: isRise ? 'inflammation.rise' : 'inflammation.fall', timestampMs: now, source: 'inflammation', payload: { from: previousState.inflammationLevel, to: newInflammation }, inflammationLevel: newInflammation });
    actions.push(`[INFLAMMATION] ${isRise ? 'RISE' : 'FALL'}: ${previousState.inflammationLevel} → ${newInflammation}`);
  }

  // Step 3: Check antibodies (fast path)
  let matchedAntibodies: readonly { antibody: Antibody; confidence: number }[] = [];
  if (previousState.antibodies.length > 0 && input.candidateContent) {
    matchedAntibodies = findBindingAntibodies(previousState.antibodies, input.candidateContent);
    for (const match of matchedAntibodies) {
      emitNow({ type: 'antibody.bound', source: 'antibody', payload: match, inflammationLevel: newInflammation });
      events.push({ type: 'antibody.bound', timestampMs: now, source: 'antibody', payload: match, inflammationLevel: newInflammation });
    }
    if (matchedAntibodies.length > 0) actions.push(`[ANTIBODY] ${matchedAntibodies.length} antibodies bound (fast path)`);
  }

  // Step 4: Check memory B cells (slow path)
  let recalledMemory: readonly MemoryBCell[] = [];
  if (previousState.memoryBCells.length > 0 && input.candidateContent) {
    recalledMemory = recallMemoryB(previousState.memoryBCells, input.candidateContent, now);
    for (const cell of recalledMemory) {
      emitNow({ type: 'memoryB.recalled', source: 'memoryB', payload: cell, inflammationLevel: newInflammation });
      events.push({ type: 'memoryB.recalled', timestampMs: now, source: 'memoryB', payload: cell, inflammationLevel: newInflammation });
    }
    if (recalledMemory.length > 0) actions.push(`[MEMORY B] ${recalledMemory.length} cells recalled (learned defense)`);
  }

  // Step 5: REINFORCE bound antibodies (a cycle-driven bind must increment bindCount), then generate new ones.
  const boundIds = new Set(matchedAntibodies.map((m) => m.antibody.id));
  let newAntibodies: Antibody[] = previousState.antibodies.map((ab) => (boundIds.has(ab.id) ? reinforceAntibody(ab) : ab));
  for (const threat of input.newThreats) {
    const ab = generateAntibody(threat, now);
    newAntibodies = [...newAntibodies, ab];
    emitNow({ type: 'antibody.generated', source: 'antibody', payload: ab, inflammationLevel: newInflammation });
    events.push({ type: 'antibody.generated', timestampMs: now, source: 'antibody', payload: ab, inflammationLevel: newInflammation });
    actions.push(`[ANTIBODY] Generated for threat: ${threat.pattern}`);
  }

  // Step 6: REINFORCE recalled memory (a recall must update the cell's encounter state), then form new cells.
  const recalledIds = new Set(recalledMemory.map((c) => c.signatureId));
  let newMemoryB: MemoryBCell[] = previousState.memoryBCells.map((c) => (recalledIds.has(c.signatureId) ? reinforceMemoryB(c, now, c.responseEffectiveness) : c));
  for (const threat of input.newThreats) {
    const cell = createMemoryB(threat, 0.8, now);
    newMemoryB = [...newMemoryB, cell];
    emitNow({ type: 'memoryB.formed', source: 'memoryB', payload: cell, inflammationLevel: newInflammation });
    events.push({ type: 'memoryB.formed', timestampMs: now, source: 'memoryB', payload: cell, inflammationLevel: newInflammation });
    actions.push(`[MEMORY B] New cell formed for: ${threat.pattern}`);
  }

  // Step 7: Spawn killer T cells for ALL threats
  let newKillerT: KillerT[] = [...previousState.killerTCells];
  for (let i = 0; i < input.newThreats.length; i++) {
    const kt = spawnKillerT(input.newThreats[i], `kt_${now}_${i}`, now);
    newKillerT = [...newKillerT, kt];
    emitNow({ type: 'killerT.spawned', source: 'killerT', payload: kt, inflammationLevel: newInflammation });
    events.push({ type: 'killerT.spawned', timestampMs: now, source: 'killerT', payload: kt, inflammationLevel: newInflammation });
    actions.push(`[KILLER T] ${kt.type} cell spawned targeting: ${input.newThreats[i].pattern}`);
  }

  // Step 8: Execute killer T cells
  const executedKillerT: KillerT[] = [];
  for (const kt of newKillerT) {
    // Execute ONLY against the exact threat this cell was spawned for — no content-based fallback (which would
    // pair a cell with an unrelated threat and let `executeKillerT` mis-report neutralization).
    const threat = input.newThreats.find(t => t.id === kt.targetThreatId);
    if (threat) {
      const result = executeKillerT(kt, threat);
      emitNow({ type: 'killerT.executed', source: 'killerT', payload: { killerT: kt, result }, inflammationLevel: newInflammation });
      events.push({ type: 'killerT.executed', timestampMs: now, source: 'killerT', payload: { killerT: kt, result }, inflammationLevel: newInflammation });
      if (result.threatNeutralized) actions.push(`[KILLER T] ${kt.type} neutralized threat: ${threat.pattern}`);
    }
    executedKillerT.push(kt);
  }

  // Step 9: Create engagement packages
  let newEngagements: EngagementPackage[] = [...previousState.engagements];
  for (const threat of input.newThreats) {
    const engagement = createEngagement(threat, STANDARD_ROE, now);
    newEngagements = [...newEngagements, engagement];
    emitNow({ type: 'engagement.created', source: 'engagement', payload: engagement, inflammationLevel: newInflammation });
    events.push({ type: 'engagement.created', timestampMs: now, source: 'engagement', payload: engagement, inflammationLevel: newInflammation });
    actions.push(`[ENGAGEMENT]  for ${threat.severity} threat: ${threat.pattern}`);
  }

  // Step 10: Advance homeostasis
  let newHomeostasis = previousState.homeostasis;
  if (newInflammation !== 'baseline' && totalFindings === 0) {
    if (!newHomeostasis) newHomeostasis = initHomeostasis(newInflammation, 0, 0, now);
    else newHomeostasis = advanceHomeostasis(newHomeostasis, now);
    emitNow({ type: 'homeostasis.advance', source: 'homeostasis', payload: newHomeostasis, inflammationLevel: newInflammation });
    events.push({ type: 'homeostasis.advance', timestampMs: now, source: 'homeostasis', payload: newHomeostasis, inflammationLevel: newInflammation });
    actions.push(`[HOMEOSTASIS] Cooldown: ${newHomeostasis.currentLevel} → target ${newHomeostasis.targetLevel}`);
  }

  // Step 10b: HOMEOSTASIS PROJECTION — if the cooldown de-escalated below the (hysteretic) inflammation level,
  // the next state's effective level FOLLOWS homeostasis. Without this, `computeInflammation`'s hysteresis
  // preserves the previous higher level and the organism could never actually cool down.
  const levelIdx = (l: InflammationLevel) => ['baseline', 'elevated', 'high', 'crisis'].indexOf(l);
  let effectiveLevel = newInflammation;
  let effectivePostureVal = newPosture;
  if (newHomeostasis && levelIdx(newHomeostasis.currentLevel) < levelIdx(newInflammation)) {
    effectiveLevel = newHomeostasis.currentLevel;
    effectivePostureVal = POSTURES[effectiveLevel];
  }

  // Step 11: Compute composite threat score (on the effective, post-cooldown level)
  const threatScore = Math.min(1, (criticalFindings * 0.3) + (totalFindings * 0.05) + (matchedAntibodies.length * 0.1) + (recalledMemory.length * 0.15) + (levelIdx(effectiveLevel) * 0.25));

  // Step 12: FINALIZE the snapshot BEFORE emitting it — push the completion action first, then emit an IMMUTABLE
  // copy of actions on the effective (post-homeostasis) level. Previously the emit happened, THEN `actions` was
  // mutated, so listeners observed a payload missing the completion line while later history reads included it;
  // the event also mis-reported `newInflammation` instead of `effectiveLevel`.
  const newState: PetriState = {
    inflammationLevel: effectiveLevel, securityPosture: effectivePostureVal, homeostasis: newHomeostasis,
    memoryBCells: newMemoryB, antibodies: newAntibodies, killerTCells: executedKillerT,
    patrolReports: [...previousState.patrolReports, ...input.patrolReports],
    engagements: newEngagements, cycleCount: previousState.cycleCount + 1, threatScore,
  };
  actions.push(`[PETRI] Cycle ${newState.cycleCount} complete | Threat: ${(threatScore * 100).toFixed(1)}% | Posture: ${effectiveLevel}`);
  const finalActions: readonly string[] = Object.freeze([...actions]);
  emitNow({ type: 'petri.cycle', source: 'petriDish', payload: { state: newState, actions: finalActions }, inflammationLevel: effectiveLevel });
  events.push({ type: 'petri.cycle', timestampMs: now, source: 'petriDish', payload: { state: newState, actions: finalActions }, inflammationLevel: effectiveLevel });

  return { state: newState, events, actions: finalActions };
}

// ═══════════════════════════════════════════════════════════════════════════════
// INITIAL STATE
// ═══════════════════════════════════════════════════════════════════════════════

export function createInitialPetriState(nowMs?: number): PetriState {
  return {
    inflammationLevel: 'baseline', securityPosture: POSTURES.baseline, homeostasis: null,
    memoryBCells: [], antibodies: [], killerTCells: [], patrolReports: [], engagements: [],
    cycleCount: 0, threatScore: 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// FEEDBACK LOOPS
// ═══════════════════════════════════════════════════════════════════════════════

export function wireCouncilToPatrol(bus: PetriBus, getSensitivity: (inf: InflammationLevel) => number): () => void {
  return bus.on('council.decision', (event) => {
    const payload = event.payload as { coherence: number; approved: boolean };
    if (!payload.approved) {
      // The feedback signal now CARRIES the derived patrol sensitivity for the current level (the callback was
      // previously ignored) — so a consumer can observe how a low-coherence decision retunes patrol coverage.
      const patrolSensitivity = getSensitivity(event.inflammationLevel);
      bus.emit({ type: 'inflammation.rise', source: 'council→patrol.feedback', payload: { reason: 'low_coherence_decision', coherence: payload.coherence, patrolSensitivity }, inflammationLevel: event.inflammationLevel, timestampMs: event.timestampMs });
    }
  });
}

export function wireInflammationToMemory(bus: PetriBus): () => void {
  return bus.on('inflammation.rise', (event) => {
    const payload = event.payload as { from: InflammationLevel; to: InflammationLevel };
    bus.emit({ type: 'memoryB.formed', source: 'inflammation→memory.feedback', payload: { reason: 'inflammation_rise', from: payload.from, to: payload.to, strengthBonus: PHI_INV }, inflammationLevel: event.inflammationLevel, timestampMs: event.timestampMs });
  });
}

export function wireAntibodyToInflammation(bus: PetriBus): () => void {
  return bus.on('antibody.bound', (event) => {
    const payload = event.payload as { antibody: Antibody; confidence: number };
    if (payload.confidence > 0.8) {
      bus.emit({ type: 'inflammation.fall', source: 'antibody→inflammation.feedback', payload: { reason: 'learned_immunity', confidence: payload.confidence }, inflammationLevel: event.inflammationLevel, timestampMs: event.timestampMs });
    }
  });
}

export function wireAllFeedbackLoops(bus: PetriBus): (() => void)[] {
  return [
    wireCouncilToPatrol(bus, (inf) => inf === 'crisis' ? 0.9 : inf === 'high' ? 0.7 : inf === 'elevated' ? 0.5 : 0.3),
    wireInflammationToMemory(bus),
    wireAntibodyToInflammation(bus),
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// DIAGNOSTICS
// ═══════════════════════════════════════════════════════════════════════════════

export interface PetriDiagnostics {
  readonly cycleCount: number;
  readonly totalEvents: number;
  readonly eventBreakdown: Record<string, number>;
  readonly memoryStrength: number;
  readonly antibodyCount: number;
  readonly killerTCount: number;
  readonly currentInflammation: InflammationLevel;
  readonly threatScore: number;
  readonly feedbackLoopsActive: number;
}

export function diagnosePetri(state: PetriState, bus: PetriBus): PetriDiagnostics {
  return {
    cycleCount: state.cycleCount, totalEvents: bus.historyOf().length,
    eventBreakdown: bus.eventCounts() as unknown as Record<string, number>,
    memoryStrength: memoryStrength(state.memoryBCells), antibodyCount: state.antibodies.length,
    killerTCount: state.killerTCells.length, currentInflammation: state.inflammationLevel,
    threatScore: state.threatScore, feedbackLoopsActive: 3,
  };
}
