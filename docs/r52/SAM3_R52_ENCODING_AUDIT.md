<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# R52 · adversarial canonical-encoding audit + closed-schema map (issue #116, authority half)

Base: public main `5ae15481bf5676ede97aab28b5c16e189358472c`. Scope: `packages/kernel` (audit + pin + one safe
hardening) and a **map-only** contract for the four `apps/brain/convex` `v.any()` sites (Sam 2's lane — not
modified). No authority semantics changed. All evidence is executable in
`packages/kernel/test/authorityEncoding.test.ts`.

## A. Authority-adjacent `JSON.stringify` vs the canonical law — finding & decision

Three authority encoders in `packages/kernel/src/authority.ts` use direct `JSON.stringify`:

| site | function | what it encodes |
|---|---|---|
| `authority.ts:60` | `aumlokRootId` | `{suite, ed25519, mlDsa65}` → root id hash |
| `authority.ts:64` | `aumlokRootIntegrity` | 8 root fields → integrity hash |
| `authority.ts:77` | `canonicalAumlokPromotion` | the **signed authorization message** |

**Each builds an explicitly FIELD-PICKED object literal with a FIXED key order** and hashes/signs its
`JSON.stringify`. The closed input contract is enforced by `assertSignedPromotion` / `assertAuthorityRoot`
*before* any encode: every field is a fixed enum literal, a lowercase hex string `[0-9a-f]{64,}`, an
ISO-UTC-millis timestamp `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$`, or a nonce identifier
`^[a-z0-9][a-z0-9._:-]{0,127}$`. **No character in any of those sets is escaped by `JSON.stringify`** (no `"`,
`\`, control char, or non-ASCII can occur), and object shapes are exact (`exact()` rejects unknown keys).

### Verdict: merely duplication, NOT an ambiguity risk

For the closed contract the direct `JSON.stringify` is:
- **deterministic** — a fixed literal fixes key order regardless of the input's property order;
- **injective** — every string value is quote-wrapped and can contain no structural/escapable character, so
  field boundaries never blur (no two distinct authorizations collide);
- **input-attack-immune** — field-picking ignores extra keys and input key order by construction; a
  prototype-supplied field is not an own key and is refused by `exact()`.

Proven with concrete hostile vectors (property order, additional keys, Unicode/escaping, injectivity,
prototype-shaped, versioning) in the test suite.

### Decision: DO NOT converge onto `canonicalJson`. PIN instead.

`canonicalJson` **sorts** keys, so it emits *different bytes* for the same authorization. Converging the signed
message onto it would change every signature input and **silently invalidate all existing authority**. Concrete
counterexample, pinned:

- `canonicalAumlokPromotion(historicAuth)` → sha256 `ed7c1c73…058da29`; the frozen `hybrid-v1.json` ed25519 **and**
  ml-dsa-65 signatures **verify** over it (`verifyAumlokPromotionV2 → {valid:true}`).
- The same frozen ed25519 signature **fails** to verify over `canonicalBytes` (the key-sorted encoding of the
  identical 8 fields). ⇒ converging = a silent authority break.

This satisfies the directive: converge only when backward-compat + conformance prove it safe — here they prove the
**opposite**, so the sites are kept and pinned with golden + historic-fixture vectors so any future drift fails CI.
No change to `authority.ts`.

## B. `canonicalJson` hostile-input hardening (one real injectivity bug closed)

`assertCanonicalValue` (`packages/kernel/src/canonical.ts`) accepted two malformed array shapes that
`canonicalJson`/`canonicalHash` then encoded ambiguously:

- a **sparse** array (`[1, , 3]`) — holes are implicit `undefined`, skipped by `forEach`/`map`;
- an array with a **named own property** (`const a=[1]; a.foo='x'`) — silently dropped, so `[1]` and
  `[1]`-plus-hidden-`.foo` **collided** to the same canonical bytes (an injectivity break).

Fix (2 lines): a dense, index-only array's own keys are exactly the indices `0..length-1` plus `length`; any
other own-key count (a hole's absence, a named or symbol key) is rejected as `canonical_array_shape`. **Valid
dense arrays are unaffected**, so no existing canonical encoding changes — proven by the full kernel
compatibility manifest, SBOM, and the frozen conformance vectors all remaining byte-identical/green. This is a
pure hostile-input tightening, not a semantic change: only inputs that could never arise from a valid
JSON round-trip are now refused.

## C. The four Convex `v.any()` sites — map + migration contract (NOT modified)

All four live in `apps/brain/convex/**` (**Sam 2's lane**), and each already validates the value with an
authoritative check that is **not expressible as a Convex-isolate arg validator**, one hop deeper. Modifying
them would collide with Sam 2 and risk rejecting valid persisted rows written under the current contract, so per
the directive they are **mapped, with the exact contract, for the next brick — not changed here.**

| # | site | arg | authoritative validator (deeper) | why `v.any()` is the intentional boundary |
|---|---|---|---|---|
| 1 | `convex/ingest.ts:19` | `record` | `@aukora/evidence` secret scan (needs `node:crypto`) → `validateMemoryRecord` | the scan runs in the Node runtime (isolate lacks `node:crypto`); the record shape is enforced one hop deeper in `ingestValidated` |
| 2 | `convex/memory.ts:77` | `record` | `validateMemoryRecord(record)` (content-addressed; returns null→refused) | internal-only mutation; the content-address + forbidden-content law is not an isolate arg-shape |
| 3 | `convex/memory.ts:129` | `attestation` | `verifyEraseAttestation` (ML-DSA-65 signature verify) | the authoritative gate is a cryptographic verify, not a shape check |
| 4 | `convex/workflows.ts:55` | `state` | in-handler structural subset + `validateWorkflowState` in the Node adapter | the full exact-shape + forbidden-content law needs the Node secret scanner |

**Sites 1–3 are intentionally-opaque boundaries** (the real gate is a Node-runtime secret scan or a crypto
verify, which a Convex `v.object` cannot express). Recommendation: keep `v.any()`, and document the boundary
(this table) — a shape validator would be redundant belt-and-suspenders that must be kept in lockstep with the
deeper validator.

**Site 4 (`saveWorkflow.state`) has a fully known closed shape** (`WorkflowStateV1`, 17 fields). It is the one
site a closed Convex validator *could* replace `v.any()` — but only through Sam 2 with a persisted-row
compatibility pass, because rows already written under `v.any()` must all satisfy the new validator. Exact
migration contract for the next brick (apply with `validateWorkflowState` as the source of truth, verify against
every existing durable row first):

```ts
// convex/workflows.ts — proposed closed arg for saveWorkflow.state (MIGRATION CONTRACT, do not apply unilaterally)
state: v.object({
  schema: v.literal('aukora-recursion-workflow-v1'),
  workflowId: v.string(),        // ^[0-9a-f]{64}$ (checked in-handler)
  version: v.number(),           // safe int >= 1
  phase: v.union(v.literal('awaiting-owner'), v.literal('applied'), v.literal('refused'), v.literal('cancelled')),
  intentId: v.string(),          // 64-hex
  draftHash: v.string(),         // 64-hex
  nonce: v.string(),             // 1..128
  councilVerdict: v.union(v.literal('advisory-pass'), v.literal('advisory-hold'), v.null()),
  councilEvidenceDigest: v.union(v.string(), v.null()),   // 64-hex or null
  stage: v.string(),             // 1..64
  refusals: v.array(v.string()),
  receiptHash: v.union(v.string(), v.null()),             // 64-hex or null
  ownerVerified: v.boolean(),
  createdAtIso: v.string(),
  updatedAtIso: v.string(),
  advisoryOnly: v.literal(true),
  grantsAuthority: v.literal(false),
}),
```

Note: the in-handler structural check + the Node-adapter `validateWorkflowState` already enforce this contract
today, so closing the arg is defense-in-depth, not a new gate — and it must never be applied without first
proving every persisted `workflows` row validates (no silent invalidation).

## Acceptance mapping

- No authority semantics changed; the frozen hybrid + downgrade conformance vectors stay green (kernel 37/37).
- R50/R51 process-death + candidate proofs untouched (seed 338, brain 171, council 65, council-node 5 green).
- Convex remains state/evidence only and gains no authority (no Convex file changed).
- Full kernel gate (compatibility manifest, SBOM, runtimes, package) + public-tree scan pass.
