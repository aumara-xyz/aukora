// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * @aukora/immune — a METAPHORICAL immune-system substrate (R55 skunkworks / research).
 *
 * ⚠️ METAPHOR NOTICE. Every biological term here — "thymus", "killer T", "memory B", "antibody", "inflammation",
 * "homeostasis", "patrol", "Petri dish" — is a NAMING METAPHOR for a pure, deterministic scoring/state function
 * over threat-signature data. Nothing in this package is biology, cognition, aliveness, or a running organism, and
 * nothing here is production-grade. It is arithmetic over immutable inputs.
 *
 * HARD BOUNDARIES (every export upholds these):
 *   - advisory only: the package exposes `immuneGrantsAuthority(): false`, and every per-module `*GrantsAuthority()`
 *     helper (e.g. `decayGrantsAuthority()`) returns false; verdicts are LABELS, never commands;
 *   - no actuator: nothing here executes a process, writes a file, opens a socket, or calls the network — "spawn",
 *     "execute", "quarantine" are data transitions that RETURN a description, they never act;
 *   - no persistence: no Convex, no KIRA store, no disk — the Petri dish is a pure fold over an event list;
 *   - no prompt wiring: the donor's `proprioception` system-prompt module is deliberately EXCLUDED.
 *
 * Consumers treat these outputs as advisory evidence only; authority remains solely the kernel's `decide()`.
 */
export * from './src/decay.js';
export * from './src/thymus.js';
export * from './src/engagement.js';
export * from './src/inflammation.js';
export * from './src/killerT.js';
export * from './src/antibody.js';
export * from './src/memoryB.js';
export * from './src/homeostasis.js';
export * from './src/patrol.js';
export * from './src/petriDish.js';

/** HARD: the immune substrate is advisory; no export grants authority. Constant, by construction. */
export function immuneGrantsAuthority(): false {
  return false;
}
