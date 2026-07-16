// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * doorCustody — the ONE owner of two supervisor lifecycle laws (R44). Plain .mjs so BOTH the organism
 * supervisor (`organism-ctl.mjs`) and the vitest suites import the SAME module — no second implementation,
 * no third wrapper.
 *
 * LAW 1 — mind-door per-boot POST token custody:
 *   The supervisor MINTS the per-boot token and hands it to the mind-door child via env
 *   (`AUKORA_DOOR_TOKEN`) and to local operator tools via ONE tightly-held file:
 *   `apps/brain/.local/organism/mind-door.token` (0600, directory is gitignored).
 *   The token value is NEVER printed, NEVER logged, NEVER committed (gitignored path), NEVER served to a
 *   browser (nothing under `.local/` is reachable from any door), and dies with the boot (`down` removes it).
 *
 * LAW 2 — supervisor awareness (compose:live):
 *   Legacy `compose:live` binds the canonical brain-door port itself. When the organism supervisor already
 *   HOLDS that door for this checkout, a second bind is a collision, and a silent alternate door would be a
 *   bypass. `assertComposeMayBindDoor` refuses LOUDLY in that case — one owner, one path.
 */
import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** The env var the supervisor sets on the mind-door child. The seed runner honors it (R44 handoff). */
export const DOOR_TOKEN_ENV = 'AUKORA_DOOR_TOKEN';
/** Basename of the single token file under the organism dir. */
export const TOKEN_FILE_BASENAME = 'mind-door.token';
/** The no-print law, stated once — logs may reference the file, never the value. */
export const TOKEN_LOG_LAW = 'per-boot mind-door POST token: value is never printed/logged/committed; held only in env of the child and the 0600 token file';

/** Mint a per-boot token — same shape as the seed door's own `newDoorToken` (24 CSPRNG bytes, hex). */
export function mintDoorToken() {
  return randomBytes(24).toString('hex');
}

export function tokenFilePath(orgDir) {
  return join(orgDir, TOKEN_FILE_BASENAME);
}

/**
 * Hold the token in the ONE file, owner-read/write only (0600). Returns the path. Never logs the value.
 * The directory is `apps/brain/.local/organism` — covered by `apps/brain/.gitignore` (`.local/`), so the
 * token cannot be committed.
 */
export function writeTokenFile(orgDir, token) {
  if (typeof token !== 'string' || !/^[0-9a-f]{48}$/.test(token)) {
    throw new Error('doorCustody: refusing to hold a malformed token (want 48 lowercase hex chars)');
  }
  mkdirSync(orgDir, { recursive: true });
  const p = tokenFilePath(orgDir);
  writeFileSync(p, token, { mode: 0o600 });
  chmodSync(p, 0o600); // writeFileSync mode is umask-filtered; enforce explicitly
  return p;
}

/** Read the held token (local operator tools only). Returns null when absent. */
export function readTokenFile(orgDir) {
  const p = tokenFilePath(orgDir);
  if (!existsSync(p)) return null;
  const v = readFileSync(p, 'utf8').trim();
  return /^[0-9a-f]{48}$/.test(v) ? v : null;
}

/** Remove the token — the per-boot token dies with the boot (`down`). */
export function clearTokenFile(orgDir) {
  rmSync(tokenFilePath(orgDir), { force: true });
}

/** Presence + tightness for `status` display — NEVER the value. */
export function describeTokenPresence(orgDir) {
  const p = tokenFilePath(orgDir);
  if (!existsSync(p)) return { present: false, mode0600: false };
  const mode = statSync(p).mode & 0o777;
  return { present: true, mode0600: mode === 0o600 };
}

/** The checkout path named by the supervisor lockfile, or null when no organism is recorded. */
export function readOrganismLock(orgDir) {
  const p = join(orgDir, 'organism.lock');
  if (!existsSync(p)) return null;
  const v = readFileSync(p, 'utf8').trim();
  return v.length > 0 ? v : null;
}

/** The recorded door pid, or null. */
export function readDoorPid(orgDir) {
  const p = join(orgDir, 'door.pid');
  if (!existsSync(p)) return null;
  const pid = Number(readFileSync(p, 'utf8').trim());
  return Number.isInteger(pid) && pid > 1 ? pid : null;
}

const pidAlive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

/**
 * Does the organism supervisor currently HOLD the brain door for this checkout?
 * Held iff: the lockfile names `checkout` AND a door pid is recorded AND that pid is alive.
 * `isAlive` is injectable for tests; defaults to a real signal-0 probe.
 */
export function supervisorHoldsDoor(orgDir, checkout, isAlive = pidAlive) {
  const lock = readOrganismLock(orgDir);
  if (lock === null || lock !== checkout) return { held: false, pid: null };
  const pid = readDoorPid(orgDir);
  if (pid === null || !isAlive(pid)) return { held: false, pid };
  return { held: true, pid };
}

/**
 * compose:live preflight — REFUSES loudly when the supervisor holds the door (LAW 2). A refusal names the
 * one owner and the two legitimate paths; it never kills, never rebinds, never bypasses.
 */
export function assertComposeMayBindDoor(orgDir, checkout, isAlive = pidAlive) {
  const v = supervisorHoldsDoor(orgDir, checkout, isAlive);
  if (v.held) {
    throw new Error(
      `compose:live REFUSED: the organism supervisor already holds the brain door for this checkout (door pid ${v.pid}). ` +
      'One owner, one path — either consume the held door on its canonical port, or stop the organism first ' +
      '(`npm run organism:down --workspace @aukora/brain`) and re-run compose:live.');
  }
  return true;
}
