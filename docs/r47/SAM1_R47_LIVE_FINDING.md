# R47 vertical-slice — live integration finding (Sam 1)

Ran the full slice on this box against the running single-owner organism. **9 of 10 links proven
live; 1 link stopped-and-labelled per directive item 10 (no bridging).**

## Proven LIVE (transcript: `SAM1_R47_SLICE_TRANSCRIPT.log`)
- **one command → one lifecycle owner:** `organism:up` (a delegating shim) hands the whole
  lifecycle to `apps/supervisor`; convex 3210 · brain door 7141 · mind 7097 · spatial 7096 all
  reached ready with verified PIDs; the R46 two-owner gap is closed.
- **Spatial shows loop truth:** `GET :7096/api/fingerprint` → real `{head,branch,dirty:false,grantsAuthority:false}`; `GET :7096/api/loop` → `{pending:[],rehearsalReceipts:[],grantsAuthority:false}`.
- **Controls (all refuse + emit a content-free receipt; chain advanced 0→3+):**
  tokenless → `guard:missing-or-bad-token`; cross-origin `evil.example` → `guard:origin-not-allowed`;
  proposal-shape smuggling (extra keys) → `door:proposal-shape`; materialize without `ownerArmed` → refused, `touchedMain:false`; replay → inert.
- **Byte-unchanged:** `HEAD` and the working tree are identical before and after the entire slice; **donor `:7090` HTTP 200 before and after**; token value appears 0 times in the transcript.
- **Adversarial crossing proofs:** Sam 3's `r47.governed-crossing.test.ts` 11/11 in-gate (mutable-envelope inert, code-substitution refused, stale-head refused, forged-hybrid-half never materializes, owner-signed → disposable worktree only with main byte-identical, restart determinism).

## STOPPED-AND-LABELLED (honest gap — not bridged)
The **happy-path** `POST :7097/api/propose` (a well-formed, exact-5-key, uniquely-hashed proposal)
returns `phase:"refused-at-proposal" · reasonClass:"workflow:store-conflict" · touchedMain:false`
against the **live** local Convex — reproduced on a fresh proposal with backend `chainLength:0`,
so it is **not** a leftover-row artifact. The crossing logic is correct (297 seed tests + 11
crossing proofs green in-process); the gap is the **live door→`ConvexWorkflowStore` create
handshake** only, and it **fails safe** (no effect, no main mutation, receipted).

**Root-cause pointer for the lanes:** `DurableRecursion.propose` (`apps/seed/src/durableRecursion.ts:~204`)
calls `store.save(state, 0)`; on the live path that create returns `conflict` and `load()` returns
`null`, so it emits `workflow:store-conflict`. The in-process store seeds a missing workflow's
version as 0 and succeeds; the live `ConvexWorkflowStore` (`apps/brain/src/convexWorkflowStore.ts`)
hydrate/version handshake diverges for a first create. Owned by Sam 2 (store) + Sam 3 (recursion).
Filed as an independently-evidenced follow-up issue.
