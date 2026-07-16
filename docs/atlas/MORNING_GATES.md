# Morning gates — lane PR fresh-clone verification (R42, refreshed at morning handoff)

Independent evidence (fresh clone → `npm ci` → `npm run test:all`), not CI badges. No code
modified; nothing merged. Heads are exact and CURRENT as of handoff — #63/#65 were re-gated after
their lanes pushed final docs commits post-3AM.

| PR | branch | current head | npm ci | test:all | notes |
| --- | --- | --- | --- | --- | --- |
| #63 (Sam 4 continuity witness, read-only) | `sam/r42-continuity-witness` | `bdf767fc0326963b4f01ccf75f74017dada289d2` | **0** | **0** | re-gated at handoff (post-3AM commits were docs: RESUME + ckpt5) |
| #64 (Sam 3 forensics + one bounded KEPT candidate) | `sam/r42-overnight-forensics` | `32a42833f70ba7c699f17d493910ea936d172043` | **0** | **0** | unchanged since 3AM gate |
| #65 (Sam 2 memory/identity atlas + scope-aware recall) | `sam/r42-memory-forensics` | `2f4f4841067c40e22ef92e586cc96e8e3e842e10` | **0** | **0** | re-gated at handoff (post-3AM commits were atlas appendices F–I) |

**Verdict:** all three meet the mechanical morning gates on their CURRENT heads. Suggested merge
order: **#62 (atlas) → #63 (witness) → #64 (verify the KEPT candidate's evidence before merge) →
#65 (reconcile its rows into the canonical atlas at merge).** Merge decisions are Codex/Peter's.
