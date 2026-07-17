// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R47 — read-spine laws: GET/HEAD only · confined repo sight with LOUD reason classes · citations on recall ·
 * honest degradations · zero token knowledge. Runs the real handlers over a temp repo + a fake door fetcher.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { makeReadSpine, classifyRepoPath, REASONS } from '../scripts/readSpine.mjs';

let repo;
const fakeDoor = async (u) => ({
  ok: true,
  json: async () =>
    u.includes('/memory/recall') ? [{ recordId: 'a'.repeat(64), createdAt: '2026-07-17T00:00:01.000Z', content: 'the anchor holds' }]
    : u.includes('phase=awaiting-owner') ? [{ workflowId: 'wf1', phase: 'awaiting-owner' }]
    : u.includes('/receipts') ? [{ event: 'started' }]
    : { ok: true },
});

function run(spine, method, path) {
  return new Promise((resolve) => {
    const chunks = [];
    const res = {
      writeHead(status, headers) { this.status = status; this.headers = headers; },
      end(body) { resolve({ status: res.status, headers: res.headers, body: body ? JSON.parse(body) : null }); },
      write(c) { chunks.push(c); },
    };
    const url = new URL(`http://x${path}`);
    spine.handle({ method, on() {} }, res, url);
  });
}

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), 'aukora-spine-'));
  execFileSync('git', ['-C', repo, 'init', '-q']);
  mkdirSync(join(repo, 'docs'));
  writeFileSync(join(repo, 'docs', 'readme.md'), 'hello anchor world');
  mkdirSync(join(repo, 'state'));
  writeFileSync(join(repo, 'state', 'private.json'), 'never-visible');
  writeFileSync(join(repo, 'id.seed'), 'never-visible');
  execFileSync('git', ['-C', repo, 'add', '.']); // fingerprint needs a HEAD
  execFileSync('git', ['-C', repo, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'init']);
});
afterAll(() => rmSync(repo, { recursive: true, force: true }));

const spineFor = () => makeReadSpine({ repoRoot: repo, doorBase: 'http://door', fetchImpl: fakeDoor });

describe('confinement classifier — loud reason classes', () => {
  it('names every refusal', () => {
    expect(classifyRepoPath('../etc/passwd')).toEqual({ ok: false, reason: REASONS.OUTSIDE });
    expect(classifyRepoPath('.git/config').reason).toBe(REASONS.CUSTODY);
    expect(classifyRepoPath('.env').reason).toBe(REASONS.DOTFILE);
    expect(classifyRepoPath('state/private.json').reason).toBe(REASONS.STATE);
    expect(classifyRepoPath('id.seed').reason).toBe(REASONS.KEY_MATERIAL);
    expect(classifyRepoPath('apps/brain/secretThing.ts').reason).toBe(REASONS.CUSTODY);
    expect(classifyRepoPath('docs/readme.md')).toEqual({ ok: true, rel: 'docs/readme.md' });
  });
});

describe('spine handlers', () => {
  it('refuses every non-GET/HEAD method (donor GET/HEAD-only law)', async () => {
    const r = await run(spineFor(), 'POST', '/api/repo/read?path=docs/readme.md');
    expect(r.status).toBe(405);
    expect(r.body.reason).toBe(REASONS.METHOD);
  });

  it('every response carries the advisory containment header', async () => {
    const r = await run(spineFor(), 'GET', '/api/tests');
    expect(r.headers['x-aukora-grants-authority']).toBe('false');
  });

  it('fingerprint: head sha + branch + dirty from the actual repo', async () => {
    const r = await run(spineFor(), 'GET', '/api/fingerprint');
    expect(r.status).toBe(200);
    expect(r.body.head).toMatch(/^[0-9a-f]{40}$/);
    expect(typeof r.body.dirty).toBe('boolean');
  });

  it('repo read: confined file returns content; custody/state/key paths refuse LOUDLY', async () => {
    expect((await run(spineFor(), 'GET', '/api/repo/read?path=docs/readme.md')).body.content).toContain('hello anchor');
    expect((await run(spineFor(), 'GET', '/api/repo/read?path=state/private.json')).body.reason).toBe(REASONS.STATE);
    expect((await run(spineFor(), 'GET', '/api/repo/read?path=id.seed')).body.reason).toBe(REASONS.KEY_MATERIAL);
    expect((await run(spineFor(), 'GET', '/api/repo/read?path=../outside')).body.reason).toBe(REASONS.OUTSIDE);
    expect((await run(spineFor(), 'GET', '/api/repo/read?path=docs/missing.md')).body.reason).toBe(REASONS.NOT_FOUND);
  });

  it('repo list + search never surface denied paths', async () => {
    const list = await run(spineFor(), 'GET', '/api/repo/list?dir=.');
    expect(list.body.entries.map((e) => e.name)).not.toContain('state');
    expect(list.body.entries.map((e) => e.name)).not.toContain('id.seed');
    const search = await run(spineFor(), 'GET', '/api/repo/search?q=never-visible');
    expect(search.body.hits).toEqual([]); // the denied files' content is unreachable even by search
    const hit = await run(spineFor(), 'GET', '/api/repo/search?q=anchor');
    expect(hit.body.hits[0].path).toBe('docs/readme.md');
  });

  it('KIRA recall carries CITATIONS (content-addressed recordId + createdAt) and stays advisory', async () => {
    const r = await run(spineFor(), 'GET', '/api/kira/recall?q=anchor');
    expect(r.body.hits[0].citation.recordId).toBe('a'.repeat(64));
    expect(r.body.advisoryOnly).toBe(true);
    expect(r.body.grantsAuthority).toBe(false);
  });

  it('loop projection: pending workflows + rehearsal receipts via the door', async () => {
    const r = await run(spineFor(), 'GET', '/api/loop');
    expect(r.body.pending[0].phase).toBe('awaiting-owner');
    expect(r.body.rehearsalReceipts[0].event).toBe('started');
  });

  it('tests projection is HONESTLY degraded (declared, not faked)', async () => {
    const r = await run(spineFor(), 'GET', '/api/tests');
    expect(r.body.available).toBe(false);
    expect(r.body.reason).toBe('test-results-not-persisted-on-this-tree');
  });

  it('door outage refuses with the door-unreachable class (never a silent empty)', async () => {
    const dead = makeReadSpine({ repoRoot: repo, doorBase: 'http://door', fetchImpl: async () => { throw new Error('ECONNREFUSED'); } });
    const r = await run(dead, 'GET', '/api/loop');
    expect(r.status).toBe(502);
    expect(r.body.reason).toBe(REASONS.DOOR_DOWN);
  });

  it('ZERO TOKEN KNOWLEDGE: the spine source never references the door token', () => {
    const src = require('node:fs').readFileSync(new URL('../scripts/readSpine.mjs', import.meta.url), 'utf8');
    expect(src.includes('process.env.AUKORA_DOOR_TOKEN')).toBe(false);
    expect(src).not.toMatch(/MIND_TOKEN|x-aukora-door-token/);
  });
});
