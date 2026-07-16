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

  // ── Local brain health card (Sam 2 · BrainHealthSnapshotV1 via contracts.js) ─────
  function healthCard(F) {
    const h = window.AukoraContracts.brainHealth(F);
    const box = card("Local brain · " + h.schema, window.AukoraContracts.sourceLabel(h));
    box.appendChild(kvLine([
      ["Mode", h.mode + " · convex " + h.convexMode],
      ["Memory", h.liveCount + " live · chain " + h.chainLength + " · forgotten " + h.forgottenCount],
      ["Chain head", h.headHashShort, true],
      ["Merkle root", h.merkleRootShort, true],
      ["Verified / grants authority", P.yn(h.verified) + " / " + P.yn(h.grantsAuthority)],
    ]));
    return box;
  }

  // ── CONSOLE — brain health + the ten tested operator panels ─────────────────────
  function mountConsole(host, F) {
    host.appendChild(healthCard(F));
    const ORDER = ["authority", "memory", "lineage", "recursion", "council", "providers", "budget", "convex", "g1", "forgetting"];
    host.appendChild(grid(ORDER.map((id) => P.render[id](F))));
  }

  // ── SPATIAL MAP — data-driven graph ─────────────────────────────────────────────
  function mountMap(host, F) { window.AukoraSpatialMap.mount(host, F); }

  // ── AUMA LIVE — the R0–R3 read-only workbench (conversation lives in the left lane) ─
  function mountAuma(host, F) {
    const ide = F.ide;
    const intro = card("Auma · workbench", ide.schema);
    intro.appendChild(el("p", "app-note", "AUMA LIVE is conversational in the left chats lane. This workbench is READ-ONLY — it invokes capabilities and invents no authority; any change is a draft to the gate."));
    host.appendChild(intro);

    const tree = card("Repo tree · search", null);
    const q = el("div", "kv-line");
    q.appendChild(el("dt", null, "search")); q.appendChild(el("dd", "mono", ide.search.query));
    tree.appendChild(q);
    const ul = el("ul", "ide-tree"); ide.repoTree.forEach((p) => ul.appendChild(el("li", "mono", p))); tree.appendChild(ul);
    ide.search.hits.forEach((hit) => tree.appendChild(el("div", "app-note mono", hit.path + ":" + hit.line + "  " + hit.snippet)));
    host.appendChild(tree);

    const recall = card("Cited recall", null);
    ide.citedRecall.forEach((r) => { const d = el("div"); d.appendChild(el("div", null, r.claim)); d.appendChild(el("div", "app-note mono", "cite: " + r.cite)); recall.appendChild(d); });
    host.appendChild(recall);

    const diff = card("Draft diff", null);
    diff.appendChild(el("div", "app-note mono", ide.draftDiff.path + "  (+" + ide.draftDiff.added + " / -" + ide.draftDiff.removed + ")"));
    diff.appendChild(el("pre", "ide-diff", ide.draftDiff.preview));
    host.appendChild(diff);

    const reh = card("Rehearsal logs", null);
    ide.rehearsal.forEach((s) => { const row = el("div", "ceremony-step"); row.appendChild(el("span", "ceremony-dot ceremony-dot--done")); const t = el("div"); t.appendChild(el("div", null, s.step)); t.appendChild(el("div", "app-note", s.result)); row.appendChild(t); reh.appendChild(row); });
    host.appendChild(reh);

    const rec = card("Receipts · staged candidate", null);
    ide.receipts.forEach((r) => rec.appendChild(el("div", "app-note mono", r.kind + " " + r.hashShort)));
    rec.appendChild(el("div", "app-note", "Candidate: " + ide.candidate.status + " · grants authority " + P.yn(ide.candidate.grantsAuthority)));
    host.appendChild(rec);
  }

  // ── AUMLOK + AURA — ONE connected witnessed ceremony (read-only design contract, Sam 3) ──────────
  // Both faces consume the SAME contract via contracts.js (live-injected global → labelled fixture fallback).
  // No private key, no signing, no custody in the browser — the signature lands outside this surface.
  function ceremonyCard(F) {
    const c = window.AukoraContracts.ceremony(F);
    const box = el("div", "glass-card");
    const h = el("h3", null, "Witnessed ceremony · " + c.schema);
    h.appendChild(el("span", "pill pill-faint", "READ-ONLY · " + window.AukoraContracts.sourceLabel(c)));
    box.appendChild(h);
    box.appendChild(el("p", "app-note", "Signer: " + c.signerLabel + " · grants authority: no."));
    c.phases.forEach((ph) => {
      const row = el("div", "ceremony-step");
      row.appendChild(el("span", "ceremony-dot ceremony-dot--" + ph.state));
      const t = el("div"); t.appendChild(el("div", null, ph.title)); t.appendChild(el("div", "app-note", ph.detail));
      row.appendChild(t);
      box.appendChild(row);
    });
    return box;
  }
  function exclusionsCard(F) {
    const c = window.AukoraContracts.ceremony(F);
    const box = card("Authority exclusions", null);
    const ul = el("ul", "app-note"); ul.style.margin = "0"; ul.style.paddingLeft = "18px";
    c.authorityExclusions.forEach((x) => ul.appendChild(el("li", null, x)));
    box.appendChild(ul);
    return box;
  }
  function continuityCard(F) {
    const c = window.AukoraContracts.ceremony(F);
    const box = card("Continuity layers · L0–L4", null);
    c.continuityLayers.forEach((L) => {
      const row = el("div", "ceremony-step");
      row.appendChild(el("span", "pill pill-faint", L.layer));
      const t = el("div"); t.appendChild(el("div", null, L.name + " · " + L.status)); t.appendChild(el("div", "app-note", L.note));
      row.appendChild(t);
      box.appendChild(row);
    });
    return box;
  }
  function lockBanner() {
    const b = el("p", "zone-banner");
    b.textContent = "Private-key custody and signing remain OUTSIDE browser state. The signature lands at the gate, not here.";
    b.style.cssText = "margin:0 0 12px;padding:10px 14px;border-radius:10px;border-left:4px solid #e2b04a;background:rgba(226,176,74,0.12);color:#e2b04a;font-size:13px";
    return b;
  }
  function mountAumlok(host, F) {
    host.appendChild(lockBanner());
    host.appendChild(ceremonyCard(F));
    host.appendChild(exclusionsCard(F));
    host.appendChild(grid([P.render.authority(F)]));
  }
  function mountAura(host, F) {
    const intro = card("Coherence · the witness", null);
    intro.appendChild(el("p", "app-note", "AURA is the living pattern the same ceremony grows — evidence, never authority. Trace epochs, receipt/Merkle lineage, erasure state, and truth labels."));
    host.appendChild(intro);
    host.appendChild(continuityCard(F));
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

    host.appendChild(healthCard(F));
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

    // Bounded voice/vision session — provider-neutral OFFLINE demo (no paid/live call this round).
    const s = k.session;
    const sess = card("Bounded session · " + s.provider.split(" ")[0], "OFFLINE");
    let mode = s.defaultMode, running = false;
    const modeRow = el("div", "knvs-controls");
    const modeTag = el("span", "mode-tag mode-tag--demo", "mode: " + mode);
    const timer = el("span", "knvs-status", "");
    const modeBtn = el("button", "knvs-btn", "Mode: " + mode); modeBtn.type = "button";
    const startBtn = el("button", "knvs-btn", "Start session"); startBtn.type = "button";
    const pttBtn = el("button", "knvs-btn", "Push-to-talk"); pttBtn.type = "button"; pttBtn.disabled = true;
    modeRow.append(modeBtn, startBtn, pttBtn, modeTag);
    sess.appendChild(modeRow);
    sess.appendChild(kvLine([
      ["Limits", s.limits.timeS + "s · " + s.limits.tokens + " tok · " + s.limits.frames + " frames · $" + s.limits.costUsd.toFixed(2)],
      ["Sidecar", s.sidecar],
    ]));
    sess.appendChild(timer);
    modeBtn.addEventListener("click", () => { const i = s.modes.indexOf(mode); mode = s.modes[(i + 1) % s.modes.length]; modeBtn.textContent = "Mode: " + mode; modeTag.textContent = "mode: " + mode; });
    let secs = 0, tick = null;
    startBtn.addEventListener("click", () => {
      running = !running;
      startBtn.textContent = running ? "Stop session" : "Start session";
      pttBtn.disabled = !running;
      if (running) { secs = 0; tick = setInterval(() => { secs++; timer.textContent = "session " + secs + "s / " + s.limits.timeS + "s · frames 0/" + s.limits.frames + " · $0.00 (offline; auto-stops at limit)"; if (secs >= s.limits.timeS) { running = false; startBtn.textContent = "Start session"; pttBtn.disabled = true; clearInterval(tick); timer.textContent = "session ended at time limit."; } }, 1000); }
      else { clearInterval(tick); timer.textContent = "session stopped."; }
    });
    // A voice/field directive is sanitized before it can drive the preview; submit is a proposal INTENT only.
    pttBtn.addEventListener("click", () => { timer.textContent = "captured a bounded utterance (offline) → sanitized → preview intent. Submit drafts a proposal; it never applies."; });
    sess.appendChild(el("p", "app-note", s.note));
    lab.appendChild(sess);

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
