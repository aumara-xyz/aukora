// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
//
// Read-only operator console renderer. Pure presentation: it reads the committed DEMO_FIXTURE global and
// builds the DOM. It performs NO network request, holds NO secret, and has NO control that can sign,
// authorize, apply, deploy, or arm anything. All text is inserted via textContent (never innerHTML) so the
// rendered page cannot be turned into a script-injection surface by fixture content.
"use strict";

(function () {
  const F = globalThis.AUKORA_CONSOLE_FIXTURE;
  const panels = document.getElementById("panels");
  const loading = document.getElementById("loading");

  if (!F) {
    if (loading) loading.textContent = "Fixture not found — run `npm run fixture` to generate it.";
    return;
  }

  // ── tiny DOM helpers ──────────────────────────────────────────
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }
  function truthChip(truth) {
    const map = { IMPLEMENTED: "chip--implemented", ROADMAP: "chip--roadmap", UNARMED: "chip--unarmed" };
    return el("span", "chip " + (map[truth] || "chip--roadmap"), truth || "—");
  }
  function metric(label, value, mono) {
    const wrap = el("div", "metric");
    wrap.appendChild(el("dt", null, label));
    const dd = el("dd", mono ? "mono" : null, value);
    wrap.appendChild(dd);
    return wrap;
  }
  function metricsList(pairs) {
    const dl = el("dl", "metrics");
    pairs.forEach(([l, v, mono]) => dl.appendChild(metric(l, v, mono)));
    return dl;
  }
  function kv(pairs) {
    const dl = el("dl", "kv");
    pairs.forEach(([k, v, mono]) => {
      dl.appendChild(el("dt", null, k));
      dl.appendChild(el("dd", mono ? "mono" : null, v));
    });
    return dl;
  }
  function note(text) { return el("p", "panel-note", text); }
  function pill(text, kind) { return el("span", "pill pill--" + kind, text); }
  function yn(b) { return b ? "yes" : "no"; }

  // Panel scaffold: <section id> with a head (title + truth chip). Returns { section, body }.
  function panel(id, title, truth, wide) {
    const section = el("section", "panel" + (wide ? " panel--wide" : ""));
    section.id = id;
    section.tabIndex = -1;
    section.setAttribute("aria-labelledby", id + "-h");
    const head = el("div", "panel-head");
    const h = el("h2", null, title);
    h.id = id + "-h";
    head.appendChild(h);
    if (truth) head.appendChild(truthChip(truth));
    section.appendChild(head);
    const body = el("div", "panel-body");
    section.appendChild(body);
    return { section, body };
  }

  const navItems = [];
  function add(p) {
    panels.appendChild(p.section);
    navItems.push({ id: p.section.id, label: p.section.querySelector("h2").textContent });
  }

  // ── 1. AUMLOK authority ───────────────────────────────────────
  (function () {
    const a = F.authority;
    const p = panel("authority", a.title, a.truth);
    const row = el("div"); row.appendChild(pill("LOCK · " + a.lockState, "warn")); p.body.appendChild(row);
    p.body.appendChild(kv([
      ["Gate", a.gate],
      ["Owner public key", a.ownerPublicKeyHex, true],
      ["No model can sign", yn(a.noModelCanSign)],
      ["Grants authority", yn(a.grantsAuthority)],
      ["Production suite", a.productionSuite],
    ]));
    p.body.appendChild(note(a.note));
    add(p);
  })();

  // ── 2. Reactive memory ────────────────────────────────────────
  (function () {
    const m = F.memory;
    const p = panel("memory", m.title, m.truth);
    p.body.appendChild(metricsList([
      ["Live memories", m.liveCount],
      ["Chain length", m.chainLength],
      ["Forgotten", m.forgottenCount],
    ]));
    p.body.appendChild(kv([
      ["Chain head", m.headHashShort, true],
      ["Merkle root", m.merkleRootShort, true],
      ["Last event", m.lastEventAt, true],
    ]));
    const gh = el("div"); gh.appendChild(el("h3", "outcome-h", "Growth"));
    const gl = el("ol", "pipeline");
    m.growth.forEach((g) => {
      const li = el("li");
      li.appendChild(el("span", "step-n", "live " + g.liveCount));
      li.appendChild(document.createTextNode(g.step));
      gl.appendChild(li);
    });
    gh.appendChild(gl); p.body.appendChild(gh);
    p.body.appendChild(note(m.note));
    add(p);
  })();

  // ── 3. Receipt & Merkle lineage ───────────────────────────────
  (function () {
    const l = F.lineage;
    const p = panel("lineage", l.title, l.truth, true);
    const row = el("div");
    row.appendChild(pill(l.verified ? "CHAIN VERIFIED" : "CHAIN INVALID", l.verified ? "ok" : "warn"));
    p.body.appendChild(row);
    p.body.appendChild(kv([["Merkle root", l.merkleRootShort, true]]));
    const scroll = el("div", "table-scroll");
    const t = el("table", "lineage");
    const thead = el("thead");
    const htr = el("tr");
    ["#", "kind", "provenance", "recordId", "chainHash", "prevHash"].forEach((h) => htr.appendChild(el("th", null, h)));
    thead.appendChild(htr); t.appendChild(thead);
    const tb = el("tbody");
    l.entries.forEach((e) => {
      const tr = el("tr");
      tr.appendChild(el("td", null, e.index));
      tr.appendChild(el("td", null, e.kind));
      tr.appendChild(el("td", null, e.provenance || "—"));
      tr.appendChild(el("td", "mono", e.recordIdShort || "—"));
      tr.appendChild(el("td", "mono", e.chainHashShort || "—"));
      tr.appendChild(el("td", "mono", e.prevHashShort || "—"));
      tb.appendChild(tr);
    });
    t.appendChild(tb); scroll.appendChild(t); p.body.appendChild(scroll);
    p.body.appendChild(note(l.note));
    add(p);
  })();

  // ── 4. Proposal lifecycle + staleness ─────────────────────────
  (function () {
    const r = F.recursion;
    const p = panel("recursion", r.title, r.truth, true);
    p.body.appendChild(kv([["Proposal", r.proposalId + " → " + r.targetPath, true]]));
    const pl = el("ol", "pipeline");
    r.pipeline.forEach((s, i) => {
      const li = el("li");
      li.appendChild(el("span", "step-n", (i + 1)));
      li.appendChild(document.createTextNode(s));
      pl.appendChild(li);
    });
    p.body.appendChild(pl);

    const ref = r.refusedWithoutOwner;
    const o1 = el("div", "outcome");
    o1.appendChild(el("h3", null, "Without owner signature"));
    o1.appendChild(pill("REFUSED · " + ref.stage, "warn"));
    o1.appendChild(el("p", null, "Advisory review = " + (ref.councilVerdict || "—") + " · sandbox applied = " + yn(ref.sandboxApplied) + ". " + ref.meaning));
    p.body.appendChild(o1);

    const acc = r.acceptedWithOwner;
    const o2 = el("div", "outcome");
    o2.appendChild(el("h3", null, "With owner signature"));
    o2.appendChild(pill("ACCEPTED · " + acc.stage, "ok"));
    const l2 = el("p", null, "");
    l2.appendChild(document.createTextNode("Receipt "));
    l2.appendChild(el("code", null, acc.receiptHashShort || "—"));
    l2.appendChild(document.createTextNode(" · live repo touched = " + yn(acc.liveRepoTouched) + ". " + acc.meaning));
    o2.appendChild(l2);
    p.body.appendChild(o2);

    const s = r.staleness;
    const st = el("div", "outcome");
    st.appendChild(el("h3", null, "Staleness law"));
    [["fresh", s.fresh], ["stale", s.stale], ["unknown age", s.unknownAge]].forEach(([label, v]) => {
      const row = el("div", "stale-row");
      row.appendChild(el("span", "stale-label", label));
      row.appendChild(pill(v.state.toUpperCase(), v.flagged ? "warn" : "ok"));
      row.appendChild(el("span", null, v.ageLabel + " · " + v.horizon + (v.expiringSoon ? " · expiring soon" : "")));
      st.appendChild(row);
    });
    st.appendChild(el("p", null, s.note));
    p.body.appendChild(st);
    add(p);
  })();

  // ── 5. Aukora Fu council ──────────────────────────────────────
  (function () {
    const c = F.council;
    const p = panel("council", c.title, c.truth, true);
    const row = el("div");
    row.appendChild(pill("QUORUM " + (c.quorumMet ? "MET" : "NOT MET"), c.quorumMet ? "ok" : "warn"));
    row.appendChild(document.createTextNode(" "));
    row.appendChild(pill("VERDICT · " + c.verdict, "info"));
    p.body.appendChild(row);
    p.body.appendChild(metricsList([
      ["Votes", c.votes + " / " + c.seats],
      ["Families", c.votingFamilies],
      ["Coherence", c.geometry.coherence],
      ["Disagreement (shear)", c.geometry.shearMagnitude],
    ]));
    p.body.appendChild(kv([
      ["Quorum rule", "≥" + c.quorumRule.minVotes + " votes · ≥" + c.quorumRule.minFamilies + " families · seat " + c.quorumRule.requireSeatId + " verified"],
      ["Fable seat verified", yn(c.fableVerified)],
      ["Geometry reason", c.geometry.reason + (c.geometry.phaseLockDetected ? " · phase-lock flagged" : "") + (c.geometry.hasEvidenceAnchor ? " · evidence-anchored" : "")],
      ["Answer source", c.answerSource],
      ["Transport", c.transport],
      ["Advisory / grants authority", yn(c.advisory) + " / " + yn(c.grantsAuthority)],
    ]));
    const rh = el("div"); rh.appendChild(el("h3", "outcome-h", "Roster (8 seats)"));
    const ul = el("ul", "roster");
    c.roster.forEach((seat) => {
      const li = el("li");
      li.appendChild(el("div", "seat-name", seat.name));
      li.appendChild(el("div", "seat-meta", seat.family + " · " + seat.framework));
      ul.appendChild(li);
    });
    rh.appendChild(ul); p.body.appendChild(rh);
    p.body.appendChild(note(c.note));
    add(p);
  })();

  // ── 6. Providers ──────────────────────────────────────────────
  (function () {
    const pr = F.providers;
    const p = panel("providers", pr.title, pr.truth);
    p.body.appendChild(kv([
      ["Active provider", pr.offlineProvider.id, true],
      ["Grants authority", yn(pr.grantsAuthority)],
    ]));
    const mh = el("div"); mh.appendChild(el("h3", "outcome-h", "Model manifest (truth-labeled)"));
    const ul = el("ul", "manifest");
    pr.manifest.forEach((m) => {
      const li = el("li");
      const left = el("span", "m-label", m.label);
      li.appendChild(left);
      li.appendChild(truthChip(m.truth));
      ul.appendChild(li);
    });
    mh.appendChild(ul); p.body.appendChild(mh);
    p.body.appendChild(note(pr.note));
    add(p);
  })();

  // ── 7. Budget & hard-stop ─────────────────────────────────────
  (function () {
    const b = F.budget;
    const p = panel("budget", b.title, b.truth);
    const row = el("div"); row.appendChild(pill(b.failClosed ? "FAIL-CLOSED" : "OPEN", b.failClosed ? "ok" : "warn")); p.body.appendChild(row);
    p.body.appendChild(metricsList([
      ["Per-pass ceiling", "$" + b.perPassUsd.toFixed(2)],
      ["Per-day ceiling", "$" + b.perDayUsd.toFixed(2)],
      ["Estimated (this pass)", "$" + b.estimatedUsd.toFixed(2)],
      ["Actual spent", "$" + b.actualUsd.toFixed(2)],
    ]));
    p.body.appendChild(note(b.note));
    add(p);
  })();

  // ── 8. Persistence mode (Convex) ──────────────────────────────
  (function () {
    const cx = F.convex;
    const p = panel("convex", cx.title, cx.truth);
    const row = el("div", "stale-row");
    cx.modes.forEach((mode) => row.appendChild(pill(mode.toUpperCase(), mode === cx.current ? "ok" : "info")));
    p.body.appendChild(row);
    p.body.appendChild(kv([["Current mode", cx.current]]));
    p.body.appendChild(note(cx.note));
    add(p);
  })();

  // ── 9. G1 / Nebius ────────────────────────────────────────────
  (function () {
    const g = F.g1;
    const p = panel("g1", g.title, g.truth);
    const row = el("div"); row.appendChild(pill("REPLICATION · " + g.state, "info")); p.body.appendChild(row);
    p.body.appendChild(kv([
      ["Replication", g.replication],
      ["Nebius", g.nebius],
    ]));
    p.body.appendChild(note(g.note));
    add(p);
  })();

  // ── 10. Governed forgetting ───────────────────────────────────
  (function () {
    const fg = F.forgetting;
    const p = panel("forgetting", fg.title, fg.truth);
    const row = el("div"); row.appendChild(pill(fg.forgotten ? "FORGOTTEN" : "—", "ok")); p.body.appendChild(row);
    p.body.appendChild(metricsList([
      ["Recall before", fg.recallBefore],
      ["Recall after", fg.recallAfter],
    ]));
    p.body.appendChild(kv([
      ["Forgotten record", fg.forgottenRecordIdShort, true],
      ["Chain still verifies", yn(fg.chainStillVerifies)],
      ["Tombstone content-free", yn(fg.tombstoneContentFree)],
      ["Chain rewritten", yn(fg.chainRewritten)],
    ]));
    p.body.appendChild(note(fg.note));
    add(p);
  })();

  // ── finalize: remove loader, build section nav, footer, download ─
  if (loading) loading.remove();

  const nav = document.getElementById("panel-nav");
  navItems.forEach((it) => {
    const a = el("a", null, it.label);
    a.href = "#" + it.id;
    a.addEventListener("click", () => {
      // Move keyboard focus to the target panel for accessible in-page navigation.
      const target = document.getElementById(it.id);
      if (target) window.requestAnimationFrame(() => target.focus());
    });
    nav.appendChild(a);
  });

  const fp = document.getElementById("footer-provenance");
  if (fp) fp.textContent = F.provenance + " Seed instant " + F.generatedFromSeedInstant + ".";

  // Subtitle/title from fixture (keeps HTML and data in sync without innerHTML).
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
