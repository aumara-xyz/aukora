// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
//
// Aukora Spatial — trinity shell (R31 parity build). Faithful port of the donor state machine
// (aukora-symbiote/spatial/app/shell.js): lane widths come from two dividers (a, d) on a 3-unit track
// (0 <= a <= d <= 3): left = a/3, center = (d-a)/3, right = (3-d)/3. A corner ALWAYS pushes its pane out
// a third, unless already at the far wall, then it pulls in a third. Read-only: mounts apps, signs nothing.
"use strict";

(function () {
  const F = globalThis.AUKORA_CONSOLE_FIXTURE;
  const A = window.AukoraApps;
  const P = window.AukoraPanels;
  if (!F || !A || !P) { document.body.insertAdjacentText("afterbegin", "Fixture/apps not loaded — run `npm run fixture`."); return; }

  // ── lane state machine ─────────────────────────────────────────
  const state = { a: 1, d: 2 };
  const laneL = document.getElementById("lane-l");
  const laneC = document.getElementById("lane-canvas");
  const laneR = document.getElementById("lane-r");
  const sliverL = document.getElementById("sliver-l");
  const sliverR = document.getElementById("sliver-r");
  const mobileQuery = window.matchMedia("(max-width: 680px)");
  let mobilePane = "canvas";

  function applyLanes() {
    const widths = [state.a, state.d - state.a, 3 - state.d];
    if (mobileQuery.matches) {
      const primary = { node: 0, canvas: 1, menu: 2 }[mobilePane] ?? 1;
      [laneL, laneC, laneR].forEach((lane, i) => {
        lane.classList.toggle("mobile-hidden", i !== primary);
        lane.classList.remove("collapsed");
        lane.style.flexGrow = "1";
      });
      sliverL.classList.remove("on"); sliverR.classList.remove("on");
    } else {
      [laneL, laneC, laneR].forEach((lane, i) => {
        const w = widths[i];
        lane.classList.remove("mobile-hidden");
        lane.style.flexGrow = w > 0 ? String(w) : "0.0001";
        lane.classList.toggle("collapsed", w === 0);
      });
      sliverL.classList.toggle("on", widths[0] === 0);
      sliverR.classList.toggle("on", widths[2] === 0);
    }
  }
  mobileQuery.addEventListener("change", applyLanes);

  // Corner rules (mirror the donor exactly). Side corners PUSH: the side lane grows a third, the center
  // width is preserved, the FAR side lane yields; if already full, pull in a third.
  const corners = {
    node() { if (state.a === 3) { state.a -= 1; } else { state.a += 1; state.d = Math.min(3, state.d + 1); } },
    menu() { if (state.d === 0) { state.d += 1; } else { state.d -= 1; state.a = Math.max(0, state.a - 1); } },
    canvasLeft() { if (state.a === 0) { state.a += 1; state.d = Math.max(state.d, state.a); } else state.a -= 1; },
    canvasRight() { if (state.d === 3) { state.d -= 1; state.a = Math.min(state.a, state.d); } else state.d += 1; },
  };
  function corner(name, mobileDest) { if (mobileQuery.matches) mobilePane = mobileDest; else corners[name](); applyLanes(); }

  document.getElementById("corner-node").addEventListener("click", () => corner("node", "canvas"));
  document.getElementById("corner-menu").addEventListener("click", () => corner("menu", "canvas"));
  document.getElementById("corner-canvas-l").addEventListener("click", () => corner("canvasLeft", "node"));
  document.getElementById("corner-canvas-r").addEventListener("click", () => corner("canvasRight", "menu"));

  document.addEventListener("keydown", (e) => {
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    if (e.key === "[") corner("node", "canvas");
    else if (e.key === "]") corner("menu", "canvas");
    else if (e.key === ",") corner("canvasLeft", "node");
    else if (e.key === ".") corner("canvasRight", "menu");
  });

  // ── roster: three geometric families → one canonical portal (.row) per app ──────
  const ORGANS = {
    auma: { title: "AUMA LIVE", sub: "the live advisory presence — untrusted, guides proposals", mount: A.auma },
    aumlok: { title: "AUMLOK", sub: "the gate — where your signature lands (outside the browser)", mount: A.aumlok },
    aura: { title: "AURA", sub: "a living coherence pattern — evidence, never authority", mount: A.aura },
    map: { title: "Spatial Map", sub: "the organism as a physics grid — live data", mount: A.map },
    console: { title: "Console", sub: "the ten tested operator panels", mount: A.console },
    settings: { title: "Settings", sub: "provider · persistence · hard limits · read-only health", mount: A.settings },
    knvs: { title: "KNVS", sub: "the app lab — pixels only, drafts to the gate", mount: A.knvs },
  };
  const TABS = {
    triangle: { micro: "Live", rows: [
      { organ: "auma", label: "AUMA LIVE", gist: "the live advisory presence — untrusted context" },
    ] },
    square: { micro: "System", rows: [
      { organ: "aumlok", label: "AUMLOK", gist: "the gate — where your signature lands" },
      { organ: "aura", label: "AURA", gist: "your coherence, taking shape — evidence, never authority" },
      { organ: "map", label: "Spatial Map", gist: "the organism as a physics grid" },
      { organ: "console", label: "Console", gist: "the ten tested operator panels" },
      { organ: "settings", label: "Settings", gist: "provider · persistence · hard limits · health" },
    ] },
    circle: { micro: "Frontier", rows: [
      { organ: "knvs", label: "KNVS", gist: "the app lab — grow a screen, draft it to the gate" },
    ] },
  };

  let activeTab = "square";
  let activeOrgan = "console";
  const organHost = document.getElementById("organ-host");
  const menuList = document.getElementById("menu-list");
  const menuMicro = document.getElementById("menu-micro");
  const mounted = new Map();

  // Left lane is ALWAYS the Chats/Auma conversation (one being, one memory).
  const chat = window.AukoraChat ? window.AukoraChat.mount(document.getElementById("chat-mount"), F) : null;
  const chatBack = document.getElementById("corner-chat-back");
  if (chatBack && chat) chatBack.addEventListener("click", () => { chat.closeThread(); chatBack.hidden = true; });

  function renderMenu() {
    menuList.replaceChildren();
    for (const item of TABS[activeTab].rows) {
      const btn = document.createElement("button");
      btn.className = "row menu-row" + (item.organ === activeOrgan ? " selected" : "");
      btn.setAttribute("aria-current", item.organ === activeOrgan ? "true" : "false");
      const inner = P.el("span", "row-inner");
      inner.appendChild(P.el("span", "row-label", item.label));
      inner.appendChild(P.el("span", "row-gist", item.gist));
      btn.appendChild(inner);
      btn.addEventListener("click", () => setOrgan(item.organ, { collapseMenu: true }));
      menuList.appendChild(btn);
    }
  }

  function setOrgan(key, options = {}) {
    activeOrgan = key;
    document.getElementById("organ-title").textContent = ORGANS[key].title;
    document.getElementById("organ-sub").textContent = ORGANS[key].sub;
    for (const [k, node] of mounted) node.style.display = k === key ? "" : "none";
    if (!mounted.has(key)) {
      const root = document.createElement("div");
      root.className = "organ-mount";
      organHost.appendChild(root);
      mounted.set(key, root);
      ORGANS[key].mount(root, F);
    }
    renderMenu();
    // AUMA LIVE is directly conversational: opening it opens the Aukora thread in the chats lane.
    if (key === "auma" && chat) { chat.openThread(); document.getElementById("corner-chat-back").hidden = false; }
    // Selecting an app returns to the chats-plus-app composition (menu yields), like the donor.
    if (options.collapseMenu && !mobileQuery.matches && state.d < 3) { state.a = 2; state.d = 3; applyLanes(); }
  }

  // Tabs (▲ ■ ○)
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab;
      document.querySelectorAll(".tab-btn").forEach((b) => {
        const on = b === btn;
        b.classList.toggle("active", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
      if (menuMicro) menuMicro.textContent = TABS[activeTab].micro;
      renderMenu();
    });
  });

  // Hint card
  const hint = document.getElementById("hint-card");
  try { if (localStorage.getItem("aukora-spatial-hint") === "gone") hint.classList.add("gone"); } catch { /* ignore */ }
  document.getElementById("hint-dismiss").addEventListener("click", () => {
    hint.classList.add("gone");
    try { localStorage.setItem("aukora-spatial-hint", "gone"); } catch { /* ignore */ }
  });

  // Boot: default to the CONSOLE app on the Square family.
  document.querySelectorAll(".tab-btn").forEach((b) => {
    const on = b.dataset.tab === activeTab;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
  });
  if (menuMicro) menuMicro.textContent = TABS[activeTab].micro;
  applyLanes();
  setOrgan(activeOrgan);
  renderMenu();
})();
