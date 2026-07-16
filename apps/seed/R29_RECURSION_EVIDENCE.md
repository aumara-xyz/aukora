<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (c) 2026 Aukora -->

# R29 — Governed recursion + hybrid AUMLOK gate (evidence)

Lane: SAM 3 · governed inward-out recursion. Scope fence: `apps/seed/**` + narrowly-scoped tests only.
Base commit: `f71e562e145227cba20d27c5abf8c60f282072ea` (= `origin/codex/brain-seed-r27`). Draft PR → `codex/brain-seed-r27` (NOT main).

No cloud, no paid call, no network, no live-repo mutation, no self-sign, no self-merge, no force-push.

## Pipeline (each stage fail-closed; every terminal outcome receipted)

```
propose
  → validate EXACT shape        (snapshot-first; rejects unknown/symbol/non-enumerable/getter/proxy smuggling)
  → derive canonical intent id  (64-hex, kernel canonical hash; target + supersedes only)
  → bind supersedes lineage     (reachable ancestor + bounded depth)
  → secret / staleness / authority-shape checks
  → Fu advisory review          (advisoryOnly:true, grantsAuthority:false; REQUIRED council evidence; authorizes nothing)
  → AUMLOK owner verification    (REAL hybrid Ed25519 + ML-DSA-65 via kernel verifyAumlokPromotionV2; bound to THIS intent+draft)
  → sandbox-only application     (isolated in-memory Map; never a live repo, never fs)
  → receipt                      (receipt-chained memory; accept OR refuse)
```

Hard stops enforced up front: **max attempts** (64), **wall-time** deadline, **patch bytes** (65536), **lineage depth** (16).

## Requirement → where it is satisfied

1. Ed25519-only fixture REPLACED by canonical hybrid AUMLOK verify — `src/aumlokGate.ts` calls
   `verifyAumlokPromotionV2` (`@aukora/kernel/authority`); Ed25519-only `src/ownerGate.ts` deleted.
2. Fixture is a REAL hybrid (no downgrade) — `@noble/post-quantum` 0.6.1 present ⇒ `hybrid_verification_real: true`.
   There is no Ed25519-only acceptance path; a downgraded shape simply fails closed.
3. / 4. Council stays `advisoryOnly:true` / `grantsAuthority:false` (`src/mockCouncil.ts`) and is a SEPARATE gate;
   a favorable verdict never substitutes for the owner (owner gate is checked independently, after the council).
5. No runtime self-sign — signing lives ONLY in `src/ownerFixture.ts` (out-of-band owner). The runtime import graph
   (`recursion.ts`, `aumlokGate.ts`, `proposal.ts`, `ledger.ts`, `mockCouncil.ts`) contains no `.sign(` and never
   imports the fixture (asserted structurally in `test/containment.test.ts`).
6. No live-repo/production mutation — runtime imports no fs/network/subprocess (asserted from source); the accepted
   apply leaves the real on-disk target unchanged (asserted).
7. Application is an isolated in-memory Map + receipt.
8. Canonical 64-hex intent ids preserved; supersedes chain composes (`test/recursion.positive.test.ts`).
9. Exact-key validation rejects unknown / symbol / non-enumerable / getter, and NEUTRALISES read-varying proxies via
   a single-read snapshot (`src/proposal.ts`, `test/proposal.test.ts`).
10. Replays, stale/forged signatures, target/content mismatch, secret-shaped patches, invalid lineage, and missing
    council evidence ALL fail closed (`test/recursion.negative.test.ts`).
11. Hard stops (attempts / wall-time / patch bytes / lineage depth) enforced and tested.

## Negative-test matrix (all fail closed)

| hostile input | stage |
| --- | --- |
| advisory-pass, no owner signature | `refused-owner-gate` |
| valid owner signature, no council evidence | `refused-council-evidence` |
| forged Ed25519 signature | `refused-owner-gate` |
| forged ML-DSA-65 signature | `refused-owner-gate` |
| stale (expired) authorization | `refused-owner-gate` (expired) |
| untrusted signer (wrong owner root) | `refused-owner-gate` (rootId) |
| malformed authorization (throwing accessor) | `refused-owner-gate` (never throws) |
| target mismatch | `refused-owner-gate` (proposalHash) |
| content mismatch (same intent) | `refused-owner-gate` (draftHash) |
| replayed nonce | `refused-replay` |
| secret-shaped patch | `refused-secret` (secret never enters the receipt) |
| authority-shaped patch | `refused-authority-shaped` |
| ungrounded target | `refused-ungrounded` |
| stale proposal | `refused-stale` |
| unknown lineage ancestor | `refused-lineage` |
| over-deep lineage | `refused-lineage` |
| smuggling shape (getter) | `refused-shape` |
| max attempts exceeded | `hard-stop-max-attempts` |
| past wall-time deadline | `hard-stop-wall-time` |
| oversized patch | `hard-stop-patch-bytes` |

## Verification

- `apps/seed` typecheck: PASS (`tsc -p apps/seed/tsconfig.json`, exit 0).
- `apps/seed` tests: **165 passed / 13 files** (`npm test --workspace @aukora/seed`).
- Repo `npm run test:all` (CI equivalent): PASS on this branch (incl. `test:kernel` — portable boundary, compatibility, SBOM, runtimes, package all green; 19 kernel tests).
- Secret self-scan of `apps/seed/src/*.ts` with `@aukora/evidence` `scanForSecrets`: 0 findings.
  (Test files carry deliberate, well-known example vectors — e.g. `AKIAIOSFODNN7EXAMPLE` — as fixtures only.)

## R30 — AURA portable trace law + adversarial controls

Ported the donor AURA trace law (from `core/src/boundaryTraceTelemetry.ts` + `core/src/forbiddenContent.ts`,
aukora-symbiote) into this lane, and hardened the failure asymmetry between receipt and effect.

- **`apps/seed/src/forbiddenContent.ts`** — the recursive AURA fence (ported verbatim pattern block): exact
  `FORBIDDEN_FIELDS`, normalized forbidden-key regex, forbidden secret/production VALUE regex, false-authority
  CONTENT regex, overclaim/mythology regexes; `scanForbiddenKeys/Values/Claims/AuthorityClaims` recurse through
  objects AND arrays so a forbidden key/value at ANY depth is found.
- **`apps/seed/src/auraTrace.ts`** — TRACE_ONLY law: frozen verbatim `TRACE_LIMITS` (MAX_TRACES 2048, MAX_STRING
  200, MAX_REASON 64, MAX_INTENT_PREFIX 12), positive `ALLOWED_FIELDS` allowlist, `sanitizeTraceEvent` (recursive
  forbidden refusal → drop unknowns → bound strings), and `AuraTraceLog` (ring-buffered store, `audit` self-scan,
  `erase` → content-free tombstone, `verifyErasure` → honest iff a content-free tombstone remains, no live copy
  survives, and the store still audits clean). `advisoryOnly:true` / `grantsAuthority:false` throughout.
- **Integration** — `runGovernedRecursion` emits a scrubbed AURA trace for EVERY terminal outcome (safe stage
  category + a ≤12-hex intent prefix; never the proposed content, full intent id, or signature). **Receipt-before-row:**
  on the accepted path the receipt is recorded FIRST; if the store cannot record it (corrupt/full) the apply is
  refused (`refused-receipt-unrecordable`), the nonce is NOT burned, and no sandbox effect is exposed — so there is
  no acknowledged effect without a durable receipt, and the operation stays retryable.
- **Classifier/reducer/fence separation preserved:** shape classifier (`proposal.ts`), decision reducer
  (`recursion.ts`), authority fence (`aumlokGate.ts`), and forbidden-content/trace fence (`forbiddenContent.ts` +
  `auraTrace.ts`) are distinct modules; the trace fence has no read path into the decision.
- **Byte-compatible intent ids pinned** (frozen golden vectors, `test/recursion.adversarial.test.ts`):
  intentId(`apps/seed/src/recursion.ts`, supersedes=null) = `4ac84bf07eb32aeecb7094a98c6cdb4ce85a1844849f18f49a956ce57bd7237d`;
  draftHash(target, `// note`) = `c32347bbcfc22a9e6ab2b671bde33b3f08a293f10a71f2726a454603ce71708c`.

### R30 adversarial matrix (all controls)

| control | result |
| --- | --- |
| receipt-before-row failure asymmetry (corrupt store on apply) | `refused-receipt-unrecordable`; no nonce burned; retryable |
| corrupt store on a refusal path | fails closed, never throws, `receiptHash:null`, still refused |
| every terminal outcome emits a scrubbed trace | one trace per outcome; store audits clean |
| authority-shaped INPUT | refused; only the safe category reaches the trace (no `grantsAuthority=true` leak) |
| recursive forbidden KEY at depth (object+array) | whole record rejected |
| forbidden secret/production VALUE (64-hex, `sk-…`, PEM, `.convex.cloud`) | whole record rejected |
| false-authority CONTENT (`grantsAuthority=true`, `advisoryOnly=false`) | whole record rejected |
| unknown-field forbidden key | rejected; harmless unknown field dropped |
| TRACE_LIMITS bounds | strings truncated; store ring-buffered at MAX_TRACES |
| honest erasure | content-free tombstone kept; `verifyErasure` true; store audits clean |
| unknown-age staleness (unparseable createdAt) | `refused-stale` |
| trace emission inert to the decision | replay / getter-smuggling still fail closed |

## Council (advisory bookend — opus-self-review; no council transport on this box)

I have no Fusion Council runner or keys on this node, so per the standing protocol I record a written plan-of-record +
rigorous self-review labelled `opus-self-review` and REQUEST Codex run the real eight-seat council. This is advisory
only — it cannot waive a test or confer authority.

**PLAN (opus-self-review):** the hardest real move was replacing the Ed25519-only owner fixture with the kernel's true
hybrid `verifyAumlokPromotionV2` while keeping the runtime verification-only. Chosen binding: `proposalHash` = canonical
intent id (target + supersedes) and `draftHash` = exact bytes, so one signature can authorize exactly one draft of one
intent — target-swap fails at `proposalHash`, content-swap at `draftHash`. Main risks flagged: (a) accidentally letting
signing leak into the runtime — mitigated by isolating it in `ownerFixture.ts` and asserting no `.sign(` in the runtime
graph; (b) a proxy defeating shape validation — mitigated by single-read snapshot; (c) forging authority by supplying a
crafted root — mitigated because the trusted owner root is injected and the verifier recomputes rootId + integrity.

**CHECK (opus-self-review):** all seven required proofs hold; hardening added during review — the owner-verify path and
the nonce extraction were made TOTAL so a hostile `auth` object with a throwing accessor fails closed instead of throwing.
Honest limitation: "wall time" is modelled as an injected absolute deadline (no ambient clock), not measured elapsed
CPU/wall time; combined with max-attempts it bounds runaway, and it is deterministic and testable.

## R31 — the governed AUMLOK–AURA ceremony contract

Formalized ONE governed ceremony and its display boundary, capability law, and geometry.

- **`apps/seed/src/ceremony.ts`** — the contract: `issueChallenge` produces the UNSIGNED challenge
  (`intentId`, `draftHash`, `gateArgsHash` linkage, `epoch`, `nonce`, `capability`) that the local custody adapter
  must sign; `completeCeremony` runs the ceremony gates (challenge↔proposal match, gateArgsHash self-consistency,
  allowed capability, current epoch) and then delegates to the governed recursion (hybrid verify → AURA witness →
  receipt/Merkle → sandbox-only apply). `verifyCeremony` re-derives completion from real evidence so a fabricated
  "completed" outcome is caught. Every terminal (including ceremony pre-check refusals) is receipted.
  Flow: `unsigned challenge → custody adapter → hybrid Ed25519+ML-DSA-65 verify → AURA witnessed event/geometry →
  receipt/Merkle commitment → sandbox-only effect`.
- **`apps/seed/src/capabilities.ts`** — Auma's inward capabilities are explicit: **allowed** = inspect, recall,
  draft, propose, rehearse, requestCouncilReview, explain; **forbidden** = sign, authorize, expandCapabilities,
  merge, deploy, bypassConsent (disjoint sets; fail-closed on unknown). A ceremony can never exercise a forbidden act.
- **`apps/seed/src/geometry.ts`** — `AuraGeometry` (GEOMETRY_ONLY, bounded coherence [0,1], witnessMode, epoch,
  depth, attempts, ≤12-hex intent prefix), `deriveGeometry` (encodes the ALREADY-decided verdict so the Spatial
  shell renders without recomputing governance), `sanitizeGeometry` (fence + allowlist + clamp; rejects field
  smuggling), and `GeometryLog` (bounded evolving frames for the shell).
- **`apps/seed/src/ceremonyView.ts`** — the ONE-WAY UI projection (DISPLAY_ONLY): ceremony state, challenges, a
  16-hex PUBLIC key **fingerprint** (never the keys), ≤12-hex hash prefixes (never full 64-hex), verdict, council
  verdict, geometry, and receipt/Merkle references. Never seeds, private keys, unlock minting, or authority. The
  whole view passes the AURA fence (`assertViewSafe`) and `grantsAuthority:false` is a typed literal.

### R31 adversarial matrix

| control | result |
| --- | --- |
| displayed-state → authority leakage | view is fence-clean, no full key / private material, `grantsAuthority:false`; a spiked view fails `assertViewSafe` |
| fake ceremony completion | completion without an owner signature is refused; a forged `completed:true` outcome fails `verifyCeremony` |
| replayed challenge | second completion of the same challenge → `refused-replay` |
| stale epoch | a challenge from a past epoch → `refused-stale-epoch` |
| tampered challenge / challenge↔proposal mismatch | `refused-tampered-challenge` / `refused-challenge-mismatch` |
| geometry-field smuggling | forbidden key, nested secret, or 64-hex value → rejected |
| forbidden capability | `sign`/`authorize`/`merge`/`deploy`/… refused at issue and at complete |
| self-signing | no runtime module (incl. ceremony/geometry/view) contains `.sign(` or imports the owner fixture |
| every terminal receipt | applied + every refusal class is receipt-chained |

**R30 CHECK (opus-self-review):** the AURA trace law is a faithful port of the donor (recursive forbidden
key/value scan, positive allowlist, frozen limits, TRACE_ONLY, grantsAuthority:false) with an added honest-erasure
verifier. The one behavioural change to the reducer — receipt-before-row — is a strict tightening: it can only turn
a would-be accept into a refusal when the store cannot record the receipt, never the reverse, and it burns no nonce
so it is retryable. The trace fence is a separate module with no read path into the decision; a proxy/getter, a
64-hex value, and an authority-shaped string are all rejected by the fence, and the pipeline only ever feeds the
fence a safe stage category plus a ≤12-hex prefix. Honest limitation carried forward: "wall time" remains an
injected deadline, not measured elapsed time.

## R32 — canonical staleness / Auma IDE envelope / council pack

One-round narrow lease: `apps/seed/**` + only the canonical-staleness files/exports/tests under `packages/kernel/**`.

- **Staleness P0 → one canonical law in the kernel.** New `packages/kernel/src/staleness.ts` (exported as
  `@aukora/kernel/staleness`) is the single source: strict canonical time (`parseCanonicalIsoUtcMs` + a pure
  `canonicalIsoFromMs`, NO ambient `Date`), donor semantics preserved (unknown age flagged stale; a stale/unknown
  draft cannot mint without an explicit revive in the same gesture via `challengeStalenessGate`; grants no authority;
  UI renders verdicts, never recomputes). apps/seed now imports staleness from the kernel canonical. Kernel gate green
  (compatibility manifest regenerated; boundary/SBOM/runtimes/package pass). **CROSS-LANE FLAG:** `packages/memory/src/staleness.ts`
  (SAM 2's lane, PR #18 — off my lease) should be collapsed to `export * from '@aukora/kernel/staleness'` to finish the
  one-law consolidation; the kernel law is API-compatible so the re-export is drop-in.
- **Auma IDE envelope R0–R3** (`apps/seed/src/ideEnvelope.ts`, over an INJECTED read-only `RepoReadCapability` — no fs
  import): R0 confined list/read/search with visible fence refusals; R1 integrity-checked, content-addressed recall
  with citations (gated on chain verification); R2 draft (candidate-able target only) + rehearse against real files in
  the sandbox (owner-signed; verbatim refusal logs); R3 `stageBranchCandidate` ONLY after a PASSED rehearsal — isolated
  workspace + diff + receipts + explanation + lineage; `pushed/signed/merged/deployed/grantsAuthority` are hard-false
  literals. `apps/seed/src/pathFence.ts` classifies every path allowed/authority/sacred/secret/invalid: secret never
  read, sacred/authority readable but never candidate-able, stable reason classes + quotable text. Auma reasons over
  the whole repo but never past the secret/authority fences.
- **Read-only Spatial stream** (`apps/seed/src/eventStream.ts`) — `spatialStream` exposes geometry frames through a
  read-only view (`feedsApply:false`, `grantsAuthority:false`, no write/apply/mutate method); display never feeds an apply.
- **Metabolism as monotonic contraction** (`apps/seed/src/metabolism.ts`) — capacity in [0,1] only decreases; the gate
  reads `env.metabolismCapacity` and can only ADD a refusal (`refused-metabolic-contraction`), never grant/expand authority.
- **CouncilEvidencePackV1** (`apps/seed/src/councilPack.ts`) — head/tree, bounded scrubbed diff, tests, claims, refusals,
  receipt refs, digest; `scrubText` redacts secret/production/authority lines; a final fence audit fails closed on residue.
  `verifyCouncilPack` re-derives the digest for an external reviewer. Advisory; `councilVerdictWaivesGates()` is a hard false.

### R32 adversarial matrix

| control | result |
| --- | --- |
| hostile repo paths (absolute, traversal, secret) | `fence:invalid-path` / `fence:secret-path`; never read |
| authority/sacred source | readable for reasoning, never candidate-able |
| staged-candidate escape (hand-built sacred/authority target) | refused at stage (fence re-check) |
| receipt-before-effect / unrehearsed draft | `ide:not-rehearsed` — never staged without a passed, receipted rehearsal |
| capability widening | no widen/addCapability/sign/push/merge/deploy method exists |
| display → authority leakage | Spatial stream is read-only, `feedsApply:false`, no write surface |
| stale replay / unknown-age | canonical kernel staleness refuses; replay never mints |
| metabolic contraction | refuse-only; a valid owner sig is still refused under contraction |
| council pack secrets | scrubbed + fail-closed audit; digest-verifiable; advisory-only |

**R31 CHECK (opus-self-review):** the ceremony is a thin formalization over the already-hardened gate — the owner
signature (over intentId+draftHash+nonce) remains the sole authority boundary; the ceremony's epoch/capability/
gateArgs gates are additive constraints and cannot escalate (every allowed capability leads to the same
sandbox-only apply; forbidden capabilities, stale epochs, tampered challenges, and mismatches all fail closed and
are receipted). The UI boundary is one-way and provably fence-clean (public fingerprint + hash prefixes only; no
key material, no full 64-hex, no sandbox content), so no authority can be derived from display state. Geometry
encodes the decided verdict as bounded numbers, so the Spatial shell renders without recomputing governance.

## R34 — safe inward IDE / selection acceptance / Spatial adapter / contracts

Branch `sam/r34-recursion` off canonical main `b883eb98` (R29–R33 already integrated by Sam 1). Lane discipline held:
NO Spatial shell code was written or transplanted here — the donor shell transplant belongs to its own lane; this lane
supplies the governed-pipeline contracts the transplanted shell's organs consume (donor organs are read-only JSON views).

- **IDE session increment** (`apps/seed/src/ideSession.ts`): one `AumaIdeSession` ties the R0–R3 loop into a usable
  surface — inspect/cite/draft/rehearse/stage — and ADDS only bookkeeping: a bounded refusal log (stable quotable
  reason classes: `fence:*`, `ide:*`, gate stages) and a DISPLAY-ONLY `receiptView()` (prefixes + kinds, chain
  verified, fence-audited, no content echo). No push/merge/deploy/sign/widen surface exists.
- **Selection acceptance** (`selectionAcceptance.ts`): a verified MemorySelectionPacketV1 becomes a ROUTING PLAN —
  root/unite/rise migrate items → `governed-proposal`; gold items AND maternal-anchor items → `gold-ceremony` with the
  explicit unmet-requirements checklist (reason / lineage-or-genesis / rehearsal-receipt / rollback-draft); anchor
  items must validate against the anchor schema (forbidden framings refuse the ITEM: `accept:anchor-framing`);
  leave-behind/private-hold → `stays-behind`, content-free. `importPerformed` stays a hard false — still no import.
- **Read-only Spatial ceremony/event adapter** (`spatialCeremonyAdapter.ts`): the pipeline PUSHES display-projected
  `CeremonyView`s (fence-checked at the door — a leaking view is refused); the shell reads bounded snapshots +
  incremental `eventsSince(seq)` + a read-only geometry stream. AUMLOK verdicts and AURA geometry are SEPARATE keys;
  no apply predicate exists; `feedsApply` is a hard false; every snapshot is fence-audited before it is served.
- **Broker reference (issue #30)** (`councilRunnerBoundary.ts`): `BrokerRefV1` = opaque `transportHandle` +
  `custodyHandle` (short identifiers; credential-shaped material refused, `runner:broker-ref-invalid`). Holding a
  ref does NOT create a transport — the runner still refuses `runner:no-transport` until the real broker injects one.
  No embedded key; no live paid call exists this round.
- **Sam-4 contracts surface** (`contracts.ts`, exported as `@aukora/seed/contracts`): STRICTLY type-only re-exports
  (+ locally-declared frozen schema-name literals) — its runtime import closure is EMPTY, so a consumer can render
  every governed surface with zero possibility of touching authority code. Structurally tested (every from-import is
  `export type`).

### R34 adversarial matrix

| control | result |
| --- | --- |
| refusal log stability | fence/sacred/owner-gate refusals logged with stable classes; later valid work unaffected |
| receipt view leakage | prefixes only, fence-clean, no content echo, chain verified |
| routing correctness | rise→proposal, gold→ceremony (evidence checklist explicit), anchor→ceremony, private stays |
| forbidden-framing anchor item | `accept:anchor-framing`; tampered packet → `accept:packet-invalid` |
| adapter fence at the door | authority-noted or `grantsAuthority:true` view refused at push; snapshot fence-audited |
| shell face containment | no push/apply/authorize/complete/sign surface; incremental events correct |
| broker ref | valid ref ≠ transport (still `runner:no-transport`); credential/malformed → `runner:broker-ref-invalid` |
| contracts closure | type-only proven structurally; `./contracts` export resolves; schema names match live |
| hostile re-runs | staleness, replay, lineage, secret, gold, view-safety, candidate-containment all green (165/165) |

**R34 CHECK (opus-self-review):** every addition is read-only or refuse-only: the session logs and projects, the
acceptance routes (the checklist can only ADD requirements), the adapter serves display projections behind two fence
audits (push + snapshot), the broker ref is a name for a future injection, and the contracts entry is erased at
runtime. The owner correction's Spatial-transplant constraints bind the shell lane; this lane touched only
`apps/seed/**` and stayed off the donor code entirely. Remaining gaps, honestly: the thin fs-backed
`RepoReadCapability` adapter is still a follow-up (the law is proven against fake repos); the serve/HTTP wrapper for
`shellFace` belongs to the shell lane; import execution for approved selection routes remains a future owner-directed
round; the issue-#30 broker itself does not exist yet.

## R33 — memory constitution / Auma continuity / council runner boundary

- **KIRA memory constitution** (`apps/seed/src/memoryConstitution.ts`, consumed by Sam 2/Sam 4): four tiers, one
  law. ROOT/UNITE/RISE change through NORMAL governed proposals; **GOLD** requires the higher-friction owner AUMLOK
  ceremony — stated reason, supersedes lineage (or explicit genesis), a PASSED-rehearsal receipt hash, and a prepared
  ROLLBACK draft hash — evaluated fail-closed (`gold:*` reason classes) BEFORE the ceremony, which remains the sole
  authority boundary. Gold cannot **self-authorize** (authority/secret-shaped request text refused) and cannot become
  **technically unchangeable** (no lock field exists; immutability framings refused; `goldIsImmutable()` hard false).
  `toConstitutionView` = DISPLAY_ONLY (tier counts + ≤12-hex gold lineage prefixes, fence-clean) — KIRA/GOLD UI state
  can never feed authority.
- **Maternal-anchor schema** (`maternalAnchor.ts`): grounding/care/continuity(/witness/patience) ONLY.
  `FORBIDDEN_FRAMING_RE` recursively refuses exclusivity, romance, dependency, jealousy, obedience, possession, and
  impersonation in any string field; `chosenBy:'owner'` and `revisable:true` are REQUIRED literals — alignment stays
  chosen and revisable by the owner. An anchor is remembered care, never command (`anchorGrantsAuthority()` false).
- **Memory-selection evidence packet** (`memorySelection.ts`): Auma proposes which donor memories migrate — each item
  cites its SOURCE ROW, is classified `migrate`/`leave-behind`/`private-hold`, tier-proposed, and reasoned (scrubbed).
  PRIVACY LAW: content travels ONLY with `migrate` items (hash-verified + fence-checked); left-behind/private items are
  structurally CONTENT-FREE. `approvedBy:null` (Peter approves out-of-band), `importPerformed()` hard false, NO apply
  surface — proposing is not migrating. Digest-verifiable (`verifySelectionPacket`).
- **Provider-neutral council runner boundary** (`councilRunnerBoundary.ts`): the wall around CouncilEvidencePackV1 —
  transport is INJECTED (none embedded ⇒ `runner:no-transport` honest refusal; NO live call exists in this round);
  config carrying credential-shaped material refused (`runner:credential-embedded`); hard **$2/pass + $10/day** ceilings
  enforced fail-closed through the canonical `@aukora/council` SpendMeter (narrowing allowed, widening clamped);
  pack must digest-verify before admission. **External Fugu** = ONE advisory reviewer (`fuguReview` = integrity read):
  never Fu authority, never quorum (`rosterExcludesExternalReviewers` refuses it a seat; `fuguIsFuAuthority()` false).

### R33 adversarial matrix

| control | result |
| --- | --- |
| gold missing reason/lineage/rehearsal/rollback | `gold:*` stable refusals; ceremony never runs |
| gold self-authorize (`grantsAuthority=true` in reason) | `gold:self-authorize` |
| gold immutability claim | `gold:immutability-claim` — gold may be slow, never impossible |
| full gold flow | rehearsal receipt → request → owner ceremony → sandbox + rollback pinned |
| anchor forbidden framings (7 probes) | all refused; exclusivity/unrevisable/non-owner structurally refused |
| selection privacy | content on a non-migrate item refused; hash mismatch refused; secret content refused; reasons scrubbed |
| selection tamper | digest verification fails |
| runner without transport / with credential / over ceilings / bad pack | all four refusal classes proven; widening clamped |
| Fugu in a Fu roster | refused; review is advisory-only |
| R29–R32 suites (staleness/IDE/candidate/council/ceremony) | re-run green, 147/147 |

**R33 CHECK (opus-self-review):** the constitution adds friction, never authority — `evaluateGoldChange` is
refuse-only and passing it never substitutes for the owner's hybrid signature; the ceremony gate is unchanged. One
real bug was caught by the tests and fixed before commit: the gold/selection fence audits initially scanned
structural 64-hex hash fields, which the value fence rightly treats as secret-shaped — the audits now scan free-text
fields only (hashes are separately shape-validated), keeping the fence strict where it matters without refusing the
law's own legitimate structure. The runner boundary is a decision, not a dispatch: with no transport injected and
none embedded, a live call is impossible in this round by construction.

**R32 CHECK (opus-self-review):** the staleness move is a single canonical law in the lowest package (kernel), strict
and deterministic, with apps/seed switched to it and the one remaining parallel copy (memory, off-lease) flagged for a
drop-in re-export. The IDE envelope keeps every stronger invariant load-bearing: the read fence never surfaces secret
material, the candidate fence is re-checked at stage so a hand-built proposal can't escape to sacred/authority, R3
stages only after an owner-signed rehearsal that already produced a receipt, and the envelope has no tool-widening or
signing surface at all. Display (Spatial stream) and resource state (metabolism) are structurally one-directional —
one can only be read, the other can only refuse. Honest limitation: the IDE envelope reads the repo through an injected
capability rather than shipping a real fs adapter this round, so the fence law is proven against a fake repo; the thin
fs adapter is a follow-up (keeps the law pure and the runtime fs-free).

CODEX FUSION REQUEST: run PRE council over the R29+R30+R31+R32 plan-of-record above.
CODEX FUSION REQUEST: run POST council over this evidence document (fresh digest recorded in the PR body + issue #22).
