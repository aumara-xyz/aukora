// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * PerceptionProvider: explicit-consent + capped frames/audio, advisory + untrusted output, never
 * auto-remembered, no authority. (No API key exists in the contract — the offline provider needs none.)
 */
import { describe, it, expect } from 'vitest';
import {
  DeterministicOfflinePerceptionProvider,
  perceptionGrantsAuthority,
  DEFAULT_PERCEPTION_CAPS,
} from '../src/index.js';

const p = new DeterministicOfflinePerceptionProvider();

describe('PerceptionProvider', () => {
  it('text: advisory output, never auto-remembered, no authority', async () => {
    const r = await p.perceive({ modality: 'text', text: 'hello world' });
    expect(r.ok).toBe(true);
    expect(r.advisory?.startsWith('advisory:perception:text:')).toBe(true);
    expect(r.remember).toBe(false);       // never auto-remembered
    expect(r.grantsAuthority).toBe(false);
    expect(perceptionGrantsAuthority()).toBe(false);
  });

  it('vision/voice require explicit consent', async () => {
    const noVision = await p.perceive({ modality: 'vision', consent: false, frameBytes: 100 });
    expect(noVision.ok).toBe(false);
    expect(noVision.refusal).toContain('consent');
    const noVoice = await p.perceive({ modality: 'voice', consent: false, audioMs: 100, chunkIndex: 0 });
    expect(noVoice.ok).toBe(false);
    expect(noVoice.refusal).toContain('consent');
  });

  it('caps frame bytes, audio duration, and stream chunk count', async () => {
    const bigFrame = await p.perceive({ modality: 'vision', consent: true, frameBytes: DEFAULT_PERCEPTION_CAPS.maxFrameBytes + 1 });
    expect(bigFrame.ok).toBe(false);
    expect(bigFrame.refusal).toContain('byte cap');
    const longAudio = await p.perceive({ modality: 'voice', consent: true, audioMs: DEFAULT_PERCEPTION_CAPS.maxAudioMs + 1, chunkIndex: 0 });
    expect(longAudio.ok).toBe(false);
    expect(longAudio.refusal).toContain('duration cap');
    const tooManyChunks = await p.perceive({ modality: 'voice', consent: true, audioMs: 10, chunkIndex: DEFAULT_PERCEPTION_CAPS.maxStreamChunks });
    expect(tooManyChunks.ok).toBe(false);
    expect(tooManyChunks.refusal).toContain('chunk cap');
  });

  it('consented, within-cap vision/voice produce advisory, never-remembered results', async () => {
    const vis = await p.perceive({ modality: 'vision', consent: true, frameBytes: 1000, caption: 'a cat' });
    expect(vis.ok).toBe(true);
    expect(vis.advisory?.startsWith('advisory:perception:vision:')).toBe(true);
    expect(vis.remember).toBe(false);
    const voice = await p.perceive({ modality: 'voice', consent: true, audioMs: 1000, chunkIndex: 0, transcriptPartial: 'meow' });
    expect(voice.ok).toBe(true);
    expect(voice.remember).toBe(false);
  });
});
