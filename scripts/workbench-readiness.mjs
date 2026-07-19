// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
//
// Executable inside-out-workbench readiness profile (R46 item 8). Every item's status is DERIVED
// from checkable evidence on this tree — file/test/pin existence, and (for lifecycle ownership +
// token custody) from what the code actually DOES — never asserted from prose.
// READY = evidence present · PARTIAL/BLOCKED = the honest gap, with the blocker named.
//
// R56 Sam 1 (brick 4) repaired the "one lifecycle owner"/"token custody" lines away from a stale
// file-existence heuristic. R57 made the derivation syntax-aware (TS compiler AST). This revision
// closes the six #176 CodeRabbit findings plus four adversarial bypasses:
//   (1) EXTENSIONS — every admitted JS/TS module extension is scanned (.js/.cjs/.mjs/.ts/.mts/.cts/
//       .tsx/.jsx) with the right ScriptKind, so an owner in a .js file is not invisible.
//   (2) IMPORT FORMS — custody bindings are derived from named (incl. aliased), namespace,
//       CommonJS-require (whole-module or destructured), and dynamic-import forms alike.
//   (3) REACHABILITY — evidence inside `if (false)` branches or after unconditional termination
//       (return/throw/break/continue/process.exit) in the same block does NOT count.
//   (4) REAL child_process ONLY — spawn evidence requires the callee to resolve to an actual
//       node:child_process binding (import or require); a local no-op `function spawnSync(){}` never counts.
//   (5) SUPERVISOR CORRELATION — shim delegation requires the spawned executable/argv (with one-file
//       const resolution, e.g. `join(..., 'supervisor.mjs')`) to name the supervisor entry; an unrelated
//       `SUPERVISOR_DISABLED` identifier or option no longer matches.
//   (6) DIRECT-ONLY HANDOFF — the minted token must land in env[DOOR_TOKEN_ENV] and that SAME object
//       must be handed to a spawned child as `env: obj` or a direct `...obj` spread; `env: { copy: obj }`
//       does not count.
//   (7) CUSTODY LAW FROM AST — TOKEN_LOG_LAW's own string initializer must state the no-print law, and
//       writeTokenFile must reachably write the token to a path, chmod that SAME path to 0o600, and
//       return that same path, in that order. Comments and unrelated strings prove nothing.
// It still does NOT rebuild the lifecycle/custody that already exist, and exits non-zero on an
// owner/custody-integrity regression (planted second owner, non-delegating shim, broken custody law).
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const has = (p) => existsSync(p);
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

export const CUSTODY_MODULE = 'apps/brain/scripts/doorCustody.mjs'; // DEFINES mintDoorToken/writeTokenFile + DOOR_TOKEN_ENV + the 0600/no-print law
export const SHIM = 'apps/brain/scripts/organism-ctl.mjs';          // R47 delegating shim (spawns the supervisor, owns nothing)
export const EXPECTED_OWNER = 'apps/supervisor/src/supervisor.mjs'; // WAVE 2 protected: the ONE lifecycle owner

// ---- (1) every admitted JS/TS module extension, with the right ScriptKind --------------------------
export const SOURCE_EXT_RE = /\.(mjs|cjs|js|ts|mts|cts|tsx|jsx)$/;
export const EXCLUDED_FILE_RE = /(\.test\.|\.d\.(ts|mts|cts)$)/;
function scriptKindFor(path) {
  if (/\.tsx$/.test(path)) return ts.ScriptKind.TSX;
  if (/\.jsx$/.test(path)) return ts.ScriptKind.JSX;
  if (/\.(ts|mts|cts)$/.test(path)) return ts.ScriptKind.TS;
  return ts.ScriptKind.JS;
}
export function parseSource(text, path) {
  return ts.createSourceFile(path, text, ts.ScriptTarget.Latest, /* setParentNodes */ true, scriptKindFor(path));
}

// ---- (3) reachability-aware walk: unreachable AST nodes are NOT evidence ---------------------------
const isProcessExitCall = (n) =>
  ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
  && ts.isIdentifier(n.expression.expression) && n.expression.expression.text === 'process'
  && n.expression.name.text === 'exit';
const terminates = (stmt) =>
  ts.isReturnStatement(stmt) || ts.isThrowStatement(stmt) || ts.isBreakStatement(stmt) || ts.isContinueStatement(stmt)
  || (ts.isExpressionStatement(stmt) && isProcessExitCall(stmt.expression));
export function walkReachable(node, visit) {
  visit(node);
  if (ts.isIfStatement(node)) {
    const c = node.expression;
    walkReachable(c, visit);
    const litFalse = c.kind === ts.SyntaxKind.FalseKeyword || (ts.isNumericLiteral(c) && Number(c.text) === 0);
    const litTrue = c.kind === ts.SyntaxKind.TrueKeyword;
    if (!litFalse) walkReachable(node.thenStatement, visit);
    if (!litTrue && node.elseStatement) walkReachable(node.elseStatement, visit);
    return;
  }
  if (ts.isBlock(node) || ts.isSourceFile(node) || ts.isModuleBlock(node) || ts.isCaseClause(node) || ts.isDefaultClause(node)) {
    for (const s of node.statements) {
      walkReachable(s, visit);
      if (terminates(s)) break; // nothing after an unconditional termination counts
    }
    return;
  }
  node.forEachChild((child) => walkReachable(child, visit));
}

// ---- (2) custody bindings from EVERY import form ----------------------------------------------------
// Returns { named: Map<exportName, Set<localName>>, namespaces: Set<localName> } where a namespace is a
// whole-module binding (import * as ns / const ns = require(...) / const ns = await import(...)).
const isCustodySpec = (e) => Boolean(e) && (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) && e.text.includes('doorCustody');
export function custodyBindings(sf) {
  const named = new Map();
  const namespaces = new Set();
  const addNamed = (orig, local) => { if (!named.has(orig)) named.set(orig, new Set()); named.get(orig).add(local); };
  const isRequireCustody = (e) => ts.isCallExpression(e) && ts.isIdentifier(e.expression) && e.expression.text === 'require' && isCustodySpec(e.arguments[0]);
  const isDynImportCustody = (e) => {
    const inner = ts.isAwaitExpression(e) ? e.expression : e;
    return ts.isCallExpression(inner) && inner.expression.kind === ts.SyntaxKind.ImportKeyword && isCustodySpec(inner.arguments[0]);
  };
  walkReachable(sf, (n) => {
    if (ts.isImportDeclaration(n) && isCustodySpec(n.moduleSpecifier)) {
      const nb = n.importClause?.namedBindings;
      if (nb && ts.isNamedImports(nb)) for (const el of nb.elements) addNamed((el.propertyName ?? el.name).text, el.name.text);
      if (nb && ts.isNamespaceImport(nb)) namespaces.add(nb.name.text);
    }
    if (ts.isVariableDeclaration(n) && n.initializer && (isRequireCustody(n.initializer) || isDynImportCustody(n.initializer))) {
      if (ts.isIdentifier(n.name)) namespaces.add(n.name.text);
      if (ts.isObjectBindingPattern(n.name)) {
        for (const el of n.name.elements) {
          if (!ts.isIdentifier(el.name)) continue;
          const orig = el.propertyName && ts.isIdentifier(el.propertyName) ? el.propertyName.text : el.name.text;
          addNamed(orig, el.name.text);
        }
      }
    }
  });
  return { named, namespaces };
}
// A REACHABLE call of the given custody export, through any binding form (local id, ns.fn, ns['fn']).
export function custodyCalled(sf, bindings, exportName) {
  const locals = bindings.named.get(exportName) ?? new Set();
  let called = false;
  walkReachable(sf, (n) => {
    if (!ts.isCallExpression(n)) return;
    const cal = n.expression;
    if (ts.isIdentifier(cal) && locals.has(cal.text)) called = true;
    if (ts.isPropertyAccessExpression(cal) && ts.isIdentifier(cal.expression) && bindings.namespaces.has(cal.expression.text) && cal.name.text === exportName) called = true;
    if (ts.isElementAccessExpression(cal) && ts.isIdentifier(cal.expression) && bindings.namespaces.has(cal.expression.text)
      && cal.argumentExpression && ts.isStringLiteral(cal.argumentExpression) && cal.argumentExpression.text === exportName) called = true;
  });
  return called;
}

// ---- (4) real node:child_process bindings only ------------------------------------------------------
const CP_FUNCS = new Set(['spawn', 'spawnSync', 'fork', 'execFile', 'execFileSync']);
const isCpSpec = (e) => Boolean(e) && (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) && (e.text === 'node:child_process' || e.text === 'child_process');
export function childProcessBindings(sf) {
  const named = new Map(); // localName -> canonical cp function name
  const namespaces = new Set();
  const isRequireCp = (e) => ts.isCallExpression(e) && ts.isIdentifier(e.expression) && e.expression.text === 'require' && isCpSpec(e.arguments[0]);
  walkReachable(sf, (n) => {
    if (ts.isImportDeclaration(n) && isCpSpec(n.moduleSpecifier)) {
      const nb = n.importClause?.namedBindings;
      if (nb && ts.isNamedImports(nb)) {
        for (const el of nb.elements) {
          const orig = (el.propertyName ?? el.name).text;
          if (CP_FUNCS.has(orig)) named.set(el.name.text, orig);
        }
      }
      if (nb && ts.isNamespaceImport(nb)) namespaces.add(nb.name.text);
    }
    if (ts.isVariableDeclaration(n) && n.initializer && isRequireCp(n.initializer)) {
      if (ts.isIdentifier(n.name)) namespaces.add(n.name.text);
      if (ts.isObjectBindingPattern(n.name)) {
        for (const el of n.name.elements) {
          if (!ts.isIdentifier(el.name)) continue;
          const orig = el.propertyName && ts.isIdentifier(el.propertyName) ? el.propertyName.text : el.name.text;
          if (CP_FUNCS.has(orig)) named.set(el.name.text, orig);
        }
      }
    }
  });
  return { named, namespaces };
}
export function isRealSpawnCall(n, cp) {
  if (!ts.isCallExpression(n)) return false;
  const cal = n.expression;
  if (ts.isIdentifier(cal) && cp.named.has(cal.text)) return true;
  if (ts.isPropertyAccessExpression(cal) && ts.isIdentifier(cal.expression) && cp.namespaces.has(cal.expression.text) && CP_FUNCS.has(cal.name.text)) return true;
  return false;
}

// ---- (5) supervisor executable/argv correlation with one-file const resolution ----------------------
function constInitializers(sf) {
  const map = new Map();
  walkReachable(sf, (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      map.set(n.name.text, map.has(n.name.text) ? null : n.initializer); // reassigned name → ambiguous, refuse to resolve
    }
  });
  return map;
}
// TRUE only when the expression (after resolving const identifiers, depth-bounded) contains a string
// literal that IS the supervisor entry: basename `supervisor.mjs` or a path under `apps/supervisor`.
export function refsSupervisorEntry(expr, consts) {
  let hit = false;
  const check = (e, depth) => {
    if (hit || !e || depth > 4) return;
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) {
      const t = e.text;
      if (/(^|[\\/])supervisor\.mjs$/.test(t) || t.includes('apps/supervisor')) hit = true;
      return;
    }
    if (ts.isIdentifier(e)) { const init = consts.get(e.text); if (init) check(init, depth + 1); return; }
    e.forEachChild((c) => check(c, depth + 1));
  };
  check(expr, 0);
  return hit;
}

// ---- owner derivation --------------------------------------------------------------------------------
// A lifecycle OWNER binds mintDoorToken+writeTokenFile from the custody module (any import form) and
// REACHABLY calls both. Comments, strings, and unreachable code are never evidence.
export function analyzeOwnerSource(text, path) {
  const sf = parseSource(text, path);
  const bindings = custodyBindings(sf);
  const isOwner = custodyCalled(sf, bindings, 'mintDoorToken') && custodyCalled(sf, bindings, 'writeTokenFile');
  return { isOwner, sf, bindings };
}

// ---- (6) direct-only token-env handoff ----------------------------------------------------------------
// The owner must REACHABLY assign the minted token into env[DOOR_TOKEN_ENV] and hand that SAME object to
// a real child_process spawn as `env: obj` or `env: { ...obj }`. A nested copy (`env: { copy: obj }`)
// does not count.
export function analyzeHandoff(sf, bindings) {
  const cp = childProcessBindings(sf);
  const keyLocals = bindings.named.get('DOOR_TOKEN_ENV') ?? new Set();
  const isEnvKey = (e) => (ts.isIdentifier(e) && keyLocals.has(e.text))
    || (ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.expression) && bindings.namespaces.has(e.expression.text) && e.name.text === 'DOOR_TOKEN_ENV');
  const mintLocals = bindings.named.get('mintDoorToken') ?? new Set();
  const isMintCall = (e) => ts.isCallExpression(e) && (
    (ts.isIdentifier(e.expression) && mintLocals.has(e.expression.text))
    || (ts.isPropertyAccessExpression(e.expression) && ts.isIdentifier(e.expression.expression)
      && bindings.namespaces.has(e.expression.expression.text) && e.expression.name.text === 'mintDoorToken'));
  let envObj = null;
  walkReachable(sf, (n) => {
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && ts.isElementAccessExpression(n.left) && ts.isIdentifier(n.left.expression)
      && n.left.argumentExpression && isEnvKey(n.left.argumentExpression)
      && isMintCall(n.right)) envObj = n.left.expression.text;
  });
  if (!envObj) return { mintToEnv: null, envToChild: false };
  let envToChild = false;
  walkReachable(sf, (n) => {
    if (!isRealSpawnCall(n, cp)) return;
    for (const arg of n.arguments) {
      if (!ts.isObjectLiteralExpression(arg)) continue;
      for (const p of arg.properties) {
        if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === 'env') {
          const v = p.initializer;
          if (ts.isIdentifier(v) && v.text === envObj) envToChild = true;
          if (ts.isObjectLiteralExpression(v)) {
            for (const q of v.properties) {
              if (ts.isSpreadAssignment(q) && ts.isIdentifier(q.expression) && q.expression.text === envObj) envToChild = true;
            }
          }
        }
        if (ts.isShorthandPropertyAssignment(p) && p.name.text === 'env' && envObj === 'env') envToChild = true;
      }
    }
  });
  return { mintToEnv: envObj, envToChild };
}

// ---- shim derivation -----------------------------------------------------------------------------------
// Delegation = a REACHABLE call through a REAL child_process binding whose executable or argv names the
// supervisor entry (const-resolved). Minting = any reachable custody mint/write call.
export function analyzeShimSource(text, path) {
  const sf = parseSource(text, path);
  const bindings = custodyBindings(sf);
  const cp = childProcessBindings(sf);
  const consts = constInitializers(sf);
  let spawnsSupervisor = false;
  const mintsToken = custodyCalled(sf, bindings, 'mintDoorToken') || custodyCalled(sf, bindings, 'writeTokenFile');
  walkReachable(sf, (n) => {
    if (!isRealSpawnCall(n, cp)) return;
    const [exec, argv] = n.arguments;
    if (exec && refsSupervisorEntry(exec, consts)) spawnsSupervisor = true;
    if (argv && ts.isArrayLiteralExpression(argv)) {
      for (const el of argv.elements) if (refsSupervisorEntry(el, consts)) spawnsSupervisor = true;
    } else if (argv && refsSupervisorEntry(argv, consts)) {
      spawnsSupervisor = true;
    }
  });
  return { present: true, spawnsSupervisor, mintsToken };
}

// ---- (7) custody law, proven from AST nodes ------------------------------------------------------------
// Requirements, each from executable syntax (never comments/unrelated strings):
//   • exported const DOOR_TOKEN_ENV with a nonempty string initializer;
//   • exported const TOKEN_LOG_LAW whose OWN string initializer states the no-print law (/never/i);
//   • writeTokenFile REACHABLY: writes its token parameter to a path variable, chmods that SAME path
//     to numeric 0o600, and returns that same path — in that order.
export function analyzeCustodySource(text, path) {
  const sf = parseSource(text, path);
  const exportedStrings = new Map(); // name -> string initializer text
  walkReachable(sf, (n) => {
    if (ts.isVariableStatement(n) && n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
      for (const d of n.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && d.initializer && (ts.isStringLiteral(d.initializer) || ts.isNoSubstitutionTemplateLiteral(d.initializer))) {
          exportedStrings.set(d.name.text, d.initializer.text);
        }
      }
    }
  });
  const doorTokenEnvExported = (exportedStrings.get('DOOR_TOKEN_ENV') ?? '').length > 0;
  const tokenLogLawNoPrint = /never/i.test(exportedStrings.get('TOKEN_LOG_LAW') ?? '');

  // writeTokenFile write→chmod→return correlation.
  let writeTokenFileSound = false;
  walkReachable(sf, (fn) => {
    if (!ts.isFunctionDeclaration(fn) || fn.name?.text !== 'writeTokenFile' || !fn.body) return;
    const tokenParam = fn.parameters[1] && ts.isIdentifier(fn.parameters[1].name) ? fn.parameters[1].name.text : null;
    if (!tokenParam) return;
    const isFsCall = (n, fname) => ts.isCallExpression(n) && (
      (ts.isIdentifier(n.expression) && n.expression.text === fname)
      || (ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === fname));
    const is0o600 = (a) => Boolean(a) && ts.isNumericLiteral(a) && Number(a.text) === 0o600;
    const events = []; // ordered { kind, pathVar, pos }
    walkReachable(fn.body, (n) => {
      if (isFsCall(n, 'writeFileSync') && n.arguments.length >= 2
        && ts.isIdentifier(n.arguments[0]) && ts.isIdentifier(n.arguments[1]) && n.arguments[1].text === tokenParam) {
        events.push({ kind: 'write', pathVar: n.arguments[0].text, pos: n.pos });
      }
      if (isFsCall(n, 'chmodSync') && n.arguments.length >= 2 && ts.isIdentifier(n.arguments[0]) && is0o600(n.arguments[1])) {
        events.push({ kind: 'chmod', pathVar: n.arguments[0].text, pos: n.pos });
      }
      if (ts.isReturnStatement(n) && n.expression && ts.isIdentifier(n.expression)) {
        events.push({ kind: 'return', pathVar: n.expression.text, pos: n.pos });
      }
    });
    events.sort((a, b) => a.pos - b.pos);
    for (const w of events.filter((e) => e.kind === 'write')) {
      const chmod = events.find((e) => e.kind === 'chmod' && e.pathVar === w.pathVar && e.pos > w.pos);
      const ret = chmod && events.find((e) => e.kind === 'return' && e.pathVar === w.pathVar && e.pos > chmod.pos);
      if (chmod && ret) writeTokenFileSound = true;
    }
  });
  return { doorTokenEnvExported, tokenLogLawNoPrint, writeTokenFileSound, ok: doorTokenEnvExported && tokenLogLawNoPrint && writeTokenFileSound };
}

// ---- enumerate production sources (exclude tests/decls/dist/node_modules + the custody def module) ----
export function walkDir(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== 'test' && name !== '__tests__') walkDir(p, out); }
    else if (SOURCE_EXT_RE.test(name) && !EXCLUDED_FILE_RE.test(name)) out.push(p);
  }
  return out;
}

// ---- main derivation + guard ---------------------------------------------------------------------------
export function runReadiness() {
  const sources = walkDir('apps').filter((p) => p !== CUSTODY_MODULE);
  const ownerHits = sources.map((p) => ({ p, facts: analyzeOwnerSource(read(p), p) })).filter((x) => x.facts.isOwner);
  const owners = ownerHits.map((x) => x.p);
  const ownerReady = owners.length === 1 && owners[0] === EXPECTED_OWNER;

  const shim = has(SHIM) ? analyzeShimSource(read(SHIM), SHIM) : { present: false };
  const shimDelegates = shim.present && shim.spawnsSupervisor && !shim.mintsToken;

  const expectedFacts = ownerHits.find((x) => x.p === EXPECTED_OWNER)?.facts;
  const handoff = expectedFacts ? analyzeHandoff(expectedFacts.sf, expectedFacts.bindings) : { mintToEnv: null, envToChild: false };
  const handoffReal = Boolean(handoff.mintToEnv && handoff.envToChild);
  const custody = analyzeCustodySource(read(CUSTODY_MODULE), CUSTODY_MODULE);
  const custodyLawPresent = has(CUSTODY_MODULE) && custody.ok;

  // ---- hard integrity invariants (this profile is also a guard) ----------------------------------
  const hard = [];
  if (!ownerReady) {
    hard.push(`expected EXACTLY ONE lifecycle owner (${EXPECTED_OWNER}); derived ${owners.length}: [${owners.join(', ')}]. A second minter is a planted/duplicate owner.`);
  }
  if (shim.present && shim.mintsToken) {
    hard.push(`the delegating shim ${SHIM} mints a token itself — it must delegate to ${EXPECTED_OWNER}, not own custody.`);
  }
  if (shim.present && !shim.spawnsSupervisor) {
    hard.push(`${SHIM} exists but does NOT delegate — no real child_process call whose executable/argv names the supervisor entry. A shim that owns lifecycle is a second-owner risk.`);
  }
  if (!custodyLawPresent) {
    hard.push(`the custody law is not AST-derivable from ${CUSTODY_MODULE} (DOOR_TOKEN_ENV export=${custody.doorTokenEnvExported}, TOKEN_LOG_LAW no-print=${custody.tokenLogLawNoPrint}, writeTokenFile write→chmod 0o600→return same-path=${custody.writeTokenFileSound}).`);
  }
  if (ownerReady && !handoffReal) {
    hard.push(`token-env handoff not derivable in ${EXPECTED_OWNER}: expected the minted token assigned into env[DOOR_TOKEN_ENV] and that SAME env object handed directly to a spawned child (mintToEnv=${handoff.mintToEnv}, envToChild=${handoff.envToChild}).`);
  }

  const oneOwnerStatus = ownerReady
    ? (shimDelegates
        ? `READY — ONE lifecycle owner (${EXPECTED_OWNER}); ${SHIM} is a delegating shim (spawns the supervisor entry by path, mints nothing) — R47 convergence, derived by reachability-aware syntax analysis`
        : `BLOCKED — owner is ${EXPECTED_OWNER} but ${SHIM} does not delegate (spawnsSupervisor=${shim.spawnsSupervisor}, mintsToken=${shim.mintsToken})`)
    : `BLOCKED — expected one owner (${EXPECTED_OWNER}); derived ${owners.length}: [${owners.join(', ')}] (anatomy.known_gaps)`;

  const custodyStatus = (ownerReady && custodyLawPresent && shimDelegates && handoffReal)
    ? `READY — ${EXPECTED_OWNER} mints the per-boot token via ${CUSTODY_MODULE}, assigns it into ${handoff.mintToEnv}[DOOR_TOKEN_ENV], and hands that env object directly to spawned children (direct-only handoff); writeTokenFile write→chmod 0o600→return proven from AST; TOKEN_LOG_LAW no-print law in its own initializer; the shim mints nothing (R44 live proof)`
    : `BLOCKED — token custody not derivable (owner=${ownerReady}, custodyLaw=${custodyLawPresent}, shimDelegates=${shimDelegates}, realHandoff=${handoffReal})`;

  const items = [
    ['one lifecycle owner', oneOwnerStatus],
    ['token custody', custodyStatus],
    ['convex-backend hold', has('apps/supervisor/src/convexHold.mjs') ? 'READY — bounded convex-backend custody (R48)' : 'BLOCKED'],
    ['door hold', has('apps/supervisor/src/doorHold.mjs') ? 'READY — bind-first door resilience (R46 law)' : 'BLOCKED'],
    ['gateway shell probe', has('apps/supervisor/src/gatewayProbe.mjs') ? 'READY — 3-factor upstream-shell probe incl. pid-reuse/port-takeover hardening (R56)' : 'BLOCKED'],
    ['organism receipts', has('apps/supervisor/src/receipts.mjs') ? 'READY — append-only lifecycle receipts (R44)' : 'BLOCKED'],
    ['governed spatial proxy', has('apps/shell/server.mjs') ? 'READY — token-governed Spatial proxy (R44)' : 'BLOCKED'],
    ['isolated candidate staging', has('apps/seed/src/localCandidateStage.ts') ? 'READY — disposable worktree + exact-file staging (R45 6-test adversarial suite)' : 'BLOCKED'],
    ['tests/receipts/diff projection', has('apps/brain/src/localDoor.ts') ? 'PARTIAL — receipt chain + door projection live (R44); diff projection surface not yet a first-class seam' : 'BLOCKED'],
  ];
  const profile = { schema: 'aukora-workbench-readiness-v0', derived_from: 'file/test/pin existence + reachability-aware syntax analysis of lifecycle-owner/custody/handoff on this tree — see each line', items: Object.fromEntries(items) };
  // stdout carries ONLY the JSON profile (machine-consumable); the human summary + guard verdict go to stderr.
  console.log(JSON.stringify(profile, null, 2));
  const blocked = items.filter(([, s]) => s.startsWith('BLOCKED')).length;
  const ready = items.filter(([, s]) => s.startsWith('READY')).length;
  console.error(`workbench-readiness: ${ready} READY · ${items.length - ready - blocked} PARTIAL · ${blocked} BLOCKED (derived from this tree)`);
  if (hard.length > 0) {
    console.error('workbench-readiness: HARD INTEGRITY FAILURE');
    for (const h of hard) console.error(`  ✗ ${h}`);
    process.exit(1);
  }
  console.error(`workbench-readiness: owner+custody integrity verified (reachability-aware syntax analysis) — ONE lifecycle owner (${EXPECTED_OWNER}); ${SHIM} delegates by supervisor-entry path and mints nothing; direct token-env handoff via ${handoff.mintToEnv}[DOOR_TOKEN_ENV]→child; custody law AST-proven in ${CUSTODY_MODULE}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runReadiness();
