// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * EXTERNAL NERVES — DISABLED/STUBBED (R35).
 *
 * Actions are the only Convex primitive that may touch the outside world. This round every external nerve is a
 * STUB that refuses: the local nervous system performs ZERO outbound network I/O. (The one other action in this
 * deployment, ingest.ts, is the Node-runtime secret-scan door — it computes locally and calls a mutation; it
 * performs no network I/O either.) Enabling a real external nerve is a deliberate future round with its own
 * ceilings and evidence, never a default.
 */
import { action } from './_generated/server';
import { v } from 'convex/values';

export const external = action({
  args: { target: v.string() },
  handler: async (_ctx, { target }) => {
    return {
      ok: false,
      refusal: `disabled: external nerves are stubbed this round — no outbound I/O (requested: ${target.slice(0, 64)})`,
      networkPerformed: false,
    };
  },
});
