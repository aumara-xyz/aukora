// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R42 — the seed-side Fu execution path (runFuAdvisory → verdict → receipts) proven on the REAL captured
 * council replies (the donor issue-#34 live-run fixtures), via a deterministic local fixture transport.
 * No network, no paid call, advisory-only end to end. Complements the orchestrator-level suite in
 * packages/council/test/aukoraFuCouncil.realfixtures.test.ts.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ReactiveMemoryStore } from '@aukora/brain';
import { PACKET_OPEN, PACKET_CLOSE, type CouncilSeat, type Transport, type SeatResponse } from '@aukora/council';
import { runFuAdvisory, verdictFromCouncilOutcome } from '../src/index.js';
import { NOW_ISO, NOW_MS } from './support.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, '..', '..', '..', 'packages', 'council', 'test', 'fixtures', 'fusion-replies');
const fixture = (name: string) => fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf-8');

const LIVE_ROSTER: readonly CouncilSeat[] = [
  { id: 'GLM', slug: 'z-ai/glm-5.2',                name: 'GLM-5.2',     family: 'z-ai',     framework: 'symbolic',    costPer1M: 0.8 },
  { id: 'QWN', slug: 'qwen/qwen3.7-max',            name: 'Qwen-3.7',    family: 'alibaba',  framework: 'geometric',   costPer1M: 1.2 },
  { id: 'DSK', slug: 'deepseek/deepseek-v4-pro',    name: 'DeepSeek-V4', family: 'deepseek', framework: 'statistical', costPer1M: 0.9 },
  { id: 'KIM', slug: 'moonshotai/kimi-k2.7-code',   name: 'Kimi-K2.7',   family: 'moonshot', framework: 'embodied',    costPer1M: 0.74 },
  { id: 'LLA', slug: 'meta-llama/llama-4-maverick', name: 'Llama-4-Mav', family: 'meta',     framework: 'narrative',   costPer1M: 0.5 },
];

const REPLY_BY_SEAT: Record<string, string> = {
  GLM: fixture('glm-5.2-compliant.txt'),
  QWN: fixture('qwen3.7-max-compliant.txt'),
  DSK: fixture('deepseek-v4-pro-dist-reordered.txt'),
  KIM: fixture('kimi-k2.7-code-empty.txt'),
  LLA: fixture('llama-4-maverick-prose-noncompliant.txt'),
};

function envelope(raw: string): string {
  if (!raw.trim()) return raw;
  return `${PACKET_OPEN}\n${raw.trim()}\nCLAIMS:()\n${PACKET_CLOSE}`;
}

const fixtureTransport: Transport = async (seat): Promise<SeatResponse> => {
  const raw = REPLY_BY_SEAT[seat.id] ?? '';
  return { text: envelope(raw), served: seat.slug, finishReason: 'stop' };
};

const INPUT = {
  problem: 'Should a one-line clarifying comment be added above terminalState in workbenchRunReport.ts?',
  claims: ['Add the comment as proposed', 'The existing block comment already covers it'],
};

describe('R42 · seed Fu adapter end-to-end on REAL captured replies (deterministic, offline, advisory-only)', () => {
  it('under the DEFAULT quorum the pass completes honestly as insufficient-quorum → advisory-hold; receipt is content-free', async () => {
    const store = new ReactiveMemoryStore();
    const res = await runFuAdvisory(INPUT, fixtureTransport, store, { seats: LIVE_ROSTER, now: NOW_MS, nowIso: NOW_ISO });
    expect(res.ok).toBe(true);
    expect(res.outcome!.verdict).toBe('insufficient-quorum');
    expect(res.outcome!.votes.map((v) => v.seatId).sort()).toEqual(['DSK', 'GLM', 'QWN']);
    expect(res.grantsAuthority).toBe(false);
    // the pipeline projection must HOLD on an unmet quorum — real replies cannot launder a pass
    const verdict = verdictFromCouncilOutcome(res.outcome!);
    expect(verdict.verdict).toBe('advisory-hold');
    // the receipt is content-free: verdict/counts/digest only — never a model reply, hypothesis, or fixture text
    expect(res.receiptHash).toMatch(/^[0-9a-f]{64}$/);
    const receipts = store.recall({ kind: 'receipt' });
    const text = receipts.map((r) => r.content).join(' ');
    expect(text).toContain('fu-advisory');
    expect(text).not.toContain('terminalState');       // problem text stays out
    expect(text).not.toContain('clarifying comment');  // fixture payload stays out
  });

  it('under the explicit historical 3/3 rule the pass completes with a REAL hypothesis and $0 spent; still advisory', async () => {
    const store = new ReactiveMemoryStore();
    const res = await runFuAdvisory(INPUT, fixtureTransport, store, {
      seats: LIVE_ROSTER, now: NOW_MS, nowIso: NOW_ISO,
      quorum: { minVotes: 3, minFamilies: 3, requireSeatId: null },
    });
    expect(res.ok).toBe(true);
    expect(res.outcome!.quorumMet).toBe(true);
    expect(res.outcome!.answerSource).toBe('fallback-top-hyp');
    expect(res.outcome!.votes.map((v) => v.packet!.hypothesis)).toContain(res.outcome!.answer);
    expect(res.outcome!.actualUsd).toBe(0);
    expect(res.outcomeDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(res.advisoryOnly).toBe(true);
    expect(res.grantsAuthority).toBe(false);
  });
});
