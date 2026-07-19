# Issue preservation ledger

`docs/issue-preservation-ledger.json` (v2) is the machine-readable, cross-repository record of
every open and closed **issue** (PRs excluded) in the source repos, so no capability is lost.

**Canonical counts (gated by `scripts/verify-continuity.mjs`):** the ledger holds exactly **191**
historical issues — **169** `aukora-symbiote` + **13** `aukora-kernel` + **9** `aukora-fu`. Zero
missing, zero ledger-only. The kernel and fu number sets were proven equal to the GitHub sets at
capture (capture-consistent snapshot in `docs/atlas/CURRENT_OBJECTS.json`; live equality is not
re-claimed afterwards); the **169 Symbiote entries are settled by owner ratification**.

**Privacy law (wording corrected R57A):** public object *numbers and URLs* may be visible — the
sanitized public rows carry them. What remains withheld is donor-private **titles, bodies, and
labels** (`title:null, redacted:true`). An earlier version of this document wrongly claimed the
numbers themselves were held privately.

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

## Post-ratification pending intake (R57A)

The 191-row preservation set is **frozen by ratification** and is never silently rewritten. Donor
objects created *after* ratification enter a separate sanitized pending-intake queue in
`docs/atlas/CURRENT_OBJECTS_R57A.json` (`pending_intake`) with number/state/URL/capture-timestamp
only — titles, bodies, and labels are never fetched into the public artifact. Currently pending:
donor object `aukora-symbiote#405` (`PENDING_OWNER_RATIFICATION`, captured 2026-07-19). A pending
entry joins this ledger only by explicit owner ratification, which changes the canonical counts in
a declared, gated commit — never implicitly.

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
