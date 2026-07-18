# CONFLICTS (derived from ATLAS.json)

## Recorded, not silently resolved

1. **Donor in-Convex authority vs current outside-Convex law** — owner RATIFIED current (Wave 2); donor variant recorded as reference. Evidence: `convexWorkflowStore` tamper suite; manifest conflicts block.
2. **State-vs-proof gap:** was 10 at atlas creation; after checkpoint-1 verification: 0 remaining DONE_UNVERIFIED (9 verified with commit/PR refs; symbiote #3 flipped to RESTORE_DONOR — closed with no trace).

3. **Reverse false-green (NEW, Sam 4 R42):** capabilities landed in code while their issues stay OPEN (donor #265 confirmed) — issue-state audits under-claim; SHA evidence outranks state in both directions.
4. **Both-sides gap (Sam 4 R42):** donor #244 — disposition outcomes are never written back into recallable memory in EITHER tree; shared gap for the morning queue.

## R56 continuity-truth reconciliation (Sam 2) — recorded, not silently flipped

Reproduced each flagged ledger↔atlas pair before touching anything. The preservation LEDGER
(`docs/issue-preservation-ledger.json`, owner-ratified 169) and the restoration ATLAS
(`docs/atlas/ATLAS.json`) classify on **orthogonal axes** — the ledger's `classification`
(QUARANTINE/PORT/DUPLICATE = *how it is preserved*) is not the atlas's `disposition`
(RESTORE_DONOR/PRODUCT_PARKED/RESEARCH_PARKED/BLOCKED_OWNER/NEBIUS_LATER = *the restoration queue*).
`verify:continuity`'s only cross-view invariant is number-set membership (no orphans), which holds.

5. **Voice / #47, #48, #50 — FALSIFIED as contradictions.** ledger `QUARANTINE/QUARANTINE/PORT` vs atlas
   `PRODUCT_PARKED/BLOCKED_OWNER/RESEARCH_PARKED`. These are the two orthogonal axes above, not opposite calls; and
   both are consistent with anatomy's `duplex-voice-supervision: RUNTIME_UNPROVEN` (no proven live voice runtime).
   No change.
6. **#71 (Symbiote lost-vs-live) — FALSIFIED as a contradiction.** ledger `QUARANTINE/scheduled` (preserve) vs atlas
   `RESTORE_DONOR/open` (a donor capability queued for restore). Both say "not yet a proven current capability" —
   consistent, different axes. No change.
7. **#106 / #107 — reproduced, stale-open is NOT in this ledger.** These are PUBLIC `aumara-xyz/aukora` issues
   (not aukora-symbiote), both now **CLOSED** on GitHub (#106 "R51 continuity: refresh the Atlas and gate" — the
   gate shipped as `scripts/verify-continuity.mjs`; #107 "[R51 CORE] Supervisor must own worker PIDs and leases").
   They carry no symbiote-ledger row. Any lingering "open" belongs to the current-object snapshot refresh
   (`CURRENT_OBJECTS.json`), consumed from Sam 1's integrated capture — NOT hand-edited here.
8. **#391 — GENUINE same-axis disagreement → OWNER-RULING item (not flipped).** ledger `DUPLICATE/superseded`
   vs atlas `RESTORE_DONOR` (privacy_class `PRIVATE_HOLD`). The atlas row's own `family_status` reads
   "UNRESOLVED — R46 amend … Disposition remains authoritative", i.e. the atlas conservatively keeps it as a donor
   capability pending an owner batch ruling. It is a PRIVATE, owner-ratified issue; I do NOT flip ratified/private
   dispositions autonomously. **Open owner call:** if #391 is ruled a duplicate, ATLAS RESTORE_DONOR drops 36→35
   and `LOST_CAPABILITIES` uncategorized 6→5.
9. **LOST_CAPABILITIES 35→36 / uncategorized 5→6 — synced (derived-doc staleness).** The derived
   `LOST_CAPABILITIES.md` claimed 35 while its `ATLAS.json` source holds **36** RESTORE_DONOR rows
   (symbiote-uncategorized: #3, #33, #244, #298, #344, #391). Corrected the derived doc to match the source; the
   count is contingent on the #391 ruling above.
