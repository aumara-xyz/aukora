// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
//
// Canonical egress validator (R60, Sam 4 shadow-cell lane). Replaces the R59 substring blocklist
// (`/convex|github\.com|localhost|127\.0\.0\.1/`) — the Avengers M2 finding — with real parsing.
//
// LAW (no substring security decision anywhere):
//   - a host entry must be a bare, lowercase, ASCII LDH hostname with >= 2 labels; NO scheme, NO
//     userinfo, NO path/query/fragment, NO whitespace, NO port;
//   - ANY IP literal is rejected in EVERY notation (dotted/hex/octal/decimal IPv4, bracketed IPv6,
//     IPv4-mapped IPv6) — Cell 0A speaks to a NAMED provider host, never a bare address; this single
//     rule subsumes loopback, link-local, cloud-metadata (169.254.169.254), RFC1918, CGNAT,
//     documentation, reserved, multicast, broadcast, and unspecified addresses in all notations;
//   - non-ASCII / homoglyph hosts are rejected (the author must commit the exact IDNA/punycode form);
//   - a hard denylist rejects raw GitHub / Convex hosts and their subdomains regardless of allowlist;
//   - a host is APPROVED only by EXACT membership (byte-equality after canonicalization) in the
//     manifest's `approvedProviderHosts` allowlist — never by substring, prefix, or suffix.
//
// The redirect and DNS-resolution helpers are pure and OFFLINE: callers feed fabricated
// Location headers / resolved addresses (no real network, no real DNS) to prove the deploy-time
// contract that a redirect to a forbidden target or a DNS answer of a private address is rejected.

export const EGRESS_CODES = Object.freeze([
  'ok', 'not-a-string', 'empty', 'has-scheme', 'has-userinfo', 'has-path', 'has-whitespace',
  'has-port', 'ip-literal', 'non-ascii', 'bad-label', 'single-label', 'hard-denied',
  'not-in-allowlist', 'allowlist-poisoned',
]);

// Raw GitHub / Convex families — denied even if someone slips one into the approved allowlist.
const HARD_DENY_SUFFIXES = ['github.com', 'githubusercontent.com', 'github.io', 'convex.cloud', 'convex.dev', 'convex.site'];

const LABEL_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/; // lowercase LDH, no leading/trailing hyphen

/** Interpret one dotted part as a decimal / hex / octal integer per inet_aton rules; null if not
 *  purely numeric in one of those bases. */
function numericPart(p) {
  if (/^0[xX][0-9a-fA-F]+$/.test(p)) return parseInt(p, 16);
  if (/^0[0-7]+$/.test(p)) return parseInt(p, 8);
  if (/^0$/.test(p)) return 0;
  if (/^[1-9][0-9]*$/.test(p)) return Number(p);
  return null;
}

/** True if `host` is an IPv4 literal in ANY inet_aton notation (1–4 parts, dec/hex/octal). Returns
 *  the 32-bit value + a class label, or null. */
export function asIpv4(host) {
  const parts = host.split('.');
  if (parts.length < 1 || parts.length > 4) return null;
  const nums = parts.map(numericPart);
  if (nums.some((x) => x === null)) return null;
  // inet_aton: last part absorbs the remaining bytes; earlier parts are single bytes.
  let value = 0;
  for (let k = 0; k < parts.length - 1; k += 1) {
    if (nums[k] > 0xff) return null;
    value = (value << 8) | nums[k];
  }
  const maxLast = 2 ** (8 * (4 - (parts.length - 1)));
  const last = nums[parts.length - 1];
  if (last >= maxLast) return null;
  value = (value * maxLast + last) >>> 0;
  return { value: value >>> 0, klass: classifyIpv4(value >>> 0) };
}

function inRange(v, base, prefix) {
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (v & mask) >>> 0 === (base & mask) >>> 0;
}
const ip4 = (a, b, c, d) => ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;

export function classifyIpv4(v) {
  if (v === ip4(169, 254, 169, 254)) return 'cloud-metadata';
  if (inRange(v, ip4(0, 0, 0, 0), 8)) return 'unspecified/this-network';
  if (inRange(v, ip4(127, 0, 0, 0), 8)) return 'loopback';
  if (inRange(v, ip4(10, 0, 0, 0), 8)) return 'private-rfc1918';
  if (inRange(v, ip4(172, 16, 0, 0), 12)) return 'private-rfc1918';
  if (inRange(v, ip4(192, 168, 0, 0), 16)) return 'private-rfc1918';
  if (inRange(v, ip4(169, 254, 0, 0), 16)) return 'link-local';
  if (inRange(v, ip4(100, 64, 0, 0), 10)) return 'cgnat-reserved';
  if (inRange(v, ip4(192, 0, 2, 0), 24) || inRange(v, ip4(198, 51, 100, 0), 24) || inRange(v, ip4(203, 0, 113, 0), 24)) return 'documentation-reserved';
  if (inRange(v, ip4(224, 0, 0, 0), 4)) return 'multicast-reserved';
  if (inRange(v, ip4(240, 0, 0, 0), 4)) return 'reserved';
  if (v === 0xffffffff) return 'broadcast';
  return 'global';
}

/** Best-effort IPv6 literal detection + class for the message. Any match is rejected. */
export function asIpv6(host) {
  let h = host;
  if (h.startsWith('[') && h.endsWith(']')) h = h.slice(1, -1);
  // must look like hex groups separated by colons (allow embedded IPv4 tail and :: compression)
  if (!h.includes(':')) return null;
  if (!/^[0-9a-fA-F:.]+$/.test(h)) return null;
  const lower = h.toLowerCase();
  let klass = 'global';
  if (lower === '::1') klass = 'loopback';
  else if (lower === '::') klass = 'unspecified';
  else if (/^fe[89ab][0-9a-f]:/.test(lower)) klass = 'link-local';
  else if (/^f[cd][0-9a-f][0-9a-f]:/.test(lower)) klass = 'unique-local-private';
  else if (lower.startsWith('2001:db8')) klass = 'documentation-reserved';
  else if (lower.startsWith('::ffff:')) {
    const tail = lower.slice(7);
    const v4 = asIpv4(tail);
    klass = v4 ? `ipv4-mapped(${v4.klass})` : 'ipv4-mapped';
  }
  return { klass };
}

/** Classify a single host STRING as an IP literal (any notation) or not. */
export function asIpLiteral(host) {
  if (host.startsWith('[') || (host.includes(':') && /^[0-9a-fA-F:.\[\]]+$/.test(host))) {
    const v6 = asIpv6(host);
    if (v6) return { family: 6, klass: v6.klass };
  }
  const v4 = asIpv4(host);
  if (v4) return { family: 4, klass: v4.klass };
  return null;
}

function hardDenied(host) {
  return HARD_DENY_SUFFIXES.some((suf) => host === suf || host.endsWith(`.${suf}`));
}

/** Structural canonical validation of ONE host entry (no allowlist yet). Returns { ok, code, detail,
 *  host } where `host` is the canonical form when ok. */
export function canonicalizeHost(entry) {
  if (typeof entry !== 'string') return { ok: false, code: 'not-a-string', detail: 'host entry is not a string' };
  if (entry.length === 0) return { ok: false, code: 'empty', detail: 'empty host entry' };
  if (/\s/.test(entry)) return { ok: false, code: 'has-whitespace', detail: 'host entry contains whitespace' };
  if (/[^\x00-\x7f]/.test(entry)) return { ok: false, code: 'non-ascii', detail: 'host is not ASCII — commit the exact IDNA/punycode (xn--) form' };
  if (entry.includes('://')) return { ok: false, code: 'has-scheme', detail: 'host entry must not carry a scheme' };
  if (entry.includes('@')) return { ok: false, code: 'has-userinfo', detail: 'host entry must not carry userinfo' };
  if (entry.includes('/') || entry.includes('?') || entry.includes('#')) return { ok: false, code: 'has-path', detail: 'host entry must not carry a path/query/fragment' };

  // IP literal in any notation (checked BEFORE port-splitting so bracketed IPv6 is caught).
  const ipEarly = asIpLiteral(entry);
  if (ipEarly) return { ok: false, code: 'ip-literal', detail: `IP literal not permitted (IPv${ipEarly.family} ${ipEarly.klass}) — Cell 0A egress is to a named provider host only` };

  if (entry.includes(':')) return { ok: false, code: 'has-port', detail: 'port not permitted in host entry — egress is HTTPS/443 to a named host' };

  const host = entry.toLowerCase();
  if (host !== entry) return { ok: false, code: 'bad-label', detail: 'host must be lowercase' };
  const labels = host.split('.');
  if (labels.length < 2) return { ok: false, code: 'single-label', detail: 'host must have at least two labels' };
  if (!labels.every((l) => LABEL_RE.test(l))) return { ok: false, code: 'bad-label', detail: 'host label is not valid lowercase LDH' };

  // A purely-numeric dotted host that slipped past asIpv4 (e.g. 5 parts) is still refused as bad-label
  // by LABEL_RE only if a label is non-LDH; an all-numeric 4-part host was already caught as ip-literal.
  if (hardDenied(host)) return { ok: false, code: 'hard-denied', detail: `host ${JSON.stringify(host)} is in the permanent GitHub/Convex denylist` };

  return { ok: true, code: 'ok', host };
}

/** Validate a host entry AND require exact membership in `approvedProviderHosts`. The allowlist is
 *  itself canonicalized: a poisoned allowlist entry (IP/loopback/denied/malformed) fails closed. */
export function classifyEgressHost(entry, approvedProviderHosts) {
  const c = canonicalizeHost(entry);
  if (!c.ok) return c;

  if (!Array.isArray(approvedProviderHosts)) return { ok: false, code: 'not-in-allowlist', detail: 'no approved-provider allowlist declared' };
  // canonicalize every allowlist entry; any invalid entry poisons the allowlist (fail closed).
  const canonicalAllow = [];
  for (const a of approvedProviderHosts) {
    const ca = canonicalizeHost(a);
    if (!ca.ok) return { ok: false, code: 'allowlist-poisoned', detail: `approvedProviderHosts entry ${JSON.stringify(String(a).slice(0, 60))} is invalid (${ca.code})` };
    canonicalAllow.push(ca.host);
  }
  if (!canonicalAllow.includes(c.host)) {
    return { ok: false, code: 'not-in-allowlist', detail: `host ${JSON.stringify(c.host)} is not an exact member of approvedProviderHosts` };
  }
  return { ok: true, code: 'ok', host: c.host };
}

/** DNS-rebinding contract (offline): a resolved address must not be a private/loopback/metadata/
 *  reserved literal. Callers pass a fabricated resolved IP string; no real DNS is performed. */
export function classifyResolvedAddress(ipString) {
  const ip = asIpLiteral(ipString);
  if (!ip) return { ok: false, code: 'ip-literal', detail: `resolved address ${JSON.stringify(String(ipString).slice(0, 60))} is not a parseable IP` };
  if (ip.klass === 'global') return { ok: true, code: 'ok', detail: `resolved to a global IPv${ip.family} address` };
  return { ok: false, code: 'ip-literal', detail: `resolved address is IPv${ip.family} ${ip.klass} — refused (DNS-rebinding guard)` };
}

/** Redirect contract (offline): a Location target must be https, carry no userinfo, and its host must
 *  pass the full egress allowlist. Callers pass a fabricated Location URL string. */
export function classifyRedirectTarget(locationUrl, approvedProviderHosts) {
  let u;
  try { u = new URL(String(locationUrl)); } catch { return { ok: false, code: 'has-path', detail: 'redirect Location is not a valid absolute URL' }; }
  if (u.protocol !== 'https:') return { ok: false, code: 'has-scheme', detail: `redirect scheme ${u.protocol} is not https` };
  if (u.username || u.password) return { ok: false, code: 'has-userinfo', detail: 'redirect carries userinfo' };
  if (u.port && u.port !== '443') return { ok: false, code: 'has-port', detail: `redirect port ${u.port} not permitted` };
  return classifyEgressHost(u.hostname, approvedProviderHosts);
}
