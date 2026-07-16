// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
//
// Read-only contract resolvers. The shell consumes two upstream contracts:
//   • Sam 2 · BrainHealthSnapshotV1   (the local-brain health snapshot)
//   • Sam 3 · aumlok-ceremony-design-v0 (the read-only AUMLOK ceremony design)
// The shell makes NO network call (that is a tested safety property). Instead a host or launcher may INJECT
// a live value as a plain global (the same mechanism fixture.js uses) — e.g. `live-brain.js` served by the
// local brain, or `live-ceremony.js` served by the ceremony lane. If a valid live global is present it is
// used and labelled `live`; otherwise the committed fixture value is used and labelled `fixture-fallback`.
// Either way the browser holds no key, performs no signing, and grants no authority.
"use strict";

window.AukoraContracts = (function () {
  function brainHealth(F) {
    const live = globalThis.AUKORA_BRAIN_HEALTH;
    if (live && live.schema === "BrainHealthSnapshotV1" && live.grantsAuthority === false) {
      return Object.assign({}, live, { source: live.source || "live" });
    }
    return Object.assign({}, F.brainHealth, { source: "fixture-fallback" });
  }
  function ceremony(F) {
    const live = globalThis.AUKORA_CEREMONY;
    if (live && live.schema === "aumlok-ceremony-design-v0" && live.grantsAuthority === false) {
      return Object.assign({}, live, { source: live.source || "live" });
    }
    return Object.assign({}, F.ceremony, { source: "fixture-fallback" });
  }
  // Truthful label for the UI: 'live' when a host injected the contract, else 'fixture-fallback'.
  function sourceLabel(resolved) { return resolved.source === "live" ? "LIVE" : "FIXTURE"; }
  return { brainHealth, ceremony, sourceLabel };
})();
