# R56 Dream Cleanup — Proposed Overnight Plan

**Status:** PROPOSED · NOT STARTED · OWNER APPROVAL REQUIRED

**Pinned public baseline:** `d749e1b8053d6930654a486eb1df9ac167cc1666`

**Window after approval:** every 30 minutes until 06:00 WITA on 2026-07-19

**Purpose:** consolidate, test, reconcile, and prepare a falsifiable Nebius shadow-cell packet. No feature sprawl.

## What the Avengers audit established

The reviewed reports targeted `d797301a`; `d749e1b8` changes only the README and two owner-approved
images. The README image, visible test badge, and AI-reviewer callout are therefore already repaired.

Evidence-backed gaps that remain:

1. `CLAIMS.md` still records 900 tests and incorrectly says `verify-continuity.mjs` guards that total;
   the measured integrated gate is 1,232 passing plus two gated skips.
2. Root `test:all` runs package tests but does not systematically run every workspace's declared
   `typecheck` script. This is a real false-green class; JS-only workspaces must not receive invented
   TypeScript projects merely to satisfy the audit.
3. `.gitignore` does not ignore `.env` variants, despite the tracked-tree public scanner.
4. Spatial sends `owner_text` to `/api/chat` while the door reads `text`; a real UI/voice turn can
   silently fall into the model-free fallback. Attachments/images are also a known dead-letter seam.
5. `localCeremonyRunner.ts` still invokes `materializeCandidate()` directly. The crash-recoverable
   `runLiveCandidateEffect()` stack explicitly remains foundation-only and off the primary door.
6. Convex workflow persistence is real, but receipt/memory projections are fragmented; the public
   `ingest` action accepts self-attested records without a service capability.
7. `gateway.mjs` says it verifies the state projection with an identity probe, but currently trusts
   `state.json`'s shell port without performing that probe.
8. `workbench-readiness.mjs` falsely reports two lifecycle owners: `organism-ctl.mjs` is now a
   delegating shim and `apps/supervisor` is the sole lifecycle owner. The checker, not the lifecycle,
   is stale.
9. The continuity gate proves count/set arithmetic, not every row's semantic truth. Atlas, ledger,
   anatomy, GitHub issue state, `DILIGENCE_STATUS`, and `READINESS_METER` contain known drift.
10. Nebius remains correctly parked. A real shadow cell still needs pinned image/code/model digests,
    env-only credentials, egress scrubbing, full-process-tree kill/rollback, shadow receipts,
    resource ceilings, and PR-candidate-only output.

Audit claims explicitly rejected:

- `authoredBy: "voice"` is not authority. Models may propose; the owner alone authorizes exact,
  head-bound bytes. Do not remove voice-authored unsigned intents.
- An unwired advisory immune package does not violate the inward dependency law. Do not add direct
  immune actuators merely to make a diagram look connected.
- Gaussian memory, GHP research, and Inkling/Tinker are `RESEARCH_NEW`, not missing members of the
  ratified 169 Symbiote issue-preservation set.
- Owner boot-boundary wiring is present in `mind-door-7097.ts`; do not rebuild it.
- Full Mind/UI/Lingwa/voice convergence is not a prerequisite for a non-authoritative Nebius shadow
  canary. It remains important product work, but not tonight's containment gate.

## Global rules for all four lanes

Copy this law into every Sam chat before its lane-specific prompt:

> Pull exact public main and state the SHA before doing anything. Work only inside your assigned
> paths. Reproduce a finding before changing code; if falsified, publish the falsification instead.
> Use one rolling lane branch and PR. At every 30-minute checkpoint: inspect one bounded brick,
> run the proportional gate, commit, push, and update your lane issue with exact SHA, tests, truth
> labels, and residuals. Never leave successful work only on a local machine. Never fabricate a
> green result, digest, live transcript, model call, or donor equivalence. No secrets, owner keys,
> signing, paid inference, Nebius deployment, Tinker training, direct main mutation, force-push,
> destructive reset, or authority grant. Models and immune cells remain advisory-only. Stop at
> 06:00 WITA, cancel the recurring wakeup, and post one final handoff. Ordinary WIP defects are
> disclosed and repaired forward; credentials, PII, licensing/publication violations, and malicious
> content are hard publication blockers.

Before the first checkpoint, confirm the Sam computer is kept awake. Schedule a recurring wakeup
every 30 minutes through 06:00 WITA. Do not rely on an unawaited timer or a single long sleep.

## Sam 2 — Reactive brain, KIRA, and continuity truth

**Owned paths:** `apps/brain/**`, `packages/memory/**`, `docs/atlas/**`,
`docs/issue-preservation-ledger.json`, `docs/DILIGENCE_STATUS.md`,
`docs/READINESS_METER.json`, and the current-object continuity snapshot only.

**Anchor:** issue #21.

### Prompt

You are the R56 brain/continuity lane. Begin at exact public main and stay inside the owned paths.

Work in this order, one independently committable brick at a time:

1. Reproduce the two-KIRA seam. Trace primary-door receipts, `memoryChain`, the in-process door
   store, Spatial receipt reads, and all production callers. Add the smallest content-free bridge
   or explicitly prove/document why the stores must remain separate. Acceptance: one real adapter
   test shows a permitted receipt reaches the intended Convex projection exactly once, survives
   restart, and cannot grant authority.
2. Qualify the public Convex `ingest` action. Require a door/service capability for sensitive ingest
   or quarantine untrusted self-attested consent/provenance. Acceptance: a valid-shape, secret-clean,
   false-consent hostile record cannot enter canonical memory; missing/wrong capability refuses;
   correct internal path succeeds; backend outage fails honestly.
3. Reconcile continuity truth, without changing the ratified 169 count: voice rows #47/#48/#50 vs
   `RUNTIME_UNPROVEN`; Symbiote #71 lost-vs-live; #106/#107 stale-open; #391 opposite dispositions;
   `LOST_CAPABILITIES` 35/36 and uncategorized 5/6; ledger↔atlas contradictions. Refresh current
   objects to the integrated head. Every changed row needs exact file/test/issue evidence.
4. Refresh `DILIGENCE_STATUS` and `READINESS_METER` so they no longer present R51 as current. Do not
   copy a test total owned by Sam 1; consume Sam 1's generated artifact after integration.

Checkpoint gates: brain suite, memory suite, new hostile/capability tests, `verify:continuity`,
`verify:anatomy`, content-free receipts, and no new authority path. Push each completed brick and
update #21.

Do not wire `@aukora/mind`, Fu, immune actuators, Lingwa, voice, or Nebius in this lane.

## Sam 3 — Primary door, effects, gateway, and evidence boundary

**Owned paths:** `apps/seed/**`, `apps/supervisor/**`, `packages/evidence/**`.

**Anchor:** issue #22.

### Prompt

You are the R56 primary-effect and hostile-boundary lane. Begin at exact public main and stay inside
the owned paths.

Work in this order, one independently committable brick at a time:

1. Reproduce the chat envelope mismatch with a test using the exact Spatial payload
   `{ owner_text, attachments, images, model }`. Make the door accept the canonical field without
   silently dropping attachments or weakening escaping/truncation laws. Acceptance: a real loopback
   chat request reaches the intended recall path; malformed/oversized/authority-shaped channels
   refuse or degrade explicitly; `text` compatibility is deliberate and tested.
2. Put `runLiveCandidateEffect()` on the primary ceremony's materialization path. Direct
   `materializeCandidate()` must remain inside the effect adapter, not beside it. Acceptance:
   crash after durable consumption but before Git and crash after Git but before settlement both
   recover without duplicate effects; missing/forged/stale/wrong-head/replayed authorization causes
   zero Git mutation; exactly one isolated candidate is created; public main stays byte-identical;
   receipts remain content-free.
3. Fix gateway projection trust. Validate `activeShellPort` against policy and the supervisor-owned
   child identity, and actually perform the probe promised by the header. Acceptance: malformed,
   foreign, stale, or non-listening state is refused; correct supervised shell proxies; AUMLOK is
   never fronted; shutdown clears the complete owned process tree.
4. Extend the canonical evidence catalogue and planted-vector tests for currently missing public
   token shapes (`tml_`, `hf_`, `sk-tinker`, and any exact current provider prefixes discovered from
   public documentation). Never commit a real credential or realistic live value.

Checkpoint gates: seed suite, supervisor suite, evidence suite, public scan, authority-negative
matrix, crash/restart transcript, exact isolated-Git postconditions. Push each brick and update #22.

Do not remove `authoredBy: "voice"`, change AUMLOK v2 bytes, arm providers, or touch Atlas/README.

## Sam 4 — Spatial truth, research hygiene, and contributor door

**Owned paths:** `apps/spatial/**`, `apps/console/**`, `docs/research/**`, `docs/skunkworks/**`,
`ROADMAP.md`, `.github/ISSUE_TEMPLATE/**`, and GitHub issue labels/templates through the API.

**Anchor:** issue #23.

### Prompt

You are the R56 body/public-truth lane. Begin at exact public main and stay inside the owned paths.
The owner-approved README visuals are already live; do not redesign or replace them overnight.

Work in this order, one independently committable brick at a time:

1. Verify the new Spatial screenshot caption remains exact: experimental `:7090` Symbiote design
   direction, not canonical live Aukora. Audit every visible Spatial affordance against a live,
   fixture, offline, parked, or missing label. Do not restore features merely to remove an honest
   label.
2. Sanitize `ABSORPTION_LEDGER` and related research docs: remove host-filesystem/zip narration and
   private-machine context. Preserve technical findings. Move named patent/design-around language
   into a clearly marked counsel-review record only if the owner has already ratified public
   disclosure; otherwise replace it with a neutral legal-review placeholder. Do not make legal
   conclusions or bulk-edit copyright headers.
3. Create a compact root `ROADMAP.md` from the current Atlas/issues: **Now** = core truth/effect/
   containment; **Next** = Nebius shadow cell and Mind/Fu/KIRA cohesion; **Later** = Lingwa, duplex
   voice, Gaussian memory, GHP, Tinker training. Every item links to a public issue and carries a
   truth label.
4. Open the contributor door without making an IP promise: add issue templates for bug,
   falsification, research candidate, and capability restoration. Apply a minimal label taxonomy
   (`security`, `continuity`, `research-only`, `roadmap`, `good-first-audit`). Do not replace the
   source-contribution/CLA restriction without counsel-approved language.
5. Curate `docs/skunkworks/README.md` so every external experiment has exact provenance,
   reproducibility status, and canonical disposition. Raw external numbers never become organism
   test totals.

Checkpoint gates: Spatial/console suites, link check, no-overclaim diff scan, public secret/PII scan,
and exact truth labels. Push each brick and update #23.

Do not change README test counts, CLAIMS, CI, authority, runtime Mind/Fu wiring, or deploy anything.

## Sam 1 — Control, executable truth, zipper, and public-main cadence

**Owned paths:** root `package.json`, `CLAIMS.md`, `scripts/**`, `.gitignore`,
`.github/workflows/**`, `NOTICE` only for a decision packet, and integration-only conflict
resolutions. Sam 1 does not duplicate lane implementation.

**Anchor:** issue #20.

### Prompt

You are the R56 control/integration lane. Pin exact public main before any work. Your first job is
truth machinery; your recurring job is to zipper the other three lanes and prevent stranded work.

Work in this order:

1. Add `.env`, `.env.*`, and common local secret files to `.gitignore` while explicitly allowing
   safe `.env.example` templates. Prove `git check-ignore` behavior and keep the public scan green.
2. Add one root workspace typecheck gate using existing declared `typecheck` scripts. First inventory
   which workspaces actually contain TypeScript and which already define a typecheck. Do not invent
   an `apps/spatial/tsconfig.json` merely because an audit expected one. Add a regression verifier so
   a future workspace cannot declare a typecheck and silently escape the root gate. Run on Node 20
   and 22.
3. Replace hand-written test totals with one deterministic measured/generated source consumed by
   `CLAIMS.md` and the README badge. Correct the false sentence claiming
   `verify-continuity.mjs` guards test totals. Add the missing kernel-node/immune/current suite rows.
   Gated skips must be reported separately.
4. Repair `workbench-readiness.mjs`: recognize `organism-ctl.mjs` as a delegating shim, derive the
   one supervisor owner and current token-custody evidence from executable behavior, and fail on a
   planted second owner. Do not rebuild lifecycle or custody that already exists.
5. Extend the no-overclaim guard in PR-diff mode for unqualified terms such as `alive`,
   `production-grade`, `mathematically proven`, `unbreakable`, and `SAFE TO MERGE`, while allowing
   explicitly quoted/refuted research text. Prove the guard catches planted claims without blocking
   honest negative evidence.

Every 30 minutes after the lane wakeup:

- Fetch the latest lane heads posted to #21/#22/#23.
- Verify path ownership and check for overlap before integration.
- Integrate only completed, publication-clean bricks in dependency order: Sam 3 → Sam 2 → Sam 4 →
  Sam 1 truth files.
- Run the proportional gate and open/update one integration PR with an exact head table.
- Push the integration and post #20 even when an ordinary WIP test remains red; name the exact red
  test and repair-forward owner. Never publish secrets/PII, licensing violations, malicious content,
  or an unresolved overlapping rewrite.
- Request the admin merge watcher to land each new integration checkpoint on public main. Do not
  let successful work wait until morning.

At 06:00 WITA, cancel the wakeup and post a final handoff: all integrated main SHAs, every remaining
red test/residual, branch/PR dispositions, and the morning Nebius packet.

Full final gate when time permits: fresh clone; Node 20/22; `npm ci`; `npm run test:all`;
typechecks; provenance; anatomy; continuity; boundary; public scan; no-overclaim; README/CLAIMS count
equality; AUMLOK v2 byte identity; no owned-port residue.

Do not tag a release, bulk-change copyright holders, arm Nebius, merge raw research donors, or claim
production readiness.

## Merge-watch requirement

The Sam account is push-only. Sam 1 cannot satisfy the public-main cadence alone. After owner
approval, Codex must run a separate 30-minute merge watch that:

1. reads #20 and the newest Sam 1 integration PR;
2. confirms the secret/PII/publication gate and exact scope;
3. admin-merges the newest checkpoint even when ordinary WIP failures are honestly disclosed;
4. verifies public `main` and posts the exact SHA to #20;
5. never merges raw overlapping lane PRs separately from the zipper.

No merge-watch automation is active until the owner approves this plan.

## Morning Nebius verdict

### Local, zero-egress rehearsal

**GO after the overnight truth/effect gates.** No credentials or paid compute required.

### First real non-authoritative shadow cell

**HOLD until all are proven:**

- real 64-hex image, code, and model digests pinned to a merged main SHA;
- env-only Nebius credentials under owner custody, absent from Git/logs/receipts;
- provider egress allowlist plus planted secret/canary scrub tests;
- full remote process-tree kill switch with TTL and zero residual listeners;
- remote rollback drill;
- `authorityClass: "shadow"` receipt schema and local reconciliation;
- hard spend/resource ceilings verified against the real account;
- PR-candidate-only output, no direct GitHub/main writes;
- no owner key and `grantsAuthority:false` throughout;
- exact-manifest owner arm ceremony immediately before the run.

Issue #109, Lingwa, duplex voice, immune actuators, and full Spatial polish remain important but are
not blockers for this isolated shadow canary.

## Owner approval

This plan is a public savepoint only. The loops and merge watcher remain stopped until Peter approves
the four recaps and explicitly says to start the overnight run.
