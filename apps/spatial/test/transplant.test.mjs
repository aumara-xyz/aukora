// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R37 true-subtractive transplant contract (issue #23).
 *
 * 1. Provenance integrity: shipped files (VERBATIM/ADAPTED/NEW) exist and hash-match their pins;
 *    EXCLUDED files are ABSENT from the tree but keep donor path/blob/hash dispositions.
 * 2. Closure exactness: the runtime tree contains EXACTLY the manifest's shipped set — no hidden files,
 *    no hidden routes; every import resolves (no dangling references after subtraction).
 * 3. New-organism door law: chat/voice speak ONLY the new doors (:7097/:7098) — the donor :7091/:7092
 *    never appear; AUMLOK keeps its local ceremony doors (:7094/:7095); everything stays loopback.
 * 4. Live path: /api/spatial/projection is a reactive read of Sam 2's Convex door (:3210) with a LOUD
 *    offline 503 — no generated JSON served as live; CONSOLE labels live vs fixture and re-checks the
 *    display-only fence.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const base = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = join(base, '..', '..');
const manifest = JSON.parse(readFileSync(join(base, 'provenance.json'), 'utf8'));
const shellJs = readFileSync(join(base, 'app', 'shell.js'), 'utf8');
const launcher = readFileSync(join(base, 'scripts', 'launch.mjs'), 'utf8');
const consoleJs = readFileSync(join(base, 'app', 'console.js'), 'utf8');

const shipped = manifest.files.filter((f) => f.status !== 'EXCLUDED');
const excluded = manifest.files.filter((f) => f.status === 'EXCLUDED');

const WALK_IGNORE = new Set(['.venv', 'models', '__pycache__', 'node_modules']); // gitignored voice runtime artefacts
function walkFiles(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (WALK_IGNORE.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walkFiles(p, out);
    else if (!e.name.endsWith('.pyc')) out.push(p);
  }
  return out;
}
const walkJs = (dir) => walkFiles(dir).filter((f) => f.endsWith('.js'));

describe('provenance integrity (v2 — with exclusions)', () => {
  it('anchors the donor repo and commit', () => {
    expect(manifest.schema).toBe('aukora-spatial-provenance-v2');
    expect(manifest.donorCommit).toMatch(/^[0-9a-f]{40}$/);
  });
  it('every SHIPPED file exists and hash-matches its pin', () => {
    expect(shipped.length).toBeGreaterThan(50);
    for (const f of shipped) {
      const p = join(repo, f.path);
      expect(existsSync(p), f.path + ' missing').toBe(true);
      const sha = createHash('sha256').update(readFileSync(p)).digest('hex');
      expect(sha, f.path + ' drifted from provenance').toBe(f.sha256);
    }
  });
  it('every EXCLUDED file is ABSENT but keeps its donor disposition', () => {
    expect(excluded.length).toBe(45);
    for (const f of excluded) {
      expect(existsSync(join(repo, f.path)), f.path + ' must not ship').toBe(false);
      expect(f.donorBlob).toMatch(/^[0-9a-f]{40}$/);
      expect(f.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
    // Agora is explicitly not selected (R37) and must not ship.
    expect(excluded.some((f) => f.path.endsWith('app/agora.js'))).toBe(true);
    for (const gone of ['wolf/wolf.js', 'arc3/arc3.js', 'luminara.js', 'media.js', 'graticube.js', 'browser.js', 'forge.js', 'morph.js', 'aukora-xyz.js']) {
      expect(excluded.some((f) => f.path.endsWith(gone)), gone + ' should be excluded').toBe(true);
    }
  });
  it('the ADAPTED set is exactly the registry + new-door + voice-retarget files', () => {
    const adapted = manifest.files.filter((f) => f.status === 'ADAPTED').map((f) => f.path).sort();
    expect(adapted).toEqual([
      'apps/spatial/app/aumalive-audio.js',
      'apps/spatial/app/aumalive.js',
      'apps/spatial/app/chat.js',
      'apps/spatial/app/settings.js',
      'apps/spatial/app/shell.js',
      'apps/spatial/voice/README.md',
      'apps/spatial/voice/sidecar.py',
      'apps/spatial/voice/test_e2e.py',
      'apps/spatial/voice/test_fixes.py',
      'apps/spatial/voice/test_loop.py',
    ]);
  });
});

describe('closure exactness — no hidden files or routes', () => {
  it('the runtime tree is EXACTLY the manifest shipped set', () => {
    const onDisk = ['app', 'assets', 'scripts', 'voice']
      .flatMap((d) => walkFiles(join(base, d)))
      .map((p) => 'apps/spatial/' + p.slice(base.length + 1).replace(/\\/g, '/'))
      .sort();
    const inManifest = shipped.map((f) => f.path).sort();
    expect(onDisk).toEqual(inManifest);
  });
  it('every static import/reference in the app resolves to a shipped file', () => {
    const missing = [];
    for (const f of walkJs(join(base, 'app'))) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/(?:import|export)[\s\S]{0,200}?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]/g)) {
        const spec = m[1] || m[2] || m[3];
        let target = null;
        if (spec && spec.startsWith('/app/')) target = join(base, spec.slice(1));
        else if (spec && (spec.startsWith('./') || spec.startsWith('../'))) target = join(dirname(f), spec);
        else continue;
        if (!existsSync(target)) missing.push(f.replace(base + '/', '') + ' → ' + spec);
      }
    }
    expect(missing, 'dangling references after subtraction:\n' + missing.join('\n')).toEqual([]);
  });
  it('index.html boots the donor shell module', () => {
    const html = readFileSync(join(base, 'app', 'index.html'), 'utf8');
    expect(html).toMatch(/<script type="module" src="\/app\/shell.js"><\/script>/);
  });
});

describe('registry — exact roster', () => {
  const organsBlock = /const ORGANS_BUILTIN = \{([\s\S]*?)\n\};/.exec(shellJs)?.[1] ?? '';
  const tabsBlock = /const TABS_BUILTIN = \{([\s\S]*?)\n\};/.exec(shellJs)?.[1] ?? '';
  it('keeps exactly the roster organs', () => {
    const keys = [...organsBlock.matchAll(/^  '?([a-z0-9-]+)'?:/gm)].map((m) => m[1]).sort();
    expect(keys).toEqual(['app-lab', 'auma', 'aumalive', 'aumlok', 'aura', 'console', 'ghp', 'kira', 'map', 'settings']);
  });
  it('menu tabs carry the roster', () => {
    const rows = (tab) => [...(new RegExp(tab + ':\\s*\\[([\\s\\S]*?)\\]', 'm').exec(tabsBlock)?.[1] ?? '').matchAll(/organ: '([a-z0-9-]+)'/g)].map((m) => m[1]);
    expect(rows('organs')).toEqual(['aumalive', 'auma']);
    expect(rows('system')).toEqual(['aumlok', 'aura', 'kira', 'map', 'ghp', 'console', 'settings']);
    expect(rows('yours')).toEqual(['app-lab']);
  });
  it('donor state machine, corners, and chat lane are untouched', () => {
    expect(shellJs).toMatch(/const state = \{ a: 1, d: 2 \};/);
    expect(shellJs).toMatch(/corner-threads/);
    expect(shellJs).toMatch(/isChatOpen, closeChat/);
    expect(shellJs).toMatch(/materializeShellModel/);
  });
});

describe('new-organism door law — never the donor 7091/7092', () => {
  const appJs = walkJs(join(base, 'app'));
  it('the donor chat/voice doors appear NOWHERE in the runtime tree', () => {
    for (const f of appJs) {
      const src = readFileSync(f, 'utf8');
      // the LAW is about endpoints: no donor door URL may be dialable from the runtime tree.
      expect(src, f + ' must not dial :7091').not.toMatch(/127\.0\.0\.1:7091/);
      expect(src, f + ' must not dial :7092').not.toMatch(/127\.0\.0\.1:7092/);
    }
  });
  it('chat, settings, shell, and AUMA LIVE speak the NEW doors (:7097 mind/chat · :7098 voice)', () => {
    expect(readFileSync(join(base, 'app', 'chat.js'), 'utf8')).toMatch(/127\.0\.0\.1:7097/);
    expect(readFileSync(join(base, 'app', 'settings.js'), 'utf8')).toMatch(/127\.0\.0\.1:7097/);
    expect(readFileSync(join(base, 'app', 'shell.js'), 'utf8')).toMatch(/127\.0\.0\.1:7097/);
    const aumalive = readFileSync(join(base, 'app', 'aumalive.js'), 'utf8');
    expect(aumalive).toMatch(/127\.0\.0\.1:7097/);
    expect(aumalive).toMatch(/ws:\/\/127\.0\.0\.1:7098\/ws/);
  });
  it('AUMLOK keeps its local ceremony doors (custody local, unchanged)', () => {
    const aumlok = readFileSync(join(base, 'app', 'aumlok.js'), 'utf8');
    expect(aumlok).toMatch(/127\.0\.0\.1:7094/);
    expect(aumlok).toMatch(/127\.0\.0\.1:7095/);
  });
  it('everything network-shaped stays loopback; no keys ship', () => {
    for (const f of appJs) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/wss?:\/\/([^'"`\s/]+)/g)) {
        expect(m[1].startsWith('127.0.0.1') || m[1].startsWith('localhost'), f + ' → ' + m[0]).toBe(true);
      }
      for (const m of src.matchAll(/fetch\(\s*[`'"](https?:\/\/[^'"`]+)/g)) {
        const host = m[1].replace(/^https?:\/\//, '').split('/')[0];
        expect(host.startsWith('127.0.0.1') || host.startsWith('localhost'), f + ' → ' + m[1]).toBe(true);
      }
      expect(src).not.toMatch(/sk-or-v1-[A-Za-z0-9]{20}/);
      expect(src).not.toMatch(/BEGIN [A-Z ]*PRIVATE KEY/);
    }
  });
});

describe('launcher — live door path + port law', () => {
  it('projection is a reactive read of the canonical brain door :7141 with loud offline/degraded truth', () => {
    expect(launcher).toMatch(/\/api\/spatial\/projection/);
    expect(launcher).toMatch(/AUKORA_BRAIN_DOOR/);
    expect(launcher).toMatch(/127\.0\.0\.1:7141/);          // R38 canonical door
    expect(launcher).not.toMatch(/127\.0\.0\.1:3210/);       // raw Convex is behind the door, not dialled here
    expect(launcher).toMatch(/composeProjection/);
    expect(launcher).toMatch(/door-degraded/);                 // partial-outage truth
    expect(launcher).toMatch(/brain door unreachable/);
    expect(launcher).toMatch(/workflowReasonVocabulary/);      // full reason vocabulary displayed
    expect(launcher).toMatch(/aumlokPresence/);                // presence BOOLEANS only
    expect(launcher).not.toMatch(/projection\.json/);          // no generated file served as live
  });
  it('port law: canonical 7096; donor 7090–7095 and new services 7097/7098 reserved; scan only 7096/7099', () => {
    expect(launcher).toMatch(/CANONICAL = 7096/);
    expect(launcher).toMatch(/RESERVED = new Set\(\[7090, 7091, 7092, 7093, 7094, 7095, 7097, 7098\]\)/);
    expect(launcher).toMatch(/CANDIDATES = \[7096, 7099\]/);
    expect(launcher).toMatch(/EADDRINUSE/);
  });
  it('the composed payload carries the display-only fence', () => {
    expect(launcher).toMatch(/displayOnly: true/);
    expect(launcher).toMatch(/feedsApply: false/);
    expect(launcher).toMatch(/grantsAuthority: false/);
  });
});

describe('CONSOLE truth labels', () => {
  it('labels live/degraded/offline distinctly, re-checks the fence, and never presents the fixture as live', () => {
    expect(consoleJs).toMatch(/LIVE DOOR/);
    expect(consoleJs).toMatch(/DEGRADED/);
    expect(consoleJs).toMatch(/OFFLINE — brain door unreachable/);
    expect(consoleJs).toMatch(/display-only fence/);
    expect(consoleJs).toMatch(/not live/i);
    expect(consoleJs).toMatch(/workflowReasonVocabulary/);
    expect(consoleJs).toMatch(/aumlokPresence/);
  });
});

// ── R38: the NEW duplex voice sidecar (:7098) ───────────────────────────────────────────────────
describe('R38 voice sidecar laws', () => {
  const voiceDir = join(base, 'voice');
  const sidecar = readFileSync(join(voiceDir, 'sidecar.py'), 'utf8');
  it('binds loopback :7098 by default and only accepts the NEW shell origins', () => {
    expect(sidecar).toMatch(/AUKORA_VOICE_PORT", "7098"/);
    expect(sidecar).toMatch(/HOST = "127\.0\.0\.1"/);
    expect(sidecar).toMatch(/127\.0\.0\.1:7096/);
    expect(sidecar).toMatch(/127\.0\.0\.1:7099/);
    expect(sidecar).not.toMatch(/127\.0\.0\.1:7090/);   // donor shell origin gone
    expect(sidecar).not.toMatch(/127\.0\.0\.1:7095/);   // AUMLOK bind door origin gone
  });
  it('never dials the donor doors and holds no keys', () => {
    for (const f of walkFiles(voiceDir).filter((x) => /\.(py|sh|md)$/.test(x))) {
      const src = readFileSync(f, 'utf8');
      expect(src, f + ' must not dial donor :7091').not.toMatch(/127\.0\.0\.1:7091/);
      expect(src, f + ' must not dial donor :7092').not.toMatch(/127\.0\.0\.1:7092/);
      expect(src).not.toMatch(/sk-or-v1-[A-Za-z0-9]{20}/);
      expect(src).not.toMatch(/BEGIN [A-Z ]*PRIVATE KEY/);
      expect(src).not.toMatch(/OPENROUTER_API_KEY\s*=/);
    }
  });
  it('preserves the donor duplex laws: VAD, streaming TTS, barge-in abort, degradation', () => {
    expect(sidecar).toMatch(/silero/i);
    expect(sidecar).toMatch(/tts_begin/);
    expect(sidecar).toMatch(/tts_cancelled|cancel/i);
    expect(sidecar).toMatch(/fallback/i); // donor degradation law: MLX→faster-whisper fallback, kokoro fallback
  });
  it('the browser voice organ dials the NEW sidecar', () => {
    const aumalive = readFileSync(join(base, 'app', 'aumalive.js'), 'utf8');
    expect(aumalive).toMatch(/ws:\/\/127\.0\.0\.1:7098\/ws/);
  });
});
