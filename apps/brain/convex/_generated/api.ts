// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Codegen equivalent of Convex's `_generated/api` (what `npx convex codegen` emits): the function-reference
 * roots. `anyApi` resolves `api.memory.ingest` to the module `memory`, export `ingest`, which is exactly how
 * convex-test dispatches. Hand-written so the backend runs headlessly with no deployment.
 */
import { anyApi } from 'convex/server';

export const api = anyApi;
export const internal = anyApi;
