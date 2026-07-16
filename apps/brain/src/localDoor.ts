// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * The brain's LOCAL DOOR (R37) — the narrow loopback projection/control HTTP door the new shell consumes.
 *
 * Laws:
 *   - LOOPBACK ONLY: binds 127.0.0.1 (port from AUKORA_PORTS.brainDoor, default 7141) — never reachable
 *     off-machine.
 *   - LIVE ONLY: every response is served from the injected LIVE senses (the running local Convex backend) and
 *     carries `x-aukora-source: live`. NO generated projection file is ever served as live — a fixture consumer
 *     must use the visibly-labelled fixture contract instead (spatialContracts.ts); this door has no fixture
 *     path at all.
 *   - PROJECTION + narrow CONTROL: reads (health, snapshot, workflow state, receipt stream, provider truth) plus
 *     exactly two control reflexes (cancel rehearsal / cancel impulse). No ingest, no forget, no save — writes
 *     of substance stay with the machine and the AUMLOK-gated paths. The door grants no authority.
 *   - Kernel/AUMLOK stays outside: the door only relays projections and receipt REFERENCES.
 *
 * Senses/controls are injected (`DoorBackend`), so unit tests drive fakes and the live composition injects the
 * ConvexHttpClient-backed IO (composeLive.ts).
 */
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { CANONICAL_SEATS } from '@aukora/council';
import { providerTruthTable } from './brainProvider.js';
import { AUKORA_PORTS } from './ports.js';

export type WorkflowPhaseFilter = 'awaiting-owner' | 'applied' | 'refused' | 'cancelled';

export interface DoorBackend {
  health(): Promise<unknown>;
  snapshot(): Promise<unknown>;
  workflow(workflowId: string): Promise<unknown>;
  /** Current workflow projections, most recent first, optionally filtered by phase. */
  listWorkflows(phase?: WorkflowPhaseFilter): Promise<unknown>;
  /** Live memory recall projection (read-only). */
  recall(text: string): Promise<unknown>;
  receiptStream(rehearsalKey?: string): Promise<unknown>;
  cancelRehearsal(key: string): Promise<unknown>;
  cancelImpulse(impulseId: string): Promise<unknown>;
  /**
   * REACTIVE seam (optional): subscribe to snapshot changes; the callback fires on every change until the
   * returned unsubscribe runs. Injected by the live wiring (a Convex WebSocket client) or a test fake — the
   * door itself stays vendor-free. Absent ⇒ /events responds 501.
   */
  subscribeSnapshot?(onChange: (snapshot: unknown) => void): () => void;
}

// ORIGIN-CLOSED by construction: no Access-Control-Allow-* header is ever emitted, so a browser page on any
// origin cannot read this door. Consumers (Spatial shell, chat door) call it from their own LOCAL server-side
// processes over loopback — never from browser JS.
const JSON_HEADERS = { 'content-type': 'application/json', 'x-aukora-source': 'live', 'x-aukora-grants-authority': 'false' } as const;

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, JSON_HEADERS);
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function handleDoorRequest(backend: DoorBackend, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  const path = url.pathname;
  try {
    if (req.method === 'GET') {
      if (path === '/health') return send(res, 200, { door: 'ok', backend: await backend.health() });
      if (path === '/snapshot') return send(res, 200, await backend.snapshot());
      if (path === '/truth') return send(res, 200, providerTruthTable());
      if (path.startsWith('/workflow/')) {
        const id = path.slice('/workflow/'.length);
        const state = await backend.workflow(id);
        return state === null ? send(res, 404, { error: 'unknown workflow' }) : send(res, 200, state);
      }
      if (path === '/receipts') return send(res, 200, await backend.receiptStream(url.searchParams.get('rehearsalKey') ?? undefined));
      if (path === '/workflows') {
        const phase = url.searchParams.get('phase');
        const valid = phase === null || ['awaiting-owner', 'applied', 'refused', 'cancelled'].includes(phase);
        if (!valid) return send(res, 400, { error: 'invalid phase' });
        return send(res, 200, await backend.listWorkflows((phase ?? undefined) as WorkflowPhaseFilter | undefined));
      }
      if (path === '/memory/recall') return send(res, 200, await backend.recall(url.searchParams.get('text') ?? ''));
      // Fu projection: the canonical council roster + the resolved provider truth (advisory display only).
      if (path === '/fu') return send(res, 200, { seats: CANONICAL_SEATS, providerTruth: providerTruthTable(), grantsAuthority: false });
      // AUMLOK projection: what is WAITING on the owner. Authority itself lives outside — this is a view.
      if (path === '/aumlok') return send(res, 200, { awaitingOwner: await backend.listWorkflows('awaiting-owner'), authorityLocation: 'kernel/AUMLOK (outside and above Convex)', grantsAuthority: false });
      // Candidate projection: applied governed-recursion workflows — the PR-candidate outputs.
      if (path === '/candidates') return send(res, 200, { applied: await backend.listWorkflows('applied'), egress: 'pr-candidate-only', grantsAuthority: false });
      // REACTIVE stream: Server-Sent Events over the injected subscription seam.
      if (path === '/events') {
        if (!backend.subscribeSnapshot) return send(res, 501, { error: 'reactive seam not wired (no subscribeSnapshot injected)' });
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', 'x-aukora-source': 'live', 'x-aukora-grants-authority': 'false' });
        res.write(': connected\n\n'); // flush headers immediately so clients resolve before the first event
        const unsubscribe = backend.subscribeSnapshot((snapshot) => {
          res.write(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);
        });
        req.on('close', unsubscribe);
        return;
      }
    }
    if (req.method === 'POST') {
      if (path === '/control/cancel-rehearsal') {
        const body = await readBody(req);
        if (typeof body.key !== 'string' || body.key.length === 0) return send(res, 400, { error: 'key required' });
        return send(res, 200, await backend.cancelRehearsal(body.key));
      }
      if (path === '/control/cancel-impulse') {
        const body = await readBody(req);
        if (typeof body.impulseId !== 'string' || body.impulseId.length === 0) return send(res, 400, { error: 'impulseId required' });
        return send(res, 200, await backend.cancelImpulse(body.impulseId));
      }
    }
    return send(res, 404, { error: 'unknown door path' });
  } catch (err) {
    return send(res, 502, { error: 'backend unavailable', detail: String(err).slice(0, 200) });
  }
}

/** Start the door. LOOPBACK ONLY — the host is not configurable. Returns the server (close() to stop). */
export function startLocalDoor(backend: DoorBackend, port: number = AUKORA_PORTS.brainDoor): Promise<Server> {
  const server = createServer((req, res) => void handleDoorRequest(backend, req, res));
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

/** The door grants no authority. Constant. */
export function localDoorGrantsAuthority(): false {
  return false;
}
