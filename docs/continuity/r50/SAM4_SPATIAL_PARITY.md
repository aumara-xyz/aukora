# SAM 4 · R50 #101 — Spatial donor parity (fresh ledger + Console removed from the visible roster)

**Lane:** Sam 4 · **Issue:** #23 / #101 · **Base:** canonical `main@4fc6e09c` · **Donor transplant commit:**
`41707f910d10696482c28ee80346c252a55e9d41` (owner-approved Symbiote source) · **Claims tier:** donor-exact
transplant + one strictly-necessary boundary subtraction. No redesign.

## Owner action landed — Console removed from the VISIBLE roster

Per owner direction, `console` is removed from the registry, the System menu, and its import in
`apps/spatial/app/shell.js`. **`apps/spatial/app/console.js` is RETAINED on disk** (kept, not deleted) —
it is simply no longer mounted, so it is not surfaced as a selectable organ. The manifest file-count split is
unchanged (46 VERBATIM / 10 ADAPTED / 8 NEW / 45 EXCLUDED); only the **visible roster shrank 10 → 9 organs**.
`shell.js`'s ADAPTED sha256 pin was updated in the same change (self-consistency tamper pin).

### Live interaction trace (verified, not asserted)

Served the shell locally and read the rendered System tab. The System roster is now exactly:

```
SYSTEM
  AUMLOK        — the gate — where your signature lands
  AURA          — your coherence, taking shape — evidence, never authority
  Kira Memory   — atoms · receipts · recall
  Spatial Map   — the codebase as a physics grid
  Golden Horizon— the boundary research — honest experiments and scoreboard
  Settings      — add your OpenRouter key — talk to Auma
```

**Console is absent.** (Apps tab = Auma·Live, Auma·Lingwa; Yours tab = + New App — both unchanged.) The
`transplant.test.mjs` roster assertions were updated to the Console-less roster and re-verified green, so the
removal is enforced by the gate, not just observed once.

## Fresh donor-parity ledger (byte provenance vs the owner-approved source)

Every selected-roster surface re-checked against donor commit `41707f91`. A VERBATIM file whose recorded
`donorBlob` equals the byte in that commit is **committed donor bytes**; ADAPTED files are ours (boundary
adaptations, self-pinned); EXCLUDED surfaces are absent-by-design. Machine-readable:
`apps/spatial/docs/parity/PARITY_LEDGER.json`.

| surface | file | disposition | pin | donor blob | tier |
|---|---|---|---|---|---|
| icons + palette | `app/style.css` | VERBATIM | OK | `4ee31c87a4` | **COMMITTED donor bytes** |
| menu order/motion | `app/shell.js` | ADAPTED | OK | `4599340d34` | ADAPTED boundary (ours) |
| chat pin/archive | `app/chat.js` | ADAPTED | OK | `6cb252fe6b` | ADAPTED boundary (ours) |
| onboarding | `app/onboarding.js`, `app/focus.js` | EXCLUDED | absent | `cc306c85c2` / `a600bf47d8` | committed donor bytes, **NOT shipped** (next brick) |
| AUMLOK | `app/aumlok.js` | VERBATIM | OK | `877bb3c129` | **COMMITTED donor bytes** |
| AURA | `app/aura.js`, `app/aura-core.js` | VERBATIM | OK | `00588ea088` / `0487945861` | **COMMITTED donor bytes** |
| Lingwa | `app/auma/auma.js` | VERBATIM | OK | `d589c376dc` | **COMMITTED donor bytes** |
| voice | `voice/sidecar.py` | ADAPTED | OK | `41ce589a4c` | ADAPTED boundary (ours) |
| KNVS (App-Lab) | `app/canvas.js` | VERBATIM | OK | `73524cec0f` | **COMMITTED donor bytes** |
| GHP | `app/ghp.js` | VERBATIM | OK | `6804ef7498` | **COMMITTED donor bytes** |
| Map | `app/map/map.js` | VERBATIM | OK | `809f8dc370` | **COMMITTED donor bytes** |

Full-tree re-verification (`npm run verify:provenance --workspace @aukora/spatial`, `DONOR_DIR` set):
**46 VERBATIM byte-identical to donor@41707f91, 45 EXCLUDED dispositions verified, 0 mismatches.**

### Committed donor bytes vs uncommitted live-lab bytes

- **Every shipped roster surface is committed donor bytes** (VERBATIM byte-identical to `41707f91`) or an
  ADAPTED boundary file (ours). **None of the shipped roster rides on uncommitted live-lab bytes.**
- The donor's known **uncommitted live-lab** rewrites (e.g. the 843-line working-tree `agora.js` iteration that
  was never committed) are all in the **EXCLUDED** set — never shipped. `agora.js` is EXCLUDED.
- **Onboarding** (`onboarding.js` + `focus.js`) is a *committed* donor surface that is currently **EXCLUDED**
  from the roster. It is the cleanest **next smallest brick**: if the owner wants onboarding, it transplants
  byte-exact from `41707f91` (blobs `cc306c85…` / `a600bf47…`) with no live-lab ambiguity.

## Next smallest bricks (owner's call)

1. **Onboarding** — transplant the committed donor `onboarding.js` + `focus.js` byte-exact, wire into the shell
   boot. Provable in one round.
2. **Icons/motion pixel parity** — `style.css` is byte-identical to the donor; a fixed-viewport visual diff vs a
   donor-served reference would raise the claim from *byte parity* to *pixel parity* (needs the donor shell
   served on this node — currently out-of-root for the preview harness).
3. **console.js disposition** — if the owner wants Console fully gone (not just unmounted), reclassify
   `console.js` from retained-NEW to removed; this round keeps the file per "files kept."

## Fences honored

Read-only console lane; the only runtime change is the owner-directed Console subtraction (registry/menu/import)
in my owned `apps/spatial`. No donor service touched; no secrets; branch/PR only. The live check used a
throwaway copy of the shell under the preview root (removed after) and the shared `.claude/launch.json` was
restored — no lasting change outside the worktree.
