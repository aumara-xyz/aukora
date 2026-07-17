<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# R48 — Inkling cell: bounded-input / receipted-output contract

The cell (an Inkling-NVFP4 vLLM server on a private Nebius topology) is **isolated by construction**. This
file is the data contract a bring-up MUST honor; the manifest's `inkling.isolation` block pins the same laws.

## Input — a BOUNDED READ-ONLY snapshot ONLY
- A single tarball/dir of repo-context text at an exact commit, **read-only**, size-capped, secret-scrubbed
  before it ever reaches the cell (reuse the donor `#44` repo fence: no `.env`/`.git`/`.pem`/`.key`/secrets/
  `.venv`/`node_modules`; no traversal). The snapshot digest is recorded.
- **Never** provided to the cell: AUMLOK phrase/key material, owner credentials, `.env`, live GitHub tokens.

## Output — a RECEIPTED candidate/evidence directory ONLY
```
evidence/<runId>/
  run.manifest.json     # the frozen serving manifest (digests pinned) + snapshot digest + hardware fingerprint
  health.json           # /health + /v1/models probe, timestamps
  throughput.json       # tokens/s, VRAM high-water, batch — sanitized numbers only
  adversarial.json      # per-case verdicts from the bounded reader (this repo's test harness contract)
  candidates/*.diff     # generated changes emerge ONLY as PR candidates (outputContract: pr-only)
  receipts.jsonl        # content-free, hash-chained: {at, kind, sha256, verdict, grantsAuthority:false}
```
- Outputs are **candidates**, never applied: no direct `main`, no GitHub write from the cell, no autonomous
  merge. The owner path (fresh AUMLOK, terminal) is the only thing that can promote a candidate.
- **No public unauthenticated endpoint.** The vLLM server binds a private/loopback address inside the
  topology; access is via the bounded harness, not an open port.

## Proof obligations (each writes to `evidence/<runId>/`)
health · one code/repo-context test · one image/audio test *if the checkpoint supports it* · adversarial
malformed-output handling (the harness in `test/inkling-adversarial-output.test.ts`, already green locally) ·
throughput/VRAM · restart survivability · clean bounded shutdown. **None of these can be truthfully filled
without a real launch** — see the bring-up README's BLOCKED section.
