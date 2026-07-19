'use node';
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * The PUBLIC ingest door — a Node-runtime action ("external nerve" in the ReactiveBrainAdapter role map).
 *
 * The canonical @aukora/evidence secret scanner depends on `node:crypto` (provenance-locked digest module),
 * which the Convex isolate runtime does not provide — so the scan runs HERE, in the official Node runtime, and
 * the atomic reflex it guards (`internal.memory.ingestValidated`) is an INTERNAL mutation a client can never
 * call directly. Fail-closed by structure: there is no path into the chain that skips the scan. Reuse, not
 * clone — the scanner is imported from the canonical package.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { action } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';
import { textHasSecret } from '@aukora/evidence';
import { qualifyMemoryIngest } from '@aukora/memory';

/** Constant-time capability check against the deployment secret (env only — NEVER in the repo/receipts). Both
 *  sides are sha256'd first so a length difference cannot leak and unequal lengths cannot throw. */
function ingestCapabilityValid(presented: unknown): boolean {
  const expected = process.env.AUKORA_INGEST_CAPABILITY;
  if (typeof presented !== 'string' || typeof expected !== 'string' || expected.length === 0) return false;
  const a = createHash('sha256').update(presented).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export const ingest = action({
  // R56: an optional door/service capability. A SENSITIVE (owner-only/private) self-attested consent REQUIRES it;
  // an OPEN (shared) ingest is admitted but its self-attested provenance is quarantined content-free.
  args: { record: v.any(), capability: v.optional(v.string()), ownerRootId: v.optional(v.string()) },
  handler: async (ctx, { record, capability, ownerRootId }): Promise<unknown> => {
    const content = (record as { content?: unknown } | null)?.content;
    if (typeof content === 'string' && textHasSecret(content)) {
      return { ok: false, refusal: 'refused: memory content carries a secret; not persisted in plaintext' };
    }
    // AUTHENTICITY GATE: validateMemoryRecord proves shape + content-address, NOT that a public caller may claim
    // owner-only/private trust. Sensitive consent without a valid capability is refused; open consent is admitted
    // with its self-attested provenance stripped to a content-free untrusted marker.
    const consent = (record as { consent?: unknown } | null)?.consent;
    const q = qualifyMemoryIngest({ consent, capabilityValid: ingestCapabilityValid(capability) });
    if (q.decision === 'refuse') {
      return { ok: false, refusal: `refused: ${q.reasonClass}` };
    }
    const toIngest = q.decision === 'quarantine'
      ? { ...(record as Record<string, unknown>), consent: q.consent, provenance: q.provenance }
      : record;
    // Validation, corrupt-store gate, content-free receipt chain, and reactive snapshot all happen atomically
    // in the internal mutation (unreachable by a client — the only trusted path preserves attested provenance).
    return await ctx.runMutation(internal.memory.ingestValidated, { record: toIngest, ownerRootId });
  },
});
