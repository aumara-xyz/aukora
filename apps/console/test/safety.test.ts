// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Enforces the console's safety contract on the files that actually ship to the browser: it is read-only,
 * it holds no secret-shaped data, it opens no network connection, and it has no control that could sign,
 * authorize, apply, deploy, or arm anything. If a future edit adds a form, a fetch, an innerHTML sink, or
 * leaks the fixture owner's private seed, one of these fails.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const pub = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const read = (f: string) => readFileSync(join(pub, f), 'utf-8');
const html = read('index.html');
const appJs = read('app.js');
const panelsJs = read('panels.js');
const appsJs = read('apps.js');
const spatialMapJs = read('spatial-map.js');
const contractsJs = read('contracts.js');
const chatJs = read('chat.js');
const shellHtml = read('shell.html');
const shellJs = read('shell.js');
const tokensCss = read('tokens.css');
const shellCss = read('shell.css');
const fixtureJs = read('fixture.js');
const fixtureJson = read('fixture.json');
// Every shipped browser script (both pages + shared renderers + shell apps + chat + contracts).
const allScripts = [appJs, panelsJs, appsJs, spatialMapJs, contractsJs, chatJs, shellJs];
// Everything that actually ships to the browser (scripts + markup + styles + fixture).
const allShipped = [html, shellHtml, tokensCss, shellCss, fixtureJs, fixtureJson, ...allScripts].join('\n');

describe('read-only: no control surface in the browser bundle', () => {
  it('has no form or input elements', () => {
    expect(html).not.toMatch(/<form\b/i);
    expect(html).not.toMatch(/<input\b/i);
    expect(html).not.toMatch(/type=["']submit["']/i);
  });
  it('the only button is the read-only fixture download', () => {
    const buttons = html.match(/<button\b/gi) ?? [];
    expect(buttons.length).toBe(1);
    expect(html).toMatch(/id="download-fixture"/);
  });
  it('opens no network connection and uses no code-injection sink', () => {
    for (const js of allScripts) {
      for (const bad of [/\bfetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /\beval\s*\(/, /\.innerHTML\b/, /new Function\s*\(/]) {
        expect(js, `a shipped script must not contain ${bad}`).not.toMatch(bad);
      }
    }
  });
  it('the spatial shell has no form/input and no submit control (nav-only chrome)', () => {
    expect(shellHtml).not.toMatch(/<form\b/i);
    expect(shellHtml).not.toMatch(/<input\b/i);
    expect(shellHtml).not.toMatch(/type=["']submit["']/i);
    // exactly the three geometry tabs (▲ ■ ○); the rest are corner/hint chrome, none writes anything.
    expect((shellHtml.match(/role="tab"/g) ?? []).length).toBe(3);
  });
  it('the KNVS lab sandbox is opaque (allow-scripts only) with a strict in-document CSP', () => {
    // The safe donor law: scripts run in the sandbox but cannot reach this origin, and the CSP starves it.
    expect(appsJs).toMatch(/setAttribute\(\s*["']sandbox["']\s*,\s*["']allow-scripts["']\s*\)/);
    expect(appsJs).not.toMatch(/allow-same-origin/);
    expect(appsJs).not.toMatch(/allow-top-navigation/);
    expect(appsJs).toMatch(/Content-Security-Policy/);
    expect(appsJs).toMatch(/default-src 'none'/);
    // A KNVS proposal only DRAFTS — it must never apply/sign/commit.
    expect(appsJs).toMatch(/Draft queued/);
    // The bounded voice/vision session is an OFFLINE demo — no paid/live call, keys never in the browser.
    expect(appsJs).not.toMatch(/api[._-]?key/i);
    expect(JSON.parse(fixtureJson).knvs.session.limits.costUsd).toBe(0);
  });
  it('AUMA chat is offline advisory and the contracts make no network call', () => {
    // The chat replies deterministically offline — it never fetches a model and never signs/applies.
    expect(chatJs).toMatch(/offline advisory/i);
    expect(chatJs).not.toMatch(/\bfetch\s*\(/);
    // Contracts prefer a host-injected global and fall back to the fixture — no fetch in the browser.
    expect(contractsJs).toMatch(/globalThis\.AUKORA_BRAIN_HEALTH/);
    expect(contractsJs).toMatch(/fixture-fallback/);
    expect(contractsJs).not.toMatch(/\bfetch\s*\(/);
  });
  it('makes no forbidden alive / conscious / self-replicating claim', () => {
    // No POSITIVE claim anywhere in the shipped files.
    expect(allShipped).not.toMatch(/\b(is|are|now|becomes?)\s+(alive|conscious|sentient|self-?replicating)\b/i);
    expect(allShipped).not.toMatch(/\bliving organism\b/i);
    // The disclaimer IS present — both in the page chrome and in the G1 fixture note.
    expect(html).toMatch(/not\b[^.]*\b(alive|conscious|self-replicating)/i);
    expect(JSON.parse(fixtureJson).g1.note).toMatch(/not claimed/i);
  });
});

describe('no secret-shaped data ships to the browser', () => {
  it('does not contain the fixture owner PRIVATE seed', () => {
    // Recompute both HybridOwnerAdapter('demo') private seed inputs and prove neither ships.
    const privateSeeds = [
      createHash('sha256').update('aukora-owner-ed25519:demo').digest('hex'),
      createHash('sha256').update('aukora-owner-ml-dsa-65:demo').digest('hex'),
    ];
    for (const seed of privateSeeds) {
      expect(seed).toMatch(/^[0-9a-f]{64}$/);
      expect(allShipped.includes(seed)).toBe(false);
    }
  });
  it('surfaces the owner PUBLIC key (the safe, intended value)', () => {
    expect(fixtureJson).toMatch(/"ownerPublicKeyHex":\s*"[0-9a-f]{64}"/);
  });
  it('carries no token/credential markers or private absolute paths', () => {
    for (const marker of [/\bsk-[A-Za-z0-9]/, /Bearer\s+[A-Za-z0-9]/, /BEGIN [A-Z ]*PRIVATE KEY/, /_API_KEY/, /\/Users\//, /\/home\//]) {
      expect(allShipped, `shipped files must not contain ${marker}`).not.toMatch(marker);
    }
  });
  it('any tombstone / forgotten surface is content-free', () => {
    // The forgotten memory's plaintext must not appear anywhere the console can display.
    expect(allShipped).not.toContain('came online');
    expect(JSON.parse(fixtureJson).forgetting.tombstoneContentFree).toBe(true);
  });
});
