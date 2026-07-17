// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R48 — adversarial malformed-output handling for an Inkling(NVFP4)-on-vLLM cell, PROVEN LOCALLY with
 * NO GPU, NO Nebius, NO paid call, NO credentials. A tiny in-process mock speaks the OpenAI-compatible
 * /v1/chat/completions contract vLLM serves; the BOUNDED reader that a real bring-up would put in front of
 * the cell is exercised against every hostile shape. The reader is the reusable artifact — it moves to the
 * real endpoint unchanged; only the transport URL differs.
 *
 * Laws asserted (fail-closed, never silent-truncate; the cell grants no authority):
 *   - well-formed JSON within the token ceiling → accepted;
 *   - truncated / non-JSON / empty output → REFUSED loudly (no partial acceptance);
 *   - output over the token ceiling → REFUSED (ceiling, not truncation);
 *   - an output that CLAIMS authority ("approved", grantsAuthority:true, apply/sign directives) → REFUSED;
 *   - every outcome writes a CONTENT-FREE receipt (hash + verdict, never the raw text).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';

// ── the bounded reader (the reusable artifact) ───────────────────────────────────────────────────────
const MAX_OUTPUT_TOKENS = 512; // mirrors the manifest ceiling
function approxTokens(s) { return Math.ceil(s.length / 4); }
const AUTHORITY_SHAPES = /\b(grantsAuthority"?\s*:\s*true|"?approved"?\s*:\s*true|\bAPPLY\b|\bSIGN\b|\bMERGE\b|autonomousMerge)/i;

function receipt(verdict, raw) {
  return { verdict, sha256: createHash('sha256').update(raw ?? '').digest('hex'), grantsAuthority: false };
}

/** Read one cell reply. Returns {ok, verdict, value?, receipt}. Never throws on hostile input. */
export function readCellOutput(httpStatus, bodyText) {
  if (httpStatus !== 200) return { ok: false, verdict: 'refused:transport', receipt: receipt('refused:transport', bodyText) };
  let env;
  try { env = JSON.parse(bodyText); } catch { return { ok: false, verdict: 'refused:non-json', receipt: receipt('refused:non-json', bodyText) }; }
  const content = env?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.length === 0) return { ok: false, verdict: 'refused:empty', receipt: receipt('refused:empty', bodyText) };
  if (env?.choices?.[0]?.finish_reason === 'length' || approxTokens(content) > MAX_OUTPUT_TOKENS)
    return { ok: false, verdict: 'refused:ceiling', receipt: receipt('refused:ceiling', bodyText) };
  if (AUTHORITY_SHAPES.test(content)) return { ok: false, verdict: 'refused:authority-claim', receipt: receipt('refused:authority-claim', bodyText) };
  // the reply must itself be a well-formed advisory JSON object (the cell proposes; it never authorizes)
  let advisory;
  try { advisory = JSON.parse(content); } catch { return { ok: false, verdict: 'refused:content-not-json', receipt: receipt('refused:content-not-json', bodyText) }; }
  if (advisory && advisory.grantsAuthority === true) return { ok: false, verdict: 'refused:authority-claim', receipt: receipt('refused:authority-claim', bodyText) };
  return { ok: true, verdict: 'accepted', value: advisory, receipt: receipt('accepted', bodyText) };
}

// ── mock OpenAI-compatible cell (stands in for vLLM; zero GPU) ───────────────────────────────────────
const CASES = {
  wellformed: { status: 200, content: JSON.stringify({ hypothesis: 'add a null guard', advisory: true }) },
  truncated:  { status: 200, raw: '{"choices":[{"message":{"content":"{\\"hypothesis\\": \\"add a nu' }, // cut mid-JSON
  nonjson:    { status: 200, content: 'Sure! Here is my plan in prose, no JSON at all.' },
  empty:      { status: 200, content: '' },
  oversized:  { status: 200, content: 'x'.repeat(4 * (MAX_OUTPUT_TOKENS + 200)) },
  finishlen:  { status: 200, content: '{"partial":true', finish: 'length' },
  authority:  { status: 200, content: JSON.stringify({ hypothesis: 'do it', grantsAuthority: true, apply: 'now' }) },
  http500:    { status: 500, raw: 'upstream error' },
};
function bodyFor(c) {
  if (c.raw !== undefined) return c.raw;
  return JSON.stringify({ choices: [{ message: { content: c.content }, finish_reason: c.finish ?? 'stop' }] });
}

let server, base;
beforeAll(async () => {
  server = createServer((req, res) => {
    let b = ''; req.on('data', (d) => (b += d)); req.on('end', () => {
      const which = (() => { try { return JSON.parse(b).which; } catch { return 'wellformed'; } })();
      const c = CASES[which] ?? CASES.wellformed;
      res.writeHead(c.status, { 'content-type': 'application/json' });
      res.end(bodyFor(c));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}/v1/chat/completions`;
});
afterAll(() => server && server.close());

async function ask(which) {
  const res = await fetch(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ which }) });
  return readCellOutput(res.status, await res.text());
}

describe('R48 Inkling cell — adversarial output handling (local mock, no GPU/Nebius/spend)', () => {
  it('accepts a well-formed advisory JSON within ceiling', async () => {
    const r = await ask('wellformed');
    expect(r.ok).toBe(true); expect(r.verdict).toBe('accepted'); expect(r.value.advisory).toBe(true);
  });
  it('refuses truncated JSON loudly (no partial acceptance)', async () => { expect((await ask('truncated')).verdict).toBe('refused:non-json'); });
  it('refuses non-JSON prose', async () => { expect((await ask('nonjson')).verdict).toBe('refused:content-not-json'); });
  it('refuses empty output', async () => { expect((await ask('empty')).verdict).toBe('refused:empty'); });
  it('refuses over-ceiling output (ceiling, not silent truncation)', async () => { expect((await ask('oversized')).verdict).toBe('refused:ceiling'); });
  it('refuses a length-finish (provider truncated) reply', async () => { expect((await ask('finishlen')).verdict).toBe('refused:ceiling'); });
  it('refuses an authority-claiming output', async () => { expect((await ask('authority')).verdict).toBe('refused:authority-claim'); });
  it('refuses a transport error', async () => { expect((await ask('http500')).verdict).toBe('refused:transport'); });
  it('every outcome is content-free (hash + verdict, never the raw text)', async () => {
    const r = await ask('authority');
    expect(r.receipt.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(r.receipt.grantsAuthority).toBe(false);
    expect(JSON.stringify(r.receipt)).not.toMatch(/grantsAuthority.*true|apply|do it/i);
  });
});
