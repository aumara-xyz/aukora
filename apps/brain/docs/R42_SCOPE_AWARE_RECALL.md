<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# R42 candidate — scope-aware recall (KEPT) — the #62 "empty shelf" fix

One bounded candidate, wholly inside `packages/memory/**` (owned path), deterministic, donor-backed, synthetic
identity fixtures only, with a negative falsifier. Non-Ring-0 (recall is advisory; grants no authority). No new
dependency, no network, no owner identity content, no other lane's file.

## Gap (from the atlas)

The current recall (`packages/memory/src/recall.ts`) is **scope-blind**: it cannot tell an identity memory from a
test/code memory, so a mixed corpus reproduces symbiote #62's empty shelf — and, crucially, a consumer cannot
tell **"identity corpus absent"** from **"retrieval bias"**.

## Donor evidence (comparative)

`core/src/kiraBrain.ts@fa113e8ae719016ad30e32a50fa6967a6978f456`:
- atoms carried a `scope` string (`scope: rel.split(path.sep)[0]`),
- `isTestFile` = `/(^|\/)tests?\//` on the path OR `\.(test|spec)\.[tj]sx?$` on the name,
- the #62 census that proved the defect: `tests:70, evidence:5, architecture:1, identity:0`.

## What was added (opt-in contract split — default recall byte-exact, per WAVE 3)

- `src/scope.ts`: `classifyScope(record) → MemoryScope` (identity/architecture/evidence/doc/test/code/general),
  `scopeCensus(records, forgotten)` (the #62 diagnostic), `hasScope(records, scope, forgotten)` (the honest
  "is the shelf empty?" signal). Pure — provenance + content, no I/O.
- `src/recall.ts`: the STABLE contract v1 (`RecallQuery`/`RecallHit`/`recall`) is the exact pre-#62 shape —
  `recall()` never computes or emits scope. Scope-aware recall is a SEPARATE, explicitly opt-in contract:
  `ScopedRecallQuery` (adds `scopes`/`excludeScopes`/`preferScopes`) + `ScopedRecallHit` (adds `scope` as an
  additive last key) + `recallScoped()`, mirrored by `ReactiveMemoryStore.recallScoped`.

## Falsification cycles (honest keep — cycle 4 came from review)

1. **Write + prove.** Classifier vectors; empty-shelf reproduction (plain recall floods with `test`); fix
   (`preferScopes:['identity']` floats identity to #1; `excludeScopes:['test','code']` suppresses the flood);
   **negative falsifier** — an ABSENT identity shelf returns `[]` under `scopes:['identity']` (the fix never
   fabricates identity), and `hasScope` reports `false` so a consumer can say "corpus absent," not "bias."
2. **Adversarial falsification → real fix.** A TEST file quoting "maternal anchor" classified as `identity`
   (identity precedence) — a re-pollution hole that DIVERGED from the donor (where a structural test path is
   authoritative). Reordered so **structural test path/name/body beats identity**; genuine identity CONTENT
   under a non-test provenance still surfaces. Test updated to assert the donor-authoritative rule.
3. **Regression.** Full downstream battery unchanged: `@aukora/memory` 14 (7→14), `@aukora/brain` 122,
   `@aukora/seed` 255, root 145; kernel/memory typechecks clean; provenance byte-identity ✓; portable +
   canonical boundary ✓.
4. **External falsification (owner review, WAVE 3) → contract split.** The original design put an additive
   `scope` field on EVERY `RecallHit`, so the "default recall byte-identical" claim was FALSE — every default
   serialized hit changed shape even with no scope option requested. Fixed by splitting the contract (above):
   the default `recall` is restored to the exact pre-#62 five-key shape and never computes scope; scope lives
   only on the opt-in `recallScoped`. New exact serialization-shape regression tests freeze the default hit's
   keys/order/JSON bytes (no `scope` key), prove the opt-in hit's first five keys+values equal the default hit,
   and prove scope selectors passed to the default `recall` are ignored. Stored-consumer proof: on the WAVE 3
   head (merged onto main `486322ff`) the full gate is green — root 149, kernel chain PASS, memory 17, brain
   122/2skip, seed 257, console 44, spatial 27 — and `fixture:console` regenerates the committed fixture
   **byte-identical**, so serialized, hashed AND stored consumers are all proven unaffected.

## Honest scope of the fix (what it does NOT claim)

It restores the *ability to distinguish and query by scope* and to report shelf emptiness — it does **not**
ingest an identity corpus (that content is out-of-tree and owner-private) and it does not fabricate identity.
The empty-shelf symptom is *addressable* with this, but curing it needs a curated, owner-approved identity
ingest (still parked, per #62/#93). Content-free forgetting stays distinct from absence (a forgotten identity
atom is `gone`, census 0).
