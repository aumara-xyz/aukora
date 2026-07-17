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
import { makeReadSpine } from "./readSpine.mjs"; // R47: donor GET/HEAD-only workbench read spine
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join, normalize, extname, resolve, sep } from "node:path";

const execFileP = promisify(execFile);

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

// ── R47 WORKBENCH SEAMS ────────────────────────────────────────────────────────────────────────────
// The donor shell already knows how to render the inside-out loop (aumlok-signing-assistant-v1,
// /api/kira, /api/status). These seams feed those EXACT donor contracts from the new organism's real
// doors. The launcher keeps a DISPLAY-ONLY ledger of proposals it has proxied (a projection of traffic,
// never authority): rows carry plan fields and hard-false literals only — no key bytes, no signatures.
const REPO_ROOT = resolve(ROOT, "..", "..");
const proposalLedger = new Map(); // proposalHash → display row + the proposalInput needed to re-submit

async function git(...args) {
  try { const { stdout } = await execFileP("git", args, { cwd: REPO_ROOT, timeout: 4000 }); return stdout.trim(); }
  catch { return null; }
}

// Repo read/search fence (donor #44 law): repo-scoped, no traversal/symlink escape, deny secret-shaped
// paths, bounded output, GET-only. A refused read is loud, never silent.
const REPO_DENY = /(^|\/)\.(env|git)|\.pem$|\.key$|secrets?|\.venv|node_modules/i;
function fencedRepoPath(rel) {
  if (typeof rel !== "string" || rel.length === 0 || rel.length > 512) return null;
  const abs = resolve(REPO_ROOT, rel);
  if (!abs.startsWith(REPO_ROOT + sep)) return null;      // traversal escape
  if (REPO_DENY.test(rel) || REPO_DENY.test(abs)) return null; // secret-shaped
  return abs;
}

function ledgerRow(p) {
  // display-only projection — refreshable, restart-lossy (the ledger mirrors proxied traffic, not truth;
  // durable truth stays in door receipts/workflows).
  return {
    proposalHash: p.proposalHash,
    goal: p.goal,
    files: p.files,
    valid: p.valid,
    riskHint: p.riskHint,
    invalidReason: p.invalidReason,
    anyShrinkWarning: false,
    preview: p.preview,
    signCommand: p.signCommand,
    applyHint: p.applyHint,
  };
}

function makeServer() {
  // R47: the donor read spine — GET/HEAD-only projections (fingerprint, confined repo sight, loop, KIRA
  // recall with citations, workflow/receipt/event proxies). It never reads AUKORA_DOOR_TOKEN.
  const spine = makeReadSpine({ repoRoot: join(ROOT, "..", ".."), doorBase: BRAIN_DOOR });
  return createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    let pathname = decodeURIComponent(parsedUrl.pathname);
    if (spine.canHandle(pathname)) return spine.handle(req, res, parsedUrl);
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
      // R47: /api/propose — proxied to the governed door WITH the token; the response's PLAN fields are
      // captured into the display ledger so the donor AUMLOK surface can show the pending intent.
      if (pathname === "/api/propose") {
        try {
          const body = await readJsonBody(req);
          const { status, json } = await postMind("/api/propose", body, clientSignal);
          const pi = body && body.proposalInput && typeof body.proposalInput === "object" ? body.proposalInput : null;
          if (json && typeof json.proposalHash === "string" && pi) {
            proposalLedger.set(json.proposalHash, {
              proposalInput: pi, nonce: typeof body.nonce === "string" ? body.nonce : "",
              row: ledgerRow({
                proposalHash: json.proposalHash,
                goal: String(pi.id ?? "(intent)"),
                files: [String(pi.targetPath ?? "?")],
                valid: json.ok === true,
                riskHint: "phase " + String(json.phase ?? "?") + " · " + String(json.reasonClass ?? "")
                  + (body.fuSidecar && body.fuSidecar.outcome ? " · Fu: advisory (bound " + String(json.proposalHash).slice(0, 8) + "…)" : " · Fu: none supplied"),
                invalidReason: json.ok === true ? null : String(json.text ?? json.error ?? "refused"),
                preview: [
                  "workflow " + String(json.workflowId ?? "—"),
                  "rehearsal receipt " + String(json.rehearsalReceiptPrefix ?? "—") + "…",
                  "tests/rehearsal: " + (json.ok === true ? "rehearsed green (phase " + String(json.phase) + ")" : "refused: " + String(json.reasonClass)),
                  "signed:false pushed:false touchedMain:false",
                ],
                signCommand: "# produce the owner authorization OUT of the browser (terminal, key never here):\nnpx tsx apps/seed/scripts/owner-authorize.ts --proposal " + String(json.proposalHash),
                applyHint: "then paste the authorization JSON into this card's approve box (submits to /api/aumlok/approve → door /api/materialize)",
              }),
            });
          }
          res.writeHead(status, JSON_HEAD);
          return res.end(JSON.stringify(json));
        } catch (e) {
          res.writeHead(502, JSON_HEAD);
          return res.end(JSON.stringify({ error: "door unreachable", detail: String(e && e.message ? e.message : e).slice(0, 120) }));
        }
      }
      // R47: /api/aumlok/approve — the UI submits ALREADY-PRODUCED owner authorization (candidateAuth
      // JSON from the terminal ceremony). The launcher reconstitutes the ledger's proposalInput and
      // relays to the door's explicit materialize route. It never creates, holds, or logs key material.
      if (pathname === "/api/aumlok/approve") {
        try {
          const body = await readJsonBody(req);
          const entry = typeof body.proposalHash === "string" ? proposalLedger.get(body.proposalHash) : null;
          if (!entry) { res.writeHead(404, JSON_HEAD); return res.end(JSON.stringify({ error: "unknown proposalHash (the display ledger is per-boot; re-propose first)", grantsAuthority: false })); }
          if (!body.candidateAuth || typeof body.candidateAuth !== "object") { res.writeHead(400, JSON_HEAD); return res.end(JSON.stringify({ error: "candidateAuth (owner-produced authorization JSON) required — this surface never creates it", grantsAuthority: false })); }
          const { status, json } = await postMind("/api/materialize", {
            proposalInput: entry.proposalInput, nonce: entry.nonce || "r47-approve-" + String(body.proposalHash).slice(0, 8),
            candidateAuth: body.candidateAuth, ownerArmed: body.ownerArmed === true,
          }, clientSignal);
          if (json && json.ok === true) proposalLedger.delete(body.proposalHash);
          res.writeHead(status, JSON_HEAD);
          return res.end(JSON.stringify(json));
        } catch (e) {
          res.writeHead(502, JSON_HEAD);
          return res.end(JSON.stringify({ error: "door unreachable", detail: String(e && e.message ? e.message : e).slice(0, 120) }));
        }
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
    // R47: /api/aumlok — the donor signing-assistant contract, fed from the display ledger + live door
    // status. Never key bytes; keyId is a FINGERPRINT slot the new organism does not fill yet (absent →
    // the organ's own honest '—'). The donor organ falls back to its labelled mock if this errors.
    if (pathname === "/api/aumlok") {
      let doorUp = false, events = 0;
      try { const d = await fetch(`${MIND_DOOR}/api/door`, { signal: AbortSignal.timeout(1500) }).then((x) => x.json()); doorUp = d.enabled === true; events = Number(d.events ?? 0); } catch { /* down */ }
      res.writeHead(200, JSON_HEAD);
      return res.end(JSON.stringify({
        schema: "aumlok-signing-assistant-v1",
        status: {
          keyPresent: false, // truthful: the NEW organism holds no owner key anywhere near this surface
          keyId: "custody: owner terminal (never here)",
          publicRootPinned: doorUp,
          signerVerifierSplitIntact: true,
          appliedProposalCount: 0,
          rehearsalReceiptCount: events,
        },
        pending: [...proposalLedger.values()].map((e) => e.row),
        grantsAuthority: false,
        note: "display ledger of proposals proxied this boot; durable truth = door receipts/workflows",
      }));
    }
    // R47: /api/kira — the donor KIRA-organ contract from the canonical brain door (live reads only).
    if (pathname === "/api/kira") {
      try {
        const [snap, health] = await Promise.all([getDoor("/snapshot"), getDoor("/health")]);
        const h = (health && health.backend) || {};
        res.writeHead(200, JSON_HEAD);
        return res.end(JSON.stringify({
          present: true, schema: "aukora-brain-door-live",
          updatedAt: new Date().toISOString(),
          atomCount: snap && (snap.liveCount ?? 0), receiptCount: snap && (snap.chainLength ?? h.chainLength ?? 0),
          chainLinked: h.ok === true, grantsAuthority: false,
        }));
      } catch { res.writeHead(200, JSON_HEAD); return res.end(JSON.stringify({ present: false, note: "brain door :7141 unreachable — start it and reload" })); }
    }
    // R47: /api/status — repo fingerprint TRUTH (read-only git), in the donor status-card shape.
    if (pathname === "/api/status") {
      const [head, branch, dirty] = await Promise.all([git("rev-parse", "HEAD"), git("rev-parse", "--abbrev-ref", "HEAD"), git("status", "--porcelain")]);
      const dirtyCount = dirty === null ? null : (dirty === "" ? 0 : dirty.split("\n").length);
      const ready = head !== null;
      const text = "STATE: " + (ready ? "REPO-SIGHT (read-only fingerprint)" : "GIT-UNAVAILABLE")
        + "\n- head: " + String(head) + "\n- branch: " + String(branch) + "\n- dirty files: " + String(dirtyCount)
        + "\n- NOT promotion-ready: this surface is a fingerprint, not a gate; signing stays in the owner terminal";
      res.writeHead(200, JSON_HEAD);
      return res.end(JSON.stringify({ ready, state: ready ? "SIGHTED" : "OFFLINE", text, generatedAt: new Date().toISOString(), head, branch, dirtyCount, grantsAuthority: false }));
    }
    // R47: /api/repo/read + /api/repo/search — owner-triggered, read-only, repo-fenced (donor #44 law).
    if (pathname === "/api/repo/read") {
      const abs = fencedRepoPath(new URL(req.url, "http://x").searchParams.get("path") ?? "");
      if (!abs) { res.writeHead(403, JSON_HEAD); return res.end(JSON.stringify({ refused: true, law: "repo-scoped read only: no traversal, no secret-shaped paths (donor #44)" })); }
      try {
        const data = await readFile(abs, "utf8");
        res.writeHead(200, JSON_HEAD);
        return res.end(JSON.stringify({ path: abs.slice(REPO_ROOT.length + 1), bytes: data.length, truncated: data.length > 40000, content: data.slice(0, 40000), advisory: true, grantsAuthority: false }));
      } catch { res.writeHead(404, JSON_HEAD); return res.end(JSON.stringify({ error: "not found" })); }
    }
    if (pathname === "/api/repo/search") {
      const q = (new URL(req.url, "http://x").searchParams.get("q") ?? "").slice(0, 120);
      if (q.length < 2) { res.writeHead(400, JSON_HEAD); return res.end(JSON.stringify({ error: "q too short" })); }
      const out = await git("grep", "-n", "--max-depth", "8", "-I", "--", q).catch(() => null);
      const hits = (out ?? "").split("\n").filter(Boolean).filter((l) => !REPO_DENY.test(l)).slice(0, 40);
      res.writeHead(200, JSON_HEAD);
      return res.end(JSON.stringify({ q, hits, bounded: true, advisory: true, grantsAuthority: false }));
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
