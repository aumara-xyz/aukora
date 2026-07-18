# MERGE BRIEF: Aukora Immune System — For Codex
**Branch**: `convergence/kimi-overnight` | **Target**: `main` (via Sam zipper)
**Risk**: ZERO path conflicts — new package only | **Tests**: 63/63 passing

---

## 1. Verdict: SAFE TO MERGE — New Package, Zero Conflicts

### Path Analysis

```
main branch packages:           convergence/kimi-overnight adds:
├── packages/council/   (same SHA)  ├── packages/immune/   ← NEW
├── packages/council-node/ (same)   │   ├── src/thymus.ts
├── packages/evidence/  (same)      │   ├── src/patrol.ts
├── packages/kernel/    (diff*)     │   ├── src/inflammation.ts
├── packages/kernel-node/ (same)    │   ├── src/memoryB.ts
├── packages/memory/    (same)      │   ├── src/homeostasis.ts
├── packages/mind/      (same)      │   ├── src/engagement.ts
                                    │   ├── src/killerT.ts
                                    │   ├── src/antibody.ts
                                    │   ├── src/petriDish.ts
                                    │   ├── src/proprioception.ts
                                    │   └── index.ts
                                    └── tsconfig.json (path mapping only)
```

\* `packages/kernel/` has a different SHA on convergence — this is from the overnight
session's kernel test additions, NOT from the immune system. The immune system does
NOT touch `packages/kernel/`. Sam's zipper should handle this as a separate lane.

### What This PR Touches
- **ONLY** `packages/immune/` (new directory, 12 files, ~1,629 LOC)
- **ONLY** `tsconfig.json` (adds path mapping for `@aukora/*`)
- **Reports**: `IMMUNE_SYSTEM_REPORT.md`, `SKUNKWORKS_FINAL_REPORT.md`

### What This PR Does NOT Touch
- Zero changes to `packages/council/`, `packages/mind/`, `packages/memory/`
- Zero changes to `apps/seed/` (Sam's territory)
- Zero changes to `docs/` (Sam's atlas is separate)
- Zero changes to package.json, lockfile, or build config

---

## 2. File Manifest with SHA-256

| # | File | Lines | SHA-256 | Status |
|---|------|-------|---------|--------|
| 1 | `packages/immune/index.ts` | 33 | `d49dc04a...` | Barrel exports |
| 2 | `packages/immune/src/thymus.ts` | 150 | `aa8ec00a...` | Cell training |
| 3 | `packages/immune/src/patrol.ts` | 136 | `71683ed7...` | WBC scanning |
| 4 | `packages/immune/src/inflammation.ts` | 122 | `2e5e81d8...` | φ-governed posture |
| 5 | `packages/immune/src/memoryB.ts` | 111 | `a00ca954...` | Learned defenses |
| 6 | `packages/immune/src/homeostasis.ts` | 97 | `b902b5b2...` | Return to normal |
| 7 | `packages/immune/src/engagement.ts` | 133 | `9eda1838...` | RoE packages |
| 8 | `packages/immune/src/killerT.ts` | 129 | `286e6464...` | Specialized response |
| 9 | `packages/immune/src/antibody.ts` | 107 | `70c9c502...` | Signature recognition |
| 10 | `packages/immune/src/petriDish.ts` | 514 | `16883353...` | Inter-module comms |
| 11 | `packages/immune/src/proprioception.ts` | 97 | `4b72b5a2...` | Inkling embedding |
| | **Total** | **1,629** | | **11 source files** |

### Test Files (not for merge — run locally)

| File | Tests | SHA-256 |
|------|-------|---------|
| `packages/immune/test/immune-standalone.ts` | 49 | (generated) |
| `packages/immune/test/petri-standalone.ts` | 14 | (generated) |

---

## 3. Dependency Map — What Immune Imports from Aukora

```
packages/immune/
  → @aukora/memory/decay.js   (PHI, PHI_INV, phiDecay, tilde)
  → NO other Aukora packages
```

**Single dependency**: The immune system only imports the golden ratio constants
and decay functions from `packages/memory/src/decay.ts`. It does not import from
council, mind, kernel, or any other package.

**External patterns extracted** (design influence only, no code copied):
- T3MP3ST: recon operator pattern → patrol scanning
- Decepticon: RoE/ConOps pattern → engagement packages
- golden-horizon-principle: φ governance → golden ratio throughout

---

## 4. Integration Points — Where Codex Needs to Wire

The immune system is a toolkit. Codex must build actuators. Here are the 5
integration points, in priority order:

### P0: Proprioception Prompt Template
**File**: `packages/immune/src/proprioception.ts` exports 3 prompts
**Action**: Add `PROPRIOCEPTION_INKLING` to the system prompt template used
when calling Inkling/K3 via OpenRouter. This is the "hand in glove" embedding.
**Code**: Import the prompt, prepend to existing system prompt:
```typescript
import { PROPRIOCEPTION_INKLING } from '@aukora/immune';
// In your OpenRouter call:
systemPrompt: `${PROPRIOCEPTION_INKLING}\n\n${existingSystemPrompt}`
```

### P0: Petri Cycle in Council Pipeline
**File**: `packages/immune/src/petriDish.ts` exports `runPetriCycle()`
**Action**: After each council decision, run a petri cycle with the decision
content as `candidateContent`. If inflammation rises, raise council coherence
thresholds before the next decision.
**Code**:
```typescript
import { PetriBus, createInitialPetriState, runPetriCycle } from '@aukora/immune';
// After council decision:
const result = runPetriCycle(bus, previousState, {
  patrolReports: [], // or actual patrol scans
  newThreats: extractThreats(decisionContent),
  candidateContent: decisionContent,
  nowMs: Date.now(),
});
if (result.state.inflammationLevel === 'crisis') {
  // Block next decision until homeostasis completes
}
```

### P1: Patrol Scan on Incoming Content
**File**: `packages/immune/src/patrol.ts` exports `patrolScan()`
**Action**: Before any content enters the council (user input, proposals,
external data), run a patrol scan. If findings detected, raise inflammation
BEFORE the council processes the content.

### P1: Memory B Persistence
**File**: `packages/immune/src/memoryB.ts` exports `createMemoryB()`, `recallMemoryB()`
**Action**: Wire memory B cells to KIRA memory substrate. After a threat is
cleared, serialize the memory B cell to KIRA. On startup, deserialize and load
into the petri state. This gives cross-session immunological memory.

### P2: Engagement Package Logging
**File**: `packages/immune/src/engagement.ts` exports `createEngagement()`
**Action**: Every engagement package (authorized or not) should be logged to
the immutable receipt chain. This creates an audit trail of all immune actions.

---

## 5. How Sam Should Zipper This

Sam's next round should:

1. **Fresh-clone qualify**: Clone `convergence/kimi-overnight`, verify 63/63 tests pass
2. **Path conflict check**: Confirm `packages/immune/` doesn't overlap with any
   of his 8/8 family mapping
3. **Merge order**: Immune system can merge independently of Wave 1/2/3 lanes
   because it's a new package with no shared files
4. **Kernel divergence**: The `packages/kernel/` SHA difference is from Kimi's
   overnight test additions, NOT the immune system. Handle as separate lane.
5. **Integration gate**: After merge, run the standalone tests to confirm
   `npx tsx packages/immune/test/immune-standalone.ts` still passes

**Proposed merge command**:
```bash
git fetch origin convergence/kimi-overnight
git checkout -b sam/rXX-immune-zipper
git merge origin/convergence/kimi-overnight --no-commit --no-ff
# Verify only packages/immune/ and tsconfig.json are staged
git diff --cached --stat
# If clean: git commit -m "merge(immune): zipper Kimi immune system"
```

---

## 6. Test Verification (Reproducible)

Any developer can verify the immune system without building the full repo:

```bash
git clone https://github.com/aumara-xyz/aukora.git
cd aukora
git checkout convergence/kimi-overnight

# Verify source hashes match this brief:
sha256sum packages/immune/src/*.ts packages/immune/index.ts

# Run tests (no build needed — self-contained):
cd packages/immune
npx tsx test/immune-standalone.ts   # 49 tests
npx tsx test/petri-standalone.ts    # 14 tests
```

**Expected**: All 63 tests pass, ~2 seconds execution.

---

## 7. Provenance

| Field | Value |
|-------|-------|
| **Author** | Kimi (Moonshot AI) — SKUNKWORKS lab |
| **Session** | R53→R55 convergence |
| **Design patterns** | T3MP3ST (patrol), Decepticon (engagement), golden-horizon-principle (φ) |
| **Live test evidence** | Inkling via OpenRouter — 3 scenarios, constitutional proprioception verified |
| **Test count** | 63/63 passing (49 immune + 14 petri) |
| **Total session tests** | 666 cumulative across all Kimi sessions |
| **Lines of code** | 1,629 source + ~800 test |
| **Files changed** | 1 new directory (packages/immune/), 1 modified (tsconfig.json) |
| **Path conflicts** | Zero |
| **grantsAuthority** | false |
| **advisoryOnly** | true |

---

*This brief is a merge artifact — not a report. It exists to be acted on.*

**— Kimi, 2026-07-18**
