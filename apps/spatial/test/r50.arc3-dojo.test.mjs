// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R50 · ARC-3 Dojo (#102) — the gate-run path. Runs the reconstructed dojo over the donor's onboard
 * ARC-3-compatible worlds through @aukora/mind, and asserts the falsifiable evidence laws:
 *
 *   1. REPLAY — every episode receipt replays clean against an independent oracle (fresh donor arcade).
 *   2. DETERMINISM — the same (arcadeSeed, gameId, policySeed) yields a byte-identical coreHash.
 *   3. MUTATION BREAKS REPLAY — flipping ONE action, ONE frame hash, or the terminal makes replay INVALID.
 *   4. HONEST LABEL — every receipt is labelled ONBOARD_ARC3_COMPATIBLE and never claims an official win.
 *
 * Under AUKORA_ARC3_WRITE=1 it also writes each episode's content-addressed receipt to arc3-dojo/artifacts/,
 * so `npm run arc3:dojo` and the gate share one code path and one set of numbers.
 */
import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runEpisode, LABEL, DOJO_SCHEMA } from '../arc3-dojo/dojo.mjs';
import { replayEpisode } from '../arc3-dojo/replay.mjs';
import { makeBundle } from '../arc3-dojo/lib/bundle.mjs';
import { createMockArcade } from '../arc3-dojo/donor/mock-arcade.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DOJO = join(HERE, '..', 'arc3-dojo');
const ART = join(DOJO, 'artifacts');

describe('R50 · ARC-3 Dojo — donor byte-provenance is intact (tamper-evident)', () => {
  const prov = JSON.parse(readFileSync(join(DOJO, 'DONOR_PROVENANCE.json'), 'utf8'));
  for (const f of prov.files) {
    it(`${f.donorPath} matches its sha256 pin`, () => {
      const bytes = readFileSync(join(HERE, '..', '..', '..', f.path));
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(f.sha256);
      expect(f.commit ?? prov.donor.commit).toBe('e5768a2fcf974a564ef842551a27bbb6287e6c8b');
    });
  }
});
const WRITE = process.env.AUKORA_ARC3_WRITE === '1';
const ARCADE_SEED = 42;
const POLICY_SEED = 7;
const MAX_STEPS = 400;

const ROSTER = createMockArcade(ARCADE_SEED).listGames().map((g) => g.game_id);

describe('R50 · ARC-3 Dojo — onboard worlds through @aukora/mind, replayable evidence', () => {
  const summary = [];
  for (const gameId of ROSTER) {
    it(`${gameId}: runs, records honest terminal, and replays clean`, () => {
      const { core, coreHash, guid } = runEpisode({ arcadeSeed: ARCADE_SEED, gameId, policySeed: POLICY_SEED, maxSteps: MAX_STEPS });

      // Honest label + never an official claim.
      expect(core.label).toBe(LABEL);
      expect(core.schema).toBe(DOJO_SCHEMA);
      expect(LABEL).toBe('ONBOARD_ARC3_COMPATIBLE');

      // 1. Independent replay is clean.
      const rep = replayEpisode(core);
      expect(rep.ok, `${gameId} replay: ${rep.detail}`).toBe(true);

      // 2. Determinism — same seeds → identical coreHash.
      const again = runEpisode({ arcadeSeed: ARCADE_SEED, gameId, policySeed: POLICY_SEED, maxSteps: MAX_STEPS });
      expect(again.coreHash).toBe(coreHash);

      // Frame-hash chain length is steps+1 (initial + one per step).
      expect(core.frameHashChain.length).toBe(core.steps.length + 1);

      if (WRITE) {
        mkdirSync(ART, { recursive: true });
        writeFileSync(join(ART, `${gameId}.json`), JSON.stringify(makeBundle({ core, coreHash, guid }), null, 2) + '\n');
      }
      summary.push({ gameId, terminal: core.result.terminal, won: core.result.won, levels: core.result.levelsCompleted, winLevels: core.world.winLevels, steps: core.result.steps, coreHash: coreHash.slice(0, 12) });
    });
  }

  it('SUMMARY (honest wins + losses)', () => {
    // eslint-disable-next-line no-console
    for (const s of summary) console.log(`  ${s.gameId.padEnd(14)} ${s.terminal.padEnd(12)} ${s.won ? 'WIN ' : 'loss'} lvl ${s.levels}/${s.winLevels} steps=${String(s.steps).padStart(3)} core=${s.coreHash}`);
    expect(summary.length).toBe(ROSTER.length);
  });
});

describe('R50 · ARC-3 Dojo — mutating one action / frame / terminal breaks replay', () => {
  const gameId = ROSTER[0];
  const base = () => runEpisode({ arcadeSeed: ARCADE_SEED, gameId, policySeed: POLICY_SEED, maxSteps: MAX_STEPS });

  it('a clean receipt replays; mutating one action makes it INVALID', () => {
    const { core } = base();
    expect(replayEpisode(core).ok).toBe(true);
    const mutated = structuredClone(core);
    const idx = Math.min(1, mutated.steps.length - 1);
    const cur = mutated.steps[idx].action.name;
    mutated.steps[idx].action = { name: cur === 'ACTION1' ? 'ACTION2' : 'ACTION1' };
    const r = replayEpisode(mutated);
    expect(r.ok).toBe(false);
    expect(r.mismatchAt).toBeGreaterThanOrEqual(0);
  });

  it('mutating one recorded frame hash makes it INVALID', () => {
    const { core } = base();
    const mutated = structuredClone(core);
    const idx = Math.min(1, mutated.steps.length - 1);
    mutated.steps[idx].hashAfter = 'deadbeef';
    mutated.frameHashChain[idx + 1] = 'deadbeef';
    expect(replayEpisode(mutated).ok).toBe(false);
  });

  it('mutating the recorded terminal / level count makes it INVALID', () => {
    const { core } = base();
    const mutatedTerminal = structuredClone(core);
    mutatedTerminal.result.terminal = mutatedTerminal.result.terminal === 'WIN' ? 'GAME_OVER' : 'WIN';
    expect(replayEpisode(mutatedTerminal).ok).toBe(false);

    const mutatedLevels = structuredClone(core);
    mutatedLevels.result.levelsCompleted = mutatedLevels.result.levelsCompleted + 7;
    expect(replayEpisode(mutatedLevels).ok).toBe(false);
  });
});
