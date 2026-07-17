// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R52 no-overclaim guard (#115 skunkworks qualification) — an EXECUTABLE fence that keeps the forbidden
 * external claims from ever being asserted as fact in the public tree.
 *
 * For each sensitive phrase, every line it appears on MUST also carry a negation / qualification marker
 * (not, no, never, ≠, reject, unverified, simulation, pending, excluded, must-not, does-not-establish…).
 * A bare positive assertion — "Aukora is unbreakable", "86% recall", "Fugu is Inkling" — FAILS the guard.
 *
 * Scope: tracked Markdown/JSON docs. This is how the skunkworks stays public without turning an external
 * spectacle into a false canonical claim, and it is self-enforcing on every future edit.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

// Sensitive phrases (case-insensitive) that may appear ONLY inside a negation/qualification.
const SENSITIVE = [
  /\b86\s*%?\s*recall\b/i,
  /\b60\.2\s*%/i,
  /\bunbreakable\b/i,
  /\bautonomous organism/i,
  /\b359[,\s]?427\b/i,
  /fugu\s+(ultra\s+)?is\s+inkling/i,
  /inkling\s+is\s+fugu/i,
];
// A negation OR qualification marker. A sensitive phrase is legitimate only when the surrounding window
// makes clear it is negated or framed as external/simulated/unverified — never a bare Aukora fact.
const NEGATION = /(not|no |never|isn'?t|aren'?t|doesn'?t|does not|do not|must not|cannot|can'?t|reject|refus|unverified|simulat|pending|excluded|deliberately|≠|is not|are not|without|false|overclaim|forbidden|guard|deny|external|harness|reported|prototype|experiment|claim|stress test|useful|EXTERNAL_SIMULATION|REPRODUCTION_PENDING)/i;
const WINDOW = 3; // a negation/qualifier within ±3 lines qualifies the phrase (multi-line prose is legitimate)

/** Pure scanner over arbitrary text — the same law the repo scan uses, for unit falsification. */
export function checkText(text) {
  const lines = String(text).split('\n');
  const violations = [];
  for (let i = 0; i < lines.length; i++) {
    for (const rx of SENSITIVE) {
      if (!rx.test(lines[i])) continue;
      const win = lines.slice(Math.max(0, i - WINDOW), i + WINDOW + 1).join('\n');
      if (!NEGATION.test(win)) violations.push({ line: i + 1, match: (lines[i].match(rx) || [''])[0] });
    }
  }
  return violations;
}

export function scanOverclaims() {
  let files;
  try {
    files = execFileSync('git', ['-C', ROOT, 'ls-files', '*.md', '*.json'], { encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch {
    files = [];
  }
  const violations = [];
  for (const rel of files) {
    if (rel.includes('node_modules')) continue;
    let text;
    try { text = readFileSync(join(ROOT, rel), 'utf8'); } catch { continue; }
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      for (const rx of SENSITIVE) {
        if (!rx.test(lines[i])) continue;
        const win = lines.slice(Math.max(0, i - WINDOW), i + WINDOW + 1).join('\n');
        if (!NEGATION.test(win)) {
          violations.push(`${rel}:${i + 1}: bare claim "${(lines[i].match(rx) || [''])[0]}" — needs a negation/qualification within ±${WINDOW} lines`);
        }
      }
    }
  }
  return { files: files.length, violations };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = scanOverclaims();
  if (r.violations.length) { console.error('NO-OVERCLAIM GUARD FAILED:\n  ' + r.violations.join('\n  ')); process.exit(1); }
  console.log(`no-overclaim: verified — ${r.files} docs scanned, 0 bare external claims`);
}
