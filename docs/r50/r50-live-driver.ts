// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R50 live-run driver — drives the ACTUAL supervisor-started stack for the issue #99 acceptance proof.
 * NOT part of CI; committed under docs/r50/ so the sanitized transcript is reproducible.
 *
 *   npx tsx docs/r50/r50-live-driver.ts <command> [...args]
 *
 * SANITIZATION LAW: this driver prints ONLY request paths, HTTP statuses, and response/projection JSON
 * (plan fields and workflow projections — shapes that structurally carry no key/signature/token/content).
 * The door token is read from the supervisor's 0600 file and used in a header ONLY; owner signatures are
 * built with the same local test-owner fixture the dev door uses (`local-door-dev`) and travel in request
 * bodies ONLY. Neither is ever printed. Ephemeral test credentials, out of transcripts (R50 directive).
 */
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ConvexHttpClient } from 'convex/browser';
import {
  HybridOwnerAdapter, deriveIntentId, deriveDraftHash, candidatePayloadForProposals,
  type Proposal,
} from '../../apps/seed/src/index.js';
import { ceremonyWorkflowId } from '../../apps/seed/src/localCeremonyRunner.js';

const REPO = resolve(process.cwd());
const DOOR = 'http://127.0.0.1:7097';
const CONVEX = 'http://127.0.0.1:3210';
const TARGET = 'apps/seed/src/recursion.ts';
const TOKEN_FILE = join(REPO, 'apps', 'brain', '.local', 'organism', 'mind-door.token');

const readDoorToken = (): string => readFileSync(TOKEN_FILE, 'utf8').trim();
const owner = new HybridOwnerAdapter('local-door-dev'); // the dev door's fixture test-owner (never printed)
const pastIso = (): string => new Date(Date.now() - 10 * 60_000).toISOString();

function proposalFor(label: string): Proposal {
  return { id: `r50-${label}`, targetPath: TARGET, newContent: `// r50 live ${label} (disposable candidate proof)\n`, createdAt: pastIso(), supersedes: null };
}

function authFor(p: Proposal, nonce: string, forge = false): Record<string, unknown> {
  const auth = owner.authorize({ proposalHash: deriveIntentId(p), draftHash: deriveDraftHash(p), nonce, issuedAt: pastIso(), expiresAt: null });
  if (!forge) return auth as unknown as Record<string, unknown>;
  const sig = auth.signatures.ed25519;
  return { ...auth, signatures: { ...auth.signatures, ed25519: (sig[0] === 'a' ? 'b' : 'a') + sig.slice(1) } };
}

async function post(path: string, body: unknown, headers: Record<string, string> = {}, useToken = true): Promise<void> {
  const res = await fetch(`${DOOR}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(useToken ? { 'x-aukora-door-token': readDoorToken() } : {}), ...headers },
    body: JSON.stringify(body),
  });
  console.log(`POST ${path} → ${res.status} ${await res.text()}`);
}

function convexClient() {
  const http = new ConvexHttpClient(CONVEX);
  return {
    query: (fn: string, args: Record<string, unknown>) => http.query(fn as never, args as never),
    mutation: (fn: string, args: Record<string, unknown>) => http.mutation(fn as never, args as never),
  };
}

async function main(): Promise<void> {
  const [cmd, label = 'live', nonce = 'r50-live-nonce-1', mode = ''] = process.argv.slice(2);
  const p = proposalFor(label);
  const workflowId = ceremonyWorkflowId(p, nonce);

  if (cmd === 'status') {
    const res = await fetch(`${DOOR}/api/door`);
    console.log(`GET /api/door → ${res.status} ${await res.text()}`);
    return;
  }
  if (cmd === 'controls') {
    await post('/api/propose', { proposalInput: p, nonce }, {}, false);                       // tokenless
    await post('/api/chat', { text: 'hi' }, { origin: 'https://evil.example' });              // cross-origin
    await post('/api/propose', { proposalInput: p });                                          // nonce-less (the #87 shape)
    return;
  }
  if (cmd === 'propose') {
    const body: Record<string, unknown> = { proposalInput: p, nonce };
    if (mode === 'auth') body.auth = authFor(p, nonce);
    await post('/api/propose', body);
    console.log(`workflowId(expected) = ${workflowId}`);
    return;
  }
  if (cmd === 'materialize') {
    const cp = candidatePayloadForProposals([p]);
    const candidateAuth = owner.authorize({ proposalHash: cp.payloadHash, draftHash: cp.payloadHash, nonce: `${nonce}-cand-${Date.now()}`, issuedAt: pastIso(), expiresAt: null });
    const body: Record<string, unknown> = { proposalInput: p, nonce, auth: authFor(p, nonce, mode === 'forge'), candidateAuth, ownerArmed: true, explanation: 'r50 live supervised acceptance' };
    if (mode === 'current' || mode === 'forge') body.headBefore = execFileSync('git', ['-C', REPO, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    else if (mode === 'stale') body.headBefore = 'a'.repeat(40);
    // mode === 'missing' → no headBefore field
    await post('/api/materialize', body);
    return;
  }
  if (cmd === 'row') {
    const row = await convexClient().query('workflows:loadWorkflow', { workflowId });
    console.log(`convex loadWorkflow(${workflowId.slice(0, 12)}…) = ${JSON.stringify(row)}`);
    return;
  }
  if (cmd === 'plant-bad') {
    // A row that PASSES the isolate subset law but FAILS the full validator (empty nonce): the malformed-state control.
    const bad = {
      schema: 'aukora-recursion-workflow-v1', workflowId, version: 1, phase: 'awaiting-owner',
      intentId: deriveIntentId(p), draftHash: deriveDraftHash(p), nonce: '',
      councilVerdict: 'advisory-pass', councilEvidenceDigest: 'a'.repeat(64), stage: 'awaiting-owner',
      refusals: [], receiptHash: null, ownerVerified: false,
      createdAtIso: pastIso(), updatedAtIso: pastIso(), advisoryOnly: true, grantsAuthority: false,
    };
    const out = await convexClient().mutation('workflows:saveWorkflow', { state: bad, expectedVersion: 0 });
    console.log(`plant-bad(${workflowId.slice(0, 12)}…) → ${JSON.stringify(out)}`);
    return;
  }
  if (cmd === 'winner-bump') {
    // An EXTERNAL writer landing a newer version — the door must defer to this durable truth (convergence).
    const client = convexClient();
    const row = (await client.query('workflows:loadWorkflow', { workflowId })) as Record<string, unknown> | null;
    if (row === null) { console.log('winner-bump: no row'); return; }
    const bumped = { ...row, version: (row.version as number) + 1 };
    const out = await client.mutation('workflows:saveWorkflow', { state: bumped, expectedVersion: row.version as number });
    console.log(`winner-bump(${workflowId.slice(0, 12)}… v${row.version}→v${(row.version as number) + 1}) → ${JSON.stringify(out)}`);
    return;
  }
  console.error(`unknown command '${cmd}' — status | controls | propose <label> <nonce> [auth] | materialize <label> <nonce> <current|stale|missing|forge> | row <label> <nonce> | plant-bad <label> <nonce> | winner-bump <label> <nonce>`);
  process.exit(2);
}

main().catch((e) => { console.error(`driver error: ${e instanceof Error ? e.message.slice(0, 200) : 'unknown'}`); process.exit(1); });
