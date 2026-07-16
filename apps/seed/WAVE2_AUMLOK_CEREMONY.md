# WAVE 2 — Complete AUMLOK Ceremony / Custody / Onboarding (P0 authority membrane)

**Lane:** SAM 3 · governed-recursion / AUMLOK-gate · `apps/seed/**`
**Base main:** `4e6a7e73b0cb44d23a96c91729d623664664da87` · branch `sam/r41-wave2-aumlok-ceremony`
**Mandate:** restore the donor's complete AUMLOK owner flow — approve challenge/guard, bond/bind ceremony, signing-assistant boundary + owner custody, approval/authority roots, and the local approve/bind doors — as the P0 authority membrane, starting from the EXACT donor implementation and adapting only what current kernel law requires, documenting every changed byte and proving behavioral parity.

This wave closes the item WAVE 1 flagged MISSING ("complete AUMLOK ceremony/custody/onboarding").

---

## 1 · What was restored (donor → seed continuity)

| Donor source (aukora-symbiote) | Seed module | Classification | Adaptation |
| --- | --- | --- | --- |
| `core/src/aumlokApproveChallenge.ts` | `src/approveChallenge.ts` | **EXACT_PORT** | store keyed by generic `bindingHash` (the 64-hex candidate payload hash the owner signs) instead of donor `proposalHash`; optional injected `{phrase,nonce}` for deterministic test vectors. Algorithm (64-word list, modulo-debiased sampler, 4-word phrase, single-use, short-TTL, fail-closed verify) unchanged. |
| `core/src/aumlokApproveGuard.ts` | `src/approveGuard.ts` | **EXACT_PORT** | decision law byte-identical (off ⇒ lockdown ⇒ host ⇒ origin ⇒ sec-fetch-site, all 403). Added `approvalGateReasonClass()` (a pure reason-class projection for content-free receipts) — additive, no behavior change. |
| `core/src/aumlokBondCeremony.ts` | `src/bondCeremony.ts` | **ADAPTED_BOUNDARY** | state machine, one-time phrase reveal, anti-replay voice challenge, forbidden-material sanitization, and the N_t/B_t/A_t shadow boundary preserved. **Only** the A_t hinge changed: donor `legalAuthorityFromSignature` (ML-DSA Convex receipt via `verifyCanonicalReceiptHead`) → `legalAuthorityFromPromotion`, which routes the CURRENT hybrid verifier `verifyOwnerPromotion` (`aumlokGate`). |
| `core/src/aumlokSigningAssistant.ts` + `aumlokApproveCeremony.ts` custody guards | `src/ownerCustody.ts` | **ADAPTED_BOUNDARY** | read-only, existence-only key status + custody-absent detection + terminal command display. Donor was Ed25519-only; custody is now over BOTH hybrid halves (ed25519 + ml-dsa-65). The strict-custody / never-read-key / never-sign disciplines are preserved verbatim in intent. |
| `spatial/aumlok-approve-serve.ts` (Bun door) | `src/approveDoor.ts` | **ADAPTED_BOUNDARY** | the guard → challenge → custody → sign+re-verify+apply composition restored as a PURE request handler. Donor's in-door terminal signer + `dispatchSignedLiveApply` (read a local key, wrote the live tree) → the current law: the runtime VERIFIES, the owner signs OUT-OF-BAND, and the door routes the hybrid-signed authorization through the ONE canonical `candidateReferenceMonitor.decide()`. The door performs NO tree effect. |
| `core/src/aumlokAuthorityRoot.ts` / `aumlokApprovalRoot.ts` (Ed25519 pin) | (kernel `AumlokAuthorityRootV2`, already present) | **SUPERSEDED_WITH_COMPARATIVE_PROOF** | the donor's Ed25519-only root is superseded by the kernel's hybrid root + `verifyAumlokPromotionV2`. WAVE 2 binds the ceremony to THAT root; no downgraded single-algorithm path exists. |
| `core/src/aumlokSigner.ts` (human-side signer) | (out of lane — `ownerFixture` is the test signer) | **EXCLUDED** | signing stays out-of-band; the organism never imports a signer. `ownerCustody.ts` imports nothing that can sign. |

---

## 2 · Hard-law coverage (each mapped to code + a proving test)

| Law (directive) | Where it holds | Proof (test) |
| --- | --- | --- |
| runtime verifies; owner signing out-of-band + locally custodied | door never signs; `ownerCustody` existence-only (no `readFileSync`) | custody boundary tests; `approveDoorGrantsAuthority()===false` |
| no key/signature/phrase in Git/logs/receipts/Convex | receipts carry only reason CLASS + 12-char hash prefixes; bond/projection sanitizers; public scanner clean | flood + refusal receipts; `validateBond`/`rejectForbiddenProjection`; scan PASS |
| fresh hybrid verification + consume-once are load-bearing | `monitor.decide()` (kernel `decide`) is the ONLY consuming step | full-ceremony authorize; replay refused; restart replay refused |
| Fu / AURA / health / Convex / supervisor / UI never authorize | none consulted on the authority path; bond A_t depends ONLY on a real verifier | `legalAuthorityFromPromotion` null-verifier ⇒ 0; bond grants nothing |
| failed/abandoned ceremony ⇒ no effect + reason-classed receipt | every terminal (refuse + success) receipts; `bind:invalid-transition` receipts | every refusal asserts `receiptHash` present |
| ceremony cannot modify its own gate/sacred paths | `pathFence` self-protecting list extended to the 5 WAVE-2 membranes; checked first | self-protection test; `isSelfProtecting` for all 5 |
| ZERO effect before authorization | `monitor.decide` reached ONLY after every guard passes | every refusal asserts `monitor.consumed()` length 0 |

---

## 3 · Required adversarial matrix (all green)

| Case | Result |
| --- | --- |
| exact donor ceremony vectors | voice-challenge hash `85c6fb8e…` = `sha256(aumlok-voice-challenge\|cid\|4827\|3)`; phrase 4× 64-word list; position clamps 1..6 |
| forged Ed25519 half / forged ML-DSA-65 half | both `approve:monitor-refused:authority_invalid`, no consume |
| replay challenge | `already_used`; door replay ⇒ `approve:monitor-refused:replay` |
| stale / expired challenge | `expired`; swept from store |
| phrase mismatch | `phrase_mismatch`, challenge NOT consumed |
| wrong draft | binding mismatch refused by monitor, no consume |
| wrong root / wrong owner | `approve:monitor-refused:authority_root_unknown` |
| nonce unbound (valid sig, different nonce than the challenge) | `approve:nonce-unbound` |
| unarmed (no humanClearance) | `approve:monitor-refused:self_modify_requires_clearance` |
| interrupted ceremony restart | monitor rebuilt from persisted consumed ids ⇒ replayed authorization refused; guard-refusal restart still authorizes (nothing burned) |
| custody absent | `approve:custody:absent` before any monitor decision |
| browser/Convex tampering | cross-origin / DNS-rebind host / cross-site all gate-refused; tampered projection + forbidden bond field rejected |
| proposal flood | 50 wrong-phrase attempts consume nothing; live challenge survives; a correct phrase then authorizes |
| self-protection | candidate targeting `approveDoor.ts` refused; all 5 membranes self-protecting |
| zero effect before receipt/authorization | every refusal receipts AND `consumed()` stays empty; only the authorized path consumes |

**Suites:** `apps/seed` **255/255** (19 files; +23 WAVE-2) · kernel **19/19** · portable-boundary PASS · public-tree scan PASS (0 blocking) · typecheck 0.

---

## 4 · CHECK (opus-self-review)

The authority surface did not widen: the door adds membranes IN FRONT of the single existing effect authorization (`candidateReferenceMonitor.decide()`), and every one of them can only REFUSE — none can grant. The one behavioral change from the donor is the load-bearing one: the door does not sign and does not write the tree; it verifies a hybrid signature the owner produced out-of-band and, on success, authorizes the downstream isolated (terminal) candidate stage. Consume-once is proven durable across a simulated restart, and — the property that matters most for "zero effect before authorization" — every refusal path is proven to consume no authority, because `decide()` is reached only after the CSRF guard, the self-protection fence, the custody check, the single-use challenge, and the nonce binding all pass.

Two honest limitations, both deliberate and non-authority: (1) `ownerCustody` checks key PRESENCE through an injected probe (default node `statSync`) — it proves the existence-only law against a fake filesystem and never opens a key; a thin real-fs wrapper is a follow-up that keeps the law pure. (2) the doors are pure request handlers, not a bound Bun server this round — the CSRF/authority law is unit-tested in isolation exactly as the donor factored its guard out of `Bun.serve` for the same reason; wiring a loopback listener is a mechanical follow-up that adds no authority.

CODEX FUSION REQUEST: run PRE council over the WAVE-2 restoration plan above.
CODEX FUSION REQUEST: run POST council over this evidence document (digest recorded in the PR body + issue #22).
