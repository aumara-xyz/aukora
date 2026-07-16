// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Loopback Node http adapter for the governed MindDoor — binds 127.0.0.1:7097. NOT part of CI.
 *
 *   npx tsx apps/seed/scripts/mind-door-7097.ts
 *
 * The door composes the durable machine + KIRA store + Fu live runner + candidate stage. The provider key (if any)
 * is read out-of-band by the Fu live runner from Keychain/env — never here, never in the repo, never in receipts.
 * The per-boot local POST token is printed ONCE to the operator's terminal (never to a browser).
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { ReactiveMemoryStore } from '@aukora/brain';
import { MindDoor, DOOR_PORT, type DoorRequest, type DoorDriver } from '../src/mindDoor.js';
import { InMemoryWorkflowStore } from '../src/durableRecursion.js';
import { HybridOwnerAdapter } from '../src/ownerFixture.js';
import { CandidateReferenceMonitor } from '../src/candidateReferenceMonitor.js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

async function main(): Promise<void> {
  const port = Number(process.env.AUKORA_DOOR_PORT ?? DOOR_PORT);
  const store = new ReactiveMemoryStore();
  // NOTE: a real deployment injects Peter's local AUMLOK root; the fixture owner here is for a local dev door only.
  const owner = new HybridOwnerAdapter('local-door-dev');
  const monitor = new CandidateReferenceMonitor(owner.root); // one canonical reference monitor per boot
  const repoRoot = resolve(process.cwd());

  const door = new MindDoor({
    store,
    ownerRoot: owner.root,
    nowIso: new Date().toISOString(),
    // LAZY driver: a compile break in the composed modules fails a request, not the boot.
    loadDriver: async (): Promise<DoorDriver> => {
      const recursionEnv = {
        store, knownFiles: new Set<string>(), ownerRoot: owner.root,
        ledger: new (await import('../src/ledger.js')).RecursionLedger(),
        nowMs: Date.now(), nowIso: new Date().toISOString(),
        deadlineMs: Date.now() + 5 * 60_000,
      };
      return {
        ceremonyEnv: {
          recursionEnv,
          workflowStore: new InMemoryWorkflowStore(),
          repo: { list: () => [], read: (p) => (existsSync(p) ? readFileSync(p, 'utf8') : ''), exists: (p) => existsSync(p) },
          ownerRoot: owner.root,
          store,
          monitor,
          gitRepoRoot: repoRoot,
          worktreeBase: resolve(repoRoot, '..', 'aukora-door-candidates'),
          nowMs: Date.now(), nowIso: new Date().toISOString(),
        },
      };
    },
  });

  console.log(`[mind-door] listening on http://127.0.0.1:${port}`);
  console.log(`[mind-door] local POST token (present x-aukora-door-token on POST): ${door.localPostToken}`);
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
