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
const shellHtml = read('shell.html');
const shellJs = read('shell.js');
const fixtureJs = read('fixture.js');
const fixtureJson = read('fixture.json');
// Everything that actually ships to the browser (both pages + the shared renderers + the fixture).
const allShipped = [html, appJs, panelsJs, shellHtml, shellJs, fixtureJs, fixtureJson].join('\n');
const allScripts = [appJs, panelsJs, shellJs];

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
  it('the spatial shell exposes only tab buttons and no form/input', () => {
    expect(shellHtml).not.toMatch(/<form\b/i);
    expect(shellHtml).not.toMatch(/<input\b/i);
    const buttons = shellHtml.match(/<button\b[^>]*>/gi) ?? [];
    expect(buttons.length).toBe(6); // exactly the six zone tabs
    for (const b of buttons) expect(b, `button must be a tab: ${b}`).toMatch(/role="tab"/);
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
    // Recompute the LocalOwnerAdapter('demo') secret exactly as the seed derives it, and prove it is absent.
    const ownerSecretHex = createHash('sha256').update('aukora-owner-fixture:demo').digest('hex');
    expect(ownerSecretHex).toMatch(/^[0-9a-f]{64}$/);
    expect(allShipped.includes(ownerSecretHex)).toBe(false);
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
