#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
//
// Cell 0A preflight gate (R59, Sam 4 spatial/shadow-cell lane). Validates the deployable
// connectivity-smoke packet `cell0a/preflight.json` FAIL-CLOSED, executes an OFFLINE dry-run of the
// full content-free evidence lifecycle (local stub — zero network, zero provider), and renders the
// canonical `docs/nebius/NEBIUS_GO_NO_GO.md` artifact from executable check results only.
//
// HARD LAWS:
//   - this script has NO arm mode and performs NO network I/O of any kind;
//   - `enabled` must be false — an enabled packet REFUSES (arming is an owner/coordinator GO on
//     issue #15 against a deployed copy, never a state of this repository);
//   - digest slots are strict: 40-lowercase-hex for the git commit slot, 64-lowercase-hex wherever
//     SHA-256 is claimed; empty slots are legal but leave the verdict NOT_READY;
//   - config-bearing sections must not reference Convex or GitHub egress, and the whole manifest
//     must be free of distinctive secret shapes;
//   - the dry-run record is content-free: digests, provider/model labels, latency/token/cost
//     numbers — never prompt or output text;
//   - the artifact separates Cell 0A connectivity readiness from Cell 0B organism readiness, and
//     its verdict can never exceed READY_PENDING_GO from this seat.
//
// Usage: node scripts/cell0a-preflight.mjs [--manifest <path>] [--emit-go-no-go [path]]
import { readFileSync, writeFileSync, realpathSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_MANIFEST = join(REPO_ROOT, 'cell0a', 'preflight.json');
export const GO_NO_GO_PATH = join(REPO_ROOT, 'docs', 'nebius', 'NEBIUS_GO_NO_GO.md');

const GIT_SHA_RE = /^[0-9a-f]{40}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

// Distinctive secret shapes only (mirrors the public-tree scanner's fail-closed classes); written so
// none of these pattern SOURCES matches itself.
const SECRET_SHAPES = [
  /\bsk-[A-Za-z0-9]{16,}\b/, /\bAKIA[0-9A-Z]{16}\b/, /\bghp_[A-Za-z0-9]{20,}\b/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /\bBearer\s+[A-Za-z0-9._-]{16,}\b/,
];

/** One offline stub standing in for a provider during the dry-run. Deterministic; zero network. */
function offlineStub(prompt, refusalProbe) {
  return {
    promptReply: 'PONG',
    refusalReply: 'REFUSED: this cell does not disclose credentials or secret values.',
    promptEcho: prompt.length, // consumed only as counts — the text itself is never re-emitted
    probeEcho: refusalProbe.length,
  };
}

const countTokens = (s) => s.split(/\s+/).filter(Boolean).length;

/** Run every check. Returns { checks, verdict, dryRun, manifestDigest }. Never throws on manifest
 *  content problems — those become FAIL rows (the CLI exits 1 on any FAIL). */
export function runPreflight(manifestPath = DEFAULT_MANIFEST) {
  const checks = [];
  const add = (id, status, detail) => { checks.push({ id, section: '0A', status, detail }); };

  let raw = '';
  let m = null;
  try {
    raw = readFileSync(manifestPath, 'utf8');
    m = JSON.parse(raw);
  } catch (e) {
    add('manifest-readable', 'FAIL', `unreadable manifest (${e instanceof Error ? e.message.slice(0, 120) : 'unknown'})`);
    return finish(checks, null, null);
  }
  const manifestDigest = sha256(raw);
  add('manifest-readable', 'PASS', `sha256 ${manifestDigest.slice(0, 16)}…`);

  if (m?.schema !== 'aukora-cell0a-preflight/v1' || m?.version !== 1 || m?.cell !== '0A') {
    add('manifest-schema', 'FAIL', 'schema/version/cell must be aukora-cell0a-preflight/v1 · 1 · 0A');
    return finish(checks, null, manifestDigest);
  }
  add('manifest-schema', 'PASS', 'aukora-cell0a-preflight/v1');

  // 1. NEVER-ARMED LAW — an enabled packet refuses outright.
  if (m.enabled !== false) {
    add('never-armed', 'FAIL', 'enabled must be literally false — arming is an issue-15 owner GO on a deployed copy, never a repository state');
  } else {
    add('never-armed', 'PASS', 'enabled === false');
  }

  // 2. DIGEST SLOTS — strict format where non-empty; emptiness is legal but blocks readiness.
  const digests = m.digests ?? {};
  const slotSpecs = [
    ['publicMainCommit', GIT_SHA_RE, '40-lowercase-hex git commit'],
    ['codeDigest', SHA256_RE, '64-lowercase-hex sha256'],
    ['harnessDigest', SHA256_RE, '64-lowercase-hex sha256'],
    ['imageDigest', SHA256_RE, '64-lowercase-hex sha256'],
    ['modelDigest', SHA256_RE, '64-lowercase-hex sha256'],
  ];
  let emptySlots = 0;
  for (const [slot, re, want] of slotSpecs) {
    const v = digests[slot];
    if (typeof v !== 'string') add(`digest:${slot}`, 'FAIL', `missing slot (${want})`);
    else if (v === '') { emptySlots += 1; add(`digest:${slot}`, 'EMPTY', `unpinned (${want})`); }
    else if (!re.test(v)) add(`digest:${slot}`, 'FAIL', `malformed — expected ${want}`);
    else add(`digest:${slot}`, 'PASS', `${v.slice(0, 16)}…`);
  }

  // 3. WORKLOAD — exactly one inert prompt + one refusal probe; no URLs or secret shapes inside.
  const w = m.workload ?? {};
  const promptOk = typeof w.syntheticPrompt === 'string' && w.syntheticPrompt.length > 0;
  const probeOk = typeof w.refusalProbe === 'string' && w.refusalProbe.length > 0;
  const extraKeys = Object.keys(w).filter((k) => !['syntheticPrompt', 'refusalProbe', 'expected'].includes(k));
  if (!promptOk || !probeOk || extraKeys.length > 0) {
    add('workload-shape', 'FAIL', `exactly one syntheticPrompt + one refusalProbe (+expected) required${extraKeys.length ? ` — unexpected: ${extraKeys.join(',')}` : ''}`);
  } else if (/https?:\/\//i.test(w.syntheticPrompt + w.refusalProbe)) {
    add('workload-shape', 'FAIL', 'workload prompts must not carry URLs');
  } else {
    add('workload-shape', 'PASS', 'one inert prompt + one refusal probe');
  }

  // 4. EGRESS LAW — config-bearing sections only (prose fields may honestly SAY "no Convex").
  const egress = m.egress ?? {};
  const configText = JSON.stringify({ digests, workload: w, egress, lifecycle: m.lifecycle ?? {} });
  if (egress.publicIngress !== false || egress.githubEgress !== false || !Array.isArray(egress.allowedHosts)) {
    add('egress-law', 'FAIL', 'publicIngress and githubEgress must be false; allowedHosts must be an array');
  } else if (egress.allowedHosts.length > 1) {
    add('egress-law', 'FAIL', 'at most ONE allowed egress host (the provider inference endpoint named by the GO)');
  } else if (/convex|github\.com|localhost|127\.0\.0\.1/i.test(JSON.stringify(egress.allowedHosts))) {
    add('egress-law', 'FAIL', 'allowedHosts must not name Convex, GitHub, or loopback');
  } else {
    add('egress-law', 'PASS', `publicIngress:false githubEgress:false allowedHosts:${egress.allowedHosts.length}`);
  }
  if (/convex/i.test(configText)) add('no-convex-in-config', 'FAIL', 'config-bearing sections reference Convex');
  else add('no-convex-in-config', 'PASS', 'no Convex reference in config-bearing sections');

  // 5. SECRET SHAPES — the whole manifest must carry none (content never echoed).
  const secretHit = SECRET_SHAPES.find((re) => re.test(raw));
  if (secretHit) add('no-secret-shapes', 'FAIL', 'a distinctive secret shape is present in the manifest (content not shown)');
  else add('no-secret-shapes', 'PASS', 'no distinctive secret shapes');

  // 6. LIFECYCLE — hard TTL, remote kill, teardown, residual proof.
  const lc = m.lifecycle ?? {};
  if (!Number.isInteger(lc.hardTtlSeconds) || lc.hardTtlSeconds < 60 || lc.hardTtlSeconds > 3600) {
    add('lifecycle-ttl', 'FAIL', 'hardTtlSeconds must be an integer in [60, 3600]');
  } else {
    add('lifecycle-ttl', 'PASS', `${lc.hardTtlSeconds}s`);
  }
  for (const field of ['remoteKill', 'teardown', 'residualProof']) {
    if (typeof lc[field] !== 'string' || lc[field].length === 0) add(`lifecycle:${field}`, 'FAIL', 'required non-empty statement');
    else add(`lifecycle:${field}`, 'PASS', 'stated');
  }

  // 7. OFFLINE DRY-RUN — the full content-free evidence lifecycle against the local stub.
  let dryRun = null;
  if (promptOk && probeOk) {
    const t0 = Date.now();
    const stub = offlineStub(w.syntheticPrompt, w.refusalProbe);
    const t1 = Date.now();
    dryRun = {
      mode: 'dry-run-offline',
      provider: 'none (offline stub)',
      modelId: 'offline/stub',
      modelRevision: 'dry-run',
      inputDigest: sha256(w.syntheticPrompt),
      outputDigest: sha256(stub.promptReply),
      refusalInputDigest: sha256(w.refusalProbe),
      refusalOutputDigest: sha256(stub.refusalReply),
      latencyMs: Math.max(0, t1 - t0),
      tokensIn: countTokens(w.syntheticPrompt) + countTokens(w.refusalProbe),
      tokensOut: countTokens(stub.promptReply) + countTokens(stub.refusalReply),
      costUsd: 0,
      expectedReplyMatched: stub.promptReply === (w.expected?.syntheticPromptReply ?? 'PONG'),
      refusalRevealedNothing: !SECRET_SHAPES.some((re) => re.test(stub.refusalReply)),
    };
    const digestsOk = [dryRun.inputDigest, dryRun.outputDigest, dryRun.refusalInputDigest, dryRun.refusalOutputDigest].every((d) => SHA256_RE.test(d));
    if (dryRun.expectedReplyMatched && dryRun.refusalRevealedNothing && digestsOk && dryRun.costUsd === 0) {
      add('dry-run-lifecycle', 'PASS', 'offline stub: expected reply matched; refusal revealed nothing; digests 64-hex; cost 0');
    } else {
      add('dry-run-lifecycle', 'FAIL', 'offline dry-run did not satisfy the content-free lifecycle law');
    }
  } else {
    add('dry-run-lifecycle', 'FAIL', 'dry-run impossible without a valid workload');
  }

  return finish(checks, dryRun, manifestDigest, emptySlots);
}

function finish(checks, dryRun, manifestDigest, emptySlots = -1) {
  // Cell 0B rows — other lanes' readiness, honestly OUT_OF_SCOPE here (never silently green).
  const cell0b = [
    { id: '0b:kira-cutover-contract', section: '0B', status: 'OUT_OF_SCOPE', detail: 'Sam 3 lane — single-writer embedded-KIRA cutover contract' },
    { id: '0b:erase-authority-g1', section: '0B', status: 'OUT_OF_SCOPE', detail: 'Sam 2 lane — erase authority pinned to a registered root' },
    { id: '0b:evidence-seal-boundary', section: '0B', status: 'OUT_OF_SCOPE', detail: 'Sam 2 lane — sealing boundary M2 PoCs closed' },
    { id: '0b:brain-door-auth', section: '0B', status: 'OUT_OF_SCOPE', detail: 'Sam 2 lane — authenticated brain door' },
    { id: '0b:owner-go-issue-15', section: '0B', status: 'OUT_OF_SCOPE', detail: 'coordinator/owner — explicit GO with hard cost/time cap' },
  ];
  const all = [...checks, ...cell0b];
  const fails = checks.filter((c) => c.status === 'FAIL').length;
  const empties = emptySlots === -1 ? checks.filter((c) => c.status === 'EMPTY').length : emptySlots;
  const cell0a = fails > 0 ? 'NO_GO (law violation)' : empties > 0 ? 'NOT_READY (digest slots unpinned; owner GO absent)' : 'READY_PENDING_GO (all checks pass; owner GO on issue #15 still required)';
  return { checks: all, verdict: { cell0a, cell0b: 'NO_GO (organism readiness out of this packet\'s scope)' }, dryRun, manifestDigest, fails };
}

/** Deterministic artifact (no timestamps — git history dates it; manifest digest anchors it). */
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
    `## Verdict`,
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
  const manifestPath = mi !== -1 ? args[mi + 1] : DEFAULT_MANIFEST;
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
