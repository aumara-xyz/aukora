// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
//
// Flat operator console. It reads the committed DEMO_FIXTURE global and lays the shared panel renderers
// (window.AukoraPanels) into a grid. Pure presentation: NO network request, NO secret, and NO control that
// can sign, authorize, apply, deploy, or arm anything. The spatial shell (shell.js) reuses the same
// renderers — this page never duplicates them.
"use strict";

(function () {
  const F = globalThis.AUKORA_CONSOLE_FIXTURE;
  const P = window.AukoraPanels;
  const panels = document.getElementById("panels");
  const loading = document.getElementById("loading");

  if (!F || !P) {
    if (loading) loading.textContent = "Fixture or panels not found — run `npm run fixture` to generate it.";
    return;
  }

  const ORDER = ["authority", "memory", "lineage", "recursion", "council", "providers", "budget", "convex", "g1", "forgetting"];
  const sections = ORDER.map((id) => P.render[id](F));
  sections.forEach((s) => panels.appendChild(s));
  if (loading) loading.remove();

  // In-page section nav (keyboard-accessible; moves focus to the target panel).
  const nav = document.getElementById("panel-nav");
  sections.forEach((s) => {
    const a = P.el("a", null, s.querySelector("h2").textContent);
    a.href = "#" + s.id;
    a.addEventListener("click", () => window.requestAnimationFrame(() => document.getElementById(s.id).focus()));
    nav.appendChild(a);
  });

  const fp = document.getElementById("footer-provenance");
  if (fp) fp.textContent = F.provenance + " Seed instant " + F.generatedFromSeedInstant + ".";

  const sub = document.getElementById("console-subtitle");
  if (sub && F.meta && F.meta.subtitle) sub.textContent = F.meta.subtitle;

  // Read-only download of the same public fixture, built from the in-memory global (works from file://).
  const dl = document.getElementById("download-fixture");
  if (dl) {
    dl.addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(F, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "aukora-console-fixture.json";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    });
  }
})();
