// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/** R48 — Inkling cell boundary laws: typed contract, parked-by-default, deadline/cancel, identity echo,
 *  content-free receipts, zero authority. No network anywhere in this file — the transport is a fake. */
import { describe, it, expect } from 'vitest';
import { InklingCell, inklingGrantsAuthority, INKLING_MAX_DEADLINE_MS, type InklingTransport, type InklingRequest } from '../src/inklingCell.js';

const IDENTITY = { model: 'auma-vl', checkpoint: 'v7-glyph-burn', endpointClass: 'private-inkling' as const };
const req = (over: Partial<InklingRequest> = {}): InklingRequest =>
  ({ kind: 'inkling-request-v1', prompt: 'describe the shore', maxTokens: 64, deadlineMs: 500, ...over });
const okTransport = (text = 'the shore holds'): InklingTransport =>
  ({ identity: IDENTITY, call: async () => ({ kind: 'inkling-response-v1', text, identity: IDENTITY }) });

describe('R48 — Inkling provider/evolution-cell boundary', () => {
  it('PARKED by default: no transport ⇒ every call refuses loudly (no default endpoint exists)', async () => {
    const r = await new InklingCell().call(req());
    expect(r.ok).toBe(false);
    expect(r.receipt.outcome).toBe('refused');
    expect(r.receipt.reason).toMatch(/PARKED/);
  });

  it('typed contract: malformed / unbounded requests refuse at the boundary', async () => {
    const cell = new InklingCell(okTransport());
    for (const bad of [null, {}, req({ prompt: '' }), req({ maxTokens: 0 }), req({ deadlineMs: 0 }),
      req({ deadlineMs: INKLING_MAX_DEADLINE_MS + 1 }), { ...req(), kind: 'other' }]) {
      const r = await cell.call(bad);
      expect(r.ok).toBe(false);
      expect(r.receipt.outcome).toBe('refused');
    }
  });

  it('happy path echoes the declared model+checkpoint identity and receipts content-FREE', async () => {
    const r = await new InklingCell(okTransport()).call(req());
    expect(r.ok).toBe(true);
    const s = JSON.stringify(r.receipt);
    expect(r.receipt.identity).toEqual(IDENTITY);              // model+checkpoint identity carried
    expect(s).not.toContain('describe the shore');             // prompt text NEVER in the receipt
    expect(s).not.toContain('the shore holds');                // completion text NEVER in the receipt
    expect(r.receipt.requestHash).toMatch(/^[0-9a-f]{64}$/);
    expect(r.receipt.promptChars).toBe('describe the shore'.length);
    expect(r.receipt.grantsAuthority).toBe(false);
  });

  it('IDENTITY DRIFT refuses: a response served by a different model/checkpoint never passes', async () => {
    const drifted: InklingTransport = { identity: IDENTITY, call: async () => ({ kind: 'inkling-response-v1', text: 'x', identity: { ...IDENTITY, checkpoint: 'v5' } }) };
    const r = await new InklingCell(drifted).call(req());
    expect(r.ok).toBe(false);
    expect(r.receipt.reason).toMatch(/identity drift/);
  });

  it('DEADLINE: a slow transport times out with a timeout receipt (bounded work)', async () => {
    const slow: InklingTransport = { identity: IDENTITY, call: (_r, signal) => new Promise((_res, rej) => signal.addEventListener('abort', () => rej(new Error('aborted')))) };
    const r = await new InklingCell(slow).call(req({ deadlineMs: 50 }));
    expect(r.ok).toBe(false);
    expect(r.receipt.outcome).toBe('timeout');
  }, 5_000);

  it('CANCELLATION: a caller abort produces a cancelled receipt (barge-in stops work)', async () => {
    const slow: InklingTransport = { identity: IDENTITY, call: (_r, signal) => new Promise((_res, rej) => signal.addEventListener('abort', () => rej(new Error('aborted')))) };
    const ctl = new AbortController();
    const p = new InklingCell(slow).call(req({ deadlineMs: 5_000 }), ctl.signal);
    ctl.abort();
    const r = await p;
    expect(r.ok).toBe(false);
    expect(r.receipt.outcome).toBe('cancelled');
  }, 5_000);

  it('ZERO AUTHORITY: constant false; no sign/apply/merge/github verb exists in the cell source', () => {
    expect(inklingGrantsAuthority()).toBe(false);
    const raw = require('node:fs').readFileSync(new URL('../src/inklingCell.ts', import.meta.url), 'utf8');
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, ''); // strip comments: the LAW may name the forbidden verbs; the CODE may not
    expect(code).not.toMatch(/\bsign\w*\(|\bapply\w*\(|\bmerge\w*\(|github|octokit/i);
  });
});
