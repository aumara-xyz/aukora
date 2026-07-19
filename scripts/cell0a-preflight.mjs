#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
//
// Cell 0A preflight gate (R59; HARDENED R60 for the Avengers M2 finding). Validates the deployable
// connectivity-smoke packet `cell0a/preflight.json` FAIL-CLOSED, executes an OFFLINE dry-run of the
// content-free evidence lifecycle (local stub — zero network, zero provider), and renders the
// canonical `docs/nebius/NEBIUS_GO_NO_GO.md` artifact from executable check results only.
//
// R60 hardening (all offline, no provider call):
//   - STRICT JSON: duplicate keys at any depth are rejected before any check reads the object
//     (`scripts/strict-json.mjs`); `--manifest` with a missing/dangling value exits non-zero.
//   - REAL EGRESS: `scripts/cell0a-egress.mjs` canonically parses hosts (scheme/userinfo/path/port,
//     IP literals in every notation, IDNA/homoglyph) and requires EXACT approvedProviderHosts
//     membership — no substring security decision anywhere.
//   - DIGEST BINDING: each non-empty digest slot binds to a declared artifact identity; the one
//     in-repo binding (`harnessDigest` → this file) is recomputed and must match — a format-valid
//     but arbitrary digest fails.
//   - STRUCTURED LIFECYCLE: TTL/remote-kill/teardown/residual-proof are typed, falsifiable evidence.
//   - SECRET-NAME LEAK: secret-shaped KEY NAMES anywhere in the manifest fail; detail messages never
//     echo manifest values.
//
// HARD LAWS (unchanged): no arm mode, no network I/O; `enabled` must be false; verdict can never
// exceed READY_PENDING_GO from this seat.
//
// Usage: node scripts/cell0a-preflight.mjs [--manifest <path>] [--emit-go-no-go [path]]
import { readFileSync, writeFileSync, realpathSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseStrict, StrictJsonError } from './strict-json.mjs';
import { classifyEgressHost, canonicalizeHost } from './cell0a-egress.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_MANIFEST = join(REPO_ROOT, 'cell0a', 'preflight.json');
export const GO_NO_GO_PATH = join(REPO_ROOT, 'docs', 'nebius', 'NEBIUS_GO_NO_GO.md');

const GIT_SHA_RE = /^[0-9a-f]{40}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

const SECRET_SHAPES = [
  /\bsk-[A-Za-z0-9]{16,}\b/, /\bAKIA[0-9A-Z]{16}\b/, /\bghp_[A-Za-z0-9]{20,}\b/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /\bBearer\s+[A-Za-z0-9._-]{16,}\b/,
];
// Secret-shaped KEY NAMES (R60): a manifest must never carry a field whose name implies a secret.
const SECRET_KEY_NAME = /(?:^|[_-])(?:api[_-]?key|secret|token|password|passwd|credential|priv(?:ate)?[_-]?key|bearer|access[_-]?key)(?:$|[_-])|(?:apikey|secretkey)/i;

const ALLOWED_BINDING_KINDS = new Set(['git-commit', 'file-sha256', 'external-code', 'external-oci', 'external-model']);

function offlineStub(prompt, refusalProbe) {
  return {
    promptReply: 'PONG',
    refusalReply: 'REFUSED: this cell does not disclose credentials or secret values.',
    promptEcho: prompt.length,
    probeEcho: refusalProbe.length,
  };
}
const countTokens = (s) => s.split(/\s+/).filter(Boolean).length;

/** Recursively collect every object key name in the parsed manifest. */
function allKeys(value, out = []) {
  if (Array.isArray(value)) { for (const v of value) allKeys(v, out); }
  else if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) { out.push(k); allKeys(value[k], out); }
  }
  return out;
}

/** Run every check. Returns { checks, verdict, dryRun, manifestDigest, fails }. */
export function runPreflight(manifestPath = DEFAULT_MANIFEST) {
  const checks = [];
  const add = (id, status, detail) => { checks.push({ id, section: '0A', status, detail }); };

  let raw = '';
  try {
    raw = readFileSync(manifestPath, 'utf8');
  } catch (e) {
    add('manifest-readable', 'FAIL', `unreadable manifest (${e instanceof Error ? e.message.slice(0, 120) : 'unknown'})`);
    return finish(checks, null, null);
  }
  const manifestDigest = sha256(raw);

  // R60: strict parse — duplicate keys / trailing content / control chars refuse before any check.
  let m = null;
  try {
    m = parseStrict(raw);
  } catch (e) {
    const why = e instanceof StrictJsonError ? e.message.slice(0, 140) : 'invalid JSON';
    add('manifest-strict-parse', 'FAIL', `strict JSON parse refused (${why})`);
    return finish(checks, null, manifestDigest);
  }
  if (!m || typeof m !== 'object' || Array.isArray(m)) {
    add('manifest-strict-parse', 'FAIL', 'manifest root is not a JSON object');
    return finish(checks, null, manifestDigest);
  }
  add('manifest-strict-parse', 'PASS', `no duplicate keys; sha256 ${manifestDigest.slice(0, 16)}…`);

  if (m.schema !== 'aukora-cell0a-preflight/v1' || m.version !== 1 || m.cell !== '0A') {
    add('manifest-schema', 'FAIL', 'schema/version/cell must be aukora-cell0a-preflight/v1 · 1 · 0A');
    return finish(checks, null, manifestDigest);
  }
  add('manifest-schema', 'PASS', 'aukora-cell0a-preflight/v1');

  // R60: unknown top-level fields fail (schema drift is fail-closed).
  const KNOWN_TOP = new Set(['schema', 'version', 'enabled', 'cell', 'purpose', 'armingLaw', 'digests', 'artifactBindings', 'workload', 'egress', 'lifecycle', 'evidence']);
  const unknownTop = Object.keys(m).filter((k) => !KNOWN_TOP.has(k));
  if (unknownTop.length > 0) add('no-unknown-fields', 'FAIL', `unknown top-level field(s): ${unknownTop.join(', ').slice(0, 100)}`);
  else add('no-unknown-fields', 'PASS', 'only known top-level fields');

  // 1. NEVER-ARMED LAW.
  if (m.enabled !== false) add('never-armed', 'FAIL', 'enabled must be literally false — arming is an issue-15 owner GO on a deployed copy, never a repository state');
  else add('never-armed', 'PASS', 'enabled === false');

  // R60: secret-shaped KEY NAMES anywhere in the manifest.
  const secretKey = allKeys(m).find((k) => SECRET_KEY_NAME.test(k));
  if (secretKey) add('no-secret-key-names', 'FAIL', 'a secret-shaped field NAME is present (name not shown)');
  else add('no-secret-key-names', 'PASS', 'no secret-shaped field names');

  // 2. DIGEST SLOTS + BINDINGS.
  const digests = (m.digests && typeof m.digests === 'object' && !Array.isArray(m.digests)) ? m.digests : {};
  const bindings = (m.artifactBindings && typeof m.artifactBindings === 'object' && !Array.isArray(m.artifactBindings)) ? m.artifactBindings : {};
  const slotSpecs = [
    ['publicMainCommit', GIT_SHA_RE, '40-lowercase-hex git commit'],
    ['codeDigest', SHA256_RE, '64-lowercase-hex sha256'],
    ['harnessDigest', SHA256_RE, '64-lowercase-hex sha256'],
    ['imageDigest', SHA256_RE, '64-lowercase-hex sha256'],
    ['modelDigest', SHA256_RE, '64-lowercase-hex sha256'],
  ];
  const slotNames = new Set(slotSpecs.map(([s]) => s));
  let emptySlots = 0;
  // binding completeness: every binding names a real slot; every slot has a binding.
  const orphanBindings = Object.keys(bindings).filter((k) => !slotNames.has(k));
  if (orphanBindings.length > 0) add('digest-binding-shape', 'FAIL', `artifactBindings names non-slot(s): ${orphanBindings.join(', ').slice(0, 80)}`);
  else if (!slotSpecs.every(([s]) => bindings[s] && typeof bindings[s] === 'object')) add('digest-binding-shape', 'FAIL', 'every digest slot requires an artifactBindings entry');
  else if (!slotSpecs.every(([s]) => ALLOWED_BINDING_KINDS.has(bindings[s].kind) && typeof bindings[s].identity === 'string' && bindings[s].identity.length > 0)) add('digest-binding-shape', 'FAIL', 'each binding needs a known kind + non-empty identity');
  else add('digest-binding-shape', 'PASS', 'every slot has a typed binding with a declared identity');

  for (const [slot, re, want] of slotSpecs) {
    const v = digests[slot];
    const b = bindings[slot] ?? {};
    if (typeof v !== 'string') { add(`digest:${slot}`, 'FAIL', `missing slot (${want})`); continue; }
    if (v === '') { emptySlots += 1; add(`digest:${slot}`, 'EMPTY', `unpinned (${want})`); continue; }
    if (!re.test(v)) { add(`digest:${slot}`, 'FAIL', `malformed — expected ${want}`); continue; }
    // R60 binding teeth: a file-sha256 binding must match the actual bytes of the bound in-repo file.
    if (b.kind === 'file-sha256' && typeof b.boundTo === 'string') {
      const safeRel = normalize(b.boundTo);
      if (safeRel.startsWith('..') || safeRel.startsWith('/')) { add(`digest:${slot}`, 'FAIL', 'binding boundTo escapes the repository'); continue; }
      const boundPath = join(REPO_ROOT, safeRel);
      let actual = null;
      try { actual = sha256(readFileSync(boundPath, 'utf8')); } catch { /* missing file */ }
      if (actual === null) add(`digest:${slot}`, 'FAIL', `bound artifact ${safeRel} unreadable`);
      else if (actual !== v) add(`digest:${slot}`, 'FAIL', `digest does not match bound artifact bytes (${safeRel})`);
      else add(`digest:${slot}`, 'PASS', `matches bound bytes of ${safeRel}`);
    } else {
      add(`digest:${slot}`, 'PASS', `${v.slice(0, 16)}… (external identity — verified at deploy)`);
    }
  }

  // 3. WORKLOAD.
  const w = (m.workload && typeof m.workload === 'object' && !Array.isArray(m.workload)) ? m.workload : {};
  const promptOk = typeof w.syntheticPrompt === 'string' && w.syntheticPrompt.length > 0;
  const probeOk = typeof w.refusalProbe === 'string' && w.refusalProbe.length > 0;
  const extraKeys = Object.keys(w).filter((k) => !['syntheticPrompt', 'refusalProbe', 'expected'].includes(k));
  if (!promptOk || !probeOk || extraKeys.length > 0) add('workload-shape', 'FAIL', `exactly one syntheticPrompt + one refusalProbe (+expected) required${extraKeys.length ? ` — unexpected: ${extraKeys.join(',')}` : ''}`);
  else if (/https?:\/\//i.test(w.syntheticPrompt + w.refusalProbe)) add('workload-shape', 'FAIL', 'workload prompts must not carry URLs');
  else add('workload-shape', 'PASS', 'one inert prompt + one refusal probe');

  // 4. EGRESS — real canonical validation (R60). No substring decisions.
  const egress = (m.egress && typeof m.egress === 'object' && !Array.isArray(m.egress)) ? m.egress : {};
  const approved = egress.approvedProviderHosts;
  const hosts = egress.allowedHosts;
  if (egress.publicIngress !== false || egress.githubEgress !== false) {
    add('egress-flags', 'FAIL', 'publicIngress and githubEgress must both be false');
  } else add('egress-flags', 'PASS', 'publicIngress:false githubEgress:false');

  if (!Array.isArray(approved) || !Array.isArray(hosts)) {
    add('egress-hosts', 'FAIL', 'approvedProviderHosts and allowedHosts must both be arrays');
  } else if (hosts.length > 1) {
    add('egress-hosts', 'FAIL', 'at most ONE allowed egress host');
  } else if (hosts.length === 0) {
    // canonicalize each allowlist member directly so a poisoned allowlist still fails even with no
    // host declared (an IP/denied/malformed member is refused regardless of any allowedHosts entry).
    const bad = approved.map((a) => ({ a, r: canonicalizeHost(String(a)) })).find((x) => !x.r.ok);
    if (approved.length > 0 && bad) add('egress-hosts', 'FAIL', `approvedProviderHosts entry ${JSON.stringify(String(bad.a).slice(0, 60))} is invalid (${bad.r.code})`);
    else { emptySlots += 1; add('egress-hosts', 'EMPTY', 'no egress host declared (allowedHosts empty) — NOT_READY'); }
  } else {
    const verdict = classifyEgressHost(String(hosts[0]), approved);
    if (verdict.ok) add('egress-hosts', 'PASS', `egress host ${verdict.host} is an exact allowlist member`);
    else add('egress-hosts', 'FAIL', `egress host rejected (${verdict.code}): ${verdict.detail}`);
  }

  // 5. SECRET SHAPES (values).
  const secretHit = SECRET_SHAPES.find((re) => re.test(raw));
  if (secretHit) add('no-secret-shapes', 'FAIL', 'a distinctive secret shape is present in the manifest (content not shown)');
  else add('no-secret-shapes', 'PASS', 'no distinctive secret value shapes');

  // 6. LIFECYCLE — structured, falsifiable (R60).
  const lc = (m.lifecycle && typeof m.lifecycle === 'object' && !Array.isArray(m.lifecycle)) ? m.lifecycle : {};
  if (!Number.isInteger(lc.hardTtlSeconds) || lc.hardTtlSeconds < 60 || lc.hardTtlSeconds > 3600) add('lifecycle-ttl', 'FAIL', 'hardTtlSeconds must be an integer in [60, 3600]');
  else add('lifecycle-ttl', 'PASS', `${lc.hardTtlSeconds}s`);

  const rk = lc.remoteKill;
  if (!rk || typeof rk !== 'object' || typeof rk.method !== 'string' || !rk.method || typeof rk.verifiedBy !== 'string' || !rk.verifiedBy || !Number.isInteger(rk.maxSeconds) || rk.maxSeconds < 1 || rk.maxSeconds > 600) {
    add('lifecycle:remoteKill', 'FAIL', 'remoteKill requires {method, verifiedBy, maxSeconds∈[1,600]}');
  } else add('lifecycle:remoteKill', 'PASS', `${rk.method} (≤${rk.maxSeconds}s, verified by ${rk.verifiedBy})`);

  const td = lc.teardown;
  const REQUIRED_DELETES = ['instance', 'volumes', 'ephemeral-keys'];
  if (!td || typeof td !== 'object' || !Array.isArray(td.deletes) || !REQUIRED_DELETES.every((d) => td.deletes.includes(d)) || td.sameSessionAsCreate !== true) {
    add('lifecycle:teardown', 'FAIL', `teardown must delete ${REQUIRED_DELETES.join('/')} and sameSessionAsCreate:true`);
  } else add('lifecycle:teardown', 'PASS', `deletes ${td.deletes.join(',')} in the creating session`);

  const rp = lc.residualProof;
  if (!rp || typeof rp !== 'object' || rp.kind !== 'provider-inventory-listing' || typeof rp.expectZeroTagged !== 'string' || !rp.expectZeroTagged || rp.hashedIntoReport !== true) {
    add('lifecycle:residualProof', 'FAIL', 'residualProof requires {kind:provider-inventory-listing, expectZeroTagged, hashedIntoReport:true}');
  } else add('lifecycle:residualProof', 'PASS', `inventory expects zero '${rp.expectZeroTagged}'-tagged resources, hashed into report`);

  // 7. OFFLINE DRY-RUN.
  let dryRun = null;
  if (promptOk && probeOk) {
    const t0 = Date.now();
    const stub = offlineStub(w.syntheticPrompt, w.refusalProbe);
    const t1 = Date.now();
    dryRun = {
      mode: 'dry-run-offline', provider: 'none (offline stub)', modelId: 'offline/stub', modelRevision: 'dry-run',
      inputDigest: sha256(w.syntheticPrompt), outputDigest: sha256(stub.promptReply),
      refusalInputDigest: sha256(w.refusalProbe), refusalOutputDigest: sha256(stub.refusalReply),
      latencyMs: Math.max(0, t1 - t0), tokensIn: countTokens(w.syntheticPrompt) + countTokens(w.refusalProbe),
      tokensOut: countTokens(stub.promptReply) + countTokens(stub.refusalReply), costUsd: 0,
      expectedReplyMatched: stub.promptReply === (w.expected?.syntheticPromptReply ?? 'PONG'),
      refusalRevealedNothing: !SECRET_SHAPES.some((re) => re.test(stub.refusalReply)),
    };
    const digestsOk = [dryRun.inputDigest, dryRun.outputDigest, dryRun.refusalInputDigest, dryRun.refusalOutputDigest].every((d) => SHA256_RE.test(d));
    if (dryRun.expectedReplyMatched && dryRun.refusalRevealedNothing && digestsOk && dryRun.costUsd === 0) add('dry-run-lifecycle', 'PASS', 'offline stub: expected reply matched; refusal revealed nothing; digests 64-hex; cost 0');
    else add('dry-run-lifecycle', 'FAIL', 'offline dry-run did not satisfy the content-free lifecycle law');
  } else {
    add('dry-run-lifecycle', 'FAIL', 'dry-run impossible without a valid workload');
  }

  return finish(checks, dryRun, manifestDigest, emptySlots);
}

function finish(checks, dryRun, manifestDigest, emptySlots = -1) {
  const cell0b = [
    { id: '0b:kira-cutover-contract', section: '0B', status: 'OUT_OF_SCOPE', detail: 'Sam 3 lane — single-writer embedded-KIRA cutover contract' },
    { id: '0b:erase-authority-g1', section: '0B', status: 'OUT_OF_SCOPE', detail: 'Sam 2 lane — erase authority pinned to a registered root' },
    { id: '0b:evidence-seal-boundary', section: '0B', status: 'OUT_OF_SCOPE', detail: 'Sam 2 lane — sealing boundary snapshot-first' },
    { id: '0b:brain-door-auth', section: '0B', status: 'OUT_OF_SCOPE', detail: 'Sam 2 lane — authenticated brain/mind door' },
    { id: '0b:owner-go-issue-15', section: '0B', status: 'OUT_OF_SCOPE', detail: 'coordinator/owner — explicit GO with hard cost/time cap' },
  ];
  const all = [...checks, ...cell0b];
  const fails = checks.filter((c) => c.status === 'FAIL').length;
  const empties = checks.filter((c) => c.status === 'EMPTY').length; // EMPTY = unpinned-but-legal
  const cell0a = fails > 0 ? 'NO_GO (law violation)' : empties > 0 ? 'NOT_READY (digest slots or egress host unpinned; owner GO absent)' : 'READY_PENDING_GO (all checks pass; owner GO on issue #15 still required)';
  return { checks: all, verdict: { cell0a, cell0b: 'NO_GO (organism readiness out of this packet\'s scope)' }, dryRun, manifestDigest, fails };
}

/** Deterministic artifact. */
export function renderGoNoGo(result) {
  const row = (c) => `| \`${c.id}\` | ${c.status} | ${c.detail} |`;
  const zeroA = result.checks.filter((c) => c.section === '0A');
  const zeroB = result.checks.filter((c) => c.section === '0B');
  return [
    '# NEBIUS GO / NO-GO — canonical artifact (generated)',
    '',
    '**Generated by `scripts/cell0a-preflight.mjs` from executable checks only — do not hand-edit.**',
    `Manifest: \`cell0a/preflight.json\` · sha256 \`${result.manifestDigest ?? 'unreadable'}\``,
    '',
    '## Verdict',
    '',
    `- **Cell 0A (connectivity smoke): ${result.verdict.cell0a}**`,
    `- **Cell 0B (organism readiness): ${result.verdict.cell0b}**`,
    '',
    'This artifact can never exceed READY_PENDING_GO: the GO itself is an owner/coordinator action',
    'on issue #15 naming the exact pinned digests plus a hard cost/time cap, executed against a',
    'deployed copy of the packet — never against this repository, whose manifest stays disabled.',
    '',
    '## Cell 0A — connectivity readiness (executable checks)',
    '',
    '| Check | Status | Detail |',
    '|---|---|---|',
    ...zeroA.map(row),
    '',
    '## Cell 0B — organism readiness (tracked, out of this packet\'s scope)',
    '',
    '| Item | Status | Owner |',
    '|---|---|---|',
    ...zeroB.map(row),
    '',
    '## Dry-run evidence law (offline, zero network)',
    '',
    result.dryRun
      ? `Content-free record only: input/output digests \`${result.dryRun.inputDigest.slice(0, 12)}…\`/\`${result.dryRun.outputDigest.slice(0, 12)}…\`, refusal digests \`${result.dryRun.refusalInputDigest.slice(0, 12)}…\`/\`${result.dryRun.refusalOutputDigest.slice(0, 12)}…\`, tokensIn ${result.dryRun.tokensIn}, tokensOut ${result.dryRun.tokensOut}, costUsd ${result.dryRun.costUsd}, provider "${result.dryRun.provider}". Real runs emit \`SwarmRunEvidenceV1\` as \`REMOTE_ONLY\` → saturate at \`quarantined\`; acceptance requires a later local reproduction.`
      : 'Dry-run unavailable — the manifest failed validation before the lifecycle stage.',
    '',
  ].join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const mi = args.indexOf('--manifest');
  let manifestPath = DEFAULT_MANIFEST;
  if (mi !== -1) {
    const val = args[mi + 1];
    if (typeof val !== 'string' || val.length === 0 || val.startsWith('--')) {
      console.error('cell0a-preflight: REFUSED — --manifest requires a path argument');
      process.exit(2);
    }
    manifestPath = val;
  }
  const result = runPreflight(manifestPath);
  for (const c of result.checks) console.log(`  [${c.section}] ${c.id}: ${c.status}${c.status !== 'PASS' ? ` — ${c.detail}` : ''}`);
  console.log(`cell0a-preflight: 0A=${result.verdict.cell0a} · 0B=${result.verdict.cell0b}`);
  const ei = args.indexOf('--emit-go-no-go');
  if (ei !== -1) {
    const out = args[ei + 1] && !args[ei + 1].startsWith('--') ? resolve(args[ei + 1]) : GO_NO_GO_PATH;
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, renderGoNoGo(result));
    console.log(`cell0a-preflight: artifact written → ${out}`);
  }
  process.exit(result.fails > 0 ? 1 : 0);
}

const invokedDirectly = (() => {
  if (!process.argv[1]) return false;
  try { return pathToFileURL(realpathSync(resolve(process.argv[1]))).href === import.meta.url; } catch { return false; }
})();
if (invokedDirectly) main();
