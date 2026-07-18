// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R56 brick 1 — the chat envelope mismatch, reproduced and closed.
 *
 * The Spatial UI/voice client posts `{ owner_text, attachments, images, model }` (apps/spatial/app/chat.js),
 * while the pre-R56 door read only `text` — every real UI/voice turn silently fell into the empty-query
 * fallback and the attachment/image channels were dead-lettered (the witness-atlas "attachment-frame" false
 * green). Proven here:
 *   - the EXACT Spatial payload reaches the intended recall path (canonical `owner_text` channel);
 *   - `text` compatibility is deliberate and tested;
 *   - both-channels-disagreeing, malformed, oversized, and authority-shaped bodies refuse EXPLICITLY;
 *   - truncation and attachment handling are DISCLOSED, never silent;
 *   - the voice stays advisory: no authority fields, grantsAuthority:false, receipted events.
 */
import { describe, it, expect } from 'vitest';
import { ReactiveMemoryStore } from '@aukora/brain';
import { buildMemoryRecord } from '@aukora/memory';
import {
  MindDoor, HybridOwnerAdapter, DOOR_PORT, loopbackOrigins, InMemoryWorkflowStore, RecursionLedger,
  CandidateReferenceMonitor, LIMITS,
  type DoorRequest, type DoorDriver, type LocalCeremonyEnv,
} from '../src/index.js';

const NOW_ISO = '2026-07-18T12:00:00.000Z';
const NOW_MS = Date.parse(NOW_ISO);
const TOKEN = 'r56-chat-door-token-000000000000';
const ORIGIN = loopbackOrigins(DOOR_PORT)[0];

function makeDoor(): { door: MindDoor; store: ReactiveMemoryStore } {
  const store = new ReactiveMemoryStore();
  const owner = new HybridOwnerAdapter('r56-chat-test');
  // chat never runs the ceremony, but the door loads the driver before routing — give it a minimal real one
  const loadDriver = async (): Promise<DoorDriver> => {
    const recursionEnv = { store, knownFiles: new Set<string>(), ownerRoot: owner.root, ledger: new RecursionLedger(), nowMs: NOW_MS, nowIso: NOW_ISO, deadlineMs: NOW_MS + LIMITS.DEFAULT_WALL_TIME_BUDGET_MS };
    const ceremonyEnv: LocalCeremonyEnv = {
      recursionEnv, workflowStore: new InMemoryWorkflowStore(),
      repo: { list: () => [], read: () => '', exists: () => false },
      ownerRoot: owner.root, store, monitor: new CandidateReferenceMonitor(owner.root), nowMs: NOW_MS, nowIso: NOW_ISO,
    };
    return { ceremonyEnv };
  };
  const door = new MindDoor({ store, ownerRoot: owner.root, loadDriver, postToken: TOKEN, nowIso: NOW_ISO });
  return { door, store };
}
const post = (body: unknown): DoorRequest => ({ method: 'POST', path: '/api/chat', headers: { origin: ORIGIN, 'x-aukora-door-token': TOKEN }, body });

describe('R56 · chat envelope — the exact Spatial payload reaches recall; refusals are explicit', () => {
  it('EXACT Spatial payload { owner_text, attachments, images, model } → 200, recall path reached, channels disclosed', async () => {
    const { door, store } = makeDoor();
    store.ingest(buildMemoryRecord({ content: 'the spatial shell binds port 7090', createdAt: NOW_ISO, provenance: 'r56-test' }));
    const res = await door.handle(post({
      owner_text: 'the spatial shell binds port',
      attachments: [{ name: 'notes.txt', content: '// a small attachment' }],
      images: ['data:image/png;base64,aGVsbG8='],
      model: 'fable',
    }));
    expect(res.status).toBe(200);
    expect(res.json.textChannel).toBe('owner_text');                    // the canonical channel, not the fallback
    expect((res.json.citations as string[]).length).toBeGreaterThan(0); // recall REACHED (pre-R56: empty-query fallback)
    expect(String(res.json.answer)).toContain('7090');
    expect(res.json.truncated).toBe(false);
    expect(res.json.attachmentsReceived).toBe(1);
    expect(res.json.imagesReceived).toBe(1);
    expect(String(res.json.attachmentDisposition)).toContain('acknowledged-not-consumed'); // disclosed, not dead-lettered
    expect(String(res.json.modelDisposition)).toContain('ignored');
    expect(res.json.advisoryOnly).toBe(true);
    expect(res.json.grantsAuthority).toBe(false);
    expect(res.json.eventReceipt).toBeTruthy();
  });

  it('legacy { text } stays a DELIBERATE compatibility channel', async () => {
    const { door, store } = makeDoor();
    store.ingest(buildMemoryRecord({ content: 'legacy channel memory row', createdAt: NOW_ISO, provenance: 'r56-test' }));
    const res = await door.handle(post({ text: 'legacy channel memory row' }));
    expect(res.status).toBe(200);
    expect(res.json.textChannel).toBe('text');
    expect((res.json.citations as string[]).length).toBeGreaterThan(0);
  });

  it('owner_text and text BOTH present with different content → explicit door:chat-channel-ambiguous (never a silent pick)', async () => {
    const { door } = makeDoor();
    const res = await door.handle(post({ owner_text: 'one thing', text: 'another thing' }));
    expect(res.status).toBe(400);
    expect(res.json.reasonClass).toBe('door:chat-channel-ambiguous');
    // identical duplicates are NOT ambiguous (a client echoing both is tolerated)
    const same = await door.handle(post({ owner_text: 'same', text: 'same' }));
    expect(same.status).toBe(200);
  });

  it('truncation is DISCLOSED: an over-length owner_text answers with truncated:true, never silently clipped', async () => {
    const { door } = makeDoor();
    const res = await door.handle(post({ owner_text: `find ${'x'.repeat(9000)}` }));
    expect(res.status).toBe(200);
    expect(res.json.truncated).toBe(true);
  });

  it('malformed and oversized side channels refuse explicitly', async () => {
    const { door } = makeDoor();
    expect((await door.handle(post({ owner_text: 'q', attachments: 'not-an-array' }))).json.reasonClass).toBe('door:chat-attachments-malformed');
    expect((await door.handle(post({ owner_text: 'q', attachments: [42] }))).json.reasonClass).toBe('door:chat-attachments-malformed');
    expect((await door.handle(post({ owner_text: 'q', images: Array.from({ length: 5 }, () => 'i') }))).json.reasonClass).toBe('door:chat-attachments-oversized'); // VOICE_MAX_IMAGES=4
    expect((await door.handle(post({ owner_text: 'q', attachments: [{ name: 'big', content: 'x'.repeat(70000) }] }))).json.reasonClass).toBe('door:chat-attachments-oversized');
  });

  it('an AUTHORITY-SHAPED chat body refuses — the advisory channel can never carry or launder authorization', async () => {
    const { door } = makeDoor();
    for (const hostile of [
      { owner_text: 'q', ownerArmed: true },
      { owner_text: 'q', candidateAuth: { forged: true } },
      { owner_text: 'q', auth: {}, },
      { owner_text: 'q', nonce: 'n-1' },
      { owner_text: 'q', headBefore: 'a'.repeat(40) },
      { owner_text: 'q', proposalInput: { targetPath: 'x' } },
    ]) {
      const res = await door.handle(post(hostile));
      expect(res.status, JSON.stringify(Object.keys(hostile))).toBe(400);
      expect(res.json.reasonClass).toBe('door:chat-authority-shaped');
    }
  });

  it('empty body still degrades explicitly (textChannel none, honest fallback answer)', async () => {
    const { door } = makeDoor();
    const res = await door.handle(post({}));
    expect(res.status).toBe(200);
    expect(res.json.textChannel).toBe('none');
    expect(String(res.json.answer)).toContain('Advisory voice');
  });
});
