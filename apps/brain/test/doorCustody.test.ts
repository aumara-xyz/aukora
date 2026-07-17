// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R44 — door custody laws (the ONE module both the supervisor and compose:live consume).
 *
 * LAW 1 (mind-door per-boot POST token): minted by the supervisor; held ONLY in the child env + one 0600 file
 * under the gitignored organism dir; never printed; dies with the boot.
 * LAW 2 (supervisor awareness): compose:live refuses loudly when the supervisor holds the brain door — one
 * owner, one path; no collision, no bypass.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, statSync, readFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DOOR_TOKEN_ENV, TOKEN_LOG_LAW, mintDoorToken, tokenFilePath, writeTokenFile, readTokenFile, clearTokenFile,
  describeTokenPresence, readOrganismLock, readDoorPid, supervisorHoldsDoor, assertComposeMayBindDoor,
} from '../scripts/doorCustody.mjs';

const APP_DIR = resolve(fileURLToPath(new URL('..', import.meta.url)));
let orgDir: string;
beforeEach(() => { orgDir = mkdtempSync(join(tmpdir(), 'aukora-custody-')); });
afterEach(() => { rmSync(orgDir, { recursive: true, force: true }); });

describe('LAW 1 — per-boot token custody', () => {
  it('mints a fresh 24-byte hex token per boot (CSPRNG shape, unique)', () => {
    const a = mintDoorToken();
    const b = mintDoorToken();
    expect(a).toMatch(/^[0-9a-f]{48}$/);
    expect(b).toMatch(/^[0-9a-f]{48}$/);
    expect(a).not.toBe(b);
  });

  it('holds the token in ONE file, owner-only (0600), and round-trips it', () => {
    const t = mintDoorToken();
    const p = writeTokenFile(orgDir, t);
    expect(p).toBe(tokenFilePath(orgDir));
    expect(statSync(p).mode & 0o777).toBe(0o600);          // tight: owner read/write only
    expect(readFileSync(p, 'utf8')).toBe(t);
    expect(readTokenFile(orgDir)).toBe(t);
  });

  it('refuses to hold a malformed token (fail-closed custody)', () => {
    expect(() => writeTokenFile(orgDir, 'not-a-token')).toThrow(/malformed token/);
    expect(() => writeTokenFile(orgDir, mintDoorToken().toUpperCase())).toThrow(/malformed token/);
    expect(readTokenFile(orgDir)).toBeNull();               // nothing was written
  });

  it('a malformed or absent token file reads as null, never as a token', () => {
    expect(readTokenFile(orgDir)).toBeNull();                                 // absent
    writeFileSync(tokenFilePath(orgDir), 'garbage\n', { mode: 0o600 });
    expect(readTokenFile(orgDir)).toBeNull();                                 // malformed
  });

  it('the per-boot token DIES with the boot (clear removes it)', () => {
    writeTokenFile(orgDir, mintDoorToken());
    clearTokenFile(orgDir);
    expect(readTokenFile(orgDir)).toBeNull();
    expect(describeTokenPresence(orgDir)).toEqual({ present: false, mode0600: false });
  });

  it('status describes PRESENCE and tightness only — the value is not part of the shape', () => {
    const t = mintDoorToken();
    writeTokenFile(orgDir, t);
    const d = describeTokenPresence(orgDir);
    expect(d).toEqual({ present: true, mode0600: true });
    expect(JSON.stringify(d)).not.toContain(t);             // no value leakage through status
    chmodSync(tokenFilePath(orgDir), 0o644);
    expect(describeTokenPresence(orgDir).mode0600).toBe(false); // loosened perms are DETECTED
  });

  it('NEVER COMMITTED: the organism dir is gitignored (`.local/` in apps/brain/.gitignore)', () => {
    const gitignore = readFileSync(resolve(APP_DIR, '.gitignore'), 'utf8');
    expect(gitignore.split('\n')).toContain('.local/');
  });

  it('NEVER PRINTED: the ONE owner (apps/supervisor) logs the law, not the value (R47)', () => {
    const sup = readFileSync(resolve(APP_DIR, '..', 'supervisor', 'src', 'supervisor.mjs'), 'utf8');
    expect(sup).toContain('TOKEN_LOG_LAW');                              // the law is what gets receipted
    expect(sup).toMatch(/capturedEnv\[DOOR_TOKEN_ENV\] = mintDoorToken\(\)/); // owner mints
    for (const line of sup.split('\n')) {
      // no receipt/log line may interpolate the captured token value
      if (/receipt\(|console\.log\(/.test(line)) expect(line, `line leaks the token: ${line}`).not.toMatch(/capturedEnv\[DOOR_TOKEN_ENV\]|\$\{token\}/);
    }
    expect(TOKEN_LOG_LAW).toMatch(/never printed/);
  });

  it('NEVER BROWSER-EXPOSED: the brain door serves projections only — it has no filesystem access at all', () => {
    const door = readFileSync(resolve(APP_DIR, 'src', 'localDoor.ts'), 'utf8');
    expect(door).not.toMatch(/node:fs|readFileSync|\.local/); // nothing under .local/ is reachable via the door
  });
});

describe('LAW 2 — compose:live supervisor awareness (no collision, no bypass)', () => {
  const CHECKOUT = '/repo/checkout';

  it('no organism recorded ⇒ compose may bind the door', () => {
    expect(supervisorHoldsDoor(orgDir, CHECKOUT)).toEqual({ held: false, pid: null });
    expect(assertComposeMayBindDoor(orgDir, CHECKOUT)).toBe(true);
  });

  it('lock names a DIFFERENT checkout ⇒ not ours to defer to (their supervisor guards their ports)', () => {
    writeFileSync(join(orgDir, 'organism.lock'), '/some/other/checkout');
    writeFileSync(join(orgDir, 'door.pid'), '4242');
    expect(supervisorHoldsDoor(orgDir, CHECKOUT, () => true).held).toBe(false);
  });

  it('lock + recorded door pid that is DEAD ⇒ stale record, compose may bind', () => {
    writeFileSync(join(orgDir, 'organism.lock'), CHECKOUT);
    writeFileSync(join(orgDir, 'door.pid'), '4242');
    expect(supervisorHoldsDoor(orgDir, CHECKOUT, () => false)).toEqual({ held: false, pid: 4242 });
    expect(assertComposeMayBindDoor(orgDir, CHECKOUT, () => false)).toBe(true);
  });

  it('lock + LIVE door pid ⇒ REFUSES loudly, naming the one owner and both legitimate paths', () => {
    writeFileSync(join(orgDir, 'organism.lock'), CHECKOUT);
    writeFileSync(join(orgDir, 'door.pid'), '4242');
    expect(supervisorHoldsDoor(orgDir, CHECKOUT, () => true)).toEqual({ held: true, pid: 4242 });
    expect(() => assertComposeMayBindDoor(orgDir, CHECKOUT, () => true))
      .toThrow(/REFUSED.*supervisor already holds the brain door.*pid 4242.*organism:down/s);
  });

  it('R47 one-owner arm: a LIVE brain-door pid in the supervisor state dir also holds the door', () => {
    const supDir = join(orgDir, 'sup-state');
    require('node:fs').mkdirSync(supDir, { recursive: true });
    writeFileSync(join(supDir, 'brain-door.7141.pid'), '5151');
    expect(supervisorHoldsDoor(orgDir, CHECKOUT, () => true, supDir)).toEqual({ held: true, pid: 5151 });
    expect(supervisorHoldsDoor(orgDir, CHECKOUT, () => false, supDir).held).toBe(false); // dead pid: bindable
    expect(() => assertComposeMayBindDoor(orgDir, CHECKOUT, () => true, supDir)).toThrow(/REFUSED/);
  });

  it('parsers are fail-closed: absent/blank lock and absent/garbage pid read as null', () => {
    expect(readOrganismLock(orgDir)).toBeNull();
    writeFileSync(join(orgDir, 'organism.lock'), '\n');
    expect(readOrganismLock(orgDir)).toBeNull();
    expect(readDoorPid(orgDir)).toBeNull();
    writeFileSync(join(orgDir, 'door.pid'), 'zero');
    expect(readDoorPid(orgDir)).toBeNull();
    writeFileSync(join(orgDir, 'door.pid'), '1'); // pid 1 is never ours
    expect(readDoorPid(orgDir)).toBeNull();
  });
});

describe('the custody module exports the env contract the handoff names', () => {
  it('DOOR_TOKEN_ENV is the exact variable the seed runner must honor', () => {
    expect(DOOR_TOKEN_ENV).toBe('AUKORA_DOOR_TOKEN');
  });
});
