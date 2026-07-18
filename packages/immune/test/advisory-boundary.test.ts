// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R55 — the package's HARD boundaries, proven structurally from the shipped source (not just asserted in prose):
 * advisory-only (grants no authority), no actuator (no process/fs/net), no persistence (no Convex/KIRA), no prompt
 * wiring (the donor `proprioception` prompt is excluded), terminology is metaphorical.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as immune from '@aukora/immune';
import { immuneGrantsAuthority } from '@aukora/immune';

const srcDir = fileURLToPath(new URL('../src', import.meta.url));
const srcFiles = readdirSync(srcDir).filter((f) => f.endsWith('.ts'));
const codeOf = (f: string) => readFileSync(join(srcDir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');

describe('advisory-only + no authority', () => {
  it('the package grants no authority and never exports a *GrantsAuthority that returns true', () => {
    expect(immuneGrantsAuthority()).toBe(false);
    for (const [name, val] of Object.entries(immune)) {
      if (/GrantsAuthority$/.test(name) && typeof val === 'function') expect((val as () => unknown)()).toBe(false);
    }
  });
});

describe('no actuator / no persistence / no prompt wiring (structural, comments stripped)', () => {
  it('no source imports a process/fs/net/child_process/convex/brain/model module or calls fetch', () => {
    const forbidden = /from ['"](node:)?(child_process|fs|fs\/promises|net|tls|http|https|dns|worker_threads)['"]|@aukora\/(brain|memory|council)|convex|\bfetch\(|execSync|spawnSync|createServer/i;
    for (const f of srcFiles) {
      const code = codeOf(f);
      expect(forbidden.test(code), `${f} touches a forbidden runtime surface`).toBe(false);
    }
  });
  it('the donor proprioception system-prompt module was deliberately EXCLUDED', () => {
    expect(existsSync(join(srcDir, 'proprioception.ts'))).toBe(false);
  });
  it('every source is self-contained: the only imports are relative (./…) sibling modules', () => {
    for (const f of srcFiles) {
      const imports = [...readFileSync(join(srcDir, f), 'utf8').matchAll(/from ['"]([^'"]+)['"]/g)].map((m) => m[1]);
      for (const i of imports) expect(i.startsWith('./'), `${f} imports non-relative "${i}"`).toBe(true);
    }
  });
});

describe('terminology is explicitly metaphorical (no aliveness / production-grade claim)', () => {
  it('the barrel carries the metaphor notice and no POSITIVE aliveness/production claim appears in source', () => {
    const barrel = readFileSync(fileURLToPath(new URL('../index.ts', import.meta.url)), 'utf8');
    expect(barrel).toMatch(/METAPHOR/);
    // POSITIVE-assertion tokens only — the disclaimers legitimately NEGATE "aliveness"/"production-grade",
    // so those words are allowed; a positive claim ("is alive", "production-ready", "sentient", …) is not.
    const positiveClaim = /\bproduction-?ready\b|\bsentient\b|\bself-?aware\b|\bis alive\b|\bgenuinely alive\b|\bconsciousness\b/i;
    for (const f of srcFiles) expect(positiveClaim.test(readFileSync(join(srcDir, f), 'utf8')), `${f} makes a positive aliveness/production claim`).toBe(false);
    expect(positiveClaim.test(barrel)).toBe(false);
  });
});
