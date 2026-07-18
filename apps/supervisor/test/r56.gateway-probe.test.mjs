// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R56 brick 3 — the gateway verifies its upstream shell port through policy + supervisor-owned identity + a
 * live probe, instead of blindly trusting `state.json`. The docblock promised "trusts probes, not files"; the
 * code did not. Proven here over injected deps (deterministic) plus one real HTTP probe:
 *   - a malformed / refused(AUMLOK) / foreign / unowned / non-listening / foreign-listener / dead / identity-
 *     mismatched projection is REFUSED with its exact reason (never proxied);
 *   - a supervisor-owned, in-policy, live, identity-probed shell VERIFIES (policy port and post-swap candidate);
 *   - the real probe distinguishes a marker-matching upstream from a mismatched one.
 */
import { describe, it, expect } from 'vitest';
import { createServer } from 'node:http';
import { resolveUpstreamShellPort } from '../src/gateway.mjs';

const POLICY = {
  services: [{ name: 'spatial-shell', port: 7096, candidatePort: 7099, probePath: '/api/models', identityMarker: 'model-free-memory-fallback' }],
  gateway: { refusedUpstreams: [7094, 7095] },
};
const OWNED_PID = 4242;
const OWNED_PGID = 4242;

/** Deps for a HEALTHY owned shell on `port`; each field overridable to model one hostile/degraded condition. */
function deps(over = {}) {
  return {
    policy: POLICY,
    readState: () => ({ services: { 'spatial-shell': { activePort: 7096 } } }),
    readPidRecord: () => ({ schema: 'aukora-supervisor-pidrec-v1', name: 'spatial-shell', port: 7096, wrapperPid: OWNED_PID, pgid: OWNED_PGID, listenerPid: OWNED_PID }),
    listenerPidOnPort: () => OWNED_PID,
    isAlive: () => true,
    pgidOf: () => OWNED_PGID,
    probe: async () => ({ portOpen: true, identityOk: true }),
    ...over,
  };
}

describe('R56 · gateway upstream verification — trusts probes + owned identity, not the state file', () => {
  it('HAPPY: a supervisor-owned, in-policy, live, identity-probed shell VERIFIES', async () => {
    expect(await resolveUpstreamShellPort(deps())).toEqual({ ok: true, port: 7096 });
  });

  it('a post-swap CANDIDATE port (in policy) also verifies', async () => {
    const r = await resolveUpstreamShellPort(deps({
      readState: () => ({ services: { 'spatial-shell': { activePort: 7099 } } }),
      readPidRecord: () => ({ schema: 'aukora-supervisor-pidrec-v1', name: 'spatial-shell', port: 7099, wrapperPid: OWNED_PID, pgid: OWNED_PGID, listenerPid: OWNED_PID }),
    }));
    expect(r).toEqual({ ok: true, port: 7099 });
  });

  it('MALFORMED claim → refused (a null/absent claim legitimately falls back to the policy default instead)', async () => {
    for (const bad of ['nope', -1, 0, 70000, 1.5]) {
      const r = await resolveUpstreamShellPort(deps({ readState: () => ({ services: { 'spatial-shell': { activePort: bad } } }) }));
      expect(r, `claim=${bad}`).toEqual({ ok: false, reason: 'gateway:upstream-port-malformed' });
    }
    // an absent/null activePort is NOT malformed — it means "no swap; use the policy default port"
    const dflt = await resolveUpstreamShellPort(deps({ readState: () => ({ services: { 'spatial-shell': { activePort: null } } }) }));
    expect(dflt).toEqual({ ok: true, port: 7096 });
  });

  it('a REFUSED/AUMLOK port (7094/7095) is never fronted', async () => {
    for (const aumlok of [7094, 7095]) {
      const r = await resolveUpstreamShellPort(deps({ readState: () => ({ services: { 'spatial-shell': { activePort: aumlok } } }) }));
      expect(r, `aumlok=${aumlok}`).toEqual({ ok: false, reason: 'gateway:upstream-refused-port' });
    }
  });

  it('a FOREIGN port not in the shell policy is refused', async () => {
    const r = await resolveUpstreamShellPort(deps({ readState: () => ({ services: { 'spatial-shell': { activePort: 9999 } } }) }));
    expect(r).toEqual({ ok: false, reason: 'gateway:upstream-port-not-in-policy' });
  });

  it('an UNOWNED claim (no supervisor pid record) is refused — the port is not ours', async () => {
    const r = await resolveUpstreamShellPort(deps({ readPidRecord: () => null }));
    expect(r).toEqual({ ok: false, reason: 'gateway:upstream-unowned' });
  });

  it('a NON-LISTENING owned port is refused', async () => {
    const r = await resolveUpstreamShellPort(deps({ listenerPidOnPort: () => null }));
    expect(r).toEqual({ ok: false, reason: 'gateway:upstream-not-listening' });
  });

  it('a FOREIGN listener on our port (not owned, wrong pgid) is refused', async () => {
    const r = await resolveUpstreamShellPort(deps({ listenerPidOnPort: () => 9001, pgidOf: () => 9001 }));
    expect(r).toEqual({ ok: false, reason: 'gateway:upstream-foreign-listener' });
  });

  it('a listener adopted into the OWNED process group (child of the wrapper) is accepted', async () => {
    // the true listener pid differs from the recorded wrapper, but shares the owned pgid → ours
    const r = await resolveUpstreamShellPort(deps({ listenerPidOnPort: () => 5555, pgidOf: () => OWNED_PGID }));
    expect(r).toEqual({ ok: true, port: 7096 });
  });

  it('a DEAD owner is refused (stale)', async () => {
    const r = await resolveUpstreamShellPort(deps({ isAlive: () => false }));
    expect(r).toEqual({ ok: false, reason: 'gateway:upstream-owner-dead' });
  });

  it('an IDENTITY-MISMATCHED probe is refused (right port, wrong service)', async () => {
    const r = await resolveUpstreamShellPort(deps({ probe: async () => ({ portOpen: true, identityOk: false }) }));
    expect(r).toEqual({ ok: false, reason: 'gateway:upstream-identity-mismatch' });
  });

  it('a probe that cannot open the port is refused', async () => {
    const r = await resolveUpstreamShellPort(deps({ probe: async () => ({ portOpen: false, identityOk: null }) }));
    expect(r).toEqual({ ok: false, reason: 'gateway:upstream-not-listening' });
  });

  it('REAL PROBE: a live server answering the marker verifies; a marker-mismatched one is refused', async () => {
    const realProbe = (marker) => async (port, path) => {
      try {
        const res = await fetch(`http://127.0.0.1:${port}${path}`, { signal: AbortSignal.timeout(2000) });
        const text = await res.text();
        return { portOpen: true, identityOk: text.includes(marker) };
      } catch { return { portOpen: false, identityOk: null }; }
    };
    // a real HTTP listener that returns the shell identity marker
    const good = createServer((_req, res) => res.end(JSON.stringify({ mode: 'model-free-memory-fallback' })));
    await new Promise((r) => good.listen(0, '127.0.0.1', r));
    const goodPort = good.address().port;
    try {
      const verified = await resolveUpstreamShellPort(deps({
        policy: { ...POLICY, services: [{ ...POLICY.services[0], port: goodPort }] },
        readState: () => ({ services: { 'spatial-shell': { activePort: goodPort } } }),
        readPidRecord: () => ({ schema: 'aukora-supervisor-pidrec-v1', name: 'spatial-shell', port: goodPort, wrapperPid: OWNED_PID, pgid: OWNED_PGID, listenerPid: OWNED_PID }),
        probe: realProbe('model-free-memory-fallback'),
      }));
      expect(verified).toEqual({ ok: true, port: goodPort });
      const wrong = await resolveUpstreamShellPort(deps({
        policy: { ...POLICY, services: [{ ...POLICY.services[0], port: goodPort }] },
        readState: () => ({ services: { 'spatial-shell': { activePort: goodPort } } }),
        readPidRecord: () => ({ schema: 'aukora-supervisor-pidrec-v1', name: 'spatial-shell', port: goodPort, wrapperPid: OWNED_PID, pgid: OWNED_PGID, listenerPid: OWNED_PID }),
        probe: realProbe('some-other-service-marker'),
      }));
      expect(wrong).toEqual({ ok: false, reason: 'gateway:upstream-identity-mismatch' });
    } finally {
      await new Promise((r) => good.close(r));
    }
  });
});
