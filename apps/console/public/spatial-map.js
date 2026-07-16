// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
//
// Shared, data-driven spatial map. Builds the organism graph SVG from fixture.spatial (nodes/edges that
// equal the real organism state). Consumed by the shell's SPATIAL MAP app. Pure presentation, no network.
"use strict";

window.AukoraSpatialMap = (function () {
  const NS = "http://www.w3.org/2000/svg";
  function svg(tag, attrs) { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; }

  function build(F) {
    const sp = F.spatial;
    const seats = sp.nodes.filter((n) => n.kind === "seat");
    const chain = sp.nodes.filter((n) => n.id.indexOf("chain:") === 0);
    const W = 820, H = 470;
    const pos = { auma: [380, 235], authority: [380, 66], proposal: [170, 132], provider: [170, 360], council: [560, 150] };
    const colDY = seats.length > 1 ? 400 / (seats.length - 1) : 0;
    seats.forEach((n, i) => { pos[n.id] = [680, 44 + i * colDY]; });
    chain.forEach((n, i) => { pos[n.id] = [230 + i * 96, 428]; });

    const fig = document.createElement("figure");
    fig.className = "spatial-fig glass-card";
    fig.style.padding = "12px";
    const label = "Spatial map: " + sp.nodes.length + " nodes, " + sp.edges.length + " edges — 1 core, AUMLOK authority, "
      + "offline provider, Fu council with " + sp.derivedFrom.seats + " seats, " + sp.derivedFrom.chainEntries
      + " receipt-chain entries, " + sp.derivedFrom.proposals + " proposal.";
    const s = svg("svg", { viewBox: "0 0 " + W + " " + H, class: "spatial-svg", role: "img", "aria-label": label });
    s.style.width = "100%"; s.style.height = "auto";

    const eLayer = svg("g", {});
    sp.edges.forEach((e) => {
      const a = pos[e.from], b = pos[e.to]; if (!a || !b) return;
      eLayer.appendChild(svg("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: "edge edge--" + e.kind }));
    });
    s.appendChild(eLayer);

    const R = { core: 26, authority: 16, provider: 14, council: 18, proposal: 14, seat: 9, memory: 11, tombstone: 11 };
    sp.nodes.forEach((n) => {
      const p = pos[n.id]; if (!p) return;
      const g = svg("g", { class: "node node--" + n.kind });
      g.appendChild(svg("circle", { cx: p[0], cy: p[1], r: R[n.kind] || 10, class: "node-dot" }));
      const below = n.kind !== "core";
      const tx = svg("text", { x: p[0], y: p[1] + (below ? (R[n.kind] || 10) + 13 : 4), class: "node-label", "text-anchor": "middle" });
      tx.textContent = n.label;
      g.appendChild(tx);
      const title = svg("title", {}); title.textContent = n.kind + ": " + n.label; g.appendChild(title);
      s.appendChild(g);
    });
    fig.appendChild(s);

    const cap = document.createElement("figcaption");
    cap.className = "spatial-cap app-note";
    cap.textContent = "Derived from real data — " + sp.derivedFrom.seats + " council seats, " + sp.derivedFrom.chainEntries
      + " chain entries, " + sp.derivedFrom.proposals + " proposal · receipt at chain index " + sp.derivedFrom.receiptChainIndex + ".";
    fig.appendChild(cap);
    return fig;
  }

  // Map-specific edge/node colours (kept here so both the shell and the flat pages share them).
  function injectStyle() {
    if (document.getElementById("aukora-map-style")) return;
    const s = document.createElement("style"); s.id = "aukora-map-style";
    s.textContent = `
      .edge { stroke: var(--glass-border); stroke-width: 1.2; opacity: 0.7; }
      .edge--seat { stroke: rgba(255,255,255,0.08); opacity: 0.6; }
      .edge--owner-gate { stroke: #e2b04a; stroke-dasharray: 4 3; opacity: 0.85; }
      .edge--receipt { stroke: rgb(var(--hue-l)); stroke-dasharray: 4 3; opacity: 0.85; }
      .node-dot { stroke: var(--stage-base); stroke-width: 1.5; }
      .node-label { fill: var(--dim); font: 600 11px var(--sans); }
      .node--core .node-dot { fill: rgb(var(--hue-c)); }
      .node--core .node-label { fill: var(--text); font-size: 13px; }
      .node--authority .node-dot { fill: #e2b04a; }
      .node--provider .node-dot { fill: rgba(var(--hue-r), 0.85); }
      .node--council .node-dot { fill: rgb(var(--hue-l)); }
      .node--proposal .node-dot { fill: rgb(var(--hue-c)); }
      .node--seat .node-dot { fill: var(--faint); }
      .node--seat .node-label { font-size: 10px; fill: var(--faint); }
      .node--memory .node-dot { fill: rgba(var(--hue-c), 0.8); }
      .node--tombstone .node-dot { fill: var(--faint); opacity: 0.7; }
      .node--memory .node-label, .node--tombstone .node-label { font-size: 10px; }
    `;
    document.head.appendChild(s);
  }

  function mount(host, F) { injectStyle(); host.appendChild(build(F)); }
  return { mount, build };
})();
