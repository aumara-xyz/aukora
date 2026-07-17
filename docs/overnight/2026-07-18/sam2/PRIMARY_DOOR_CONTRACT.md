# Sam 2 — Primary-Door Integration Contract (R52 requalification round)

**Base:** public `main@a5dcd988df4f51a7a8eb857a2173bdd7bf481bc1` (R52 / PR #120 merged).
**Requalified head:** trusted-state brick `0524aec` merged onto R52. **Convergence-only** — no new feature, no
Convex file changed, AUMLOK v2 bytes preserved.

This is a **map + contract**, not an implementation. It states what already crosses the primary door, what is
still foundation-only, and the single smallest brick that would bring the primary door under the durable
trusted-state guarantee. **Do not implement the next brick in this round.**

---

## 1. What is LIVE on the primary door today

- **`apps/brain/convex/workflows.ts` + `apps/brain/src/convexWorkflowStore.ts`** — the primary door persists
  **workflow state only** (OCC save/load). Its own seam law: *"PROJECTIONS ONLY cross this seam — no
  authorization, signature, key, or proposal content."* It **grants no authority** (`grantsAuthority:false`,
  `advisoryOnly:true`).
- The `WorkflowStateV1` shape (17 fields) is enforced today by an **in-handler structural subset check** plus the
  Node-adapter **`validateWorkflowState`** (the authoritative source of truth). The Convex arg is `v.any()` by
  intent (the full forbidden-content law needs the Node secret scanner, not an isolate arg validator) — see Sam 3
  `docs/r52/SAM3_R52_ENCODING_AUDIT.md` §C, site 4.

## 2. What is FOUNDATION-only (proven, but not yet on the primary path)

- **`@aukora/kernel-node` `TrustedStateStore`** makes consumed authorization ids **and** the kernel receipt head
  survive real process death + refuse rollback. Requalified **green on R52** (kernel-node 23/23 on Node 20 + 22;
  real `kill -9` reuse-refusal, concurrent exactly-one-PREPARED, crash-before-rename usable-once, genuine AUMLOK v2
  consume, hostile-input fail-closed). These proofs run against the **pilot/effect tables + `convex-test`**.
- **It is not wired into any primary path yet** — nothing in `apps/**` imports `@aukora/kernel-node`. The primary
  door consumes **no** authority today, so there is nothing to make durable *there* yet; the durability matters at
  the point where the primary path **consumes an authorization** (the owner-verified `phase:'applied'`
  transition), which is currently proven on the pilot/effect tables, not the live `ConvexWorkflowStore`.

## 3. The single smallest next wiring brick (DO NOT implement this round)

**Route the primary door's one authority-consuming transition through the durable store.**

When a workflow transitions to `phase:'applied'` (owner-verified — the only transition that consumes an
authorization), call `TrustedStateStore.authorizeAndPrepare(...)` in the Node adapter **before** the Convex
`workflows` row is flipped to `applied`, so:

- the consumed authorization id + advanced receipt head are journalled crash-safely (`tmp → fsync → atomic-rename
  → dir-fsync → high-water`) **before** the row is written, and
- the Convex row becomes a **projection of an already-durable trusted-state consumption** (a crash between the two
  leaves the authorization consumed-once, never applied-twice).

**Surface:** one call site in `apps/brain/src/convexWorkflowStore.ts` (the apply path). **No Convex schema
change. No authority added to Convex.** Invariants that must hold: the door stays projections-only; the store
stays **outside** Convex + model code; no proposal plaintext/keys cross the seam; AUMLOK v2 bytes preserved.

### Adjacent, SEPARATE brick (Sam 3's, not this lane's durability wiring)
Close `saveWorkflow.state`'s `v.any()` to the `WorkflowStateV1` closed Convex validator (defense-in-depth). It is
distinct from the durability wiring above and **requires a persisted-row compatibility pass first** — every
existing durable `workflows` row must satisfy the new validator (no silent invalidation). Exact validator in
`SAM3_R52_ENCODING_AUDIT.md` §C.

---

## 4. Requalification result (R52)

| check | result |
|---|---|
| AUMLOK v2 frozen vectors byte-identical | ✅ kernel **37/37** (incl. R52 `authorityEncoding.test.ts` golden vectors) |
| kernel-node vs R52 kernel — Node 20.20.2 | ✅ **23/23** |
| kernel-node vs R52 kernel — Node 22.23.1 | ✅ **23/23** |
| R52 canonical guard changes trusted-state identity? | ❌ no — state hash stable across JSON round-trip (`86fed8a5…`) |
| R52 guard changes journal recovery? | ❌ no — `JSON.parse` cannot yield a sparse/named-property array (`[1,,3]`→`[1,null,3]`); the guard only rejects hostile non-JSON arrays (2/2 rejected) |
| trusted store isolation | ✅ imports only `node:fs`, `node:path`, `@aukora/kernel`; 0 Convex/model/memory/mind/network/key hits |
| dependency graph | `@aukora/kernel-node` → `@aukora/kernel` only; covered by the `packages/*` workspace glob |

**Required integration repair (Sam 1's surfaces, already in PR #138 — not on `main` yet):** `@aukora/kernel-node`
is **not** in the root `package-lock.json` and **not** wired into `test:all` on `main a5dcd988`. Both repairs
(lockfile reconciliation + `test:kernel-node` in `test:all`) live in #138 and are prerequisites for the brick to
be gated on main.
