// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R49 conformance runner (K3 artifact protocol, issue #15).
 *
 * Runs the three reconstructed cells at fixed seeds, writes each cell's content-addressed evidence bundle
 * to conformance/artifacts/<cell>.json, and prints a manifest of coreHashes + node fingerprint. Because
 * every cell is deterministic, the bundles are reproducible: a second node running this prints the SAME
 * coreHashes (its own fingerprint differs — that is the proof it was a different machine).
 *
 * Usage:  node apps/spatial/conformance/run.mjs         (or `npm run conformance --workspace @aukora/spatial`)
 *
 * NOTE: this imports cells that import TS workspace packages (@aukora/seed, @aukora/brain). Run it under a
 * TS-aware loader (vitest owns the gate path — see test/r49.conformance.test.mjs, which also writes bundles).
 * The plain-node entrypoint here is provided for operators on a TS-enabled runtime; the CANONICAL, gate-run
 * evidence is produced by `npm run test --workspace @aukora/spatial` with AUKORA_CONFORMANCE_WRITE=1.
 */
import { makeBundle, writeBundle } from './lib/bundle.mjs';
import * as e1 from './cells/hostile-refusal.mjs';
import * as e2 from './cells/supervisor-lifecycle.mjs';
import * as e3 from './cells/kira-chain.mjs';

const CELLS = [
  { mod: e1, surface: { network: 'none (in-process door handle())', mutatesMain: false } },
  { mod: e2, surface: { network: 'none (pure engine)', mutatesMain: false } },
  { mod: e3, surface: { network: 'none (in-memory store)', mutatesMain: false } },
];

export async function runAll() {
  const manifest = [];
  for (const { mod, surface } of CELLS) {
    const { core, verdict } = await mod.run({});
    const bundle = makeBundle({ core, surface });
    const path = writeBundle(mod.CELL, bundle);
    manifest.push({ cell: mod.CELL, coreHash: bundle.coreHash, pass: verdict.pass, path });
  }
  return manifest;
}

// Direct-run entrypoint.
if (import.meta.url === `file://${process.argv[1]}`) {
  runAll().then((m) => {
    for (const row of m) console.log(`${row.pass ? 'PASS' : 'FAIL'}  ${row.cell}  core=${row.coreHash.slice(0, 16)}…`);
    if (m.some((r) => !r.pass)) process.exit(1);
  }).catch((e) => { console.error(e); process.exit(1); });
}
