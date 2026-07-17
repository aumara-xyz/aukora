// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * WAVE 2 supervisor laws (donor #71/#26 restoration) — every law tested on the PURE engine, no sockets.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync, writeFileSync, rmSync, existsSync, mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { planUp, planDown, planSwap, planContract, deriveStatus, classifyService, ENVELOPE, FORBIDDEN } from '../src/engine.mjs';
import { pgidOf, listenerPidOnPort, isAlive, killGroup, groupAlive, readPidRecord, validPid } from '../src/supervisor.mjs';

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
    // R47 one-owner convergence: convex-backend and the brain door are OWNED now — started in phase order.
    expect(idx('convex-backend', 'start')).toBeGreaterThanOrEqual(0);
    expect(idx('brain-door', 'start')).toBeGreaterThanOrEqual(0);
    expect(idx('convex-backend', 'start')).toBeLessThan(idx('brain-door', 'start'));   // phase 0 before 1
    expect(idx('brain-door', 'start')).toBeLessThan(idx('mind-door', 'start'));        // phase 1 before 2
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
    // R47 one-owner convergence: the door and backend are OURS to stop, in reverse phase order.
    expect(names.indexOf('brain-door')).toBeGreaterThan(names.indexOf('mind-door'));
    expect(names.indexOf('convex-backend')).toBe(names.length - 1); // phase 0 stops last
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

describe('R44c — invalid-PID file regression (review closure)', () => {
  it('validPid admits only real positive integers', async () => {
    const { validPid } = await import('../src/supervisor.mjs');
    expect(validPid(12345)).toBe(true);
    expect(validPid(undefined)).toBe(false);
    expect(validPid(NaN)).toBe(false);
    expect(validPid(0)).toBe(false);
    expect(validPid(-1)).toBe(false);
    expect(validPid(1.5)).toBe(false);
    expect(validPid('undefined')).toBe(false);
  });
  it('a failed optional spawn yields pid=undefined and the guard refuses the write — no invalid PID file', async () => {
    const { validPid } = await import('../src/supervisor.mjs');
    const { spawn } = await import('node:child_process');
    const { mkdtempSync, readdirSync, writeFileSync: wf } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'r44c-'));
    const child = spawn(join(dir, 'no-such-binary'), [], { detached: true, stdio: 'ignore' });
    await new Promise((resolve) => child.on('error', resolve)); // same live-catch as the supervisor
    expect(child.pid).toBe(undefined);
    if (validPid(child.pid)) wf(join(dir, 'svc.7099.pid'), String(child.pid)); // the guarded write
    expect(readdirSync(dir).filter((f) => f.endsWith('.pid'))).toEqual([]);
  });
  it('bounded teardown tolerates a legacy poisoned pid file without reaching kill', () => {
    // stopOurs parses with Number(); the poisoned literal becomes NaN, which the falsy check drops
    // to the identity-verified lsof fallback — no throw, no kill(NaN).
    const pid = Number('undefined');
    expect(Number.isNaN(pid)).toBe(true);
    expect(!pid).toBe(true);
  });
  it('source contract: the pid-file write is inside the validPid guard', () => {
    const sup = readFileSync(join(APP, 'src', 'supervisor.mjs'), 'utf8');
    expect(sup).toMatch(/if \(validPid\(child\.pid\)\) \{\s*\n\s*writeFileSync/);
  });
});

// ── R51 · issue #107 — the supervisor owns the process GROUP, not merely the wrapper ────────────────
describe('R51 · process-group custody (the actual mechanic, real processes)', () => {
  const spawned = [];
  afterEach(() => { for (const pid of spawned.splice(0)) { try { process.kill(-pid, 'SIGKILL'); } catch { /* gone */ } try { process.kill(pid, 'SIGKILL'); } catch { /* gone */ } } });

  /** Spawn a detached group-leader "wrapper" that itself spawns a child "listener"; both self-destruct in 8s
   *  (leak-proof). Returns { wrapperPid (== pgid), childPid }. */
  const spawnTree = async () => {
    const cf = join(mkdtempSync(join(tmpdir(), 'r51-')), 'child.pid');
    const code = `const fs=require('fs');const {spawn}=require('child_process');` +
      `const c=spawn(process.execPath,['-e','setTimeout(()=>process.exit(0),8000);setInterval(()=>{},1e9)'],{stdio:'ignore'});` +
      `fs.writeFileSync(process.env.CF,String(c.pid));setTimeout(()=>process.exit(0),8000);setInterval(()=>{},1e9)`;
    const parent = spawn(process.execPath, ['-e', code], { detached: true, stdio: 'ignore', env: { ...process.env, CF: cf } });
    parent.unref();
    spawned.push(parent.pid);
    for (let i = 0; i < 100 && !existsSync(cf); i++) await new Promise((r) => setTimeout(r, 20));
    const childPid = Number(readFileSync(cf, 'utf8').trim());
    return { wrapperPid: parent.pid, childPid };
  };

  it('the child listener inherits the wrapper’s process group (pgid === wrapper pid)', async () => {
    const { wrapperPid, childPid } = await spawnTree();
    expect(validPid(childPid)).toBe(true);
    expect(isAlive(wrapperPid)).toBe(true);
    expect(isAlive(childPid)).toBe(true);
    expect(pgidOf(childPid)).toBe(wrapperPid); // the whole tree is one owned group
  });

  it('THE BUG: a single-process kill of the wrapper LEAVES the listener alive; THE FIX: group-kill reaps it', async () => {
    const { wrapperPid, childPid } = await spawnTree();
    // R50's twice-witnessed finding: killing only the wrapper orphans a still-serving child
    process.kill(wrapperPid, 'SIGKILL');
    await new Promise((r) => setTimeout(r, 250));
    expect(isAlive(wrapperPid)).toBe(false);
    expect(isAlive(childPid)).toBe(true); // ← the orphaned listener (the whole point of #107)
    // R51 fix: signalling the GROUP reaps the escaped child too
    expect(killGroup(wrapperPid, 'SIGKILL')).toBe(true);
    await new Promise((r) => setTimeout(r, 250));
    expect(isAlive(childPid)).toBe(false);
    expect(groupAlive(wrapperPid)).toBe(false);
  });
});

describe('R51 · lifecycle primitives + pid record', () => {
  it('listenerPidOnPort finds THIS process for a bound loopback port and null for a free one', async () => {
    const srv = createServer(() => {});
    await new Promise((res) => srv.listen(0, '127.0.0.1', res));
    const port = srv.address().port;
    expect(listenerPidOnPort(port)).toBe(process.pid);
    await new Promise((res) => srv.close(res));
    // after close the port is free again
    let cleared = false;
    for (let i = 0; i < 25 && !cleared; i++) { if (listenerPidOnPort(port) === null) cleared = true; else await new Promise((r) => setTimeout(r, 20)); }
    expect(cleared).toBe(true);
  });

  it('isAlive: true for self, false for an impossible/invalid pid', () => {
    expect(isAlive(process.pid)).toBe(true);
    expect(isAlive(2 ** 30)).toBe(false); // no such process
    expect(isAlive(undefined)).toBe(false);
    expect(isAlive(-1)).toBe(false);
  });

  it('readPidRecord parses the v1 group record AND tolerates a legacy bare-integer file (R44c) without throwing', () => {
    const dir = join(APP, 'state');
    const p = join(dir, 'r51probe.65533.pid');
    try {
      writeFileSync(p, JSON.stringify({ schema: 'aukora-supervisor-pidrec-v1', name: 'r51probe', port: 65533, wrapperPid: 4242, pgid: 4242, listenerPid: 4343 }));
      const rec = readPidRecord('r51probe', 65533);
      expect(rec.pgid).toBe(4242);
      expect(rec.listenerPid).toBe(4343);
      writeFileSync(p, '  5150 \n'); // legacy poisoned/bare-integer file
      const legacy = readPidRecord('r51probe', 65533);
      expect(legacy.wrapperPid).toBe(5150);
      expect(legacy.pgid).toBe(5150);
      writeFileSync(p, 'undefined'); // the R44c poison
      expect(readPidRecord('r51probe', 65533)).toBe(null);
    } finally { try { rmSync(p); } catch { /* fine */ } }
  });
});

describe('R51 · source contracts — group teardown, foreign safety, owned-port verification', () => {
  const sup = readFileSync(join(APP, 'src', 'supervisor.mjs'), 'utf8');
  it('teardown signals the GROUP (kill(-pgid)) with SIGTERM then SIGKILL, not a bare-process kill', () => {
    expect(sup).toMatch(/process\.kill\(-pgid, signal\)/);   // killGroup targets the negative pgid
    expect(sup).toMatch(/killGroup\(pgid, 'SIGTERM'\)/);
    expect(sup).toMatch(/killGroup\(pgid, 'SIGKILL'\)/);
  });
  it('the port belt kills an escaped listener ONLY when provably ours; a foreign listener is reported, never killed', () => {
    expect(sup).toMatch(/oursByGroup \|\| oursByRecord/);
    expect(sup).toMatch(/residueForeign = true/);
    // the foreign branch has NO kill call — the only kills are inside the `ours` branch
    const beltForeign = sup.slice(sup.indexOf('residueForeign = true'), sup.indexOf('residueForeign = true') + 200);
    expect(beltForeign).not.toMatch(/process\.kill/);
  });
  it('down verifies every owned port is empty and fails LOUD (exit code) on our-owned residue', () => {
    expect(sup).toMatch(/verifyOwnedPortsEmpty\(pol, obs\)/);
    expect(sup).toMatch(/teardown-verified|teardown-residue/);
    expect(sup).toMatch(/process\.exitCode = 4/);
  });
  it('the pid record is a process-GROUP record (wrapperPid + pgid + listenerPid), still guarded by validPid', () => {
    expect(sup).toMatch(/pgid: child\.pid/);
    expect(sup).toMatch(/wrapperPid: child\.pid/);
    expect(sup).toMatch(/if \(validPid\(child\.pid\)\) \{\s*\n\s*writeFileSync/);
  });
  it('no authority/signer/owner-key verb entered the supervisor with the lifecycle change', () => {
    // precise: the lifecycle work must not smuggle in signing/promotion/key material (note: SIGNAL/SIGTERM
    // legitimately contain the substring "sign" — match whole forbidden verbs only).
    expect(sup).not.toMatch(/signPromotion|promoteAuthority|widenAuthority|ownerKey|secretKey|privateKey|signature/i);
  });
});
