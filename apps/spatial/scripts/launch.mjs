// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
//
// Local launcher for the transplanted Aukora Spatial shell (apps/spatial). Serves the donor URL layout
// (/ → /app/index.html, plus /app/* and /assets/* statics) so every donor-relative path works unchanged.
//
// R37 LIVE PATH: /api/spatial/projection is a REACTIVE per-request read of Sam 2's real loopback brain
// door — the local self-hosted Convex deployment (default http://127.0.0.1:3210, override with
// AUKORA_BRAIN_DOOR) using the stable SAM4 contracts (apps/brain/src/spatialContracts.ts). No generated
// JSON is ever served as live; door unreachable → LOUD 503 and the shell shows its offline truth.
//
// PORT MAP (all reserved ports are never bound by this launcher):
//   :7090 donor spatial · :7091 donor chat door · :7092 donor voice sidecar · :7093 arc3 lane ·
//   :7094 AUMLOK approval gate · :7095 AUMLOK binding door ·
//   :7096 THIS organism (canonical; fallback :7099) ·
//   :7097 the NEW organism's chat/mind door · :7098 the NEW organism's voice sidecar ·
//   :3210/:3211 Sam 2's local Convex brain door (read via HTTP, never bound here).
// The donor stack stays untouched and independently usable.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, normalize, extname } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HOST = process.env.HOST || "127.0.0.1";
const CANONICAL = 7096;
const RESERVED = new Set([7090, 7091, 7092, 7093, 7094, 7095, 7097, 7098]);
const CANDIDATES = [7096, 7099]; // 7097/7098 belong to the new organism's own services — never auto-bind them
const BRAIN_DOOR = process.env.AUKORA_BRAIN_DOOR || "http://127.0.0.1:3210";
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".woff2": "font/woff2" };

// SAM4 senses used for the composed projection (names from apps/brain/src/spatialContracts.ts).
const SENSES = { health: "memory:health", snapshot: "memory:snapshot", verify: "memory:verify" };

async function queryDoor(path, args = {}) {
  const res = await fetch(`${BRAIN_DOOR}/api/query`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path, args, format: "json" }),
    signal: AbortSignal.timeout(2500),
  });
  if (!res.ok) throw new Error(`door ${path} → HTTP ${res.status}`);
  const body = await res.json();
  if (body.status !== "success") throw new Error(`door ${path} → ${body.status}: ${String(body.errorMessage ?? "").slice(0, 120)}`);
  return body.value;
}

// Reactive read: every request re-queries the door — no cache, no generated snapshot as live.
async function composeProjection() {
  const [health, snapshot, verify] = await Promise.all([
    queryDoor(SENSES.health),
    queryDoor(SENSES.snapshot),
    queryDoor(SENSES.verify),
  ]);
  return {
    schema: "aukora-spatial-projection-v2",
    source: "door",
    door: BRAIN_DOOR,
    queriedAt: new Date().toISOString(),
    displayOnly: true,
    feedsApply: false,
    advisoryOnly: true,
    grantsAuthority: false,
    brainHealth: health,
    snapshot,
    verify,
    contracts: {
      workflowState: "workflows:loadWorkflow (by workflow id)",
      receiptStream: "rehearsal:receiptStream",
      rehearsalStatus: "rehearsal:rehearsalStatus",
      note: "stable SAM4 senses on the local Convex door — read-only, advisory, never an apply input",
    },
  };
}

function makeServer() {
  return createServer(async (req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405, { Allow: "GET, HEAD" }); return res.end("method not allowed"); }
    let pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
    if (pathname === "/" || pathname === "/index.html") pathname = "/app/index.html";
    if (pathname === "/api/spatial/projection") {
      try {
        const projection = await composeProjection();
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
        return res.end(req.method === "HEAD" ? undefined : JSON.stringify(projection));
      } catch (e) {
        res.writeHead(503, { "Content-Type": "application/json; charset=utf-8" });
        return res.end(JSON.stringify({ offline: true, door: BRAIN_DOOR, note: "brain door unreachable — start the local Convex deployment (apps/brain) and retry", detail: String(e && e.message ? e.message : e).slice(0, 200) }));
      }
    }
    if (pathname.startsWith("/api/")) {
      // Donor engine APIs are not served here. 503 keeps donor organs in their offline states.
      res.writeHead(503, { "Content-Type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify({ offline: true, note: "static launcher — engine doors are separate local services" }));
    }
    if (!pathname.startsWith("/app/") && !pathname.startsWith("/assets/")) { res.writeHead(404); return res.end("not found"); }
    const filePath = normalize(join(ROOT, pathname));
    if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end("forbidden"); }
    try {
      const data = await readFile(filePath);
      res.writeHead(200, { "Content-Type": TYPES[extname(filePath)] || "application/octet-stream", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
      res.end(req.method === "HEAD" ? undefined : data);
    } catch { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); res.end("not found"); }
  });
}

function listenOn(port) {
  return new Promise((resolve, reject) => {
    const server = makeServer();
    server.once("error", (e) => (e.code === "EADDRINUSE" ? resolve(null) : reject(e)));
    server.listen(port, HOST, () => resolve(server));
  });
}

const explicit = process.env.PORT ? Number(process.env.PORT) : null;
if (explicit && RESERVED.has(explicit)) {
  console.error(`Port ${explicit} is reserved (7090–7095 donor/gates · 7097 chat door · 7098 voice). Pick another.`);
  process.exit(1);
}
const candidates = explicit ? [explicit] : CANDIDATES;

let bound = null;
for (const port of candidates) {
  // eslint-disable-next-line no-await-in-loop
  bound = await listenOn(port);
  if (bound) {
    const addr = bound.address();
    if (addr.port !== CANONICAL && !explicit) console.log(`(canonical ${CANONICAL} busy — using ${addr.port})`);
    console.log(`Aukora Spatial (new organism) → http://${HOST}:${addr.port}/`);
    console.log(`Brain door (Sam 2, read-only) → ${BRAIN_DOOR} · chat door :7097 · voice :7098 (loud offline until running)`);
    console.log(`Donor stack untouched: :7090 spatial · :7091 door · :7092 voice · :7093 arc3 · :7094 gate · :7095 bind.`);
    break;
  }
}
if (!bound) {
  console.error(`No free candidate port (${CANDIDATES.join(", ")}). Run with PORT=<port> to choose one explicitly.`);
  process.exit(1);
}
