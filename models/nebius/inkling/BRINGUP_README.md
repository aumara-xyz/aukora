<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# R48 — Inkling-NVFP4 on Nebius: bring-up recipe (PREPARED, not launched)

**Status this round: PARKED.** No Nebius launch, no GPU provision, no quota inspection, no paid call, no
credentials. Everything below is the reusable recipe + the pin checklist; the runtime proofs are BLOCKED
(this lane holds no Nebius account access and never spends). This matches the whole repo's Nebius posture
(`models/nebius/README.md`: PARKED until real digests are pinned) and is enforced by `validateNebiusManifest`.

## What IS delivered and verified this round (no cloud)
- `inkling-nvfp4.serving.manifest.json` — schema `aukora-nebius-runtime-v1`, **conforms to
  `validateNebiusManifest` (0 violations)**; `enabled:false`, `outputContract:pr-only`, `grantsAuthority:false`,
  `credentials:env`. Pinned-slots (revision, image digest, package pins, launch args, hardware fingerprint,
  hashes) are explicit `REQUIRED_AT_PIN` — **no hashes are invented**.
- `SNAPSHOT_AND_EVIDENCE_CONTRACT.md` — bounded read-only input, receipted candidate/evidence output.
- `test/inkling-adversarial-output.test.ts` — the bounded output reader + **9 green adversarial cases**
  (truncated/non-JSON/empty/over-ceiling/length-finish/authority-claim/transport-error, plus content-free
  receipts) run against a local OpenAI-compatible mock. The reader moves to the real vLLM endpoint unchanged.

## The recipe a bring-up executes (fill the pins, then flip enabled)
1. **Pin the model:** official Thinking Machines Inkling checkpoint (NVFP4), exact `revision` commit; record
   `modelChecksumSha256`.
2. **Pin serving:** official vLLM NVFP4 recipe — container image `@sha256`, `vllmVersion`, exact package
   lock; copy `launchArgs` verbatim from the official recipe (do not improvise quantization/TP/len flags).
3. **Pick hardware:** a private B200/GB200-compatible topology the recipe supports; record the hardware
   fingerprint (GPU model/count, driver, CUDA, NVFP4 capability).
4. **Fill the three digests** (`imageSha256`, `codeSha256`, `modelChecksumSha256`) with real 64-hex; only
   then may `enabled` become `true` — `validateNebiusManifest` refuses an enabled manifest otherwise.
5. **Run the proofs** into `evidence/<runId>/` per the contract; the adversarial harness is already the
   acceptance test for output handling.

## BLOCKED (requires what this lane must not/ cannot do)
- **Nebius account/quota inspection** — needs Peter's Nebius credentials; this lane has none and does not
  seek them.
- **GPU provision + serving launch** — B200/GB200 instances cost money; autonomous cloud spend is out of
  bounds for this lane.
- **Runtime proofs** (health, throughput/VRAM, image/audio test, restart, clean shutdown) — cannot be
  truthfully produced without a launch; fabricating them is forbidden (same rule the directive sets for
  Tinker: "do not invent a successful run"). The harness proves the *handling*; the *numbers* await a real cell.

## Tinker (separate, as instructed)
First-experiment **contract + access path** may be validated on paper; **no training run is claimed or
invented**. Not exercised this round.
