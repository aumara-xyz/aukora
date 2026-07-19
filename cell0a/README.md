# Cell 0A — deployable preflight packet (default disabled)

**Status: NOT ARMED · digest slots empty · no provider call has ever been made from this packet.**

This directory is the whole deployable unit for the Nebius **Cell 0A connectivity smoke**: one
inert synthetic prompt, one refusal probe, hard TTL, remote kill, teardown with a
zero-residual-resource proof, and content-free evidence only. It exists so the *shape* of the first
external call is reviewed, gated, and rehearsed long before any call happens.

- **Law lives in [`preflight.json`](preflight.json)** — versioned manifest with strict digest slots
  (40-hex git commit; 64-hex SHA-256 elsewhere), egress denial (no public ingress, no GitHub
  egress, no Convex), workload exclusions (no Git credentials, private memory, owner root, or
  AUMLOK key material), and the arming law: `enabled` is `false` in this repository forever; a GO
  operates on a deployed copy and is posted by the owner/coordinator on issue #15 with a hard
  cost/time cap.
- **Executable gate: [`scripts/cell0a-preflight.mjs`](../scripts/cell0a-preflight.mjs)** —
  fail-closed validation of every law above, an offline dry-run of the full evidence lifecycle
  (local stub, zero network), and the generator for
  [`docs/nebius/NEBIUS_GO_NO_GO.md`](../docs/nebius/NEBIUS_GO_NO_GO.md). It has **no arm mode**.
- **Tests: [`test/cell0aPreflight.test.ts`](../test/cell0aPreflight.test.ts)** — planted-failure
  vectors (malformed digests, enabled:true, forbidden egress, secret shapes, broken lifecycle),
  dry-run content-freedom, real `SwarmRunEvidenceV1` construction with the quarantine saturation
  law proven, GO/NO-GO drift guard, and the console cannot-arm proof.

Evidence law for any real run: envelopes are built `ungoverned`, carry `REMOTE_ONLY`, and saturate
at `quarantined` — a transport success never becomes acceptance without a local reproduction.
Cell 0B (organism readiness) is tracked separately in the GO/NO-GO artifact and is entirely out of
this packet's scope.
