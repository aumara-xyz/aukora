# Nebius go/no-go packet — LOCAL-ONLY (zero packets sent)

**Verdict tonight: NO-GO.** This packet defines what must exist before any Nebius operation is even proposable. Nothing was transmitted; no credentials exist on this node (proven absence, see below).

| requirement | current evidence | status |
| --- | --- | --- |
| Required digests: imageSha256 / codeSha256 / modelChecksumSha256 pinned to an exact merged main | `models/nebius/deployment.manifest.json` — all three EMPTY, `enabled:false` | ❌ NO-GO |
| NodePrint (reproducible runtime manifest) | brain lane shipped node-print + health contract (R31/R38 suites, in-gate) | ✅ ready |
| Semantic-twin replay (candidate replayed locally before any remote run) | rehearsal + disposable-worktree staging in-gate (`localCandidateStage`, isolation suites) | ✅ ready (local law) |
| Kill switch | supervisor down is PID-scoped + owned; remote kill-switch equivalent NOT defined | ❌ define before go |
| Spend ceilings | council SpendMeter hard $2/pass + $10/day, fail-closed, narrowing-only (in-gate) | ✅ ready |
| Rollback policy | declared gap in manifest genome assessment — rollback draft required per GOLD ceremony law but no remote rollback law | ❌ define before go |
| Credential-absence proof | keychain tests assert Ed25519/ML-DSA seeds ABSENT from repo/env; no NEBIUS_* in tree (secret-pii-scan green) | ✅ proven tonight |
| Shadow-receipt distinction | receipts are truth (Wave 2 ruling); a remote "shadow receipt" must be marked non-authoritative until reconciled — law drafted here, not implemented | ❌ implement before go |
| Scrub-before-egress law | evidence secret projections + forbiddenContent fences in-gate for local surfaces; egress scrubber for outbound packets NOT built | ❌ build before go |

**Go conditions (all):** three digests pinned to a merged main SHA · remote kill-switch + rollback laws implemented and tested · shadow-receipt reconciliation implemented · egress scrubber tested with planted vectors · owner authorization via AUMLOK ceremony · spend ceilings verified against the actual provider account. Until every box is ✅, `NEBIUS_LATER` rows in the atlas stay parked.
