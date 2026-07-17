// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
// The turn window must keep PERFECT user/assistant parity inside a hard bound:
// too much history causes orientation blindness, broken parity throws 400s on
// strict providers. Ported from the donor battery.
// Re-authored from the ARC-AGI-3 reasoning engine, aukora-symbiote branch
// fable/arc3-reasoning-engine-20260710 @ e5768a2f.
import { describe, expect, it } from 'vitest';
import { TurnWindow } from '../index.js';

describe('TurnWindow — bounded, perfect parity', () => {
  it('never exceeds maxPairs and always alternates user/assistant', () => {
    const w = new TurnWindow(3);
    for (let i = 0; i < 10; i++) w.push(`frame ${i}`, `reply ${i}`);
    const msgs = w.messages('frame 10');
    expect(msgs.length).toBe(3 * 2 + 1);
    for (let i = 0; i < msgs.length; i++) {
      expect(msgs[i].role).toBe(i % 2 === 0 ? 'user' : 'assistant');
    }
    expect(msgs[0].content).toBe('frame 7'); // oldest retained pair
    expect(msgs[msgs.length - 1].content).toBe('frame 10');
  });

  it('first turn is a single user message (no orphan assistant)', () => {
    const w = new TurnWindow(5);
    const msgs = w.messages('first frame');
    expect(msgs.length).toBe(1);
    expect(msgs[0].role).toBe('user');
  });

  it('pairs only ever enter together — parity holds at every size', () => {
    const w = new TurnWindow(2);
    w.push('u1', 'a1');
    const msgs = w.messages('u2');
    expect(msgs.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
    expect(msgs[1].content).toBe('a1');
  });
});
