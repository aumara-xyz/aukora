// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R30 spatial-shell contract. Validates the shell's information architecture and the surfaces it adds:
 * the untrusted AUMA advisory context, the DATA-DRIVEN spatial map (counts must equal the real organism
 * state), the honest KNVS placeholder, and the explicit data-mode labels. Also proves the shell REUSES the
 * shared panel renderers rather than duplicating them.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const base = dirname(fileURLToPath(import.meta.url));
const pub = join(base, '..', 'public');
const read = (p: string) => readFileSync(join(pub, p), 'utf-8');
const fixture = JSON.parse(read('fixture.json'));
const shellHtml = read('shell.html');
const shellJs = read('shell.js');
const panelsJs = read('panels.js');
const appJs = read('app.js');
const mapSvg = readFileSync(join(base, '..', 'docs', 'spatial-map.svg'), 'utf-8');

describe('R30 fixture surfaces', () => {
  it('exposes explicit DEMO_FIXTURE / CONVEX_TEST / LIVE mode labels', () => {
    expect(fixture.dataMode).toBe('DEMO_FIXTURE');
    expect(fixture.dataModes).toEqual(['DEMO_FIXTURE', 'CONVEX_TEST', 'LIVE']);
    expect(fixture.dataModes).toContain(fixture.dataMode);
  });

  it('AUMA LIVE advisory context is untrusted and can grant nothing', () => {
    expect(fixture.auma.untrusted).toBe(true);
    expect(fixture.auma.advisoryOutput).toMatch(/^advisory:offline:/);
    for (const verb of ['sign', 'authorize', 'apply', 'merge']) {
      expect(fixture.auma.cannot).toContain(verb);
    }
  });

  it('SPATIAL MAP is driven from real data — counts equal the organism state', () => {
    const sp = fixture.spatial;
    expect(sp.derivedFrom.seats).toBe(fixture.council.roster.length); // 8
    expect(sp.nodes.filter((n: any) => n.kind === 'seat').length).toBe(fixture.council.roster.length);
    expect(sp.nodes.filter((n: any) => String(n.id).startsWith('chain:')).length).toBe(fixture.lineage.entries.length);
    expect(sp.derivedFrom.chainEntries).toBe(fixture.lineage.entries.length);
    // the receipt edge points from the proposal to the real receipt chain index
    const receipt = sp.edges.find((e: any) => e.kind === 'receipt');
    expect(receipt).toBeTruthy();
    expect(receipt.to).toBe('chain:' + sp.derivedFrom.receiptChainIndex);
    expect(sp.edges.some((e: any) => e.kind === 'owner-gate')).toBe(true);
  });

  it('KNVS is an honestly labelled placeholder, not a capability claim', () => {
    expect(fixture.knvs.truth).toBe('ROADMAP');
    expect(fixture.knvs.state).toBe('PLACEHOLDER');
    expect(String(fixture.knvs.note)).toMatch(/placeholder/i);
  });
});

describe('R30 shell structure & accessibility', () => {
  it('presents the exact geometric information architecture as an accessible tablist', () => {
    expect(shellHtml).toMatch(/role="tablist"/);
    const tabs = shellHtml.match(/role="tab"/g) ?? [];
    expect(tabs.length).toBe(6); // AUMA LIVE + AUMLOK/AURA/SPATIAL MAP/SETTINGS + KNVS
    for (const name of ['AUMA LIVE', 'AUMLOK', 'AURA', 'SPATIAL MAP', 'SETTINGS', 'KNVS']) {
      expect(shellHtml).toContain(name);
    }
    expect(shellHtml).toMatch(/shape--triangle/); // Triangle: AUMA LIVE
    expect(shellHtml).toMatch(/shape--square/);   // Square: the four faces
    expect(shellHtml).toMatch(/shape--circle/);   // Circle: KNVS
    const panels = shellHtml.match(/role="tabpanel"/g) ?? [];
    expect(panels.length).toBe(6);
  });

  it('loads the shared renderers and the fixture, and links to the flat console', () => {
    expect(shellHtml).toMatch(/src="fixture\.js"/);
    expect(shellHtml).toMatch(/src="panels\.js"/);
    expect(shellHtml).toMatch(/src="shell\.js"/);
    expect(shellHtml).toMatch(/href="index\.html"/);
  });
});

describe('R30 reuse (no duplicated panels)', () => {
  it('the shared renderers define all ten operator panels once', () => {
    expect(panelsJs).toMatch(/window\.AukoraPanels\s*=/);
    for (const id of ['authority', 'memory', 'lineage', 'recursion', 'council', 'providers', 'budget', 'convex', 'g1', 'forgetting']) {
      expect(panelsJs).toMatch(new RegExp('\\b' + id + '\\s*\\(F\\)'));
    }
  });

  it('both pages consume the shared renderers instead of redefining panels', () => {
    expect(appJs).toMatch(/window\.AukoraPanels/);
    expect(shellJs).toMatch(/window\.AukoraPanels/);
    // A panel-body string lives ONLY in the shared module, proving it is not duplicated per page.
    expect(panelsJs).toContain('Model manifest (truth-labeled)');
    expect(appJs).not.toContain('Model manifest');
    expect(shellJs).not.toContain('Model manifest');
  });
});

describe('R30 committed visual artifact', () => {
  it('the spatial-map SVG is self-contained and reflects the real node/edge counts', () => {
    expect(mapSvg.startsWith('<svg')).toBe(true);
    expect(mapSvg).not.toMatch(/<script/i);
    expect(mapSvg).toContain(fixture.spatial.nodes.length + ' nodes / ' + fixture.spatial.edges.length + ' edges');
    for (const seat of fixture.council.roster) expect(mapSvg).toContain(seat.name);
  });
});
