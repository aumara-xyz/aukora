// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Loopback Node http adapter for the governed MindDoor — binds 127.0.0.1:7097. NOT part of CI.
 *
 *   npx tsx apps/seed/scripts/mind-door-7097.ts
 *
 * R50 — the PRODUCTION composition (issue #99 item 1): the workflow store is the LOCAL self-hosted Convex
 * deployment through Sam 2's `ConvexWorkflowStore` (hydrate → sync ceremony steps → settle), so the durable
 * `awaiting-owner` truth SURVIVES this process dying. The door pulls the durable row before each ceremony and
 * pushes accepted saves through the authoritative OCC mutation after it (the R50 `DoorDurability` hooks); a
 * bad row, an unreachable backend, and a lost settle race each carry their own content-free refusal class.
 * Convex holds PROJECTIONS ONLY — authority, keys, signatures, proposal content, and every Git effect stay in
 * the protected Node reference-monitor path. `AUKORA_WORKFLOW_STORE=memory` opts back into the in-process
 * store (standalone dev fallback; no durability across death). Vendor client wiring lives HERE in scripts/
 * (never src/) — the same boundary law as apps/brain/scripts/doorServerMain.ts.
 *
 * The door composes the durable machine + KIRA store + Fu live runner + candidate stage. The provider key (if any)
 * is read out-of-band by the Fu live runner from Keychain/env — never here, never in the repo, never in receipts.
 *
 * TOKEN LIFECYCLE (R44b handoff): the per-boot local POST token comes from the supervisor when present. If
 * `AUKORA_DOOR_TOKEN` is set (the supervisor mints it, holds it 0600, and hands it to this child via env), the door
 * ADOPTS it and its VALUE is never printed — a supervised boot discards this child's stdout, so printing it would
 * be both useless and a leak surface. When it is ABSENT (a standalone interactive run), the door self-mints a fresh
 * CSPRNG token and prints it ONCE to the operator's terminal (never to a browser). Either way the token stays out
 * of the repo, browser state, and receipts.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { ConvexHttpClient } from 'convex/browser';
import { ReactiveMemoryStore, ConvexWorkflowStore, liveWorkflowIo, assertLoopbackUrl, AUKORA_PORTS } from '@aukora/brain';
import { MindDoor, DOOR_PORT, type DoorRequest, type DoorDriver, type DoorDurability } from '../src/mindDoor.js';
import { InMemoryWorkflowStore, validateWorkflowState, type WorkflowStore } from '../src/durableRecursion.js';
import { HybridOwnerAdapter } from '../src/ownerFixture.js';
import { CandidateReferenceMonitor } from '../src/candidateReferenceMonitor.js';

async function main(): Promise<void> {
  const port = Number(process.env.AUKORA_DOOR_PORT ?? DOOR_PORT);
  // Supervisor-minted per-boot token when present; undefined ⇒ the door self-mints (standalone fallback preserved).
  const injectedToken = process.env.AUKORA_DOOR_TOKEN;
  const store = new ReactiveMemoryStore();
  // NOTE: a real deployment injects Peter's local AUMLOK root; the fixture owner here is for a local dev door only.
  const owner = new HybridOwnerAdapter('local-door-dev');
  const monitor = new CandidateReferenceMonitor(owner.root); // one canonical reference monitor per boot
  const repoRoot = resolve(process.cwd());

  // ── R50 store selection: local self-hosted Convex is the PRODUCTION path ─────────────────────────────
  const storeMode = process.env.AUKORA_WORKFLOW_STORE === 'memory' ? 'memory' : 'convex';
  let workflowStore: WorkflowStore;
  let durability: DoorDurability | undefined;
  if (storeMode === 'convex') {
    const deployment = process.env.AUKORA_CONVEX_URL ?? `http://127.0.0.1:${AUKORA_PORTS.convexLocalDeployment}`;
    assertLoopbackUrl(deployment); // fail-closed: loopback only, never a cloud/managed deployment
    const http = new ConvexHttpClient(deployment);
    // string-path client face (SAM4_CONVEX_CONTRACTS names) — same idiom as apps/brain/scripts/doorServerMain.ts
    const stringClient = {
      query: (fn: string, args: Record<string, unknown>) => http.query(fn as never, args as never),
      mutation: (fn: string, args: Record<string, unknown>) => http.mutation(fn as never, args as never),
    };
    // The REAL full validator is injected (never cloned); the store caches only validated full states, so the
    // narrow WorkflowStateLike face is safely widened back to the seed contract here.
    const convexStore = new ConvexWorkflowStore(liveWorkflowIo(stringClient), validateWorkflowState as never);
    workflowStore = convexStore as unknown as WorkflowStore;
    durability = { hydrate: (id) => convexStore.hydrate(id), settle: () => convexStore.settle() };
  } else {
    workflowStore = new InMemoryWorkflowStore();
    durability = undefined;
  }

  const door = new MindDoor({
    store,
    ownerRoot: owner.root,
    nowIso: new Date().toISOString(),
    postToken: injectedToken, // supervisor-minted when set; undefined ⇒ MindDoor self-mints (fallback preserved)
    // LAZY driver: a compile break in the composed modules fails a request, not the boot.
    loadDriver: async (): Promise<DoorDriver> => {
      // R50: a REAL repo read capability — tracked files only, read-only, so live proposals can actually
      // ground against the working tree (the pre-R50 empty set made every live proposal refused-ungrounded).
      const tracked = execFileSync('git', ['-C', repoRoot, 'ls-files'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
        .split('\n').filter((f) => f.length > 0);
      const knownFiles = new Set(tracked);
      const recursionEnv = {
        store, knownFiles, ownerRoot: owner.root,
        ledger: new (await import('../src/ledger.js')).RecursionLedger(),
        nowMs: Date.now(), nowIso: new Date().toISOString(),
        deadlineMs: Date.now() + 5 * 60_000,
      };
      return {
        ceremonyEnv: {
          recursionEnv,
          workflowStore,
          repo: {
            list: () => tracked,
            read: (p) => (existsSync(join(repoRoot, p)) ? readFileSync(join(repoRoot, p), 'utf8') : ''),
            exists: (p) => existsSync(join(repoRoot, p)),
          },
          ownerRoot: owner.root,
          store,
          monitor,
          gitRepoRoot: repoRoot,
          worktreeBase: resolve(repoRoot, '..', 'aukora-door-candidates'),
          nowMs: Date.now(), nowIso: new Date().toISOString(),
        },
        durability,
      };
    },
  });

  console.log(`[mind-door] listening on http://127.0.0.1:${port}`);
  console.log(`[mind-door] workflow store: ${storeMode === 'convex' ? 'local self-hosted Convex (durable; hydrate/settle per request)' : 'in-process memory (standalone dev fallback; NOT durable)'}`);
  if (injectedToken) {
    // Supervisor-injected: NEVER print the value — the parent already holds it (0600); its stdout is discarded.
    console.log('[mind-door] local POST token: adopted from AUKORA_DOOR_TOKEN (value not printed)');
  } else {
    // Standalone interactive run: self-minted token printed ONCE to the operator's terminal (never to a browser).
    console.log(`[mind-door] local POST token (present x-aukora-door-token on POST): ${door.localPostToken}`);
  }
  console.log('[mind-door] advisory-only; proposals/materialization require explicit owner invocation + fresh AUMLOK verification.');

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c as Buffer));
    req.on('end', () => {
      let body: unknown;
      try { body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined; } catch { body = undefined; }
      const headers: Record<string, string | undefined> = {};
      for (const [k, v] of Object.entries(req.headers)) headers[k] = Array.isArray(v) ? v.join(',') : v;
      const doorReq: DoorRequest = { method: req.method ?? 'GET', path: (req.url ?? '/').split('?')[0], headers, body };
      door.handle(doorReq).then((out) => {
        res.writeHead(out.status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        res.end(JSON.stringify(out.json));
      }).catch(() => { res.writeHead(500); res.end('{"error":"door error"}'); });
    });
  });
  server.listen(port, '127.0.0.1');
}

main().catch((e) => { console.error('[mind-door] fatal:', e instanceof Error ? e.message : 'unknown'); process.exit(1); });
