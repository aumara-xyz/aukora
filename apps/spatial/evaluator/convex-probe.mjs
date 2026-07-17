// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Local-Convex probe (#115) — detects the OFFICIAL local Convex backend binary and supplies honest labels for
 * the `local Convex settle`, `reactive projection`, and `actual process death` stages, WITHOUT duplicating
 * Sam 2's code. The real live proof is delegated to `npm run canary:r51 --workspace @aukora/brain`
 * (`apps/brain/scripts/r51-canary.mjs`): it spawns the real `convex-local-backend`, does a genuine `kill -9`,
 * restarts on the same on-disk SQLite, and asserts settled state survives — the LIVE_LOCAL, real-process-death
 * evidence. This probe reports availability + the exact prerequisite; it never fabricates a live result.
 *
 * The evaluator's in-process path (canonical-path.mjs) is ALWAYS an IN-PROCESS proof — never a real death.
 * When the binary is absent the settle stage is honestly PARKED with the prerequisite; when present it is
 * LIVE_LOCAL and the real-death proof is the delegated canary (run explicitly via `--live`).
 */
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** Locate the official local Convex backend binary (same discovery Sam 2's canary uses). */
export function findConvexBinary() {
  const explicit = process.env.CONVEX_LOCAL_BACKEND_BINARY;
  if (explicit && existsSync(explicit)) return explicit;
  const root = join(homedir(), '.cache/convex/binaries');
  if (!existsSync(root)) return null;
  for (const name of readdirSync(root)) {
    const bin = join(root, name, 'convex-local-backend');
    if (existsSync(bin)) return bin;
  }
  return null;
}

const PREREQ = [
  'The OFFICIAL local Convex backend (FSL-1.1 binary, run as a dev runtime — use, not source incorporation) is required for LIVE_LOCAL.',
  'Fresh clone: `export CONVEX_AGENT_MODE=anonymous` then `npm run dev:local --workspace @aukora/brain` once primes `~/.cache/convex/binaries/*/convex-local-backend`,',
  'or set CONVEX_LOCAL_BACKEND_BINARY to an official binary. Node 18/20/22/24 must be on PATH for `"use node"` convex actions (on Node 26: `brew install node@22`).',
  'Then the real proof (real kill -9 + restart on the same SQLite): `npm run canary:r51 --workspace @aukora/brain`.',
].join(' ');

export function probeConvex() {
  const binaryPath = findConvexBinary();
  const available = binaryPath !== null;
  if (available) {
    return {
      available: true,
      binaryPath,
      prerequisite: PREREQ,
      settleLabel: 'LIVE_LOCAL',
      settleDetail: 'official local convex-local-backend present; the real durable settle + atomic snapshot is proven by the delegated canary',
      settleEvidence: { durable: true, backend: 'convex-local-backend (official, local, self-hosted)', delegatedProof: 'npm run canary:r51 --workspace @aukora/brain' },
      projectionLabel: 'LIVE_LOCAL',
      projectionDetail: 'the same reactive projection the shell reads (api.nervous.snapshot / api.memory.snapshot) over the live local backend',
      projectionSource: 'local-convex-door',
      processDeath: {
        label: 'LIVE_LOCAL',
        detail: 'REAL process death: the canary `kill -9`s the running convex-local-backend and restarts it on the SAME on-disk SQLite; settled state survives, no duplicate effect. This is a genuine crash, NOT an in-process simulation.',
        delegatedCommand: 'npm run canary:r51 --workspace @aukora/brain',
      },
    };
  }
  return {
    available: false,
    binaryPath: null,
    prerequisite: PREREQ,
    settleLabel: 'PARKED',
    settleDetail: 'official local Convex backend ABSENT — the durable settle cannot run; the in-process path still proves the governed logic. Named prerequisite below.',
    settleEvidence: { durable: false, blocker: 'convex-local-backend not installed', prerequisite: PREREQ },
    projectionLabel: 'TEST_ONLY',
    projectionDetail: 'in-process reactive projection over the real store snapshot (no live backend bound)',
    projectionSource: 'in-process-store',
    processDeath: {
      label: 'PARKED',
      detail: 'REAL process death requires the local Convex backend, which is absent. The in-process path performs NO real death — it is honestly not simulated as one. Install the backend (prerequisite) then run the canary.',
      delegatedCommand: 'npm run canary:r51 --workspace @aukora/brain',
    },
  };
}
