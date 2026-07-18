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
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import * as immune from '@aukora/immune';
import { immuneGrantsAuthority } from '@aukora/immune';

const srcDir = fileURLToPath(new URL('../src', import.meta.url));
const srcFiles = readdirSync(srcDir).filter((f) => f.endsWith('.ts'));

/** Every import/export module specifier + require('…') argument, extracted from the AST (never from raw text). */
function moduleSpecifiers(code: string): string[] {
  const sf = ts.createSourceFile('x.ts', code, ts.ScriptTarget.ES2022, true);
  const out: string[] = [];
  const visit = (n: ts.Node): void => {
    if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) out.push(n.moduleSpecifier.text);
    if (ts.isCallExpression(n)) {
      const isReq = ts.isIdentifier(n.expression) && n.expression.text === 'require';
      const isDynImport = n.expression.kind === ts.SyntaxKind.ImportKeyword;
      if ((isReq || isDynImport) && n.arguments[0] && ts.isStringLiteral(n.arguments[0])) out.push(n.arguments[0].text);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

/** Bare identifier references (not property names, not declarations) — so `process` used as a global is caught. */
function freeIdentifiers(code: string): Set<string> {
  const sf = ts.createSourceFile('x.ts', code, ts.ScriptTarget.ES2022, true);
  const names = new Set<string>();
  const visit = (n: ts.Node): void => {
    if (ts.isIdentifier(n)) {
      const p = n.parent;
      const isPropertyName = (ts.isPropertyAccessExpression(p) && p.name === n) || (ts.isQualifiedName(p) && p.right === n);
      const isMemberDecl = ts.isPropertyAssignment(p) || ts.isPropertySignature(p) || ts.isBindingElement(p);
      if (!isPropertyName && !isMemberDecl) names.add(n.text);
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

describe('syntax-aware hard-boundary scan (AST, not regex)', () => {
  it('every source imports ONLY relative sibling modules (no node builtins, no @aukora/*, no bare pkgs)', () => {
    for (const f of srcFiles) {
      for (const spec of moduleSpecifiers(readFileSync(join(srcDir, f), 'utf8'))) {
        expect(spec.startsWith('./'), `${f} imports non-relative "${spec}"`).toBe(true);
      }
    }
  });
  it('no source references a forbidden runtime global (process/require/global/fetch/…) as a free identifier', () => {
    for (const f of srcFiles) {
      const free = freeIdentifiers(readFileSync(join(srcDir, f), 'utf8'));
      for (const g of FORBIDDEN_GLOBALS) expect(free.has(g), `${f} references forbidden global "${g}"`).toBe(false);
    }
  });
  it('the scanner itself is not fooled by `//` inside a string or a URL literal (regression on the old regex)', () => {
    // A file whose ONLY "import" appears inside a string with an embedded // must be seen as import-free.
    const decoy = `const u = "http://evil/import"; const s = '// import { x } from \\"child_process\\"'; export const y = u + s;`;
    expect(moduleSpecifiers(decoy)).toEqual([]);
    // …but a real forbidden import IS caught even when a string mentions a comment marker.
    const real = `import { execSync } from "child_process"; const note = "// harmless";`;
    expect(moduleSpecifiers(real)).toEqual(['child_process']);
    expect(freeIdentifiers('doThing(process.env.SECRET)').has('process')).toBe(true);
  });
});

describe('no persistence / no prompt wiring / metaphor-only', () => {
  it('the donor proprioception system-prompt module was deliberately EXCLUDED', () => {
    expect(existsSync(join(srcDir, 'proprioception.ts'))).toBe(false);
  });
  it('no source imports Convex/brain/memory/council/mind (persistence or cross-organ authority)', () => {
    const banned = /^(convex|@aukora\/(brain|memory|council|mind|kernel))/;
    for (const f of srcFiles) for (const spec of moduleSpecifiers(readFileSync(join(srcDir, f), 'utf8'))) {
      expect(banned.test(spec), `${f} imports "${spec}"`).toBe(false);
    }
  });
  it('barrel carries the metaphor notice; no POSITIVE aliveness/production claim in source', () => {
    const barrel = readFileSync(fileURLToPath(new URL('../index.ts', import.meta.url)), 'utf8');
    expect(barrel).toMatch(/METAPHOR/);
    const positiveClaim = /\bproduction-?ready\b|\bsentient\b|\bself-?aware\b|\bis alive\b|\bgenuinely alive\b|\bconsciousness\b/i;
    for (const f of srcFiles) expect(positiveClaim.test(readFileSync(join(srcDir, f), 'utf8')), `${f} makes a positive claim`).toBe(false);
    expect(positiveClaim.test(barrel)).toBe(false);
  });
});
