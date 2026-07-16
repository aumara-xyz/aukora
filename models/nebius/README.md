<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# Nebius brain deployment — bounded & PARKED

`deployment.manifest.json` is the single source of truth the bounded adapter
(`apps/brain/src/nebiusProvider.ts`) validates before it will do anything. This round it is **PARKED**
(`enabled: false`): no Nebius launch, no paid call, no cloud mutation.

## Fences (all structural, all enforced in code)

| Field | Meaning | This round |
| --- | --- | --- |
| `imageSha256` | exact container image digest binding | `""` (unbound) |
| `codeSha256` | exact code / commit digest binding | `""` (unbound) |
| `modelChecksumSha256` | exact model checksum binding | `""` (unbound) |
| `ceilings.maxOutputTokens` | hard generation ceiling | 512 |
| `ceilings.maxWallClockMs` | hard time ceiling | 60000 |
| `ceilings.maxCostUsd` | hard cost ceiling | 0.5 |
| `ceilings.maxCallsPerSession` | hard call-count ceiling | 8 |
| `credentials` | must be `"env"` — never embedded | `"env"` |
| `enabled` | live-generation gate | `false` (PARKED) |
| `autonomousMerge` | structurally false — adapter never merges | `false` |
| `grantsAuthority` | structurally false — provider grants no authority | `false` |

`validateNebiusManifest` refuses an `enabled: true` manifest unless all three digests are real 64-hex bindings,
and refuses any manifest whose `credentials` is not `env` or whose `autonomousMerge` / `grantsAuthority` is not
`false`. An unbound (`""`) digest may only ship while PARKED.

## Go-live checklist (a FUTURE round, deliberately, never automatically)

1. Pin real `imageSha256`, `codeSha256`, `modelChecksumSha256` (64-hex each).
2. Inject a `NebiusTransport` (the HTTP client) and an env-backed `credentials()` source — this repo ships
   neither; the module holds no secret and no network client.
3. Set `enabled: true`.
4. Generated changes still return ONLY as `GitChangeCandidate` (branch / PR candidates); no autonomous merge,
   no live authority. A human opens/reviews/merges.
