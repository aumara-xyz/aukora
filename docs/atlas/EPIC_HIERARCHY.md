# Active-brick epic hierarchy (R51 / #106 req 5 + 7)

A **small** organ-level epic hierarchy under which every active deduplicated `CORE_NOW` Atlas row maps
to **one actionable public issue or a proven existing equivalent** — without creating hundreds of noisy
issues (req 6). Parked / research / product / quarantine / done rows stay in the Atlas, not as issues.

## The hierarchy (existing public issues — the epics already exist)

**Organ-level capability epics** (`aumara-xyz/aukora` issues):

| Epic | Organ |
|---|---|
| #2 | Canonical package convergence (kernel / evidence / council) |
| #3 | Convex reactive brain |
| #4 | KIRA memory envelope + governed forgetting |
| #5 | AUMLOK owner gate |
| #6 | AURA receipt + Merkle evidence |
| #7 | Fu advisory council |
| #8 | Governed inward-out recursion |
| #9 | Minimal organism console |
| #10 | Brain-provider interface + model provenance |
| #11 | Symbiote consumer rebase |
| #12 | Fu friend-harness consumer rebase |
| #13 | Old-issue migration + preservation (this continuity lane) |
| #14 | Proof Portal hardening |
| #15 | G1 / Nebius canary (quarantined, unarmed) |
| #16 | Research / design backlog (patent/publication review) |

**Lane-ownership epics:** #20 (Sam 1 control) · #21 (Sam 2 brain) · #22 (Sam 3 recursion/AURA/safety) · #23 (Sam 4 shell/console).

**Active R51/R50 bricks (open issues):** #101 (spatial parity) · #102 (ARC-3 dojo) · #106 (this Atlas round) ·
#107 (supervisor worker-PID ownership) · #108 (Convex durable workflows) · #109 (wire `@aukora/mind` into the runtime).

## CORE_NOW → epic mapping

41 `CORE_NOW` rows in the refreshed Atlas. **33 map to an existing organ epic**; the remaining 8 are
themselves epics/lane issues (#11, #20, #109) or terse donor rows routed below. No new issues were minted
(req 6); the mapping is the actionable link.

- **#2** ← 3 rows · **#3** ← 5 · **#4** ← 2 · **#5** ← 3 · **#6** ← 1 · **#7** ← 2 · **#8** ← 1 · **#9** ← 3 ·
  **#10** ← 2 · **#13** ← 2 · **#14** ← 1 · **#15** ← 1 · **#16** ← 1 · **#101** ← 3 · **#102** ← 1 · **#107** ← 2.
- Self-epics / lane issues: `aukora#11`, `aukora#20`, `aukora#109`.
- **Routed donor rows (owner to confirm categorization):** `aukora-symbiote#183` (safety-rail) → lane epic **#22**
  (safety laws); `aukora-symbiote#274/#280/#335/#342` (uncategorized in the sanitized public projection; their
  sensitive titles live only in the private Symbiote ledger) → holding epic **#16** until the owner categorizes
  them from the private ledger. These are flagged, not fabricated — the public projection cannot name them.

## Rule

New actionable issues are created **only** when a `CORE_NOW` row has no existing epic and the owner
elevates it. Parked/research/product/quarantine/done rows remain Atlas rows. The `verify-continuity` gate
keeps the Atlas fresh so this mapping never silently drifts.
