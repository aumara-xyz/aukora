# Stale public draft-PR audit + preservation Ring-1 decision (R51 / #106 req 11–12)

## Stale draft PRs — audited at head `5aae90d6`

Rule (req 11): **close only when absorption/supersession is proven, leaving an ancestry comment.** Each PR
below has its deliverable byte-present on `main` and exercised by `test:all`, so each is proven absorbed.

| PR | Head → base | Deliverable | Absorbed on `main` | Verdict |
|---|---|---|---|---|
| **#1** | `codex/clean-root-r26` → `main` | canonical core: `packages/{kernel,evidence,council,council-node}` | all four present + gated (`test:kernel`, council tests) | **CLOSE — absorbed** (main IS the clean root) |
| **#17** | `sam/r29-console` → `codex/brain-seed-r27` | `apps/console` read-only operator console | present + gated (console 44) | **CLOSE — absorbed & base superseded** |
| **#18** | `sam/r29-brain` → `codex/brain-seed-r27` | `packages/memory` + `apps/brain` | present + gated (memory 17, brain 171) | **CLOSE — absorbed & base superseded** |
| **#19** | `sam/r29-recursion` → `codex/brain-seed-r27` | `apps/seed` governed recursion | present + gated (seed 338) | **CLOSE — absorbed & base superseded** |

Ancestry: #1 is the R26 clean-root seed the canonical repo was built from; the current `main` is its
descendant. #17–#19 targeted the frozen R27 integration base `codex/brain-seed-r27` (@ `f71e562e`,
unmoved), which the canonical `main` line has superseded; their `apps/console` / `apps/brain` +
`packages/memory` / `apps/seed` content is content-merged and gated on `main`. Closing removes stale
public drafts while the ancestry comment on each preserves the lineage. Branches are **not** deleted.

## Preservation Ring-1 decision — ONE explicit owner-security decision (req 12)

Two things must **not** be conflated:

1. **SETTLED — the 169-item Symbiote ratification.** The owner has ratified that all 169 Symbiote
   historical issues are preserved in the sanitized ledger (this is done; see `verify-continuity`). This is
   an inventory-completeness fact, not an authority-ring change.

2. **STILL OPEN — the `preservation/** → Ring 1` policy.** Whether the `preservation/**` path is bound to
   authority **Ring 1** (the higher-custody ring in the kernel authority model) is a **single, explicit
   owner-security decision**. It governs who/what may write the private preservation surface, not whether
   the 169 entries are captured. It is the reason the **private preservation PR (in `aukora-symbiote`)
   remains RED** — and per this round it **must not be merged while red**. Resolving it is an owner action;
   this lane surfaces it, does not decide it, and publishes no private preservation content.

**Recommendation to the owner:** rule on `preservation/** → Ring 1` as one discrete security decision;
keep the private preservation PR unmerged until that ruling lands green. Nothing in this public PR depends
on the ruling — the public projection is already sanitized and gated.
