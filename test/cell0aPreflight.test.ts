// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Cell 0A preflight packet (Sam 4 shadow-cell lane). R59 packet, HARDENED R60 for the Avengers M2
 * finding (duplicate keys, substring egress).
 *
 * Proves, against the real packet and real @aukora/evidence envelope law:
 *   1. the shipped manifest is law-compliant and honestly NOT_READY (digests + egress host empty);
 *   2. R60 planted failures REFUSE: duplicate JSON keys, unknown fields, secret-shaped KEY NAMES,
 *      canonical egress bypasses (IP/loopback/metadata/homoglyph/port/denied host), poisoned
 *      allowlist, digest not matching bound artifact bytes, structured-lifecycle tampers, dangling
 *      --manifest; plus the R59 set (enabled:true, bad digests, workload smuggling);
 *   3. dry-run record is content-free; real SwarmRunEvidenceV1 seals ungoverned → quarantined and
 *      REFUSES acceptance (E_EPISTEMIC_OVERCLAIM);
 *   4. NEBIUS_GO_NO_GO.md equals regeneration byte-for-byte; console cannot arm; no network reach.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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
const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

const bases: string[] = [];
afterAll(() => { for (const b of bases) rmSync(b, { recursive: true, force: true }); });

type Check = { id: string; section: string; status: string; detail: string };
type Result = { checks: Check[]; verdict: { cell0a: string; cell0b: string }; dryRun: Record<string, unknown> | null; fails: number };

const canonicalRaw = readFileSync(DEFAULT_MANIFEST, 'utf8');
const canonical = JSON.parse(canonicalRaw);

function writeTmp(text: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'aukora-cell0a-'));
  bases.push(dir);
  const p = join(dir, 'preflight.json');
  writeFileSync(p, text);
  return p;
}
/** Mutate the parsed object then re-serialize (loses duplicate keys — use rawMutate for those). */
function mutated(mutate: (m: Record<string, any>) => void): Result {
  const m = JSON.parse(JSON.stringify(canonical));
  mutate(m);
  return runPreflight(writeTmp(JSON.stringify(m, null, 2))) as Result;
}
/** Feed raw manifest text verbatim (for duplicate-key / malformed-JSON vectors). */
function rawMutate(text: string): Result {
  return runPreflight(writeTmp(text)) as Result;
}

const statusOf = (r: Result, id: string): string => r.checks.find((c) => c.id === id)?.status ?? '(absent)';

describe('shipped packet — hardened, law-compliant, honestly NOT_READY', () => {
  const result = runPreflight(DEFAULT_MANIFEST) as Result;

  it('all law checks PASS; digest slots + egress host EMPTY; zero FAILs', () => {
    expect(result.fails).toBe(0);
    for (const id of ['manifest-strict-parse', 'manifest-schema', 'no-unknown-fields', 'never-armed',
      'no-secret-key-names', 'digest-binding-shape', 'workload-shape', 'egress-flags', 'no-secret-shapes',
      'lifecycle-ttl', 'lifecycle:remoteKill', 'lifecycle:teardown', 'lifecycle:residualProof', 'dry-run-lifecycle']) {
      expect(statusOf(result, id), id).toBe('PASS');
    }
    for (const slot of ['publicMainCommit', 'codeDigest', 'harnessDigest', 'imageDigest', 'modelDigest']) {
      expect(statusOf(result, `digest:${slot}`)).toBe('EMPTY');
    }
    expect(statusOf(result, 'egress-hosts')).toBe('EMPTY');
  });

  it('verdict NOT_READY (0A) / NO_GO (0B); never READY_PENDING_GO from this seat', () => {
    expect(result.verdict.cell0a).toContain('NOT_READY');
    expect(result.verdict.cell0b).toContain('NO_GO');
    expect(result.verdict.cell0a).not.toContain('READY_PENDING_GO');
  });

  it('dry-run record is content-free: digests + numbers only, never prompt/output text', () => {
    const d = result.dryRun as Record<string, unknown>;
    const dumped = JSON.stringify(d);
    expect(dumped).not.toContain('CONNECTIVITY PROBE');
    expect(dumped).not.toContain('PONG');
    for (const k of ['inputDigest', 'outputDigest', 'refusalInputDigest', 'refusalOutputDigest']) expect(String(d[k])).toMatch(/^[0-9a-f]{64}$/);
    expect(d.costUsd).toBe(0);
  });
});

describe('R60 M2 hardening — planted failures REFUSE', () => {
  it('DUPLICATE JSON key (the enabled:false→true hide) → strict-parse FAIL', () => {
    const dup = canonicalRaw.replace('"enabled": false,', '"enabled": false,\n  "enabled": true,');
    const r = rawMutate(dup);
    expect(statusOf(r, 'manifest-strict-parse')).toBe('FAIL');
    expect(r.dryRun).toBeNull(); // refused before any later check ran
  });

  it('a duplicate key nested in egress → strict-parse FAIL', () => {
    const dup = canonicalRaw.replace('"allowedHosts": []', '"allowedHosts": [], "allowedHosts": ["evil.example"]');
    expect(statusOf(rawMutate(dup), 'manifest-strict-parse')).toBe('FAIL');
  });

  it('unknown top-level field → no-unknown-fields FAIL', () => {
    expect(statusOf(mutated((m) => { m.backdoor = true; }), 'no-unknown-fields')).toBe('FAIL');
  });

  it('secret-shaped KEY NAME anywhere → no-secret-key-names FAIL (name not echoed)', () => {
    const r = mutated((m) => { m.egress.api_key = 'x'; });
    expect(statusOf(r, 'no-secret-key-names')).toBe('FAIL');
    expect(r.checks.find((c) => c.id === 'no-secret-key-names')?.detail).not.toContain('api_key');
  });

  it('canonical egress bypasses REJECT (no substring decision): metadata/loopback/RFC1918/hex/homoglyph/denied/port', () => {
    for (const host of ['169.254.169.254', '127.0.0.1', '10.0.0.1', '0x7f000001', '[::1]',
      'аpi.provider.example', 'raw.githubusercontent.com', 'foo.convex.cloud', 'api.provider.example:8443', 'localhost']) {
      const r = mutated((m) => { m.egress.approvedProviderHosts = ['api.provider.example']; m.egress.allowedHosts = [host]; });
      expect(statusOf(r, 'egress-hosts'), host).toBe('FAIL');
    }
  });

  it('an exact allowlist member PASSES; a poisoned allowlist FAILS even with no host declared', () => {
    expect(statusOf(mutated((m) => { m.egress.approvedProviderHosts = ['api.provider.example']; m.egress.allowedHosts = ['api.provider.example']; }), 'egress-hosts')).toBe('PASS');
    expect(statusOf(mutated((m) => { m.egress.approvedProviderHosts = ['169.254.169.254']; m.egress.allowedHosts = []; }), 'egress-hosts')).toBe('FAIL');
    // a non-member host fails even if structurally valid
    expect(statusOf(mutated((m) => { m.egress.approvedProviderHosts = ['api.provider.example']; m.egress.allowedHosts = ['other.provider.example']; }), 'egress-hosts')).toBe('FAIL');
  });

  it('egress flags must be false; extra hosts FAIL', () => {
    expect(statusOf(mutated((m) => { m.egress.githubEgress = true; }), 'egress-flags')).toBe('FAIL');
    expect(statusOf(mutated((m) => { m.egress.publicIngress = true; }), 'egress-flags')).toBe('FAIL');
    expect(statusOf(mutated((m) => { m.egress.approvedProviderHosts = ['a.example', 'b.example']; m.egress.allowedHosts = ['a.example', 'b.example']; }), 'egress-hosts')).toBe('FAIL');
  });

  it('DIGEST BINDING teeth: harnessDigest must equal the bound file bytes', () => {
    const good = sha256(readFileSync(join(REPO_ROOT, 'scripts', 'cell0a-preflight.mjs'), 'utf8'));
    expect(statusOf(mutated((m) => { m.digests.harnessDigest = good; }), 'digest:harnessDigest')).toBe('PASS');
    expect(statusOf(mutated((m) => { m.digests.harnessDigest = 'a'.repeat(64); }), 'digest:harnessDigest')).toBe('FAIL'); // format-valid but wrong bytes
  });

  it('digest binding completeness: an orphan binding or missing binding FAILS', () => {
    expect(statusOf(mutated((m) => { m.artifactBindings.ghost = { kind: 'external-oci', identity: 'x' }; }), 'digest-binding-shape')).toBe('FAIL');
    expect(statusOf(mutated((m) => { delete m.artifactBindings.modelDigest; }), 'digest-binding-shape')).toBe('FAIL');
  });

  it('structured lifecycle tampers FAIL (teardown must delete ephemeral-keys, same session)', () => {
    expect(statusOf(mutated((m) => { m.lifecycle.teardown.deletes = ['instance', 'volumes']; }), 'lifecycle:teardown')).toBe('FAIL');
    expect(statusOf(mutated((m) => { m.lifecycle.teardown.sameSessionAsCreate = false; }), 'lifecycle:teardown')).toBe('FAIL');
    expect(statusOf(mutated((m) => { m.lifecycle.remoteKill.maxSeconds = 9999; }), 'lifecycle:remoteKill')).toBe('FAIL');
    expect(statusOf(mutated((m) => { m.lifecycle.residualProof.hashedIntoReport = false; }), 'lifecycle:residualProof')).toBe('FAIL');
  });

  it('R59-class failures still refuse: enabled:true, bad digest lengths, workload smuggling, wrong schema', () => {
    expect(statusOf(mutated((m) => { m.enabled = true; }), 'never-armed')).toBe('FAIL');
    expect(statusOf(mutated((m) => { m.digests.codeDigest = 'a'.repeat(63); }), 'digest:codeDigest')).toBe('FAIL');
    expect(statusOf(mutated((m) => { m.digests.publicMainCommit = 'a'.repeat(64); }), 'digest:publicMainCommit')).toBe('FAIL');
    expect(statusOf(mutated((m) => { delete m.workload.refusalProbe; }), 'workload-shape')).toBe('FAIL');
    expect(statusOf(mutated((m) => { m.workload.syntheticPrompt = 'fetch https://evil.example/x'; }), 'workload-shape')).toBe('FAIL');
    const r = mutated((m) => { m.schema = 'evil/v1'; });
    expect(statusOf(r, 'manifest-schema')).toBe('FAIL');
    expect(r.dryRun).toBeNull();
  });

  it('a distinctive secret VALUE shape → no-secret-shapes FAIL without echo', () => {
    const r = mutated((m) => { m.workload.syntheticPrompt = `probe sk-${'a'.repeat(20)}`; });
    expect(statusOf(r, 'no-secret-shapes')).toBe('FAIL');
    expect(r.checks.find((c) => c.id === 'no-secret-shapes')?.detail).not.toContain('sk-');
  });

  it('dangling --manifest exits non-zero (CLI arg hardening)', () => {
    const run = (args: string[]): number => {
      try { execFileSync(process.execPath, [join(REPO_ROOT, 'scripts', 'cell0a-preflight.mjs'), ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); return 0; }
      catch (e) { return (e as { status?: number }).status ?? -1; }
    };
    expect(run(['--manifest'])).not.toBe(0);
    expect(run(['--manifest', '--emit-go-no-go'])).not.toBe(0);
  });
});

describe('evidence law — real SwarmRunEvidenceV1 from the dry-run', () => {
  const result = runPreflight(DEFAULT_MANIFEST) as Result;
  const d = result.dryRun as Record<string, any>;
  const HEAD = execFileSync('git', ['-C', REPO_ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const t0 = Date.parse('2026-07-19T12:00:00.000Z');
  const envelope = buildSwarmRunEvidenceV1({
    taskId: 'cell0a-preflight-dry-run', epistemicSource: 'REMOTE_ONLY',
    model: { id: d.modelId, revision: d.modelRevision }, harnessVersion: 'cell0a-preflight.v1',
    baseCommit: HEAD, rawInput: canonical.workload.syntheticPrompt, rawOutput: 'PONG',
    execution: { outcome: 'completed', startedAtMs: t0, completedAtMs: t0 + 5, runner: 'cell0a-preflight-dry-run', sandboxed: true, networkEgress: 'none' },
  });

  it('seals ungoverned with the exact dry-run digests', () => {
    expect(envelope.body.governance.outcome).toBe('ungoverned');
    expect(envelope.body.inputDigest).toBe(d.inputDigest);
    expect(validateSwarmRunEnvelope(JSON.parse(JSON.stringify(envelope))).ok).toBe(true);
  });

  it('quarantine reachable; acceptance REFUSES E_EPISTEMIC_OVERCLAIM (REMOTE_ONLY saturation)', () => {
    expect(governSwarmRunEvidence(envelope, { outcome: 'quarantined', classifierVersion: 'cell0a-preflight.v1', decidedAtMs: t0 + 10 }).body.governance.outcome).toBe('quarantined');
    expect(() => governSwarmRunEvidence(envelope, { outcome: 'accepted', classifierVersion: 'cell0a-preflight.v1', decidedAtMs: t0 + 10 })).toThrowError(/E_EPISTEMIC_OVERCLAIM/);
  });
});

describe('artifact drift guard + cannot-arm proof', () => {
  it('committed NEBIUS_GO_NO_GO.md equals regeneration byte-for-byte', () => {
    expect(readFileSync(GO_NO_GO_PATH, 'utf8')).toBe(renderGoNoGo(runPreflight(DEFAULT_MANIFEST)));
  });

  it('preflight + egress + strict-json scripts have no arm mode and no network reach', () => {
    for (const f of ['cell0a-preflight.mjs', 'cell0a-egress.mjs', 'strict-json.mjs']) {
      const src = readFileSync(join(REPO_ROOT, 'scripts', f), 'utf8');
      expect(src.includes('--arm'), f).toBe(false);
      expect(/\bfrom\s+'(?:node:)?(?:https?|net|tls|dgram|dns)'\b/.test(src), f).toBe(false);
      expect(src.includes('fetch('), f).toBe(false);
    }
  });

  it('the public console cannot arm the cell (read-only Nebius truth display stays legal)', () => {
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
          if (/\b(arm|arms|armed|arming|launch|provision|deploy|start|POST|fetch\()/i.test(win.replace(/nebius/gi, ' '))) offenders.push(`${p}: arming-shaped nebius context`);
        }
      }
    };
    walk(join(REPO_ROOT, 'apps', 'console', 'public'));
    walk(join(REPO_ROOT, 'apps', 'console', 'tooling'));
    expect(offenders).toEqual([]);
  });

  it('the manifest ships disabled and secret-value-free at rest', () => {
    expect(canonical.enabled).toBe(false);
    expect(/\bsk-[A-Za-z0-9]{16,}\b|\bAKIA[0-9A-Z]{16}\b|\bghp_[A-Za-z0-9]{20,}\b/.test(canonicalRaw)).toBe(false);
  });
});
