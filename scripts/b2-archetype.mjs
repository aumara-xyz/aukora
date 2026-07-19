// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
//
// B2-Game mechanical support (R60, Sam 4 lane). Two small pure primitives that make two B2
// quantities MECHANICAL rather than asserted — so a future scored run cannot fudge coverage or
// quietly raise a budget. This module runs NO game and claims NO result; it only decides
// applicability over declared manifest features and seals a budget table by digest.
//
// (1) archetypeApplies(archetype, gameManifest): an archetype applies to a game IFF every feature
//     it `requires` is present in the game's declared `features`, and none of its `excludes` are.
//     B2b "coverage" is then the fraction of held-out games to which >=1 sealed archetype applies —
//     computed by this predicate over the sealed manifests, never by narration.
//
// (2) sealBudget / verifyBudget: the per-run compute budget is a table whose sha256 is committed to
//     the run manifest before execution. An arm that exceeds budget scores the level failed; the
//     budget cannot be raised after the seal because verifyBudget refuses a table whose digest no
//     longer matches the sealed value.
import { createHash } from 'node:crypto';

const canon = (v) => {
  // deterministic canonical JSON (sorted keys) so the seal is stable across key ordering.
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
};
const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

/** True iff `archetype` mechanically applies to `game`. Both are plain declared-feature records.
 *  Throws on malformed inputs (fail-closed: a malformed archetype/game never "applies"). */
export function archetypeApplies(archetype, game) {
  if (!archetype || typeof archetype !== 'object' || !game || typeof game !== 'object') return false;
  const requires = Array.isArray(archetype.requires) ? archetype.requires : null;
  const excludes = Array.isArray(archetype.excludes) ? archetype.excludes : [];
  const features = Array.isArray(game.features) ? game.features : null;
  if (requires === null || features === null || requires.length === 0) return false;
  const have = new Set(features.map(String));
  if (!requires.every((r) => have.has(String(r)))) return false;
  if (excludes.some((e) => have.has(String(e)))) return false;
  return true;
}

/** Mechanical B2b coverage: fraction of games covered by at least one archetype in the sealed set. */
export function coverageFraction(archetypes, games) {
  if (!Array.isArray(archetypes) || !Array.isArray(games) || games.length === 0) return 0;
  const covered = games.filter((g) => archetypes.some((a) => archetypeApplies(a, g))).length;
  return covered / games.length;
}

/** Seal a budget table: returns its canonical sha256. */
export function sealBudget(budgetTable) {
  return sha256(canon(budgetTable));
}

/** Verify a budget table against a prior seal. A raised/edited budget no longer matches → false. */
export function verifyBudget(budgetTable, seal) {
  return typeof seal === 'string' && seal.length === 64 && sealBudget(budgetTable) === seal;
}
