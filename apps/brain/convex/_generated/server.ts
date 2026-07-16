// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Codegen equivalent of Convex's `_generated/server` (what `npx convex codegen` emits): the schema-typed
 * function builders, re-exported from `convex/server`. Hand-written so the curated backend runs headlessly under
 * convex-test with no deployment, no login, and no cloud. convex-test also uses the presence of this
 * `_generated` directory to locate the convex module root.
 */
export {
  queryGeneric as query,
  mutationGeneric as mutation,
  actionGeneric as action,
  internalQueryGeneric as internalQuery,
  internalMutationGeneric as internalMutation,
  internalActionGeneric as internalAction,
  httpActionGeneric as httpAction,
} from 'convex/server';
