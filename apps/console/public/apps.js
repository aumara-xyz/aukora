// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
//
// Center-mount apps for the spatial shell. Each app is `mount(host, F)` and renders into the center lane.
// Apps REUSE the tested operator panels (window.AukoraPanels) and the shared spatial map — nothing here
// re-implements a panel. Everything is READ-ONLY and advisory. KNVS ports the donor's safe sandbox law
// (allow-scripts-only opaque iframe, strict in-document CSP, draft-proposal-only, continuity keys) — it is
// a real playful lab, not a placeholder; it can render pixels but never files, never authority.
"use strict";

window.AukoraApps = (function () {
  const P = window.AukoraPanels;
  const el = P.el;

  function grid(sections) { const g = el("div", "zone-grid"); sections.forEach((s) => g.appendChild(s)); return g; }
  function card(title, truth) {
    const c = el("div", "glass-card");
    if (title) { const h = el("h3", null, title); if (truth) h.appendChild(el("span", "pill pill-faint", truth)); c.appendChild(h); }
    return c;
  }
  function kvLine(pairs) {
    const dl = el("dl", "kv-line");
    pairs.forEach(([k, v, mono]) => { dl.appendChild(el("dt", null, k)); dl.appendChild(el("dd", mono ? "mono" : null, v)); });
    return dl;
  }

  // ── CONSOLE — mounts all ten tested operator panels in the center pane ──────────
  function mountConsole(host, F) {
    const ORDER = ["authority", "memory", "lineage", "recursion", "council", "providers", "budget", "convex", "g1", "forgetting"];
    host.appendChild(grid(ORDER.map((id) => P.render[id](F))));
  }

  // ── SPATIAL MAP — data-driven graph ─────────────────────────────────────────────
  function mountMap(host, F) { window.AukoraSpatialMap.mount(host, F); }

  // ── AUMA LIVE — untrusted advisory presence ─────────────────────────────────────
  function mountAuma(host, F) {
    const a = F.auma;
    const strip = el("div", "glass-card");
    const head = el("div", "advisory-head"); head.style.display = "flex"; head.style.gap = "10px"; head.style.flexWrap = "wrap";
    head.appendChild(P.pill("UNTRUSTED ADVISORY", "warn"));
    head.appendChild(el("span", "app-note", "cannot: " + a.cannot.join(" · ")));
    strip.appendChild(head);
    strip.appendChild(kvLine([
      ["Provider", a.providerId, true],
      ["Prompt", a.advisoryPrompt],
      ["Advisory output", a.advisoryOutput, true],
      ["Council verdict", a.councilVerdict],
    ]));
    strip.appendChild(el("p", "app-note", a.note));
    host.appendChild(strip);
    host.appendChild(grid([P.render.council(F)]));
  }

  // ── AUMLOK + AURA — one connected witnessed ceremony (read-only) ─────────────────
  // AUMLOK is the gate face; AURA is the coherence/witness face. Both consume the SAME read-only ceremony
  // events. No private key, no signing, no custody in the browser — the signature lands outside this surface.
  function ceremonyCard(F) {
    const c = F.ceremony;
    const box = el("div", "glass-card");
    const h = el("h3", null, "Witnessed ceremony");
    h.appendChild(el("span", "pill pill-faint", "READ-ONLY"));
    box.appendChild(h);
    box.appendChild(el("p", "app-note", c.source));
    c.events.forEach((ev) => {
      const row = el("div", "ceremony-step");
      row.appendChild(el("span", "ceremony-dot ceremony-dot--" + ev.state));
      const t = el("div"); t.appendChild(el("div", null, ev.step));
      t.appendChild(el("div", "app-note", ev.detail));
      row.appendChild(t);
      box.appendChild(row);
    });
    box.appendChild(el("p", "app-note", c.note));
    return box;
  }
  function mountAumlok(host, F) {
    const banner = el("p", "zone-banner zone-banner--lock");
    banner.textContent = "Private-key custody and signing remain OUTSIDE browser state. The signature lands at the gate, not here.";
    banner.style.cssText = "margin:0 0 12px;padding:10px 14px;border-radius:10px;border-left:4px solid #e2b04a;background:rgba(226,176,74,0.12);color:#e2b04a;font-size:13px";
    host.appendChild(banner);
    host.appendChild(ceremonyCard(F));
    host.appendChild(grid([P.render.authority(F)]));
  }
  function mountAura(host, F) {
    const intro = el("div", "glass-card");
    intro.appendChild(el("h3", null, "Coherence · the witness"));
    intro.appendChild(el("p", "app-note", "AURA is the living pattern the same ceremony grows — evidence, never authority. It visualizes trace epochs, receipt/Merkle lineage, and erasure state."));
    host.appendChild(intro);
    host.appendChild(ceremonyCard(F));
    host.appendChild(grid([P.render.memory(F), P.render.lineage(F), P.render.forgetting(F)]));
  }

  // ── SETTINGS — provider / persistence mode, hard limits, read-only health ────────
  function mountSettings(host, F) {
    const modes = el("div", "glass-card");
    modes.appendChild(el("h3", null, "Data mode"));
    const row = el("div"); row.style.cssText = "display:flex;gap:8px;flex-wrap:wrap";
    F.dataModes.forEach((m) => {
      const cls = m === "DEMO_FIXTURE" ? "mode-tag--demo" : m === "CONVEX_TEST" ? "mode-tag--convex" : "mode-tag--live";
      const tag = el("span", "mode-tag " + cls, m);
      if (m !== F.dataMode) tag.style.opacity = "0.45";
      row.appendChild(tag);
    });
    modes.appendChild(row);
    modes.appendChild(el("p", "app-note", "Active source: " + F.dataMode + ". Convex mode: " + F.convex.current + "."));
    host.appendChild(modes);

    const health = el("div", "glass-card");
    health.appendChild(el("h3", null, "Read-only health · no raw secrets"));
    health.appendChild(kvLine([
      ["Read-only", P.yn(F.readOnly)],
      ["Any surface grants authority", P.yn(F.authority.grantsAuthority || F.providers.grantsAuthority || F.council.grantsAuthority)],
      ["Receipt chain verifies", P.yn(F.lineage.verified)],
      ["Council quorum met", P.yn(F.council.quorumMet)],
      ["Per-pass / per-day ceiling", "$" + F.budget.perPassUsd.toFixed(2) + " / $" + F.budget.perDayUsd.toFixed(2)],
      ["Actual spend", "$" + F.budget.actualUsd.toFixed(2)],
      ["G1 / replication", F.g1.state],
    ]));
    host.appendChild(health);
    host.appendChild(grid([P.render.providers(F), P.render.convex(F), P.render.budget(F), P.render.g1(F)]));
  }

  // ── KNVS — safe sandbox lab (ported donor law) ──────────────────────────────────
  // sandbox="allow-scripts" ONLY (no same-origin grant → opaque, cannot reach this origin), a strict
  // in-document CSP, drafts routed to the gate (never applied), continuity keys aukora-canvas-last (last
  // preview) and app-lab (draft proposals). Pixels only; never files, never authority.
  const KNVS_LAST = "aukora-canvas-last";
  const KNVS_DRAFTS = "app-lab";
  const KNVS_CSP = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'";

  function knvsDoc(html) {
    return '<!doctype html><html><head><meta charset="utf-8">'
      + '<meta http-equiv="Content-Security-Policy" content="' + KNVS_CSP + '">'
      + '<style>:root{color-scheme:dark}*{box-sizing:border-box}html,body{margin:0;height:100%;background:transparent;'
      + 'color:#f4f6ff;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif}'
      + 'body{display:flex;align-items:center;justify-content:center;overflow:auto;padding:16px}</style>'
      + '</head><body>' + html + '</body></html>';
  }

  function mountKnvs(host, F) {
    const k = F.knvs;
    const lab = el("div", "knvs-lab");

    const intro = card("KNVS · the app lab", k.truth);
    intro.appendChild(el("p", "app-note", k.note));
    lab.appendChild(intro);

    const editor = document.createElement("textarea");
    editor.className = "knvs-editor";
    editor.setAttribute("aria-label", "Lab HTML — rendered as pixels in an opaque sandbox");
    editor.spellcheck = false;
    let last = "";
    try { last = localStorage.getItem(KNVS_LAST) || ""; } catch { /* storage blocked */ }
    editor.value = last || k.starter || "<h2 style=\"font-weight:300\">hello from the lab ✦</h2>\n<p>edit me — this renders as pixels only.</p>";

    const frame = document.createElement("iframe");
    frame.className = "knvs-frame";
    frame.setAttribute("sandbox", "allow-scripts"); // opaque: scripts run but cannot reach this origin
    frame.setAttribute("title", "KNVS sandbox preview");

    const status = el("p", "knvs-status", "Sandbox: allow-scripts only · strict CSP · pixels only. Preview persists on THIS browser (continuity key aukora-canvas-last); a proposal only drafts (key app-lab) — nothing lands without the owner signature at the gate.");

    const controls = el("div", "knvs-controls");
    const previewBtn = el("button", "knvs-btn", "Preview"); previewBtn.type = "button";
    const proposeBtn = el("button", "knvs-btn", "Propose as draft"); proposeBtn.type = "button";
    const clearBtn = el("button", "knvs-btn", "Clear"); clearBtn.type = "button";
    controls.append(previewBtn, proposeBtn, clearBtn);

    function preview() {
      const html = editor.value;
      frame.srcdoc = knvsDoc(html);
      try { localStorage.setItem(KNVS_LAST, html); } catch { /* in-memory still works */ }
    }
    previewBtn.addEventListener("click", preview);
    clearBtn.addEventListener("click", () => { editor.value = ""; preview(); });
    proposeBtn.addEventListener("click", () => {
      // Draft-proposal-only: store a draft; NEVER apply. The governed self-mod path is the AUMLOK gate.
      let drafts = [];
      try { drafts = JSON.parse(localStorage.getItem(KNVS_DRAFTS) || "[]"); } catch { drafts = []; }
      drafts.push({ at: new Date().toISOString(), html: editor.value.slice(0, 4000) });
      try { localStorage.setItem(KNVS_DRAFTS, JSON.stringify(drafts.slice(-20))); } catch { /* ignore */ }
      status.textContent = "Draft queued (" + drafts.length + " on this browser, key app-lab). This is a DRAFT ONLY — it lands nothing; the owner signs at the AUMLOK gate. Sandbox navigation is contained; the only residual is this browser's localStorage preview.";
    });

    lab.append(editor, controls, frame, status);
    host.appendChild(lab);
    preview(); // render the restored/last content
  }

  return {
    console: mountConsole, map: mountMap, auma: mountAuma, aumlok: mountAumlok,
    aura: mountAura, settings: mountSettings, knvs: mountKnvs,
  };
})();
