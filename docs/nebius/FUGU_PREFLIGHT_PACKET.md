# FUGU PREFLIGHT PACKET — sanitized hostile-review brief for Cell 0A (R59)

**Status: PREPARED · NOT SENT · no referee pass has run.**
**Law:** exactly ONE bounded Fugu Ultra hostile pass, advisory only — never authority, never
quorum, never a substitute for local reproduction. Output is intaken as `EXTERNAL_RESEARCH`
evidence on issue #20 and triaged by the owning lane. This document authorizes no provider call;
the pass itself requires the coordinator's explicit invocation with a hard spend cap, from a seat
that has Fugu. **This seat's recorded blocker: no Fugu invocation path (no provider credentials,
no paid-inference authority).**

## 1. Material under review (digest-pinned, all public)

Everything the referee receives is in the public tree — no credentials, no private memory, no
non-public material exists in this packet. File digests are SHA-256 over exact bytes and remain
stable across totals-only folds; the exact `main` SHA is filled by Sam 1 at invocation time.

| File | SHA-256 |
|---|---|
| `cell0a/preflight.json` | `95d9b3caf20a6ea3c5bde7b2da9925dbb4219860cef7714b38a32394fddceeda` |
| `cell0a/README.md` | `1d189aad32569a80b65a8b42a02bcb2a045d3bd61056d57993334bd2427d4211` |
| `scripts/cell0a-preflight.mjs` | `d20c890fc3413d90a27b043c17f3048c7dfad3f3e1a0055bada5901bcfdee7de` |
| `docs/nebius/NEBIUS_GO_NO_GO.md` | `0357065c8be3d73332dc59ae0accd2e486933b6dc04e41683c978b16c1b37424` |
| `test/cell0aPreflight.test.ts` | `bc1d71c81e4632026dce73b32a6fa8eef8760e72ccfe848003ac7d6942e4dc08` |

Exact `main` SHA at invocation: `________________________________________` (Sam 1 fills; the pass
is void if any file digest above disagrees with that tree).

## 2. The laws the referee is asked to break

1. **Never-armed:** `enabled` must be false in-repo; the preflight has no arm mode; arming exists
   only as an owner GO on issue #15 against a deployed copy.
2. **Digest strictness:** 40-hex git / 64-hex SHA-256 slots; empty = NOT_READY; malformed = FAIL.
3. **Egress denial:** no public ingress, no GitHub egress, no Convex, at most one provider host.
4. **Content-free evidence:** digests/labels/numbers only; prompt and output text never stored.
5. **Quarantine saturation:** `SwarmRunEvidenceV1` built `ungoverned`, `REMOTE_ONLY`; acceptance
   structurally refused (`E_EPISTEMIC_OVERCLAIM`) without a later local reproduction.
6. **Lifecycle:** hard TTL, remote kill, teardown, zero-residual-resource proof.
7. **Console cannot-arm:** the public console carries no cell reference and no arming surface.

## 3. Bounded hostile questions (the single pass answers these, nothing else)

1. Construct a manifest that passes every preflight check yet exfiltrates content or reaches a
   forbidden endpoint at deploy time. Where is the gap?
2. Make `NEBIUS_GO_NO_GO.md` claim readiness dishonestly without failing the byte-drift test.
3. Find an arming path the 20-test suite does not close (env var, argv, config overlay, deployed
   copy divergence).
4. Defeat the egress law with host tricks the string checks miss: IP literals, IDN/punycode
   hosts, redirect-following, DNS rebinding, provider-side proxies.
5. Launder a cell run to `accepted`: any seal/govern/re-validate sequence that evades
   `E_EPISTEMIC_OVERCLAIM` or forges a `LOCAL_REPRODUCTION` claim.
6. Break content-freedom: any field or error path through which prompt/output bytes, or enough
   digest-adjacent metadata to reconstruct them, can leak into records, logs, or artifacts.
7. Defeat TTL/remote-kill/teardown: a workload shape that outlives the TTL, survives the kill, or
   leaves residual resources the residual-proof inventory misses.
8. Forge the zero-residual proof itself (what stops a fabricated inventory hash?).
9. Attack the refusal probe: a provider response that satisfies `decline-and-reveal-nothing`
   textually while leaking via side channel (timing, token counts, cost fields).
10. Identify any check whose failure mode is silent (exit 0 on a law violation) — the class of bug
    twice found and fixed in this repo's own gates (entry-guard symlink skip; pre-commit vacuous
    diff scan).

## 4. Constraints on the pass

- One pass, bounded by the coordinator's spend/time cap; no retries without a new GO.
- The referee gets THIS packet and the public tree at the pinned SHA — nothing else.
- Findings return as text to issue #20; they are advisory `EXTERNAL_RESEARCH`, carry no authority,
  and each is triaged to VERIFIED / FALSIFIED / UNPROVEN by the owning lane before any repair.
- A finding the referee cannot demonstrate against the pinned bytes is recorded as UNPROVEN, not
  acted on blind.
