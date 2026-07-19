# CURRENT ROUND — R59 (canonical in-tree control snapshot)

> **Purpose.** Pinned, network-isolated-readable mirror of the live coordinator state on
> [issue #20](https://github.com/aumara-xyz/aukora/issues/20). A seat with no GitHub access reads THIS
> file (Auma's pinned-snapshot path). The live issue always supersedes this mirror; the mirror is
> refreshed by Sam 1 at each round start and never edited by other lanes.
> Integrity: `docs/control/CURRENT_ROUND.sha256` carries the SHA-256 of this file and the audit
> summary beside it, and is restated in the issue #20 checkpoint comment that lands this snapshot.

- **Round:** R59 — KIRAC HARDENING + NEBIUS CELL 0A PREP
- **Exact start base (public main):** `c87880da79934559faf36515e84ffdc9ddd70f16`
- **Snapshot taken (UTC):** 2026-07-19T06:55:00Z
- **Directive source of truth:** <https://github.com/aumara-xyz/aukora/issues/20#issuecomment-5014717259> (posted 2026-07-19T06:33:42Z by `aumara-xyz`)
- **R58 verdict context:** [docs/control/R58_AUDIT_SYNTHESIS.md](./R58_AUDIT_SYNTHESIS.md) (mirror of <https://github.com/aumara-xyz/aukora/issues/20#issuecomment-5014712885>)
- **Prior-round Kimi report:** <https://github.com/aumara-xyz/aukora/issues/20#issuecomment-5014683836>

---

## ROUND_DIRECTIVE R59 — KIRAC HARDENING + NEBIUS CELL 0A PREP (verbatim mirror)

**SAM LANES READY — BASE `c87880da79934559faf36515e84ffdc9ddd70f16`**

R58 is closed. Begin from this exact public-main SHA after the identity ritual. Re-read live main before every fold.

### Operating law

- **Fable seats only.** Do not switch to Opus or launch premium Codex subagents. If a task genuinely requires escalation, stop that brick and post `NEEDS_ESCALATION`; continue other bounded work.
- One writer per permanent lane. Preserve dirty work; do not reset another seat.
- No secrets, PII, credentials, owner keys, AUMLOK private bytes, or private memory in commits/logs/comments.
- No Nebius/Tinker/provider call during implementation. R59 prepares and proves the disposable cell; actual Cell 0A arming follows an exact-main owner/coordinator GO.
- Research/advisory output grants no authority. Convex remains the temporary live substrate; KIRA is the brain and destination. "Alien Core / AC" names this development wave; "KIRAC" is the nickname, not a second organism.
- Publish continuously: open bounded PRs, run all gates, and integrate each green qualified brick immediately—do not batch the round. If no code PR is merge-ready within 30 minutes, publish the sanitized control/snapshot brick first.
- Post exact heads and evidence to issue #20. Sam 1 never merges a moved or red head.

### Sam 1 — CONTROL / INTEGRATION / CI

1. **First public checkpoint:** mirror the current R59 directive and R58 synthesis into a canonical in-tree control snapshot readable by network-isolated seats (for example `docs/control/CURRENT_ROUND.md` plus a sanitized audit summary). Include exact base, timestamp, issue comment URL, and SHA-256 of the snapshot. This is Auma's pinned-snapshot path.
2. Repair the bare-"ARC" no-overclaim bypass and plant positive/negative tests, including "solved the ARC game."
3. Repair the gated-skip measurement regex so the published value equals the real test-level skip count; regenerate README/CLAIMS/generated totals from measurement only.
4. Qualify and integrate every lane PR as soon as exact-head CI, public scan, no-overclaim, and review gates are green. Byte-verify every squash on main. No batching.
5. Maintain the R59 integration ledger and post OWNER ACTION REQUIRED only when policy blocks an otherwise-qualified exact head.

### Sam 2 — BRAIN / AUTHORITY / DOORS

Work as small sequential security bricks; do not combine unrelated rewrites.

1. **Evidence sealing boundary:** reproduce Kimi's two M2 PoCs. Make a hand-built `accepted` body and a re-sealed outcome edit fail closed, or narrow the exported seal API so it cannot impersonate door promotion. Correct the falsified docstring and plant regression tests.
2. **Erase authority G1:** reproduce whether a caller-supplied ML-DSA key can authorize `forget`. If true, pin erase authority to a registered owner/capability root, preserve tombstones/nonces/no-resurrection, and prove forged/new-key, replay, wrong-record, and stale-head erasures fail before plaintext deletion.
3. **Brain-door authentication:** reproduce the reported unauthenticated surface. Add service-capability/token custody equivalent to the governed door pattern, with missing/forged/replayed token tests. Never expose a token value.
4. Keep every Convex row/adaptor non-authoritative; do not begin the database cutover here.

Priority: erase authority → evidence seal → brain-door. Publish and integrate each independently when green.

### Sam 3 — RECURSION / EFFECTS / ATLAS

1. Write and gate the **single-writer embedded-KIRA cutover contract** before any SQLite/libSQL dependency lands:
   - exactly one canonical durable memory writer at a time;
   - Convex→embedded transition uses shadow reads/parity, never dual writes;
   - carry `signedHeads` high-water, attestation nonces, tombstones/no-resurrection set, record-ID derivation, and receipt-chain anchors in one checkpoint;
   - preserve scan-before-chain and receipt-before-effect;
   - env kill switch, rollback boundary, idempotent replay, and crash/kill-9 canaries.
   This round is contract + dry-run verifier only—no live third store.
2. Reproduce Auma's shear-floor-at-creation claim against exact R59 base. If identical inputs incorrectly yield ~1/φ disagreement, fix the code or correct the contradictory documentation based on the law, with a planted equality case. If not reproducible, publish FALSIFIED evidence.
3. Strengthen branch-intake validation with evidence-required fields per classification without pretending an offline gate proves external truth. Correct the stale R53 trusted-state row only after exact-main verification.
4. Refresh Atlas at the final integration tip; preserve the frozen 191-row ledger and record all new R59 objects without invented dispositions.

### Sam 4 — SPATIAL / CONSOLE / DOCS / SHADOW CELL

1. Build the **Cell 0A deployable preflight packet**, default disabled:
   - exact public-main/code/harness/image/model digest slots with strict 64-hex validation where SHA-256 is claimed;
   - no public ingress, no GitHub egress, no Convex, Git credentials, private memory, owner root, or AUMLOK key in the workload;
   - one inert synthetic prompt + one refusal probe only;
   - hard TTL, remote kill, teardown, and zero-residual-resource proof;
   - content-free request/response hashes, provider/model metadata, latency/token/cost fields, and a `SwarmRunEvidenceV1` envelope that remains ungoverned/quarantined;
   - dry-run and planted failure tests. Do not make a provider call.
2. Add a canonical `NEBIUS_GO_NO_GO` artifact generated from executable evidence, separating Cell 0A connectivity readiness from Cell 0B organism readiness.
3. Repair B2 preregistration before any run: assign the 60–80% B2b dead zone, numeric B2d graceful/binary threshold, sample size/statistical rule, and "recited" detector. Caption the reused TU93/17-action schema values as hypothetical/unproven.
4. Publish a canonical `ALIEN_CORE.md` index: KIRA is Aukora's brain; Alien Core is the current architecture wave; KIRAC is shorthand. Link rather than duplicate the governed architecture and keep VERIFIED/RESEARCH/UNPROVEN boundaries explicit.
5. Ensure the public console cannot arm Cell 0A or expose secret values.

### Exit sequence

1. Integrate sanitized control snapshot first.
2. Integrate small repair PRs continuously as green.
3. Integrate Cell 0A preflight only after negative tests and all public gates.
4. Sam 1 posts final exact-main report and `SAM LANES HOLD — R59 AVENGERS + FUGU PREFLIGHT REQUIRED`.
5. Avengers audit exact main. Run exactly one bounded Fugu hostile pass over the sanitized public Cell 0A packet if the Fable seat has Fugu; advisory only, no authority/quorum. If invocation is impossible, report the concrete blocker—do not invent output.
6. Only after that verdict may the coordinator post a one-canary Nebius Cell 0A GO on issue #15.

**Target:** complete the repair/preflight integration within the next 3–4 hours. Target one disposable Nebius Cell 0A connectivity smoke by the morning of 2026-07-20 WITA, contingent on credentials/provisioning and an explicit hard cost/time cap. Cell 0A is not KIRA live, not an organism claim, and not a Convex cutover.

---

*End of verbatim mirror. Truth class of this file: CAPTURE_CONSISTENT — equality with the live issue was true at the snapshot instant above and is not claimed afterwards.*
