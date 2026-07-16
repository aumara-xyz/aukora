// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
//
// Local launcher for the read-only Aukora shell. Binds 127.0.0.1:7093 by default so it runs ALONGSIDE the
// donor Symbiote Spatial app (:7090), the governed door (:7091), and the voice sidecar (:7092) without
// touching any of them. Zero dependencies (Node builtins). Reproducible from a fresh clone:
//   npm run launch --workspace @aukora/console
// It serves apps/console/public read-only over GET/HEAD and refuses path traversal — it writes nothing and
// starts no other process. Override the port with PORT= if 7093 is occupied in your environment.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, normalize, extname } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const PORT = Number(process.env.PORT || 7093);
const HOST = process.env.HOST || "127.0.0.1";
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml" };

const server = createServer(async (req, res) => {
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

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use (another lane may hold it — e.g. arc3-serve on :7093). ` +
      `Run with a different port: PORT=7099 npm run launch --workspace @aukora/console`);
    process.exit(1);
  }
  throw e;
});

server.listen(PORT, HOST, () => {
  console.log(`Aukora shell (read-only)   → http://${HOST}:${PORT}/  (shell.html)`);
  console.log(`Donor Symbiote Spatial     → http://127.0.0.1:7090/  (left undisturbed)`);
  console.log(`Governed door :7091 · voice sidecar :7092 — untouched.`);
});
