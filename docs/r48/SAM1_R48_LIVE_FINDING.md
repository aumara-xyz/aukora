# R48 live evidence — Sam 1 integration finding

## Integrated (all gates green, 804 passing)
- Sam 2 `bedb2ba` — #87 STORE seam proven sound (6 regressions: first-create → one durable v1;
  dedup; OCC race + rehydrate; stale-head; refused≠conflict distinguished AT THE STORE SEAM;
  byte-parity with in-process store) + the Inkling provider/evolution-cell boundary (parked,
  no transport, content-free receipts, zero authority).
- Sam 3 `69cebc5` — governed model-crossing cell (generic model-cell adapter).
- Sam 4 `09c4539` — Inkling-on-Nebius evidence (serving manifest `enabled:false`, no URL/key;
  bringup + snapshot/evidence contract). Sanitized: 0 credentials/endpoints in the tree.

## R48 outcome #1 (close #87) — NOT MET BY LIVE EVIDENCE (named failed gate)
Re-ran the exact reproducer against this integrated tree on the running single-owner organism:
`POST 127.0.0.1:7097/api/propose` (fresh, well-formed, uniquely-hashed) →
`phase:"refused-at-proposal" · reasonClass:"workflow:store-conflict" · touchedMain:false`.
The symptom **persists** — reproduced twice, fails safe (no main mutation, donor :7090 200 after,
main HEAD+tree byte-identical).

### Root cause, pinned (git-proven)
- `git log main..69cebc5 -- apps/seed/src/durableRecursion.ts` is **EMPTY** → Sam 3's R48 head
  did not modify the propose path. `durableRecursion.ts:210` STILL maps `saved.reason` →
  `workflow:store-conflict`.
- Per Sam 2's #87 handoff: `store.save(state,0)` returns `{ok:false, reason:'refused'}` because
  `this.validate(state)` rejects the door's **derived** workflow state on the live path — an
  **upstream conflation** (a validation-refusal reported as a store-conflict). `load()===null`
  makes a real OCC conflict impossible at this seam.
- So two things are still owed on #87: (a) Sam 3 — stop mapping `reason:'refused'` to
  `store-conflict` in `propose` (~2 lines); (b) Sam 2+Sam 3 — determine WHY the live-derived
  workflow state validates as refused (some field differs live vs in-suite council/receipt path).

**Honest status:** the store seam is now proven; the door→propose→create happy path over live HTTP
is still blocked; the safety envelope is fully intact.
