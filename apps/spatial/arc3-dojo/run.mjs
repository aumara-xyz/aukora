// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * ARC-3 Dojo runner (#102). Runs the fixed roster of onboard worlds at fixed seeds, writes each episode's
 * content-addressed receipt to arc3-dojo/artifacts/<gameId>.json, and prints a manifest of terminals +
 * coreHashes. Deterministic: a second node prints the SAME coreHashes (its fingerprint differs).
 *
 * NOTE: this imports @aukora/mind (TS source), so run it under a TS-aware loader. The CANONICAL, gate-run
 * evidence is produced by `npm run test --workspace @aukora/spatial` with AUKORA_ARC3_WRITE=1 (which drives
 * this same dojo through apps/spatial/test/r50.arc3-dojo.test.mjs). This entrypoint is for TS-enabled ops.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runEpisode } from './dojo.mjs';
import { replayEpisode } from './replay.mjs';
import { makeBundle } from './lib/bundle.mjs';
import { createMockArcade } from './donor/mock-arcade.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ART = join(HERE, 'artifacts');
const ARCADE_SEED = 42, POLICY_SEED = 7, MAX_STEPS = 400;

export function runRoster() {
  const roster = createMockArcade(ARCADE_SEED).listGames().map((g) => g.game_id);
  mkdirSync(ART, { recursive: true });
  const manifest = [];
  for (const gameId of roster) {
    const { core, coreHash, guid } = runEpisode({ arcadeSeed: ARCADE_SEED, gameId, policySeed: POLICY_SEED, maxSteps: MAX_STEPS });
    const rep = replayEpisode(core);
    writeFileSync(join(ART, `${gameId}.json`), JSON.stringify(makeBundle({ core, coreHash, guid }), null, 2) + '\n');
    manifest.push({ gameId, terminal: core.result.terminal, won: core.result.won, levels: `${core.result.levelsCompleted}/${core.world.winLevels}`, steps: core.result.steps, replay: rep.ok, coreHash });
  }
  return manifest;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const m = runRoster();
  for (const r of m) console.log(`${r.replay ? 'REPLAY-OK' : 'REPLAY-FAIL'}  ${r.won ? 'WIN ' : 'loss'}  ${r.gameId.padEnd(14)} lvl ${r.levels} steps=${String(r.steps).padStart(3)} core=${r.coreHash.slice(0, 16)}…`);
  if (m.some((r) => !r.replay)) process.exit(1);
}
