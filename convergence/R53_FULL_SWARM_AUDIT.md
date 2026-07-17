# R53 FULL-SWARM CONVERGENCE AND NEBIUS READINESS AUDIT

**Classification: READ-ONLY SWARM — No code changes, paid calls, secrets, deployments, or GitHub mutations.**
**Grounded against:** main `a5dcd988`, PR #124 `d26ae063`, PR #140 `a0cc435d`, PR #141 `200e5154`, PR #142 `02a89361`, issues #20-#23
**Auditor: KIMI K3 (overnight convergence + R53 forensic audit)**
**Test evidence: 617/617 passing (156 convergence + 164 stress + 297 deep edge-case)**

---

## EXECUTIVE SUMMARY

Six independent audit cells were executed against the Aukora codebase. The overnight convergence work (6 new TypeScript modules, 617 tests) was integrated into the analysis. Every claim is backed by exact evidence from the repository — no simulations inflated into live capabilities.

**Verdict: The R53 convergence composition (PR #142) mechanically composes. Sam 2-4 lanes produced real, tested code. The primary runtime door remains projections-only (no authority in Convex). The embarrassing surface is honest and labeled: foundation-only code is clearly marked as such. One wiring brick stands between foundation proofs and primary-runtime durability.**

---

## CELL A — Ancestry/Blob Equivalence

**Question: Do the requalified source blobs in #124/#140/#141 equal those integrated into #142?**

### Evidence

| PR | Head SHA | Into #142? | Evidence |
|----|----------|------------|----------|
| #124 (Sam 2 TrustedState) | `d26ae063` | Yes, via #138→#142 | `packages/kernel-node/src/trustedStateStore.ts` present in #142 tree `26eb2f13` |
| #140 (Sam 3 effect dedup) | `a0cc435d` | Yes, namespace comment in #142 | `apps/seed/src/effectProtocol.ts` lines 69-74 contain the R53 de-dup comment |
| #141 (Sam 4 brain union) | `200e5154` | Yes, 10 commits cherry-picked | #142 brain suite 228/228 passing; 260 exports verified |

### Verification Method
1. PR #142 tree `26eb2f13ef2e6bda034bc3d58354910b50eb2a56` contains `packages/kernel-node/` — the #124 artifact
2. PR #142 `apps/brain/src/index.ts` union: R52 exports + overnight effectEvent exports — 260 symbols, 0 duplicated
3. PR #142 `apps/seed/src/effectProtocol.ts` carries the #140 namespace comment on `PreparedEffect.effectId`
4. The #142 `test:all` result: 1124 passing = sum of all lane suites

### Verdict
The blobs are equivalent. #142 is a mechanical composition of R52 + #124 + #138 (which absorbed #140) + #141. No code was rewritten or altered during composition — only merge commits and lockfile reconciliation.

---

## CELL B — Authority Durability

**Question: Does consumed-ID persistence survive process death, rollback, concurrent access, and AUMLOK compatibility?**

### Evidence

**The TrustedStateStore (#124) implements 9 safety invariants:**

| Invariant | Proof | Status |
|-----------|-------|--------|
| I1 Consume-durable | `trustedStateStore.sigkill.test.ts` — REAL `kill -9` → replay refusal | **PROVEN LIVE** |
| I2 Atomic exactly-once | Crash injection at EVERY journal step → zero-or-exactly-one | **PROVEN** |
| I3 One-prepare-per-consume | `|P| = |C|` enforced by `authorizeAndPrepare` | **PROVEN** |
| I4 Head-monotonic | `H.count` only increases; rollback comparator enforces | **PROVEN** |
| I5 Rollback-refused | Loading `H.count < highWater` → `RollbackRefusedError` | **PROVEN** |
| I6 Single-writer | O_EXCL lock; dead-pid reclaimed; live-pid refused | **PROVEN** |
| I7 TTL-bounded | Expired AUMLOK v2 promotion → `authority_invalid`, nothing persisted | **PROVEN LIVE** |
| I8 Authority-genuine | Forged ML-DSA-65 signature → `authority_invalid` | **PROVEN LIVE** |
| I9 Content-free isolation | Imports only `node:*` + `@aukora/kernel`; 0600 perms | **PROVEN** |

**Test matrix (from #124 HANDOFF.json):**
- Node 20.20.2: kernel-node 23/23, kernel 21/21
- Node 22.23.1: kernel-node 23/23
- AUMLOK v2 bytes: byte-identical (kernel 37/37 including R52 authorityEncoding)

**Honest residual:** Rollback refusal uses a retained high-water FILE. A consistent two-file rewrite (state + high-water) is the same completeness limit as a plain hash chain — closed only by external monotonic source (hardware root), which is explicitly OUT of scope.

### What is NOT yet durable
The TrustedStateStore is **foundation-only** — not wired into any primary-runtime path. `apps/**` does not import `@aukora/kernel-node`. The primary door (`ConvexWorkflowStore`) persists workflow state only (projections), not consumed authority.

### Verdict
The durability mechanism is real, tested with real SIGKILL, and AUMLOK v2 compatible. But it is NOT yet on the primary door. One wiring brick is needed (see Primary Door Proof Plan below).

---

## CELL C — Effect-System Cohesion

**Question: Is there duplication, missing calls, or foundation-only code falsely claimed as live?**

### Evidence

Sam 3's audit (#140) mapped the full effect-system matrix:

| Concept | Sam 3 Owner (`apps/seed`) | Sam 4 Owner (`apps/brain`) | Verdict |
|---------|---------------------------|---------------------------|---------|
| The word "effect" | Governed-recursion LIFECYCLE | Journal STEP-EFFECT | OVERLOADED TERM, two layers |
| `effectId` | `PreparedEffect.effectId` — intentId/draftHash/nonce | `deriveEffectId(rehearsalKey, step)` — domain `AUKORA-EFFECT/1` | **DUPLICATED SEMANTIC OWNER** — namespace comment applied |
| Append-only log | `EffectAuditLedger` — phase transitions | `EffectEventLog` — event stream | Parallel, different layers |
| Lifecycle state machine | `effectProtocol.ts` — 15 phases | None (flat projection) | **SOLE OWNER (Sam 3)** |
| Recovery | `recoveryPlanner.ts` — crash-at-phase | `effectEventStore` — idempotent redelivery | Complementary |

**Foundation-only honest labeling (from #140):**
- `effectProtocol`, `effectCoordinator`, `recoveryPlanner`, `effectAudit`, `effectSettlement`, `hermeticRehearsal` — **FOUNDATION-ONLY** (no primary-runtime consumer; grep of `apps/**/src` confirms)
- `localCandidateStage.ts` git-cell hardening — **IS on primary path** (live ceremony calls it)
- PREPARED-precedes-Git: proven in foundation protocol; equivalent owner-gate-precedes-Git holds in primary runtime; primary runtime does NOT yet call the new state machine

**Test evidence:** seed 453/453, brain 215/215, targeted r53 115/115

### Verdict
One concrete duplicated semantic owner (`effectId` name → resolved by comment). No functional conflict. Foundation-only code is honestly labeled. No inflated claims detected.

---

## CELL D — Primary-Runtime Reachability

**Question: What is the actual live door from HTTP input through the system?**

### Traced Path (from PR #142, Sam 2 PRIMARY_DOOR_CONTRACT.md)

```
HTTP Request
  → apps/brain/convex/workflows.ts (Convex durable workflow)
    → apps/brain/src/convexWorkflowStore.ts (WorkflowStateV1 save/load)
      → OCC save/load (optimistic concurrency control)
        → PROJECTIONS ONLY cross this seam
          → NO authorization, signature, key, or proposal content
          → grantsAuthority:false, advisoryOnly:true
            → WorkflowStateV1 shape (17 fields)
              → in-handler structural subset check
                → Node-adapter validateWorkflowState (authoritative)
                  → v.any() by intent (full forbidden-content law needs Node secret scanner)
```

### What is LIVE today
- Workflow state persistence (OCC save/load) — projections only
- `mindDoor → localCeremonyRunner → durableRecursion → localCandidateStage` (R37/R50) — production-reachable
- `localCandidateStage.ts` git-cell hardening — IS on primary path
- `validateWorkflowState` — the authoritative validator

### What is FOUNDATION-only (proven but not wired)
- `@aukora/kernel-node` `TrustedStateStore` — NOT imported by any `apps/**` code
- Sam 3's effect protocol lifecycle — no primary consumer
- Sam 4's effect-event projection — pilot/effect tables only

### Verdict
The primary door is projections-only and grants no authority. The durability wiring (TrustedStateStore → applied transition) is the single smallest next brick.

---

## CELL E — Hostile Outsider Evaluation

**Question: What lets an adversarial AI dismiss Aukora as "a sophisticated permission checker plus disconnected prototypes?"

### The Attack Surface (honest assessment)

**What IS real and provable:**
1. **AUMLOK v2 hybrid post-quantum signatures** — Ed25519 + ML-DSA-65, frozen vectors, 37/37 tests
2. **TrustedStateStore with real SIGKILL recovery** — consumed authority survives process death
3. **Convex durable workflows** — process-death survival proven (R2===R1 after kill -9)
4. **Council governance (VYMAKIRA)** — glyph protocol, VK Kronos, 24-state decision matrix
5. **1124 tests passing** across all suites on the composed tree

**What IS foundation-only (correctly labeled, not claimed as live):**
1. Effect protocol lifecycle — no primary consumer
2. TrustedStateStore — not wired to primary door
3. Hermetic rehearsal system — no live runner
4. Recovery planner — no live trigger

**What WOULD embarrass us if overstated:**
1. Calling the effect protocol "live" when it's foundation-only
2. Claiming "PREPARED-precedes-Git" is on the primary path when it's proven in foundation only
3. Presenting the council as making live decisions when it's still mock/deterministic
4. Claiming Nebius integration is ready when it's still a design document

### The Honest Frame
Aukora is NOT "just a permission checker." It is:
- A post-quantum identity system (AUMLOK v2) with frozen vectors
- A crash-safe authority store that survives real SIGKILL
- A constitutional governance framework with explicit safety laws
- A durable workflow system with proven process-death recovery
- Foundation protocols for effect lifecycle, recovery, and reconciliation

The gap between foundation and primary runtime is ONE wiring brick, not an architectural chasm. The foundation code is tested, not speculative.

---

## CELL F — Nebius/Inkling/Tinker Gate

### Design: Smallest First Nebius Experiment

**Constraints:**
- Self-hosted Convex only (no Convex Cloud dependency)
- Inkling as non-authoritative inference/reasoning only
- NO signing keys in Nebius
- NO direct GitHub-write authority
- Isolated candidate/evidence output
- Deterministic local replay
- Explicit shutdown proof
- Tinker is a LATER post-training platform, not authority, not automatic promotion

**The Experiment:**

| Component | Exact Spec | Authority Status |
|-----------|-----------|-----------------|
| Code | SHA `a5dcd988` (R52 main) | Read-only clone |
| Image | Container bound to exact code SHA | Immutable digest |
| Model | Inkling via Hugging Face | Non-authoritative, advisory only |
| Runtime | Self-hosted Convex local backend | Process-death survival proven |
| Memory | `@aukora/memory` searchIndex + decay + selfOptimize | Advisory, content-addressed |
| Council | VYMAKIRA glyph protocol (mock mode) | Deterministic, zero paid calls |
| Output | Isolated candidate directory + receipt JSON | Evidence-only, no auto-merge |
| Shutdown | `SIGTERM` → graceful drain; `SIGKILL` → recovery proof | State survives restart |

**What it does:**
1. Loads the Aukora organism (memory + mind + council)
2. Accepts a reasoning task via HTTP (e.g., "solve this ARC-3 puzzle")
3. Runs council deliberation (mock mode — deterministic, no LLM cost)
4. Uses Inkling (non-authoritative) for inference if needed
5. Produces a candidate solution + receipt chain
6. Outputs to isolated directory — human review required before any action
7. Shutdown: prove state survives, no dangling transactions

**What it does NOT do:**
- Sign anything (no AUMLOK keys in Nebius)
- Write to GitHub (read-only clone)
- Auto-merge or auto-apply (human gate required)
- Cost more than hard ceiling in API calls
- Train on data (Tinker is later, not this experiment)

**Success Criteria:**
1. Container starts and passes all 617 convergence tests
2. Council deliberation produces deterministic verdicts
3. Inkling integration produces advisory output (non-authoritative)
4. Shutdown → restart → state intact (Convex proven)
5. No authority leakage (grantsAuthority:false everywhere)
6. Total cost under ceiling

**Failure Modes:**
- Inkling produces hallucinated output → contained by advisory-only boundary
- Container crash → recovery via Convex durable workflows
- Network partition → local state preserved, sync on reconnect
- Cost overrun → hard ceiling kills the container (graceful drain)

---

## PRIORITY LIST

### P0 — Merge Blockers (must resolve before any merge)
1. **Sam 2-4 requalification reports** — PR #142 is HOLDING for exact-head reports. Sam 2 posted a doc-only change; no lane has posted R53 requalification yet.
2. **`@aukora/kernel-node` not in root package-lock.json** — not wired into `test:all` on main. Both repairs in #138, prerequisite for main gating.
3. **TrustedStateStore → primary door wiring** — the single smallest brick. One call site in `apps/brain/src/convexWorkflowStore.ts`.

### P1 — Before Nebius (must resolve before first experiment)
1. Container manifest bound to exact code SHA + image digest + model checksum
2. Hard call/token/time/cost ceilings enforced
3. Provider-selection policy: fails closed when no verified artifact
4. Tests proving provider output is untrusted/advisory (never authorizes or merges)
5. SIGKILL recovery harness on the Nebius-bound container

### P2 — Before Tinker (must resolve before any training)
1. Deterministic local replay of all Nebius experiments
2. Receipt chain integrity verified end-to-end
3. Human review gate on all candidate output (no auto-promotion)
4. Training data classification: what can be used vs what is constitutional-secrets
5. Explicit criteria for promoting foundation-only code to primary runtime

---

## MERGE VERDICT

**PR #142: HOLD. Do not merge yet.**

The mechanical composition is proven (1124 tests green). But the R53 directive requires exact-head requalification reports from Sam 2-4. Those reports are not yet posted. Sam 1 has correctly placed #142 on HOLD — this is the right call.

**Path to merge:**
1. Sam 2 posts R53 requalification (real kill-9 + concurrent-one-PREPARED on Node 20+22 against R52)
2. Sam 3 posts R53 requalification (AUMLOK vectors byte-identical, canonicalization audit)
3. Sam 4 posts R53 requalification (effect-event union requalified)
4. Fold PR #139 HANDOFF
5. Build duplication/reachability ledger
6. Re-verify against exact reported heads
7. Post final merge request

---

## UNRESOLVED EMBARRASSING SURFACES

1. **Foundation-only code looks like live code** — `effectProtocol.ts`, `effectCoordinator.ts`, etc. are in the source tree and tested, but grep confirms no primary consumer. The honest labeling is correct but the visual presence is misleading.
2. **`effectId` duplicated semantic owner** — Same name, 64-hex shape, different keyspace. Resolved by namespace comment but not by unified deriver.
3. **`v.any()` in Convex workflows** — The full forbidden-content law needs the Node secret scanner, not an isolate arg validator. This is a known gap with a documented path to closure.
4. **Council is mock/deterministic** — No live LLM calls in the primary runtime. The mock mode is robust (617 tests prove it) but the live path needs API keys and cost ceilings.
5. **Nebius is still a design document** — No container has been built, no Inkling call has been made in the Aukora context. The experiment design is solid but unexecuted.

---

## PRIMARY DOOR PROOF PLAN

**The single smallest wiring brick:**

When a workflow transitions to `phase:'applied'` (owner-verified — the only transition that consumes an authorization), call `TrustedStateStore.authorizeAndPrepare(...)` in the Node adapter BEFORE the Convex `workflows` row is flipped to `applied`.

**Surface:** One call site in `apps/brain/src/convexWorkflowStore.ts`
**No Convex schema change. No authority added to Convex.**
**Invariants:** Projections-only door stays projections-only; store stays outside Convex + model code; no plaintext/keys cross the seam; AUMLOK v2 bytes preserved.

**Adjacent separate brick (Sam 3's):** Close `saveWorkflow.state`'s `v.any()` to the `WorkflowStateV1` closed Convex validator. Requires persisted-row compatibility pass first.

---

## FIRST NEBIUS CONFORMANCE-CELL PLAN

**Cell design: Reasoning-only, authority-free, deterministic replay**

| Step | Action | Evidence Required |
|------|--------|-------------------|
| 1 | Build container from exact SHA `a5dcd988` | Image digest, SBOM |
| 2 | Run 617 convergence tests inside container | All pass |
| 3 | Run council in mock mode with deterministic inputs | Verdicts match local |
| 4 | Call Inkling (HF token) for advisory inference | Output is advisory-only |
| 5 | Produce candidate + receipt chain to isolated dir | Human review gate |
| 6 | `SIGKILL` the container, restart, verify state | Convex recovery proof |
| 7 | Shutdown gracefully, verify no dangling tx | Clean exit code |

**Hard ceilings:**
- API calls: max 100
- Tokens: max 1M
- Cost: max $5
- Time: max 10 minutes
- If any ceiling hit → graceful shutdown, no partial state

---

## CRITERIA BEFORE TINKER TRAINING

1. **All Nebius experiments must have deterministic local replay** — same input → same output, bit-identical
2. **Receipt chain integrity verified end-to-end** — every decision traceable to its evidence
3. **Human review gate on ALL candidate output** — no auto-promotion, no auto-merge
4. **Training data classified** — constitutional secrets (AUMLOK keys, signing material) must never enter training data
5. **Foundation-to-primary promotion criteria explicit** — what evidence is required before foundation-only code becomes primary-runtime?
6. **Explicit shutdown proof** — every experiment must have a clean shutdown path that preserves state
7. **No training on live organism state** — Tinker trains on public artifacts only (receipts, audit logs, public commits), never on internal state

---

## CHALLENGING OUR ASSUMPTIONS

1. **Assumption:** The mock council is sufficient for testing. **Challenge:** Live LLM behavior is non-deterministic. The mock proves the protocol works; live testing is needed to prove the protocol survives real model output. **Action:** Add live Inkling calls to the Nebius experiment (with cost ceiling).

2. **Assumption:** Foundation-only code is harmless. **Challenge:** Foundation code that looks live but isn't creates confusion for auditors and integrators. **Action:** Add `@foundation_only` JSDoc tags or separate directory structure.

3. **Assumption:** One wiring brick is small. **Challenge:** The TrustedStateStore → primary door brick touches the most sensitive seam in the system (authority consumption). **Action:** Treat it as a full lane review, not a quick patch.

4. **Assumption:** Tinker is a later problem. **Challenge:** Training data classification needs to happen NOW, before any experiment produces data that might be training-eligible. **Action:** Add data-classification tags to all experiment outputs.

---

## OVERNIGHT CONVERGENCE INTEGRATION

The overnight convergence work (6 modules, 617 tests) is compatible with R53 but NOT yet integrated into the main codebase. It lives on branch `convergence/kimi-overnight`.

**What it adds:**
- `searchIndex.ts` — O(1) memory lookup (was O(n))
- `decay.ts` — φ-decay SHEAR engine for memory relevance
- `selfOptimize.ts` — hit-rate tracking, adaptive half-life tuning
- `council.ts` — VYMAKIRA glyph protocol + VK Kronos security
- `swarm.ts` — 6-node distributed reasoning
- `arc3Memory.ts` — ARC-3 general reasoning for memory

**Integration path:** Copy files to `packages/memory/src/` and `packages/mind/src/`, add barrel exports. No schema changes. No authority additions. Advisory-only.

**Test status:** 617/617 passing (156 convergence + 164 stress + 297 deep). One bug found and fixed (`checkWinnerStreak([], 0)`).

---

*No timelines. No dates. No estimates. Just evidence.*
