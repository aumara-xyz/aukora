// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * Keychain foundation (issue #30): opaque refs carry no secret material, metadata-only surfaces leak nothing,
 * rotation/revocation work, the broker contract is loopback-only fail-closed, and logs are redacted (canonical
 * scanner reuse). DISPOSABLE TEST CREDENTIALS ONLY; the OS adapter is not exercised here (test double per the
 * directive). A gated smoke test exists for the mac adapter (AUKORA_KEYCHAIN_SMOKE=1).
 */
import { describe, it, expect } from 'vitest';
import {
  InMemoryTestAdapter,
  MacKeychainAdapter,
  deriveCredentialRef,
  validateBrokerConfig,
  redactForLog,
  keychainGrantsAuthority,
} from '../src/index.js';

const NOW = '2026-07-16T06:00:00.000Z';
const DISPOSABLE = 'disposable-test-credential-value-12345'; // never a real secret

describe('keychain foundation — narrow custody adapter', () => {
  it('refs are opaque and identity-derived; metadata surfaces carry no secret material', () => {
    const store = new InMemoryTestAdapter();
    const m = store.store('nebius', 'sam2-test', DISPOSABLE, 'inference-read', NOW);
    expect(m.ref).toBe(deriveCredentialRef('nebius', 'sam2-test'));
    expect(m.ref).not.toContain(DISPOSABLE);
    expect(m.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    // list()/metadata() are metadata-only: the secret value appears NOWHERE in their serialization
    const dump = JSON.stringify({ list: store.list(), meta: store.metadata(m.ref) });
    expect(dump).not.toContain(DISPOSABLE);
    expect(keychainGrantsAuthority()).toBe(false);
  });

  it('retrieve is the single narrow value door; rotation updates fingerprint + rotatedAt with a stable ref', () => {
    const store = new InMemoryTestAdapter();
    const m = store.store('nebius', 'sam2-test', DISPOSABLE, 'inference-read', NOW);
    expect(store.retrieve(m.ref)).toBe(DISPOSABLE);
    const rotated = store.rotate(m.ref, 'disposable-rotated-67890', '2026-07-16T07:00:00.000Z');
    expect(rotated?.ref).toBe(m.ref);                       // ref stable across rotation
    expect(rotated?.fingerprint).not.toBe(m.fingerprint);   // fingerprint moved with the value
    expect(rotated?.rotatedAt).toBe('2026-07-16T07:00:00.000Z');
    expect(store.retrieve(m.ref)).toBe('disposable-rotated-67890');
  });

  it('revocation deletes the secret and tombstones the metadata', () => {
    const store = new InMemoryTestAdapter();
    const m = store.store('nebius', 'sam2-test', DISPOSABLE, 'inference-read', NOW);
    expect(store.revoke(m.ref)).toBe(true);
    expect(store.retrieve(m.ref)).toBeNull();               // value gone
    expect(store.metadata(m.ref)?.revoked).toBe(true);      // audit remains
    expect(store.rotate(m.ref, 'x', NOW)).toBeNull();       // a revoked credential cannot rotate back to life
  });

  it('broker contract is loopback-only, fail-closed', () => {
    const good = { schema: 'aukora-keychain-broker-v1', host: '127.0.0.1', port: 7788, allowedScopes: ['inference-read'], grantsAuthority: false };
    expect(validateBrokerConfig(good)).toEqual([]);
    expect(validateBrokerConfig({ ...good, host: '0.0.0.0' })).toContain('broker_must_bind_loopback_only');
    expect(validateBrokerConfig({ ...good, host: '192.168.1.10' })).toContain('broker_must_bind_loopback_only');
    expect(validateBrokerConfig({ ...good, grantsAuthority: true })).toContain('grants_authority_must_be_false');
  });

  it('logs are redacted: known stored values AND canonical scanner detections are masked', () => {
    const line = `stored ${DISPOSABLE} for sam2; also leaked AKIAIOSFODNN7EXAMPLE in a note`;
    const redacted = redactForLog(line, [DISPOSABLE]);
    expect(redacted).not.toContain(DISPOSABLE);
    expect(redacted).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(redacted).toContain('[REDACTED]');
  });

  it.skipIf(process.env.AUKORA_KEYCHAIN_SMOKE !== '1')('mac keychain smoke (gated; disposable credential; cleans up)', () => {
    const store = new MacKeychainAdapter();
    const m = store.store('aukora-smoke', 'sam2-smoke', DISPOSABLE, 'smoke', NOW);
    expect(store.retrieve(m.ref)).toBe(DISPOSABLE);
    expect(store.revoke(m.ref)).toBe(true);
    expect(store.retrieve(m.ref)).toBeNull();
  });
});
