// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Structural containment — proven from the source, not just behaviour:
 *  - the recursion runtime imports no filesystem / network / subprocess module (it cannot touch disk or a live repo);
 *  - the runtime never signs (no `.sign(`), and never imports the signing fixture — signing is an out-of-band owner act;
 *  - the hybrid signature really lives in the owner fixture (both Ed25519 AND ML-DSA-65), so the gate is not Ed25519-only.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (rel: string): string => readFileSync(rel, 'utf8'); // vitest cwd = apps/seed

// The modules on the runtime import graph of the governed recursion + ceremony (NOT the barrel, NOT the fixture).
const RUNTIME_MODULES = [
  'src/recursion.ts', 'src/aumlokGate.ts', 'src/proposal.ts', 'src/ledger.ts', 'src/mockCouncil.ts',
  'src/forbiddenContent.ts', 'src/auraTrace.ts', 'src/capabilities.ts', 'src/geometry.ts',
  'src/ceremony.ts', 'src/ceremonyView.ts',
  'src/pathFence.ts', 'src/ideEnvelope.ts', 'src/eventStream.ts', 'src/metabolism.ts', 'src/councilPack.ts',
  'src/memoryConstitution.ts', 'src/maternalAnchor.ts', 'src/memorySelection.ts', 'src/councilRunnerBoundary.ts',
  'src/ideSession.ts', 'src/selectionAcceptance.ts', 'src/spatialCeremonyAdapter.ts', 'src/contracts.ts',
  'src/durableRecursion.ts',
];

const FORBIDDEN_IMPORT = /\bfrom\s+['"](?:node:)?(?:fs|fs\/promises|child_process|net|tls|http|https|dns|dgram|worker_threads|cluster|vm|repl)['"]/;
const FORBIDDEN_REQUIRE = /\brequire\(\s*['"](?:node:)?(?:fs|child_process|net|tls|http|https|dns|dgram|worker_threads|cluster|vm|repl)['"]/;

describe('runtime touches no disk / network / subprocess', () => {
  for (const mod of RUNTIME_MODULES) {
    it(`${mod} imports no fs/network/subprocess module`, () => {
      const src = read(mod);
      expect(FORBIDDEN_IMPORT.test(src)).toBe(false);
      expect(FORBIDDEN_REQUIRE.test(src)).toBe(false);
    });
  }
});

describe('the runtime never self-signs', () => {
  for (const mod of RUNTIME_MODULES) {
    it(`${mod} contains no signing call and does not import the owner fixture`, () => {
      const src = read(mod);
      expect(src.includes('.sign(')).toBe(false);
      expect(src.includes('ownerFixture')).toBe(false);
    });
  }
});

describe('the AUMLOK gate is genuinely hybrid (not Ed25519-only)', () => {
  it('the owner fixture is the ONLY signer and signs BOTH Ed25519 and ML-DSA-65', () => {
    const fixture = read('src/ownerFixture.ts');
    expect(fixture).toContain('ed25519.sign(');
    expect(fixture).toContain('ml_dsa65.sign(');
  });

  it('the gate verifies via the kernel hybrid API and offers no Ed25519-only path', () => {
    const gate = read('src/aumlokGate.ts');
    expect(gate).toContain('verifyAumlokPromotionV2');
    // no bespoke ed25519.verify fallback in the gate — verification is the kernel hybrid verify only
    expect(gate.includes('ed25519.verify')).toBe(false);
  });
});
