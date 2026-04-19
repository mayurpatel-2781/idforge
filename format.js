/* eslint-env es2020 */
'use strict';

/**
 * format.js — ID Format & Encoding
 * Base62, Base36, visual, emoji, compact, prefixed, URL-safe IDs.
 */

const crypto = require('crypto');
const { nanoId, ALPHA_BASE62, ALPHA_BASE36 } = require('./generators');

// ── Base62 encode / decode ────────────────────────────────────────────────────

function encodeBase62(num) {
  if (typeof num !== 'number' && typeof num !== 'bigint')
    throw new TypeError('encodeBase62 expects a number or BigInt');
  if (num === 0 || num === 0n) return '0';
  let n = BigInt(num);
  const base = 62n;
  let result = '';
  while (n > 0n) {
    result = ALPHA_BASE62[Number(n % base)] + result;
    n /= base;
  }
  return result;
}

function decodeBase62(str) {
  if (typeof str !== 'string') throw new TypeError('decodeBase62 expects a string');
  let result = 0n;
  const base = 62n;
  for (const ch of str) {
    const idx = ALPHA_BASE62.indexOf(ch);
    if (idx === -1) throw new Error(`Invalid base62 char: "${ch}"`);
    result = result * base + BigInt(idx);
  }
  return Number(result);
}

// ── Base36 encode / decode ────────────────────────────────────────────────────

function encodeBase36(num) {
  if (typeof num !== 'number' && typeof num !== 'bigint')
    throw new TypeError('encodeBase36 expects a number');
  return Math.abs(Number(num)).toString(36);
}

function decodeBase36(str) {
  if (typeof str !== 'string') throw new TypeError('decodeBase36 expects a string');
  const n = parseInt(str, 36);
  if (isNaN(n)) throw new Error(`Invalid base36 string: "${str}"`);
  return n;
}

// ── ID generators ─────────────────────────────────────────────────────────────

function prefixedId(prefix, opts = {}) {
  if (!prefix || typeof prefix !== 'string') throw new TypeError('prefix must be a non-empty string');
  const { size = 16, separator = '_' } = opts;
  return `${prefix}${separator}${nanoId({ size })}`;
}

function shortId(opts = {}) {
  const { size = 8 } = opts;
  return nanoId({ size });
}

function customLengthId(length, opts = {}) {
  if (typeof length !== 'number' || length < 1)
    throw new RangeError('customLengthId: length must be a positive number');
  return nanoId({ size: length, ...opts });
}

function urlSafeId(opts = {}) {
  const { size = 21 } = opts;
  // RFC 3986 unreserved: A-Z a-z 0-9 - _ . ~
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  return nanoId({ size, alphabet });
}

function base62Id(opts = {}) {
  const { size = 16 } = opts;
  return nanoId({ size, alphabet: ALPHA_BASE62 });
}

function base36Id(opts = {}) {
  const { size = 16 } = opts;
  return nanoId({ size, alphabet: ALPHA_BASE36 });
}

// ── Visual / human-friendly ───────────────────────────────────────────────────

// Crockford-style: removes visually ambiguous chars (I, L, O, U)
const VISUAL_ALPHA = 'ABCDEFGHJKMNPQRSTVWXYZ0123456789';

function visualId(opts = {}) {
  const { size = 12, separator = '-', groupSize = 4 } = opts;
  const raw = nanoId({ size, alphabet: VISUAL_ALPHA });
  if (!separator) return raw;
  return (raw.match(new RegExp(`.{1,${groupSize}}`, 'g')) || [raw]).join(separator);
}

// ── Emoji ID ──────────────────────────────────────────────────────────────────

const EMOJI_SET = [
  '🔑','⚡','🌟','🎯','🔮','💎','🚀','🌈','🎲','🔐',
  '💡','🎪','🌊','🎸','🏆','🦄','🌺','🎨','🧩','🎭',
  '🌙','🦋','🍀','🔥','❄️','🌸','🦊','🐉','🌴','🎵',
];

function emojiId(opts = {}) {
  const { count = 4 } = opts;
  const bytes = crypto.randomBytes(count);
  return Array.from({ length: count }, (_, i) =>
    EMOJI_SET[bytes[i] % EMOJI_SET.length]
  ).join('');
}

// ── Compact ID ────────────────────────────────────────────────────────────────

function compactId(opts = {}) {
  // ts (base36) + random (base62) — no separators, URL-safe
  const { randomSize = 6 } = opts;
  const ts   = encodeBase36(Date.now());
  const rand = nanoId({ size: randomSize, alphabet: ALPHA_BASE62 });
  return ts + rand;
}

module.exports = {
  encodeBase62,
  decodeBase62,
  encodeBase36,
  decodeBase36,
  prefixedId,
  shortId,
  customLengthId,
  urlSafeId,
  base62Id,
  base36Id,
  visualId,
  emojiId,
  compactId,
};
