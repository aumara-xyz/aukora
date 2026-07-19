// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R51 continuity guards (issue #106) + R57A capture-layer guards — the truth-compiler asserted as tests.
 *
 * These prove the committed continuity views stay reconciled OFFLINE: the frozen 191-row preservation
 * ledger, the Atlas (disposition rows qualified through the R51 captured base), the committed R51 object
 * snapshot, and the R57A capture layer. Everything here is CAPTURE-CONSISTENT truth — agreement between
 * committed captures at their recorded anchors — not a claim of live GitHub freshness. A regression in any
 * count, an anchor-less capture, an illegal state transition, a silently rewritten freeze, or a leaked
 * donor-private title/body/label fails here.
 *
 * The R57A block re-derives every invariant directly from the JSON (independent of the gate's own logic),
 * so the gate and the tests must both be wrong for a violation to pass.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-expect-error — plain .mjs module
import { runContinuity } from '../scripts/verify-continuity.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p: string) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

const r = runContinuity();

describe('R51 continuity — the whole reconciliation is green', () => {
  it('verify-continuity reports zero reconciliation errors', () => {
    expect(r.errors, r.errors.join('\n')).toEqual([]);
  });
  it('the ledger is exactly the 191-row lossless inventory', () => {
    expect(r.entries).toBe(191);
  });
  it('the Atlas carries every R51-captured object plus the historical rows (capture-consistent)', () => {
    expect(r.atlasRows).toBeGreaterThanOrEqual(301);
    expect(r.currentObjects).toBe(110);
  });
  it('executable anatomy enforces coverage beyond supervisor-only', () => {
    expect(r.scopes).toBeGreaterThanOrEqual(3);
  });
});

describe('R57A capture layer — counts, anchors, uniqueness, gaps (independent re-derivation)', () => {
  const cap = readJson('docs/atlas/CURRENT_OBJECTS_R57A.json');
  const snap = readJson('docs/atlas/CURRENT_OBJECTS.json');
  const objs: Array<{ number: number; type: string; state: string }> = cap.aukora.objects;

  it('captures exactly 179 objects through max_object 179 (37 issues + 142 prs)', () => {
    expect(r.r57aObjects).toBe(179);
    expect(objs.length).toBe(179);
    expect(cap.aukora.max_object).toBe(179);
    expect(objs.filter((o) => o.type === 'issue').length).toBe(37);
    expect(objs.filter((o) => o.type === 'pr').length).toBe(142);
  });
  it('object numbers are unique and contiguous 1..max (no gaps, no duplicates)', () => {
    const nums = objs.map((o) => o.number);
    expect(new Set(nums).size).toBe(nums.length);
    const sorted = [...nums].sort((a, b) => a - b);
    expect(sorted[0]).toBe(1);
    expect(sorted[sorted.length - 1]).toBe(cap.aukora.max_object);
    for (let i = 0; i < sorted.length; i++) expect(sorted[i]).toBe(i + 1);
    expect(cap.aukora.gaps).toEqual([]);
    expect(cap.aukora.duplicates).toEqual([]);
  });
  it('records explicit anchors: ISO-8601 captured_at, 40-hex main head, R51 head equal to the pinned snapshot', () => {
    expect(cap.capture.captured_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(Number.isNaN(Date.parse(cap.capture.captured_at))).toBe(false);
    expect(cap.capture.anchors.public_main_head).toMatch(/^[0-9a-f]{40}$/);
    expect(cap.capture.anchors.r51_capture_head).toBe(snap.head_sha);
  });
  it('claims capture-consistency, never live freshness', () => {
    expect(cap.capture.truth_class).toBe('CAPTURE_CONSISTENT');
  });
});

describe('R57A capture layer — state transitions and both-direction equality', () => {
  const cap = readJson('docs/atlas/CURRENT_OBJECTS_R57A.json');
  const snap = readJson('docs/atlas/CURRENT_OBJECTS.json');
  const atlas = readJson('docs/atlas/ATLAS.json');
  const capBy = new Map<number, { number: number; type: string; state: string }>(
    cap.aukora.objects.map((o: { number: number }) => [o.number, o]),
  );

  it('is a strict superset of the R51 capture with types preserved', () => {
    for (const o of snap.aukora.objects) {
      const c = capBy.get(o.number);
      expect(c, `R51 object #${o.number} missing from R57A capture`).toBeTruthy();
      expect(c!.type, `#${o.number} type flipped`).toBe(o.type);
    }
  });
  it('every state change from R51 is legal (MERGED terminal, issues never merge) and drift lists match both directions', () => {
    const recomputed: string[] = [];
    for (const o of snap.aukora.objects) {
      const c = capBy.get(o.number)!;
      if (c.state !== o.state) {
        expect(o.state, `#${o.number} left terminal MERGED`).not.toBe('MERGED');
        expect(c.type === 'issue' && c.state === 'MERGED', `#${o.number} issue became MERGED`).toBe(false);
        recomputed.push(`${o.number}:${o.state}>${c.state}`);
      }
    }
    const recorded = cap.reconciliation_vs_r51.state_transitions.map(
      (t: { number: number; from: string; to: string }) => `${t.number}:${t.from}>${t.to}`,
    );
    expect([...recorded].sort()).toEqual([...recomputed].sort()); // both directions: same sets
    expect(r.r57aDrift).toBe(6); // R51→R57A truth: PRs #1/#17/#18/#19 and issues #106/#107 closed
  });
  it('pending-qualification set ∪ Atlas-qualified set tiles the captured set exactly (disjoint, both directions)', () => {
    const qualified = new Set<number>(
      atlas.rows.filter((row: { source: string }) => row.source === 'aukora').map((row: { number: number }) => row.number),
    );
    const pending = new Set<number>(cap.reconciliation_vs_r51.objects_pending_atlas_qualification);
    expect(r.r57aPending).toBe(69); // #111–#179 await qualification evidence; dispositions are not invented
    for (const n of pending) expect(qualified.has(n), `#${n} both qualified and pending`).toBe(false);
    for (const o of cap.aukora.objects) {
      expect(qualified.has(o.number) || pending.has(o.number), `captured #${o.number} unaccounted`).toBe(true);
    }
    for (const n of [...qualified, ...pending]) expect(capBy.has(n), `#${n} claimed but not captured`).toBe(true);
  });
});

describe('R57A pending intake — the ratified freeze is preserved, donor privacy is structural', () => {
  const cap = readJson('docs/atlas/CURRENT_OBJECTS_R57A.json');
  const ledger = readJson('docs/issue-preservation-ledger.json');

  it('the frozen ledger still holds exactly 191 rows (169 symbiote + 13 kernel + 9 fu) — intake never rewrites it', () => {
    expect(ledger.entries.length).toBe(191);
    const byRepo: Record<string, number> = {};
    for (const e of ledger.entries) byRepo[e.repo] = (byRepo[e.repo] ?? 0) + 1;
    expect(byRepo).toEqual({ 'aukora-symbiote': 169, 'aukora-kernel': 13, 'aukora-fu': 9 });
  });
  it('donor #405 is recorded as sanitized additive-pending intake, absent from the frozen ledger', () => {
    expect(r.r57aIntake).toBe(1);
    const p = cap.pending_intake.entries.find((e: { number: number }) => e.number === 405);
    expect(p).toBeTruthy();
    expect(p.repo).toBe('aukora-symbiote');
    expect(p.status).toBe('PENDING_OWNER_RATIFICATION');
    expect(p.captured_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    const inLedger = ledger.entries.some((e: { repo: string; number: number }) => e.repo === p.repo && e.number === p.number);
    expect(inLedger, 'intake entry must not already be in the ratified 191-row freeze').toBe(false);
  });
  it('every intake entry withholds donor-private title, body, and labels by construction', () => {
    for (const p of cap.pending_intake.entries) {
      expect(p.sanitized).toBe(true);
      expect(p.title).toBeNull();
      expect(p.body).toBeNull();
      expect(p.labels).toBeNull();
    }
  });
});
