// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
//
// CONSOLE — a center-pane organ (R34, issue #23). NOT donor code: this file and app/console/* are ours,
// carried from the apps/console evidence (panels.js + DEMO_FIXTURE + styles). It mounts the ten tested
// read-only operator panels inside the donor shell WITHOUT touching donor chrome: the panels render in a
// ShadowRoot so the evidence stylesheet cannot clash with the donor style.css, and the shadow host maps
// the evidence design vars onto the donor tokens. Read-only; signs, applies, and arms nothing.

const ORDER = ['authority', 'memory', 'lineage', 'recursion', 'council', 'providers', 'budget', 'convex', 'g1', 'forgetting'];

// The evidence vars → donor token mapping (set on the shadow host; custom properties inherit into shadow).
const VAR_MAP = {
  '--bg': 'transparent',
  '--panel': 'var(--glass)',
  '--panel-2': 'rgba(255, 255, 255, 0.06)',
  '--line': 'var(--glass-border)',
  '--line-strong': 'rgba(255, 255, 255, 0.16)',
  '--ink': 'var(--text)',
  '--ink-soft': 'var(--dim)',
  '--ink-faint': 'var(--faint)',
  '--accent': 'rgb(var(--hue-c))',
  '--ok': 'rgb(var(--hue-l))',
  '--warn': '#e2b04a',
  '--info': 'rgb(var(--hue-r))',
  '--ok-bg': 'rgba(var(--hue-l), 0.12)',
  '--warn-bg': 'rgba(226, 176, 74, 0.14)',
  '--info-bg': 'rgba(var(--hue-r), 0.12)',
  '--shadow': 'none',
  '--radius': '14px',
  '--mono': 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
  '--sans': 'ui-sans-serif, system-ui, -apple-system, sans-serif',
};

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('failed to load ' + src));
    document.head.append(s);
  });
}

export async function mountConsole(root) {
  const host = document.createElement('div');
  host.style.position = 'absolute';
  host.style.inset = '0';
  host.style.overflowY = 'auto';
  for (const [k, v] of Object.entries(VAR_MAP)) host.style.setProperty(k, v);
  root.append(host);

  const shadow = host.attachShadow({ mode: 'open' });
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/app/console/console.css';
  shadow.append(link);

  const wrap = document.createElement('div');
  wrap.style.padding = '8px 22px 26px';
  shadow.append(wrap);

  try {
    // ── R36: the loopback live-local projection FIRST, with loud truth labels ──────────────────
    // /api/spatial/projection is the real merged-main organism projected at launch (source:'live-local';
    // Sam 2's durable door supersedes it as source:'door'). Display-only: nothing here can authorize.
    // Unreachable/missing ⇒ a LOUD offline strip — a fixture is never presented as live.
    const live = document.createElement('div');
    live.style.cssText = 'border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin:6px 0 14px;background:var(--panel)';
    wrap.append(live);
    const liveTitle = document.createElement('div');
    liveTitle.style.cssText = 'font-size:11px;letter-spacing:.14em;text-transform:uppercase;margin-bottom:8px;font-weight:600';
    live.append(liveTitle);
    const liveBody = document.createElement('div');
    liveBody.style.cssText = 'font-size:13px;color:var(--ink-soft);display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px 18px';
    live.append(liveBody);
    const cell = (k, v) => {
      const d = document.createElement('div');
      const kk = document.createElement('span'); kk.textContent = k + ' · '; kk.style.color = 'var(--ink-faint)';
      const vv = document.createElement('span'); vv.textContent = v;
      d.append(kk, vv); return d;
    };
    try {
      const r = await fetch('/api/spatial/projection', { headers: { accept: 'application/json' } });
      if (!r.ok) throw new Error('projection ' + r.status);
      const pj = await r.json();
      if (pj.grantsAuthority !== false || pj.displayOnly !== true) throw new Error('projection failed the display-only fence');
      liveTitle.textContent = 'LIVE-LOCAL ORGANISM · source ' + pj.source + ' · generated ' + pj.generatedAt + ' · display-only, authorizes nothing';
      liveTitle.style.color = 'var(--ok, #57d08c)';
      liveBody.append(
        cell('brain', pj.brainHealth.liveCount + ' live · chain ' + pj.brainHealth.chainLength + ' · verified ' + pj.brainHealth.verified),
        cell('workflow', pj.workflow.awaiting.proposal + ' → ' + pj.workflow.awaiting.phase),
        cell('Fu advisory', pj.fuAdvisory.verdict + ' · digest ' + (pj.fuAdvisory.evidenceDigestShort || '—')),
        cell('AUMLOK', pj.aumlok.phase + ' (custody stays local)'),
        cell('candidate', pj.candidate.proposal + ' → ' + pj.candidate.phase + ' · live repo touched: ' + pj.candidate.liveRepoTouched),
        cell('receipts', pj.receipts.length + ' chain entries (content-free)'),
      );
    } catch (e) {
      liveTitle.textContent = 'OFFLINE — live-local projection unavailable (' + (e && e.message ? e.message : e) + ')';
      liveTitle.style.color = '#e2b04a';
      const hint = document.createElement('div');
      hint.textContent = 'Start with `npm run launch:live` to project the real local organism. Everything below is the labelled DEMO_FIXTURE — not live.';
      liveBody.append(hint);
    }

    // The evidence files define plain globals (AUKORA_CONSOLE_FIXTURE, AukoraPanels) — load once.
    if (!window.AukoraPanels || !window.AUKORA_CONSOLE_FIXTURE) {
      await loadScript('/app/console/fixture.js');
      await loadScript('/app/console/panels.js');
    }
    const F = window.AUKORA_CONSOLE_FIXTURE;
    const P = window.AukoraPanels;
    const note = document.createElement('p');
    note.textContent = 'Read-only operator panels · ' + (F.label || 'DEMO_FIXTURE') + ' — deterministic committed evidence, distinct from the live strip above.';
    note.style.cssText = 'font-size:12.5px;color:var(--ink-faint);margin:6px 0 12px';
    wrap.append(note);
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px';
    for (const id of ORDER) grid.append(P.render[id](F));
    wrap.append(grid);
  } catch (err) {
    // Loud refusal state — never a silent blank pane.
    const fail = document.createElement('p');
    fail.textContent = 'Console evidence failed to load: ' + (err && err.message ? err.message : err);
    fail.style.cssText = 'color:#e2b04a;font-size:13px;padding:12px';
    wrap.append(fail);
  }
}
