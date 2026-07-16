# R43 / WAVE 3 — Candidate-Write Integrity + Headless Link

**Lane:** SAM 3 · `apps/seed/**` only. **Base main:** `486322ff4c9472edfcf0154307307475d973bff3`.
**Ring 0 untouched:** no change to AUMLOK, custody, verifier, signer, gate law, kill switch, scanners, supervisor,
or the reference monitor. This is the P1 I parked overnight, now with Peter awake. The live tree is never written.

## Donor law restored (at the candidate worktree write)

The only edited product file is `apps/seed/src/localCandidateStage.ts`. It restores the donor #99/#75/#4 laws that
the R42 forensic atlas flagged as the one real residual:

1. **Path identity (pre-write, step 2b).** A candidate path must equal its own `path.normalize`, contain no
   backslash, no trailing slash, and no empty / `.` / `..` segment; and no two candidate files may collide after
   case-folding (macOS/APFS is case-insensitive). → `candidate:unsafe-write-path`. This is defense-in-depth behind
   the lexical fence (which already rejects `..`, `//`, backslashes); the case-fold collision check is unique to
   this layer (the fence classifies single paths, not cross-file identity).

2. **No-follow component walk (immediately before each write, step 6).** Every existing component of the target
   under the worktree is `lstat`ed without following; ANY symlink — leaf or nested directory — refuses, as does a
   non-directory mid-component. Then the resolved real parent (`realpathSync`) must be byte-identical to the
   expected directory under the worktree's real root — a checked-out symlinked directory cannot route the write
   out. → `candidate:unsafe-write-path`.

3. **Atomic leaf create.** An existing regular file (the checked-out original) is `unlink`ed; the write goes
   through `openSync(target, O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW)`. A path swapped to a symlink between check and
   open fails `EEXIST`/`ELOOP` rather than following (leaf-level race-safe). Anything that is not a regular file at
   the target refuses.

4. **Exact staging (never `git add -A`, step 6e).** `git add -- <fence-validated file list>` only, then the staged
   set is read back via porcelain status and must equal the candidate file list exactly. An unrelated / untracked /
   planted file can never enter the candidate commit. → `candidate:staging-mismatch`.

5. **No partial candidate on failure.** Any refusal after worktree creation disposes the worktree AND deletes the
   just-created candidate branch (the only ref mutation this module may perform — argv hard-coded to that one
   branch, not routed through the general git allowlist, so the general surface cannot widen). Every refusal — at
   any layer — emits a content-free, reason-classed receipt (reason class + short candidate prefix only).

6. **Isolation preserved.** The existing post-check still proves HEAD/main refs and the primary working tree are
   byte-identical after materialization; the worktree stays outside the repo root.

Two new reason classes: `candidate:unsafe-write-path`, `candidate:staging-mismatch`. No AUMLOK/authority/fence law
changed; no new dependency; no broad refactor (single file + one test file).

## Attacks defeated (`apps/seed/test/r43.candidate-integrity.test.ts`, 6 tests)

- **LEAF symlink** committed into HEAD (`apps/seed/src/leaked.ts` → out-of-tree secret), checked out into the fresh
  worktree, write aimed at it → refused `candidate:unsafe-write-path`; the secret is byte-identical; worktree +
  branch cleaned up; refusal receipted.
- **NESTED symlinked directory** committed into HEAD (`apps/seed/src/linked` → out-of-tree dir), write aimed under
  it → refused; nothing written into the out-of-tree directory; no residue.
- **Out-of-worktree-root / identity-changing target** (`apps/seed/../../escape.ts`) → refused before any write
  (layered: lexical fence ∪ identity check); content-free receipt; no residue.
- **Backslash / non-normalized variants** (`./`, `//`, `\`, trailing `/`) → all refuse (fence ∪ identity), no write.
- **Case-fold duplicate targets** (`x.ts` + `X.ts`) → refused `candidate:unsafe-write-path` (unique to the identity
  layer).
- **Happy path** commits EXACTLY the candidate file list (`git show --name-only` == `[TARGET]`) — no stray file
  swept by a bulk add.

## Headless link (help for Sam 1 — NO second orchestrator)

The model-free stages already compose in ONE place: `apps/seed/src/localCeremonyRunner.ts`
`runLocalRecursionCeremony(env, invocation)` → `runGovernedRecursion` (rehearsal) → `materializeCandidate` (this
module) via the shared `CandidateReferenceMonitor` (the one authorization). For the headless proof, wire the two
existing advisory/owner surfaces into THAT runner rather than adding an orchestrator:
- **Fu advisory** enters as `env.review` via `reviewerFor(runFuAdvisory(...))` — advisory-only, `grantsAuthority:false`;
- **owner gesture** enters through `approveDoor.handleApprove` (WAVE 2), whose sole allowed outcome routes the same
  `CandidateReferenceMonitor.decide()` the runner uses — AUMLOK stays the only owner authority.
No new orchestrator, no new authorization path: Fu advises, AUMLOK decides, this stage writes only inside the
disposable worktree.

## Tests / verify (env cleared of `AUKORA_*`, serialized)

seed **263/263** (+6) · council **65/65** · council-node **5/5** · kernel **19/19** · seed typecheck 0 ·
public-tree scan PASS. No paid calls; no main write; live tree byte-identical.
