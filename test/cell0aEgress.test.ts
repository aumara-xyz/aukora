// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R60 — canonical egress validator (Sam 4 lane). Closes the Avengers M2 finding that the R59
 * substring blocklist let metadata/RFC1918/alternate-loopback/IP/IDN/port/host tricks through.
 * Every check is offline; redirect/DNS-resolution contracts use fabricated inputs (no network).
 */
import { describe, it, expect } from 'vitest';
import {
  classifyEgressHost, canonicalizeHost, asIpLiteral,
  classifyResolvedAddress, classifyRedirectTarget,
  // @ts-expect-error — plain .mjs module
} from '../scripts/cell0a-egress.mjs';

const APPROVED = ['api.provider.example'];

describe('IP-literal detection across every notation', () => {
  const ipVectors: Array<[string, string]> = [
    ['169.254.169.254', 'cloud-metadata'],
    ['127.0.0.1', 'loopback'],
    ['10.0.0.1', 'private-rfc1918'],
    ['172.16.0.1', 'private-rfc1918'],
    ['192.168.1.1', 'private-rfc1918'],
    ['169.254.1.1', 'link-local'],
    ['0.0.0.0', 'unspecified/this-network'],
    ['100.64.0.1', 'cgnat-reserved'],
    ['8.8.8.8', 'global'],
  ];
  for (const [ip, klass] of ipVectors) {
    it(`${ip} → IPv4 ${klass}`, () => {
      const v = asIpLiteral(ip);
      expect(v).not.toBeNull();
      expect(v.family).toBe(4);
      expect(v.klass).toBe(klass);
    });
  }

  it('detects hex / octal / decimal / short-form IPv4 encodings of loopback', () => {
    for (const enc of ['0x7f000001', '0177.0.0.1', '2130706433', '0x7f.0.0.1', '127.1']) {
      expect(asIpLiteral(enc), enc).not.toBeNull();
    }
  });

  it('detects IPv6 literals incl. mapped loopback', () => {
    for (const enc of ['[::1]', '[::ffff:127.0.0.1]', '[fe80::1]', '[fc00::1]', '[::]']) {
      expect(asIpLiteral(enc), enc).not.toBeNull();
    }
  });
});

describe('classifyEgressHost — every M2 bypass rejects, approved host accepts', () => {
  const rejects: string[] = [
    '169.254.169.254', '10.0.0.1', '192.168.1.1', '172.16.0.1', '127.0.0.1',
    '0x7f000001', '0177.0.0.1', '2130706433', '127.1',
    '[::1]', '[::ffff:127.0.0.1]', '[fe80::1]', '[fc00::1]', '[::]',
    'localhost', 'single', 'evil.example',
    'api.provider.example:8080', 'https://api.provider.example', 'user@api.provider.example',
    'api.provider.example/path', 'API.PROVIDER.EXAMPLE', 'api.provider.example ',
    'аpi.provider.example', // Cyrillic 'а' homoglyph
    'github.com', 'raw.githubusercontent.com', 'x.github.io', 'foo.convex.cloud', 'y.convex.dev',
    '0.0.0.0', '255.255.255.255',
  ];
  for (const r of rejects) {
    it(`rejects ${JSON.stringify(r)}`, () => {
      expect(classifyEgressHost(r, APPROVED).ok, `${r} leaked`).toBe(false);
    });
  }

  it('accepts the exact approved host (and only via exact membership)', () => {
    expect(classifyEgressHost('api.provider.example', APPROVED).ok).toBe(true);
    // prefix/suffix/substring of an approved host is NOT accepted
    expect(classifyEgressHost('evil-api.provider.example', APPROVED).ok).toBe(false);
    expect(classifyEgressHost('api.provider.example.evil.com', APPROVED).ok).toBe(false);
  });

  it('a poisoned allowlist fails closed (IP / denied / malformed member)', () => {
    expect(classifyEgressHost('api.provider.example', ['169.254.169.254']).code).toBe('allowlist-poisoned');
    expect(classifyEgressHost('api.provider.example', ['github.com']).code).toBe('allowlist-poisoned');
    expect(classifyEgressHost('api.provider.example', ['NOT A HOST']).code).toBe('allowlist-poisoned');
  });

  it('canonicalizeHost reports a precise reason code', () => {
    expect(canonicalizeHost('127.0.0.1').code).toBe('ip-literal');
    expect(canonicalizeHost('API.example.com').code).toBe('bad-label');
    expect(canonicalizeHost('host:443').code).toBe('has-port');
    expect(canonicalizeHost('a@b.com').code).toBe('has-userinfo');
    expect(canonicalizeHost('single').code).toBe('single-label');
    expect(canonicalizeHost('ok.example.com').ok).toBe(true);
  });
});

describe('offline redirect + DNS-rebinding contracts (no network)', () => {
  it('a resolved private/metadata address is refused; a global one passes', () => {
    expect(classifyResolvedAddress('169.254.169.254').ok).toBe(false);
    expect(classifyResolvedAddress('10.0.0.5').ok).toBe(false);
    expect(classifyResolvedAddress('127.0.0.1').ok).toBe(false);
    expect(classifyResolvedAddress('8.8.8.8').ok).toBe(true);
  });

  it('a redirect Location to a forbidden target is refused; to the approved host, https-only, passes', () => {
    expect(classifyRedirectTarget('https://169.254.169.254/latest/meta-data', APPROVED).ok).toBe(false);
    expect(classifyRedirectTarget('http://api.provider.example', APPROVED).ok).toBe(false); // not https
    expect(classifyRedirectTarget('https://evil.example/x', APPROVED).ok).toBe(false);
    expect(classifyRedirectTarget('https://api.provider.example:8443/v1', APPROVED).ok).toBe(false); // bad port
    expect(classifyRedirectTarget('https://api.provider.example/v1', APPROVED).ok).toBe(true);
  });
});
