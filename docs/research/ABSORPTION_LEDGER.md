<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# Absorption ledger — external research intake (Sam 4 · R55.3, truth/provenance)

**Base audited:** PR #162 candidate `397ddf5dfa8bfdf3d508571e32121e0d91272bca` over public `main@1394321fffd5de6296d44423d097e4e6199ab62b`.
**Status:** RESEARCH / TRUTH-ONLY. Nothing here absorbs code, changes canonical law, or grants authority.
Companion to issue [#159](https://github.com/aumara-xyz/aukora/issues/159) (research map) and [#158](https://github.com/aumara-xyz/aukora/issues/158) (security falsification).

## 1 · Manus `all_audit_findings.json` (53) + Kimi 61-item tracking report — availability

I qualify only what is present in the committed public tree and the linked issues. **Neither raw artifact is
available here** — it is not in the audited repository tree and not in the #158/#159/#20/#23 comments. No untrusted
external bundle was imported to obtain it.

- **Manus `all_audit_findings.json` (53 entries):** **UNPROVEN as a set** — the raw entries are unavailable, so a
  per-entry VERIFIED/FALSIFIED/DUPLICATE against exact files/lines cannot be produced honestly. Absence is stated,
  not inferred. To qualify these exactly, attach the raw JSON to #159.
- **Kimi 61-item tracking report:** **UNPROVEN as a set** for the same reason. The accessible Kimi research map on
  #159 (14 gap categories + an 89-source ledger) is qualified in §3 below as the deduplicated proposal.

The one Manus/audit claim that **is** stated in accessible form — #158 Finding C — is qualified against exact code
in §2. This is the honest substitute for per-entry Manus qualification until the raw file is provided.

## 2 · Public-truth-label audit of #158 (Sam 4 lane: truth labels only)

| # | audit claim (as reported) | verdict | exact evidence |
| --- | --- | --- | --- |
| **C** | "`ownerArmed` alone supplies human clearance." | **FALSIFIED** | The active primary door requires a valid hybrid `candidateAuth` signed over the head-bound `AUKORA-CANDIDATE-PAYLOAD/2`: `apps/seed/src/localCeremonyRunner.ts:193` sets `authBindsHead: true`, threading `expectedHeadBefore` (`:192`) into `localCandidateStage`'s `decide()`; a missing/forged/wrong-head/stale/replayed auth refuses before effect (R54 v6.1, merged PR #154). `ownerArmed` gates arming; it does not by itself authorize a candidate. |
| **A** | unauthenticated local Convex ingest persists a forged memory | **truth-label = REPORTED / NOT-YET-REPRODUCED** (correct as stated on #158) | reproduction is Sam 2's lane; I only confirm the issue labels it REPORTED, not proven |
| **B** | gateway state file can redirect the loopback proxy | **truth-label = REPORTED / NOT-YET-REPRODUCED** (correct) | reproduction is Sam 3's lane |

The #158 header label — "REPORTED, NOT YET REPRODUCED IN CANONICAL EVIDENCE" — is accurate and should stay until
Sam 2/Sam 3 land reproductions. Finding C should be flipped to **FALSIFIED** with the citation above.

## 3 · Deduplicated public roadmap / contributor-door proposal (one, not twelve)

Derived from the accessible #159 research map — deduplicated to distinct qualification tracks, each with an owner and
a gate. **This is a proposal; opening these as issues is deferred to owner sign-off. No source is adopted here.**

| # | track | canonical relation | owner | disposition | gate before any adoption |
| --- | --- | --- | --- | --- | --- |
| 1 | Candidate-stage containment (gVisor/WASM default-deny "Shadow Cell 0") | new sandbox seam around the candidate worktree | Sam 3 | CLEAN_ROOM_PATTERN | planted-canary escape + teardown proof; no product names as evidence |
| 2 | Adversarial public benchmarks (AgentDojo attack-success/utility) | conformance vectors only | Sam 4 | CONFORMANCE_VECTOR_ONLY | dated, scoped, linked measurement; no absolute claims |
| 3 | Externally-witnessed receipt heads (Sigsum/OpenTimestamps pattern) | receipts stay content-free; authority stays out | Sam 2 | CLEAN_ROOM_PATTERN | witness is post-hoc evidence, never authority |
| 4 | Supply-chain provenance (in-toto/SLSA/Syft/Grype, model-digest) | parked model manifests | Sam 1 | DEPENDENCY_WITH_LICENSE | SPDX + license-file hash per dep |
| 5 | Taint/injection tracking (CaMeL-inspired, clean-room) | data provenance at the effect boundary | Sam 3 | CLEAN_ROOM_PATTERN | LlamaFirewall weights are a separate model license — pattern only |
| 6 | Detection fixtures for `@aukora/immune` (YARA/Sigma/garak *concepts*) | advisory metaphor substrate | Sam 2 | CONFORMANCE_VECTOR_ONLY | explicit metaphor labels; zero actuator authority |
| 7 | Bi-temporal KIRA projection experiment | rebuildable projection only | Sam 2 | CLEAN_ROOM_PATTERN | never weakens canonical envelopes/consent/tombstones/receipt chains |
| 8 | Council evidence + strict-vs-soft glyph ablation | no imported duplicate council | Sam 2 | CLEAN_ROOM_PATTERN | soft parse yields a *separately typed* advisory/quarantine artifact only; never qualifies authority |
| 9 | Official Convex Workflow component as an evaluated adapter | Convex reacts/persists, never authorizes | Sam 2 | LEGAL_REVIEW | Convex backend is FSL at the researched pin — adapter-eval under actual terms |
| 10 | Public-tree secret hardening (TruffleHog/Gitleaks/detect-secrets) | CI hygiene | Sam 1 | CLEAN_ROOM_PATTERN | engine/rule licenses reviewed separately |

**STAY CUSTOM (do not absorb):** AUMLOK + its consume-once journal; the six-gate core; content-addressed KIRA with
consent + tombstones; the anatomy / continuity / provenance / no-overclaim gates.

## 4 · Commercial-license & inbound-grant boundary (preserved)

- **DCO ≠ relicensing.** A Developer Certificate of Origin sign-off certifies provenance of a contribution under the
  project's existing license; it does **not** grant the project rights to relicense, nor clear third-party patents.
- **Outside source PRs stay blocked** until a counsel-reviewed CLA (or equivalent inbound grant) exists. What is open
  *now*: issues, reproductions, security reports, design work, and appropriately scoped contributor tasks.
- **License minefield (research flags, not clearance):** FSL (Convex backend), SSPL (Inngest), ELv2 (later Asqav),
  BUSL / noncommercial / unlicensed (e.g. researched `llm-council`, StruQ/SecAlign cite-only) → `CITE_ONLY`,
  `LEGAL_REVIEW`, or `REJECT`. Apache-2.0's patent grant is bounded by its terms; MIT/BSD commonly lack an express
  patent grant. A third-party patent-application flag in the sealed-governance / chained-receipts area is recorded
  on the research ledger [#159](https://github.com/aumara-xyz/aukora/issues/159) for **legal review** — it is a
  counsel-review item, **not** an infringement conclusion here, and no derived wire format is frozen on it.

## 5 · Post-R55 candidate confirmations (directive item 4)

| item | state on `397ddf5d` | action |
| --- | --- | --- |
| Spatial settings key guidance | **FIXED** — `settings.js:70` states the key is machine-local via the local door; no `core/.env` (R55) | none |
| `.gitignore` `.env` | **GAP** — `.env` is not ignored; a user-created `.env` could be committed | route **Sam 1** (root/CI): add `.env`/`*.env` to `.gitignore` |
| stale CLAIMS counts | **STALE** — `CLAIMS.md` totals **900 passing** and its breakdown omits `@aukora/immune` (and council/kernel-node) suites; the integration control reports ~1,226 | route **Sam 1**: refresh the CLAIMS total + add the immune row after R55.x merges |
| roadmap #152 / Atlas #153 visibility | both **UNLABELED**; the repo has **no** `research-only` / `roadmap` / `security` labels (only default GitHub labels) | route **Sam 1**: add `research-only`+`roadmap` labels and apply to #152/#153/#158/#159 |
| issue templates / contributor door | **no `.github/ISSUE_TEMPLATE/`** — no bug/security/contributor templates | proposal (deferred): add templates + a `CONTRIBUTING` note carrying the §4 CLA boundary |
| no-overclaim fence | **GREEN** — 165 tracked docs, 0 violations (this ledger included) | none |

## Fences
Truth/issues/docs only. No code absorbed, no canonical law changed, no SQLite/Convex architecture pivot, no
provider call, no untrusted bundle imported, no speculative issue flood. Every roadmap track above remains gated by
the #159 admission law: exact pin, license-file hash, clean-room/adopt/reject disposition, differential proof,
secret/PII scan, provenance update, and a counsel-reviewed inbound grant before any external code enters canonical.
