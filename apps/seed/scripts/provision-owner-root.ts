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
 * `--dev-random` mints a RUNTIME-RANDOM-label dev root and provisions it — for local smoke tests only. The
 * SIGNING CAPABILITY IS PRESERVED (R55.2): the random label (from which `HybridOwnerAdapter` deterministically
 * re-derives the keypair) is persisted to a SEPARATE permission-restricted sidecar `<out>.dev-label.json`
 * (mode 0600) so a local tool can reconstruct the adapter and sign a smoke-test authorization. The label IS
 * the dev credential: it is never printed, never committed, and must never leave this machine. This remains a
 * DEV convenience, not an owner ceremony — a real owner's keypair is generated and held out of band.
 */
import { readFileSync, writeFileSync, chmodSync } from 'node:fs';
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
  const label = `dev-${randomUUID()}`; // random per run — never a committed label
  const owner = new HybridOwnerAdapter(label);
  writeFileSync(a, JSON.stringify(provisionOwnerRoot(owner.root, new Date().toISOString()), null, 2));
  // Persist the SIGNING CAPABILITY separately (the label re-derives the keypair): 0600 sidecar, value never
  // printed. Without this the booted door could verify but nothing local could ever sign a smoke operation.
  const sidecar = `${a}.dev-label.json`;
  writeFileSync(sidecar, JSON.stringify({ schema: 'aukora-dev-owner-label-v1', label, note: 'DEV smoke credential — re-derives the dev keypair; keep 0600, never commit, never print' }, null, 2), { mode: 0o600 });
  // `mode` applies only on CREATE — a PRE-EXISTING permissive file at this path would keep its old mode after
  // the overwrite. Enforce 0600 unconditionally after the write (R55.3).
  chmodSync(sidecar, 0o600);
  console.log(`[provision-owner-root] DEV random-label envelope written (public material only): rootId ${owner.root.rootId.slice(0, 12)}…`);
  console.log(`[provision-owner-root] DEV signing label persisted (0600, value not printed): ${sidecar}`);
} else {
  console.error(usage);
  process.exit(2);
}
