<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# R44 — memory/Convex threat matrix (compact) + lifecycle boundary fixes

Ordinary defensive engineering over the existing rails — no new framework, no new architecture, no new
dependency. Coverage was INVENTORIED first; negative tests were added only for the three genuinely uncovered
rows, and one of them found (and fixed) a real defect. Synthetic fixtures only; no identity/anchor content.

## Threat matrix

| # | Threat | Rail (existing law) | Test evidence | Verdict |
| --- | --- | --- | --- | --- |
| 1 | Memory poisoning / malicious-but-clean evidence | secret gate refuses secrets; validation refuses authority-SHAPED records; everything else ingests as ADVISORY content — commitment `advisoryOnly:true, grantsAuthority:false`; containment predicates constant-false | existing: `reactiveStore` + `convexMemory` refusals · **new:** `r44.memorySafety` GAP A (scan-clean poison stays advisory; recall hit has no authority channel; predicates immune to content/confidence) | **COVERED** (poison is contained, never promoted) |
| 2 | Default `recall` vs opt-in `recallScoped` separation | contract split (Wave 3): default hit = frozen five keys, scope only on the opt-in path | `scopeRecall.test.ts` serialization-shape regressions (frozen JSON bytes; additive last key; selectors ignored on default) | **COVERED** |
| 3 | Content-free forgetting + no resurrection | forget removes plaintext + read-time forgotten mark + content-free tombstone; **R44 fix:** ingest now REFUSES a governedly forgotten recordId on BOTH rails | existing: forget/erase suites (store, convex, Wave-2 closure) · **new:** GAP B — the negative test FOUND that re-ingest of erased content physically retained plaintext again (invisible to recall but present); both rails now refuse (`no resurrection`) with plaintext-absence asserted | **DEFECT FOUND + FIXED** |
| 4 | Stale/corrupt Convex projections granting authority | every row/projection `grantsAuthority:false`; corrupt chain ⇒ fail-closed refusals; authority lives in kernel/AUMLOK outside Convex | `brainRoles`, `convexMemory` corrupt-store refusals, R42 atlas Appendix B audit | **COVERED** |
| 5 | Crash window between receipt and row/effect | receipt-before-row (same-txn); two-txn rehearsal effects reconcile exactly-once across restart | Wave-2 `wave2Continuity` crash reconciliation | **COVERED** |
| 6 | Plaintext/content enumeration at the loopback door | door is loopback-only + origin-closed (no CORS ever); 13/14 endpoints content-free; `/memory/recall` is the one content surface and supports empty-term enumeration BY DESIGN (advisory fuzzy recall) | `localDoor` origin-closed assertions; R42 atlas Appendix E | **ACCEPTED RESIDUAL** — safe only under the loopback/origin-closed/single-owner perimeter; the donor keyed-point-read + owner-PoP narrowing stays PARKED_PENDING_OWNER |
| 7 | Derived indexes/projections treated as canon | `brainSnapshot` is derived; heartbeat recomputes from the chain (the chain is the only canon) | **new:** GAP C — corrupt the snapshot row directly ⇒ heartbeat recompute REBUILDS it to chain truth; `verify` never wavers | **COVERED** (rebuildable, non-canonical — now proven, not just designed) |
| 8 | Local Convex exercising authority | Convex persists/reacts only; ingest secret gate is store hygiene; forget requires owner authority (Ed25519 verify / ML-DSA attestation) supplied from OUTSIDE | `brainRoles`, forget/attestation suites, atlas Appendices B/F/G | **COVERED** |

**Coverage before → after:** 6 of 8 rows covered + 1 accepted residual + 3 sub-gaps untested → all 8 rows
covered-or-accepted; 3 new negative tests; **1 real defect eliminated** (resurrection side door around
content-free forgetting, both rails).

## Lifecycle boundary fixes (the two live-path gaps)

### 1. Mind-door per-boot POST token — one lifecycle owner (supervisor)
Before: the seed runner minted its own token and PRINTED it; the supervisor spawns children with
`stdio:'ignore'`, so a SUPERVISED mind door printed its token into the void — unreachable by POST.
Now (`scripts/doorCustody.mjs`, consumed by `organism-ctl.mjs`): the SUPERVISOR mints the per-boot token and
preserves it in exactly two places — the child's env (`AUKORA_DOOR_TOKEN`) and ONE `0600` file under the
gitignored `apps/brain/.local/organism/` (never committed, never printed/logged — `status` shows presence only,
never the value — never served: the brain door has no filesystem access at all). `down` deletes it (per-boot).
**Open handoff → Sam 3 (apps/seed):** the runner must honor the env var —
`postToken: process.env.AUKORA_DOOR_TOKEN` inside `new MindDoor({...})` in `scripts/mind-door-7097.ts`
(print the token only when NOT injected). The failing acceptance test `mindTokenHandoff.test.ts` is committed
as `it.fails` and flips the moment the line lands.

### 2. `compose:live` supervisor awareness — no collision, no bypass
Before: `compose:live` bound the canonical brain-door port unconditionally — a raw `EADDRINUSE` collision when
the supervisor held the door (or a silent bypass if it had picked another port).
Now: the SAME custody module answers `supervisorHoldsDoor` (lockfile names this checkout + recorded door pid
alive) and `assertComposeMayBindDoor` REFUSES loudly, naming the one owner and the two legitimate paths
(consume the held door, or `organism:down` first). Stale/foreign records fail open to a normal bind — a dead
pid or another checkout's lock never blocks this checkout's compose.

## Residual (honest)
- Door recall enumeration (row 6) — accepted under the loopback perimeter; narrowing is owner-gated.
- The mind-door token handoff is OPEN until Sam 3 lands the 1-liner (acceptance test armed as `it.fails`).
- `assertComposeMayBindDoor` runs inside the AUKORA_LIVE_COMPOSE-gated test — a hand-rolled script that calls
  `startLocalDoor` directly would bypass it; the supervisor's port-ownership refusal remains the backstop.
