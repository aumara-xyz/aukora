# CURRENT ROUND — R60 (canonical in-tree control snapshot)

> **Purpose.** Pinned, network-isolated-readable mirror of the live coordinator state on
> [issue #20](https://github.com/aumara-xyz/aukora/issues/20). A seat with no GitHub access reads THIS
> file. The live issue always supersedes this mirror; the mirror is refreshed by Sam 1 at each round
> start and never edited by other lanes.
> Integrity: `docs/control/CURRENT_ROUND.sha256` carries the SHA-256 of every file in this directory
> and is restated in the issue #20 checkpoint comment that lands this snapshot.

- **Round:** R60 — HOSTILE-INPUT HARDENING + EMBEDDED-KIRA PREREQUISITES
- **Exact start base (public main):** `1e1bfcf437b7ee8ece1b4ecb66c859ee17377d2e`
- **Snapshot taken (UTC):** 2026-07-19T11:26:00Z
- **Directive source of truth:** <https://github.com/aumara-xyz/aukora/issues/20#issuecomment-5015355638> (R60 ROUND_DIRECTIVE, `aumara-xyz`)
- **R59 audit context:** [docs/control/CURRENT_AUDIT.md](./CURRENT_AUDIT.md) — sanitized R59 Avengers synthesis + auditor instructions
- **Prior-round R58 verdict:** [docs/control/R58_AUDIT_SYNTHESIS.md](./R58_AUDIT_SYNTHESIS.md)

Truth class of this mirror: **CAPTURE_CONSISTENT** — equality with the live issue was true at the snapshot instant above and is not claimed afterwards.

---

## ROUND_DIRECTIVE R60 (verbatim mirror)

# ROUND_DIRECTIVE R60 — HOSTILE-INPUT HARDENING + EMBEDDED-KIRA PREREQUISITES

**Canonical base:** `1e1bfcf437b7ee8ece1b4ecb66c859ee17377d2e`  
**Public main at directive time:** exact match  
**Round mode:** Sams 2–4 parallel → Sam 1 one convergence branch/PR → owner exact-head merge → Avengers.  
**Nebius:** HOLD / Cell 0A NOT_READY.  
**Fugu:** HOLD after provider HTTP 500 ×2; no output exists, no finding may be inferred, and **no retry is authorized in R60**.

## R59 Avengers synthesis — evidence weighting

### Reproduced exact-base findings accepted
- **H1 HIGH — evidence TOCTOU/accessor class:** seal, re-govern, and receipt pairing read live objects before/after canonical snapshotting; getter chameleons can reopen governed minting. `ACCEPTANCE_ELIGIBLE_SOURCES` is exported mutable.
- **M1 — erase record→root isolation absent:** registered root A can erase a record belonging to root B because durable records do not pin `ownerRootId`.
- **M2 — Cell 0A parser/egress gaps:** duplicate JSON keys pass; metadata/RFC1918/alternate-loopback/IP/IDN/port/host tricks pass substring checks.
- **M3 — cutover verifier thinner than contract prose:** kill-switch direction and transition/seam identity are not derived from typed contract data; checkpoint omits erase-root registry, erase attestations, writer epoch, and explicit no-resurrection continuity.
- **P1 — mind-door empty-token fail-open:** `AUKORA_DOOR_TOKEN=""` bypasses the R44 POST-token check. This is distinct from the R59 brain-door control-token repair, which held under attack.
- **P1 — no-overclaim synonyms:** “solved/cleared/won/completed N levels” variants bypass the ARC guard that catches “beaten N levels.”
- **Fu/council:** the donor-pinned 1/φ floor is real; `aukoraFuCouncil.ts:297 > 0.5` makes `mixed` unreachable for any ordinary multi-seat contradiction set. Council pluggability/advisory-only posture held.
- **Diligence residue:** package-row counts and round headers are stale; minor SPDX coverage drift.

### Standing truths preserved
- 1542 passing + 2 gated skips at R59 base; CI/public scan/provenance/continuity green.
- Embedded KIRA is **not implemented/live**; Convex is the one canonical durable-memory writer today.
- Cell 0A is disabled/NOT_READY; no provider or Nebius call is authorized.
- The frozen 191-row ledger remains untouched.
- `verifySwarmRunEnvelope` currently proves digest integrity, not governance authenticity; any API/consumer wording that implies authority is unsafe.

### Stale/contradicted seat notes
- Gemini executed R58 `c87880d`, not R59; useful only as a stale baseline.
- Auma explicitly audited a possibly-stale working tree. Its writer-lock/no-resurrection concerns are accepted as **prerequisites to test**, while its “Cell 0A absent” observation is stale.
- Manus’s “brain-door lacks token” statement is falsified by R59 exact-base source/tests; Fable’s separate **mind-door empty-token** finding is retained.
- Mistral did not receive the directive and therefore produced no R59 audit. R60 repairs this access path.

# LANE ASSIGNMENTS

All lanes perform the repository identity ritual, fetch origin, verify exact base `1e1bfcf4`, and state branch/worktree/status before writing. No lane edits another lane’s branch. No paid/provider/Nebius/Tinker call. No owner/private/AUMLOK key material. Donor repos remain read-only.

## Sam 1 — control/accessibility, claims gates, and ONE integration

Work in parallel with the other lanes:

1. **Early bus/accessibility snapshot (publish first):**
   - Update the canonical in-tree control mirror with this R60 directive and a sanitized R59 Avengers synthesis.
   - Add/refresh `docs/control/CURRENT_AUDIT.md` (or the existing canonical equivalent) plus digest sidecar so Mistral and non-issue seats can read the full audit prompt from public main.
   - The file must instruct git-capable auditors to fetch/detach at `origin/main`; non-git seats must label themselves POSSIBLY_STALE.
   - Open one tiny docs-only snapshot PR immediately. Post one owner marker; no totals regeneration if truly docs-only.

2. **No-overclaim hardening:** reproduce and block ARC “solved/cleared/won/completed N levels” variants without flagging ordinary prose. Plant positive and negative vectors.

3. **Diligence repair:** regenerate measured per-workspace rows from the same totals artifact or remove unverifiable duplicated breakdowns; refresh stale round headers. SPDX cleanup only where license truth is unambiguous.

4. **Integration law:** do **not** serialize lanes through individual rebases/full gates. Freeze each qualified lane head. Build one fresh `sam/r60-convergence` branch from then-current public main; merge lane heads preserving provenance; resolve only real conflicts.

5. After merging implementation heads, hand the convergence candidate to Sam 3 for one final Atlas capture commit. Fold that commit, regenerate totals once, run full clean-root Node 20/22 + public scan + provenance + continuity + no-overclaim once, and open **one final ready convergence PR**.

Only Sam 1 watches the queue. If a lane waits, it posts one HOLD and ends.

## Sam 2 — authority / evidence / doors

Deliver one frozen lane head with logical commits and adversarial tests:

1. **H1 snapshot-first evidence boundary**
   - Reproduce all live-accessor PoCs before repair.
   - Canonicalize/snapshot once at function entry; every gate, validation, digest, govern, and pairing decision reads that same inert snapshot.
   - Reject accessors/prototype tricks consistently with the existing `E_PROTO` law.
   - Freeze exported law tables; callers cannot mutate acceptance eligibility.
   - Ensure no alternate public minter or re-govern path remains.
   - Split integrity from governance truth in naming/contracts: a bare digest verifier must never be consumed as authority. Add a governed-decision verification boundary or fail-closed consumer guard; do not paper over this with prose only.
   - Plant the Kimi H1a–H1e and Fable hand-built-envelope vectors.

2. **M1 record→root binding**
   - Durable memory rows pin an immutable `ownerRootId`/record-root identity at ingest.
   - Forget requires attestation root == record root before signature/deletion.
   - Legacy/unbound rows fail closed or enter explicit quarantine; never guess ownership.
   - Multi-root, consent-scope, replay, rotation/revocation, wrong-root, malformed-row, and no-plaintext-deletion vectors.

3. **Mind-door empty-token**
   - Empty/whitespace/malformed provisioned tokens can never disable authentication.
   - Distinguish unprovisioned fail-closed from unauthorized; never echo token.
   - Plant env `""`, whitespace, stale boot, header precedence, and missing-token tests.

## Sam 3 — cutover law / no-resurrection / Fu semantics / final capture

1. **M3 typed cutover hardening**
   - Replace keyword/prose inference with typed, exact machine data for kill-switch direction, canonical seam identities, allowed transition graph, rollback edge, crash laws, and single-writer invariant.
   - Negation-smuggling and delete/add-transition tamper vectors must fail.
   - Extend the atomic checkpoint with: erase-root registry digest/version, erase-attestation/consumed-nonce state, writer epoch/fence, explicit no-resurrection/tombstone set, receipt-chain anchors, signed-head high-water, and record-ID derivation.
   - Name TrustedStateStore and every durable writer/receipt seam; no unnamed fourth store.
   - Make the **cross-process writer lock/atomic append prerequisite executable**: embedded cannot pass PARITY/CUTOVER readiness without it. This answers Auma’s documented current embedded-path race without pretending the store exists.
   - No SQLite/libSQL dependency yet; this remains an executable prerequisite contract.

2. **Fu semantic repair without breaking donor pins**
   - Do not edit donor-pinned `aukoraFuGlyph.ts`.
   - Preserve raw 1/φ floor as the tested glyph law, but derive an unpinned disagreement-above-floor measure for ranking/reason selection.
   - Repair the unreachable `>0.5` branch using floor-relative semantics; plant identical-consensus, real-divergence, mixed, zero-contradiction, and adversarial roster tests.
   - Preserve advisory-only/pluggable council; multiple LoRAs from one base count as one lineage unless explicitly proven otherwise.
   - Record a donor-first documentation proposal; donor remains read-only from this round.

3. **Final capture:** after Sam 1 publishes the convergence candidate, create one capture commit anchored to that candidate; frozen 191-row ledger byte-untouched; do not regenerate totals.

## Sam 4 — Cell 0A hardening / B2 mechanics

1. **Strict manifest parsing**
   - Reject duplicate JSON keys at any depth before `JSON.parse` semantics can hide them.
   - Missing/dangling `--manifest`, non-string host values, overlays, unknown fields, and schema drift fail non-zero.

2. **Real egress validation**
   - Parse/canonicalize scheme, hostname, IDNA/punycode, IP literals and ports.
   - Exact provider allowlist only; reject link-local/cloud metadata, loopback in every notation, RFC1918/private/reserved/unspecified IPv4/IPv6, homoglyphs, raw GitHub hosts, redirects to forbidden targets, and arbitrary ports.
   - No substring-based security decision.
   - Plant every Kimi bypass plus redirect/DNS-resolution contract tests using offline fakes only.

3. **Content/lifecycle evidence**
   - Secret-shaped key names and error paths cannot leak into console/artifacts.
   - Digest slots bind to declared artifact bytes/model/image identities, not arbitrary format-valid values.
   - TTL/remote-kill/teardown/residual proof become structured, falsifiable evidence; no live provider call.
   - Keep `enabled:false`, no arm mode, console cannot-arm, and REMOTE_ONLY→quarantine.

4. **B2 cleanup if bounded:** add a mechanical archetype-applicability predicate and sealed budget source; do not run or claim game results.

# INTEGRATION / EXIT LAW

- Sams 2–4 work in parallel from the canonical R60 base; Sam 1 works in parallel and integrates once.
- Lane branches/draft PRs may be pushed early for bus backup, but no lane asks for owner merges.
- One early control-snapshot owner merge is permitted for bus/accessibility. One final integration owner merge closes R60.
- No per-lane totals regeneration, repeated clean-clone jobs, or minute polling.
- Final required truth: no secrets/PII; no unsupported ARC/AGI/capability claims; no Nebius/Fugu/provider action; Convex canonical; embedded destination absent; Cell 0A disabled.
- If the round reaches 25 minutes without a public-main checkpoint, Sam 1 posts a concise status and opens a sanitized checkpoint rather than leaving work only on one machine.

## Fugu disposition

The validated packet produced **no referee output** because the provider returned HTTP 500 twice. Record transport failure only. Do not convert it into evidence, do not retry in R60, and do not block the reproduced HIGH/MED repairs on it.

**SAM LANES READY — R60 BASE `1e1bfcf437b7ee8ece1b4ecb66c859ee17377d2e` — READ THIS FULL DIRECTIVE, ACK YOUR LANE, START IN PARALLEL.**
