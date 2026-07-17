# R46 — SAM 3 Constitutional-Core Capability Audit (evidence-only)

**Lane:** SAM 3 · independent, evidence-only. **Base main:** `f6130296`.
**Scope:** AUMLOK authority · AURA identity/evidence · Fu advisory law · governed recursion / candidate staging ·
ceremony / custody · receipts · restart semantics. Every capability is bound to executable evidence and marked
**PROVEN** (a green test asserts it), **PRESENT-BUT-UNTRACKED** (code exists; no direct test), or **MISSING/UNPROVEN**.
No production edits. Machine evidence: `docs/continuity/r46/machine-evidence.json`.
**Suites at this base (env cleared of `AUKORA_*`, serialized):** seed 287/287 · council 65/65 · council-node 5/5 · kernel 19/19.

A different conclusion is invited wherever the runtime evidence supports it; the calls below are what the tests
actually prove today, not what the prose claims.

---

## 0 · The AURA alarm — `apps/spatial/assets/aura-birth.js` (handled precisely)

- **What it is / provenance:** a 294-line THREE.js point-field renderer, an **exact donor blob** (provenance.json:
  donorBlob `846361…`, sha256 `2c3bfc92…`, status **VERBATIM**). **Do NOT re-port** — it is already byte-identical.
- **What it proves at source level:** a *deterministic, phrase-blind, public-genesis-seeded VISUAL echo* of identity.
  Its own header (lines 12–16) is the ruling: **"the public key + signed receipt chain are the identity … this figure
  is a deterministic VISUAL ECHO only — it never signs, never proves a person, and is not a machine-readable
  identifier."** So at source it proves the **display layer** exists and is byte-deterministic per seed; it proves
  **nothing** at the authority layer, and correctly claims nothing.
- **Reachable / wired:** **YES** — `apps/spatial/app/aura.js:21` imports `mountAuraBirth`; `:115-116` mounts it when a
  genesis ref is present (`mode:'base'`).
- **Tested:** **NO behavioral test** — no `aura-birth` unit test; `apps/spatial/test/transplant.test.mjs` does not
  touch it. Its guarantee is **provenance (VERBATIM + sha256)**, not a vector. This is *present-but-untracked* at the
  behavioral level, and that is acceptable for a WebGL visual whose only contract is determinism + display-only.
- **Narrower semantics genuinely missing/unproven** (the real gap the alarm points at):
  1. **Fu glyph fields as an AURA display** — the council's real `shearMagnitude` / `phaseLockStatus` / `coherence`
     (`packages/council/src/aukoraFuGlyph.ts`) are computed **engine-side** and are **NOT surfaced** into any AURA
     display; the seed `geometry.ts` `coherence` is a *separate* decided-verdict scalar, not the glyph field.
     → **PRESENT-BUT-UNTRACKED** as a display layer; **correctly absent** as an authority input.
  2. **Witnessed-receipt / drand / vouch display layers** — exist only as *forensics docs*
     (`apps/spatial/docs/forensics/R42_CONTINUITY_WITNESS.md`, `R44_LIVEWIRE_WITNESS.md`, `r42-witness-atlas.jsonl`);
     there is **no wired drand/vouch/witnessed-receipt display module** in `apps/seed`. → **MISSING** as a seed
     display layer; **correctly never** an authority input.

  **AURA verdict:** identity is the **public key + signed receipt chain**; `aura-birth.js` is an honest display echo,
  wired but behaviorally untracked. Zero authority predicate reads any AURA value (grep-confirmed over `apps/seed/src`;
  `geometry.ts` `GEOMETRY_ONLY`/`grantsAuthority:false`, `auraTrace.ts` `TRACE_ONLY` with "no read path … into the
  recursion decision"). **AURA remains evidence/display only — no authority.**

---

## 1 · Capability → evidence matrix

| Capability / law | Status | Executable evidence |
|---|---|---|
| **AUMLOK hybrid verify (Ed25519 + ML-DSA-65), both halves load-bearing** | PROVEN | `recursion.negative.test.ts` (forged Ed25519 refused; forged ML-DSA refused); `packages/kernel` verifyAumlokPromotionV2 suite |
| **Draft/intent/root binding (a sig for one target/draft can't authorize another)** | PROVEN | `recursion.negative.test.ts` (CONTENT mismatch refused; untrusted-signer refused) |
| **Consume-once + replay refusal (durable across restart)** | PROVEN | `r41.ceremony.test.ts:372` (monitor rebuilt from persisted consumed ids refuses replay); `r35.durable.test.ts` |
| **Kernel `decide()` is the ONE authorization for the effect** | PROVEN | `r39.security.test.ts` (candidate reference monitor; armed→allowed, unarmed→clearance, replay→replay) |
| **Owner signs out-of-band; runtime never signs; custody existence-only** | PROVEN | `r41.ceremony.test.ts` (custody-absent refused; ownerFixture is the only signer); `ownerCustody.ts` reads no key bytes |
| **Ceremony: challenge single-use/short-TTL, nonce-bound, tamper-refused** | PROVEN | `r41.ceremony.test.ts` (verify-consumes-once; proposal flood never burns authority; nonce-unbound refused; tampered gateArgsHash refused) |
| **Fu advisory-only; a GREEN verdict is not permission; grantsAuthority:false** | PROVEN | `aukoraFuCouncil.ts:723/728` (advisory:true, councilGrantsAuthority()===false); `r42.fu-realfixtures.test.ts` (real replies → advisory-hold on unmet quorum) |
| **Fu glyph shear/coherence/phase-lock geometry** | PRESENT-BUT-UNTRACKED (engine-side; not a display, not an authority) | `aukoraFuGlyph.test.ts`, `aukoraFuCouncil.test.ts` prove the math; no seed display surfaces it |
| **Governed recursion: shape/secret/authority-shape/staleness/bytes gates** | PROVEN | `recursion.negative.test.ts` (22 tests: refused-secret, refused-authority-shaped, refused-shape, hard-stop-patch-bytes, stale) |
| **Candidate staging isolated (disposable worktree; live tree byte-identical)** | PROVEN | `r36.candidate-fu.test.ts` (HEAD/main/tree unchanged; no remote); `r43.candidate-integrity.test.ts` |
| **Candidate-write integrity: no-follow symlink deny + exact staging** | PROVEN | `r43.candidate-integrity.test.ts` (6: leaf/nested symlink, out-of-root, staged-set) |
| **Self-protecting fence (table-independent) over the authority surface** | PROVEN | `r39.security.test.ts` + `pathFence.ts` frozen SELF_PROTECTING incl. WAVE 2 door/custody/bond |
| **AURA trace: TRACE_ONLY, content-free, erasure-honest** | PROVEN | `auraTrace.test.ts` (13) |
| **AURA geometry: GEOMETRY_ONLY, display-only, feedsApply:false** | PROVEN | `ceremony.test.ts` (geometry smuggling refused); `geometry.ts` sanitizer |
| **AURA birth visual echo (identity display)** | PRESENT-BUT-UNTRACKED | VERBATIM donor blob + sha256 (provenance.json); wired in `aura.js`; no behavioral test |
| **Witnessed-receipt / drand / vouch display** | MISSING (as a seed display layer) | forensics docs only; no wired module in `apps/seed` |
| **Receipts: content-free chain, receipt-before-effect, chain-verify** | PROVEN | `r36.candidate-fu.test.ts` (attempt receipt before effect; chain verify); `r35.durable.test.ts` |
| **Restart semantics: applied-exactly-once; never auto-resume an effect** | PROVEN | `r35.durable.test.ts` (crash between apply/save reconciles once; restart materializes nothing unless asked) |

---

## 2 · Findings (what is genuinely missing or unproven)

1. **Fu glyph field is not surfaced as an AURA display** (PRESENT-BUT-UNTRACKED). The shear/coherence/phase-lock
   geometry is proven mathematically engine-side but has **no display bridge** into AURA. A future round could add a
   *display-only* bridge (zero authority predicates, `feedsApply:false`) — this is the sharpest AURA continuity gap.
2. **Witnessed-receipt / drand / vouch display layers are MISSING** in the seed (docs only). If wanted, they must
   land as display/evidence surfaces only — never as an authorization input.
3. **`aura-birth.js` has no behavioral test** (provenance-guaranteed only). Acceptable for a deterministic WebGL
   visual, but a tiny determinism vector (same seed ⇒ same settled buffer) would convert it PROVEN — a Spatial-lane
   task, not mine, and NOT a re-port.

## 3 · Conclusion

The constitutional core (AUMLOK hybrid authority, the single kernel `decide()` monitor, out-of-band custody, governed
recursion, isolated + integrity-checked candidate staging, content-free receipts, applied-exactly-once restart, Fu
advisory-only, AURA trace + geometry display-only) is **PROVEN by green executable evidence** at `f6130296`. The AURA
alarm resolves cleanly: `aura-birth.js` is an honest, wired, display-only VISUAL echo (do not re-port); the genuine
gaps are the **un-surfaced Fu glyph display** and the **absent witnessed-receipt/drand/vouch display layers** — both
display/evidence concerns, both correctly outside every authority predicate today.
