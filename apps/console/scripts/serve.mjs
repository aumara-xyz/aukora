// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
//
// Minimal zero-dependency static file server for the read-only console preview. Node builtins only.
// It serves apps/console/public over GET/HEAD, refuses path traversal, and writes nothing. It exists so
// a reviewer (or the build agent) can open the console locally; it is not part of the shipped console and
// is not a backend for it — the console renders a committed static fixture with no server required.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, normalize, extname } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "127.0.0.1";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = createServer(async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    return res.end("method not allowed");
  }
  let pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  if (pathname === "/") pathname = "/index.html";
  // Resolve inside ROOT and reject anything that escapes it (no traversal, read-only).
  const filePath = normalize(join(ROOT, pathname));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end("forbidden");
  }
  try {
    const data = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": TYPES[extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(req.method === "HEAD" ? undefined : data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("not found");
  }
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`Aukora console (read-only) → http://${HOST}:${PORT}/`);
});
