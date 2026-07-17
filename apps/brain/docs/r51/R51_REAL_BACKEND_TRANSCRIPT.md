<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# R51 — REAL local self-hosted Convex canary transcript

Captured 2026-07-17T12:21:13Z. Command: `npm run canary:r51 --workspace @aukora/brain` (Node 22).
Backend: the official `convex-local-backend` FSL-1.1 binary (cached, run externally as a dev runtime —
use, not source incorporation), on loopback 127.0.0.1:3310/3311, temp SQLite storage discarded after.
NOT convex-test. The SIGKILL below is a genuine `process.kill(pid, 'SIGKILL')` of the running backend;
the restart reopens the SAME on-disk SQLite. No admin key or secret appears in this transcript.

```
[r51-canary] REAL backend: precompiled-2026-07-06-44f7aa7/convex-local-backend
[r51-canary] storage (temp, discarded): /var/folders/8h/5vp4lh4n69g1nn7ct9lf9nlc0000gn/T/r51-canary-U0en4S
[r51-canary] booting backend #1 (pid 66319) on http://127.0.0.1:3310 …
[r51-canary] backend #1 UP
[r51-canary] deploying canary functions (convex dev --once, self-hosted)…
[r51-canary] functions deployed
[r51-canary] PROOF 1 — typed event accepted once
  PASS  accepted, not deduplicated, seq 0
  PASS  durable log has exactly 1 row
[r51-canary] PROOF 2 — 10 identical submissions produce one canonical effect
  PASS  all 10 acknowledged; 10 deduplicated (the first commit was proof 1)
  PASS  durable log STILL exactly 1 row (one canonical effect)
  PASS  atomic snapshot eventCount === 1 (agrees with the log)
[r51-canary] PROOF 5 — one narrow reactive projection changes
  PASS  reactive subscription pushed an eventCount change (…→2)
  PASS  pre-crash SETTLED state: 2 events, snapshot eventCount 2
[r51-canary] PROOF 3 — actual process death (kill -9) then restart
  PASS  backend pid 66319 is gone (real SIGKILL)
[r51-canary] restarting backend #2 (pid 66354) on the SAME storage …
[r51-canary] backend #2 UP (restarted on the same on-disk SQLite)
  PASS  SETTLED state SURVIVED the crash: 2 durable events
  PASS  atomic snapshot survived and still agrees: eventCount 2
  PASS  global durable count unchanged across the crash
[r51-canary] PROOF 4 — restart produces no duplicate effect
  PASS  both redeliveries deduplicate (no new effect)
  PASS  durable log STILL exactly 2 rows — no duplicate effect after restart
  PASS  authority-claiming event REFUSED, not persisted
  PASS  durable log unchanged by the refused authority event
[r51-canary] 
[r51-canary] RESULT: ALL REAL-BACKEND LAWS HELD
```

**Process exit code: 0** (0 = all real-backend laws held).
