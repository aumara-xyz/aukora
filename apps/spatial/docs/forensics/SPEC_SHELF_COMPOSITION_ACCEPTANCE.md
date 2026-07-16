<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# SPEC — shelf-composition acceptance for any memory migration (#62 false-green guard)

**Status: SPEC ONLY (R42 witness output). Building it is an owner call. No code exists or is implied.**

## The failure this guards against
Donor issue #62 proved the donor brain holds **76 atoms: 70 tests, 5 evidence, 1 architecture, 0 identity**.
Any migration acceptance built on *row counts* or *chain verification* alone would read **GREEN** while
faithfully carrying an **empty identity shelf** into the new organism — a perfect, integrity-checked copy
of the wrong baseline ("better recall of the wrong baseline", #57's own warning).

## Acceptance assertions (all must hold, in addition to existing row/chain checks)
1. **Composition, not count:** the migrated store's atoms grouped by scope tag must satisfy a declared
   floor per scope — at minimum `identity ≥ 1`, `docs/architecture ≥ 1` — with the floors declared in the
   acceptance fixture, not inferred. A migration of a source that CANNOT satisfy the floor must fail RED
   with the message "source shelf is empty for scope <s> — migration would preserve an empty shelf",
   never silently pass.
2. **Provenance of the floor-satisfying atoms:** each atom counted toward a floor must carry source
   provenance that is NOT a test path (`^tests?/` and `*.test.*`/`*.spec.*` are disqualified) and NOT
   self-map noise. For identity atoms: provenance must reference the owner-home corpus **by pointer +
   sha256 only** (the anchor rule — content stays out of tree, hashes in).
3. **Recall probe:** after migration, the #62 probe queries ("who am I / maternal anchor / identity
   values") must return ≥ 1 atom whose scope is `identity` in the top-5 — not "least-bad noise". The
   probe must also run BEFORE migration on the source: if the source fails it (donor today), the
   acceptance report states plainly that migration cannot create continuity that never existed, and the
   owner decides whether to ingest the identity corpus first (#57/#62 sequencing) or migrate anyway with
   the empty shelf **explicitly labelled**.
4. **No silent enrichment:** the migration itself must not fabricate identity atoms to satisfy the floor.
   Floor-satisfying atoms must pre-exist in the source or arrive through the separately-gated ingestion
   lane (#93's rule: memory-shaping is body-shaping — signed/gated, never casual import).
5. **Report shape:** the acceptance emits a composition table (scope → count, source-class → count) next
   to the row/chain results, so a reviewer sees "1200 rows, chain OK, identity: 0" as the contradiction
   it is.

## Non-goals
No retrieval-bias tuning (retrieval was proven correct in #62); no auto-ingestion of the identity corpus
(owner-gated, PII denylist); no change to chain/receipt laws — this SPEC only adds composition truth on
top of them.
