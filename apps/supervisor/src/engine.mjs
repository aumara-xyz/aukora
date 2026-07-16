// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * The PURE lifecycle engine (WAVE 2 — donor #71/#26 restoration).
 *
 * Deterministic policy in, bounded transitions out. No sockets, no processes, no clocks — the node
 * adapter (supervisor.mjs) observes the world and executes what this engine decides, so every law
 * here is unit-testable without side effects:
 *
 *   - the policy MANIFEST IS A CLAIM: plans are computed by reconciling the claim against OBSERVED
 *     facts (probes + receipts), never by trusting the manifest (or any model/UI/Convex output);
 *   - every transition is BOUNDED (an explicit finite plan), IDEMPOTENT (already-true steps plan to
 *     no-ops) and RESTART-SAFE (state is derived from observation, not from prior in-memory state);
 *   - the envelope is closed: the engine can only ever emit actions from policy.envelope.actions,
 *     and hard-refuses the forbidden set (sign/promote/widen-authority/… are not expressible);
 *   - phased boot with dependency ordering; readiness probes; candidate boot on the alternate port;
 *     probe-before-swap; the old process survives until the candidate verifies; failed swap → rollback;
 *   - stale-PID / port-squatting defense: a process is OURS only if the identity probe answers with
 *     the service's identityMarker — otherwise the port is OCCUPIED-FOREIGN and we refuse to touch it.
 */

export const ENGINE_SCHEMA = 'aukora-supervisor-engine-v1';

/** The closed action envelope. Anything not listed here cannot be planned. */
export const ENVELOPE = Object.freeze(['start', 'probe', 'stop', 'isolate', 'swap', 'contract', 'rollback', 'status']);
export const FORBIDDEN = Object.freeze(['sign', 'promote', 'widen-authority', 'change-kernel-law', 'release-contraction-silently', 'execute-manifest-content', 'route-aumlok']);

function step(action, service, detail = {}) {
  if (!ENVELOPE.includes(action)) throw new Error(`envelope violation: '${action}' is not a pre-authorized action`);
  return Object.freeze({ action, service, ...detail });
}

/**
 * Classify one observed port state against the policy claim.
 * observation: { portOpen: boolean, identityOk: boolean|null, pidKnown: boolean }
 */
export function classifyService(svc, obs) {
  if (!obs.portOpen) return 'DOWN';
  if (obs.identityOk === true) return 'UP-OURS';
  if (obs.identityOk === false) return 'OCCUPIED-FOREIGN'; // port squatter or a stale stranger — never killed
  return 'UP-UNVERIFIED';
}

/** Phased boot plan. Idempotent: services observed UP-OURS plan only a probe (a no-op start). */
export function planUp(policy, observations) {
  const plan = [];
  const phases = [...new Set(policy.services.map((s) => s.phase))].sort((a, b) => a - b);
  for (const phase of phases) {
    for (const svc of policy.services.filter((s) => s.phase === phase)) {
      const cls = classifyService(svc, observations[svc.name] ?? { portOpen: false, identityOk: null });
      if (cls === 'OCCUPIED-FOREIGN') { plan.push(step('isolate', svc.name, { reason: 'port occupied by a foreign process — refusing to adopt or kill it', port: svc.port })); continue; }
      if (svc.external) { plan.push(step('probe', svc.name, { external: true, port: svc.port })); continue; }
      // dependency ordering within the plan: deps must be UP-OURS or planned earlier
      for (const dep of svc.dependsOn ?? []) {
        const depCls = classifyService(policy.services.find((s) => s.name === dep), observations[dep] ?? { portOpen: false, identityOk: null });
        const depPlanned = plan.some((p) => p.service === dep && p.action === 'start');
        if (depCls !== 'UP-OURS' && !depPlanned) plan.push(step('start', dep, { reason: `dependency of ${svc.name}` }));
      }
      if (cls === 'UP-OURS') plan.push(step('probe', svc.name, { alreadyUp: true, port: svc.port }));
      else plan.push(step('start', svc.name, { port: svc.port }), step('probe', svc.name, { port: svc.port }));
    }
  }
  return dedupe(plan);
}

/** Clean-down plan: reverse phase order; foreign occupants and external deps are never touched. */
export function planDown(policy, observations) {
  const plan = [];
  const phases = [...new Set(policy.services.map((s) => s.phase))].sort((a, b) => b - a);
  for (const phase of phases) {
    for (const svc of policy.services.filter((s) => s.phase === phase)) {
      if (svc.external) continue;
      const cls = classifyService(svc, observations[svc.name] ?? { portOpen: false, identityOk: null });
      if (cls === 'UP-OURS') plan.push(step('stop', svc.name, { port: svc.port, gracefulStopMs: svc.gracefulStopMs ?? 1500 }));
      else if (cls === 'OCCUPIED-FOREIGN') plan.push(step('isolate', svc.name, { reason: 'foreign occupant left untouched on down', port: svc.port }));
      // DOWN → no-op (idempotent)
    }
  }
  return dedupe(plan);
}

/**
 * The #71 supervised swap: candidate boot on the alternate port → probe-before-swap → swap or rollback.
 * `candidateProbe` is an OBSERVED fact (null = not yet probed → plan the probe first).
 */
export function planSwap(policy, serviceName, candidateProbe) {
  const svc = policy.services.find((s) => s.name === serviceName);
  if (!svc) throw new Error(`unknown service '${serviceName}'`);
  if (!svc.candidatePort) throw new Error(`service '${serviceName}' has no candidatePort — swap is not pre-authorized for it`);
  if (candidateProbe === null || candidateProbe === undefined) {
    return dedupe([
      step('start', serviceName, { candidate: true, port: svc.candidatePort }),
      step('probe', serviceName, { candidate: true, port: svc.candidatePort }),
    ]);
  }
  if (candidateProbe.identityOk === true) {
    return dedupe([
      step('swap', serviceName, { from: svc.port, to: svc.candidatePort, graceMs: policy.swap.graceMs }),
      step('stop', serviceName, { port: svc.port, afterGraceMs: policy.swap.graceMs, reason: 'old process released after verified swap + grace' }),
    ]);
  }
  return dedupe([
    step('stop', serviceName, { candidate: true, port: svc.candidatePort, reason: 'candidate failed its probe' }),
    step('rollback', serviceName, { keep: svc.port, reason: 'failed swap — the old process never stopped serving' }),
  ]);
}

/** Contraction: isolate a service (stop routing/probing it) — and its release must be EXPLICIT. */
export function planContract(policy, serviceName, { release = false, ownerExplicit = false } = {}) {
  const svc = policy.services.find((s) => s.name === serviceName);
  if (!svc) throw new Error(`unknown service '${serviceName}'`);
  if (!release) return [step('contract', serviceName, { port: svc.port })];
  if (!ownerExplicit) throw new Error('envelope violation: releasing a contraction requires an explicit owner invocation — silent release is forbidden');
  return [step('status', serviceName, { contractionReleased: true, ownerExplicit: true })];
}

/** Status after crash / restart-safety: derive the whole picture from observation only. */
export function deriveStatus(policy, observations) {
  return Object.freeze({
    schema: ENGINE_SCHEMA,
    grantsAuthority: false,
    services: policy.services.map((svc) => ({
      name: svc.name,
      phase: svc.phase,
      port: svc.port,
      external: svc.external === true,
      optional: svc.optional === true,
      state: classifyService(svc, observations[svc.name] ?? { portOpen: false, identityOk: null }),
    })),
  });
}

function dedupe(plan) {
  const seen = new Set();
  return plan.filter((p) => { const k = p.action + '|' + p.service + '|' + (p.port ?? '') + '|' + (p.candidate ?? ''); if (seen.has(k)) return false; seen.add(k); return true; });
}
