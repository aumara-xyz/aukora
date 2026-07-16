<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# WAVE 2 — signed continuity (donor-restored) evidence

Restores four P0 continuity capabilities from **exact** donor sources, adapting only the necessary boundary,
while preserving every proven current improvement (content-free forgetting, receipt-before-row asymmetry,
fail-closed staleness, authority outside Convex — no donor in-Convex authority restored).

## Vendored donor sources (byte-faithful)

| File | Donor origin | Change |
| --- | --- | --- |
| `apps/brain/src/continuity/aukoraPqcSigner.ts` | `aukora-symbiote@ed1824a` `convex/aukoraPqcSigner.ts` (blob `a112e4021656…`) | body **byte-identical**; one added provenance comment line |
| `apps/brain/src/continuity/aukoraSignedHead.ts` | `convex/aukoraSignedHead.ts` (blob `b0c2a4fce113…`) | body **byte-identical**; provenance line + the sole ESM `.js` import suffix |

Both are pure (`@noble/post-quantum` ML-DSA-65 + `@noble/hashes`), run identically in the Convex V8 isolate and
Node — verified by the live run below.

## Restored capabilities

1. **Signed erase attestation + erasure receipts** (`continuity/eraseAttestation.ts` + `convex/memory.ts`
   `forget`): the donor M2b erase law over the current content-free chain. Preimage is the donor-exact
   `"aukora-aumlok-memerase-v1|" + sorted-key JSON` (comparative-vector test). The owner signs OUTSIDE with
   ML-DSA-65; the mutation is **scoped** (attestation `key` == recordId), **expiring** (donor 60 s freshness),
   **anti-replay** (digest consumed once), **atomic** (nonce consume + plaintext removal + tombstone + erasure
   receipt + evidence row in ONE transaction), **content-minimizing** (no plaintext anywhere). Convex
   verifies-and-refuses forgeries as store integrity and RECORDS evidence — it decides nothing.
2. **PQC-signed chain heads** (`convex/heads.ts`, donor SignedChainHeadV3/V4): head signed OUTSIDE, stored and
   audited here under the donor **monotonicity** law (a lower `chainLength` or older `timestamp` refuses —
   truncation/rollback detection). V4 binds the RFC 6962 receipt-history Merkle root computed with the kernel's
   `receiptHistoryRootHex` (reuse). `auditSignedHead` re-verifies the signature AND recomputes length/head/root
   against the live chain.
3. **Deletion/forgetting closure across derived state**: after erase, recall + snapshot + evidence agree and no
   plaintext survives in chain / forgotten / attestations / receiptEvents / snapshot (tested).
4. **Receipt reconciliation across crash/restart**: the two-phase receipt-before-effect rehearsal — the step
   receipt commits before its effect; a re-fired effect after "restart" applies exactly once (no duplicate).

## Out-of-tree continuity locations

`continuity/locations.ts` registers WHERE identity/anchors/journals live outside the repo — **mechanism, path
class, and verification procedure only**. No private content, no absolute paths, and no low-entropy identifying
hashes are committed; verification hashes are computed at runtime and stay local.

## Live proof (anonymous LOCAL deployment, sanitized)

```
ingest (live)                                   → ok
forget with a SIGNED ML-DSA erase attestation   → ok, digest 69251c1b…   ← the VENDORED pqc verify ran in the
                                                                            REAL Convex isolate
forget with a FORGED signature                  → refused: erase attestation signature_invalid
eraseEvidence                                   → eraseReason "live owner erase", originalReceiptHash 75527e97…
recall "erase target"                           → []                     ← no plaintext residue
memory:verify                                   → valid: true            ← chain intact after erase
```

## Tests

`test/wave2Continuity.test.ts` (11): donor comparative vector · forged/tampered/expired/wrong-key attestation
refusals · anti-replay · scope mismatch · erase-no-residue · deletion closure · signed v4 head + audit ·
head monotonicity (truncation/rollback) · forged head refusal · crash reconciliation (receipt-before-row,
exactly-once) · adaptive-organ severance (untrusted metabolism can't authorize or contract-to-zero). Plus the
existing convex suite updated to the attestation-gated `forget`. `convex-test` is SIMULATED; the erase above is
the LIVE evidence.

## MISSING / next-wave dependencies (inventoried, not implemented)

Signed head is not yet wired into the LIVE receipt WRITE path (heads are recorded/audited on demand — donor
B1.5b2 wiring is the next step). Donor memory-category runtimes (episode/hypothesis/mdl/structural/ide/womb)
were NOT added — not required by these P0 proofs (Wave-1 forensics §1b). No in-Convex authority restored, by
design.
