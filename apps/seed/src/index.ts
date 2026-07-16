// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * @aukora/seed — governed inward-out recursion + the hybrid AUMLOK owner-gate + deterministic advisory review.
 * Adapter; never mutates a live repo, never signs for the owner (the runtime only VERIFIES), never grants authority.
 */
export * from './proposal.js';
export * from './ledger.js';
export * from './mockCouncil.js';
export * from './aumlokGate.js';
export * from './ownerFixture.js';
export * from './recursion.js';
