# apps/brain (scaffold)

The Convex reactive brain: curated persistent growing memory. Ingests events, persists
content + provenance through a governed transport, chains receipts, updates a reactive
snapshot, and proves recall + growth across events. Runs headlessly with `convex-test` when
live Convex is unavailable (and never claims live cloud when using `convex-test`).

Layout (to be filled by Worker Two): `convex/` reactive backend, `src/` snapshot + append/
recall + governed transport, `demo/` deterministic growing-memory proof.

Status: **scaffold**. Implementation is Worker Two's lane. Consumes `packages/{memory,evidence,
kernel}`; never the reverse. No bulk copy of the Symbiote Convex backend.

Truth label: DESIGN_ONLY until the deterministic proof (`npm run demo:organism`) exists.
