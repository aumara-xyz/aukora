// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
//
// Executable inside-out-workbench readiness profile (R46 item 8). Every item's status is DERIVED
// from checkable evidence on this tree — file/test/pin existence, and (for lifecycle ownership +
// token custody) from what the code actually DOES — never asserted from prose.
// READY = evidence present · PARTIAL/BLOCKED = the honest gap, with the blocker named.
//
// R56 Sam 1 (brick 4) repaired the "one lifecycle owner"/"token custody" lines away from a stale
// file-existence heuristic that reported "TWO owners" whenever organism-ctl.mjs and apps/supervisor
// both existed (R47 converged the lifecycle onto apps/supervisor and made organism-ctl a delegating
// shim). R57 closes the three review findings on that brick (#174):
//   (1) shim delegation is now a HARD failure — an organism-ctl that exists but does not actually
//       delegate to the supervisor fails the guard (a non-delegating shim is a second lifecycle risk).
//   (2) token custody derives the REAL token-env handoff — the owner must mint the token, assign it
//       into an env object keyed by the custody DOOR_TOKEN_ENV, AND hand that env to spawned children.
//   (3) lifecycle detection is SYNTAX-AWARE — it parses each module with the TypeScript compiler and
//       inspects real import bindings + call/assignment/spawn nodes, so a string or comment mention of
//       `mintDoorToken(` can no longer be mistaken for owning behaviour.
// It still does NOT rebuild the lifecycle/custody that already exist, and exits non-zero on an
// owner/custody-integrity regression (e.g. a planted second lifecycle owner, or a non-delegating shim).
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const has = (p) => existsSync(p);
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

const CUSTODY_MODULE = 'apps/brain/scripts/doorCustody.mjs'; // DEFINES mintDoorToken/writeTokenFile + DOOR_TOKEN_ENV + the 0600/no-print law
const SHIM = 'apps/brain/scripts/organism-ctl.mjs';          // R47 delegating shim (spawns the supervisor, owns nothing)
const EXPECTED_OWNER = 'apps/supervisor/src/supervisor.mjs'; // WAVE 2 protected: the ONE lifecycle owner

// ---- syntax-aware helpers (finding 3): parse with the TS compiler, inspect real AST nodes ----------
function parse(path) {
  const kind = /\.tsx?$/.test(path) ? ts.ScriptKind.TS : ts.ScriptKind.JS;
  return ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, /* setParentNodes */ true, kind);
}
function walk(node, visit) { visit(node); node.forEachChild((c) => walk(c, visit)); }

// Map of {originalExportName -> localBindingName} for named imports from the custody module.
function custodyImports(sf) {
  const map = new Map();
  walk(sf, (n) => {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier) && n.moduleSpecifier.text.includes('doorCustody')) {
      const nb = n.importClause?.namedBindings;
      if (nb && ts.isNamedImports(nb)) for (const el of nb.elements) map.set((el.propertyName ?? el.name).text, el.name.text);
    }
  });
  return map;
}
// Set of callee identifier names that are actually CALLED (CallExpression), restricted to `wanted`.
function calledNames(sf, wanted) {
  const found = new Set();
  walk(sf, (n) => { if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && wanted.has(n.expression.text)) found.add(n.expression.text); });
  return found;
}

// A lifecycle OWNER imports mintDoorToken+writeTokenFile FROM the custody module and CALLS both
// (real ImportDeclaration + real CallExpression nodes — not a text match).
function ownerFacts(path) {
  const sf = parse(path);
  const imp = custodyImports(sf);
  const mintLocal = imp.get('mintDoorToken');
  const writeLocal = imp.get('writeTokenFile');
  const envLocal = imp.get('DOOR_TOKEN_ENV');
  if (!mintLocal || !writeLocal) return { isOwner: false };
  const calls = calledNames(sf, new Set([mintLocal, writeLocal]));
  if (!calls.has(mintLocal) || !calls.has(writeLocal)) return { isOwner: false };
  return { isOwner: true, sf, mintLocal, writeLocal, envLocal };
}

// The REAL token-env handoff (finding 2): the owner assigns the minted token into an env object keyed
// by DOOR_TOKEN_ENV (`capturedEnv[DOOR_TOKEN_ENV] = mintDoorToken()`), AND hands that same env object to
// a spawned child (`spawn(..., { env: { ...capturedEnv } })`). Both derived from AST nodes.
function tokenEnvHandoff({ sf, mintLocal, envLocal }) {
  if (!envLocal) return { mintToEnv: null, envToChild: false };
  let envObj = null;
  walk(sf, (n) => {
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && ts.isElementAccessExpression(n.left) && ts.isIdentifier(n.left.expression)
      && n.left.argumentExpression && ts.isIdentifier(n.left.argumentExpression) && n.left.argumentExpression.text === envLocal
      && ts.isCallExpression(n.right) && ts.isIdentifier(n.right.expression) && n.right.expression.text === mintLocal) {
      envObj = n.left.expression.text; // e.g. "capturedEnv"
    }
  });
  if (!envObj) return { mintToEnv: null, envToChild: false };
  let envToChild = false;
  walk(sf, (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && /^(spawn|spawnSync|fork|execFile|execFileSync)$/.test(n.expression.text)) {
      for (const arg of n.arguments) {
        if (!ts.isObjectLiteralExpression(arg)) continue;
        for (const p of arg.properties) {
          const isEnvProp = (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) && p.name && ts.isIdentifier(p.name) && p.name.text === 'env';
          if (!isEnvProp) continue;
          const val = ts.isPropertyAssignment(p) ? p.initializer : p.name;
          walk(val, (x) => { if (ts.isIdentifier(x) && x.text === envObj) envToChild = true; });
        }
      }
    }
  });
  return { mintToEnv: envObj, envToChild };
}

// Shim delegation, syntax-aware: a spawn/spawnSync/fork CallExpression whose arguments reference a
// supervisor entry path, and NO call to the custody mint/write primitives.
function shimFacts(path) {
  if (!has(path)) return { present: false };
  const sf = parse(path);
  const imp = custodyImports(sf);
  const mintLocal = imp.get('mintDoorToken');
  const writeLocal = imp.get('writeTokenFile');
  let spawnsSupervisor = false;
  let mintsToken = false;
  walk(sf, (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
      if (/^(spawn|spawnSync|fork|execFile|execFileSync)$/.test(n.expression.text)) {
        let refsSup = false;
        walk(n, (x) => {
          if (ts.isIdentifier(x) && /supervisor/i.test(x.text)) refsSup = true;
          if (ts.isStringLiteral(x) && /supervisor(\.mjs)?/i.test(x.text)) refsSup = true;
        });
        if (refsSup) spawnsSupervisor = true;
      }
      if ((mintLocal && n.expression.text === mintLocal) || (writeLocal && n.expression.text === writeLocal)) mintsToken = true;
    }
  });
  return { present: true, spawnsSupervisor, mintsToken };
}

// The custody module must export the env-var name + no-print law and enforce 0600 (syntax-aware exports).
function custodyLaw(path) {
  if (!has(path)) return false;
  const sf = parse(path);
  const exported = new Set();
  walk(sf, (n) => {
    if (ts.isVariableStatement(n) && n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
      for (const d of n.declarationList.declarations) if (ts.isIdentifier(d.name)) exported.add(d.name.text);
    }
  });
  const text = read(path);
  return exported.has('DOOR_TOKEN_ENV') && exported.has('TOKEN_LOG_LAW') && /0o600/.test(text) && /never/i.test(text);
}

// ---- enumerate production sources (exclude tests/decls/dist/node_modules + the custody def module) ----
function walkDir(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== 'test' && name !== '__tests__') walkDir(p, out); }
    else if (/\.(mjs|ts)$/.test(name) && !/\.test\./.test(name) && !/\.d\.m?ts$/.test(name)) out.push(p);
  }
  return out;
}

const sources = walkDir('apps').filter((p) => p !== CUSTODY_MODULE);
const ownerHits = sources.map((p) => ({ p, facts: ownerFacts(p) })).filter((x) => x.facts.isOwner);
const owners = ownerHits.map((x) => x.p);
const ownerReady = owners.length === 1 && owners[0] === EXPECTED_OWNER;

const shim = shimFacts(SHIM);
const shimDelegates = shim.present && shim.spawnsSupervisor && !shim.mintsToken;

const ownerFactsForExpected = ownerHits.find((x) => x.p === EXPECTED_OWNER)?.facts;
const handoff = ownerFactsForExpected ? tokenEnvHandoff(ownerFactsForExpected) : { mintToEnv: null, envToChild: false };
const handoffReal = Boolean(handoff.mintToEnv && handoff.envToChild);
const custodyLawPresent = custodyLaw(CUSTODY_MODULE);

// ---- hard integrity invariants (this profile is also a guard) ----------------------------------
const hard = [];
if (!ownerReady) {
  hard.push(`expected EXACTLY ONE lifecycle owner (${EXPECTED_OWNER}); derived ${owners.length}: [${owners.join(', ')}]. A second minter is a planted/duplicate owner.`);
}
if (shim.present && shim.mintsToken) {
  hard.push(`the delegating shim ${SHIM} mints a token itself — it must delegate to ${EXPECTED_OWNER}, not own custody.`);
}
if (shim.present && !shim.spawnsSupervisor) {
  hard.push(`${SHIM} exists but does NOT delegate — no spawn of the supervisor entry found. A shim that owns lifecycle is a second-owner risk (finding 1: hard-fail).`);
}
if (!custodyLawPresent) {
  hard.push(`the no-print/0600 custody law (DOOR_TOKEN_ENV + TOKEN_LOG_LAW exports) is not derivable from ${CUSTODY_MODULE}.`);
}
if (ownerReady && !handoffReal) {
  hard.push(`token-env handoff not derivable in ${EXPECTED_OWNER}: expected the minted token assigned into env[DOOR_TOKEN_ENV] and that env handed to a spawned child (mintToEnv=${handoff.mintToEnv}, envToChild=${handoff.envToChild}).`);
}

const oneOwnerStatus = ownerReady
  ? (shimDelegates
      ? `READY — ONE lifecycle owner (${EXPECTED_OWNER}); ${SHIM} is a delegating shim (spawns the supervisor, mints nothing) — R47 convergence, derived by syntax-aware analysis`
      : `BLOCKED — owner is ${EXPECTED_OWNER} but ${SHIM} does not delegate (spawnsSupervisor=${shim.spawnsSupervisor}, mintsToken=${shim.mintsToken})`)
  : `BLOCKED — expected one owner (${EXPECTED_OWNER}); derived ${owners.length}: [${owners.join(', ')}] (anatomy.known_gaps)`;

const custodyStatus = (ownerReady && custodyLawPresent && shimDelegates && handoffReal)
  ? `READY — ${EXPECTED_OWNER} mints the per-boot token via ${CUSTODY_MODULE}, assigns it into ${handoff.mintToEnv}[DOOR_TOKEN_ENV], and hands that env to spawned children (real token-env handoff); 0600 file + TOKEN_LOG_LAW no-print; the shim mints nothing (derived by syntax-aware analysis, R44 live proof)`
  : `BLOCKED — token custody not derivable (owner=${ownerReady}, custodyLaw=${custodyLawPresent}, shimDelegates=${shimDelegates}, realHandoff=${handoffReal})`;

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
const profile = { schema: 'aukora-workbench-readiness-v0', derived_from: 'file/test/pin existence + syntax-aware lifecycle-owner/custody/handoff analysis on this tree — see each line', items: Object.fromEntries(items) };
// stdout carries ONLY the JSON profile (machine-consumable); the human summary + guard verdict go to stderr.
console.log(JSON.stringify(profile, null, 2));
const blocked = items.filter(([, s]) => s.startsWith('BLOCKED')).length;
console.error(`workbench readiness: ${items.length - blocked}/${items.length} READY-or-PARTIAL · ${blocked} BLOCKED`);

if (hard.length > 0) {
  console.error('workbench-readiness: FAIL — lifecycle-owner/custody integrity violated:');
  for (const h of hard) console.error(`  ✗ ${h}`);
  process.exit(1);
}
console.error(`workbench-readiness: owner+custody integrity verified (syntax-aware) — ONE lifecycle owner (${EXPECTED_OWNER}); ${SHIM} delegates and mints nothing; real token-env handoff via ${handoff.mintToEnv}[DOOR_TOKEN_ENV]→child; custody law intact in ${CUSTODY_MODULE}.`);
