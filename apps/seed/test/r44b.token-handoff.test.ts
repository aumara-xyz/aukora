// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R44b — bounded token-handoff closure for the loopback mind-door launcher.
 *
 * SOURCE law: `scripts/mind-door-7097.ts` adopts the supervisor-minted `AUKORA_DOOR_TOKEN` when present (and never
 * prints its VALUE), and preserves the standalone self-mint + one-time print when it is absent.
 * RUNTIME law: the token is a guard secret only — it never enters a door response, a receipt, or any store record.
 * The token is never hardcoded and never git-tracked (verified structurally here; the public scanner enforces it
 * across the tree).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ReactiveMemoryStore } from '@aukora/brain';
import { buildMemoryRecord } from '@aukora/memory';
import { MindDoor, HybridOwnerAdapter, loopbackOrigins, DOOR_PORT, type DoorRequest, type DoorDriver } from '../src/index.js';
import { NOW_ISO } from './support.js';

const SCRIPT = resolve(fileURLToPath(new URL('../scripts/mind-door-7097.ts', import.meta.url)));
const src = () => readFileSync(SCRIPT, 'utf8');
const ORIGIN = loopbackOrigins(DOOR_PORT)[0];
const SECRET_TOKEN = 'supervisor-secret-token-DO-NOT-LEAK-9f7215c5';

describe('R44b · mind-door token handoff (source contract)', () => {
  it('adopts the supervisor-minted AUKORA_DOOR_TOKEN as postToken', () => {
    const s = src();
    expect(s).toContain('AUKORA_DOOR_TOKEN');
    expect(s).toMatch(/postToken:\s*injectedToken/);            // handed into new MindDoor({...})
    expect(s).toMatch(/const\s+injectedToken\s*=\s*process\.env\.AUKORA_DOOR_TOKEN/);
  });

  it('never prints the token VALUE when injected; keeps the self-mint print only for the standalone path', () => {
    const s = src();
    // the localPostToken value print is GUARDED behind the not-injected branch — never unconditional
    expect(s).toMatch(/else\s*\{[\s\S]*localPostToken[\s\S]*\}/);
    expect(s).toMatch(/if\s*\(injectedToken\)\s*\{[\s\S]*value not printed[\s\S]*\}/);
    // the injected branch must NOT interpolate the token value
    const injectedBranch = /if\s*\(injectedToken\)\s*\{([\s\S]*?)\}\s*else/.exec(s)?.[1] ?? '';
    expect(injectedBranch).not.toContain('localPostToken');
    expect(injectedBranch).not.toContain('injectedToken}');     // no `${injectedToken}` interpolation
  });

  it('never hardcodes a token literal — the only source is env', () => {
    const s = src();
    expect(s).not.toMatch(/postToken:\s*['"`]/);                // no string-literal token
    expect(s).not.toMatch(/AUKORA_DOOR_TOKEN\s*=\s*['"`]/);     // no in-file assignment of a value
  });
});

describe('R44b · mind-door token handoff (runtime negative: token never leaks)', () => {
  function doorWith(token: string): { door: MindDoor; store: ReactiveMemoryStore } {
    const store = new ReactiveMemoryStore();
    const owner = new HybridOwnerAdapter('r44b-token');
    // A lazy driver that is never reached on the guarded/refused paths this test exercises.
    const loadDriver = async (): Promise<DoorDriver> => { throw new Error('driver not needed for token-leak paths'); };
    const door = new MindDoor({ store, ownerRoot: owner.root, nowIso: NOW_ISO, postToken: token, loadDriver });
    return { door, store };
  }
  const req = (over: Partial<DoorRequest> = {}): DoorRequest => ({ method: 'GET', path: '/api/status', headers: { origin: ORIGIN }, body: undefined, ...over });

  it('an injected token is adopted verbatim (used as the guard secret)', () => {
    const { door } = doorWith(SECRET_TOKEN);
    expect(door.localPostToken).toBe(SECRET_TOKEN);
  });

  it('the token never appears in any door RESPONSE (status, refused POST, bad-token POST)', async () => {
    const { door } = doorWith(SECRET_TOKEN);
    const responses = await Promise.all([
      door.handle(req()),                                                                             // status
      door.handle({ method: 'POST', path: '/api/chat', headers: { origin: 'https://evil.example' }, body: { text: 'hi' } }), // cross-origin refuse
      door.handle({ method: 'POST', path: '/api/chat', headers: { origin: ORIGIN, 'x-aukora-door-token': 'wrong' }, body: { text: 'hi' } }), // bad token
    ]);
    for (const r of responses) {
      expect(JSON.stringify(r)).not.toContain(SECRET_TOKEN);
    }
  });

  it('the token never enters a store record / receipt', async () => {
    const { door, store } = doorWith(SECRET_TOKEN);
    // exercise a token-guarded path so the door writes whatever receipts it writes
    await door.handle({ method: 'POST', path: '/api/chat', headers: { origin: ORIGIN, 'x-aukora-door-token': SECRET_TOKEN }, body: { text: 'hello' } });
    // seed an unrelated receipt too, to be sure recall is non-empty and still leak-free
    store.ingest(buildMemoryRecord({ content: 'unrelated', createdAt: NOW_ISO, kind: 'receipt', consent: 'owner-only', provenance: 'test' }));
    const everything = store.recall({}).map((r) => r.content).join('\n');
    expect(everything).not.toContain(SECRET_TOKEN);
    // the chain (content-free record ids) obviously carries no token either
    expect(JSON.stringify(store.chain())).not.toContain(SECRET_TOKEN);
  });
});
