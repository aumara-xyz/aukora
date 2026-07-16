// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R34 subtractive-transplant contract (issue #23, owner correction).
 *
 * 1. Provenance integrity: every file listed in provenance.json exists and hash-matches its manifest
 *    entry — VERBATIM files therefore remain byte-identical to the donor blobs they were verified
 *    against at transplant time (donor equality itself was proven on the transplant box; the sha256
 *    pin makes any later drift fail here, in CI, without needing the donor checkout).
 * 2. Registry subtraction: shell.js carries exactly the R34 roster — unselected donor organs are gone
 *    from the registry/menu while their files remain in the tree (subtraction, not deletion).
 * 3. Launcher port law: canonical 7096; the donor stack 7090–7095 (incl. the AUMLOK gate :7094 and
 *    binding door :7095) is reserved and never bound.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const base = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = join(base, '..', '..');
const manifest = JSON.parse(readFileSync(join(base, 'provenance.json'), 'utf8'));
const shellJs = readFileSync(join(base, 'app', 'shell.js'), 'utf8');
const launcher = readFileSync(join(base, 'scripts', 'launch.mjs'), 'utf8');

describe('provenance integrity', () => {
  it('anchors the donor repo and commit', () => {
    expect(manifest.donorRepo).toBe('github.com/aumara-xyz/aukora-symbiote');
    expect(manifest.donorCommit).toMatch(/^[0-9a-f]{40}$/);
  });
  it('every manifest file exists and hash-matches (VERBATIM = byte-identical to donor)', () => {
    expect(manifest.files.length).toBeGreaterThan(90);
    for (const f of manifest.files) {
      const p = join(repo, f.path);
      expect(existsSync(p), f.path + ' missing').toBe(true);
      const sha = createHash('sha256').update(readFileSync(p)).digest('hex');
      expect(sha, f.path + ' drifted from provenance').toBe(f.sha256);
    }
  });
  it('exactly one ADAPTED file (shell.js registry subtraction) — everything donor else is VERBATIM', () => {
    const adapted = manifest.files.filter((f) => f.status === 'ADAPTED').map((f) => f.path);
    expect(adapted).toEqual(['apps/spatial/app/shell.js']);
    const statuses = new Set(manifest.files.map((f) => f.status));
    expect([...statuses].sort()).toEqual(['ADAPTED', 'NEW', 'VERBATIM']);
    for (const f of manifest.files.filter((x) => x.status === 'NEW')) {
      expect(f.donorBlob, f.path + ' NEW files must not claim donor blobs').toBeUndefined();
    }
  });
});

describe('registry subtraction — exact R34 roster', () => {
  const organsBlock = /const ORGANS_BUILTIN = \{([\s\S]*?)\n\};/.exec(shellJs)?.[1] ?? '';
  const tabsBlock = /const TABS_BUILTIN = \{([\s\S]*?)\n\};/.exec(shellJs)?.[1] ?? '';
  it('keeps exactly the roster organs in the registry', () => {
    const keys = [...organsBlock.matchAll(/^  '?([a-z0-9-]+)'?:/gm)].map((m) => m[1]).sort();
    expect(keys).toEqual(['app-lab', 'auma', 'aumalive', 'aumlok', 'aura', 'console', 'ghp', 'kira', 'map', 'settings']);
  });
  it('menu tabs carry the roster: ▲ aumalive+auma · ■ aumlok,aura,kira,map,ghp,console,settings · ● app-lab', () => {
    const rows = (tab) => [...(new RegExp(tab + ':\\s*\\[([\\s\\S]*?)\\]', 'm').exec(tabsBlock)?.[1] ?? '').matchAll(/organ: '([a-z0-9-]+)'/g)].map((m) => m[1]);
    expect(rows('organs')).toEqual(['aumalive', 'auma']);
    expect(rows('system')).toEqual(['aumlok', 'aura', 'kira', 'map', 'ghp', 'console', 'settings']);
    expect(rows('yours')).toEqual(['app-lab']);
  });
  it('removed organs are gone from the registry but their donor files remain (subtraction, not deletion)', () => {
    for (const gone of ['council', 'status', 'forge', 'media', 'luminara', 'graticube', 'wolf', 'aukora-xyz', 'arc3', 'browser']) {
      expect(organsBlock, gone + ' must be out of ORGANS_BUILTIN').not.toMatch(new RegExp("^  '?" + gone + "'?:", 'm'));
    }
    for (const kept of ['luminara.js', 'media.js', 'graticube.js', 'forge.js', 'browser.js', 'aukora-xyz.js']) {
      expect(existsSync(join(base, 'app', kept)), kept + ' donor file must remain').toBe(true);
    }
    expect(existsSync(join(base, 'app', 'wolf', 'wolf.js'))).toBe(true);
    expect(existsSync(join(base, 'app', 'arc3', 'arc3.js'))).toBe(true);
  });
  it('donor state machine, corners, and chat lane are untouched', () => {
    expect(shellJs).toMatch(/const state = \{ a: 1, d: 2 \};/);
    expect(shellJs).toMatch(/corner-threads/);
    expect(shellJs).toMatch(/isChatOpen, closeChat/);
    expect(shellJs).toMatch(/materializeShellModel/);
  });
});

describe('launcher port law', () => {
  it('canonical 7096; donor stack 7090–7095 reserved (incl. AUMLOK gate/bind on 7094/7095)', () => {
    expect(launcher).toMatch(/CANONICAL = 7096/);
    expect(launcher).toMatch(/RESERVED = new Set\(\[7090, 7091, 7092, 7093, 7094, 7095\]\)/);
    expect(launcher).toMatch(/EADDRINUSE/);
  });
});
