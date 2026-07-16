<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# R42 — Symbiote continuity witness (independent, read-only)

- **Witness base:** merged Wave-2 main `b17a3f87ed437ba0d225394ed8b93409626588f2` · donor `aukora-symbiote @ 41707f910d…` (untouched; `:7090` canonical)
- **Mode:** read-only code archaeology; separate worktree/branch; no runtime/UI change; no owner-private content copied — pointer/hash policy only. Machine rows: [`r42-witness-atlas.jsonl`](r42-witness-atlas.jsonl).
- **Independence:** this report's verification rows were re-run in this worktree, not inherited: provenance 46 VERBATIM + 45 EXCLUDED / 0 mismatches · spatial 27/27 · supervisor 16/16 · protected pins verified.

## Verdict vocabulary
`LANDED(sha)` · `PARTIAL(remaining)` · `ASPIRATION` · `PROTOTYPE_DISCARDED` · `PRIVATE_HOLD` · `MISSING`. No `EXCLUDED_BY_PETER` is inferred anywhere — only Peter can exclude a capability.

## Issue-family verdicts (donor claim ↔ donor code ↔ current main)

### #57 — hash-verified identity anchor boot (CLOSED upstream)
- **Donor: LANDED(`9028def`, loud-absence follow-up `1051007`).** Verified in code: `spatial/identityAnchor.ts` (pure load+verify; "absence of a marker must mean whole"; fails LOUD on mismatch), wired at `voiceLane.ts:424` (`resolveIdentityInjection`), anchor re-injected on the SYSTEM message every turn; test `core/tests/identityAnchor.test.ts` exists. Anchor content lives in the owner home (PII denylist honored — story out of tree). The issue's own claims check out against code.
- **Current main: PARTIAL(remaining: the injection mechanism itself).** `apps/brain` WAVE-2 `continuity/locations.ts` registers WHERE identity/anchors/journals live (safe pointer/hash policy — the right first half). The load+verify+inject mechanism and its fail-loud law have **no counterpart**; the mind door speaks with laws but no story, and — unlike the donor — no marker discipline exists yet to make an abridged boot detectable.

### #44 — owner-triggered `show:` framed file context (OPEN)
- **Donor: PARTIAL(remaining: the owner command itself).** The supporting plumbing exists — `authority/gate/governedToolBoundary.ts`, and the flight recorder's contract text says "(from #44 onward) every read-only tool call" is recorded — but `show:` appears nowhere in `chat-serve.ts`/`coreSession.ts`. The command surface, path-fence tests (traversal/symlink/home refusal) and framed injection are not in the door. Issue claims are ahead of the code: treat any "landed" reading as a **false-green**.
- **Current main: MISSING** (no owner file-context command; the transplant's typed-envelope attachments cover owner-pushed files only, which is the safe subset).

### #60 — conversation-lane flight recorder / durable threads (OPEN)
- **Donor: PARTIAL(remaining: durable server-side THREAD record + cross-file chain continuity).** LANDED in code: `core/src/flightRecorder.ts` + test — append-only per-day JSONL, **hash-chained** (`eventHash` over bytes + previous hash, `verifyFlightChain` localizes tampering), secret chokepoint on free text, "a flight line never grants a capability"; typed turn envelope landed server-side (`chat-serve.ts:339`, #53). NOT landed: the actual conversation THREADS still live in the browser (`chat.js` `saveHistory` → localStorage — "the durability of a browser tab", the issue's own complaint), and cross-file chain continuity is explicitly "a deliberate follow-up, not silently implied" (honest in-code disclosure — good).
- **Current main: MISSING (durable record).** The mind door keeps bounded IN-MEMORY receipts (`MAX_RECEIPTS = 512`, gone on restart); the transplanted chat keeps threads in localStorage. The supervisor's `receipts.jsonl` is append-only but lifecycle-scoped, not conversation-scoped, and is **not hash-chained** — nothing on main today gives conversations an integrity story. The donor's #60 verdict — "the most identity-dense artifacts … in the least governed medium" — currently applies to the new organism too.

### #62 — empty identity shelf (OPEN) — **the flagged false-green family**
- **Donor: PARTIAL(remaining: identity-corpus ingestion).** The diagnosed cause is FIXED in code: `kiraBrain.ts` `ingestSelfMap` now takes `maxTestFiles ?? 10` with an explanatory comment naming this exact issue, so tests can no longer flood the walk. But the identity corpus (`~/.aukora-symbiote/identity/*.md`) is OUTSIDE the repo root and there is still **no ingestion path for it**: the shelf can now fill with docs, and identity atoms remain **0 by construction**.
- **Current main: MISSING (identity ingestion), and the shelf is empty here too.** `apps/brain` ingests runtime records (rehearsal, offline-executor seeds, migration-bridge legacy rows) — no doc/identity corpus ingestion exists.
- **FALSE-GREEN (explicit, the directive's example):** Sam 2's WAVE-1 brain forensics honestly state the migration bridge "can carry their ROWS as legacy records … so no data is stranded." True — and **insufficient as an identity-continuity test**: the donor brain state this bridge would carry is 92% test files with **zero identity atoms** (#62's own audit: 76 atoms → tests 70, identity 0). A row-count or chain-verify equivalence check over a migration would read GREEN while faithfully preserving an EMPTY identity shelf. Any future migration acceptance must include a **shelf-composition assertion** (identity/doc atoms > 0, by scope tag), not only row counts and chain integrity.

### #93 — GHP canon into Kira as guarded status-bearing atoms (OPEN)
- **Donor: ASPIRATION (by explicit design).** "Do not build until owner explicitly prioritizes"; `identity/context/ghp/` does not exist (verified); the guarded-atom rule (`[GHP|status=<TAG>|…]` headers; "Context, not identity (anchor rule)"; ingestion signed/gated like a body change) is spec only.
- **Current main: ASPIRATION.** Nothing GHP-recall-shaped exists; the transplanted GHP organ is display-only. Correct state; no action until Peter prioritizes and hands over distilled canon.

### #61 — voice history: token-aware windowing (OPEN)
- **Donor: PARTIAL(remaining: true token budget + summarize-the-middle).** Landed beyond the issue's snapshot: `VOICE_MAX_HISTORY` is now **40** as a bounded ceiling (not the working window); `historyWindow.ts` does char-budget windowing with `elidedCount` and a **visible window marker** ("'' when nothing was elided — absence means whole, her invariant … which she is told to quote when asked" — the "tell her the policy" ask, landed). The anchor is untouchable via #57 (system-message re-injection, never evictable). Remaining vs the ask: the budget is chars not tokens, and the middle is **dropped-with-visible-marker, not summarized** — an explicit, recorded disagreement with the issue's summarization idea (arguably safer: no lossy paraphrase presented as memory; the disagreement stays explicit rather than resolved here).
- **Current main: MISSING.** The model-free mind door is stateless per turn; no history window exists to govern.

### #71/#26 — protected supervisor / doctor / receipt explorer (OPEN upstream)
- **Donor: ASPIRATION (#71's swap machinery — spec'd, never shipped; re-confirmed) + LANDED read-only doctor kit** (`scripts/doctor.ts` + pure `doctorChecks.ts`, `start-node.ts` phased launcher — port-open probes only, identity-blind).
- **Current main: LANDED-descendant (Wave 2, merged in `b17a3f8`) · PARTIAL(remaining: seed-side denied-path enforcement; full receipt explorer).** Independently re-verified in this worktree: supervisor 16/16 tests, protected pins verified. The #71 acceptance item "proposal touching supervisor path rejected at proposal validation" is still a **cross-lane handoff** (documented in `apps/supervisor/PROTECTED.md` §3), and #26's receipt explorer exists only as the gateway's last-100 read surface — an honest subset, not the indexer/explorer.

### Selected Spatial closure + exact-donor parity obligations
- **Independently re-verified this worktree:** provenance **46 VERBATIM byte-identical + 45 EXCLUDED dispositions, 0 mismatches** against the donor checkout; spatial suite **27/27** (closure exactness: tree == manifest; zero dangling references; donor doors dialable nowhere; same-origin token law). The WAVE-1 parity-test obligations (engine surfaces ×11, organ mounts, thirds/corners, chat controls, duplex frames, truth labels) remain **DEFINED-not-built** — unchanged, correctly labelled, no false-green found in the parity claims themselves.

## False-green register (all found tonight)
1. **#62 row-count migration equivalence** (above) — GREEN chain/row checks would preserve an empty identity shelf. Needs a shelf-composition assertion. *(The directive's named example — confirmed real.)*
2. **#44 "recorded from #44 onward" wording** in `flightRecorder.ts`'s header implies the `show:` capability exists; the command is absent from the door. The recorder is ready; the capability is not. Reading #44 as landed from that comment would be false-green.
3. **Donor doctor probes are identity-blind** (port-open = healthy): a port squatter reads GREEN to `start-node.ts`/`doctor.ts`. The Wave-2 supervisor's identity-marker probes fix this on main; flagged so nobody ports the donor probe style back.
4. **Supervisor receipts are not hash-chained** (main): append-only JSONL without the donor flight recorder's chained `eventHash`. Not claimed as chained anywhere (so not yet a false-green), but any future "as auditable as the write layer" claim citing them would be one. Chain them or say plainly they are unchained.

## NEXT
`NEXT: donor issue sweep continuation — #54/#55 capability-mode family + #38 attachment frame (the remaining door-correspondence bricks), then a shelf-composition test spec for the #62 migration acceptance.`
