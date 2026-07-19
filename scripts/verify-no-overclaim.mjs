#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
//
// R56 Sam 1 — no-overclaim guard (PR-diff mode). Scans the ADDED lines of this branch's diff against
// origin/main for UNQUALIFIED public overclaims and fails the gate on them. The repository's honesty
// posture (CLAIMS.md) forbids asserting the organism is "alive", "production-grade", "mathematically
// proven", "unbreakable", "SAFE TO MERGE", "cannot fail", or "100% secure" without qualification.
//
// It ALLOWS the very same words when they are QUOTED, REFUTED/negated, DISCUSSED, or used in a
// research/negative-result context — e.g. '"unbreakable" is false', 'NOT production-grade',
// 'we do not claim it is alive'. This is a heuristic that deliberately errs toward NOT blocking
// honest text: it fires only on a bare, unqualified boast in newly added lines.
//
// Diff source: `git diff origin/main...HEAD` (three-dot = merge-base), added lines only. On a checkout
// with no origin/main or an empty diff (e.g. main itself, a fresh CI clone) there is nothing to scan.
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// A scanner (and its regression-vector suite) necessarily contains the banned phrases as data — exempt exactly those.
const SCANNER_FIXTURES = new Set(['scripts/verify-no-overclaim.mjs', 'test/noOverclaimGuards.test.ts']);

// Each overclaim is tuned to the ASSERTION form so innocuous words (keep-alive, "is not X") don't trip it.
export const OVERCLAIMS = [
  { name: 'production-grade', re: /\bproduction[\s-]?grade\b/i },
  { name: 'mathematically-proven', re: /\bmathematically[\s-]?proven\b/i },
  { name: 'unbreakable', re: /\bunbreakable\b/i },
  { name: 'SAFE TO MERGE', re: /\bsafe to merge\b/i },
  { name: 'cannot fail', re: /\b(?:cannot|can'?t|will never|never)\s+fail\b/i },
  { name: '100% secure', re: /\b(?:100%|fully|completely|totally|provably)\s+secure\b/i },
  { name: 'guaranteed-safe', re: /\bguaranteed\s+(?:safe|secure|correct|bug-free)\b/i },
  // "alive" only in a genuine living/organism assertion — process-liveness ("daemon is alive") is cleared below.
  { name: 'alive (biological)', re: /\b(?:truly|genuinely|actually|really|literally|is|are|it'?s|we'?re)\s+alive\b/i },
  // R58 (Sam 4): ARC/AGRE result + size claims — the R57A audit found the original phrase list predated
  // the ARC claims (coverage gap). Assertion forms only; quoted/refuted/labeled discussion stays legal.
  { name: 'arc-level-beaten', re: /\b(?:beats?|beaten|conquer(?:s|ed)?)\b[^.\n]{0,32}\blevels?\b|\blevels?\s+beaten\b/i },
  { name: 'arc-game-solved', re: /\b(?:solved?|beats?|beaten|cracked|wins?|won)\b[^.\n]{0,24}\b(?:TU93|LS20|ARC[- ]?AGI(?:-\d)?)\b/i },
  { name: 'arc-official-result', re: /\bofficial\s+ARC(?:[- ]?AGI)?(?:-\d)?[^.\n]{0,16}\b(?:result|score|scorecard|win|generalization)/i },
  { name: 'arc-size-boast', re: /\b\d{2,4}\s?KB\b[^.\n]{0,40}\b(?:engine|reasoning|modules?)\b/i },
];

// A matched phrase is ALLOWED (not an overclaim) when it is quoted, refuted/negated nearby, discussed as a
// term, framed as research/negative, explicitly truth-labeled (the repo's labeling law), or (for "alive")
// clearly about process liveness.
export function allowedReason(line, phrase, idx, len) {
  const esc = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`["'\`]\\s*${esc}\\s*["'\`]`, 'i').test(line)) return 'quoted';
  const before = line.slice(Math.max(0, idx - 32), idx).toLowerCase();
  const after = line.slice(idx + len, idx + len + 32).toLowerCase();
  const win = `${before} ${after}`;
  if (/\b(not|never|isn'?t|aren'?t|don'?t|do not|does not|without|no longer|non-?|refut|disclaim|false|untrue|incorrect|wrong)\b/.test(win)) return 'refuted/negated';
  const masked = (line.slice(0, idx) + ' '.repeat(len) + line.slice(idx + len)).toLowerCase();
  if (/\b(claim|claims|claimed|assert(?:s|ed|ion)?|word|term|phrase|label|overclaim|honesty|caveat|guard|scanner|banned|forbidden|do not use|never say|must not)\b/.test(masked)) return 'discussed';
  // R58: a line that applies one of the repo's explicit truth labels IS the labeling law in action.
  // Deliberately case-sensitive on the UNmasked line: the law writes labels uppercase, and lowercase
  // "inference"/"stale" are ordinary prose that must NOT unlock an assertion.
  if (/\b(UNPROVEN|FALSIFIED|STALE|EXTERNAL_RESEARCH|INFERENCE|RESEARCH_CANDIDATE|MISSING_EVIDENCE)\b/.test(line) || /\btruth[- ]repair(?:ed)?\b/i.test(line)) return 'truth-labeled';
  if (/\b(research|hypothesis|simulated|mock|sandbox|advisory|parked|demonstrated_adapter|not claimed)\b/.test(masked)) return 'research/negative';
  // R58 fix: the matched text is e.g. "is alive" (never starting with "alive"), so the original
  // startsWith('alive') guard could never fire — the documented process-liveness allowance was dead.
  if (/\balive\b/i.test(phrase) && /\b(keep-?alive|process|daemon|heartbeat|port|health|running|serving|socket|connection|liveness|uptime|still running)\b/.test(masked)) return 'process-liveness';
  return null;
}

/** Scan the ADDED lines of a unified diff; returns violations. Exported for the regression suite. */
export function scanAddedLines(diff) {
  const violations = [];
  let curFile = '';
  for (const raw of diff.split('\n')) {
    const fh = raw.match(/^\+\+\+ b\/(.+)$/);
    if (fh) { curFile = fh[1]; continue; }
    if (!raw.startsWith('+') || raw.startsWith('+++')) continue;
    if (SCANNER_FIXTURES.has(curFile)) continue; // the scanner + its vector suite hold the phrases as data
    const line = raw.slice(1);
    for (const oc of OVERCLAIMS) {
      const g = oc.re.flags.includes('g') ? oc.re : new RegExp(oc.re.source, `${oc.re.flags}g`);
      for (const m of line.matchAll(g)) {
        const reason = allowedReason(line, m[0], m.index, m[0].length);
        if (!reason) violations.push({ file: curFile, phrase: oc.name, text: line.trim().slice(0, 140) });
      }
    }
  }
  return violations;
}

function main() {
  let diff = '';
  try {
    diff = execFileSync('git', ['diff', '--unified=0', 'origin/main...HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    console.log('no-overclaim: no origin/main..HEAD diff to scan (skipped).');
    process.exit(0);
  }

  const violations = scanAddedLines(diff);
  if (violations.length > 0) {
    console.error(`no-overclaim: FAIL — ${violations.length} unqualified overclaim(s) in added lines (quote, refute, or qualify them):`);
    for (const v of violations) console.error(`  ✗ [${v.phrase}] ${v.file}: ${v.text}`);
    process.exit(1);
  }
  console.log('no-overclaim: verified — no unqualified overclaims in the added lines of origin/main...HEAD.');
}

// Realpath-robust entry detection (same law as verify-repo-identity.mjs): importing this module for
// tests must execute nothing; a symlinked argv path must still run the CLI.
const invokedDirectly = (() => {
  if (!process.argv[1]) return false;
  try { return pathToFileURL(realpathSync(resolve(process.argv[1]))).href === import.meta.url; } catch { return false; }
})();
if (invokedDirectly) main();
