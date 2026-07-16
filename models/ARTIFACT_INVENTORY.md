<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# Reachable model-artifact inventory (R30)

Inventory of model artifacts **actually reachable** from this build environment that are **checksum-bound**
(a verifiable weight/adapter/model file, not a report, design, or process artifact). Only such artifacts may
raise a provider's truth beyond parked, and only such artifacts let provider-selection choose anything other
than the deterministic offline provider.

## Result: 0 verified checksum-bound model artifacts reachable

A read-only scan of the build host found no reachable, complete, checksum-bound weight/adapter artifact for any
brain provider. Consequently:

- `selectBrainProvider` **fails closed** to the deterministic offline provider (`models/…` verified inventory is empty).
- Every model in `MODEL_MANIFEST` stays at its gated truth: Qwen2.5-VL-32B / Auma-VL LoRA `UNVERIFIED_OR_PARKED`,
  Liquid `UNVERIFIED_OR_PARKED`, Nemotron `BLOCKED`, router + MOPD `DESIGN_ONLY`.
- **No claim** is made for Liquid AI, Nemotron, LoRA v17, a ~3B router, or any distillation — none has
  checksum-bound evidence reachable here.

## What was found but does NOT qualify

| Found | Why it does not qualify |
| --- | --- |
| An **incomplete** (partial-download) `Meta-Llama-3-8B-Instruct.Q4_0.gguf` in a GPT4All cache on the build host | incomplete file, no verified checksum, and unrelated to any brain provider (not Auma-VL/Qwen/Nemotron/Liquid) |
| Out-of-repo burn-v5 / LUM-READ eval harness + preregistration (see `MODEL_TRUTH.md`) | process/eval evidence, **not weights** and not a checksum-bound model artifact; recorded by hash for provenance only |

## To add a verified artifact (a future round)

Commit a sanitized, checksum-bound manifest binding a model checksum (never weights, never endpoint/job/bucket
IDs, never tokens). Then it becomes a `VerifiedArtifact` the selection policy can consider, and — with a valid,
enabled, fully-bound Nebius runtime + transport + env credentials — `selectBrainProvider` may choose Nebius.
Until then, selection stays deterministic-offline and every label stays gated.
