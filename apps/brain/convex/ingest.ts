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
import { action } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';
import { textHasSecret } from '@aukora/evidence';

export const ingest = action({
  args: { record: v.any() },
  handler: async (ctx, { record }): Promise<unknown> => {
    const content = (record as { content?: unknown } | null)?.content;
    if (typeof content === 'string' && textHasSecret(content)) {
      return { ok: false, refusal: 'refused: memory content carries a secret; not persisted in plaintext' };
    }
    // Validation, corrupt-store gate, content-free receipt chain, and reactive snapshot all happen atomically
    // in the internal mutation.
    return await ctx.runMutation(internal.memory.ingestValidated, { record });
  },
});
