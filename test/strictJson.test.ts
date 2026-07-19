// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
/**
 * R60 — strict JSON parser (Sam 4 lane). Closes the Avengers M2 duplicate-key finding: `JSON.parse`
 * silently keeps the LAST value for a duplicate key, so a manifest could hide `"enabled": true`
 * behind a benign `"enabled": false`. `parseStrict` rejects duplicates at any depth.
 */
import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain .mjs module
import { parseStrict, StrictJsonError } from '../scripts/strict-json.mjs';

describe('parseStrict — duplicate-key rejection', () => {
  it('rejects a top-level duplicate key (the exact M2 hide)', () => {
    expect(() => parseStrict('{"enabled": false, "enabled": true}')).toThrow(StrictJsonError);
    expect(() => parseStrict('{"enabled": false, "enabled": true}')).toThrow(/duplicate object key/);
  });

  it('rejects a duplicate key nested at any depth', () => {
    expect(() => parseStrict('{"egress": {"allowedHosts": [], "allowedHosts": ["evil.example"]}}')).toThrow(/duplicate object key/);
    expect(() => parseStrict('{"a": {"b": {"c": 1, "c": 2}}}')).toThrow(/duplicate object key/);
    expect(() => parseStrict('{"arr": [{"k": 1, "k": 2}]}')).toThrow(/duplicate object key/);
  });

  it('accepts the same key name in sibling objects (not a duplicate)', () => {
    const v = parseStrict('{"a": {"k": 1}, "b": {"k": 2}}');
    expect(v).toEqual({ a: { k: 1 }, b: { k: 2 } });
  });

  it('rejects __proto__ as a key (prototype-pollution guard)', () => {
    expect(() => parseStrict('{"__proto__": {"polluted": true}}')).toThrow(/__proto__/);
  });

  it('rejects trailing content after the root value', () => {
    expect(() => parseStrict('{"a":1} garbage')).toThrow(/trailing content/);
    expect(() => parseStrict('{}{}')).toThrow(/trailing content/);
  });

  it('rejects unescaped control characters and bad escapes in strings', () => {
    expect(() => parseStrict('{"a": "line\nbreak"}')).toThrow(/control character/);
    expect(() => parseStrict('{"a": "\\x41"}')).toThrow(/invalid escape/);
  });

  it('parses valid JSON identically to JSON.parse (no dupes)', () => {
    const text = '{"schema":"x","n":42,"f":-1.5e3,"b":true,"z":null,"arr":[1,"two",{"k":3}],"nested":{"deep":{"ok":true}}}';
    expect(parseStrict(text)).toEqual(JSON.parse(text));
  });

  it('rejects non-string input and malformed tokens', () => {
    expect(() => parseStrict(123 as unknown as string)).toThrow(StrictJsonError);
    expect(() => parseStrict('{bad}')).toThrow(StrictJsonError);
    expect(() => parseStrict('')).toThrow(StrictJsonError);
  });
});
