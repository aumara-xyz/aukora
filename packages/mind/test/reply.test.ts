// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
// The reply parser must be a trustworthy harness for a model-in-the-loop mind:
// tolerant parsing of one legal action (models fence, prefix, and chat around
// JSON), strict rejection of anything without exactly one legal action, and a
// bounded carried memo. Ported from the donor parser battery.
// Re-authored from the ARC-AGI-3 reasoning engine, aukora-symbiote branch
// fable/arc3-reasoning-engine-20260710 @ e5768a2f.
import { describe, expect, it } from 'vitest';
import { parseMindReply, validateAction, MEMO_MAX_CHARS } from '../index.js';

const REPLY = (over: Record<string, unknown> = {}) => JSON.stringify({
  whatISee: 'a blue block and a green pad',
  delta: 'blue moved right 6px, matching my prediction',
  hypothesis: 'maze: blue=me, ACTION4=right (confirmed x2)',
  action: 'ACTION4',
  reason: 'continue right toward the open corridor',
  prediction: 'blue at (30,24)',
  memo: 'controls: 4=right confirmed. goal green at (52,40).',
  ...over,
});

describe('parseMindReply — tolerant on wrapping, strict on the action', () => {
  it('parses a clean JSON reply', () => {
    const p = parseMindReply(REPLY());
    expect(p.ok).toBe(true);
    if (p.ok) {
      expect(p.action.name).toBe('ACTION4');
      expect(p.reason).toContain('corridor');
      expect(p.memo).toContain('4=right');
    }
  });

  it('parses through markdown fences and trailing chatter', () => {
    const p = parseMindReply('Here is my move:\n```json\n' + REPLY() + '\n```\nGood luck!');
    expect(p.ok).toBe(true);
  });

  it('parses a balanced object embedded in prose (no fence)', () => {
    const p = parseMindReply('I will act now. ' + REPLY() + ' That is my answer.');
    expect(p.ok).toBe(true);
  });

  it('is not fooled by triple backticks INSIDE string values of an unfenced reply', () => {
    const p = parseMindReply(REPLY({ whatISee: 'panel shows ```pattern``` marks near the door' }));
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.whatISee).toContain('pattern');
  });

  it('survives leading chatter that itself contains braces', () => {
    const p = parseMindReply('Considering {left, right} first. {"not":"the reply"} was wrong before. ' + REPLY());
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.action.name).toBe('ACTION4');
  });

  it('accepts numeric and bare-number action forms', () => {
    for (const a of [4, '4', 'action4', 'Action 4']) {
      const p = parseMindReply(REPLY({ action: a }));
      expect(p.ok).toBe(true);
      if (p.ok) expect(p.action.name).toBe('ACTION4');
    }
  });

  it('accepts click actions as object and as top-level x/y', () => {
    const obj = parseMindReply(REPLY({ action: { name: 'ACTION6', x: 30, y: 24 } }));
    expect(obj.ok).toBe(true);
    if (obj.ok) { expect(obj.action.x).toBe(30); expect(obj.action.y).toBe(24); }
    const top = parseMindReply(JSON.stringify({ action: 'ACTION6', x: 5, y: 9, reason: 'click the odd tile' }));
    expect(top.ok).toBe(true);
    if (top.ok) { expect(top.action.x).toBe(5); expect(top.action.y).toBe(9); }
  });

  it('rejects clicks without coordinates or out of range', () => {
    expect(parseMindReply(REPLY({ action: 'ACTION6' })).ok).toBe(false);
    expect(parseMindReply(REPLY({ action: { name: 'ACTION6', x: 99, y: 2 } })).ok).toBe(false);
  });

  it('rejects replies with no action and no JSON', () => {
    expect(parseMindReply('I think we should go right.').ok).toBe(false);
    expect(parseMindReply(REPLY({ action: 'ACTION9' })).ok).toBe(false);
  });

  it('caps the carried memo at 600 chars', () => {
    const p = parseMindReply(REPLY({ memo: 'x'.repeat(2000) }));
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.memo.length).toBe(MEMO_MAX_CHARS);
  });

  it('the parsed type carries the plan field by construction (empty when absent)', () => {
    const p = parseMindReply(REPLY());
    expect(p.ok).toBe(true);
    if (p.ok) expect(Array.isArray(p.plan)).toBe(true);
  });
});

describe('validateAction — only what the environment offers this turn is legal', () => {
  it('accepts an offered action and rejects an unoffered one', () => {
    expect(validateAction({ name: 'ACTION2' }, [1, 2, 3, 4]).ok).toBe(true);
    const v = validateAction({ name: 'ACTION6' }, [1, 2, 3, 4]);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toContain('not available');
  });

  it('fails closed when nothing is offered', () => {
    const v = validateAction({ name: 'ACTION1' }, undefined);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toContain('none');
  });
});
