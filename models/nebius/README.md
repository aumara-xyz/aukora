<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# Nebius brain — reproducible runtime, bounded & PARKED

`deployment.manifest.json` (schema `aukora-nebius-runtime-v1`) is the reproducible container/runtime manifest
the bounded adapter (`apps/brain/src/nebiusProvider.ts`) validates before it will do anything. This round it is
**PARKED** (`enabled: false`): no Nebius launch, no hardware provision, no paid call, no cloud mutation.

## Reproducibility bindings (all structural, all enforced in code)

| Field | Meaning | This round |
| --- | --- | --- |
| `imageSha256` | exact container image digest binding | `""` (unbound) |
| `codeSha256` | exact code / integrated-commit digest binding | `""` (unbound) |
| `modelChecksumSha256` | exact model checksum binding | `""` (unbound) |
| `runtime.entrypoint` | deterministic entrypoint | `aukora-brain-nebius` |
| `runtime.reproducible` | must be `true` | `true` |
| `runtime.networkPolicy` | `pinned-only` (network limited to pinned digests) or `none` | `pinned-only` |
| `outputContract` | generated changes emerge ONLY as PR candidates | `pr-only` |
| `ceilings.maxOutputTokens` / `maxWallClockMs` / `maxCostUsd` / `maxCallsPerSession` | hard ceilings | 512 / 60000 / 0.5 / 8 |
| `credentials` | must be `"env"` — never embedded | `"env"` |
| `enabled` | live-generation gate | `false` (PARKED) |
| `autonomousMerge` | structurally false — adapter never merges | `false` |
| `grantsAuthority` | structurally false — provider grants no authority | `false` |

`validateNebiusManifest` refuses:
- an `enabled: true` manifest unless all three digests are real 64-hex bindings (reproducible pin, no floating tag);
- any manifest whose `outputContract` is not `pr-only`, whose `runtime` is missing / not `reproducible`, whose
  `credentials` is not `env`, or whose `autonomousMerge` / `grantsAuthority` is not `false`.

An unbound (`""`) digest may only ship while PARKED.

## Go-live checklist (a FUTURE round, deliberately, never automatically)

1. Accept the integrated Git SHA; pin real `codeSha256`, `imageSha256`, `modelChecksumSha256` (64-hex each).
2. Inject a `NebiusTransport` (the HTTP client) and an env-backed `credentials()` source — this repo ships
   neither; the module holds no secret and no network client.
3. Set `enabled: true`.
4. Generated changes still return ONLY as `GitChangeCandidate` (branch / PR candidates) per `outputContract:
   pr-only`; no autonomous merge, no live authority. A human opens/reviews/merges.
