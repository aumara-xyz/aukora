// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
//
// The Chats/Auma lane (left lane — the donor's contract: the left lane is ALWAYS chats; one being, one
// memory). AUMA LIVE is directly conversational here. Replies are DETERMINISTIC OFFLINE advisory — no paid
// or live model call, no network. Transcripts persist per-thread in localStorage (this browser only).
// Nothing here signs, applies, or merges; a proposal only halts for the AUMLOK signature at the gate.
// Built dynamically so the shell markup stays free of forms/inputs; the composer is a textarea + a
// type="button" send (Enter to send), never a submitting form.
"use strict";

window.AukoraChat = (function () {
  const P = window.AukoraPanels;
  const el = P.el;
  const TKEY = "aukora-chat-transcript-";

  function icon(paths) {
    const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 16 16"); s.setAttribute("aria-hidden", "true");
    paths.forEach((d) => { const p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", d); s.appendChild(p); });
    return s;
  }
  function knot() { // trinity-knot mark (inline SVG — no external asset, no canvas taint)
    const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("class", "knot"); s.setAttribute("aria-hidden", "true");
    [["#96d4b4", "M12 3a5 5 0 0 1 4.3 7.5"], ["#96b4ff", "M16.3 10.5a5 5 0 0 1-8.6 0"], ["#c4aaff", "M7.7 10.5A5 5 0 0 1 12 3"]]
      .forEach(([c, d]) => { const p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", d); p.setAttribute("stroke", c); p.setAttribute("fill", "none"); p.setAttribute("stroke-width", "1.4"); s.appendChild(p); });
    return s;
  }

  // Deterministic offline advisory responder — same message ⇒ same reply, forever. No network, no key.
  const REFLECTIONS = [
    "Here is how I read that, as advisory context.",
    "One honest angle on that.",
    "Reflecting the state back to you.",
    "A grounded reading — evidence, not authority.",
    "What the governed loop would note.",
  ];
  function hash(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
  function advise(msg) {
    const r = REFLECTIONS[hash(msg) % REFLECTIONS.length];
    return r + " (offline advisory · I can't sign, apply, or merge — draft it to the AUMLOK gate.)";
  }

  function mount(mountEl, F) {
    const threads = F.chat.threads;
    let activeThread = null;
    const wrap = el("div", "chat-wrap");

    // ---- list view ----
    const listView = el("div", "chat-view");
    const toolbar = el("div", "lane-head chat-toolbar");
    const newBtn = el("button", "tool-btn"); newBtn.type = "button"; newBtn.title = "New chat (soon)"; newBtn.setAttribute("aria-label", "New chat"); newBtn.appendChild(icon(["M8 3v10", "M3 8h10"])); newBtn.disabled = true;
    const filters = el("div", "toolbar-filters");
    [["Pinned", ["M9.5 1.5 14.5 6.5 11 8l-1.5 4.5L4 7 8.5 5.5Z", "M5 11l-3 3"]], ["Unread", ["M8 3.4a4.6 4.6 0 1 0 0 9.2 4.6 4.6 0 0 0 0-9.2Z"]], ["Archived", ["M2 3h12v3.4H2Z", "M3.4 6.4V13h9.2V6.4"]]]
      .forEach(([label, d]) => { const b = el("button", "tool-btn filter-btn"); b.type = "button"; b.title = label; b.setAttribute("aria-label", "Filter " + label); b.appendChild(icon(d)); b.disabled = true; filters.appendChild(b); });
    toolbar.append(newBtn, filters);
    listView.appendChild(toolbar);

    const threadList = el("div", "lane-body thread-list");
    threads.forEach((t) => {
      const row = el("button", "row inspector-row thread-row"); row.type = "button";
      const left = el("span", "thread-left"); left.appendChild(knot());
      const meta = el("span"); meta.appendChild(el("span", "row-label", t.name)); meta.appendChild(el("span", "row-gist", t.gist));
      left.appendChild(meta); row.appendChild(left);
      const status = el("span", "thread-status");
      if (t.pinned) { const pin = el("span", "row-pin"); pin.appendChild(icon(["M9.5 1.5 14.5 6.5 11 8l-1.5 4.5L4 7 8.5 5.5Z", "M5 11l-3 3"])); status.appendChild(pin); }
      if (t.live) status.appendChild(el("span", "unread-dot"));
      if (t.soon) status.appendChild(el("span", "pill pill-green", "soon"));
      row.appendChild(status);
      if (t.soon) row.disabled = true; else row.addEventListener("click", () => openThread(t));
      threadList.appendChild(row);
    });
    listView.appendChild(threadList);

    // ---- open (conversation) view ----
    const openView = el("div", "chat-view"); openView.hidden = true;
    const openHead = el("div", "lane-head chat-open-head");
    const backBtn = el("button", "tool-btn"); backBtn.type = "button"; backBtn.title = "Back to chats"; backBtn.setAttribute("aria-label", "Back to chats"); backBtn.appendChild(icon(["M10 3 5 8l5 5"]));
    const avatar = knot(); avatar.classList.add("chat-avatar");
    const title = el("span", "chat-title", "Aukora");
    openHead.append(backBtn, avatar, title);
    const messages = el("div", "chat-messages");
    const composer = el("div", "composer");
    const input = document.createElement("textarea");
    input.id = "composer-input"; input.rows = 1; input.setAttribute("aria-label", "Message Auma (advisory, offline)");
    input.placeholder = "Say what's alive for you…";
    const send = el("button", "composer-send"); send.type = "button"; send.setAttribute("aria-label", "Send"); send.textContent = "↑"; send.disabled = true;
    composer.append(input, send);
    openView.append(openHead, messages, composer);

    wrap.append(listView, openView);
    mountEl.replaceChildren(wrap);

    function bubble(who, text) {
      const m = el("div", "msg msg-" + who);
      if (who === "auma") { const h = el("div", "msg-head"); h.appendChild(el("span", "msg-name", "Auma")); h.appendChild(el("span", "msg-status", "advisory · offline")); m.appendChild(h); }
      m.appendChild(el("div", "msg-body", text));
      messages.appendChild(m); messages.scrollTop = messages.scrollHeight;
    }
    function loadTranscript(id) {
      let t = [];
      try { t = JSON.parse(localStorage.getItem(TKEY + id) || "[]"); } catch { t = []; }
      messages.replaceChildren();
      if (t.length === 0) bubble("auma", F.chat.greeting);
      else t.forEach((e) => bubble(e.who, e.text));
      return t;
    }
    function saveTranscript(id, t) { try { localStorage.setItem(TKEY + id, JSON.stringify(t.slice(-100))); } catch { /* ignore */ } }

    function openThread(t) {
      activeThread = t; title.textContent = t.name;
      listView.hidden = true; openView.hidden = false;
      loadTranscript(t.id); input.focus();
    }
    function closeThread() { openView.hidden = true; listView.hidden = false; activeThread = null; }
    backBtn.addEventListener("click", closeThread);

    function doSend() {
      const text = input.value.trim(); if (!text || !activeThread) return;
      let t = []; try { t = JSON.parse(localStorage.getItem(TKEY + activeThread.id) || "[]"); } catch { t = []; }
      t.push({ who: "you", text }); bubble("you", text);
      const reply = advise(text); t.push({ who: "auma", text: reply }); bubble("auma", reply);
      saveTranscript(activeThread.id, t);
      input.value = ""; input.style.height = "auto"; send.disabled = true;
    }
    input.addEventListener("input", () => { send.disabled = !input.value.trim(); input.style.height = "auto"; input.style.height = Math.min(120, input.scrollHeight) + "px"; });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); } });
    send.addEventListener("click", doSend);

    return { openThread: () => openThread(threads[0]), closeThread };
  }

  return { mount };
})();
