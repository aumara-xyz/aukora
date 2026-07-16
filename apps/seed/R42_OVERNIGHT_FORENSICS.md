# R42 — Overnight Forensic Issue Queue (FU / AUMLOK / AURA / RECURSION)

**Lane:** SAM 3 · `apps/seed/**`, `packages/council/**`, `packages/council-node/**`
**Base main:** `b17a3f87ed437ba0d225394ed8b93409626588f2` (merged Wave 2) · branch `sam/r42-overnight-forensics`
**Mode:** Ring 0 (AUMLOK, custody, verifier, signer, gate law, kill switch, scanners, supervisor) = AUDIT ONLY, no edits.
**Donor:** `aumara-xyz/aukora-symbiote` (local checkout `~/Documents/AUKORA`). Current SHAs cited at this base.
**Suites at base (env cleared of `AUKORA_*`, runs serialized):** seed **255/255**, council **61/61**, council-node **5/5**, kernel **19/19**, seed typecheck 0.

---

## 1 · Issue dispositions (donor ↔ current)

### #78 — Ring-based self-mod governance + central PolicyKernel (donor: OPEN)

**Donor ask:** classify code by effect class + ring; ONE PolicyDecision schema {effectClass, ring, allowed, requiredCapabilities, reasons, policyHash}; all apply paths consume the same decision; Ring 0/1 cannot pass the ordinary path.

**Current status: CORE LANDED for the one effect path; taxonomy PARTIAL.**
- The PolicyKernel exists: kernel `decide()` (`packages/kernel/src/reducer.ts`) — one decision shape with `ring`, canonical `policyHash` (computed at `reducer.ts:101` and carried in the decision at `reducer.ts:115`), stable codes, and a canonical receiptDraft. The ONE effectful path (candidate materialization) consumes it via `apps/seed/src/candidateReferenceMonitor.ts` (R39); no parallel or weaker authorization semantics exists.
- Ring 0's "almost never, out-of-band ceremony" is implemented HARDER than the sketch: the frozen `SELF_PROTECTING` list (`apps/seed/src/pathFence.ts:77`) is table-independent and refuses candidate materialization of the fence/gate/monitor/doors/kernel-authority/scanners/CI unconditionally — proven even against a stale/empty table (`test/r39.security.test.ts`).
- Ring 3/4 vs Ring 2 differentiated cost, and a full ring TABLE for the organism runtime, are **not built** (no ring-table artifact; `effectClass` is implicit in action/ring).
- **Disposition:** PARTIALLY LANDED (acceptance items 1, 2, 3 met for the effect path; `policyHash` present in every decision). **Parked:** an explicit ring-table artifact + effectClass taxonomy for non-effect surfaces. Acceptance: a `ring-table` module whose classification is consumed by `classifyPath` (display + review cost only — NEVER an authorization input beyond the existing fence).

### #92 — Scoped standing session grants for bounded low-risk auto-apply (donor: OPEN, "do not build until owner prioritizes")

**Current status: NOT BUILT — CORRECTLY.** The donor issue itself says land dark only when the owner prioritizes. Wave 2 restored the opposite (and prerequisite) posture: per-gesture approval (single-use challenge + nonce-bound hybrid signature + consume-once). What #92 will need is ALREADY structurally present:
- its "structural deny-list regardless of grant content" == the frozen `SELF_PROTECTING` fence (grant-independent by construction; a fenced path refuses even if a table says allowed — proven);
- its "session ends on any verification failure" == the door's zero-effect-before-authorization law (every refusal consumes nothing — `test/r41.ceremony.test.ts`);
- the "session refusals" ledger == `apps/seed/src/ideSession.ts` bounded `RefusalLogEntry` log (stable quotable reason classes).
- **Disposition:** MISSING BY DESIGN (owner-gated future brick). Parked acceptance: an `aumlok-session-grant-v1` artifact type verified by the SAME kernel `decide()` path (a grant containing any fenced path invalid in toto), never in-browser signed.

### #99 — Live-apply gate must self-protect state/brain, env/secrets, Ring-0 paths (donor: CLOSED, landed donor-side)

**Donor law:** pre-write deny (before signature/hash/replay) over gate machinery ∪ state/brain ∪ env/secrets ∪ ratified Ring-0; re-checked against the RESOLVED REAL PATH (symlink cannot route around name-strings).

**Current status: LARGELY SUPERSEDED + ONE REAL RESIDUAL.**
- Superseded: there is NO live-apply lane at all — the only effect is a disposable worktree on a `candidate/<id>` branch (`apps/seed/src/localCandidateStage.ts`), never the live tree; the live tree is verified unchanged post-materialization (HEAD/main/tree byte-identical, r36/r39 tests).
- Pre-write deny (lexical) exists: fence checked at draft (`ideEnvelope.ts`), re-checked at stage (`localCandidateStage.ts:116`), re-checked at the approve door; `.env*`/keys/credentials are SECRET (`pathFence.ts:46`), brain data is SACRED (`^apps/(brain|console)/`), and the whole authority surface is SELF_PROTECTING.
- **RESIDUAL (the #99/#75 realpath law is NOT yet applied at the candidate write):** `localCandidateStage.ts:174` `writeFileSync(target, …)` follows symlinks; a PRE-EXISTING in-repo symlink checked out into the fresh worktree at a fence-allowed path could route a candidate write to the symlink's target (including outside the worktree). The tree-isolation post-check would not catch the out-of-tree side effect. Compounding: `localCandidateStage.ts:176` uses `git add -A` in the worktree, where donor #4 explicitly requires "exact file list only, never `git add -A`".
- **Disposition:** SUPERSEDED (no live tree writes) with a PARKED P1 candidate-integrity fix — see §3. Not attempted tonight: the candidate stage is apply machinery on the frozen self-protecting list; the directive's preferred candidate is the Fu path, and one candidate is the budget.

### #4 — Per-proposal AUMLOK signed apply lane with rollback (donor: CLOSED)

**Current status: SUPERSEDED_WITH_COMPARATIVE_PROOF**, item by item: shared proposal hash ⇒ canonical intentId/draftHash golden vectors (r30); human authorizes exactly one proposal ⇒ payload-bound hybrid signature + single-use challenge (Wave 2); consume-once ledger ⇒ monitor `consumedIds` durable across restart (r41 test); replay refuses ⇒ proven; sacred/symlink/env refuse even with valid signature ⇒ fence classes proven (with the §3 symlink caveat AT WRITE TIME); distinct commit identity ⇒ `candidate@localhost`, `--no-gpg-sign`; rollback ⇒ STRONGER (nothing to revert — the live tree never changed; discard the branch/worktree). **Deviation from donor acceptance:** `git add -A` instead of exact file list (parked, §3).

### #35 — Chat conversation → governed proposal artifact (donor: CLOSED)

**Current status: PRESERVED/ADAPTED.** The mind door (`apps/seed/src/mindDoor.ts`, R38) is the bridge: `/api/propose` emits a PLAN only; the chat lane cannot execute/write/sign/apply (capability law refuses `sign/authorize/merge/deploy/bypassConsent` — `capabilities.ts`); the pipeline re-derives facts itself (rehearsal + `deriveDraftHash` recompute at stage — chat-supplied content is never trusted as file truth); owner signature stays terminal-owned (Wave 2 custody: existence-only, out-of-band). Fu context rides as advisory evidence bound by proposalHash (`door:fu-sidecar-mismatch` refuses a swap). Tests: `r38.mind-door.test.ts`, `r36.candidate-fu.test.ts`.

### #82 — Trusted test substrate for proposals touching test runners (donor: OPEN)

**Current status: STRUCTURALLY AVOIDED today; acceptance PARKED for the experiment loop.** The current pipeline NEVER executes candidate code: evidence comes from the CURRENT tree's in-process rehearsal (the trusted baseline runner, in a stronger form — candidate-produced evidence isn't merely distrusted, it doesn't exist), and the candidate stage only stages+commits. The donor's Ring-1 examples map to the SELF_PROTECTING list (scanners, CI workflows, provenance scripts all fenced). **Parked acceptance** (binds to WAVE 1's missing comparator): when a future wave runs suites FOR a candidate, the run MUST be produced by a pinned baseline runner from the current commit, with runner identity/hash in the evidence pack — never only by the modified candidate.

### Fu execution continuity

- Engine: donor `core/src/{aukoraFuCouncil,aukoraFuGlyph}` → `packages/council/src/*` MOVED_UNCHANGED (canonical seats, packet law, spend meter, phase-lock, neutral-replay drift).
- Seed integration: `fuStructuredAdapter.ts` calls the REAL `runAukoraFuCouncil` behind the injected-transport wall; verdict → advisory `env.review`; ceremony sidecar binds by proposalHash. Live transport: DI + Keychain/env (r37), owner-armed egress + spend (r39). Advisory always: `councilGrantsAuthority()` false, roster excludes external reviewers.
- **GAP (the critical one this wave):** the REAL captured model replies from the donor's live run (5 verbatim fixtures, `packages/council/test/fixtures/fusion-replies/`) are proven ONLY against the glyph PARSER (`aukoraFuGlyph.test.ts`). The full local execution path — `runAukoraFuCouncil` (two rounds, packet envelope, spend, synthesis, phase-lock) → seed `fuStructuredAdapter` → verdict/receipts — has only ever run on SYNTHETIC packets. Fu execution continuity with real model output is therefore asserted, not proven, end-to-end. **This is the bounded candidate (§2).**

### AURA display-only geometry

`apps/seed/src/geometry.ts` remains GEOMETRY_ONLY / display-only / `feedsApply:false`; the spatial adapter exposes snapshots + read-only stream; no geometry value appears in any authorization predicate (grep-verified: `deriveGeometry`/`AuraGeometry` referenced only by ceremony display, adapter, tests). The council's real shear/coherence field stays engine-side (perceive) and enters only advisory outcomes. Unchanged at this base; tests `ceremony.test.ts`, `r34.ide-adapter.test.ts`.

### Governed recursion

Gate law unchanged at this base: exact-shape → canonical intent → lineage/staleness/secret → advisory review → hybrid owner verify → sandbox-only apply → receipt-before-row; durable machine defers retryable stages, reconciles on the full (intent, nonce) pair. Suites re-run green here (255/255).

### Wave 2 AUMLOK ceremony (read-only comparison target)

`git diff f3d437c..b17a3f87 -- apps/seed/src/{approveDoor,approveGuard,approveChallenge,ownerCustody,bondCeremony,pathFence}.ts` = **empty**: the restored ceremony merged to main BYTE-IDENTICAL to the WAVE 2 head. All Ring-0 surfaces (gate, custody, verifier, monitor, fence, scanners) audited only tonight — zero edits.

---

## 2 · Bounded candidate (the one allowed): real-fixture Fu execution proof

**Question:** can the real local Fu execution path be restored/proven with a deterministic local fixture transport, advisory-only, no network/paid call/new dependency?
**Design:** a fixture transport (test-side, in `packages/council`) that serves the FIVE REAL captured replies — two compliant, one reordered-DIST, one empty, one prose-noncompliant — through the canonical packet envelope into `runAukoraFuCouncil`, then through seed's `verdictFromCouncilOutcome`. Proves: real replies parse (or fail-closed) through the FULL orchestrator; non-compliant replies become non-votes; quorum/synthesis/phase-lock and the seed verdict behave on real payloads; spend metering counts real calls. Advisory-only throughout; `grantsAuthority:false` asserted.
**Outcome:** recorded in §4 after the falsification cycles (≤3 × 45 min; kept or discarded honestly).

## 3 · Parked candidates (exact acceptance tests; NOT attempted tonight)

1. **P1 candidate-write integrity (donor #99/#75/#4):** in `localCandidateStage.materializeCandidate`, before each write: `lstat` the resolved target inside the worktree; REFUSE (`candidate:symlink-target` reason class) if any path component or the leaf is a symlink; replace `git add -A` with `git add -- <exact fence-checked file list>`. Acceptance: (a) a repo with a pre-existing in-repo symlink at a fence-allowed path refuses materialization pre-write, target file untouched, refusal receipted, no authority consumed; (b) a planted extra file in the worktree is NOT committed (exact-list add); (c) all existing r36/r39/r41 tests stay green. (Self-protecting apply machinery — needs a daytime round with the owner awake.)
2. **#78 ring-table artifact** (display/review-cost only; never an authorization input) — acceptance in §1/#78.
3. **#82 baseline-runner law** for the future experiment loop — acceptance in §1/#82.
4. **#92 session grants** — owner-gated; acceptance in §1/#92.

## 4 · Candidate outcome — **KEPT** (cycle 1 of 3; no further cycles needed)

Two test suites, ZERO src changes (the execution path existed; it was unproven on real payloads):
- `packages/council/test/aukoraFuCouncil.realfixtures.test.ts` (4 tests): the five verbatim captured replies through
  the FULL `runAukoraFuCouncil` via a deterministic fixture transport, on the donor live run's ACTUAL roster (passed
  through the public `seats` option). **RAW mode** pins the protocol evolution: the capture predates the packet
  envelope, so every raw reply fails CLOSED (`no-packet-block`) → insufficient-quorum — historical raw-format output
  can never be counted by the current orchestrator. **ENVELOPE mode** (real payloads in the current canonical framing,
  honest empty `CLAIMS:()`): the three genuinely compliant replies become REAL votes — DeepSeek's reordered-DIST
  reply now exercises the issue-#34 parser fix at ORCHESTRATOR level — while the really-empty and really-prose
  replies stay non-votes; the DEFAULT quorum (≥6+Fable) still refuses this historical 5-seat run; only an EXPLICIT
  3-votes/3-families rule (public `quorum` option) completes the pass, with the blocker-5 law voiding synthesis (no
  USED_CLAIMS in a real captured reply) → the advisory answer is a top-weighted REAL model hypothesis. Spend law:
  projection > 0, actual $0 (no billed tokens in fixtures).
- `apps/seed/test/r42.fu-realfixtures.test.ts` (2 tests): the same real payloads through the seed adapter
  (`runFuAdvisory` → `verdictFromCouncilOutcome` → receipts): default-quorum run projects to `advisory-hold` (real
  replies cannot launder a pass), receipts stay content-free (no problem text / no model text — asserted), digest
  present, `grantsAuthority:false` end to end.

**Fu execution continuity is now PROVEN, not asserted:** real captured model output flows through the full local
execution path (orchestrator + seed adapter) deterministically, offline, $0, advisory-only.

Suites after the candidate: seed **257/257** (+2), council **65/65** (+4), council-node 5/5, kernel 19/19, typecheck 0.

NEXT: post the R42 report to issue #22 (PR opened, all suites green).
