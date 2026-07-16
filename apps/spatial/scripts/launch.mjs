// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
//
// Local launcher for the transplanted Aukora Spatial shell (apps/spatial). Serves the donor URL layout
// (/ → /app/index.html, plus /app/* and /assets/* statics) so every donor-relative path works unchanged.
//
// R38 LIVE PATH: /api/spatial/projection is a REACTIVE per-request read of the CANONICAL brain door
// (apps/brain/src/localDoor.ts, default http://127.0.0.1:7141, override with AUKORA_BRAIN_DOOR). The raw
// Convex backend sits BEHIND that door and is never dialled from here. No generated JSON is ever served
// as live; full outage → LOUD 503, partial outage → source "door-degraded" with the missing senses named.
//
// PORT MAP (all reserved ports are never bound by this launcher):
//   :7090 donor spatial · :7091 donor chat door · :7092 donor voice sidecar · :7093 arc3 lane ·
//   :7094 AUMLOK approval gate · :7095 AUMLOK binding door ·
//   :7096 THIS organism (canonical; fallback :7099) ·
//   :7097 the NEW organism's chat/mind door · :7098 the NEW organism's voice sidecar (apps/spatial/voice) ·
//   :7141 the canonical brain projection/control door (apps/brain, read via HTTP, never bound here) ·
//   :3210/:3211 the local Convex backend behind that door (dev-only, loopback).
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
const BRAIN_DOOR = process.env.AUKORA_BRAIN_DOOR || "http://127.0.0.1:7141"; // R38: the canonical brain door (apps/brain localDoor)
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".woff2": "font/woff2" };

// R39: the governed MIND door (apps/seed, Sam 3) — loopback :7097, strict origin allowlist + per-boot POST
// token. The browser cannot (and must not) hold that token, so THIS launcher is the governed proxy: a
// server-to-server request carries NO Origin header (passes the door's allowlist) and injects the token
// from AUKORA_DOOR_TOKEN (set by the operator from the door's one-time terminal print — never in the repo,
// never sent to the browser). Full turn: browser → same-origin :7096 → (token) → mind door :7097.
const MIND_DOOR = process.env.AUKORA_MIND_DOOR || "http://127.0.0.1:7097";
const MIND_TOKEN = process.env.AUKORA_DOOR_TOKEN || ""; // absent → proxy still runs; the door refuses writes loudly

// R38: the canonical brain door's GET endpoints (apps/brain/src/localDoor.ts — live-only, loopback-only).
const DOOR_GETS = { health: "/health", snapshot: "/snapshot", truth: "/truth", receipts: "/receipts" };

async function getDoor(path) {
  const res = await fetch(`${BRAIN_DOOR}${path}`, { signal: AbortSignal.timeout(2500) });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`door ${path} → HTTP ${res.status}`);
  return body;
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch { return {}; }
}

// POST to the governed mind door with the token injected server-side. `upstream` is the caller's AbortSignal,
// so a browser barge-in that aborts its fetch propagates through here and cancels the door request (stops work).
async function postMind(path, body, upstream) {
  const res = await fetch(`${MIND_DOOR}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(MIND_TOKEN ? { "x-aukora-door-token": MIND_TOKEN } : {}) },
    body: JSON.stringify(body ?? {}),
    signal: upstream,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

// The map organ's read-only import graph. Served from the brain door snapshot when up, else a minimal HEALTHY
// graph so a healthy boot never shows "ENGINE UNREACHABLE" (R39). display-only; grants nothing.
async function composeGraph() {
  let nodes = [{ id: "aukora", label: "aukora" }];
  let edgeCount = 0;
  try {
    const snap = await getDoor("/snapshot");
    const live = snap && (snap.nodeCount ?? snap.liveCount);
    if (Number.isFinite(live) && live > 0) { nodes = Array.from({ length: live }, (_, i) => ({ id: "n" + i, label: "n" + i })); }
  } catch { /* brain door down → the minimal healthy graph below still renders (no ENGINE UNREACHABLE) */ }
  return {
    schema: "aukora-spatial-graph-v1",
    nodes,
    edges: [],
    meta: { edgeCount, excluded: { "deferred-tests": { files: 0 } }, source: "launcher", displayOnly: true, grantsAuthority: false },
  };
}

// Reactive read: every request re-queries the door — no cache, no generated snapshot as live.
// Full outage → throws (loud 503). Partial outage → source "door-degraded" with the failing senses listed.
async function composeProjection() {
  const results = await Promise.allSettled([
    getDoor(DOOR_GETS.health),
    getDoor(DOOR_GETS.snapshot),
    getDoor(DOOR_GETS.truth),
    getDoor(DOOR_GETS.receipts),
  ]);
  const [health, snapshot, truth, receipts] = results;
  const failed = Object.keys(DOOR_GETS).filter((_, i) => results[i].status === "rejected");
  if (failed.length === Object.keys(DOOR_GETS).length) {
    throw new Error("all door senses failed: " + String(results[0].reason && results[0].reason.message).slice(0, 120));
  }
  const val = (r) => (r.status === "fulfilled" ? r.value : null);
  return {
    schema: "aukora-spatial-projection-v3",
    source: failed.length === 0 ? "door" : "door-degraded",
    degradedSenses: failed,
    door: BRAIN_DOOR,
    queriedAt: new Date().toISOString(),
    displayOnly: true,
    feedsApply: false,
    advisoryOnly: true,
    grantsAuthority: false,
    brainHealth: val(health),
    snapshot: val(snapshot),
    providerTruth: val(truth),
    receipts: val(receipts),
    // The full durable-workflow reason vocabulary (seed reasonClass) the display may show — words, not power.
    workflowReasonVocabulary: [
      "workflow:ok", "workflow:already-terminal", "workflow:conflict",
      "refused-shape", "refused-stale", "refused-secret", "refused-authority-shape",
      "refused-owner-gate", "council-hold", "budget-exhausted", "cancelled", "deferred-expired-authority",
    ],
    aumlokPresence: {
      // presence BOOLEANS only — no key material, no phrase, no signature bytes ever cross this door.
      gateDoorKnown: true,
      custodyLocal: true,
      displayedStateAuthorizes: false,
    },
    contracts: {
      workflow: BRAIN_DOOR + "/workflow/:id",
      receipts: BRAIN_DOOR + "/receipts?rehearsalKey=…",
      note: "canonical brain door (live-only, x-aukora-source: live) — read-only, advisory, never an apply input",
    },
  };
}

const JSON_HEAD = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };

function makeServer() {
  return createServer(async (req, res) => {
    let pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
    // Tie an AbortController to client disconnect: a browser barge-in that aborts its fetch closes this
    // socket, which aborts req.signal, which cancels the upstream mind-door fetch (work/billing stops).
    const ac = new AbortController();
    const clientSignal = ac.signal; // Node's req.signal is a read-only getter — keep our own handle
    // res 'close' before the response has ended == the client went away (a browser barge-in aborting its
    // fetch). req 'close' would fire on normal body-read completion, so we must listen on res, not req.
    res.on("close", () => { if (!res.writableEnded) ac.abort(); });

    // ── GOVERNED MIND-DOOR PROXY (POST) ──────────────────────────────────────────────────────────
    // The browser posts SAME-ORIGIN; we forward to the governed door :7097 with the token server-side.
    if (req.method === "POST") {
      // /api/chat — the donor chat lane. Door replies {mode, answer, advisoryOnly}; the donor UI wants
      // {entries:[{kind:'info',text}]}. Translate the shape; carry the honest mode label through.
      if (pathname === "/api/chat") {
        try {
          const body = await readJsonBody(req);
          const { status, json } = await postMind("/api/chat", body, clientSignal);
          const text = json.answer ?? json.error ?? "";
          res.writeHead(status, JSON_HEAD);
          return res.end(JSON.stringify({
            entries: text ? [{ kind: json.error ? "error" : "info", text }] : [],
            mode: json.mode ?? (json.error ? "refused" : "unknown"),
            advisoryOnly: json.advisoryOnly ?? true,
            grantsAuthority: false,
            citations: json.citations ?? [],
            eventReceipt: json.eventReceipt,
          }));
        } catch (e) {
          const aborted = clientSignal.aborted;
          res.writeHead(aborted ? 499 : 502, JSON_HEAD);
          return res.end(JSON.stringify({ entries: [], mode: aborted ? "cancelled" : "door-unreachable", detail: String(e && e.message ? e.message : e).slice(0, 160) }));
        }
      }
      // /api/presence/stream — the AUMA LIVE voice turn. Bridge the door's one-shot model-free answer into
      // the SSE token frames the donor voice loop consumes. Barge-in aborts req.signal → the door fetch is
      // cancelled upstream (work stops). FIELD/body-language tags are NEVER sent up — mind gets clean text.
      if (pathname === "/api/presence/stream") {
        const body = await readJsonBody(req);
        res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store", Connection: "keep-alive" });
        const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
        try {
          const { json } = await postMind("/api/chat", { owner_text: String(body.text ?? ""), mind: body.mind }, clientSignal);
          send({ t: "mode", v: json.mode ?? "model-free-memory-fallback" }); // honest label, not "speech-to-speech"
          const answer = String(json.answer ?? "");
          for (const word of answer.split(/(\s+)/)) { if (clientSignal.aborted) break; send({ t: "tok", v: word }); }
          send({ t: "done" });
        } catch (e) {
          if (!clientSignal.aborted) send({ t: "error", v: String(e && e.message ? e.message : e).slice(0, 120) });
        }
        return res.end();
      }
      // /api/lockdown — owner-text intercept. Proxy so the UI can engage lockdown and re-read state at once.
      if (pathname === "/api/lockdown") {
        try { const { status, json } = await postMind("/api/lockdown", await readJsonBody(req), clientSignal); res.writeHead(status, JSON_HEAD); return res.end(JSON.stringify(json)); }
        catch (e) { res.writeHead(502, JSON_HEAD); return res.end(JSON.stringify({ error: "door unreachable", detail: String(e && e.message ? e.message : e).slice(0, 120) })); }
      }
      res.writeHead(405, JSON_HEAD); return res.end(JSON.stringify({ error: "unsupported POST route" }));
    }

    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405, { Allow: "GET, HEAD, POST" }); return res.end("method not allowed"); }
    if (pathname === "/" || pathname === "/index.html") pathname = "/app/index.html";

    if (pathname === "/api/spatial/projection") {
      try {
        const projection = await composeProjection();
        res.writeHead(200, JSON_HEAD);
        return res.end(req.method === "HEAD" ? undefined : JSON.stringify(projection));
      } catch (e) {
        res.writeHead(503, JSON_HEAD);
        return res.end(JSON.stringify({ offline: true, door: BRAIN_DOOR, note: "brain door unreachable — start the brain door (apps/brain localDoor on :7141) and retry", detail: String(e && e.message ? e.message : e).slice(0, 200) }));
      }
    }
    // /api/door — the mind door's status (lockdown state, event count). Proxied GET so the CONSOLE can
    // re-check capability per call and reflect LOCKDOWN immediately. Door down → honest offline status.
    if (pathname === "/api/door") {
      try { const r = await fetch(`${MIND_DOOR}/api/door`, { signal: AbortSignal.timeout(2000) }); res.writeHead(r.status, JSON_HEAD); return res.end(await r.text()); }
      catch { res.writeHead(200, JSON_HEAD); return res.end(JSON.stringify({ schema: "aukora-door-status-v1", enabled: false, offline: true, note: "mind door :7097 not running", grantsAuthority: false })); }
    }
    // /api/models — the door has no model roster (model-free by default). Serve the honest descriptor so the
    // voice pill shows the truth: a model-free memory fallback until a provider is explicitly configured.
    if (pathname === "/api/models") {
      res.writeHead(200, JSON_HEAD);
      return res.end(JSON.stringify({ models: [{ id: "memory-fallback", label: "Model-free · KIRA memory", mode: "model-free-memory-fallback" }], default: "memory-fallback", mode: "model-free-memory-fallback", grantsAuthority: false }));
    }
    // /api/graph — heal ENGINE UNREACHABLE on a healthy boot (R39).
    if (pathname === "/api/graph") {
      res.writeHead(200, JSON_HEAD);
      return res.end(req.method === "HEAD" ? undefined : JSON.stringify(await composeGraph()));
    }
    if (pathname.startsWith("/api/")) {
      // Any other engine API is a separate local service; honest offline keeps donor organs in their states.
      res.writeHead(503, JSON_HEAD);
      return res.end(JSON.stringify({ offline: true, note: "static launcher — this engine door is a separate local service" }));
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
