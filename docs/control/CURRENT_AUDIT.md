# CURRENT AUDIT — R60 auditor packet (canonical in-tree, public-readable)

> **Purpose.** Lets a seat with **no issue #20 access** (e.g. Mistral) read the full audit prompt and
> the prior-round findings directly from public `main`. This file is a sanitized mirror; the live
> issue #20 thread is always the source of truth when reachable.
>
> **Truth class:** CAPTURE_CONSISTENT — the findings below were the R59 Avengers synthesis at the
> snapshot instant recorded in [CURRENT_ROUND.md](./CURRENT_ROUND.md); freshness is not claimed after.

## How to audit (READ FIRST)

1. **Git-capable seats:** `git fetch origin && git checkout --detach origin/main`. Record the exact
   `git rev-parse HEAD` in your report and audit **that** tree. The canonical R60 base is
   `1e1bfcf437b7ee8ece1b4ecb66c859ee17377d2e`; if `origin/main` has advanced past it (R60 integration
   in progress), audit the tip and say so.
2. **Non-git / snapshot-only seats:** you are reading a pinned mirror. **Label your entire report
   `POSSIBLY_STALE`** and name the base SHA from CURRENT_ROUND.md you relied on. Do not assert live
   equality — a mirror cannot prove it.
3. **Execute, do not read:** run `npm ci` then `npm run test:all`; re-measure totals from the log
   rather than trusting any published number. Run the **canonical** public secret/PII scan — the exact
   in-repo gate CI runs — `npx tsx apps/seed/scripts/scan-public-tree.ts` over the repository's tracked
   public tree; it must report `PASS` with **0 blocking** findings (advisories are non-blocking). Do not
   substitute an ad-hoc scan. Reproduce any PoC in a scratch dir; never mutate the tree, never write to
   any branch, never use credentials or paid/provider inference.
4. **Report** exact base SHA, gate outcomes, measured totals, and each finding with a VERIFIED /
   FALSIFIED / UNPROVEN / STALE / POSSIBLY_STALE label. Do not infer a result you did not run
   (the R60 Fugu pass produced **no output** — HTTP 500 ×2 — and must be recorded as transport failure
   only, never converted into a finding).

## R59 standing truths (preserved into R60)

- 1542 passing + 2 gated skips at the R59 base; CI / public scan / provenance / continuity green.
- Embedded KIRA is **not implemented / not live**; Convex is the one canonical durable-memory writer today.
- Cell 0A is disabled / NOT_READY; **no provider or Nebius call is authorized**.
- The frozen 191-row preservation ledger remains byte-untouched.
- `verifySwarmRunEnvelope` proves **digest integrity, not governance authenticity**; any API/consumer
  wording implying authority from a bare digest verifier is unsafe.

## R59 Avengers synthesis — reproduced exact-base findings (the R60 repair targets)

| ID | Sev | Finding (reproduced on exact R59 base) |
|----|-----|----------------------------------------|
| **H1** | HIGH | Evidence TOCTOU/accessor class: seal, re-govern, and receipt pairing read live objects before/after canonical snapshotting; getter "chameleons" can reopen governed minting. `ACCEPTANCE_ELIGIBLE_SOURCES` is exported **mutable**. |
| **M1** | MED | Erase record→root isolation absent: registered root A can erase a record owned by root B because durable records do not pin `ownerRootId`. |
| **M2** | MED | Cell 0A parser/egress gaps: duplicate JSON keys pass; metadata / RFC1918 / alternate-loopback / IP / IDN / port / host tricks pass substring checks. |
| **M3** | MED | Cutover verifier thinner than contract prose: kill-switch direction and transition/seam identity not derived from typed data; checkpoint omits erase-root registry, erase attestations, writer epoch, explicit no-resurrection continuity. |
| **P1** | LOW | Mind-door **empty-token fail-open**: `AUKORA_DOOR_TOKEN=""` bypasses the R44 POST-token check. Distinct from the R59 brain-door control-token repair, which held under attack. |
| **P1** | LOW | No-overclaim synonyms: "solved / cleared / won / completed N levels" bypass the ARC guard that catches "beaten N levels." |
| **Fu** | — | Donor-pinned 1/φ floor is real; `aukoraFuCouncil.ts:297 > 0.5` makes `mixed` unreachable for any ordinary multi-seat contradiction set. Council pluggability / advisory-only posture held. |
| diligence | — | Package-row counts and round headers stale; minor SPDX coverage drift. |

## Stale / contradicted prior-seat notes (do not re-raise as new)

- Gemini executed R58 `c87880d`, not R59 — useful only as a stale baseline.
- Auma audited a possibly-stale working tree: its writer-lock / no-resurrection concerns are accepted as
  **prerequisites to test** (R60 Sam 3), while its "Cell 0A absent" observation is stale.
- Manus's "brain-door lacks token" is **falsified** by R59 exact-base source/tests; the separate
  **mind-door empty-token** finding (Fable) is retained (R60 Sam 2).
- Mistral did not receive the R59 directive and produced no audit; this packet is the repaired access path.

---

*Lane mapping of the above into R60 repairs is in [CURRENT_ROUND.md](./CURRENT_ROUND.md) (verbatim directive).*
