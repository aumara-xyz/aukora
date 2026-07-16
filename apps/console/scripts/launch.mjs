// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
//
// Local launcher for the read-only Aukora shell. CANONICAL PORT: 127.0.0.1:7094 (R33 §8 — 7093 belongs to
// the ARC3 lane's arc3-serve.ts on Sam's box). The launcher NEVER binds 7090 (donor Symbiote Spatial),
// 7091 (governed door), 7092 (voice sidecar) or 7093 (ARC3): if the preferred port is taken it scans
// upward (7094→7099) for a free one and says which it chose, so the donor stack always keeps its ports.
// Zero dependencies (Node builtins), reproducible from a fresh clone:
//   npm run launch --workspace @aukora/console          # canonical (7094, or next free up to 7099)
//   PORT=7180 npm run launch --workspace @aukora/console # explicit override
// Serves apps/console/public read-only over GET/HEAD, refuses traversal, writes nothing, spawns nothing.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, normalize, extname } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const HOST = process.env.HOST || "127.0.0.1";
const CANONICAL = 7094;                      // preferred (R33 §8)
const SCAN_MAX = 7099;                       // upper bound of the auto-scan window
const RESERVED = new Set([7090, 7091, 7092, 7093]); // donor / door / voice / arc3 — never bind these
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".png": "image/png" };

function makeServer() {
  return createServer(async (req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405, { Allow: "GET, HEAD" }); return res.end("method not allowed"); }
    let pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
    if (pathname === "/") pathname = "/shell.html"; // the launcher lands on the spatial shell
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
  console.error(`Port ${explicit} is reserved for the donor stack (7090 spatial · 7091 door · 7092 voice · 7093 arc3). Pick another.`);
  process.exit(1);
}
const candidates = explicit ? [explicit] : [];
if (!explicit) for (let p = CANONICAL; p <= SCAN_MAX; p++) if (!RESERVED.has(p)) candidates.push(p);

let bound = null;
for (const port of candidates) {
  // eslint-disable-next-line no-await-in-loop
  bound = await listenOn(port);
  if (bound) {
    const addr = bound.address();
    if (addr.port !== CANONICAL && !explicit) console.log(`(canonical ${CANONICAL} busy — using next free port)`);
    console.log(`Aukora shell (read-only)   → http://${HOST}:${addr.port}/  (shell.html)`);
    console.log(`Donor Symbiote Spatial     → http://127.0.0.1:7090/  · door :7091 · voice :7092 · arc3 :7093 — all untouched.`);
    break;
  }
}
if (!bound) {
  console.error(`No free port in ${CANONICAL}–${SCAN_MAX}. Run with PORT=<port> to choose one explicitly.`);
  process.exit(1);
}
