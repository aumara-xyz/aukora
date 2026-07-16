<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# models/

Sanitized model manifests and deployment descriptors. **No weights. No endpoint IDs, job IDs, bucket IDs, or
tokens.** Truth labels and checksum bindings only.

- [`MODEL_TRUTH.md`](./MODEL_TRUTH.md) — the truth table and the evidence gate (`resolveTruth`). The
  machine-readable source of truth is `MODEL_MANIFEST` in `apps/brain/src/brainProvider.ts`; this file mirrors
  and explains it.
- [`ARTIFACT_INVENTORY.md`](./ARTIFACT_INVENTORY.md) — reachable, checksum-bound model artifacts (this round: 0).
  When empty, `selectBrainProvider` (`apps/brain/src/providerPolicy.ts`) fails closed to the deterministic
  offline provider.
- [`nebius/`](./nebius/) — the bounded, **PARKED**, reproducible Nebius container/runtime manifest and its
  go-live checklist. Consumed by the bounded adapter `apps/brain/src/nebiusProvider.ts`.

No model grants authority. Providers are advisory only.
