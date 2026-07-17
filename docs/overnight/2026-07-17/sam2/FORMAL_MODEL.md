<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# TrustedStateStore — formal state + invariant model (overnight, issue #21)

A small executable-checked model of the constitutional durable state that must survive real process death and
rollback. The store composes the kernel's PURE `decide()` (unchanged) with crash-safe filesystem persistence.

## State

`S = (roots, salama, C, H, P)` — the persisted record, where the first four are the kernel's own `TrustedStateV1`:
- `roots` — trusted AUMLOK v2 authority roots (hybrid Ed25519 + ML-DSA-65).
- `salama` — the pause flag `{active, reason}`.
- `C ⊆ Ident` — the set of CONSUMED authorization ids (`consumedIds`, kept sorted, unique).
- `H = (count, headHash)` — the receipt head (`count ∈ ℕ`, monotonic).
- `P` — the append-only list of PREPARED effect descriptors (store-local; content-free: hashes + path + class).

Genesis `S₀ = (roots₀, {active:false}, ∅, (0, null), [])`.
On-disk: `trusted-state.json` (the record, 0600) · `receipt-highwater.json` (max count ever committed, 0600) ·
`writer.lock` (single-writer O_EXCL, holds the writer pid).

## Transition — `authorizeAndPrepare(req, effect, now)`

1. `S ← load()` under the writer lock (see Load).
2. `d ← decide(req, S, policy, now)` — the REAL kernel reducer (verifies the AUMLOK v2 promotion, checks replay
   against `C`, enforces authorization TTL via `verifyAumlokPromotionV2`).
3. If `d.status ≠ allowed` → refuse; **persist nothing** (`S` unchanged on disk).
4. Else `S' = d.nextState` with `C' = C ∪ {req.consumptionId}`, `H'.count = H.count + 1`, and `P' = P ++ [prepared]`.
5. `commit(S')` atomically (see Commit) **before** any Git effect the caller performs. Return `prepared`.

## Load (with rollback refusal)

`load()` reads `trusted-state.json`, runs the kernel `assertTrustedState` (fail-closed: sorted `C`, coherent `H`,
canonical `roots`), and REFUSES if `H.count < highWater` (an older snapshot restored to un-consume authority).

## Commit (crash-safe, atomic)

`write(tmp) → fsync(tmp) → rename(tmp → state.json) → fsync(dir) → write(highWater)`. The `rename` is the atomic
durability point: a crash **before** it leaves `S` (nothing consumed); a crash **at/after** it leaves `S'`
(consumed exactly once). No torn intermediate is ever observable.

## Safety invariants → the test that proves each

| # | Invariant | Proof |
| --- | --- | --- |
| I1 | **Consume-durable**: a consumed id stays in `C` across restart (⇒ replay refusal) | `trustedStateStore.test.ts` durable-consume; **`trustedStateStore.sigkill.test.ts` REAL `kill -9` → replay** |
| I2 | **Atomic exactly-once**: a crash at ANY commit step ⇒ zero or exactly one prepare, never torn | `trustedStateStore.test.ts` crash-injection at every journal step; sigkill crash-before-rename |
| I3 | **One-prepare-per-consume**: `|P| = |C|` and each `p ∈ P` binds a consumed id; `H.count = |P|` | in-process invariant audit + real-decide count assertions |
| I4 | **Head-monotonic**: `H.count` only increases; `C` only grows | reopen monotonic test; rollback comparator |
| I5 | **Rollback-refused**: loading `H.count < highWater` refuses | `trustedStateStore.test.ts` rollback refusal |
| I6 | **Single-writer**: at most one live writer holds the lock; a dead-pid lock is reclaimed | in-process lock test; **concurrent OS processes → exactly one PREPARED** (sigkill file) |
| I7 | **TTL-bounded**: an expired authorization is refused, nothing persisted | `trustedStateStore.realDecide.test.ts` expired-TTL |
| I8 | **Authority-genuine**: only a valid hybrid AUMLOK v2 promotion consumes; a forged signature refuses | `trustedStateStore.realDecide.test.ts` forged-signature → `authority_invalid`, nothing persisted |
| I9 | **Content-free / isolation**: no plaintext/keys/signing/model/Convex state; store imports only `node:*` + `@aukora/kernel` | `realDecide.test.ts` structural import scan; 0600 perms test |

## Honest residual (in scope tonight)

Rollback refusal (I5) compares against a retained high-water FILE. A single restore of `trusted-state.json` alone
is refused. A CONSISTENT two-file rewrite (state + high-water together) is the same completeness limit a plain
hash chain has — closed only by an external monotonic source (a signed head / hardware root), which is explicitly
OUT of tonight's scope (no AUMLOK v3, hardware roots, or threshold keys).
