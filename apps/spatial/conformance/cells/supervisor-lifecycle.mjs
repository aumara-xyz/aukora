// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R49 conformance cell E2 — SUPERVISOR CRASH / RESTART / OWNERSHIP (K3 priority 2, issue #15).
 *
 * Reconstructed from canonical public interfaces — it imports the REAL pure lifecycle engine
 * (apps/supervisor/src/engine.mjs) and exercises it as a property-based conformance sweep plus a scripted
 * crash → restart → squatter → swap → rollback scenario. The engine is pure (policy + observations → plan),
 * so the whole cell is deterministic and side-effect-free; no processes, sockets, or /mnt material.
 *
 * Falsifiable claims under test, over a seeded family of observation worlds AND the scripted scenario:
 *   1. ENVELOPE CLOSURE — every planned step's action is in ENVELOPE; no FORBIDDEN action is ever expressible.
 *   2. RESTART-SAFE / PURE — plans and status derive ONLY from (policy, observations); replaying identical
 *      inputs yields byte-identical plans (no dependence on prior in-memory state).
 *   3. IDEMPOTENCE — once the observed world matches the target (all UP-OURS), planUp emits probes only.
 *   4. FOREIGN-OCCUPANT SAFETY — a port observed OCCUPIED-FOREIGN is only ever `isolate`d, never start/stop.
 *   5. SWAP DISCIPLINE — a candidate that fails its probe rolls back (old kept); one that verifies swaps then
 *      releases the old after grace. Neither path ever mutates the foreign/old process out of band.
 *   6. CONTRACTION RELEASE — releasing a contraction without explicit owner invocation is refused (throws).
 *   7. deriveStatus never grants authority.
 */
import {
  ENVELOPE, FORBIDDEN, classifyService, planUp, planDown, planSwap, planContract, deriveStatus,
} from '../../../supervisor/src/engine.mjs';
import { seededRng } from '../lib/prng.mjs';

export const CELL = 'e2-supervisor-lifecycle';

/** A representative organism policy (synthetic, independent of any policy.json on disk). */
const POLICY = Object.freeze({
  schema: 'aukora-supervisor-policy-v1',
  swap: { graceMs: 2000 },
  services: [
    { name: 'convex', phase: 0, port: 3210, external: true },
    { name: 'door', phase: 1, port: 7141, dependsOn: ['convex'] },
    { name: 'mind', phase: 2, port: 7097, dependsOn: ['door'] },
    { name: 'voice', phase: 2, port: 7098, dependsOn: ['door'], optional: true },
    { name: 'spatial', phase: 3, port: 7096, dependsOn: ['mind'], candidatePort: 7099 },
  ],
});
const INTERNAL = POLICY.services.filter((s) => !s.external);

const CLASSES = ['DOWN', 'UP-OURS', 'OCCUPIED-FOREIGN', 'UP-UNVERIFIED'];
const obsFor = (cls) => cls === 'DOWN' ? { portOpen: false, identityOk: null, pidKnown: false }
  : cls === 'UP-OURS' ? { portOpen: true, identityOk: true, pidKnown: true }
  : cls === 'OCCUPIED-FOREIGN' ? { portOpen: true, identityOk: false, pidKnown: false }
  : { portOpen: true, identityOk: null, pidKnown: false };

const randomWorld = (rng) => Object.fromEntries(POLICY.services.map((s) => [s.name, obsFor(rng.pick(CLASSES))]));
const allUp = () => Object.fromEntries(POLICY.services.map((s) => [s.name, obsFor('UP-OURS')]));
const stepsOk = (plan) => plan.every((p) => ENVELOPE.includes(p.action) && !FORBIDDEN.includes(p.action));
const forbiddenLeak = (plan) => plan.some((p) => FORBIDDEN.includes(p.action));

/** Foreign-occupant safety: no start/stop is ever planned against a service observed OCCUPIED-FOREIGN. */
function foreignSafe(plan, world) {
  for (const p of plan) {
    const cls = classifyService(POLICY.services.find((s) => s.name === p.service), world[p.service] ?? obsFor('DOWN'));
    if (cls === 'OCCUPIED-FOREIGN' && (p.action === 'start' || p.action === 'stop')) return false;
  }
  return true;
}

export async function run({ seed = 0x5c0f, worlds = 300 } = {}) {
  const rng = seededRng(seed);

  let envelopeViolations = 0, forbiddenLeaks = 0, foreignUnsafe = 0, impure = 0;

  // 1. Property sweep over random observation worlds.
  for (let i = 0; i < worlds; i++) {
    const world = randomWorld(rng);
    const up = planUp(POLICY, world);
    const down = planDown(POLICY, world);
    const status = deriveStatus(POLICY, world);

    if (!stepsOk(up) || !stepsOk(down)) envelopeViolations++;
    if (forbiddenLeak(up) || forbiddenLeak(down)) forbiddenLeaks++;
    if (!foreignSafe(up, world) || !foreignSafe(down, world)) foreignUnsafe++;

    // Purity / restart-safety: re-derive from the SAME inputs; identical output required.
    const up2 = planUp(POLICY, world);
    const status2 = deriveStatus(POLICY, world);
    if (JSON.stringify(up) !== JSON.stringify(up2) || JSON.stringify(status) !== JSON.stringify(status2)) impure++;
  }

  // 2. Scripted crash → restart → squatter → swap → rollback.
  const scenario = {};
  // 2a. cold boot from all-DOWN: phased starts, dependency-ordered.
  const cold = planUp(POLICY, Object.fromEntries(POLICY.services.map((s) => [s.name, obsFor('DOWN')])));
  scenario.coldBootStartsMind = cold.some((p) => p.action === 'start' && p.service === 'mind');
  scenario.coldBootProbesExternalConvex = cold.some((p) => p.action === 'probe' && p.service === 'convex' && p.external === true);
  // 2b. idempotence: all UP-OURS ⇒ probes only.
  const steady = planUp(POLICY, allUp());
  scenario.idempotentNoRestarts = steady.every((p) => p.action === 'probe' || p.action === 'status');
  // 2c. crash 'mind' mid-run ⇒ restart-safe recovery derives a start for JUST mind from observation.
  const crashed = { ...allUp(), mind: obsFor('DOWN') };
  const recover = planUp(POLICY, crashed);
  scenario.recoverRestartsMind = recover.some((p) => p.action === 'start' && p.service === 'mind');
  scenario.recoverDoesNotRestartHealthy = !recover.some((p) => p.action === 'start' && p.service === 'door');
  // 2d. squatter on spatial's port ⇒ isolate, never kill.
  const squat = { ...allUp(), spatial: obsFor('OCCUPIED-FOREIGN') };
  const squatPlan = planUp(POLICY, squat);
  scenario.squatterIsolated = squatPlan.some((p) => p.action === 'isolate' && p.service === 'spatial');
  scenario.squatterNeverKilled = !squatPlan.some((p) => (p.action === 'start' || p.action === 'stop') && p.service === 'spatial');
  // 2e. swap: candidate not yet probed ⇒ start+probe candidate.
  const swapProbe = planSwap(POLICY, 'spatial', null);
  scenario.swapBootsCandidate = swapProbe.some((p) => p.action === 'start' && p.candidate === true && p.port === 7099);
  // 2f. swap: candidate verifies ⇒ swap then release old after grace.
  const swapOk = planSwap(POLICY, 'spatial', obsFor('UP-OURS'));
  scenario.verifiedSwapReleasesOld = swapOk.some((p) => p.action === 'swap') && swapOk.some((p) => p.action === 'stop' && p.afterGraceMs === POLICY.swap.graceMs);
  // 2g. swap: candidate fails probe ⇒ rollback, old kept.
  const swapFail = planSwap(POLICY, 'spatial', obsFor('OCCUPIED-FOREIGN'));
  scenario.failedSwapRollsBack = swapFail.some((p) => p.action === 'rollback' && p.keep === 7096) && !swapFail.some((p) => p.action === 'swap');
  // 2h. contraction release without explicit owner ⇒ refused (throws).
  let releaseRefused = false;
  try { planContract(POLICY, 'spatial', { release: true, ownerExplicit: false }); } catch { releaseRefused = true; }
  scenario.contractionReleaseRequiresOwner = releaseRefused;
  // 2i. status never grants authority.
  scenario.statusNoAuthority = deriveStatus(POLICY, allUp()).grantsAuthority === false;

  const verdict = {
    envelopeClosed: envelopeViolations === 0,
    noForbiddenLeak: forbiddenLeaks === 0,
    foreignOccupantSafe: foreignUnsafe === 0,
    pureRestartSafe: impure === 0,
    scenarioAllHold: Object.values(scenario).every(Boolean),
  };
  verdict.pass = Object.values(verdict).every(Boolean);

  const core = {
    schema: 'aukora-conformance-core-v1',
    cell: CELL,
    title: 'supervisor lifecycle: envelope closure, restart-safety, foreign-occupant + swap discipline',
    seed, worlds,
    interfaces: ['@aukora/supervisor:engine.mjs'],
    envelope: [...ENVELOPE],
    forbidden: [...FORBIDDEN],
    counters: { envelopeViolations, forbiddenLeaks, foreignUnsafe, impure },
    scenario,
    verdict,
  };
  return { core, verdict };
}
