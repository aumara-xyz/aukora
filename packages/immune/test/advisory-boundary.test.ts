// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R55.1 — the package's HARD boundaries, proven by SYNTAX-AWARE analysis of the shipped source (TypeScript AST),
 * not a comment-stripping regex. The old regex treated `//` inside a string literal as a comment and let code
 * after a URL disappear, and it allowed bare `process.*`. This walks the real parse tree, so string/comment text
 * can never hide a forbidden import or global reference.
 *
 * Boundaries: advisory-only (grants no authority); no actuator (no process/fs/net/child_process/global escape);
 * no persistence (no Convex/KIRA); no prompt wiring (donor `proprioception` excluded); self-contained (only
 * relative sibling imports); terminology metaphorical (no positive aliveness/production claim).
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync, type Dirent } from 'node:fs';
import { join, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import * as immune from '@aukora/immune';
import { immuneGrantsAuthority } from '@aukora/immune';

const pkgRoot = resolve(fileURLToPath(new URL('..', import.meta.url))); // packages/immune (no trailing slash)
const srcDir = join(pkgRoot, 'src');

/** RECURSIVELY collect every shipped .ts under a dir (nested folders included). */
function allTs(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true }) as Dirent[]) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...allTs(p));
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}
// EVERY shipped TypeScript source: the barrel (index.ts) + all of src, recursively — nothing escapes the scan.
const shippedTs = [join(pkgRoot, 'index.ts'), ...allTs(srcDir)];

/** A module reference from the AST. `text: null` marks a dynamic import()/require() whose argument is NOT a
 *  string literal — a computed specifier can smuggle any target past a boundary scan, so it must fail closed. */
interface ModuleRef { readonly text: string | null; readonly dynamic: boolean }
function moduleRefs(code: string): ModuleRef[] {
  const sf = ts.createSourceFile('x.ts', code, ts.ScriptTarget.ES2022, true);
  const out: ModuleRef[] = [];
  const visit = (n: ts.Node): void => {
    if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) out.push({ text: n.moduleSpecifier.text, dynamic: false });
    // `import x = require("…")` (TS import-equals) — a distinct AST node the import/export check above misses.
    if (ts.isImportEqualsDeclaration(n) && ts.isExternalModuleReference(n.moduleReference)) {
      const expr = n.moduleReference.expression;
      out.push({ text: expr && ts.isStringLiteral(expr) ? expr.text : null, dynamic: expr ? !ts.isStringLiteral(expr) : true });
    }
    if (ts.isCallExpression(n)) {
      const isReq = ts.isIdentifier(n.expression) && n.expression.text === 'require';
      const isDynImport = n.expression.kind === ts.SyntaxKind.ImportKeyword;
      if (isReq || isDynImport) {
        const arg = n.arguments[0];
        out.push({ text: arg && ts.isStringLiteral(arg) ? arg.text : null, dynamic: true }); // null ⇒ non-literal
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}
const moduleSpecifiers = (code: string): string[] => moduleRefs(code).map((r) => r.text).filter((t): t is string => t !== null);

/** Bare identifier references (not property names, not declarations) — so `process` used as a global is caught. */
function freeIdentifiers(code: string): Set<string> {
  const sf = ts.createSourceFile('x.ts', code, ts.ScriptTarget.ES2022, true);
  const names = new Set<string>();
  const visit = (n: ts.Node): void => {
    if (ts.isIdentifier(n)) {
      const p = n.parent;
      // Skip ONLY genuine NAME positions — not value positions. Property-access/qualified names, and the KEY of a
      // property assignment/signature/enum member. A property-assignment INITIALIZER (`{ k: process }`) is a VALUE
      // and MUST be collected; a shorthand (`{ process }`) is itself a reference and is collected too.
      const isAccessName = (ts.isPropertyAccessExpression(p) && p.name === n) || (ts.isQualifiedName(p) && p.right === n);
      const isKeyName = (ts.isPropertyAssignment(p) && p.name === n) || (ts.isPropertySignature(p) && p.name === n)
        || (ts.isEnumMember(p) && p.name === n) || (ts.isBindingElement(p) && p.propertyName === n);
      if (!isAccessName && !isKeyName) names.add(n.text);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return names;
}

const FORBIDDEN_GLOBALS = ['process', 'require', 'global', 'globalThis', 'Deno', 'fetch', 'XMLHttpRequest', 'WebSocket', '__dirname', '__filename'];

describe('advisory-only + no authority', () => {
  it('grants no authority and no exported *GrantsAuthority returns true', () => {
    expect(immuneGrantsAuthority()).toBe(false);
    for (const [name, val] of Object.entries(immune)) {
      if (/GrantsAuthority$/.test(name) && typeof val === 'function') expect((val as () => unknown)()).toBe(false);
    }
  });
});

describe('syntax-aware hard-boundary scan (AST, not regex) — recursive over ALL shipped TS incl index.ts', () => {
  it('every shipped source imports ONLY string-literal relative specifiers that RESOLVE inside the package', () => {
    for (const f of shippedTs) {
      for (const ref of moduleRefs(readFileSync(f, 'utf8'))) {
        // (a) fail closed on a non-literal dynamic import/require — a computed target defeats any scan.
        expect(ref.text, `${f}: a non-literal dynamic import/require is forbidden`).not.toBeNull();
        const spec = ref.text as string;
        // (b) relative only (no node builtins, no @aukora/*, no bare packages).
        expect(spec.startsWith('./') || spec.startsWith('../'), `${f} imports non-relative "${spec}"`).toBe(true);
        // (c) RESOLVE the specifier and require it to stay inside packages/immune — rejects traversal escapes
        //     like `./../../apps/seed` that (b) alone would accept.
        const resolved = resolve(dirname(f), spec);
        expect(resolved === pkgRoot || resolved.startsWith(pkgRoot + sep), `${f} import "${spec}" escapes the package → ${resolved}`).toBe(true);
      }
    }
  });
  it('no shipped source references a forbidden runtime global (process/require/global/fetch/…) as a free identifier', () => {
    for (const f of shippedTs) {
      const free = freeIdentifiers(readFileSync(f, 'utf8'));
      for (const g of FORBIDDEN_GLOBALS) expect(free.has(g), `${f} references forbidden global "${g}"`).toBe(false);
    }
  });
  it('the scanner catches a non-literal dynamic import AND a traversal escape (fail-closed regressions)', () => {
    // A file whose ONLY "import" appears inside a string with an embedded // must be seen as import-free.
    const decoy = `const u = "http://evil/import"; const s = '// import { x } from \\"child_process\\"'; export const y = u + s;`;
    expect(moduleSpecifiers(decoy)).toEqual([]);
    // …but a real forbidden import IS caught even when a string mentions a comment marker.
    const real = `import { execSync } from "child_process"; const note = "// harmless";`;
    expect(moduleSpecifiers(real)).toEqual(['child_process']);
    expect(freeIdentifiers('doThing(process.env.SECRET)').has('process')).toBe(true);
    // a computed dynamic import is flagged (text === null) so the boundary test fails closed on it.
    expect(moduleRefs('const m = "child"+"_process"; export const p = import(m);')[0]).toEqual({ text: null, dynamic: true });
    // a traversal specifier resolves OUTSIDE the package.
    const escaped = resolve(join(srcDir, 'x.ts'), '..', './../../apps/seed');
    expect(escaped.startsWith(pkgRoot + sep)).toBe(false);
    // AST escapes now closed: `import x = require(...)`, a property-assignment INITIALIZER, and a shorthand global.
    expect(moduleSpecifiers('import fs = require("child_process");')).toEqual(['child_process']);
    expect(freeIdentifiers('export const o = { danger: process };').has('process')).toBe(true);      // value, not key
    expect(freeIdentifiers('export function f() { return { process }; }').has('process')).toBe(true); // shorthand ref
    expect(freeIdentifiers('export const o = { process: 1 };').has('process')).toBe(false);           // a KEY is not a ref
  });
});

describe('no persistence / no prompt wiring / metaphor-only', () => {
  it('the donor proprioception system-prompt module was deliberately EXCLUDED', () => {
    expect(existsSync(join(srcDir, 'proprioception.ts'))).toBe(false);
  });
  it('no shipped source imports Convex/brain/memory/council/mind (persistence or cross-organ authority)', () => {
    const banned = /(convex|@aukora\/(brain|memory|council|mind|kernel))/;
    for (const f of shippedTs) for (const spec of moduleSpecifiers(readFileSync(f, 'utf8'))) {
      expect(banned.test(spec), `${f} imports "${spec}"`).toBe(false);
    }
  });
  it('barrel carries the metaphor notice; no POSITIVE aliveness/production claim in any shipped source', () => {
    const barrel = readFileSync(join(pkgRoot, 'index.ts'), 'utf8');
    expect(barrel).toMatch(/METAPHOR/);
    const positiveClaim = /\bproduction-?ready\b|\bsentient\b|\bself-?aware\b|\bis alive\b|\bgenuinely alive\b|\bconsciousness\b/i;
    for (const f of shippedTs) expect(positiveClaim.test(readFileSync(f, 'utf8')), `${f} makes a positive claim`).toBe(false);
  });
});
