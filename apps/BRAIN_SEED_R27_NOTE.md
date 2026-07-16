# R27 brain/recursion lane — technical note (Opus Nebius, Worker Two)

Local code only; no cloud, no paid calls, no live Fu, no G1, no live-repo mutation. Base: PR #1 head
`49fcb644`. Branch: `codex/brain-seed-r27`.

## What this lane added (turns the library set into a governed organism seed)

- **`packages/memory`** — pure KIRA law: content-addressed consent-scoped memory envelope, deterministic recall
  with governed forgetting at read time, harvested staleness law (from old PR #20), advisory-containment
  contract. No I/O, no clock, no randomness — passes the portable boundary. Reuses the kernel canonical hash
  (one hash implementation).
- **`apps/brain`** — the reactive, receipt-chained, GROWING memory adapter over `@aukora/memory` +
  `@aukora/kernel` (receipt chain + Merkle root reused, not cloned). Reactive snapshot recomputes on every
  ingest/forget. Governed forgetting = owner-authorized tombstone: content invisible to recall, content-free
  audit kept, chain never rewritten. Plus the provider-neutral `BrainProvider` (deterministic offline) + a
  truth-labeled `MODEL_MANIFEST` (no weights, no infra IDs).
- **`apps/seed`** — governed inward-out recursion: ground → stale/secret/authority refusal → advisory council
  review (deterministic, offline, authorizes nothing) → **AUMLOK owner-gate** (real Ed25519 signature; no model
  can sign for the owner) → sandbox-only apply (in-memory Map; never the disk) → receipt-chained memory. Every
  gate fail-closed.
- **`demo:organism`** — deterministic proof (green): ingest A → persist → verify receipt/Merkle → reactive
  snapshot → recall → ingest B → **memory grew** → propose self-change → **refused without owner signature**
  (advisory review ran, did not authorize) → owner-signed → **sandbox-only apply** → receipt → live repo
  untouched → **owner-authorized forget** (content gone, audit kept, chain still verifies).

## Convex honesty

`apps/brain/convex/{schema,memory}.ts` is the **curated persistence target** mirroring the same contracts,
driven under `convex-test` / live Convex. It is intentionally outside the app tsconfig (illustrative backend).
**The demo runs on the deterministic in-memory reactive adapter and makes NO live-cloud claim.** Standing up
`convex-test` end-to-end is the immediate next step; the contracts are identical, so it is a wiring task.

## Tests (this lane)

`@aukora/memory` 4 · `@aukora/brain` 4 · `@aukora/seed` (demo) 1 — all green; existing kernel 14 / evidence 64 /
council 61 unaffected. `authority_changed:false`, `cloud_changed:false`, `paid_calls:0`.

## Truth labels

Governed · growing · remembering are IMPLEMENTED (source + test + demo). "Self-replicating / alive / conscious"
are NOT claimed — replication is G1, which stays QUARANTINE/unarmed. Liquid/Nemotron = BLOCKED, router seed =
DESIGN_ONLY until artifacts prove otherwise.
