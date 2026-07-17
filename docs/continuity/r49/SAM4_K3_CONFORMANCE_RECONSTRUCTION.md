# SAM 4 · R49 — K3 conformance reconstruction (reproduce before claiming)

**Lane:** Sam 4 — Spatial shell / operator console · **Issue:** #23 · **Directive:** R49 (conformance/evolution).

This round independently **reconstructs** the useful Kimi/K3 skunkworks conformance experiments
(issue #15) from **canonical public interfaces only**. No `/mnt` code, fixtures, or logs were copied.
Every input is generated deterministically from an explicit seed; every output is a falsifiable verdict
plus a content-addressed evidence bundle that replays byte-for-byte on a second node.

---

## Node fingerprint & pins (K3 artifact protocol)

| Field | Value |
|---|---|
| Base commit (canonical main) | `26da3754c7bc184d3f8797286453138828e6799e` |
| Branch | `sam/r49-conformance-cell` |
| Execution | **first-hand, in-process** (no sockets, no network, no cloud) |
| Node | `v26.4.0` |
| Platform | `Darwin arm64` (Apple Silicon; no NVFP4/Blackwell GPU) |
| Authority / secrets / main mutation | none — `grantsAuthority:false`, no keys touched, branch/PR only |

Reproduce:

```bash
# in a clean worktree off 26da3754
npm ci && npm run build --workspace @aukora/kernel
npm run test --workspace @aukora/spatial                      # gate assertions
AUKORA_CONFORMANCE_WRITE=1 npm run test --workspace @aukora/spatial   # + write evidence bundles
```

The cells import the **real** governed interfaces (`@aukora/seed:MindDoor`,
`@aukora/supervisor:engine.mjs`, `@aukora/brain:ReactiveMemoryStore`, `@aukora/memory`), so a regression
in any of them fails these cells — this is conformance against the canon, not a re-implementation of it.

### Content-addressed cores (must match on a second node; the node fingerprint is what differs)

| Cell | coreHash |
|---|---|
| E1 hostile-refusal | `ecc741c4cd73b697796d4dd50c5b43f05b0055b9288ff8525303bc74b62ffc7f` |
| E2 supervisor-lifecycle | `0d3b29fa7d9a354e99db50b6779b5b18cc62bffc20e632b8deaa252438ccf184` |
| E3 kira-chain | `4b5416c5cf4ef8718e525abc3a0906619244b2d7cbfa3b18311ec0ee243836e0` |

Determinism proven locally: three consecutive runs produced identical coreHashes for all three cells.
Bundles: `apps/spatial/conformance/artifacts/<cell>.json`.

---

## E1 — hostile proposal / refusal chaos (K3 priority 1)

Drives the governed mind door (`MindDoor.handle()`) through **240 seeded hostile envelopes** across its whole
write surface: cross-origin POSTs, forged/absent tokens, referer attacks, wrong methods, missing bodies,
malformed & authority-shaped proposals, oversized fields, path/command-injection targets, forged
(replay/stale) signatures, Fu-sidecar mismatch, and Fu-claims-authority — then lockdown + post-lockdown
writes. A **real candidate git repo** backs the door so "main untouched" is observed, not assumed.

**Result (seed `0x51c4`):** `pass=true`.

- `escaped = 0` — **no hostile envelope produced a landed effect** (no candidate branch, nothing signed/pushed/materialized).
- `authorityGranted = 0` — nothing ever set `grantsAuthority:true`.
- `governedRefusals = 185`, all **185 receipted** (every refusal carrying a `reasonClass` also carried an `eventReceipt`).
- `bareProtocolBounces = 41` — 405 wrong-method / 400 missing-body / 404 route: rejected pre-governance, not receipted (by design).
- `mainHeadUnchanged = true`, working tree clean, zero `candidate/*` branches after the storm.
- Lockdown engaged (`200`), post-lockdown propose refused (`423`), status readable under lockdown (`200`), door up after the storm (`200`).

### FINDING F1 (refusal-hygiene, low severity) — owner: **Sam 3 (`apps/seed`)**

`fu-authority-claim` vectors (matched `proposalHash` + a **malformed** Fu `outcome`) **throw out of
`MindDoor.handle()`** instead of returning a receipted refusal (14/14 threw this run).

- Root cause: `mindDoor.ts` (~L227) calls `verdictFromCouncilOutcome(fuSidecar.outcome)` on **unvalidated
  attacker input**; `fuStructuredAdapter.ts:153` reads `outcome.basis.digest` with no shape guard.
- Secondary: `verdictFromCouncilOutcome` hard-codes `grantsAuthority:false`, so the door's
  `door:fu-authority-claim` guard branch is **unreachable for a well-formed outcome** — dead defensive code
  that, worse, throws on a malformed one.
- **Safety is NOT breached:** the throw precedes the ceremony, so no authority is granted, nothing
  materializes, main is untouched, and the door's serialized queue survives (status still `200`). Only
  refusal *hygiene* fails — a hostile input should refuse-and-receipt, not raise.
- Suggested fix (Sam 3's lane; not applied here): shape-validate `fuSidecar.outcome` before use (return
  `door:fu-sidecar-malformed`), or wrap the Fu evaluation and receipt the refusal; and remove/repair the
  dead authority-claim branch.

This finding is reported, not used to fail E1's safety gate — the gate proves safety; the finding documents
hygiene. It is reproduced deterministically and recorded first-class in `e1-hostile-refusal.json`.

---

## E2 — supervisor crash / restart / ownership (K3 priority 2)

Exercises the **pure** lifecycle engine (`apps/supervisor/src/engine.mjs`) as a property sweep over **300
seeded observation worlds** plus a scripted crash → restart → squatter → swap → rollback scenario.

**Result (seed `0x5c0f`):** `pass=true`. Counters all zero: `envelopeViolations=0`, `forbiddenLeaks=0`,
`foreignUnsafe=0`, `impure=0`. All 12 scenario properties hold (cold-boot ordering, idempotence, mind-crash
recovery without restarting healthy peers, squatter isolate-not-kill, candidate boot-probe, verified-swap
release, failed-swap rollback, owner-only contraction release, no authority in status).

### In-lane fix landed this round — foreign-occupant dependency-cascade gap

The property sweep surfaced a **real gap in my own `planUp`**: when a *dependency* was `OCCUPIED-FOREIGN`,
the dependency resolver planned `start` on the squatted port (violating the engine's own "never touch a
foreign port" law) and cascaded `start`s to blocked dependents.

**Fix (`apps/supervisor/src/engine.mjs`):** compute a transitive **blocked** set — a service with any
`OCCUPIED-FOREIGN` (transitive) dependency is never started; the foreign dep is `isolate`d in its own phase,
and each blocked dependent emits a visible `status{blocked:true}` step instead of a start. The protected-class
pin (`protected.sha256`) was updated in the same change per `apps/supervisor/PROTECTED.md`. All 21 prior
supervisor tests stay green; the fix is proven by E2's `foreignOccupantSafe`/`scenarioAllHold` verdicts.

---

## E3 — KIRA forgetting / chain-integrity stress (K3 priority 3)

Drives the real brain store (`ReactiveMemoryStore`, content-free receipt chain) with **500 seeded ingests**
and **60 governed forgets**.

**Result (seed `0xc41a`):** `pass=true`.

- Growth monotonic across all 500 ingests; chain integrity holds after every op (`growthViolations=0`, `integrityViolations=0`).
- Governed forgetting (all 60): plaintext deleted (`plaintextRetained→false`), record un-recallable,
  content-free tombstone appended, chain still verifies. Final: `liveCount=440`, `chainLength=562`,
  `forgottenCount=61`.
- **No resurrection** — re-ingesting a forgotten content id is refused. **Forget requires owner** — a failing
  owner check refuses and the plaintext survives. **Secret fail-closed** — a record carrying a live secret is
  refused and nothing enters the chain. **Tamper detected** — mutating a committed chain link makes
  `verifyChain()` fail and a corrupt store refuses further ingest (fail-closed).

---

## Nebius / Inkling-NVFP4 — PARKED, `enabled:false` unchanged (exact blockers named)

The R49 directive advances the prepared Inkling-NVFP4 Nebius manifest **only if the actual environment is
accessible** (official checkpoint/recipe, pinned HF revision, model checksum, container digest, vLLM version,
observed GPU topology, private endpoint, sanitized evidence). It is **not** accessible from this lane/node,
so the manifest stays parked and no runtime numbers are fabricated. Exact blockers:

1. **Lane fence (by construction):** this lane permanently forbids cloud/Nebius/paid inference and arming G1.
   Serving Inkling-NVFP4 is an armed B200 spend — out of fence. Requires an owner/Peter-run bring-up or a
   deliberate fence change.
2. **No NVFP4/Blackwell hardware here:** node is Apple Silicon (`Darwin arm64`, `nvidia-smi` absent).
   NVFP4 requires B200/GB200 multi-GPU.
3. **No verified checkpoint access:** no Hugging Face token in this environment; no verified pull of
   `thinkingmachines/Inkling-NVFP4`; no official vLLM NVFP4 recipe captured.
4. **`validateNebiusManifest` correctly refuses `enabled:true`** without real 64-hex `imageSha256` /
   `codeSha256` / `modelChecksumSha256`. Every binding in `models/nebius/inkling/inkling-nvfp4.serving.manifest.json`
   remains a `REQUIRED_AT_PIN` slot; none are invented. Parked-with-unbound-digests is the honest maximum.

Per the directive, bounded calls/deadlines for failure containment remain the standing discipline (the R48
adversarial-output harness is the reusable bounded reader); no arbitrary project-wide dollar cap is imposed.
Tinker stays a separate future training contract — no real transcript exists, so nothing is claimed.

---

## Fences honored

Read-only console lane throughout: no cloud, no Nebius, no paid inference, no managed Convex; no donor service
touched; no secrets/keys/tokens in any bundle, log, or fixture (hostile payloads are all seed-synthetic;
refusals recorded as reason **classes**); display/evidence never authorizes (`grantsAuthority:false`);
branch/PR only, never main, never force-push. The one code change outside test/docs is the in-lane
`apps/supervisor` engine fix above (my owned path), re-pinned in `protected.sha256`.

Also relanded this round: the orphaned **R47 security fix** (`665b1a3`) — realpath symlink re-fence in the
repo-read spine + honest sign-command hint — which PR #85 merged the pre-fix head of. It rides as the first
commit of this branch (`apps/spatial/scripts/launch.mjs`, provenance pin refreshed).
