#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
//
// R56 Sam 1 — durable regression guard for the .gitignore secret-hygiene rules.
// Asserts (via `git check-ignore`) that real local-secret shapes are ignored while
// documented, non-secret templates (.env.example / .env.sample) stay committable.
// A future .gitignore edit that un-ignores a secret shape, or ignores a template,
// fails this guard. Pure/offline; no secret bytes are read or created.

import { execFileSync } from 'node:child_process';

// path -> true if it MUST be ignored, false if it MUST NOT be ignored.
const EXPECTATIONS = {
  '.env': true,
  '.env.local': true,
  '.env.production': true,
  'secrets/token.txt': true,
  'config.pem': true,
  'server.key': true,
  'id_rsa': true,
  'id_ed25519': true,
  '.npmrc': true,
  'credentials.json': true,
  // Documented templates must remain committable.
  '.env.example': false,
  '.env.sample': false,
  '.env.local.example': false,
  'README.md': false,
};

function isIgnored(path) {
  try {
    // `git check-ignore <path>` exits 0 and echoes the path when ignored, 1 when not.
    const out = execFileSync('git', ['check-ignore', path], { encoding: 'utf8' }).trim();
    return out.length > 0;
  } catch {
    return false; // non-zero exit => not ignored
  }
}

const failures = [];
for (const [path, mustBeIgnored] of Object.entries(EXPECTATIONS)) {
  const ignored = isIgnored(path);
  if (ignored !== mustBeIgnored) {
    failures.push(
      `  ✗ ${path}: expected ${mustBeIgnored ? 'IGNORED' : 'committable'}, got ${ignored ? 'IGNORED' : 'committable'}`,
    );
  }
}

if (failures.length > 0) {
  console.error('gitignore-secrets: FAIL — secret-hygiene rules regressed:');
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`gitignore-secrets: verified — ${Object.keys(EXPECTATIONS).length} paths classify correctly (real secrets ignored, templates committable).`);
