// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
//
// Spatial shell — the inside-out organism frame. It composes the SHARED panel renderers (window.AukoraPanels)
// into a geometric information architecture (Triangle: AUMA LIVE · Square: AUMLOK/AURA/SPATIAL MAP/SETTINGS ·
// Circle: KNVS). It duplicates no panel. Pure presentation: NO network, NO secret, and NO control that can
// sign, authorize, apply, merge, deploy, or arm anything. The SPATIAL MAP is drawn from the fixture's real
// organism graph, not a decorative static diagram.
"use strict";

(function () {
  const F = globalThis.AUKORA_CONSOLE_FIXTURE;
  const P = window.AukoraPanels;
  const loading = document.getElementById("shell-loading");
  if (!F || !P) {
    if (loading) loading.textContent = "Fixture or panels not found — run `npm run fixture` to generate it.";
    return;
  }
  if (loading) loading.remove();

  const SVGNS = "http://www.w3.org/2000/svg";
  function svg(tag, attrs) {
    const n = document.createElementNS(SVGNS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function grid(sections) {
    const g = P.el("div", "zone-grid");
    sections.forEach((s) => g.appendChild(s));
    return g;
  }
  function zoneHead(glyph, shape, name, desc, chip) {
    const h = P.el("div", "zone-head");
    h.appendChild(P.el("span", "zone-glyph zone-glyph--" + shape, glyph));
    const t = P.el("div", "zone-headtext");
    t.appendChild(P.el("h2", "zone-title", name));
    t.appendChild(P.el("p", "zone-desc", desc));
    h.appendChild(t);
    if (chip) h.appendChild(chip);
    return h;
  }
  const modeChip = () => P.el("span", "chip chip--implemented mode-chip", F.dataMode);
  function banner(kind, text) {
    const b = P.el("p", "zone-banner zone-banner--" + kind);
    b.appendChild(document.createTextNode(text));
    return b;
  }

  // ── Triangle: AUMA LIVE ───────────────────────────────────────
  function buildAuma(host) {
    const a = F.auma;
    host.appendChild(zoneHead("▲", "triangle", "AUMA LIVE", "The live advisory presence. Provider output is untrusted advisory context.", modeChip()));
    const strip = P.el("div", "advisory");
    const head = P.el("div", "advisory-head");
    head.appendChild(P.pill("UNTRUSTED ADVISORY", "warn"));
    head.appendChild(P.el("span", "advisory-cannot", "cannot: " + a.cannot.join(" · ")));
    strip.appendChild(head);
    strip.appendChild(P.kv([
      ["Provider", a.providerId, true],
      ["Prompt", a.advisoryPrompt],
      ["Advisory output", a.advisoryOutput, true],
      ["Council advisory verdict", a.councilVerdict],
    ]));
    strip.appendChild(P.note(a.note));
    host.appendChild(strip);
    host.appendChild(grid([P.render.council(F)])); // reuse the advisory council panel
  }

  // ── Square: AUMLOK ────────────────────────────────────────────
  function buildAumlok(host) {
    host.appendChild(zoneHead("■", "square", "AUMLOK", "Ceremony and verification state. Key custody and signing stay outside the browser.", modeChip()));
    host.appendChild(banner("lock", "Private-key custody and signing remain OUTSIDE browser state. Only the owner-gate authorizes; no model, and not this shell, can sign."));
    host.appendChild(grid([P.render.authority(F), P.render.recursion(F)]));
  }

  // ── Square: AURA ──────────────────────────────────────────────
  function buildAura(host) {
    host.appendChild(zoneHead("■", "square", "AURA", "Trace epochs, receipt/Merkle lineage, erasure state, and truth labels.", modeChip()));
    const legend = P.el("div", "aura-legend");
    Object.entries(F.meta.truthLegend).forEach(([k, v]) => {
      const row = P.el("span", "aura-legend-item");
      row.appendChild(P.truthChip(k));
      row.appendChild(P.el("span", "aura-legend-desc", v));
      legend.appendChild(row);
    });
    host.appendChild(legend);
    host.appendChild(grid([P.render.memory(F), P.render.lineage(F), P.render.forgetting(F)]));
  }

  // ── Square: SPATIAL MAP (data-driven) ─────────────────────────
  function buildMap(host) {
    const sp = F.spatial;
    host.appendChild(zoneHead("■", "square", "SPATIAL MAP", "Driven from live organism data — not a decorative diagram.", modeChip()));

    const seats = sp.nodes.filter((n) => n.kind === "seat");
    const chain = sp.nodes.filter((n) => n.id.indexOf("chain:") === 0);
    const W = 820, H = 470;
    const pos = {
      auma: [380, 235],
      authority: [380, 66],
      proposal: [170, 132],
      provider: [170, 360],
      council: [560, 150],
    };
    // Council seats as a clean vertical column to the right (labels never overlap).
    const colX = 680, colY0 = 44, colDY = seats.length > 1 ? (400 / (seats.length - 1)) : 0;
    seats.forEach((n, i) => { pos[n.id] = [colX, colY0 + i * colDY]; });
    // Receipt chain as a spine along the bottom.
    const cX0 = 230, cDX = 96, cY = 428;
    chain.forEach((n, i) => { pos[n.id] = [cX0 + i * cDX, cY]; });

    const fig = P.el("figure", "spatial-fig");
    const label = "Spatial map: " + sp.nodes.length + " nodes, " + sp.edges.length + " edges — 1 core, AUMLOK authority, "
      + "offline provider, Fu council with " + sp.derivedFrom.seats + " seats, " + sp.derivedFrom.chainEntries
      + " receipt-chain entries, " + sp.derivedFrom.proposals + " proposal.";
    const s = svg("svg", { viewBox: "0 0 " + W + " " + H, class: "spatial-svg", role: "img", "aria-label": label });

    const eLayer = svg("g", { class: "edges" });
    sp.edges.forEach((e) => {
      const a = pos[e.from], b = pos[e.to];
      if (!a || !b) return;
      eLayer.appendChild(svg("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: "edge edge--" + e.kind }));
    });
    s.appendChild(eLayer);

    const R = { core: 26, authority: 16, provider: 14, council: 18, proposal: 14, seat: 9, memory: 11, tombstone: 11 };
    sp.nodes.forEach((n) => {
      const p = pos[n.id]; if (!p) return;
      const g = svg("g", { class: "node node--" + n.kind, tabindex: "-1" });
      g.appendChild(svg("circle", { cx: p[0], cy: p[1], r: R[n.kind] || 10, class: "node-dot" }));
      const below = n.kind !== "core"; // only the AUMA core carries its label inside the dot
      const tx = svg("text", { x: p[0], y: p[1] + (below ? (R[n.kind] || 10) + 13 : 4), class: "node-label", "text-anchor": "middle" });
      tx.textContent = n.label;
      g.appendChild(tx);
      g.appendChild(svg("title", {})).textContent = n.kind + ": " + n.label;
      s.appendChild(g);
    });
    fig.appendChild(s);

    const cap = P.el("figcaption", "spatial-cap");
    cap.appendChild(P.el("span", null, "Derived from real data — "));
    cap.appendChild(P.el("strong", null, sp.derivedFrom.seats + " council seats"));
    cap.appendChild(document.createTextNode(", "));
    cap.appendChild(P.el("strong", null, sp.derivedFrom.chainEntries + " chain entries"));
    cap.appendChild(document.createTextNode(", "));
    cap.appendChild(P.el("strong", null, sp.derivedFrom.proposals + " proposal"));
    cap.appendChild(document.createTextNode(" · receipt at chain index " + sp.derivedFrom.receiptChainIndex + "."));
    fig.appendChild(cap);
    host.appendChild(fig);
    host.appendChild(P.note(sp.note));
  }

  // ── Square: SETTINGS ──────────────────────────────────────────
  function buildSettings(host) {
    host.appendChild(zoneHead("■", "square", "SETTINGS", "Provider mode, persistence mode, hard limits, and read-only health. Never raw secrets.", modeChip()));

    // Data-mode selector shown as labels (read-only; the active one is highlighted).
    const modes = P.el("div", "mode-row");
    F.dataModes.forEach((m) => modes.appendChild(P.pill(m, m === F.dataMode ? "ok" : "info")));
    host.appendChild(modes);

    const health = P.el("div", "outcome");
    health.appendChild(P.el("h3", null, "Read-only health"));
    health.appendChild(P.kv([
      ["Read-only", P.yn(F.readOnly)],
      ["Any surface grants authority", P.yn(F.authority.grantsAuthority || F.providers.grantsAuthority || F.council.grantsAuthority)],
      ["Receipt chain verifies", P.yn(F.lineage.verified)],
      ["Council quorum met", P.yn(F.council.quorumMet)],
      ["Actual spend", "$" + F.budget.actualUsd.toFixed(2)],
      ["G1 / replication", F.g1.state],
      ["Active data source", F.dataMode],
    ]));
    health.appendChild(P.el("p", null, "No raw secrets are exposed: only public keys, hashes, and truth labels."));
    host.appendChild(health);

    host.appendChild(grid([P.render.providers(F), P.render.convex(F), P.render.budget(F), P.render.g1(F)]));
  }

  // ── Circle: KNVS (honest placeholder) ─────────────────────────
  function buildKnvs(host) {
    const k = F.knvs;
    host.appendChild(zoneHead("●", "circle", "KNVS", "An open frontier — not yet built on this path.", P.truthChip(k.truth)));
    const box = P.el("div", "knvs-placeholder");
    box.appendChild(P.pill("PLACEHOLDER · " + k.state, "info"));
    box.appendChild(P.note(k.note));
    host.appendChild(box);
  }

  // ── Build every zone once ─────────────────────────────────────
  buildAuma(document.getElementById("panel-auma"));
  buildAumlok(document.getElementById("panel-aumlok"));
  buildAura(document.getElementById("panel-aura"));
  buildMap(document.getElementById("panel-map"));
  buildSettings(document.getElementById("panel-settings"));
  buildKnvs(document.getElementById("panel-knvs"));

  // ── Tablist controller (roving tabindex + arrow keys) ─────────
  const rail = document.getElementById("shape-rail");
  const tabs = Array.from(rail.querySelectorAll('[role="tab"]'));
  function select(tab, focus) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
    });
    if (focus) tab.focus();
  }
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => select(t, false));
    t.addEventListener("keydown", (e) => {
      let ni = null;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") ni = (i + 1) % tabs.length;
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") ni = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === "Home") ni = 0;
      else if (e.key === "End") ni = tabs.length - 1;
      if (ni !== null) { e.preventDefault(); select(tabs[ni], true); }
    });
  });

  // ── Header / footer chrome ────────────────────────────────────
  const badge = document.getElementById("mode-badge");
  if (badge) badge.textContent = F.dataMode;
  const prov = document.getElementById("shell-provenance");
  if (prov) prov.textContent = F.provenance + " Seed instant " + F.generatedFromSeedInstant + ".";
})();
