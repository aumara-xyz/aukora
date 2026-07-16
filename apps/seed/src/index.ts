// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * @aukora/seed — governed inward-out recursion + the AUMLOK owner-gate + deterministic advisory review.
 * Adapter; never mutates a live repo, never signs for the owner, never grants authority.
 */
export * from './ownerGate.js';
export * from './mockCouncil.js';
export * from './recursion.js';
