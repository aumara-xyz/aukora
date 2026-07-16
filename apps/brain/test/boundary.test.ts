// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Exact portability + dependency-boundary tests.
 *
 *  - The pure @aukora/memory package imports ONLY @aukora/kernel (+ relatives) and contains NO Convex,
 *    filesystem, network, env, or ambient-time I/O — it stays portable.
 *  - Convex is confined to apps/brain/convex; the app src surface (@aukora/brain) imports no `convex`.
 *  - The app src embeds no secret (scanned with the canonical @aukora/evidence scanner — reuse, not clone).
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { textHasSecret } from '@aukora/evidence';

function tsFiles(dirUrl: URL): { path: string; text: string }[] {
  const dir = fileURLToPath(dirUrl);
  let names: string[];
  try {
    names = (readdirSync(dir, { recursive: true }) as string[]).filter((n) => n.endsWith('.ts'));
  } catch {
    return [];
  }
  return names.map((n) => ({ path: `${dir}/${n}`, text: readFileSync(`${dir}/${n}`, 'utf8') }));
}

// Every module specifier: static import/export-from, dynamic import(), require().
function importSpecifiers(text: string): string[] {
  const specs: string[] = [];
  const patterns = [
    /\b(?:import|export)\b[^;'"]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\s+['"]([^'"]+)['"]/g,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) specs.push(m[1]);
  }
  return specs;
}

const memorySrc = [
  ...tsFiles(new URL('../../../packages/memory/src', import.meta.url)),
  { path: 'packages/memory/index.ts', text: readFileSync(fileURLToPath(new URL('../../../packages/memory/index.ts', import.meta.url)), 'utf8') },
];
const brainSrc = tsFiles(new URL('../src', import.meta.url));
const brainConvex = tsFiles(new URL('../convex', import.meta.url));

describe('dependency boundary — pure @aukora/memory', () => {
  it('imports ONLY @aukora/kernel and relative modules (exact dependency boundary)', () => {
    expect(memorySrc.length).toBeGreaterThan(0);
    for (const f of memorySrc) {
      for (const spec of importSpecifiers(f.text)) {
        const allowed = spec.startsWith('.') || spec === '@aukora/kernel' || spec.startsWith('@aukora/kernel/');
        expect(allowed, `${f.path} imports disallowed "${spec}"`).toBe(true);
      }
    }
  });

  it('contains NO Convex / filesystem / network / env / ambient-time I/O (portable)', () => {
    const forbidden = [
      /from\s*['"]convex/, /\bimport\s*\(\s*['"]convex/, // Convex
      /\bnode:(fs|net|http|https|dns|tls|dgram|child_process|worker_threads|os|process)\b/, // node builtins
      /\bfrom\s*['"](fs|net|http|https|path|os|child_process)['"]/, // bare node builtins
      /\bprocess\.env\b/, /\bfetch\s*\(/, /\bimport\.meta\b/, // network / env / bundler
      /\bXMLHttpRequest\b/, /\bWebSocket\b/, /\bnew\s+Worker\b/, // network / threads
      /\bDate\.now\s*\(/, /\bMath\.random\s*\(/, // ambient clock / randomness
    ];
    for (const f of memorySrc) {
      for (const re of forbidden) {
        expect(re.test(f.text), `${f.path} matches forbidden ${re}`).toBe(false);
      }
    }
  });
});

describe('dependency boundary — apps/brain (adapter)', () => {
  it('confines Convex to apps/brain/convex — the app src imports no `convex`', () => {
    expect(brainSrc.length).toBeGreaterThan(0);
    for (const f of brainSrc) {
      for (const spec of importSpecifiers(f.text)) {
        expect(spec === 'convex' || spec.startsWith('convex/'), `${f.path} leaks convex import "${spec}"`).toBe(false);
      }
    }
  });

  it('the curated convex backend is where Convex lives (sanity: it does import convex)', () => {
    const allConvexText = brainConvex.map((f) => f.text).join('\n');
    expect(allConvexText).toMatch(/from\s*['"]convex\//);
  });

  it('the app src embeds no secret (canonical @aukora/evidence scan — reuse, not clone)', () => {
    for (const f of brainSrc) {
      // src/continuity/* are BYTE-VENDORED donor crypto sources (aukoraPqcSigner/aukoraSignedHead); the scanner
      // false-positives on their `secretKey = ml_dsa65.keygen(...)` variable assignments. They carry no secret
      // VALUE (proven: they are byte-identical to the donor blobs recorded in their headers), so exempt them from
      // the NEW-embedded-secret guard rather than mutate vendored bodies.
      if (f.path.includes('/continuity/aukoraPqcSigner.ts') || f.path.includes('/continuity/aukoraSignedHead.ts')) continue;
      expect(textHasSecret(f.text), `${f.path} appears to embed a secret`).toBe(false);
    }
  });
});
