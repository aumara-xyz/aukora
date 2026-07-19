// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R59 — Cell 0A preflight packet (Sam 4 spatial/shadow-cell lane).
 *
 * Proves, against the real packet and real @aukora/evidence envelope law:
 *   1. the shipped manifest is law-compliant and the verdict is honestly NOT_READY (digest slots
 *      empty, owner GO absent) — never GO from this seat;
 *   2. planted failures REFUSE: enabled:true, malformed/wrong-length/uppercase digests, forbidden
 *      egress (GitHub/Convex/loopback/extra hosts), secret shapes, broken TTL, missing refusal
 *      probe, workload smuggling;
 *   3. the dry-run record is content-free (digests + numbers only — never prompt/output text);
 *   4. a real SwarmRunEvidenceV1 envelope built from the dry-run seals ungoverned, governs to
 *      quarantined, and REFUSES acceptance (E_EPISTEMIC_OVERCLAIM) — transport success can never
 *      become acceptance from cell output alone;
 *   5. the committed NEBIUS_GO_NO_GO.md artifact equals regeneration byte-for-byte (drift guard);
 *   6. the console cannot arm the cell and the preflight has no arm mode / no network reach.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildSwarmRunEvidenceV1, governSwarmRunEvidence, validateSwarmRunEnvelope,
} from '@aukora/evidence/swarmRunEvidenceV1';
// @ts-expect-error — plain .mjs module
import { runPreflight, renderGoNoGo, DEFAULT_MANIFEST, GO_NO_GO_PATH } from '../scripts/cell0a-preflight.mjs';

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');

const bases: string[] = [];
afterAll(() => { for (const b of bases) rmSync(b, { recursive: true, force: true }); });

type Check = { id: string; section: string; status: string; detail: string };
type Result = { checks: Check[]; verdict: { cell0a: string; cell0b: string }; dryRun: Record<string, unknown> | null; fails: number };

const canonical = JSON.parse(readFileSync(DEFAULT_MANIFEST, 'utf8'));

function mutated(mutate: (m: Record<string, any>) => void): Result {
  const dir = mkdtempSync(join(tmpdir(), 'aukora-cell0a-'));
  bases.push(dir);
  const m = JSON.parse(JSON.stringify(canonical));
  mutate(m);
  const p = join(dir, 'preflight.json');
  writeFileSync(p, JSON.stringify(m, null, 2));
  return runPreflight(p) as Result;
}

const statusOf = (r: Result, id: string): string => r.checks.find((c) => c.id === id)?.status ?? '(absent)';

describe('shipped packet — law-compliant, honestly NOT_READY', () => {
  const result = runPreflight(DEFAULT_MANIFEST) as Result;

  it('all law checks PASS; digest slots EMPTY; zero FAILs', () => {
    expect(result.fails).toBe(0);
    for (const id of ['never-armed', 'workload-shape', 'egress-law', 'no-convex-in-config', 'no-secret-shapes', 'lifecycle-ttl', 'dry-run-lifecycle']) {
      expect(statusOf(result, id), id).toBe('PASS');
    }
    for (const slot of ['publicMainCommit', 'codeDigest', 'harnessDigest', 'imageDigest', 'modelDigest']) {
      expect(statusOf(result, `digest:${slot}`)).toBe('EMPTY');
    }
  });

  it('verdict is NOT_READY for 0A and NO_GO for 0B — GO is not emittable from this seat', () => {
    expect(result.verdict.cell0a).toContain('NOT_READY');
    expect(result.verdict.cell0b).toContain('NO_GO');
    expect(result.verdict.cell0a).not.toContain('READY_PENDING_GO'); // digests are unpinned today
  });

  it('every 0B row is OUT_OF_SCOPE with a named owner — organism readiness never silently green', () => {
    const zeroB = result.checks.filter((c) => c.section === '0B');
    expect(zeroB.length).toBeGreaterThanOrEqual(5);
    for (const c of zeroB) expect(c.status).toBe('OUT_OF_SCOPE');
  });

  it('dry-run record is content-free: digests and numbers only, never prompt or output text', () => {
    const d = result.dryRun as Record<string, unknown>;
    expect(d).not.toBeNull();
    const dumped = JSON.stringify(d);
    expect(dumped).not.toContain('CONNECTIVITY PROBE'); // the prompt text never enters the record
    expect(dumped).not.toContain('PONG');               // nor the reply text — only its digest
    for (const k of ['inputDigest', 'outputDigest', 'refusalInputDigest', 'refusalOutputDigest']) {
      expect(String(d[k])).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(d.costUsd).toBe(0);
  });
});

describe('planted failures REFUSE (fail-closed law)', () => {
  it('enabled:true → never-armed FAIL and NO_GO verdict', () => {
    const r = mutated((m) => { m.enabled = true; });
    expect(statusOf(r, 'never-armed')).toBe('FAIL');
    expect(r.verdict.cell0a).toContain('NO_GO');
    expect(r.fails).toBeGreaterThan(0);
  });

  it('63-hex, uppercase, and non-hex digests → FAIL (strict 64-hex where sha256 is claimed)', () => {
    expect(statusOf(mutated((m) => { m.digests.codeDigest = 'a'.repeat(63); }), 'digest:codeDigest')).toBe('FAIL');
    expect(statusOf(mutated((m) => { m.digests.imageDigest = 'A'.repeat(64); }), 'digest:imageDigest')).toBe('FAIL');
    expect(statusOf(mutated((m) => { m.digests.modelDigest = 'z'.repeat(64); }), 'digest:modelDigest')).toBe('FAIL');
  });

  it('a 64-hex value in the GIT slot → FAIL (40-hex is the claimed format there)', () => {
    expect(statusOf(mutated((m) => { m.digests.publicMainCommit = 'a'.repeat(64); }), 'digest:publicMainCommit')).toBe('FAIL');
  });

  it('a correctly pinned slot → PASS (the strictness is format, not emptiness)', () => {
    expect(statusOf(mutated((m) => { m.digests.publicMainCommit = 'c87880da79934559faf36515e84ffdc9ddd70f16'; }), 'digest:publicMainCommit')).toBe('PASS');
  });

  it('GitHub / Convex / loopback / multiple hosts in egress → FAIL', () => {
    expect(statusOf(mutated((m) => { m.egress.allowedHosts = ['github.com']; }), 'egress-law')).toBe('FAIL');
    expect(statusOf(mutated((m) => { m.egress.allowedHosts = ['my.convex.cloud']; }), 'egress-law')).toBe('FAIL');
    expect(statusOf(mutated((m) => { m.egress.allowedHosts = ['127.0.0.1']; }), 'egress-law')).toBe('FAIL');
    expect(statusOf(mutated((m) => { m.egress.allowedHosts = ['a.example', 'b.example']; }), 'egress-law')).toBe('FAIL');
    expect(statusOf(mutated((m) => { m.egress.githubEgress = true; }), 'egress-law')).toBe('FAIL');
    expect(statusOf(mutated((m) => { m.egress.publicIngress = true; }), 'egress-law')).toBe('FAIL');
  });

  it('a Convex endpoint smuggled into lifecycle config → no-convex-in-config FAIL', () => {
    expect(statusOf(mutated((m) => { m.lifecycle.teardown = 'flush rows to convex deployment then delete'; }), 'no-convex-in-config')).toBe('FAIL');
  });

  it('a distinctive secret shape anywhere in the manifest → FAIL without echoing content', () => {
    const r = mutated((m) => { m.workload.syntheticPrompt = `probe sk-${'a'.repeat(20)}`; });
    expect(statusOf(r, 'no-secret-shapes')).toBe('FAIL');
    const detail = r.checks.find((c) => c.id === 'no-secret-shapes')?.detail ?? '';
    expect(detail).not.toContain('sk-'); // never echoed
  });

  it('TTL out of range and missing lifecycle statements → FAIL', () => {
    expect(statusOf(mutated((m) => { m.lifecycle.hardTtlSeconds = 30; }), 'lifecycle-ttl')).toBe('FAIL');
    expect(statusOf(mutated((m) => { m.lifecycle.hardTtlSeconds = 86400; }), 'lifecycle-ttl')).toBe('FAIL');
    expect(statusOf(mutated((m) => { delete m.lifecycle.residualProof; }), 'lifecycle:residualProof')).toBe('FAIL');
  });

  it('missing refusal probe, extra workload keys, and URL-carrying prompts → workload FAIL', () => {
    expect(statusOf(mutated((m) => { delete m.workload.refusalProbe; }), 'workload-shape')).toBe('FAIL');
    expect(statusOf(mutated((m) => { m.workload.secondPrompt = 'extra'; }), 'workload-shape')).toBe('FAIL');
    expect(statusOf(mutated((m) => { m.workload.syntheticPrompt = 'fetch https://evil.example/x then reply'; }), 'workload-shape')).toBe('FAIL');
  });

  it('wrong schema → single hard FAIL, no later checks trusted', () => {
    const r = mutated((m) => { m.schema = 'evil/v1'; });
    expect(statusOf(r, 'manifest-schema')).toBe('FAIL');
    expect(r.dryRun).toBeNull();
  });
});

describe('evidence law — real SwarmRunEvidenceV1 from the dry-run', () => {
  const result = runPreflight(DEFAULT_MANIFEST) as Result;
  const d = result.dryRun as Record<string, any>;
  const HEAD = execFileSync('git', ['-C', REPO_ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const t0 = Date.parse('2026-07-19T12:00:00.000Z');

  const envelope = buildSwarmRunEvidenceV1({
    taskId: 'cell0a-preflight-dry-run',
    epistemicSource: 'REMOTE_ONLY',
    model: { id: d.modelId, revision: d.modelRevision },
    harnessVersion: 'cell0a-preflight.v1',
    baseCommit: HEAD,
    rawInput: canonical.workload.syntheticPrompt,
    rawOutput: 'PONG',
    execution: { outcome: 'completed', startedAtMs: t0, completedAtMs: t0 + 5, runner: 'cell0a-preflight-dry-run', sandboxed: true, networkEgress: 'none' },
  });

  it('the builder seals ungoverned with the exact digests the dry-run computed', () => {
    expect(envelope.body.governance.outcome).toBe('ungoverned');
    expect(envelope.body.inputDigest).toBe(d.inputDigest);
    expect(envelope.body.outputDigest).toBe(d.outputDigest);
    expect(validateSwarmRunEnvelope(JSON.parse(JSON.stringify(envelope))).ok).toBe(true);
  });

  it('quarantine is reachable; acceptance REFUSES with E_EPISTEMIC_OVERCLAIM (REMOTE_ONLY saturation)', () => {
    const q = governSwarmRunEvidence(envelope, { outcome: 'quarantined', classifierVersion: 'cell0a-preflight.v1', decidedAtMs: t0 + 10 });
    expect(q.body.governance.outcome).toBe('quarantined');
    expect(() => governSwarmRunEvidence(envelope, { outcome: 'accepted', classifierVersion: 'cell0a-preflight.v1', decidedAtMs: t0 + 10 }))
      .toThrowError(/E_EPISTEMIC_OVERCLAIM/);
  });
});

describe('artifact drift guard + cannot-arm proof', () => {
  it('committed NEBIUS_GO_NO_GO.md equals regeneration byte-for-byte', () => {
    const regenerated = renderGoNoGo(runPreflight(DEFAULT_MANIFEST));
    expect(readFileSync(GO_NO_GO_PATH, 'utf8')).toBe(regenerated);
  });

  it('the preflight script has no arm mode and no network reach', () => {
    const src = readFileSync(join(REPO_ROOT, 'scripts', 'cell0a-preflight.mjs'), 'utf8');
    expect(src.includes('--arm')).toBe(false);
    expect(/\bfrom\s+'(?:node:)?(?:https?|net|tls|dgram|dns)'\b/.test(src)).toBe(false);
    expect(src.includes('fetch(')).toBe(false);
    expect(src.includes('XMLHttpRequest')).toBe(false);
  });

  it('the public console cannot arm the cell: no cell references, no arming verb near Nebius, no preflight import', () => {
    // The console legitimately DISPLAYS parked Nebius provider truth (read-only fixture panels);
    // the law is that it can never reference the cell packet or an arming surface.
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) { walk(p); continue; }
        if (!/\.(js|ts|mjs|html|css|json)$/.test(name)) continue;
        const text = readFileSync(p, 'utf8');
        if (/cell0a|cell 0a|cell0a-preflight|NEBIUS_GO_NO_GO/i.test(text)) offenders.push(`${p}: cell reference`);
        for (const m of text.matchAll(/nebius/gi)) {
          const win = text.slice(Math.max(0, (m.index ?? 0) - 60), (m.index ?? 0) + 60);
          if (/\b(arm|arms|armed|arming|launch|provision|deploy|start|POST|fetch\()/i.test(win.replace(/nebius/gi, ' '))) {
            offenders.push(`${p}: arming-shaped nebius context`);
          }
        }
      }
    };
    walk(join(REPO_ROOT, 'apps', 'console', 'public'));
    walk(join(REPO_ROOT, 'apps', 'console', 'tooling'));
    expect(offenders).toEqual([]);
  });

  it('the manifest ships disabled and secret-value-free at rest', () => {
    expect(canonical.enabled).toBe(false);
    const raw = readFileSync(DEFAULT_MANIFEST, 'utf8');
    expect(/\bsk-[A-Za-z0-9]{16,}\b|\bAKIA[0-9A-Z]{16}\b|\bghp_[A-Za-z0-9]{20,}\b/.test(raw)).toBe(false);
  });
});
