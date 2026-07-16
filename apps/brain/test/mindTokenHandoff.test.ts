// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R44 — ACCEPTANCE for the mind-door token lifecycle, split at the exact lane boundary.
 *
 * The SUPERVISOR side (apps/brain — this lane) is complete: it mints the per-boot token, holds it (0600,
 * gitignored), and hands it to the mind-door child via `AUKORA_DOOR_TOKEN`.
 *
 * The SEED side (apps/seed — Sam 3's lane) still mints its own token inside `scripts/mind-door-7097.ts`
 * and prints it to stdout, which the supervisor discards (`stdio: 'ignore'`) — so a SUPERVISED mind door is
 * unreachable by POST today. The exact 1-line handoff (do NOT apply it from this lane):
 *
 *     // in apps/seed/scripts/mind-door-7097.ts, inside `new MindDoor({ ... })`:
 *     postToken: process.env.AUKORA_DOOR_TOKEN,           // supervisor-minted per-boot token (R44)
 *     // and print the token ONLY when it was NOT injected (interactive runs keep today's behavior):
 *     //   if (!process.env.AUKORA_DOOR_TOKEN) console.log(`[mind-door] local POST token …`)
 *
 * The `it.fails` below is the FAILING ACCEPTANCE TEST for that handoff: it goes green (i.e. starts failing
 * as `it.fails`) the moment Sam 3 lands the line — then flip `it.fails` → `it` in the same PR.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOOR_TOKEN_ENV } from '../scripts/doorCustody.mjs';

const APP_DIR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const seedRunner = () => readFileSync(resolve(APP_DIR, '..', 'seed', 'scripts', 'mind-door-7097.ts'), 'utf8');
const ctl = () => readFileSync(resolve(APP_DIR, 'scripts', 'organism-ctl.mjs'), 'utf8');

describe('R44 mind-door token lifecycle — acceptance at the lane boundary', () => {
  it('SUPERVISOR side (this lane) is complete: mint → 0600 hold → env hand-off to the mind child', () => {
    const src = ctl();
    expect(src).toMatch(/mintDoorToken\(\)/);                    // supervisor mints
    expect(src).toMatch(/writeTokenFile\(ORG_DIR, token\)/);     // one 0600 file under the gitignored dir
    expect(src).toMatch(/\[DOOR_TOKEN_ENV\]: token/);            // env hand-off to the child
    expect(src).toMatch(/clearTokenFile\(ORG_DIR\)/);            // the token dies with the boot
  });

  // HANDOFF → Sam 3 (apps/seed): honor the supervisor-minted token. LANDED in R44b — the seed runner now adopts
  // `AUKORA_DOOR_TOKEN` when present (and suppresses the value), so this acceptance is genuinely green: flipped
  // `it.fails` → `it`.
  it(`SEED side (Sam 3): mind-door-7097.ts honors ${DOOR_TOKEN_ENV} — handoff landed`, () => {
    expect(seedRunner()).toContain(DOOR_TOKEN_ENV);
  });

  it('gap evidence: today the seed runner PRINTS its self-minted token, which a supervised boot discards', () => {
    const src = seedRunner();
    expect(src).toMatch(/console\.log\(.*localPostToken/);       // printed to stdout…
    expect(ctl()).toMatch(/stdio: 'ignore'/);                    // …which the supervisor discards ⇒ unreachable POST
  });
});
