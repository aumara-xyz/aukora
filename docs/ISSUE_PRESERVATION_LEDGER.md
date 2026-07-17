# Issue preservation ledger

`docs/issue-preservation-ledger.json` (v2) is the machine-readable, cross-repository record of
every open and closed **issue** (PRs excluded) in the source repos, so no capability is lost.

**Canonical counts (gated by `scripts/verify-continuity.mjs`):** the ledger holds exactly **191**
historical issues — **169** `aukora-symbiote` + **13** `aukora-kernel` + **9** `aukora-fu`. Zero
missing, zero ledger-only. The kernel and fu number sets are proven byte-for-byte equal to the live
GitHub sets (snapshot in `docs/atlas/CURRENT_OBJECTS.json`); the **169 Symbiote entries are settled by
owner ratification** (their sensitive numbers/titles are held privately, `title:null, redacted:true`).

**Status: COMPLETE (second sweep).** Every source issue carries exactly one **disposition** and
exactly one **completion_status** — `present_tested`, `superseded`, `scheduled`, or
`stays_in_product`. IMPLEMENTED items carry a `present_tested_evidence` pointer. The second sweep
inspects completion evidence (linked PRs, cross-references, comment activity), not titles alone;
no bodies are bulk-copied.

- Public source repos (`aukora-kernel`, `aukora-fu`) classified with rationale.
- Private `aukora-symbiote` is **sanitized** here (number/state/url/family/disposition/
  completion_status only). The full **sensitive** ledger lives in a private draft PR in
  `aukora-symbiote`.
- The **169 Symbiote preservation entries are ratified/settled** (R51, #106 req 2). The kernel/fu
  classification rationales remain recorded and open to owner refinement; the preservation *set* is fixed.

## Proofs

`completion_proof` asserts exactly-one-disposition and exactly-one-completion-status per issue,
and that every IMPLEMENTED item has present/tested evidence. Families flagged all-QUARANTINE
(capability could disappear, owner review): `convex`, `persistence`, `adapter-contract`.
Kernel #13–#17 breakthrough ledger reconciled in `kernel_13_17_reconciliation`.

## Durable capability backlog

`docs/CAPABILITY_BACKLOG.json` holds durable records for six capability families:
(A) governed legacy-memory migration, (B) Convex ReactiveBrainAdapter + durable workflows,
(C) Auma R0–R3 IDE/candidate staging, (D) bounded voice+vision KNVS lab,
(E) checksum-bound multimodal/model truth, (F) digital-metabolism/resource-governor research.
Public entries are sanitized (disposition + provenance). Sensitive research detail and
owner-local paths stay only in the private ledger. Promote to tracked issues on owner ratification.

## Taxonomy

`IMPLEMENTED` · `PORT` · `PRODUCT_STAYS` · `RESEARCH_ONLY` · `QUARANTINE` · `DUPLICATE` ·
`SUPERSEDED` · `PRIVATE_REDACTED`.
