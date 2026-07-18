// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Operator tool (R55.1): PROVISION an owner's PUBLIC authority root for door-boot injection.
 *
 *   npx tsx apps/seed/scripts/provision-owner-root.ts --from <bare-root.json> <out-envelope.json>
 *   npx tsx apps/seed/scripts/provision-owner-root.ts --dev-random <out-envelope.json>
 *
 * `--from` is THE production flow: the owner generates their keypair under their own custody (out of band,
 * never here), exports the PUBLIC `aumlok-authority-root-v2` JSON, and this stamps it into the
 * `aukora-provisioned-owner-root-v1` envelope that `AUKORA_OWNER_ROOT_FILE` requires. Public bytes in,
 * public bytes out — no key generation, no secrets, nothing printed but a confirmation.
 *
 * `--dev-random` mints a RUNTIME-RANDOM-label dev root and provisions it — for local smoke tests only; the
 * label is random per run (never committed), but the keypair still lives on this machine's process memory,
 * so it is a DEV convenience, not an owner ceremony.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { HybridOwnerAdapter } from '../src/ownerFixture.js';
import { provisionOwnerRoot } from '../src/ownerBoundary.js';
import type { AumlokAuthorityRootV2 } from '@aukora/kernel/schemas';

const [mode, a, b] = process.argv.slice(2);
const usage = 'usage: provision-owner-root.ts (--from <bare-root.json> <out.json> | --dev-random <out.json>)';

if (mode === '--from' && a && b) {
  const root = JSON.parse(readFileSync(a, 'utf8')) as AumlokAuthorityRootV2; // shape is re-validated at boot
  writeFileSync(b, JSON.stringify(provisionOwnerRoot(root, new Date().toISOString()), null, 2));
  console.log(`[provision-owner-root] provisioned envelope written (public material only): rootId ${root.rootId.slice(0, 12)}…`);
} else if (mode === '--dev-random' && a) {
  const owner = new HybridOwnerAdapter(`dev-${randomUUID()}`); // random per run — never a committed label
  writeFileSync(a, JSON.stringify(provisionOwnerRoot(owner.root, new Date().toISOString()), null, 2));
  console.log(`[provision-owner-root] DEV random-label envelope written (public material only): rootId ${owner.root.rootId.slice(0, 12)}…`);
} else {
  console.error(usage);
  process.exit(2);
}
