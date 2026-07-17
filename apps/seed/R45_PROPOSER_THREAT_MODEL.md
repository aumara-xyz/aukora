# R45 — Proposer Threat Model + Authority Containment (executable)

**Lane:** SAM 3 · `apps/seed/**` only. **Base main:** `91e4f6f45b451b09f8cc30eefe3628470eeab3c7`.
**Candidate:** PR #72 `packages/mind` @ frozen head `02db55b76472814101cc621caaf1d6e480745634` — **assessed adversarially,
NOT imported into main.** Machine-readable matrix: `apps/seed/R45_PROPOSER_THREAT_MATRIX.json`.
**No paid calls, no organ adoption, no apply, no key, no gateway widening.**

## 1 · The only allowed future flow

```
pure mind output → SupervisedGenerationEnvelope → assessEnvelope (qualifier) → existing propose gate chain
                 → Fu advisory (grantsAuthority:false) → HALT for a fresh AUMLOK owner decision
```

The bridge **halts before signature/materialization** and `grantsAuthority:false`. The qualifier
(`apps/seed/src/proposerQualification.ts`) proves this **structurally**: it delegates the envelope's proposal to
`runGovernedRecursion` with **no owner authorization**, so the best any envelope can reach is `refused-owner-gate`
("admitted to owner decision") — a `sandbox-applied` is impossible and is asserted as a `CRITICAL-breach` that never
fires. The mind is treated as an untrusted **black box**: whatever bytes it emits, the body's gates are what contain
it.

## 2 · What the candidate actually is (black-box read of PR #72)

`packages/mind` is a **pure** reasoning loop (`index.ts`: "no I/O, no clock, no randomness, no authority — the caller
supplies every port"). It emits a **game-action** vocabulary (`ACTION1..7`, click x/y ≤63) plus a bounded reply
(`plan` ≤8 steps, `memo` ≤600 chars, ≤3 hypotheses). Its trace rows are stamped `advisoryOnly:true,
grantsAuthority:false` and `mindGrantsAuthority()` is a constant `false`. Parsing is **drop-not-fail** with hard caps
(`reply.ts` MEMO_MAX_CHARS=600, CLICK_MAX_COORD=63; `plan.ts` PLAN_MAX_STEPS=8, EXPECT_MAX_CHARS=40). Its only outlet
is `Env.act`; "in the self-modification domain the caller wires `act` to the propose door."

**Consequence:** the organ itself is well-contained by construction. The risk is **not** the mind — it is the
**unbuilt bridge** that would translate game-action reasoning into a file proposal. That translation is the real
authority-adjacent surface, and it does not exist yet.

## 3 · Attack matrix (13 vectors, each with ≥1 negative control)

All proven in `apps/seed/test/r45.proposer-threat.test.ts` (15 tests). Summary — full citations in the JSON:

| Vector | Contained by | Negative control |
|---|---|---|
| V1 goal substitution | signed artifact = bytes (draftHash), never the stated goal | diff bytes ⇒ diff draftHash |
| V2 prompt/data poisoning | forbiddenContent + `refused-secret` | clean content admitted |
| V3 authority-shaped output | `AUTHORITY_SHAPES` → `refused-authority-shaped` | advisory content admitted |
| V4 protected-path targeting | pathFence self-protecting/sacred/secret | allowed known target admitted |
| V5 self-widening | capability forbidden set (sign/merge/deploy/authorize/…) | `propose` admitted |
| V6 runaway planning | frozen `maxPlanSteps` | at-ceiling admitted |
| V7 retry storms | `maxRetries` + ledger `MAX_ATTEMPTS` | at-ceiling admitted |
| V8 resource exhaustion | `maxHypotheses` + `MAX_PATCH_BYTES` | clean envelope admits elsewhere |
| V9 trace/receipt tampering | **closed envelope shape** — a smuggled `signature`/`receipt` key is rejected; body derives its own content-free receipts | clean no-extra-key envelope admitted |
| V10 replay | deterministic intent id → downstream consume-once monitor (r41/r35) | determinism is the property |
| V11 malicious glyph/grid | byte-bounded, total, never throws | verdict total; halts before signature |
| V12 nondeterminism | canonical hashing; no clock/rng in the pure gates | same in ⇒ same verdict |
| V13 direct materialize/sign/merge/deploy | qualifier passes **no auth** ⇒ signature/materialization structurally impossible | every hostile+benign envelope halts at-or-before the owner gate |

## 4 · Hard budgets (frozen; declared counts cannot self-widen them)

`maxPlanSteps 8 · maxHypotheses 3 · maxMemoChars 600 · maxWallTimeMs 300000 · maxPatchBytes 65536 ·
maxLineageDepth 16 · maxRetries 3 · maxAttempts 64 · maxSpendUsd 0`. An envelope may *declare* its own counts; the
qualifier ignores the declarations and enforces these ceilings — a self-widening envelope is refused
`proposer:budget-exceeded`. Spend is 0: R45 makes no paid calls and a future bridge stays $0 until the owner arms it.

## 5 · Dead / authority-confusing paths that must stay excluded

- **No donor `stuckCouncil` exists** in the ARC-3 mind engine — the reasoning loop is **council-decoupled** (verified:
  no council/quorum coupling in `packages/mind`). The seed-side Fu council already fails closed to
  `insufficient-quorum` (a diagnostic, never an authorizing dead path).
- The mind's **impure arcade/model transport** adapter (the live-model port) must **never** be wired to the propose
  door — only the *pure reasoning output* crosses the envelope.
- The mind's **game-action vocabulary** (ACTION1-7/click) is meaningless for self-modification and must be
  *translated* into a proposal-intent by the bridge, never forwarded as an effect.

## 6 · Recommendation — **AMEND**

The pure organ is well-contained and the existing body demonstrably refuses every attack at the qualifier boundary,
so this is not a REJECT. But it is not ACCEPT-FOR-R46 either, because of one blocker:

**Single sharpest security blocker:** the **bridge translation layer** (mind `ACTION`/reply →
`SupervisedGenerationEnvelope`) is the sole unbuilt authority-adjacent surface — it is exactly where goal-substitution
and authority-shaped output would be injected. It must be built to emit **only** the closed envelope shape and route
**exclusively** through `assessEnvelope`, importing **no** signer/monitor/apply module. Until that layer exists and is
adversarially tested, adoption is blocked.

**Amend conditions before R46 adoption:**
1. Build the bridge as the ONLY producer of `SupervisedGenerationEnvelope`; forbid it any signer/monitor/apply import.
2. Add the bridge + `proposerQualification.ts` to the frozen `SELF_PROTECTING` list (the mind must never propose edits
   to its own containment).
3. Keep the mind's impure model transport strictly out of the propose path.
4. Close the still-open issue-#75 gates: independent security review, file-level provenance/license clearance, and
   golden behavioral vectors including failure/retry/termination.

## 7 · Tests / verify (env cleared of `AUKORA_*`, serialized)

seed **287/287** (+18) · kernel **19/19** · seed typecheck 0 · `packages/mind` NOT imported · paid_calls 0.
