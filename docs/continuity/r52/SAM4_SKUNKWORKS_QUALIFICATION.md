# SAM 4 · R52 #115 — independent qualification of the R51 external skunkworks record

**Verdict: EXTERNAL_SIMULATION · NOT_CANONICAL_RUNTIME · REPRODUCTION_PENDING** — upheld independently.

I reviewed the R51 external record (`docs/r51/EXTERNAL_SKUNKWORKS.md`) and issue #98 (`EXTERNAL_UNVERIFIED`)
and independently confirm its labels. I copied **no** external bytes: no `/mnt/agents/output/dojo` artifacts,
no credential material, no raw external harness. Those artifacts are **not available in this checkout** for
independent replay, and at least one raw harness carried an API credential — deliberately excluded from Git.

## What I did NOT propagate (and why)

None of these external figures/claims are asserted as Aukora fact anywhere in the public tree:

- **60.2% improvement / 86% recall** — index-entry growth (93→149) is not a quality metric; the supplied
  query summary was internally inconsistent about query count. No recall/accuracy percentage is claimed.
- **359,427 "autonomous organisms" / emergent traits** — that number is *simulated candidate records* inside
  an external harness; it is not evidence of autonomous organisms or emergent behaviour.
- **"mathematically unbreakable"** — a hardcoded `grantsAuthority:false` invariant was stress-tested, not
  proven unbreakable.
- **Fugu-as-Inkling** — Fugu Ultra is an *external* OpenRouter model (#98); Inkling (`thinkingmachines/Inkling-NVFP4`)
  is the *parked* Nebius manifest (`enabled:false`). They are different things; neither is deployed.

## Executable guard (new this round)

`apps/spatial/evaluator/no-overclaim.mjs` scans every tracked `*.md`/`*.json` and FAILS if any sensitive
phrase (86% recall · 60.2% · unbreakable · autonomous organism · 359,427 · Fugu-is-Inkling) appears **without**
a negation/qualification within ±3 lines. Current result: **142 docs scanned, 0 bare claims.** The guard is
falsification-tested (`checkText('Aukora is unbreakable.')` flags; a qualified line passes) in
`apps/spatial/test/r52.evaluator.test.mjs`. This makes the skunkworks qualification self-enforcing on every
future edit — a spectacle can no longer silently become a canonical claim.

## Admission law (unchanged, upheld)

External evidence may enter canonical Aukora only after: (1) secret/private-data scans pass; (2) source, model,
environment, seed, dependency versions pinned; (3) evidence bundle + verifier complete; (4) an independent run
reproduces the result at an exact main SHA; (5) claims distinguish observation / simulation / live-local / deployed;
(6) every model/cell stays `advisoryOnly:true`, `grantsAuthority:false`. None of (1)–(4) is satisfiable on this
node for the external skunkworks artifacts, so the record stays **EXTERNAL_SIMULATION / REPRODUCTION_PENDING**.

Contrast: THIS round's canonical-path evidence (`docs/continuity/r52/SAM4_CANONICAL_PATH_PROOF.md`) is the
opposite class — it runs **production adapters** in-repo, is self-verifying (`coreHash f55b065d…`), and its
LIVE_LOCAL Convex + real-process-death evidence is reproduced on this node via the canonical `canary:r51`.
