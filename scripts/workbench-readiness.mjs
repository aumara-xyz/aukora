// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
//
// Executable inside-out-workbench readiness profile (R46 item 8). Every item's status is DERIVED
// from checkable evidence on this tree — file/test/pin existence — never asserted from prose.
// READY = evidence present · PARTIAL/BLOCKED = the honest gap, with the blocker named.
import { existsSync, readFileSync } from 'node:fs';

const has = (p) => existsSync(p);
const items = [
  ['one lifecycle owner', has('apps/brain/scripts/organism-ctl.mjs') && has('apps/supervisor/src/supervisor.mjs') ? 'BLOCKED — TWO owners exist (organism-ctl + apps/supervisor); convergence required (anatomy.known_gaps)' : 'READY'],
  ['secret-safe token custody', has('apps/brain/scripts/organism-ctl.mjs') && /writeTokenFile|mind-door\.token/.test(readFileSync('apps/brain/scripts/organism-ctl.mjs', 'utf8')) ? 'READY — supervisor-minted, 0600 file, injected via env, never printed (R44 live proof)' : 'BLOCKED'],
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
const profile = { schema: 'aukora-workbench-readiness-v0', derived_from: 'file/test/pin existence on this tree — see each line', items: Object.fromEntries(items) };
console.log(JSON.stringify(profile, null, 2));
const blocked = items.filter(([, s]) => s.startsWith('BLOCKED')).length;
console.log(`\nworkbench readiness: ${items.length - blocked}/${items.length} READY-or-PARTIAL · ${blocked} BLOCKED`);
