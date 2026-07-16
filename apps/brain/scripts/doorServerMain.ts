// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * The ALWAYS-HELD brain door process (R39) — holds 127.0.0.1:7141 for the whole session, backed by the REAL
 * local Convex store, so Spatial never reports ENGINE UNREACHABLE during a healthy boot.
 *
 * Lives in scripts/ (not src/) deliberately: it wires the vendor clients (ConvexHttpClient for reads,
 * ConvexClient WebSocket for the REACTIVE /events seam), which the src boundary law keeps out of src.
 * Bundled at start time by organism-ctl with the repo's esbuild and run under the supervisor's PID ownership.
 *
 * Resilience law: the door BINDS FIRST and stays up; while the backend is unreachable it answers 502 per
 * request (an honest degradation the shell can render) — the door itself never dies with the backend, and it
 * executes nothing automatically.
 */
import { ConvexHttpClient, ConvexClient } from 'convex/browser';
import { anyApi } from 'convex/server';
import { startLocalDoor } from '../src/localDoor.js';
import { liveDoorBackend, assertLoopbackUrl } from '../src/composeLive.js';
import { AUKORA_PORTS } from '../src/ports.js';

const DEPLOYMENT = process.env.AUKORA_CONVEX_URL ?? `http://127.0.0.1:${AUKORA_PORTS.convexLocalDeployment}`;
const PORT = Number(process.env.AUKORA_DOOR_PORT ?? AUKORA_PORTS.brainDoor);

async function main(): Promise<void> {
  assertLoopbackUrl(DEPLOYMENT);
  const http = new ConvexHttpClient(DEPLOYMENT);
  const stringClient = {
    query: (fn: string, args: Record<string, unknown>) => http.query(fn as never, args as never),
    mutation: (fn: string, args: Record<string, unknown>) => http.mutation(fn as never, args as never),
  };
  // REACTIVE seam: one shared WebSocket subscription fans out to every SSE consumer.
  const ws = new ConvexClient(DEPLOYMENT);
  const listeners = new Set<(snapshot: unknown) => void>();
  ws.onUpdate(anyApi.memory.snapshot, {}, (snapshot) => {
    for (const l of listeners) {
      try { l(snapshot); } catch { /* an observer never breaks the door */ }
    }
  });
  const subscribeSnapshot = (onChange: (snapshot: unknown) => void): (() => void) => {
    listeners.add(onChange);
    return () => listeners.delete(onChange);
  };

  const server = await startLocalDoor(liveDoorBackend(stringClient, subscribeSnapshot), PORT);
  console.log(`[door] holding 127.0.0.1:${PORT} → backend ${DEPLOYMENT} (reactive seam: websocket)`);

  const shutdown = (): void => {
    console.log('[door] SIGTERM — closing');
    void ws.close();
    server.closeAllConnections();
    server.close(() => process.exit(0));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error(`[door] fatal: ${String(err)}`);
  process.exit(1);
});
