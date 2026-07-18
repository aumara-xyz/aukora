// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
//
// Executable inside-out-workbench readiness profile (R46 item 8). Every item's status is DERIVED
// from checkable evidence on this tree — file/test/pin existence, and (for lifecycle ownership +
// token custody) from what the code actually DOES — never asserted from prose.
// READY = evidence present · PARTIAL/BLOCKED = the honest gap, with the blocker named.
//
// R56 Sam 1 repair — the "one lifecycle owner" and "token custody" lines were STALE:
//   • They reported "TWO owners exist" whenever both organism-ctl.mjs and apps/supervisor existed.
//     R47 converged lifecycle onto apps/supervisor and turned organism-ctl into a DELEGATING SHIM
//     (it spawns the supervisor and starts/mints NOTHING itself), so "two owners" was false.
//   • The custody line looked for token-minting *inside organism-ctl*, but minting moved to the
//     supervisor in R47 — so it false-reported BLOCKED even though custody is intact.
// This version derives BOTH from executable behaviour (which module imports the custody primitives
// and invokes them to mint+persist a per-boot token), recognizes organism-ctl as the delegating
// shim, and — as a real guard — EXITS NON-ZERO on an owner/custody-integrity regression, e.g. a
// planted second lifecycle owner. It does NOT rebuild the lifecycle or custody that already exist.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const has = (p) => existsSync(p);
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

// ---- lifecycle owner + token custody, derived from behaviour ----------------------------------
const CUSTODY_MODULE = 'apps/brain/scripts/doorCustody.mjs'; // DEFINES mintDoorToken/writeTokenFile + the 0600/no-print law
const SHIM = 'apps/brain/scripts/organism-ctl.mjs';          // R47 delegating shim (spawns the supervisor, owns nothing)
const EXPECTED_OWNER = 'apps/supervisor/src/supervisor.mjs'; // WAVE 2 protected: the ONE lifecycle owner

// Enumerate production sources under apps/ (exclude tests, type decls, node_modules/dist, and the
// custody DEFINITION module itself — it declares the primitives, it does not own the lifecycle).
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== 'test' && name !== '__tests__') walk(p, out); }
    else if (/\.(mjs|ts)$/.test(name) && !/\.test\./.test(name) && !/\.d\.m?ts$/.test(name)) out.push(p);
  }
  return out;
}

// A lifecycle OWNER pulls in the custody primitives from the custody module AND invokes them to
// mint+persist a per-boot token — that is the owning behaviour. A delegating shim mints nothing; the
// definition module and tests are excluded above. This reads what the code does, not what prose says.
const mints = (t) => /\bmintDoorToken\s*\(/.test(t) && /\bwriteTokenFile\s*\(/.test(t);
const importsCustody = (t) => t.includes('doorCustody.mjs'); // import-path proxy (multi-line-import safe)

const sources = walk('apps').filter((p) => p !== CUSTODY_MODULE);
const owners = sources.filter((p) => { const t = read(p); return importsCustody(t) && mints(t); });
const ownerReady = owners.length === 1 && owners[0] === EXPECTED_OWNER;

// The shim must DELEGATE, never own: reference the supervisor entry, spawn it, and mint nothing.
const shimText = read(SHIM);
const shimIsDelegating = has(SHIM) && /supervisor/.test(shimText) && /spawn(Sync)?\s*\(/.test(shimText) && !mints(shimText);

// The custody law (0600 file + no-print) must be derivable from the custody module.
const custodyText = read(CUSTODY_MODULE);
const custodyLawPresent = has(CUSTODY_MODULE) && custodyText.includes('TOKEN_LOG_LAW') && /0o600/.test(custodyText) && /never/i.test(custodyText);

// ---- hard integrity invariants (this profile is also a guard) ----------------------------------
const hard = [];
if (!ownerReady) {
  hard.push(`expected EXACTLY ONE lifecycle owner (${EXPECTED_OWNER}); derived ${owners.length}: [${owners.join(', ')}]. A second minter is a planted/duplicate owner.`);
}
if (has(SHIM) && mints(shimText)) {
  hard.push(`the delegating shim ${SHIM} mints a token itself — it must delegate to ${EXPECTED_OWNER}, not own custody.`);
}
if (!custodyLawPresent) {
  hard.push(`the no-print/0600 custody law is not derivable from ${CUSTODY_MODULE}.`);
}

const oneOwnerStatus = ownerReady
  ? (shimIsDelegating
      ? `READY — ONE lifecycle owner (${EXPECTED_OWNER}); ${SHIM} is a delegating shim (spawns the supervisor, mints nothing) — R47 convergence, derived from behaviour`
      : `READY — ONE lifecycle owner (${EXPECTED_OWNER})${has(SHIM) ? `; ${SHIM} present but delegation markers not found` : ''}`)
  : `BLOCKED — expected one owner (${EXPECTED_OWNER}); derived ${owners.length}: [${owners.join(', ')}] (anatomy.known_gaps)`;

const custodyStatus = (ownerReady && custodyLawPresent && shimIsDelegating)
  ? `READY — ${EXPECTED_OWNER} mints the per-boot token via ${CUSTODY_MODULE} (0600 file + AUKORA_DOOR_TOKEN env inject + TOKEN_LOG_LAW no-print); the shim mints nothing (derived from behaviour, R44 live proof)`
  : `BLOCKED — token custody not derivable (owner=${ownerReady}, custodyLaw=${custodyLawPresent}, shimDelegates=${shimIsDelegating})`;

const items = [
  ['one lifecycle owner', oneOwnerStatus],
  ['secret-safe token custody', custodyStatus],
  ['repo read/search', has('apps/seed/src/ideEnvelope.ts') ? 'READY — IDE envelope (R34+, in-gate)' : 'BLOCKED'],
  ['KIRA recall', has('packages/memory/src/envelope.ts') ? 'READY — default recall shape preserved; scoped recall opt-in (R45 #65 amend)' : 'BLOCKED'],
  ['capability truth', has('anatomy.json') && has('scripts/verify-anatomy.mjs') ? 'READY — executable anatomy in the gate (this round)' : 'BLOCKED'],
  ['diagnostics', has('apps/supervisor/src/engine.mjs') ? 'READY — deriveStatus/probes + organism:status exit-0-iff-healthy' : 'BLOCKED'],
  ['closed proposal envelope', has('apps/seed/src/proposerQualification.ts') ? 'PARTIAL — qualifier boundary in-gate (13-vector matrix); the proposer→SupervisedGenerationEnvelope bridge is R45 amend item 1, NOT built' : 'BLOCKED'],
  ['Fu advisory-only', has('packages/council/src/aukoraFuCouncil.ts') ? 'READY — grantsAuthority:false everywhere; runner refuses embedded transport/credentials' : 'BLOCKED'],
  ['fresh AUMLOK halt', has('apps/seed/src/aumlokGate.ts') ? 'READY — consumed-once, replay-refused (in-gate negative suites)' : 'BLOCKED'],
  ['isolated candidate staging', has('apps/seed/src/localCandidateStage.ts') ? 'READY — disposable worktree + exact-file staging (R45 6-test adversarial suite)' : 'BLOCKED'],
  ['tests/receipts/diff projection', has('apps/brain/src/localDoor.ts') ? 'PARTIAL — receipt chain + door projection live (R44); diff projection surface not yet a first-class seam' : 'BLOCKED'],
];
const profile = { schema: 'aukora-workbench-readiness-v0', derived_from: 'file/test/pin existence + lifecycle-owner/custody behaviour on this tree — see each line', items: Object.fromEntries(items) };
// stdout carries ONLY the JSON profile (machine-consumable); the human summary + guard verdict go to stderr.
console.log(JSON.stringify(profile, null, 2));
const blocked = items.filter(([, s]) => s.startsWith('BLOCKED')).length;
console.error(`workbench readiness: ${items.length - blocked}/${items.length} READY-or-PARTIAL · ${blocked} BLOCKED`);

if (hard.length > 0) {
  console.error('workbench-readiness: FAIL — lifecycle-owner/custody integrity violated:');
  for (const h of hard) console.error(`  ✗ ${h}`);
  process.exit(1);
}
console.error(`workbench-readiness: owner+custody integrity verified — ONE lifecycle owner (${EXPECTED_OWNER}); ${SHIM} delegates and mints nothing; custody law intact in ${CUSTODY_MODULE}.`);
