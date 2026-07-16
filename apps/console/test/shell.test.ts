// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R31 spatial-shell contract. Validates the 7090-parity shell: the versioned trinity/glass design tokens,
 * the three-lane {a,d} state machine, the ▲■○ roster (Triangle: AUMA LIVE · Square: AUMLOK/AURA/SPATIAL
 * MAP/CONSOLE/SETTINGS · Circle: KNVS), the read-only ceremony consumed by AUMLOK+AURA, the ported safe
 * KNVS lab, and that apps REUSE the tested panels/adapters rather than duplicating them.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const base = dirname(fileURLToPath(import.meta.url));
const pub = join(base, '..', 'public');
const read = (p: string) => readFileSync(join(pub, p), 'utf-8');
const fixture = JSON.parse(read('fixture.json'));
const tokens = read('tokens.css');
const shellHtml = read('shell.html');
const shellJs = read('shell.js');
const appsJs = read('apps.js');
const panelsJs = read('panels.js');
const spatialMapJs = read('spatial-map.js');
const chatJs = read('chat.js');
const contractsJs = read('contracts.js');
const mapSvg = readFileSync(join(base, '..', 'docs', 'spatial-map.svg'), 'utf-8');

describe('R31 design tokens (versioned, trinity/glass — no dark boxes)', () => {
  it('declares a version and the trinity hues from the 7090 donor', () => {
    expect(tokens).toMatch(/--design-tokens-version:\s*"1\.0\.0"/);
    expect(tokens).toMatch(/--hue-l:\s*129, 212, 180/);
    expect(tokens).toMatch(/--hue-c:\s*150, 180, 255/);
    expect(tokens).toMatch(/--hue-r:\s*196, 170, 255/);
  });
  it('uses translucent WHITE glass surfaces, one base stage — not dark panel boxes', () => {
    expect(tokens).toMatch(/--glass:\s*rgba\(255, 255, 255/);
    expect(tokens).toMatch(/--stage-base:\s*#111520/);
  });
});

describe('R31 shell structure & parity mechanics', () => {
  it('is a three-lane shell with hot corners and the ▲■○ family tabs', () => {
    for (const id of ['lane-l', 'lane-canvas', 'lane-r', 'organ-host', 'menu-list']) {
      expect(shellHtml).toContain('id="' + id + '"');
    }
    expect((shellHtml.match(/class="corner/g) ?? []).length).toBe(5); // chat-back, chats-push, canvas-l, canvas-r, menu
    expect((shellHtml.match(/role="tab"/g) ?? []).length).toBe(3);
    for (const t of ['data-tab="triangle"', 'data-tab="square"', 'data-tab="circle"']) expect(shellHtml).toContain(t);
    expect(shellHtml).toMatch(/tokens\.css/); // the tokens load first
  });
  it('implements the donor two-divider {a,d} lane state machine', () => {
    expect(shellJs).toMatch(/state\s*=\s*\{\s*a:\s*1,\s*d:\s*2\s*\}/);
    expect(shellJs).toMatch(/\[state\.a,\s*state\.d\s*-\s*state\.a,\s*3\s*-\s*state\.d\]/);
    for (const c of ['node()', 'menu()', 'canvasLeft()', 'canvasRight()']) expect(shellJs).toContain(c);
    // keyboard parity: [ ] , .
    for (const k of ['"["', '"]"', '","', '"."']) expect(shellJs).toContain(k);
  });
});

describe('R31 exact app roster', () => {
  it('Triangle = AUMA LIVE · Square = AUMLOK/AURA/SPATIAL MAP/CONSOLE/SETTINGS · Circle = KNVS', () => {
    // triangle
    expect(shellJs).toMatch(/triangle:\s*\{[^}]*organ:\s*"auma"/s);
    // square carries exactly the five system apps
    const square = /square:\s*\{[\s\S]*?rows:\s*\[([\s\S]*?)\]\s*\}/.exec(shellJs)?.[1] ?? '';
    for (const organ of ['aumlok', 'aura', 'map', 'console', 'settings']) {
      expect(square, 'square must include ' + organ).toContain('organ: "' + organ + '"');
    }
    // circle
    expect(shellJs).toMatch(/circle:\s*\{[^}]*organ:\s*"knvs"/s);
  });
});

describe('R32 ceremony contract (Sam 3 · aumlok-ceremony-design-v0)', () => {
  it('mirrors the design contract: 9 phases, L0–L4 layers, grants nothing', () => {
    expect(fixture.ceremony.schema).toBe('aumlok-ceremony-design-v0');
    expect(fixture.ceremony.grantsAuthority).toBe(false);
    expect(fixture.ceremony.phases.length).toBe(9);
    expect(fixture.ceremony.phases.some((p: any) => p.state === 'gate')).toBe(true);
    expect(fixture.ceremony.continuityLayers.map((l: any) => l.layer)).toEqual(['L0', 'L1', 'L2', 'L3', 'L4']);
    expect(fixture.ceremony.signerLabel).toBe('production_not_built');
  });
  it('both AUMLOK and AURA render the same ceremony via the contract resolver', () => {
    expect(appsJs).toMatch(/function mountAumlok/);
    expect(appsJs).toMatch(/function mountAura/);
    expect(appsJs).toMatch(/AukoraContracts\.ceremony\(F\)/);
  });
});

describe('R32 AMEND fix — left lane is Chats/Auma conversation', () => {
  it('the shell mounts the chats lane (not a node inspector)', () => {
    expect(shellHtml).toContain('id="chat-mount"');
    expect(shellHtml).toMatch(/Chats lane/);
    expect(shellHtml).not.toMatch(/Node inspector/);
    expect(shellJs).toMatch(/window\.AukoraChat\.mount/);
  });
  it('AUMA LIVE is directly conversational, offline, and cannot sign/apply/merge', () => {
    expect(fixture.chat.threads.some((t: any) => t.id === 'aukora-main' && t.live)).toBe(true);
    expect(String(fixture.chat.greeting)).toMatch(/one being, one memory/i);
    expect(chatJs).toMatch(/offline advisory/i);
    expect(shellJs).toMatch(/key === "auma".*openThread/s);
  });
});

describe('R32 contracts wired with fixture fallback', () => {
  it('Sam 2 BrainHealthSnapshotV1 resolves via contracts.js (host-injected → fixture)', () => {
    expect(fixture.brainHealth.schema).toBe('BrainHealthSnapshotV1');
    expect(fixture.brainHealth.grantsAuthority).toBe(false);
    expect(contractsJs).toMatch(/function brainHealth/);
    expect(appsJs).toMatch(/AukoraContracts\.brainHealth\(F\)/);
  });
});

describe('R32 Auma IDE (R0–R3) + KNVS bounded session', () => {
  it('the IDE surface carries the R0–R3 read-only contract', () => {
    expect(fixture.ide.schema).toBe('auma-ide-r0r3-v0');
    for (const k of ['repoTree', 'search', 'citedRecall', 'draftDiff', 'rehearsal', 'receipts', 'candidate']) {
      expect(fixture.ide).toHaveProperty(k);
    }
    expect(fixture.ide.candidate.grantsAuthority).toBe(false);
  });
  it('the KNVS session is a bounded OFFLINE demo (submit = proposal intent only)', () => {
    expect(fixture.knvs.session.modes).toEqual(['text', 'voice', 'vision']);
    expect(fixture.knvs.session.submitIsProposalIntent).toBe(true);
    expect(fixture.knvs.session.limits.costUsd).toBe(0);
  });
});

describe('R31 KNVS safe lab (ported donor law, not a placeholder)', () => {
  it('the fixture describes the ported safe law', () => {
    expect(fixture.knvs.truth).toBe('IMPLEMENTED');
    expect(fixture.knvs.state).toBe('SAFE_LAB');
    expect(fixture.knvs.sandbox).toBe('allow-scripts');
    expect(fixture.knvs.continuityKeys).toEqual(['aukora-canvas-last', 'app-lab']);
    expect(fixture.knvs.draftOnly).toBe(true);
    expect(fixture.knvs.csp).toMatch(/default-src 'none'/);
  });
});

describe('R31 reuse (no duplicated panels / adapters)', () => {
  it('CONSOLE mounts the ten tested panels and the map is the shared adapter', () => {
    expect(appsJs).toMatch(/window\.AukoraPanels/);
    expect(appsJs).toMatch(/AukoraSpatialMap\.mount/);
    // panel-body strings live only in the shared renderer, not re-implemented in the apps.
    expect(panelsJs).toContain('Model manifest (truth-labeled)');
    expect(appsJs).not.toContain('Model manifest');
    expect(spatialMapJs).toMatch(/window\.AukoraSpatialMap/);
  });
});

describe('R31 committed visual artifact', () => {
  it('the spatial-map SVG is self-contained and reflects the real node/edge counts', () => {
    expect(mapSvg.startsWith('<svg')).toBe(true);
    expect(mapSvg).not.toMatch(/<script/i);
    expect(mapSvg).toContain(fixture.spatial.nodes.length + ' nodes / ' + fixture.spatial.edges.length + ' edges');
  });
});
