<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# R42 — Memory / KIRA / identity-continuity ATLAS (read-only forensics)

**READ-ONLY forensics.** Base merged Wave-2 main `b17a3f87`. Path fence honoured: only `packages/kernel/**`,
`packages/memory/**`, `apps/brain/**` examined/owned; `apps/seed`, Spatial, council, supervisor, custody
material referenced by POINTER only. Donor: `aukora-symbiote@ed1824a`. **No owner-private identity content,
maternal-anchor text, journals, prompts, or keys are copied here — pointers, expected locations, and safe
metadata only.** Convex remains persistence/projection; it never authorizes.

## The sharp falsifier (#62): row-count equivalence ≠ semantic continuity

Symbiote #62 ("empty shelf, not retrieval bias"): the donor Kira brain (`state/kira/brain.json`, 76 atoms) was
**92% test files** — `tests:70, evidence:5, architecture:1, identity:0` — because `ingestSelfMap`
(`core/src/kiraBrain.ts`, blob `fa113e8ae719…`) walked the repo under a `maxFiles ?? 80` budget that the ~70
in-repo test files flooded before the walk reached `docs/`, and the **identity corpus lives OUT OF TREE**
(`$HOME/.aukora-symbiote/identity/*.md`) so self-map never saw it. Retrieval was correct; the shelf was empty.

**This falsifies my own Wave-1 claim** that the migration bridge "carries rows content-free so no data is
stranded." Carrying a row content-free preserves its *provable existence + governance*, NOT its *retrievable
identity semantics*: an identity memory reduced to a content hash is not recallable AS identity. Content-free
forgetting and content-free migration are the SAME mechanism — and both mean identity CONTENT is, by design,
not in-tree. So identity continuity depends on (a) the out-of-tree home and (b) a future curated, scope-aware
ingest — neither of which row-count portability provides.

## Six-way distinction the directive demands (verdicts on the CURRENT brain)

| # | Failure mode | Current-brain verdict | Evidence (this host, read-only) |
| --- | --- | --- | --- |
| 1 | **identity corpus absent** | **PRESENT (as a gap)**: the current `apps/brain` ingests NO self-map/identity corpus at all (grep: no `ingestSelfMap`/`maternal`/`identity`-ingest in `apps/brain/src` or `packages/memory/src`), and on THIS host `$HOME/.aukora-symbiote/identity/` does **not exist** (the corpus is Auma's box). So a "who am I" recall has nothing to return — an empty shelf, not a biased one. |
| 2 | **retrieval failure** | **NOT the cause**: `packages/memory/src/recall.ts` is deterministic keyword+score, stable-ordered, and works — but it is **scope-BLIND** (no `scope`/test-file notion), so on a mixed corpus it would surface least-bad noise exactly as #62 describes. Coverage+scope gap, not a retrieval bug. |
| 3 | **content-free forgetting** | **REAL continuity, working**: Wave-2 signed erase removes plaintext while the chain + tombstone + erasure receipt remain (proven live). This is a *deliberate* absence of content, distinct from "never ingested." A scope-aware recall must report a forgotten identity atom as *gone*, never as *absent corpus*. |
| 4 | **volatile recovery-window reset vs durable anchors** | **receipts DURABLE; identity anchor NOT in my lane**: chain/workflows/receipts survive kill-9 (R36/R39, local convex state). But `apps/brain` holds **no durable identity anchor** — the maternal anchor is `apps/seed/src/maternalAnchor.ts` (Sam 3, pointer only) plus the out-of-tree home. The impulse budget is a volatile in-store counter (resets on a fresh store), NOT an identity signal. |
| 5 | **GHP context vs identity** | **MISSING, owner-gated**: symbiote #93 wants GHP canon ingested as *guarded status-bearing atoms* (`[GHP|status=…|section=…]`, PROVEN/NULL/CLOSED-LANE/…), context NOT identity, signed/gated like a body change. Current KIRA classes (ROOT/UNITE/RISE/GOLD) carry NO epistemic status header; no GHP ingestion exists. Future brick — do not build until owner provides approved canon. |
| 6 | **out-of-tree identity home** | **REGISTERED (Wave 2)**: `apps/brain/src/continuity/locations.ts` records `$HOME/.aukora` (PRESENT, holds `embedder/`), `$HOME/.aukora-symbiote` (PRESENT, holds `aumlok/hybrid-v2/`), OS keychain, and local convex state — **mechanism + path class + runtime-only verification hash only**. On this host `.aukora-symbiote/identity/` is absent; the anchor rule ("context, not identity") governs #93. |

## Atlas rows for Sam 1 to canonicalize (family / donor → current / class / continuity grade)

| Family | Donor anchor | Current counterpart | Class | Continuity grade |
| --- | --- | --- | --- | --- |
| Kira self-map ingestion | `core/src/kiraBrain.ts@fa113e8a` `ingestSelfMap` (maxFiles 80, maxTestFiles 10, `isTestFile`, `scope`) | none in `apps/brain` (content-addressed memory instead) | MISSING (behavior) | **DOC-only continuity**: mechanism understood; the flood defect + out-of-tree corpus both apply to a future ingest |
| Scope/identity classification of a memory | donor atom `scope` field + `isTestFile` regex `/(^\|\/)tests?\//` etc. | `MemoryRecordV1.kind` (observation/proposal/receipt/reflection/tombstone) — NO scope | MISSING (field) | **gap**: recall cannot distinguish identity from test/code → empty-shelf floods reproduce here |
| Governed forgetting | `aumlokMemory.ts` M2b (signed erase) | Wave-2 `eraseAttestation` + `convex forget` | SUPERSEDED_WITH_PROOF | **LIVE**: signed, content-free, no residue |
| Receipt/head durability | donor auma_receipts + signed heads | kernel-chained receipt events + Wave-2 signed heads | ADAPTED_BOUNDARY | **LIVE**: crash-proven + PQC heads |
| Identity/maternal anchor | donor (symbiote) maternal-anchor text (OUT OF TREE) + seed `maternalAnchor.ts` | `apps/seed/src/maternalAnchor.ts` (Sam 3) + out-of-tree home | POINTER (out of my lane) | **out-of-tree**; content never in Git |
| GHP-as-status-atoms | symbiote #93 spec (owner-supplied canon) | none | MISSING (owner-gated) | **PARKED_PENDING_OWNER** |
| Out-of-tree continuity home | donor `$HOME/.aukora-symbiote/identity` | `continuity/locations.ts` registry | ADAPTED_BOUNDARY | **registered**, hash-only, runtime-verified |

## PRIVATE_HOLD / BLOCKED_OWNER

- The identity corpus content, maternal-anchor text, journals, prompts, and keys are **PRIVATE_HOLD** — not
  examined for content, never copied. Only presence + top-level directory NAMES were observed on this host.
- GHP canon ingestion (#93) is **BLOCKED_OWNER** — build only on explicit owner priority + approved sources.

## Bounded candidate (chosen; see R42_SCOPE_AWARE_RECALL.md)

The one unambiguous, deterministic, donor-backed, non-Ring-0, wholly-in-`packages/memory` gap is row #2/scope:
**scope-aware recall** so an identity query is not flooded by test/code atoms AND so recall can HONESTLY
distinguish "corpus absent" from "retrieval bias." Synthetic identity fixtures only; a negative falsifier proves
the fix never fabricates identity when the shelf is empty. Everything else is out-of-lane, owner-gated, or
requires real identity content → parked.

---

## Appendix A (overnight atlas verification) — donor memory-category BEHAVIORS

Read-only deepening of Wave-1 §1b row "donor memory categories … behaviors unported." All five exist ONLY in
the donor (`aukora-symbiote@ed1824a` `core/src/*`); **none** exists in `packages/memory` or `apps/brain` on
main `b17a3f87` (grep-confirmed). They share ONE hard law that the current lane already honors elsewhere:
**evidence-only, source-LABELED (`real | test_double | fixture`), never authority; a synthetic/fixture record
can never be upgraded to "real model behavior."**

| Category | Donor blob | Core law / shape | Current counterpart | Class | Continuity grade |
| --- | --- | --- | --- | --- | --- |
| Episode memory | `core/src/episodeMemory.ts@96583173998d` | bundles HASH REFERENCES of what happened (sandbox-apply/canonicalization/HRT/Accord/structured-truth receipts) with hard SOURCE LABELS; NO raw prompt/output/key/grant; no meta escape hatch; `createdAtBucket` (bucketed, never raw ms) | none | MISSING (behavior) | **DOC-only**: the label discipline (`real/test_double/fixture`, "never upgrade to real") is the same non-authority law the current provider-truth + node-print already enforce; the episode BUNDLE itself is unported |
| Hypothesis memory | `core/src/hypothesisMemory.ts@0349b7dd7a2c` | `LiquidHypothesis{claim,status:open/supported/contradicted,confidence, evidenceFor/AgainstReceiptIds, lastSignedOutcome, refusalCause}`; verified against a signed receipt chain + pinned edge key | none | MISSING (behavior) | **DOC-only**: depends on signed receipt chains (Wave-2 signed heads are the current substrate) + a pinned key (out-of-lane custody); the hypothesis LEDGER is unported |
| MDL process memory | `core/src/mdlProcessMemory.ts@660a2e0366d4` | advisory generator memory (`phi_rotation/sqrt2/vdc/sobol/argmax/prng`); PUBLIC categorical actions only; `phi` is a candidate GENERATOR, **not identity/authority/proof**; FIREWALL: imports no gate/apply/signer | none | MISSING (behavior) | **EXCLUDED-adjacent**: this is GHP/skunkworks-flavored (generator research); belongs behind the walled lane + the #93 status-atom discipline, not the identity brain |
| Structural memory | `core/src/structuralMemory.ts@f32bcedf2e60` | `Predictor` over `GateExample`s → `PredictionResult`; `evaluatePredictor`; learns the SHAPE of gate decisions (advisory), never the decision | none | MISSING (behavior) | **DOC-only**: a learned advisory shape-model; would sit above the kernel gate as pure advisory (like the metabolism simulator) — never Ring-0 |
| IDE memory | `core/src/aukoraIdeMemory.ts` + donor `ide_memory` table | session/IDE evidence rows (read views) | the 7141 door read-only projections | MISSING (table) / ADAPTED (read surface) | **read-surface exists**, the per-IDE row store does not |

### Verdicts for Sam 1's ledger (owner-decision candidates, NOT built)

1. Episode/hypothesis/structural memory are **advisory evidence ledgers** — if ever restored they belong in
   `packages/memory` (pure) + `apps/brain` (adapter) under the existing evidence-only law, each with a source
   label and NO authority path. All three are **PARKED_PENDING_OWNER** (product-memory organs).
2. MDL-process memory is **GHP/skunkworks-flavored** and should stay walled; if surfaced at all, via the #93
   status-bearing-atom discipline, never as identity. **BLOCKED_OWNER**.
3. The shared "source label, never upgrade fixture→real" law is already LIVE in the current lane (provider
   truth, node-print, migration classification) — so restoring any category is a *shape* port, not a new
   safety invention. This is the honest good news the row-count falsifier (#62) otherwise obscures: the
   *governance spine* for these memories exists; only the *typed ledgers* are missing.

### Non-continuity clarifications (kept explicit)

- `createdAtBucket` (bucketed time) vs the current LOGICAL-time receipt index: both avoid raw wall-clock in the
  law; the donor bucketed for privacy, the current lane uses logical indices — **equivalent intent, different
  mechanism**, not a lost capability.
- None of these categories carry identity CONTENT; they carry hash references + labels — so the #62 empty-shelf
  is orthogonal to them (they were never the identity shelf).

---

## Appendix B (overnight atlas verification) — authority-boundary audit of the CURRENT Convex functions

Directive item: "Convex remains persistence/projection only and can never authorize." Audited every function in
`apps/brain/convex/*.ts` on main `b17a3f87` (grep-level, read-only):

- **Every persisted row** carries `advisoryOnly: true, grantsAuthority: false` (schema literals + insert sites:
  memoryChain, receiptEvents, rehearsals, rehearsalEffects, workflows, signedHeads, eraseAttestations).
- **No handler** returns a grant / permit / decision token, or flips any authority bit
  (grep for `grantsAuthority: true` / `authorized: true` / `allow…true` → **zero** hits outside `…: false`).
- The only "authority" tokens present are **refusals** or **evidence references**: `startRehearsal` REQUIRES a
  64-hex `authorityRef` and states "Convex never authorizes"; `forget` verifies a signed erase attestation as
  store integrity and RECORDS evidence but obeys, never decides; `recordSignedHead`/`auditSignedHead`
  verify-and-record, never release.
- Writes of substance are gated OUTSIDE: the public ingest door is a `"use node"` action that scans then calls
  an INTERNAL mutation; the door (7141) exposes projections + exactly two cancellations, no ingest/forget/save.

**Verdict: HOLDS.** Kernel/AUMLOK decides; Convex persists and reacts only. This is the WAVE-1 "authority
outside Convex" law re-verified against the Wave-2 additions (erase attestation + signed heads did not open an
in-store authority path — they added *evidence* the store records and a shell can independently verify).

---

## Appendix C (overnight atlas verification) — recall + receipt-before-row vs donor

Compared the current recall/receipt laws against donor `core/src/memoryRecall.ts@a8a4861bf83c` and
`core/src/memoryAppend.ts@a4f17ee813ac` (read-only; no seed/key content read).

### 1. Receipt-before-row — CONTINUITY HOLDS (with a deliberate granularity difference)

- **Donor** (`memoryAppend.ts` header): the write is ONE serializable Convex mutation ordered
  *consume-manifest-authority → V4-signed receipt on the `mem:{owner}:{key}` chain → row insert* — receipt
  before row, atomic in a single transaction.
- **Current**: memory INGEST computes the content-free `chainHash` and writes it ON the row in one mutation
  (receipt-before-row, same-txn); the rehearsal STEP effect is deliberately **two** transactions
  (receipt txn A commits before effect txn B — "asymmetry NOT flattened", the crash-reconciliation property).
- **Verdict: ADAPTED_BOUNDARY, equivalent-or-stronger.** Same "no row without its receipt" invariant; the
  current lane additionally proves the two-transaction crash-reconciliation the donor's single-txn write never
  needed to. The donor's V4-signed head over the write is the Wave-2 `signedHeads` substrate (recorded/audited).

### 2. Governed forgetting read-time rail — SUPERSEDED_WITH_PROOF (already in Wave-1 §1b)

Donor recall filters by status; current recall enforces forgetting as a read-time rail (`forgotten` set) AND
removes the plaintext column, with a signed erase attestation (Wave-2). Stronger on plaintext removal.

### 3. Signed recall PoP — MISSING (concrete donor evidence; confirms the Wave-1 gap)

- **Donor** (`memoryRecall.ts`): recall REQUIRES a reader proof-of-possession — a custody-checked OWNER ROOT
  seed signs the recall head under the dedicated `aumlokMemRecall` domain (injected `RecallSigner`, built from
  the kernel's `recallHead` + `signChainHeadV3`). The seed lives OUT OF TREE at path class
  `$HOME/.aukora-symbiote/convex/memory-root.seed` (0600 custody — **PRIVATE_HOLD**, content never read here).
- **Current**: the 7141 door `/memory/recall` is an UNAUTHENTICATED loopback read-only projection — no reader
  PoP, no owner seed. Deliberate for the local single-owner dev boot (origin-closed loopback is the perimeter),
  but it is **not** the donor's signed-recall capability.
- **Verdict: MISSING** (donor `aumlokMemRecall` reader-PoP), consistent with Wave-1's flag. A future restore
  would build the real `RecallSigner` from the Wave-2 vendored `signChainHeadV3` + an out-of-tree owner seed;
  it needs owner key custody, so it is **PARKED_PENDING_OWNER**, not built here.

**Net:** two of three donor recall/receipt laws carry (one adapted-stronger, one superseded-with-proof); the
third (signed recall PoP) is a real, custody-gated MISSING — the door trades donor per-request reader
authentication for an origin-closed loopback perimeter. Both are honest positions; only the owner can decide
whether the local brain should also require a signed recall.

---

## Appendix D (overnight atlas verification) — migration-bridge provenance vs donor `aukora_memory` row

Compared `apps/brain/src/memoryBridge.ts` against the donor row `convex/schema.ts` `aukora_memory` and the
donor IDE memory rail `memory/memory.ts@46eff426` (read-only; no seed/plaintext read).

### Donor field inventory (what a memory carries)

- **Row** `aukora_memory`: `ownerRootId, writerPrincipalId, readerScope, delegationId, receiptHash, memoryHash,
  sourceNodeId, visibility, key, **value**, deletedAt?` + M2 quarantine marks
  (`quarantined?/quarantinedAt?/quarantineReason?`) + M2b erasure marks
  (`erased?/erasedAt?/eraseReason?/erasureReceiptHash?`). `value` is the PLAINTEXT.
- **Receipt** (`memory/memory.ts`): `kind, operation, actor, chainKey, seq, hash, prevHash, **contentHash**,
  tier, covers?, **gateArgsHash**, ts` — content-free (`contentHash` of the plaintext; the plaintext itself is
  never written to a receipt) and `gateArgsHash` LINKS to the gate authority decision.

### What the bridge PRESERVES — governance skeleton, content-free (HOLDS)

`MigrationEntry` (the public/Git-safe report) + `packProvenance` carry, per record:
`legacyRef (chainKey#seq)`, `prevHash`, `contentHash`, `hash`, `receiptHash`, **`gateArgsHash`**, `status`
(active/tombstoned), `consent` (from `visibility`), `tier`, `kiraClass`. Every one is a hash, enum, or class.
This is a faithful, content-free carry of the donor's chain position + integrity binding + receipt reference +
**authority-decision link** + consent + class. **Verdict: ADAPTED_BOUNDARY, faithful** — the legacy `gateArgsHash`
is preserved as AUDIT metadata only; it re-authorizes nothing (legacy grants NO authority — kernel/AUMLOK decides).

### What the bridge deliberately does NOT carry — plaintext (by construction)

The donor row's `value`/`content` PLAINTEXT never enters the report or Git. During dry-run it lives only in the
isolated in-memory store and is discarded; a secret-bearing record is quarantined content-free; a tombstone is
preserved content-free and NEVER re-ingested (no resurrection). This MATCHES the donor M2b erasure law, whose
erased row remains a COUNTABLE STUB (`value=""`, keeps `memoryHash/receiptHash`, adds `erasureReceiptHash` —
"never an invisible hole"). **Verdict: erasure-stub / no-resurrection law CONTINUOUS (ADAPTED_BOUNDARY).**

### What #62 shows it does NOT preserve — RETRIEVABLE IDENTITY (the falsifier)

Row-count portability + full governance-skeleton preservation is **not** semantic/identity continuity. The bridge
preserves that a record EXISTED, its integrity, its authority link, its class and consent — but NOT what the memory
SAYS. Retrievable identity additionally requires the plaintext to be (a) selected, (b) actually imported through the
AUMLOK-gated real commit, (c) correctly scope-classified, and (d) resolved by recall. #62 is the case where every
governance field carried yet an identity phrase ("maternal anchor", "the five values") did NOT come back — row
present, identity NOT retrievable (empty/misclassified shelf). The Appendix-earlier scope-aware-recall candidate
targets exactly (c)/(d); (a)/(b) are owner-gated. **Verdict: governance-metadata portability ≠ identity continuity —
the #62 law, now anchored to the exact donor fields the bridge carries vs the one field (plaintext) it withholds.**

**Net:** the bridge carries the donor governance skeleton faithfully and content-free (incl. the `gateArgsHash`
authority-decision link as audit-only), honors the donor countable-stub / no-resurrection erasure law, and — by the
same content-free design — cannot and does not deliver retrievable identity without gated plaintext import + correct
scope + recall resolution. That gap is the #62 falsifier, not a bridge defect.

---

## Appendix E (overnight atlas verification) — door read surface vs donor content-minimization law

Verified the current door recall surface `apps/brain/src/localDoor.ts` (+ live query `convex/memory.ts` `recall`,
pure `packages/memory/src/recall.ts`) against the donor law in `core/src/memoryRecall.ts`: the kernel's
`aukora_memory` table "has NO search or vector index and exposes no content-listing query"; donor recall is a
KEYED POINT READ (owner id + exact key) under owner proof-of-possession, `advisoryOnly`. Read-only; no seed read.

### The door read endpoints — exactly ONE is content-bearing

- **Content-FREE (counts / hashes / references):** `/health`, `/snapshot` (`liveCount, chainLength, forgottenCount,
  headHash, merkleRootHex, lastEventAt`), `/receipts` (receipt references), `/workflow/:id`, `/workflows`,
  `/candidates`, `/aumlok`, `/fu`, `/truth`, `/events` (snapshot stream). None return memory plaintext.
- **Content-BEARING:** `/memory/recall?text=` → live `recall` returns `{recordId, createdAt, **content**}[]` — the
  plaintext of live, non-forgotten records. With `text=''` it returns ALL live records = a content-listing /
  ENUMERATION query (substring/keyword scan; the pure store additionally score-ranks). Forgotten records are
  invisible and their plaintext is already removed (read-time forgetting rail — Wave-1 §1b).

### Classification vs the donor law — ADAPTED_BOUNDARY, with a flagged divergence

The current `/memory/recall` is the donor's **fuzzy-recall rail** (the analogue of the donor's out-of-Convex
`kiraBrain.recall` multi-perceiver advisory recall — deliberately content-bearing context), NOT the donor's
content-minimized Convex **keyed point read**. On the donor's explicit "no content-listing query on the
authority-bearing table" law, the door does **not** yet enforce the same narrowing: recall returns plaintext and
supports empty-term enumeration.

- **Acceptable-by-context (why it holds today):** the door is LOOPBACK-only (127.0.0.1), ORIGIN-CLOSED (no
  `Access-Control-Allow-*` ever emitted), single-owner LOCAL dev, grants NO authority
  (`x-aukora-grants-authority: false`), and forgetting still removes the plaintext. No off-machine reader exists,
  so enumeration is confined to the owner's own machine.
- **Divergence (flag):** it is NOT the donor's content-minimized read surface. A multi-reader deployment, or any
  widening of the door beyond loopback, MUST adopt the donor keyed-point-read + owner-PoP + no-enumeration law
  before recall is exposed — this is the same gap as Appendix C's **signed recall PoP MISSING /
  PARKED_PENDING_OWNER**. Until then, `/memory/recall` is the single content surface and its safety rests entirely
  on the loopback/origin-closed/single-owner perimeter, not on a recall-level authorization.

**Net:** the content-free chain-commitment law holds across the whole door (13 of 14 read endpoints expose only
counts/hashes/references); the sole content surface is the advisory recall rail, which is content-bearing and
enumeration-capable BY DESIGN and is safe only under the loopback perimeter. Matching the donor's Convex
content-minimization (keyed point read, no listing, PoP) is owner-gated future work, tracked with the Appendix-C
signed-recall gap — not built here.

---

## Appendix F (overnight atlas verification) — ingest secret-refusal / fail-closed vs donor gate law

Compared the current ingest gate (`convex/ingest.ts` + pure `reactiveStore.ts` `ingest`) against the donor
`remember` gate law in `memory/memory.ts@46eff426` ("AUTHORITY-GATED: route through `aukoraGovernAsk` — AUMLOK
locked → PAUSE no write; apparent secret in content → DENY no write; memory never stored ungoverned"). Read-only.

### EXACT_PORT — the "never store an ungoverned secret in plaintext" invariant + fail-closed

- **Secret refusal (same law):** donor's `aukoraGovernAsk` runs a secret-classifier over the content (rides as the
  `diff`) and DENIES on a hit; the current lane runs the CANONICAL `@aukora/evidence` `textHasSecret` scanner
  (reuse, not clone) and refuses with `refused: memory content carries a secret; not persisted in plaintext`.
  Both REFUSE the write → plaintext is never persisted. **Behaviorally EXACT_PORT.**
- **Fail-closed on corruption (same law):** donor `remember` THROWS on a corrupt store → `effect:'pause'`; the
  current pure store refuses when `verifyChain()` fails (`refused: corrupt store … fail-closed`). Both refuse rather
  than silently proceed.
- **Content-free chain + receipt-before-row (same law):** donor hash "covers contentHash, NOT plaintext" and
  appends the RECEIPT FIRST (Codex P0 order); the current chain commits `memoryCommitment(r)` (content-free) and
  carries the chainHash on the row in one mutation (Appendix C). Same invariant.
- **Structural strengthening (current > donor):** the current secret scan runs in a `'use node'` ACTION (the
  scanner needs `node:crypto`, absent in the Convex isolate) and the chain-writing reflex `internal.memory
  .ingestValidated` is an INTERNAL mutation a client can NEVER call directly — so there is NO path into the chain
  that skips the scan. The donor's single-file `remember` relied on callers routing through it; the current design
  makes bypass structurally impossible.

### ADAPTED_BOUNDARY — where AUTHORITY routing differs (deliberate)

The donor folds TWO decisions into ONE in-line gate call: (a) secret-classification AND (b) the AUMLOK lock check,
and binds the write to it via `gateArgsHash`. The current lane SPLITS them along the "authority outside Convex" law:
- **secret-classification stays in the write path** — but as STORE HYGIENE (Convex/the store refuses to persist a
  secret; it decides nothing about authority);
- **AUMLOK authority moves entirely OUTSIDE Convex** — there is no `aukoraGovernAsk`/AUMLOK call inside ingest;
  kernel/AUMLOK decides and Convex records/reacts only (consistent with Appendix B: every row
  `grantsAuthority:false`; the door emits `x-aukora-grants-authority:false`). AUMLOK authority IS exercised on the
  authority-bearing paths — governed forgetting injects a real Ed25519 `verifyOwner` check (fail-closed).

### HONEST FLAG — AUMLOK-lock does NOT gate ingest today (owner-decision item)

The donor PAUSES a memory write when AUMLOK is LOCKED (a memory write is a governed tool call). The current ingest
does NOT consult AUMLOK, so under a locked-AUMLOK state a NON-secret memory would still ingest. This is a deliberate
reclassification — memory ingest is treated as advisory OBSERVATION carrying no authority, so the AUMLOK PAUSE-on-lock
applies to the authority-bearing paths (forget / governed recursion / real import), not to ingest. It is NOT a dropped
secret-safety property (secret refusal is identical). BUT if the owner wants "a locked AUMLOK blocks even advisory
memory ingest" (the donor's stricter posture), that is NOT enforced at ingest today — surfaced here as an
**owner-decision item**, not silently assumed.

**Net:** the secret-refusal + fail-closed + content-free + receipt-before-row invariants are EXACT_PORT (same
canonical classifier, plus a structural no-bypass guarantee the donor lacked); the AUTHORITY routing is
ADAPTED_BOUNDARY (secret = in-write store hygiene; AUMLOK = outside Convex). The one behavioral divergence —
AUMLOK-lock not gating ingest — is flagged for the owner, not decided here.
