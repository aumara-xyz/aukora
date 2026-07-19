// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Aukora
//
// Strict JSON parser (R60, Sam 4 shadow-cell lane). Closes the Avengers M2 finding that
// `JSON.parse` silently keeps the LAST value for a duplicate key, so a manifest can carry a benign
// `"enabled": false` next to a hidden `"enabled": true` and pass a naive read. This recursive-descent
// parser REJECTS duplicate object keys at any depth, rejects trailing content after the root value,
// and rejects control characters in strings — before any security check reads the object.
//
// It is intentionally a subset parser (no reviver, no BigInt): the packet is small, fixed-shape
// configuration, and a smaller grammar is easier to audit than a general one.

export class StrictJsonError extends Error {
  constructor(message, position) {
    super(`strict-json: ${message} (at ${position})`);
    this.name = 'StrictJsonError';
    this.position = position;
  }
}

/** Parse `text` as JSON, throwing StrictJsonError on duplicate keys, trailing content, or malformed
 *  input. Returns the parsed value (plain objects/arrays/primitives). */
export function parseStrict(text) {
  if (typeof text !== 'string') throw new StrictJsonError('input is not a string', 0);
  let i = 0;
  const n = text.length;
  const err = (msg) => { throw new StrictJsonError(msg, i); };

  const ws = () => {
    while (i < n) {
      const c = text[i];
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') i += 1;
      else break;
    }
  };

  function parseString() {
    // caller guarantees text[i] === '"'
    i += 1;
    let s = '';
    while (i < n) {
      const c = text[i];
      i += 1;
      if (c === '"') return s;
      if (c === '\\') {
        const e = text[i];
        i += 1;
        if (e === '"') s += '"';
        else if (e === '\\') s += '\\';
        else if (e === '/') s += '/';
        else if (e === 'b') s += '\b';
        else if (e === 'f') s += '\f';
        else if (e === 'n') s += '\n';
        else if (e === 'r') s += '\r';
        else if (e === 't') s += '\t';
        else if (e === 'u') {
          const hex = text.slice(i, i + 4);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) err('invalid \\u escape');
          s += String.fromCharCode(parseInt(hex, 16));
          i += 4;
        } else err('invalid escape sequence');
      } else if (c.charCodeAt(0) < 0x20) {
        err('unescaped control character in string');
      } else {
        s += c;
      }
    }
    return err('unterminated string');
  }

  function parseNumber() {
    const start = i;
    if (text[i] === '-') i += 1;
    if (text[i] === '0') i += 1;
    else if (text[i] >= '1' && text[i] <= '9') { while (i < n && text[i] >= '0' && text[i] <= '9') i += 1; }
    else return err('invalid number');
    if (text[i] === '.') { i += 1; if (!(text[i] >= '0' && text[i] <= '9')) err('invalid fraction'); while (i < n && text[i] >= '0' && text[i] <= '9') i += 1; }
    if (text[i] === 'e' || text[i] === 'E') {
      i += 1;
      if (text[i] === '+' || text[i] === '-') i += 1;
      if (!(text[i] >= '0' && text[i] <= '9')) err('invalid exponent');
      while (i < n && text[i] >= '0' && text[i] <= '9') i += 1;
    }
    const num = Number(text.slice(start, i));
    if (!Number.isFinite(num)) err('non-finite number');
    return num;
  }

  function parseArray() {
    i += 1; // [
    const arr = [];
    ws();
    if (text[i] === ']') { i += 1; return arr; }
    for (;;) {
      arr.push(parseValue());
      ws();
      if (text[i] === ',') { i += 1; ws(); continue; }
      if (text[i] === ']') { i += 1; return arr; }
      return err("expected ',' or ']' in array");
    }
  }

  function parseObject() {
    i += 1; // {
    const obj = {};
    const seen = new Set();
    ws();
    if (text[i] === '}') { i += 1; return obj; }
    for (;;) {
      ws();
      if (text[i] !== '"') return err('expected string key');
      const key = parseString();
      if (key === '__proto__') err('forbidden key __proto__');
      if (seen.has(key)) err(`duplicate object key ${JSON.stringify(key)}`);
      seen.add(key);
      ws();
      if (text[i] !== ':') return err("expected ':' after key");
      i += 1;
      const val = parseValue();
      Object.defineProperty(obj, key, { value: val, enumerable: true, writable: true, configurable: true });
      ws();
      if (text[i] === ',') { i += 1; continue; }
      if (text[i] === '}') { i += 1; return obj; }
      return err("expected ',' or '}' in object");
    }
  }

  function parseValue() {
    ws();
    if (i >= n) return err('unexpected end of input');
    const c = text[i];
    if (c === '{') return parseObject();
    if (c === '[') return parseArray();
    if (c === '"') return parseString();
    if (c === '-' || (c >= '0' && c <= '9')) return parseNumber();
    if (text.startsWith('true', i)) { i += 4; return true; }
    if (text.startsWith('false', i)) { i += 5; return false; }
    if (text.startsWith('null', i)) { i += 4; return null; }
    return err(`unexpected token '${c}'`);
  }

  const value = parseValue();
  ws();
  if (i !== n) err('trailing content after JSON value');
  return value;
}
