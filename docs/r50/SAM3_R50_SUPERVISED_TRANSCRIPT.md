# R50 — live supervised acceptance: real process death and production HTTP proof (Sam 3)

**What this is:** the sanitized transcript of the issue #99 / R50-directive acceptance run, executed
against the ACTUAL supervisor-started local stack (apps/supervisor `up` → convex-backend :3210 +
brain-door :7141 + mind-door :7097 + spatial-shell :7096) from worktree head `c3b67d0` on branch
`sam/r50-process-death`. The mind-door ran the R50 PRODUCTION composition: workflow store = LOCAL
self-hosted Convex through `ConvexWorkflowStore` (hydrate → ceremony → settle), loopback only.

**Directive step → evidence map**
1. tokened HTTP proposal → durable `awaiting-owner` — STEP 1/1b (row v2 IN Convex, `refused-owner-gate` retryable wait)
2. SIGKILL the mind-door PID — STEP 2 (real `kill -9` of the listener; port empty; fetch fails)
3. protected supervisor restarts that process — STEP 3 (`up` #2: probes everything else UP-OURS, starts ONLY mind-door; fresh per-boot token; protected.sha256 verified on every invocation)
4. byte-identical rehydration from local Convex — STEP 4 (row JSON identical before/after death; door-mediated re-propose resumes the SAME workflowId, no duplicate, no effect)
5. fresh test-owner AUMLOK authorization binds exact bytes + current HEAD — STEP 5 (byte-bound hybrid auth → `awaiting-explicit-materialize`) + STEP 6 (the 40-hex `headBefore` binding)
6. explicit materialization → exactly ONE isolated candidate worktree — STEP 6c/6d (worktree OUTSIDE the repo carries the exact authorized bytes; branch `candidate/621001538f98` @ `f986d8b1717c`)
7. fail-closed + receipted controls — STEP C (tokenless `guard:missing-or-bad-token`, cross-origin `guard:origin-not-allowed`, nonce-less `door:nonce-missing`), STEP 6a/6b (`door:head-missing`, `candidate:stale-head` — refused BEFORE the reference monitor, authorization not consumed), STEP 7a (replay `candidate:already-materialized`), STEP 7b (forged one-nibble signature `refused-owner-gate`, zero effect), STEP 7c (malformed durable row `door:hydration-failed`), STEP 7d (external-writer convergence: the door defers to the durable truth; the deterministic between-hydrate-and-settle `door:settle-divergence` is pinned in CI `apps/seed/test/r50.process-ceremony.test.ts`)
8. canonical main byte-identical, no push/merge — STEP 8 (HEAD `c3b67d0` and tree `6bc95a4f` identical across the run; porcelain empty; `origin/main` untouched; the only run-created ref was the candidate branch, disposed in STEP 9); teardown releases every owned port — STEP 9

**Findings (cross-lane, reported not fixed — protected supervisor surface):**
- The supervisor's PID file records the `npx` WRAPPER pid, not the listening child: SIGKILLing the
  wrapper orphans a still-serving door, and a `stop` on the pid-file pid has the same gap.
- The same class at teardown: convex-local-backend outlives its wrapper after `down` — the exact
  residue Sam 1's R47 transcript shows (`convex-lo … *:3210 (LISTEN)` after DOWN=0). Twice-witnessed.

**Sanitization law:** the driver (docs/r50/r50-live-driver.ts) prints only paths, statuses, and
response/projection JSON. The per-boot token was read from the supervisor's 0600 file into headers
only; owner signatures (local test-owner fixture `local-door-dev`) traveled in request bodies only.
Post-run scan of this transcript: 0 lines with ≥80-hex blobs, 0 token/authorization-header mentions.
(One operational note: the runner's first foreground `up` hit the runner's own timeout, which reaped
that boot's process tree — the run below uses detached invocations; receipts of the reaped first
attempt are omitted as no request was ever made to it.)

---

```text
=== R50 LIVE SUPERVISED ACCEPTANCE · 2026-07-17T08:42:57Z ===
worktree: /Users/asd/AUKORA/r29-recursion · branch sam/r50-process-death
HEAD before: 9ebd681359111052a4ac8cce5c16b356e0d2997a
TREE before: 6d796d0bb29d18278a5ebb1262a93235e305d39a
porcelain before: [?? docs/r50/ ]
local branches snapshotted: 21
=== ports before ===
COMMAND   PID USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node    81085  asd   12u  IPv4 0x60d598d50fd0def3      0t0  TCP 127.0.0.1:7096 (LISTEN)
(none listening)

(driver committed; HEAD at run time:) c3b67d06a6acfc1adcb983c2c04f51714d026da6
=== SUPERVISOR UP #1 · 08:43:43Z ===
▸ up-requested
▸ token-custody
▸ started · convex-backend :3210
▸ ready · convex-backend :3210
▸ probed · convex-backend :3210
▸ started · brain-door :7141
▸ not-ready · brain-door :7141
▸ boot-degraded · brain-door — readiness probe never verified identity :7141
▸ probed · brain-door :7141
▸ started · mind-door :7097
▸ ready · mind-door :7097
▸ probed · mind-door :7097
▸ started · voice-sidecar :7098
▸ not-ready · voice-sidecar :7098
▸ probed · voice-sidecar :7098
▸ started · spatial-shell :7096
▸ ready · spatial-shell :7096
▸ probed · spatial-shell :7096
(note: 'up' lingers on the mind-door stdout capture pipe after completing its plan — children are detached and survive; the runner SIGTERMs the lingering CLI only)
=== ports after up #1 ===
=== door status ===
driver error: fetch failed
=== SUPERVISOR UP #1 (relaunched detached after runner timeout reaped the first boot) ===
▸ up-requested
▸ token-custody
▸ started · convex-backend :3210
▸ ready · convex-backend :3210
▸ probed · convex-backend :3210
▸ started · brain-door :7141
▸ ready · brain-door :7141
▸ probed · brain-door :7141
▸ started · mind-door :7097
▸ ready · mind-door :7097
▸ probed · mind-door :7097
▸ started · voice-sidecar :7098
▸ not-ready · voice-sidecar :7098
▸ probed · voice-sidecar :7098
▸ started · spatial-shell :7096
▸ ready · spatial-shell :7096
▸ probed · spatial-shell :7096
=== ports after up ===
COMMAND PID NAME
node 92468 127.0.0.1:7141
convex-lo 92537 *:3210
node 92594 127.0.0.1:7097
node 92819 127.0.0.1:7096

=== STEP C · guard controls over the live wire ===
POST /api/propose → 403 {"error":"refused: missing or bad local POST token","reasonClass":"guard:missing-or-bad-token","eventReceipt":"28247b27395dd5114a71358fd0fd3a2d8b7ba200ccf5eb6c6c5b924887c74b49"}
POST /api/chat → 403 {"error":"refused: origin https://evil.example is not in the door allowlist","reasonClass":"guard:origin-not-allowed","eventReceipt":"b94b3fa0eeae1eef484df50a31a47ee10b1cdd9364e2edd92ae70127c6318b38"}
POST /api/propose → 400 {"error":"refused: body.nonce (1..128 chars) is required for replay protection","reasonClass":"door:nonce-missing","eventReceipt":"c38f4f9ab13893c0bba7c642f13e18469e9c0e4980b6fa62a21c98dceeeab25e"}

=== STEP 1 · tokened /api/propose (no authorization) → durable awaiting-owner ===
POST /api/propose → 409 {"schema":"aukora-door-plan-v1","ok":false,"phase":"refused-at-owner","reasonClass":"refused-owner-gate","text":"workflow awaiting-owner (refused-owner-gate)","proposalHash":"4ac84bf07eb32aeecb7094a98c6cdb4ce85a1844849f18f49a956ce57bd7237d","workflowId":"0b98f9b3465d7d233d1a6a13d8b1064b028de952534e1184984d1c3e396b0a7a","rehearsalReceiptPrefix":null,"candidateBranch":null,"candidateCommitPrefix":null,"signed":false,"pushed":false,"touchedMain":false,"grantsAuthority":false,"eventReceipt":"eb545377617997c261606875e8030ba23fd35398538e88ccdaae1600cd239fbc"}
workflowId(expected) = 0b98f9b3465d7d233d1a6a13d8b1064b028de952534e1184984d1c3e396b0a7a

=== STEP 1b · the durable row, read straight from local Convex ===
convex loadWorkflow(0b98f9b3465d…) = {"advisoryOnly":true,"councilEvidenceDigest":"7400e4660cf8dc4132ceb0fda7f1a7c7678df9db23f18c0c7799b94ffccc4005","councilVerdict":"advisory-pass","createdAtIso":"2026-07-17T08:50:07.575Z","draftHash":"699785d16e3aff9167de6995701e779c6018ed906c350e36173fa178e34b7d18","grantsAuthority":false,"intentId":"4ac84bf07eb32aeecb7094a98c6cdb4ce85a1844849f18f49a956ce57bd7237d","nonce":"r50-live-nonce-1","ownerVerified":false,"phase":"awaiting-owner","receiptHash":null,"refusals":["owner-gate: no owner authorization (advisory review never authorizes)"],"schema":"aukora-recursion-workflow-v1","stage":"refused-owner-gate","updatedAtIso":"2026-07-17T08:50:07.575Z","version":2,"workflowId":"0b98f9b3465d7d233d1a6a13d8b1064b028de952534e1184984d1c3e396b0a7a"}

=== STEP 2 · SIGKILL the mind-door PID (a real process death, not an object swap) ===
mind-door pid (from supervisor pid file): 92539
SIGKILL sent
port 7097 after SIGKILL: [92594]
STILL UP (unexpected)
FINDING (cross-lane, supervisor): the pid FILE holds the npx WRAPPER pid (92539); the actual listener is its child (92594) — killing the wrapper orphans a still-serving door. Reported, not fixed here (protected surface, supervisor lane).
killing the ACTUAL listener (the real process death):
SIGKILL sent to 92594
port 7097 after SIGKILL: []
door unreachable — process is dead ✓

=== STEP 3 · restart through the supervisor (planUp observes the dead door, starts ONLY it) ===
▸ up-requested
▸ token-custody
▸ probed · convex-backend :3210
▸ probed · brain-door :7141
▸ started · mind-door :7097
▸ ready · mind-door :7097
▸ probed · mind-door :7097
▸ started · voice-sidecar :7098
▸ not-ready · voice-sidecar :7098
▸ probed · voice-sidecar :7098
▸ probed · spatial-shell :7096
(fresh per-boot token minted by the lifecycle owner; value never printed)

=== STEP 4 · byte-identical rehydration from local Convex ===
--- row AFTER restart (compare with STEP 1b) ---
convex loadWorkflow(0b98f9b3465d…) = {"advisoryOnly":true,"councilEvidenceDigest":"7400e4660cf8dc4132ceb0fda7f1a7c7678df9db23f18c0c7799b94ffccc4005","councilVerdict":"advisory-pass","createdAtIso":"2026-07-17T08:50:07.575Z","draftHash":"699785d16e3aff9167de6995701e779c6018ed906c350e36173fa178e34b7d18","grantsAuthority":false,"intentId":"4ac84bf07eb32aeecb7094a98c6cdb4ce85a1844849f18f49a956ce57bd7237d","nonce":"r50-live-nonce-1","ownerVerified":false,"phase":"awaiting-owner","receiptHash":null,"refusals":["owner-gate: no owner authorization (advisory review never authorizes)"],"schema":"aukora-recursion-workflow-v1","stage":"refused-owner-gate","updatedAtIso":"2026-07-17T08:50:07.575Z","version":2,"workflowId":"0b98f9b3465d7d233d1a6a13d8b1064b028de952534e1184984d1c3e396b0a7a"}
--- door-mediated: idempotent re-propose hydrates the SAME workflow (no duplicate, no effect) ---
POST /api/propose → 409 {"schema":"aukora-door-plan-v1","ok":false,"phase":"refused-at-owner","reasonClass":"refused-owner-gate","text":"workflow awaiting-owner (refused-owner-gate)","proposalHash":"4ac84bf07eb32aeecb7094a98c6cdb4ce85a1844849f18f49a956ce57bd7237d","workflowId":"0b98f9b3465d7d233d1a6a13d8b1064b028de952534e1184984d1c3e396b0a7a","rehearsalReceiptPrefix":null,"candidateBranch":null,"candidateCommitPrefix":null,"signed":false,"pushed":false,"touchedMain":false,"grantsAuthority":false,"eventReceipt":"063180977806df3d16bae2d0ce7812388214a559e74845f2d539c49c2507fdf4"}
workflowId(expected) = 0b98f9b3465d7d233d1a6a13d8b1064b028de952534e1184984d1c3e396b0a7a

=== STEP 5 · fresh test-owner AUMLOK authorization (byte-bound) completes the durable step ===
POST /api/propose → 200 {"schema":"aukora-door-plan-v1","ok":true,"phase":"awaiting-explicit-materialize","reasonClass":"workflow:ok","text":"owner-verified + rehearsed; awaiting an explicit materialize invocation (no effect without one)","proposalHash":"4ac84bf07eb32aeecb7094a98c6cdb4ce85a1844849f18f49a956ce57bd7237d","workflowId":"0b98f9b3465d7d233d1a6a13d8b1064b028de952534e1184984d1c3e396b0a7a","rehearsalReceiptPrefix":"4ebafd967698","candidateBranch":null,"candidateCommitPrefix":null,"signed":false,"pushed":false,"touchedMain":false,"grantsAuthority":false,"eventReceipt":"bb696d96b372ca49079b51f3d076bf52db0123cadfea61bcd7e1b9cebe636353"}
workflowId(expected) = 0b98f9b3465d7d233d1a6a13d8b1064b028de952534e1184984d1c3e396b0a7a

=== STEP 6 · head binding: missing → stale → true head ===
--- 6a missing headBefore ---
POST /api/materialize → 400 {"error":"refused: body.headBefore (40-hex repo HEAD the approval binds to) is required to materialize","reasonClass":"door:head-missing","eventReceipt":"cee6477e48b1badc19463bf52b05c65cd8cfd00fd44408565651c0df264fdc80"}
--- 6b stale headBefore (valid shape, wrong head) ---
POST /api/materialize → 409 {"schema":"aukora-door-plan-v1","ok":false,"phase":"refused-at-candidate","reasonClass":"candidate:stale-head","text":"refused: repo HEAD moved since this materialization was approved — re-approve against the current head","proposalHash":"4ac84bf07eb32aeecb7094a98c6cdb4ce85a1844849f18f49a956ce57bd7237d","workflowId":"0b98f9b3465d7d233d1a6a13d8b1064b028de952534e1184984d1c3e396b0a7a","rehearsalReceiptPrefix":"4ebafd967698","candidateBranch":null,"candidateCommitPrefix":null,"signed":false,"pushed":false,"touchedMain":false,"grantsAuthority":false,"eventReceipt":"1e0253ebd64a8ee5e89360e87da5f0b9ed86afad64b5bc8157383b6d9538bf8e"}
--- 6c true current head → exactly one disposable candidate ---
POST /api/materialize → 200 {"schema":"aukora-door-plan-v1","ok":true,"phase":"candidate-materialized","reasonClass":"candidate:ok","text":"candidate materialized in a disposable worktree on candidate/621001538f98 (never pushed, never merged)","proposalHash":"4ac84bf07eb32aeecb7094a98c6cdb4ce85a1844849f18f49a956ce57bd7237d","workflowId":"0b98f9b3465d7d233d1a6a13d8b1064b028de952534e1184984d1c3e396b0a7a","rehearsalReceiptPrefix":"4ebafd967698","candidateBranch":"candidate/621001538f98","candidateCommitPrefix":"f986d8b1717c","signed":false,"pushed":false,"touchedMain":false,"grantsAuthority":false,"eventReceipt":"7ddd2dcfc4e39487da25dd69f650340e1d7120f1847e8247096ebd330b7ec896"}

=== STEP 6d · exactly ONE isolated candidate worktree, OUTSIDE the repo ===
/Users/asd/AUKORA/r29-release                             750951c [sam/r29-release]
/Users/asd/AUKORA/aukora-door-candidates/wt-621001538f98  f986d8b [candidate/621001538f98]
/Users/asd/AUKORA/r29-recursion                           c3b67d0 [sam/r50-process-death]
candidate worktree file content (the exact authorized bytes):
// r50 live live (disposable candidate proof)

=== STEP 7a · REPLAY the same materialize → inert ===
POST /api/materialize → 409 {"schema":"aukora-door-plan-v1","ok":false,"phase":"refused-at-candidate","reasonClass":"candidate:already-materialized","text":"refused: candidate branch candidate/621001538f98 already exists — one materialization per candidate","proposalHash":"4ac84bf07eb32aeecb7094a98c6cdb4ce85a1844849f18f49a956ce57bd7237d","workflowId":"0b98f9b3465d7d233d1a6a13d8b1064b028de952534e1184984d1c3e396b0a7a","rehearsalReceiptPrefix":"4ebafd967698","candidateBranch":null,"candidateCommitPrefix":null,"signed":false,"pushed":false,"touchedMain":false,"grantsAuthority":false,"eventReceipt":"0aaf0dcb644dc497c016717ec2c606edd449a2e56f580cd88c748dc568299268"}

=== STEP 7b · FORGED signature (one nibble, correct length) → refused, zero effect ===
POST /api/materialize → 409 {"schema":"aukora-door-plan-v1","ok":false,"phase":"refused-at-owner","reasonClass":"refused-owner-gate","text":"workflow awaiting-owner (refused-owner-gate)","proposalHash":"4ac84bf07eb32aeecb7094a98c6cdb4ce85a1844849f18f49a956ce57bd7237d","workflowId":"b4006a15e37becfcae6e7776575dc623f55032ccdde95ff25394f88d3efcb629","rehearsalReceiptPrefix":null,"candidateBranch":null,"candidateCommitPrefix":null,"signed":false,"pushed":false,"touchedMain":false,"grantsAuthority":false,"eventReceipt":"8da133563130eed9003e472545cf79292065271fc798714db6097cdff788860f"}

=== STEP 7c · MALFORMED durable state (passes the isolate subset, fails the full validator) → door:hydration-failed ===
plant-bad(3974a9e39c81…) → {"ok":true}
POST /api/propose → 409 {"error":"refused: durable workflow row failed exact-shape validation (fail-closed; no effects run)","reasonClass":"door:hydration-failed","eventReceipt":"a664e1631c5329812f225bbabe88480165ee9ae880da6b6d1086f869adbcd43d"}
workflowId(expected) = 3974a9e39c816c560baf34e9ad27c61cb76aaef3a07849df72d7e86acca5e83f

=== STEP 7d · an EXTERNAL writer lands a newer version; the door defers to the durable truth (fail-closed convergence; the deterministic between-hydrate-and-settle divergence is pinned in CI r50.process-ceremony.test.ts) ===
POST /api/propose → 409 {"schema":"aukora-door-plan-v1","ok":false,"phase":"refused-at-owner","reasonClass":"refused-owner-gate","text":"workflow awaiting-owner (refused-owner-gate)","proposalHash":"4ac84bf07eb32aeecb7094a98c6cdb4ce85a1844849f18f49a956ce57bd7237d","workflowId":"ba99de622f616b6df187ef57751bfb725168db443770d9313602841fe4ea5da0","rehearsalReceiptPrefix":null,"candidateBranch":null,"candidateCommitPrefix":null,"signed":false,"pushed":false,"touchedMain":false,"grantsAuthority":false,"eventReceipt":"78d1ee66b3c3642534a024224d9f577c8dbd7acb923a36d0eb2d81473e70cdc3"}
workflowId(expected) = ba99de622f616b6df187ef57751bfb725168db443770d9313602841fe4ea5da0
winner-bump(ba99de622f61… v2→v3) → {"ok":true}
POST /api/propose → 200 {"schema":"aukora-door-plan-v1","ok":true,"phase":"awaiting-explicit-materialize","reasonClass":"workflow:ok","text":"owner-verified + rehearsed; awaiting an explicit materialize invocation (no effect without one)","proposalHash":"4ac84bf07eb32aeecb7094a98c6cdb4ce85a1844849f18f49a956ce57bd7237d","workflowId":"ba99de622f616b6df187ef57751bfb725168db443770d9313602841fe4ea5da0","rehearsalReceiptPrefix":"b39ce946f218","candidateBranch":null,"candidateCommitPrefix":null,"signed":false,"pushed":false,"touchedMain":false,"grantsAuthority":false,"eventReceipt":"6cdc72347c7f971f4dc8ead8fe4e90e401c5031bc4ee1c5816492ddc4a8a470a"}
workflowId(expected) = ba99de622f616b6df187ef57751bfb725168db443770d9313602841fe4ea5da0
convex loadWorkflow(ba99de622f61…) = {"advisoryOnly":true,"councilEvidenceDigest":"ad3c1a79fafe5f48cf2b075494a3ab18da6c574ac51f23bc368b2b130570788a","councilVerdict":"advisory-pass","createdAtIso":"2026-07-17T08:51:24.701Z","draftHash":"417849dafb95c8edb8bbd9732415b70df3cdb7dcfd72de625bcca9e185044441","grantsAuthority":false,"intentId":"4ac84bf07eb32aeecb7094a98c6cdb4ce85a1844849f18f49a956ce57bd7237d","nonce":"r50-live-nonce-4","ownerVerified":true,"phase":"applied","receiptHash":"b39ce946f2181fdd0bf13f6211eed2f236d9e914aa0b509179199e98995fcb0e","refusals":[],"schema":"aukora-recursion-workflow-v1","stage":"sandbox-applied","updatedAtIso":"2026-07-17T08:51:24.701Z","version":4 …}

=== STEP 8 · canonical main byte-identical; nothing pushed or merged ===
HEAD  after run: c3b67d06a6acfc1adcb983c2c04f51714d026da6  (before: c3b67d06a6acfc1adcb983c2c04f51714d026da6)
TREE  after run: 6bc95a4f21dc7da0dbfc297b81794081ee340943
porcelain after run: []
origin/main untouched (no fetch/push ran): 4fc6e09c3ce9f9d5c5480c5edbcc49d26a47b70c
ref diff vs before (expected: ONLY the candidate branch appeared):
0a1
> candidate/621001538f98 f986d8b
21c22
< sam/r50-process-death 9ebd681
---
> sam/r50-process-death c3b67d0
(clarity: the run started at c3b67d0 — its tree is 6bc95a4f21dc7da0dbfc297b81794081ee340943 — byte-identical to the after-run tree; the earlier 6d796d0b… snapshot predates the driver commit. The sam/r50-process-death pointer move in the ref diff IS that driver commit; the ONLY run-created ref is candidate/621001538f98.)

=== STEP 9 · TEARDOWN releases every owned port; token cleared; disposable disposed ===
▸ down-requested
▸ stopped · spatial-shell :7096
▸ stopped · mind-door :7097
▸ stopped · brain-door :7141
▸ stopped · convex-backend :3210
▸ token-cleared
ports after down: [92537 ]
token file present after down: NO (cleared) ✓
disposing the disposable candidate (the proof is in this transcript + receipts):
worktree removed
Deleted branch candidate/621001538f98 (was f986d8b).
final porcelain: []
final HEAD: c3b67d06a6acfc1adcb983c2c04f51714d026da6 · tree 6bc95a4f21dc7da0dbfc297b81794081ee340943
=== END OF RUN · 2026-07-17T08:53:44Z ===
(port survivor: pid 92537 = convex-local-backend — the SAME wrapper/listener pid gap as the mind-door finding, and the SAME residue Sam 1's R47 teardown transcript shows ('convex-lo … *:3210 (LISTEN)' after down). Pre-existing, now twice-witnessed; killed manually to leave the box clean:)
convex-local-backend stopped
ports after manual cleanup: []
```
