/* eslint-env es2020 */
'use strict';

/**
 * generators.js — Core ID Generator Engine
 * All generators use opts-object API: fn({ size, alphabet, ... })
 * Never positional args — prevents NaN bugs.
 */

const crypto = require('crypto');

// ── Alphabet Constants ────────────────────────────────────────────────────────
const ALPHA_BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const ALPHA_BASE62    = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const ALPHA_BASE36    = '0123456789abcdefghijklmnopqrstuvwxyz';
const ALPHA_HEX       = '0123456789abcdef';
const ALPHA_NUMERIC   = '0123456789';
const ALPHA_ALPHA     = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

// ── Core nanoId ───────────────────────────────────────────────────────────────

/**
 * Generate a cryptographically random ID.
 * @param {object|number} [opts={}]  opts.size (default 21), opts.alphabet
 * @returns {string}
 */
function nanoId(opts = {}) {
  // Support legacy numeric call: nanoId(21) → treat as size
  if (typeof opts === 'number') opts = { size: opts };
  const { size = 21, alphabet = ALPHA_BASE64URL } = opts;
  if (typeof size !== 'number' || size < 1) throw new RangeError(`nanoId size must be a positive number, got: ${size}`);

  const bytes = crypto.randomBytes(size * 2);
  let result  = '';
  for (let i = 0; i < bytes.length && result.length < size; i++) {
    const idx = bytes[i] % alphabet.length;
    result   += alphabet[idx];
  }
  return result.slice(0, size);
}

// ── Type Registry ─────────────────────────────────────────────────────────────

const TYPE_PREFIXES = {
  user: 'usr', order: 'ord', session: 'ses', invoice: 'inv',
  product: 'prd', event: 'evt', payment: 'pay', ticket: 'tkt',
  document: 'doc', message: 'msg', team: 'tm', workspace: 'ws',
};
const TYPE_REGISTRY = { ...TYPE_PREFIXES };

function registerTypes(map) {
  if (typeof map !== 'object') throw new TypeError('registerTypes expects an object');
  Object.assign(TYPE_REGISTRY, map);
}

function typedId(type, opts = {}) {
  if (!type) throw new TypeError('typedId requires a type string');
  const prefix = TYPE_REGISTRY[type] || type.slice(0, 3).toLowerCase();
  const { size = 21 } = opts;
  return `${prefix}_${nanoId({ size })}`;
}

// ── Human-readable ────────────────────────────────────────────────────────────

const ADJECTIVES = [
  'brave','calm','dark','eager','fair','grand','happy','kind',
  'lively','merry','noble','proud','quick','rare','swift','true',
  'vivid','warm','young','zesty','bold','cool','deep','pure',
];
const NOUNS = [
  'hawk','lake','moon','pine','reef','sage','tide','wolf',
  'apex','bolt','cave','dusk','echo','fern','gale','haze',
];

function humanId(opts = {}) {
  const { separator = '-', words = 2, withNumber = true } = opts;
  const pick = arr => arr[crypto.randomInt(arr.length)];
  const parts = Array.from({ length: words }, (_, i) =>
    i % 2 === 0 ? pick(ADJECTIVES) : pick(NOUNS)
  );
  if (withNumber) parts.push(String(crypto.randomInt(1000, 9999)));
  return parts.join(separator);
}

// ── Sequential ────────────────────────────────────────────────────────────────

let _seq = 0;
function sequentialId(opts = {}) {
  const { pad = 8, prefix = '' } = opts;
  const n = String(++_seq).padStart(pad, '0');
  return prefix ? `${prefix}_${n}` : n;
}
function resetSequence(n = 0) { _seq = n; }
function getSequence()        { return _seq; }

// ── Pattern-based ─────────────────────────────────────────────────────────────

function fromPattern(pattern) {
  if (typeof pattern !== 'string') throw new TypeError('pattern must be a string');
  return pattern.replace(/[xXaA9]/g, c => {
    switch (c) {
      case 'x': return crypto.randomInt(16).toString(16);
      case 'X': return crypto.randomInt(16).toString(16).toUpperCase();
      case 'a': return ALPHA_ALPHA[crypto.randomInt(ALPHA_ALPHA.length)];
      case 'A': return ALPHA_ALPHA[crypto.randomInt(ALPHA_ALPHA.length)].toUpperCase();
      case '9': return String(crypto.randomInt(10));
      default:  return c;
    }
  });
}

module.exports = {
  nanoId,
  typedId,
  registerTypes,
  TYPE_REGISTRY,
  humanId,
  sequentialId,
  resetSequence,
  getSequence,
  fromPattern,
  // Alphabet exports
  ALPHA_BASE64URL,
  ALPHA_BASE62,
  ALPHA_BASE36,
  ALPHA_HEX,
  ALPHA_NUMERIC,
  ALPHA_ALPHA,
};
