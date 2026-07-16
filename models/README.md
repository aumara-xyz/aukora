# models/

Provider-neutral brain attachment. `manifest.json` + `providers/` describe how real brains
attach **truthfully** — without bundling weights, endpoint IDs, job IDs, bucket IDs, or tokens.

Model truth labels: `IMPLEMENTED`, `AVAILABLE_PRIVATE`, `BLOCKED`, `DESIGN_ONLY`, `REJECTED`.
Sanitized manifests + checksums are published only when evidence exists. No paid inference.

- base Qwen2.5-VL-32B-Instruct + Auma-VL LoRA ladder — AVAILABLE_PRIVATE (weights private; v17
  evaluation gains require provenance verification before any published claim).
- Liquid AI candidate — REJECTED/parked (licensing concerns; not trained).
- Nemotron — BLOCKED (not trained).
- ~3B router seed / MOPD distillation — DESIGN_ONLY.

Status: **scaffold**. The `BrainProvider` contract (with a deterministic offline provider for
tests) is Worker Two's model lane. This README is the truth-labeled placeholder.
