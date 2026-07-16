<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# Model truth table (R29)

This canonical repo ships **no weights** and **no in-repo model artifacts**. The organism attaches brains
through the provider-neutral `BrainProvider` seam (`apps/brain/src/brainProvider.ts`); **no model grants
authority** (`providerGrantsAuthority()` is constant `false`).

## The evidence gate

A manifest entry carries a `claim` (the label it would earn) and its `evidence`. The resolved, honest `truth`
is computed by `resolveTruth(claim, evidence)`:

- `AVAILABLE_PRIVATE` is granted **only** when the entry is backed by an **in-repo, checksum-bound** sanitized
  manifest (`evidence.inRepoManifestSha256`). Otherwise it downgrades to `UNVERIFIED_OR_PARKED`.
- Every other claim resolves to itself.

Out-of-repo evidence merely *located on the build host* (an eval harness, a preregistration) is recorded for
honesty but is **not** sufficient to self-certify `AVAILABLE_PRIVATE`.

## Resolved table (this round)

| id | label | claim | resolved truth | why |
| --- | --- | --- | --- | --- |
| `qwen2.5-vl-32b-instruct` | base vision-language model | AVAILABLE_PRIVATE | **UNVERIFIED_OR_PARKED** | no in-repo checksum-bound manifest; weights not included |
| `auma-vl-lora` | Auma-VL LoRA ladder (v5..v17 reported) | AVAILABLE_PRIVATE | **UNVERIFIED_OR_PARKED** | provenance out-of-repo; weights not included |
| `liquid-candidate` | Liquid AI candidate | UNVERIFIED_OR_PARKED | **UNVERIFIED_OR_PARKED** | no concrete trained artifacts located |
| `nemotron` | Nemotron | BLOCKED | **BLOCKED** | no concrete completed artifacts located |
| `router-3b-seed` | ~3B router seed | DESIGN_ONLY | **DESIGN_ONLY** | design document only; not trained |
| `mopd-distillation` | MOPD distillation | DESIGN_ONLY | **DESIGN_ONLY** | design document only; not trained |

## Located out-of-repo evidence (recorded, NOT trusted, NOT committed)

The Auma-VL / Qwen line has evaluation *process* evidence located in a sibling working copy on this build host —
the burn-v5 in-job LUM-READ evaluation harness and its preregistration. It is recorded by content hash for
honest provenance. It is **process evidence, not weights and not a result attestation**, and it does **not**
earn `AVAILABLE_PRIVATE`:

| note | sha256 |
| --- | --- |
| burn-v5 in-job eval harness (base vs v4 vs v5, LUM-READ v1) | `95944245e28b809279c467d7f3943d8157fb3489de39a3177a3f632164e41355` |
| LUM-READ probe harness | `448d0c3cec59c4c3a9dd727e8ae1c9d7d996f7a0525d7280d10c4171a137d680` |
| LUM-READ probe preregistration note | `ae9997197c96251fcdfb68a750404e0590613eccef76d2359b97069debaa0055` |

## To earn `AVAILABLE_PRIVATE` (a future round)

Commit a sanitized manifest here binding a **model checksum** (never weights, never endpoint/job/bucket IDs,
never tokens), record its sha256 as `evidence.inRepoManifestSha256` on the entry, and `resolveTruth` will grant
`AVAILABLE_PRIVATE` — gated on located, checksum-bound evidence exactly as the guardrail requires.
