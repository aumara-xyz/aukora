<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# R51 · lifecycle-custody live transcript — one real boot → worker kill → restart → down

Sanitized live run (issue #107). Ephemeral PIDs/PGIDs are kept as required evidence; **no token, key, or
signature value appears** (the per-boot mind-door token stays in its 0600 file and is never echoed). Local
self-hosted Convex only (loopback `127.0.0.1:3210`); no cloud, no paid calls.

- **Base:** public main `5aae90d6a84d2aedf9e5df3ebc5744d8b9c2fb7d`; branch `sam/r51-lifecycle`.
- **Box runtime:** the supervisor CLI ran on Node `v26.4.0`; Convex used its cached backend and Node 22 for
  its own subprocess (`convexHold` side-install). Owned ports empty at preflight.

## 1. Boot — the supervisor records the ACTUAL listener + process group (not merely the wrapper)

`node src/supervisor.mjs up` returned cleanly in ~17s. Pid records written (`state/<svc>.<port>.pid`, JSON v1):

```
convex-backend :3210  { wrapperPid: 68453, pgid: 68453, listenerPid: 68501 }
brain-door     :7141  { wrapperPid: 68522, pgid: 68522, listenerPid: 68522 }   (in-process await import → no divergence)
mind-door      :7097  { wrapperPid: 68609, pgid: 68609, listenerPid: 68663 }
spatial-shell  :7096  { wrapperPid: 68886, pgid: 68886, listenerPid: 68886 }
voice-sidecar  :7098  not-ready (optional; no venv) — degraded LOUDLY, not a boot failure
```

### The R50 wrapper/worker divergence, reproduced and now OWNED

```
MIND-DOOR :7097
  recorded wrapperPid = 68609   (npm exec tsx apps/seed/scripts/mind-door-7097.ts)   ← what the old code recorded
  ACTUAL listener      = 68663   (node … mind-door-7097)                              ← the real worker (finding a)
  listener pgid        = 68609   == recorded pgid  ⇒ in our owned group

CONVEX :3210  — full subtree, ALL in one owned group (pgid 68453):
  pid=68453 ppid=1     pgid=68453  node apps/brain/scripts/convexHold.mjs            ← group leader (wrapper)
  pid=68554 ppid=68453 pgid=68453  npm exec convex dev …
  pid=68593 ppid=68554 pgid=68453  node …/.bin/convex …
  pid=68597 ppid=68593 pgid=68453  ~/.cache/convex/binaries/precompiled-… (LISTENER)  ← finding b: ≠ wrapper 68453
```

Both R50 findings are visible: the recorded wrapper pid is **not** the listener, and the Convex backend binary
is a grandchild of its wrapper. Both listeners share the recorded **pgid**, so a single group signal reaches the
whole tree.

## 2. Crash/restart retains the R50 Convex workflow state

Tokened `POST /api/propose` (no owner auth → `refused-owner-gate`, retryable → the row persists `awaiting-owner`):

```
workflowId = 9a7a1acf95e4…   phase refused-at-owner  touchedMain false   (content-free hash; 12-hex prefix, as the door exposes it)
Convex row BEFORE crash:  { version: 2, phase: awaiting-owner, stage: refused-owner-gate, updatedAtIso: 2026-07-17T12:33:14.675Z }
```

SIGKILL the mind-door **process group** (a full crash), leaving Convex (the DB) up:

```
kill -9 -68609
  wrapper  68609 alive? no
  listener 68663 alive? no
  :7097 -> empty              (no orphaned listener — the R50 failure mode, gone)
  :3210 -> 68597              (Convex DB stays up)
```

Restart via `node src/supervisor.mjs up` — the single-lifecycle-owner law holds: only the dead service restarts:

```
▸ probed  · convex-backend :3210     (UP-OURS — not restarted)
▸ probed  · brain-door     :7141     (UP-OURS — not restarted)
▸ started · mind-door      :7097     (the dead one — new wrapperPid 79717, new listenerPid 79750)
▸ probed  · spatial-shell  :7096     (UP-OURS — not restarted)

Convex row AFTER crash+restart: { version: 2, phase: awaiting-owner, stage: refused-owner-gate, updatedAtIso: 2026-07-17T12:33:14.675Z }
  → BYTE-IDENTICAL (same version, same updatedAtIso = genuinely persisted, not rewritten)
Idempotent re-propose through the restarted door → resumed workflowId 9a7a1acf95e4… (matches = true)
```

## 3. `down` terminates the full owned tree → every owned port empty (zero residue)

```
ports BEFORE down:  :3210→68597  :7096→68886  :7097→79750  :7141→68522
node src/supervisor.mjs down
▸ stopped · spatial-shell :7096
▸ stopped · mind-door     :7097
▸ stopped · brain-door    :7141
▸ stopped · convex-backend :3210
▸ token-cleared
▸ teardown-verified
{ "teardown": "clean", "ownedPortsEmpty": true, "residue": [] }

independent sweep AFTER down:  :3210 :3211 :7096 :7097 :7098 :7100 :7141  → ALL empty
stray convex/mind-door/door processes (the R50 residue class): NONE
pid records: all removed
```

The Convex backend `68597` that outlived teardown at R50 is now reaped by the group signal.

## 4. A foreign listener is reported clearly and never killed

A foreign HTTP listener planted on the mind-door port (pid `80456`, not started by us):

```
▸ isolated · mind-door — port occupied by a foreign process — refusing to adopt or kill it :7097   (on up)
  foreign 80456 alive? YES — never killed ✓
▸ isolated · mind-door — foreign occupant left untouched on down :7097                              (on down)
  foreign 80456 alive after down? YES ✓
(then we killed the process WE planted; :7097 → empty)
```

## 5. Runtime lane (evidence only, no unsupported claim)

- Supervisor lifecycle suite: **31/31 on Node 22 (`v22.23.1`)** and on Node 26 (`v26.4.0`).
- `convexHold` supported runtimes: `[18, 20, 22, 24]` (side-installs Node 22 when the ambient runtime is outside
  the set); brain-door bundle targets `node20`.
- Conclusion: Node 22 is evidenced as a viable canonical runtime; Node 20 remains in the declared compatibility
  set. Node 20 was **not installed** on this box, so no Node-20 result is asserted — only its declared support.

## Safety envelope (unchanged)

No authority, signer, or owner key exists anywhere in the supervisor path (tested). The closed envelope, the
protected-surface pin (`protected.sha256`, re-pinned this round via the approved ceremony), and the
`grantsAuthority:false` receipts are all intact.
