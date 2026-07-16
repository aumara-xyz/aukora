# Issue preservation ledger

`docs/issue-preservation-ledger.json` is a machine-readable, cross-repository record of every
open and closed **issue** (pull requests excluded) in the source repositories, so nothing is
lost as capabilities are consolidated into Aukora.

**Status: BEGUN (first pass).** The two public source repos (`aukora-kernel`, `aukora-fu`) are
classified with a rationale and a confidence flag. The private `aukora-symbiote` repo is
**metadata-only** — number, state, and source URL are preserved; titles, labels, and bodies are
withheld (`PRIVATE_REDACTED`). No issue body is copied verbatim from any repo.

Classifications are a first pass and are **pending owner ratification**. Per-issue disposition of
private issues happens in a separate, owner-authorized private ledger — not in this public file.

## Classification taxonomy

| Label | Meaning |
| --- | --- |
| `IMPLEMENTED` | The capability is already implemented in this repository. |
| `PORT` | Slated to be built/ported into Aukora when earned. |
| `PRODUCT_STAYS` | Belongs to a product/UI surface that stays in its own app, not the core. |
| `RESEARCH_ONLY` | Stays as research/design; not slated for the core. |
| `QUARANTINE` | Blocked/parked; must not be built, deployed, armed, or spent against yet. |
| `DUPLICATE` | Duplicates another tracked issue. |
| `SUPERSEDED` | Overtaken by later work or a newer tracker. |
| `PRIVATE_REDACTED` | From a private repo; content withheld, metadata preserved. |

## Regenerating

Metadata is pulled with `gh api --paginate 'repos/<owner>/<repo>/issues?state=all'` (PRs filtered
out). The first-pass classification map lives with the release lane and is applied deterministically.
