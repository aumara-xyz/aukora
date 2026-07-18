// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Owner boot boundary (R55 P0) — the PRODUCTION composition must never boot on a publicly derivable owner key.
 *
 * `new HybridOwnerAdapter('local-door-dev')` derives its keypair DETERMINISTICALLY from a public string: anyone
 * who reads the repo can re-derive the same signing key and mint "owner" authorizations the door would accept.
 * That is a fixture, not an owner. This module is the ONE boot-time resolution of the door's trust anchor:
 *
 *   - `AUKORA_OWNER_ROOT_FILE=<path>` — the operator INJECTS the real owner's PUBLIC authority root
 *     (`aumlok-authority-root-v2` JSON; public key material only, never a private key). It is shape-validated,
 *     expiry/revocation-checked, and refused if it is a KNOWN fixture-derived root.
 *   - `AUKORA_OWNER_FIXTURE=1` — EXPLICIT opt-in to the deterministic dev fixture (tests / local dev only).
 *     Nothing implicit: the flag must be the literal string '1'.
 *   - NEITHER set (the production default) — the boot REFUSES. Fail closed, never fall back to a fixture.
 *   - BOTH set — ambiguous operator intent: REFUSE (an attacker who can set one env var must not be able to
 *     silently downgrade an injected-root boot to a fixture boot, or vice versa).
 *
 * Every refusal is CONTENT-FREE: a reason class only — never file contents, paths, or key material — so a
 * malformed or hostile root file cannot smuggle bytes into logs. Pure over injected env/readFile/now (hermetic
 * to test); it performs no I/O of its own and grants no authority — it only names the trust anchor the door
 * will VERIFY against.
 */
import type { AumlokAuthorityRootV2 } from '@aukora/kernel/schemas';
import { HybridOwnerAdapter } from './ownerFixture.js';

/** The known publicly-derivable fixture labels this boundary refuses as an "injected" root (defense in depth —
 *  the real boundary is that injection is operator-explicit; this kills the known-label copy-paste footgun). */
const KNOWN_FIXTURE_LABELS = ['local-door-dev', 'demo'] as const;

export type OwnerBootResolution =
  | { readonly mode: 'injected'; readonly root: AumlokAuthorityRootV2 }
  | { readonly mode: 'fixture' }
  | { readonly mode: 'refused'; readonly reasonClass:
      | 'owner:root-missing'
      | 'owner:boundary-ambiguous'
      | 'owner:root-unreadable'
      | 'owner:root-invalid'
      | 'owner:root-expired'
      | 'owner:root-revoked'
      | 'owner:root-fixture-derived' };

const HEX = /^[0-9a-f]+$/;

/** Structural validation of an injected PUBLIC authority root. Total: any malformed shape → false. */
function isAuthorityRootShape(v: unknown): v is AumlokAuthorityRootV2 {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const r = v as Record<string, unknown>;
  const keys = r.publicKeys as Record<string, unknown> | undefined;
  return r.schema === 'aumlok-authority-root-v2'
    && r.suite === 'aumlok-ed25519-ml-dsa-65-v1'
    && r.mode === 'software_hybrid'
    && typeof r.rootId === 'string' && r.rootId.length >= 16 && HEX.test(r.rootId)
    && keys !== null && typeof keys === 'object' && !Array.isArray(keys)
    && typeof keys.ed25519 === 'string' && keys.ed25519.length >= 32 && HEX.test(keys.ed25519)
    && typeof keys.mlDsa65 === 'string' && keys.mlDsa65.length >= 32 && HEX.test(keys.mlDsa65)
    && typeof r.createdAt === 'string'
    && (r.expiresAt === null || typeof r.expiresAt === 'string')
    && typeof r.revoked === 'boolean'
    && typeof r.integrity === 'string';
}

/**
 * Resolve the door's boot trust anchor from the environment. Pure over its inputs (env, readFile, nowMs) so the
 * production-default refusal and every hostile path are deterministically testable without a process boot.
 */
export function resolveOwnerBootAuthority(
  env: Readonly<Record<string, string | undefined>>,
  readFile: (path: string) => string,
  nowMs: number,
): OwnerBootResolution {
  const rootFile = env.AUKORA_OWNER_ROOT_FILE;
  const fixtureFlag = env.AUKORA_OWNER_FIXTURE;
  const wantsFixture = fixtureFlag === '1';

  if (rootFile !== undefined && rootFile.length > 0 && wantsFixture) {
    return { mode: 'refused', reasonClass: 'owner:boundary-ambiguous' };
  }
  if (rootFile === undefined || rootFile.length === 0) {
    // No injected root. ONLY the explicit literal '1' selects the fixture; the production default REFUSES.
    return wantsFixture ? { mode: 'fixture' } : { mode: 'refused', reasonClass: 'owner:root-missing' };
  }

  let raw: string;
  try {
    raw = readFile(rootFile);
  } catch {
    return { mode: 'refused', reasonClass: 'owner:root-unreadable' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { mode: 'refused', reasonClass: 'owner:root-invalid' }; // content-free: never echo the bytes
  }
  if (!isAuthorityRootShape(parsed)) return { mode: 'refused', reasonClass: 'owner:root-invalid' };
  if (parsed.revoked === true) return { mode: 'refused', reasonClass: 'owner:root-revoked' };
  if (parsed.expiresAt !== null && Date.parse(parsed.expiresAt) <= nowMs) {
    return { mode: 'refused', reasonClass: 'owner:root-expired' };
  }
  // Defense in depth: refuse the KNOWN publicly-derivable fixture roots as an "injected" root — pasting the dev
  // fixture's public root into a file must not turn a fixture into a production trust anchor.
  for (const label of KNOWN_FIXTURE_LABELS) {
    if (parsed.rootId === new HybridOwnerAdapter(label).root.rootId) {
      return { mode: 'refused', reasonClass: 'owner:root-fixture-derived' };
    }
  }
  return { mode: 'injected', root: parsed };
}

/** HARD: resolving the boot trust anchor grants no authority — the door only ever VERIFIES against it. */
export function ownerBoundaryGrantsAuthority(): false {
  return false;
}
