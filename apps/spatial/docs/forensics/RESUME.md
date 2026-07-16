<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# R42 continuity witness — RESUME

**State at loop end (2026-07-16, loop 14:32:50Z → wrapped before the 20:33Z hard stop; queue completed, not aborted).**
Witness base `b17a3f8` · donor `41707f9` · branch `sam/r42-continuity-witness` · PR #63 (draft, docs only).

## Completed queue (5 checkpoints)
| ckpt | family | issues | outcome |
| --- | --- | --- | --- |
| 1 | identity/continuity core | #57 · #44 · #60 · #62 · #93 · #61 · #71/#26 · closure/parity | verdicts + false-greens 1–4; independent re-verification (provenance 46+45/0, spatial 27/27, supervisor 16/16, pins ✓) |
| 2 | capability-mode + attachments | #54 · #55 · #38 (+ #62 SPEC) | donor LANDED(c88767b) ×2; false-greens 5 (main lockdown memory-only) + 6 (attachment dead letter); `SPEC_SHELF_COMPOSITION_ACCEPTANCE.md` |
| 3 | custody + truth labels | #241 · #243 · #280 · #344 | main LANDED-descendant on custody; #344 pin-before-execute gap on BOTH sides |
| 4 | receipts/disposition | #244 · #265 · #274 | memory write-back gap both sides; #265 issue-lag (reverse false-green, register 7); #274 main LANDED-by-design |
| 5 | staged-unlock/ACCL | #35 · #70 · #69 · #345 | #70 PROTOTYPE_DISCARDED (superseded by the in-shell gate); #69 iteration loop missing BOTH sides; #345 second issue-lag |

**Artifacts:** [`R42_CONTINUITY_WITNESS.md`](R42_CONTINUITY_WITNESS.md) (report, 7-entry false-green register) · [`r42-witness-atlas.jsonl`](r42-witness-atlas.jsonl) (23 machine rows, schema `aukora-r42-witness-atlas-v1`) · [`SPEC_SHELF_COMPOSITION_ACCEPTANCE.md`](SPEC_SHELF_COMPOSITION_ACCEPTANCE.md) (spec only).

## Remaining families for a future witness (pre-ordered)
1. **#105b/#177 in-shell approval-gate lineage** — the route that superseded #70; verify the click→phrase→sign ceremony's code/tests and its transplant state on main (the :7094/:7095 doors' own history).
2. **#340 whole-bundle classifier + #242 onboarding cleanup** — the custody classification family feeding #345; verify `complete/complete-legacy/partial` transitions against ceremony tests.
3. **#361 PQC hybrid migration cross-check** — kernel-side ML-DSA-65 landed per the aukora repo (#361 lane); witness the donor↔main claim symmetry the same way #71 was witnessed.
4. **Staged-unlock stage-0.1 verbatim source** — #60 records that the owner should paste the door's original stage-0.1 paragraph "so the source is her verbatim words, not a relay of a relay"; still un-pasted upstream (PRIVATE_HOLD until Peter acts). A witness can only flag it — never reconstruct it.
5. **Voice/endpoint truth family continuation** — #206 (friend-node default endpoint), #315 (Kira benchmarks page rename), #280 repair-path follow-through.
6. **Open-source readiness lineage** — #370/#319 against the aukora repo's EAGLE EYE lane claims.

## Standing witness rules (carry forward)
Verdicts from code+tests+receipts — issues are claims (they both over-claim (#44) and under-claim (#265/#345)). No `EXCLUDED_BY_PETER` inference. Pointer/hash policy for anything owner-private. Row counts are never continuity (shelf composition is).
