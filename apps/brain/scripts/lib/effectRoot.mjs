// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Node-importable effect-projection ROOT formula — the same law as apps/brain/src/effectEvent.ts, factored so a
 * plain-Node live canary (which cannot import the TS module) computes the IDENTICAL root over real durable rows.
 *
 * It intentionally imports ONLY `@aukora/kernel/canonical` (built dist, node-importable). A gated cross-check
 * test (effectRootCrosscheck.test.ts) asserts these helpers produce results IDENTICAL to the TS law for
 * fixtures, so the two can never drift. The TS module remains the authority for VALIDATION (secret scan, closed
 * schema); this shares only the deterministic root arithmetic.
 */
import { canonicalHash } from '@aukora/kernel/canonical';

/** Deterministic effect id keyed by (rehearsalKey, step) — MUST match effectEvent.ts deriveEffectId. */
export function deriveEffectId(rehearsalKey, step) {
  return canonicalHash({ domain: 'AUKORA-EFFECT/1', rehearsalKey, step });
}

/** Payload hash under a fixed id — the conflict discriminator. MUST match effectEvent.ts effectPayloadHash. */
export function effectPayloadHash(e) {
  return canonicalHash({ domain: 'AUKORA-EFFECT-PAYLOAD/1', effectId: e.effectId, effect: e.effect, createdAtIso: e.createdAtIso });
}

/**
 * Order-independent projection over rows already shaped as {effectId, effect, createdAtIso}. Returns the
 * canonical map + a quarantine count. Mirrors effectEvent.ts projectEffectEvents (minus TS validation, which the
 * caller performs). Rows without an effectId are skipped.
 */
export function projectRows(rows) {
  const canonical = new Map();
  const hashes = new Map();
  let quarantined = 0;
  for (const e of rows) {
    if (!e || typeof e.effectId !== 'string') continue;
    const h = effectPayloadHash(e);
    const prior = hashes.get(e.effectId);
    if (prior === undefined) { canonical.set(e.effectId, e); hashes.set(e.effectId, h); }
    else if (prior !== h) { quarantined += 1; }
  }
  return { canonical, quarantined };
}

/** Stable root over the canonical projection — MUST match effectEvent.ts effectProjectionRoot. */
export function projectionRoot(rows) {
  const { canonical } = projectRows(rows);
  const out = [...canonical.values()]
    .map((e) => ({ effectId: e.effectId, payload: effectPayloadHash(e) }))
    .sort((a, b) => (a.effectId < b.effectId ? -1 : a.effectId > b.effectId ? 1 : 0));
  return canonicalHash({ domain: 'AUKORA-EFFECT-ROOT/1', rows: out });
}
