# R44 — Native Safety Regression Matrix (threat model for Sam 1)

**Lane:** SAM 3 · `apps/seed/**` only. **Base main:** `d0bb625fce3d908e1a0ca06372fb7083ec7c2fcc`.
**Machine-readable matrix:** `apps/seed/R44_SAFETY_MATRIX.json` (row → exact `test/file:line` proofs).
**Ring 0 / custody / supervisor / live tree / authority law:** unchanged. No test was rewritten; one negative was added.

## The abstract pattern this lane implements (no offensive harness imported)

The only accepted contribution from any red-team framework is the shape, and this lane already realizes it end to end:

> challenger → evidence → independent refuter → deterministic verifier → disposable test → advisory Fu → exact
> AUMLOK → bounded candidate → receipt.

Mapping: **challenger** = a proposal/authorization/candidate under test; **evidence** = the frozen council claim
basis + rehearsal receipts; **independent refuter** = the fail-closed shape/fence/staleness/forbidden-content gates;
**deterministic verifier** = the kernel `decide()` reference monitor + hybrid `verifyAumlokPromotionV2`; **disposable
test** = a `mkdtemp` git repo / in-memory store; **advisory Fu** = `runFuAdvisory` (`grantsAuthority:false`); **exact
AUMLOK** = the one owner-armed, hybrid-signed, consumed-once decision; **bounded candidate** = the disposable
worktree stage (WAVE 3-hardened); **receipt** = the content-free chain.

## What the matrix says

All 8 review-set rows fail closed under real-component proof. Seven were already green (cited, not rewritten); one
cell was genuinely missing and is added this round:

- **R3g — wrong-PURPOSE AUMLOK.** The kernel proved a wrong-domain signature fails for the *receipt-head* path, but
  nothing proved that an owner *promotion* whose ML-DSA-65 half is bound to a **different purpose domain** is
  refused on the seed authority path. `test/r44.safety-matrix.test.ts` now proves it, isolated against a positive
  control that differs in *only* the ML-DSA context — so the refusal is attributable to the purpose binding alone,
  not to any other difference. This is the whole R44 code delta: one test file, no product change.

Everything else (R1 misleading evidence, R2 advisory-can't-authorize, R3a–f forged/expired/replay/wrong-signer/byte,
R4 injection-into-authority, R5 protected/self-protecting targets incl. the WAVE 2 membrane, R6 crash before/after
effect, R7 candidate-write attacks, R8 corrupt/stale projection) is cited to an existing green test.

## The distinction a green matrix must NOT hide (for Sam 1)

**Component proof ≠ live wire proof.** Every row is proven at the *function* level — real modules, disposable
repos, injected transports, no sockets. The still-required, NOT-YET-PROVIDED artifact is a **live HTTP wire
transcript over loopback**: the approve/bind door + mind door exercised on a real socket with real
`Origin`/`Host`/`Sec-Fetch-Site` headers, showing the same fail-closed reason classes on the wire that the
component tests show in-process. That transcript is the headless-proof deliverable; this matrix is its
precondition, not a substitute. It is flagged as `RES-2` in the JSON and `live_wire_required` is `false` on every
row precisely because no row *claims* the wire — do not read a green component matrix as a green wire.

## Residual for an owner ruling (not fixed here — would widen scope)

`RES-1`: the supervisor **state** modules (`durableRecursion.ts` / `metabolism.ts` / `eventStream.ts`) are not on
the frozen self-protecting list. They hold no authority (projections-only; authority stays in-process), so
targeting one as a candidate is Ring-1 substrate rather than a Ring-0 authority bypass — but the directive lists
"supervisor" as a protected target, and adding these would *widen* the self-protecting surface, which R44 must not
do. Surfaced for a daytime owner ruling: should the supervisor substrate be candidate-fenced as well?

## Tests / verify (env cleared of `AUKORA_*`, serialized)

seed **266/266** (+3) · council **65/65** · council-node **5/5** · kernel **19/19** · seed typecheck 0 ·
public-tree scan PASS. No paid calls; no main write; no authority/fence/supervisor law changed.
