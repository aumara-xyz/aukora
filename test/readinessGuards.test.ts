// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R57 adversarial regression suite for the two truth-brick guards repaired in PR #176:
 * scripts/verify-typecheck-coverage.mjs (exact-segment gate) and scripts/workbench-readiness.mjs
 * (reachability-aware lifecycle-owner/custody derivation). Every case below is a bypass that the
 * pre-R57 guards ACCEPTED; each must now be rejected — and the real tree must still derive READY.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
// @ts-expect-error — plain .mjs module
import { splitCommandSegments, verifyRootScripts } from '../scripts/verify-typecheck-coverage.mjs';
import {
  SOURCE_EXT_RE, EXCLUDED_FILE_RE, CUSTODY_MODULE,
  analyzeOwnerSource, analyzeHandoff, analyzeShimSource, analyzeCustodySource,
  // @ts-expect-error — plain .mjs module
} from '../scripts/workbench-readiness.mjs';

const GOOD_TC = 'npm run build:kernel && npm run typecheck --workspaces --if-present';
const GOOD_TEST_ALL = 'npm run boundary && npm run typecheck:all && npm run test';

describe('R57 exact-segment typecheck gate (finding 1 + echo bypasses)', () => {
  it('splits && / || / ; chains into exact trimmed segments', () => {
    expect(splitCommandSegments('a && b||c ; d')).toEqual(['a', 'b', 'c', 'd']);
  });
  it('accepts the real build-before-typecheck chain', () => {
    expect(verifyRootScripts({ 'typecheck:all': GOOD_TC, 'test:all': GOOD_TEST_ALL })).toEqual([]);
  });
  it('rejects `echo build:kernel` as a build segment', () => {
    const f = verifyRootScripts({ 'typecheck:all': 'echo build:kernel && npm run typecheck --workspaces --if-present', 'test:all': GOOD_TEST_ALL });
    expect(f.some((x: string) => x.includes('build:kernel'))).toBe(true);
  });
  it('rejects build AFTER typecheck (order matters)', () => {
    const f = verifyRootScripts({ 'typecheck:all': 'npm run typecheck --workspaces --if-present && npm run build:kernel', 'test:all': GOOD_TEST_ALL });
    expect(f.length).toBeGreaterThan(0);
  });
  it('rejects a lookalike typecheck segment (extra flags stripped gate)', () => {
    const f = verifyRootScripts({ 'typecheck:all': 'npm run build:kernel && echo npm run typecheck --workspaces --if-present done', 'test:all': GOOD_TEST_ALL });
    expect(f.length).toBeGreaterThan(0);
  });
  it('rejects test:all = "echo typecheck:all" (exact executable required)', () => {
    const f = verifyRootScripts({ 'typecheck:all': GOOD_TC, 'test:all': 'echo typecheck:all' });
    expect(f.some((x: string) => x.includes('typecheck:all'))).toBe(true);
  });
  it('the REAL root package.json passes the exact-segment rules', () => {
    const root = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(verifyRootScripts(root.scripts)).toEqual([]);
  });
});

describe('R57 every admitted JS/TS module extension is scanned (finding 2)', () => {
  it.each(['x.js', 'x.cjs', 'x.mjs', 'x.ts', 'x.mts', 'x.cts', 'x.tsx', 'x.jsx'])('%s is admitted', (name) => {
    expect(SOURCE_EXT_RE.test(name)).toBe(true);
    expect(EXCLUDED_FILE_RE.test(name)).toBe(false);
  });
  it('declaration files and tests stay excluded', () => {
    for (const name of ['x.d.ts', 'x.d.mts', 'x.d.cts', 'x.test.ts', 'x.test.mjs']) expect(EXCLUDED_FILE_RE.test(name)).toBe(true);
  });
  it('an owner written as a plain .js file is derived as an owner', () => {
    const src = `const { mintDoorToken, writeTokenFile } = require('../doorCustody.mjs');
      const t = mintDoorToken(); writeTokenFile('/tmp/org', t);`;
    expect(analyzeOwnerSource(src, 'apps/x/owner.js').isOwner).toBe(true);
  });
});

describe('R57 custody import forms (finding 3: named/aliased/namespace/CJS/dynamic)', () => {
  it('aliased named ESM imports count', () => {
    const src = `import { mintDoorToken as mm, writeTokenFile as ww } from './doorCustody.mjs'; ww('/d', mm());`;
    expect(analyzeOwnerSource(src, 'apps/x/a.mjs').isOwner).toBe(true);
  });
  it('namespace import with member calls counts', () => {
    const src = `import * as custody from './doorCustody.mjs'; custody.writeTokenFile('/d', custody.mintDoorToken());`;
    expect(analyzeOwnerSource(src, 'apps/x/a.mjs').isOwner).toBe(true);
  });
  it('whole-module require with member calls counts', () => {
    const src = `const custody = require('./doorCustody.mjs'); custody.writeTokenFile('/d', custody.mintDoorToken());`;
    expect(analyzeOwnerSource(src, 'apps/x/a.cjs').isOwner).toBe(true);
  });
  it('dynamic import with destructuring counts', () => {
    const src = `const { mintDoorToken, writeTokenFile } = await import('./doorCustody.mjs'); writeTokenFile('/d', mintDoorToken());`;
    expect(analyzeOwnerSource(src, 'apps/x/a.mjs').isOwner).toBe(true);
  });
  it('a comment/string mention is still NOT ownership', () => {
    const src = `// mintDoorToken( writeTokenFile(
      const s = "mintDoorToken( and writeTokenFile( live in doorCustody.mjs";
      console.log(s);`;
    expect(analyzeOwnerSource(src, 'apps/x/a.mjs').isOwner).toBe(false);
  });
});

describe('R57 reachability: unreachable evidence never counts', () => {
  const IMPORTS = `import { mintDoorToken, writeTokenFile } from './doorCustody.mjs';\n`;
  it('owner calls inside `if (false)` do not count', () => {
    const src = IMPORTS + `if (false) { writeTokenFile('/d', mintDoorToken()); }`;
    expect(analyzeOwnerSource(src, 'apps/x/a.mjs').isOwner).toBe(false);
  });
  it('owner calls after unconditional process.exit do not count', () => {
    const src = IMPORTS + `process.exit(0);\nwriteTokenFile('/d', mintDoorToken());`;
    expect(analyzeOwnerSource(src, 'apps/x/a.mjs').isOwner).toBe(false);
  });
  it('owner calls after an unconditional throw do not count', () => {
    const src = IMPORTS + `function f() { throw new Error('x'); writeTokenFile('/d', mintDoorToken()); } f();`;
    expect(analyzeOwnerSource(src, 'apps/x/a.mjs').isOwner).toBe(false);
  });
  it('reachable owner calls DO count (control)', () => {
    const src = IMPORTS + `writeTokenFile('/d', mintDoorToken());`;
    expect(analyzeOwnerSource(src, 'apps/x/a.mjs').isOwner).toBe(true);
  });
});

describe('R57 direct-only token-env handoff (finding 4)', () => {
  const OWNER = `import { spawn } from 'node:child_process';
import { DOOR_TOKEN_ENV, mintDoorToken, writeTokenFile } from './doorCustody.mjs';
const capturedEnv = {};
capturedEnv[DOOR_TOKEN_ENV] = mintDoorToken();
writeTokenFile('/d', 'x');\n`;
  const handoffOf = (tail: string) => {
    const facts = analyzeOwnerSource(OWNER + tail, 'apps/x/a.mjs');
    return analyzeHandoff(facts.sf, facts.bindings);
  };
  it('`env: capturedEnv` (same object) counts', () => {
    expect(handoffOf(`spawn('node', ['c.mjs'], { env: capturedEnv });`)).toEqual({ mintToEnv: 'capturedEnv', envToChild: true });
  });
  it('`env: { ...capturedEnv }` (direct spread) counts', () => {
    expect(handoffOf(`spawn('node', ['c.mjs'], { env: { ...process.env, ...capturedEnv } });`).envToChild).toBe(true);
  });
  it('`env: { debugCopy: capturedEnv }` (nested copy) does NOT count', () => {
    expect(handoffOf(`spawn('node', ['c.mjs'], { env: { debugCopy: capturedEnv } });`).envToChild).toBe(false);
  });
  it('handing the env to a LOCAL no-op spawn does NOT count', () => {
    expect(handoffOf(`function myspawn(a,b,c){}; myspawn('node', ['c.mjs'], { env: capturedEnv });`).envToChild).toBe(false);
  });
});

describe('R57 supervisor executable/argv correlation + real child_process (findings 5–6)', () => {
  it('the real shim shape (const-resolved join argv) delegates', () => {
    const src = `import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
const CHECKOUT = '/repo';
const SUPERVISOR = join(CHECKOUT, 'apps', 'supervisor', 'src', 'supervisor.mjs');
const r = spawnSync('node', [SUPERVISOR, 'up'], { stdio: 'inherit' });
process.exit(r.status ?? 1);`;
    const shim = analyzeShimSource(src, 'apps/brain/scripts/organism-ctl.mjs');
    expect(shim.spawnsSupervisor).toBe(true);
    expect(shim.mintsToken).toBe(false);
  });
  it('an unrelated SUPERVISOR_DISABLED option/identifier is NOT delegation', () => {
    const src = `import { spawnSync } from 'node:child_process';
const SUPERVISOR_DISABLED = true;
spawnSync('node', ['other.mjs'], { SUPERVISOR_DISABLED, note: 'supervisor stays off' });`;
    expect(analyzeShimSource(src, 'apps/x/ctl.mjs').spawnsSupervisor).toBe(false);
  });
  it('a local no-op spawnSync (no child_process binding) is NOT delegation', () => {
    const src = `function spawnSync(a, b) { /* no-op */ }
const SUPERVISOR = 'apps/supervisor/src/supervisor.mjs';
spawnSync('node', [SUPERVISOR]);`;
    expect(analyzeShimSource(src, 'apps/x/ctl.mjs').spawnsSupervisor).toBe(false);
  });
  it('a real spawn inside `if (false)` is NOT delegation', () => {
    const src = `import { spawnSync } from 'node:child_process';
const SUPERVISOR = 'apps/supervisor/src/supervisor.mjs';
if (false) { spawnSync('node', [SUPERVISOR]); }`;
    expect(analyzeShimSource(src, 'apps/x/ctl.mjs').spawnsSupervisor).toBe(false);
  });
  it('namespace-required child_process still counts as real', () => {
    const src = `const cp = require('node:child_process');
const SUPERVISOR = 'apps/supervisor/src/supervisor.mjs';
cp.spawnSync('node', [SUPERVISOR]);`;
    expect(analyzeShimSource(src, 'apps/x/ctl.cjs').spawnsSupervisor).toBe(true);
  });
});

describe('R57 custody law proven from AST (finding 7 + writeTokenFile order bypass)', () => {
  it('the REAL custody module satisfies every AST requirement', () => {
    const real = analyzeCustodySource(readFileSync(CUSTODY_MODULE, 'utf8'), CUSTODY_MODULE);
    expect(real).toMatchObject({ doorTokenEnvExported: true, tokenLogLawNoPrint: true, writeTokenFileSound: true, ok: true });
  });
  it('comments and unrelated strings prove nothing', () => {
    const src = `// the value is never printed; chmodSync(p, 0o600)
export const DOOR_TOKEN_ENV = 'X_TOKEN';
export const TOKEN_LOG_LAW = 'tokens are fine to log';
export function writeTokenFile(dir, token) { return dir; }`;
    const r = analyzeCustodySource(src, 'apps/brain/scripts/doorCustody.mjs');
    expect(r.tokenLogLawNoPrint).toBe(false);
    expect(r.writeTokenFileSound).toBe(false);
  });
  it('chmod on a DIFFERENT path than the write is unsound', () => {
    const src = `import { writeFileSync, chmodSync } from 'node:fs';
export const DOOR_TOKEN_ENV = 'X_TOKEN';
export const TOKEN_LOG_LAW = 'value is never printed';
export function writeTokenFile(dir, token) {
  const p = dir + '/t'; const q = dir + '/u';
  writeFileSync(p, token); chmodSync(q, 0o600); return p;
}`;
    expect(analyzeCustodySource(src, 'apps/x/doorCustody.mjs').writeTokenFileSound).toBe(false);
  });
  it('chmod BEFORE the write (wrong order) is unsound', () => {
    const src = `import { writeFileSync, chmodSync } from 'node:fs';
export const DOOR_TOKEN_ENV = 'X_TOKEN';
export const TOKEN_LOG_LAW = 'value is never printed';
export function writeTokenFile(dir, token) {
  const p = dir + '/t';
  chmodSync(p, 0o600); writeFileSync(p, token); return p;
}`;
    expect(analyzeCustodySource(src, 'apps/x/doorCustody.mjs').writeTokenFileSound).toBe(false);
  });
  it('returning a different variable than the written path is unsound', () => {
    const src = `import { writeFileSync, chmodSync } from 'node:fs';
export const DOOR_TOKEN_ENV = 'X_TOKEN';
export const TOKEN_LOG_LAW = 'value is never printed';
export function writeTokenFile(dir, token) {
  const p = dir + '/t';
  writeFileSync(p, token); chmodSync(p, 0o600); return dir;
}`;
    expect(analyzeCustodySource(src, 'apps/x/doorCustody.mjs').writeTokenFileSound).toBe(false);
  });
  it('a write inside `if (false)` is unsound (unreachable)', () => {
    const src = `import { writeFileSync, chmodSync } from 'node:fs';
export const DOOR_TOKEN_ENV = 'X_TOKEN';
export const TOKEN_LOG_LAW = 'value is never printed';
export function writeTokenFile(dir, token) {
  const p = dir + '/t';
  if (false) { writeFileSync(p, token); }
  chmodSync(p, 0o600); return p;
}`;
    expect(analyzeCustodySource(src, 'apps/x/doorCustody.mjs').writeTokenFileSound).toBe(false);
  });
});

describe('R57 the real tree still derives READY end-to-end', () => {
  it('workbench-readiness exits 0 with pure-JSON stdout and an integrity-verified verdict', () => {
    const r = spawnSync('node', ['scripts/workbench-readiness.mjs'], { encoding: 'utf8' });
    expect(r.status).toBe(0);
    const profile = JSON.parse(r.stdout); // throws if stdout is contaminated
    expect(profile.schema).toBe('aukora-workbench-readiness-v0');
    expect(profile.items['one lifecycle owner']).toMatch(/^READY/);
    expect(profile.items['token custody']).toMatch(/^READY/);
    expect(r.stderr).toMatch(/owner\+custody integrity verified/);
  });
  it('verify-typecheck-coverage exits 0 on the real root manifest', () => {
    const r = spawnSync('node', ['scripts/verify-typecheck-coverage.mjs'], { encoding: 'utf8' });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/typecheck-coverage: verified/);
  });
});
