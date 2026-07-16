# @aukora/memory (scaffold)

Pure KIRA memory contracts: the core memory envelope, consent scope + provenance, and the
append/recall contract shapes. **Pure only** — no filesystem, no Convex, no network. The
reactive brain snapshot and Convex/fs persistence live in `apps/brain` as adapters that
*consume* these contracts.

Status: **scaffold** (directory reserved). Implementation is Worker Two's lane
(`codex/brain-seed-r27`, curated — not bulk-copied — from the Symbiote memory donor). This
README is a placeholder so the architecture and CI are coherent; no code has landed yet.

Truth label: DESIGN_ONLY until source + tests + export exist here.
