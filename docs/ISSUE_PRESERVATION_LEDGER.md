# Issue preservation ledger

`docs/issue-preservation-ledger.json` is a machine-readable, cross-repository record of every
open and closed **issue** (pull requests excluded) in the source repositories, so no capability
is lost as work consolidates into Aukora.

**Status: COMPLETE (first pass).** Every source issue has exactly one disposition.

- Public source repos (`aukora-kernel`, `aukora-fu`) are classified with rationale + confidence.
- The private `aukora-symbiote` repo is **sanitized**: number, state, source URL, capability
  family, and a derived disposition only. **No titles, labels, bodies, or comments are published
  here.** The full sensitive ledger (with titles and rationale) lives only in a private draft PR
  in `aukora-symbiote`.
- Dispositions are a first pass **pending owner ratification**.

## Coverage proof

`coverage_proof` in the JSON asserts: `total_source_issues == dispositions_assigned`, exactly one
disposition per issue, and no duplicates. A per-capability-family rollup shows which families are
preserved. **Families currently flagged for owner review (all-QUARANTINE, capability could
disappear): `convex`, `persistence`, `adapter-contract`.** These are surfaced deliberately rather
than hidden.

## Kernel #13–#17 reconciliation

The old kernel "breakthrough carry-forward ledger" (#13–#17) is reconciled in
`kernel_13_17_reconciliation`: each gets exactly one disposition consistent with this ledger.

## Taxonomy

`IMPLEMENTED` · `PORT` · `PRODUCT_STAYS` · `RESEARCH_ONLY` · `QUARANTINE` · `DUPLICATE` ·
`SUPERSEDED` · `PRIVATE_REDACTED`.
