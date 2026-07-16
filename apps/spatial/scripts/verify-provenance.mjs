// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
//
// Donor-box provenance verifier: proves every VERBATIM file is byte-identical to its recorded donor blob
// by hashing `git cat-file blob <donorBlob>` from the local authorized donor checkout. Run where the donor
// exists (DONOR_DIR overrides the default path). CI uses the sha256 pins in transplant.test.mjs instead.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const base = join(dirname(fileURLToPath(import.meta.url)), '..');
const DONOR = process.env.DONOR_DIR || '/Users/asd/Documents/aukora-symbiote';
const manifest = JSON.parse(readFileSync(join(base, 'provenance.json'), 'utf8'));

let ok = 0;
const bad = [];
for (const f of manifest.files) {
  if (f.status === 'NEW') continue;
  const donorContent = execSync(`git -C ${DONOR} cat-file blob ${f.donorBlob}`, { maxBuffer: 64 * 1024 * 1024 });
  const donorSha = createHash('sha256').update(donorContent).digest('hex');
  const same = donorSha === f.sha256;
  if (f.status === 'VERBATIM') (same ? ok++ : bad.push(f.path));
  if (f.status === 'ADAPTED' && same) bad.push(f.path + ' (ADAPTED but identical — status wrong)');
}
console.log(`VERBATIM byte-identical to donor@${manifest.donorCommit.slice(0, 9)}: ${ok} · mismatches: ${bad.length}`);
if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
