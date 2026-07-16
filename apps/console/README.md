# apps/console (scaffold)

Minimal operator console: a **read-only-by-default** window into the organism — authority
state, memory growth, proposal lifecycle, council verdict, receipt/Merkle lineage,
model-provider status, and budget/containment state. It **displays** evidence; it cannot grant
authority. Owner actions require explicit local AUMLOK interaction. No secrets or raw private
memory are rendered.

Layout: `src/` UI, `public/` static assets only.

Status: **scaffold**. The real console depends on the `apps/{brain,seed}` state shapes and will
land after those surfaces exist. This is not the full Symbiote UI.

Truth label: DESIGN_ONLY until it renders real organism state read-only.
