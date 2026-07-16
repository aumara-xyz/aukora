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
- `apps/seed` tests: 54 passed / 5 files (`npm test --workspace @aukora/seed`).
- Repo `npm run test:all` (CI equivalent): PASS on this branch.
- Secret self-scan of `apps/seed/src/*.ts` with `@aukora/evidence` `scanForSecrets`: 0 findings.
  (Test files carry deliberate, well-known example vectors — e.g. `AKIAIOSFODNN7EXAMPLE` — as fixtures only.)

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

CODEX FUSION REQUEST: run PRE council over the R29 plan-of-record above.
CODEX FUSION REQUEST: run POST council over this evidence document (digest recorded in the PR body / handoff).
