#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
//
// Executable canonical-repository identity gate (R57A, Sam 4 spatial lane). First segment of
// `test:all` (and therefore of CI): certifies that the tree the suites are about to certify IS the
// canonical repository `aumara-xyz/aukora`, with a typed wrong-repository outcome otherwise.
//
// Checks, in order, all fail-closed:
//   1. the identity manifest in THIS verifier's own tree validates (never the target's manifest);
//   2. the manifest's shared accept/reject vector table still holds (self-check against drift);
//   3. the target directory is a git working tree AND is the repository toplevel;
//   4. the raw `^(remote|url)\.` repo config passes the strict identity law of
//      scripts/repo-identity-core.mjs — exactly one remote (`origin`), exactly one byte-canonical
//      url, canonical pushurl if any, no url.* rewrites, donor origin specially refused;
//   5. (root mode only) package.json still routes test:all through this gate, as an exact
//      `npm run verify:repo-identity` segment — an `echo`-style decoy segment does not count.
//
// The git read is READ-ONLY by construction (`config -z --get-regexp`) and runs a trusted-path git
// in a minimal environment: GIT_DIR/GIT_WORK_TREE and GIT_CONFIG_* env injection are dropped, and
// global/system config are disabled so an insteadOf rewrite in a user dotfile can neither forge
// nor mask the repo's declared identity. This gate certifies the DECLARED config identity; network
// destination identity (proxies, ssh aliases) is out of scope and handled by the hardened git cell
// in the candidate stage.
//
// Usage: node scripts/verify-repo-identity.mjs [--root <path>]
//   --root points the gate at another repository (temp-repo tests); wiring self-check is skipped
//   there, and the manifest still comes from this script's own tree.
import { existsSync, realpathSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadManifest, evaluateRemoteConfig, checkVectors } from './repo-identity-core.mjs';

const SCRIPT_REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = join(SCRIPT_REPO_ROOT, 'repository-identity.json');

// Trusted-path git in a from-scratch minimal env (same law as the candidate stage's git cell):
// never the ambient PATH-resolved git, never inherited GIT_* redirection, no user/system config.
const TRUSTED_GIT_DIRS = ['/usr/bin', '/bin', '/usr/local/bin', '/opt/homebrew/bin'];
function resolveTrustedGit() {
  const override = process.env.AUKORA_TRUSTED_GIT;
  if (typeof override === 'string' && override.startsWith('/') && existsSync(override)) return realpathSync(override);
  for (const dir of TRUSTED_GIT_DIRS) {
    const candidate = join(dir, 'git');
    if (existsSync(candidate)) return candidate;
  }
  throw new Error('no trusted git binary found in a system directory');
}

function gitRead(gitBin, cwd, argv) {
  return execFileSync(gitBin, ['-C', cwd, '-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', ...argv], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      PATH: dirname(gitBin),
      HOME: '/var/empty',
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_SYSTEM: '/dev/null',
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_TERMINAL_PROMPT: '0',
      LANG: 'C',
      LC_ALL: 'C',
    },
  });
}

/** The one typed outcome. Exported for the suites; the CLI prints and exits on it. */
export function runGate(targetRoot, { checkWiring } = { checkWiring: true }) {
  try {
    const loaded = loadManifest(MANIFEST_PATH);
    if (!loaded.ok) return { ok: false, code: loaded.code, detail: loaded.detail };
    const vectors = checkVectors(loaded.manifest);
    if (!vectors.ok) return { ok: false, code: vectors.code, detail: vectors.detail };

    const gitBin = resolveTrustedGit();
    const root = resolve(targetRoot);

    let insideTree = '';
    try {
      insideTree = gitRead(gitBin, root, ['rev-parse', '--is-inside-work-tree']).trim();
    } catch {
      return { ok: false, code: 'not-a-repository', detail: `${root} is not inside a git working tree` };
    }
    if (insideTree !== 'true') {
      return { ok: false, code: 'not-a-repository', detail: `${root} is not inside a git working tree` };
    }
    const toplevel = gitRead(gitBin, root, ['rev-parse', '--show-toplevel']).trim();
    if (realpathSync(toplevel) !== realpathSync(root)) {
      return { ok: false, code: 'root-mismatch', detail: `${root} is not the repository toplevel (${toplevel})` };
    }

    let zRaw = '';
    try {
      zRaw = gitRead(gitBin, root, ['config', '-z', '--get-regexp', '^(remote|url)\\.']);
    } catch {
      zRaw = ''; // no matching keys (or unreadable config) — evaluate('') refuses missing-origin
    }
    const verdict = evaluateRemoteConfig(zRaw, loaded.manifest);
    if (!verdict.ok) return { ok: false, code: verdict.code, detail: verdict.detail };

    if (checkWiring) {
      const pkg = JSON.parse(readFileSync(join(SCRIPT_REPO_ROOT, 'package.json'), 'utf8'));
      if (pkg?.scripts?.['verify:repo-identity'] !== 'node scripts/verify-repo-identity.mjs') {
        return { ok: false, code: 'gate-unwired', detail: 'package.json scripts["verify:repo-identity"] is missing or altered' };
      }
      const segments = String(pkg?.scripts?.['test:all'] ?? '').split('&&').map((s) => s.trim());
      if (!segments.includes('npm run verify:repo-identity')) {
        return { ok: false, code: 'gate-unwired', detail: 'test:all no longer contains an exact `npm run verify:repo-identity` segment' };
      }
    }

    return { ok: true, root, originUrl: verdict.originUrl };
  } catch (e) {
    return { ok: false, code: 'identity-unestablished', detail: `unexpected failure — refusing (${e instanceof Error ? e.message.slice(0, 160) : 'unknown'})` };
  }
}

function main() {
  const args = process.argv.slice(2);
  let targetRoot = SCRIPT_REPO_ROOT;
  let checkWiring = true;
  const i = args.indexOf('--root');
  if (i !== -1) {
    if (typeof args[i + 1] !== 'string' || args[i + 1].length === 0) {
      console.error('repo-identity: REFUSED code=identity-unestablished — --root requires a path');
      process.exit(1);
    }
    targetRoot = args[i + 1];
    checkWiring = false;
  }
  const out = runGate(targetRoot, { checkWiring });
  if (!out.ok) {
    console.error(`repo-identity: REFUSED code=${out.code} — ${out.detail}`);
    process.exit(1);
  }
  console.log(`repo-identity: OK — ${out.root} is the canonical repository (origin ${out.originUrl})`);
}

// Entry detection must survive symlinked paths (node realpaths the main module — a /var vs
// /private/var invocation would otherwise silently skip main() and exit 0, an open-gate failure).
const invokedDirectly = (() => {
  if (!process.argv[1]) return false;
  try { return pathToFileURL(realpathSync(resolve(process.argv[1]))).href === import.meta.url; } catch { return false; }
})();
if (invokedDirectly) main();
