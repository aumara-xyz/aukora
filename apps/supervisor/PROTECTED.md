<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# The protected class (WAVE 2 · donor #71 law)

`apps/supervisor/policy.json`, `src/engine.mjs`, `src/supervisor.mjs`, `src/gateway.mjs`, and
`src/verify-protected.mjs` are **the same protected class as gate/signer/receipt law**:

1. **Pinned:** `protected.sha256` carries a sha256 pin for each file. `npm run verify:protected`
   re-hashes; CI-side, `test/supervisor.test.mjs` re-verifies every pin on every run.
2. **Self-refusing:** the supervisor re-verifies the pins at boot **before any action** and exits
   with an `integrity-refused` receipt on drift — a tampered supervisor refuses to supervise.
3. **Proposal paths cannot edit it:** any change to these files must arrive as an ordinary
   owner-reviewed git change that ALSO updates `protected.sha256` in the same commit — a proposal
   that touches the files without the pin update fails the test gate; one that touches the pin file
   is visibly editing the protected class in review.
   *Cross-lane handoff:* when the seed's proposal validation grows a denied-path list (donor #71:
   "proposal touching supervisor path rejected at proposal validation"), `apps/supervisor/**` and
   `protected.sha256` belong on it. Until then the pin gate + owner review is the enforcement.
4. **Deterministic policy only:** the supervisor executes plans computed by the pure engine from the
   owner-ratified `policy.json` + live observation. The manifest is a **claim** — commands are pinned
   in the reviewed policy, never taken from runtime input; there is no path by which manifest content
   of unknown origin executes.
5. **Closed envelope:** `start · probe · stop · isolate · swap · contract · rollback · status`.
   The verbs sign/promote/widen-authority/change-kernel-law do not exist in the code (tested), the
   supervisor has **no network control surface** (owner CLI only, tested), contraction release
   requires an explicit owner invocation (silent release throws, tested), and the gateway **never
   fronts AUMLOK** (7094/7095 refused with a law note, tested).
