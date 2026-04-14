/* eslint-env es2020 */
'use strict';

const crypto = require('crypto');

const { nanoId } = require('./generators');

// ── Base62 ────────────────────────────────────────────────────────────────────
const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE36 = '0123456789abcdefghijklmnopqrstuvwxyz';

function encodeBase62(num) {
  if (num === 0) return '0';
  let result = '';
  let n = BigInt(num);
  const base = BigInt(62);
  while (n > 0n) {
    result = BASE62[Number(n % base)] + result;
    n /= base;
  }
  return result;
}

function decodeBase62(str) {
  let result = 0n;
  const base = BigInt(62);
  for (const ch of str) {
    const idx = BASE62.indexOf(ch);
    if (idx === -1) throw new Error(`Invalid base62 char: ${ch}`);
    result = result * base + BigInt(idx);
  }
  return Number(result);
}

function encodeBase36(num) {
  return Math.abs(num).toString(36);
}

function decodeBase36(str) {
  return parseInt(str, 36);
}

// ── ID Generators ─────────────────────────────────────────────────────────────

function prefixedId(prefix, opts = {}) {
  const { size = 16, separator = '_' } = opts;
  return `${prefix}${separator}${nanoId({ size })}`;
}

function shortId(opts = {}) {
  const { size = 8 } = opts;
  return nanoId({ size });
}

function customLengthId(length, opts = {}) {
  return nanoId({ size: length, ...opts });
}

function urlSafeId(opts = {}) {
  const { size = 21 } = opts;
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  return nanoId({ size, alphabet });
}

function base62Id(opts = {}) {
  const { size = 16 } = opts;
  return nanoId({ size, alphabet: BASE62 });
}

function base36Id(opts = {}) {
  const { size = 16 } = opts;
  return nanoId({ size, alphabet: BASE36 });
}

// ── Visual / Emoji IDs ────────────────────────────────────────────────────────

const VISUAL_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusable chars
function visualId(opts = {}) {
  const { size = 12, separator = '-', groupSize = 4 } = opts;
  const raw = nanoId({ size, alphabet: VISUAL_ALPHABET });
  if (!separator) return raw;
  return (raw.match(new RegExp(`.{1,${groupSize}}`, 'g')) || [raw]).join(separator);
}

const EMOJI_SET = ['🔑','🗝️','⚡','🌟','🎯','🔮','💎','🚀','🌈','🎲','🔐','💡','🎪','🌊','🎸','🏆','🎭','🦄','🌺','🎨'];
function emojiId(opts = {}) {
  const { count = 4 } = opts;
  const bytes = crypto.randomBytes(count);
  return Array.from({ length: count }, (_, i) => EMOJI_SET[bytes[i] % EMOJI_SET.length]).join('');
}

function compactId(opts = {}) {
  // Compact: timestamp (base36) + random (base62), no separators
  const ts = encodeBase36(Date.now());
  const rand = nanoId({ size: 6, alphabet: BASE62 });
  return ts + rand;
}

module.exports = {
  prefixedId,
  shortId,
  customLengthId,
  urlSafeId,
  base62Id,
  base36Id,
  encodeBase62,
  decodeBase62,
  encodeBase36,
  decodeBase36,
  visualId,
  emojiId,
  compactId,
};
