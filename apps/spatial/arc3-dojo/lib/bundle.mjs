// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Evidence bundle for one ARC-3 Dojo episode (#102 artifact protocol).
 *
 * The `core` is the deterministic, content-addressed episode (see dojo.mjs); `coreHash` is what must match
 * on a second node. The session `guid` (Math.random) and the node fingerprint are recorded OUTSIDE the core.
 * A run declares its authority / network / secret surface — all inert: no key, no network, no repo mutation.
 */
import { nodeFingerprint } from './hash.mjs';

export function makeBundle({ core, coreHash, guid }) {
  return {
    schema: 'aukora-arc3-dojo-bundle-v1',
    coreHash,
    core,
    // The donor session key is a Math.random() value: non-reproducible and non-evidential (the world is fully
    // determined by arcadeSeed), so it is NOT embedded — its presence keeps the committed receipt byte-stable.
    session: { guidPresent: typeof guid === 'string' && guid.length > 0, note: 'donor Math.random session key — excluded from evidence' },
    environment: nodeFingerprint(),
    execution: { firstHand: true, mode: 'in-process' },
    surface: {
      label: core.label,
      officialArcAgi3: false, // NEVER an official ARC-AGI-3 result — onboard-compatible only
      grantsAuthority: false,
      network: 'none (in-process; onboard arcade, no key, no benchmark API)',
      secretsTouched: 'none',
      mutatesMain: false,
    },
  };
}
