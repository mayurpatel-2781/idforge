/* eslint-env es2020 */
'use strict';

/**
 * cuid.js — CUID and CUID2 Generation
 *
 * CUID  : c + timestamp + counter + fingerprint + random  (25 chars)
 * CUID2 : secure, collision-resistant, starts with a letter (24 chars)
 *
 * Drop-in compatible with the 'cuid' and '@paralleldrive/cuid2' npm packages.
 */

const crypto = require('crypto');
const os     = require('os');

// ── Shared internals ──────────────────────────────────────────────────────────

const BASE36 = '0123456789abcdefghijklmnopqrstuvwxyz';

function toBase36(n, pad = 0) {
  return Math.abs(Math.floor(n)).toString(36).padStart(pad, '0');
}

// Machine fingerprint: hash of hostname + pid
const _fingerprint = (() => {
  const raw = os.hostname() + process.pid;
  return crypto.createHash('md5').update(raw).digest('hex').slice(0, 4);
})();

// ── CUID (v1 style) ───────────────────────────────────────────────────────────

let _counter = Math.floor(Math.random() * 36 ** 4);

function _nextCounter() {
  _counter = (_counter + 1) % (36 ** 4);
  return _counter;
}

/**
 * Generate a CUID (v1).
 * Format: c{timestamp}{counter}{fingerprint}{random}
 * Length: 25 chars, always starts with 'c'.
 * @returns {string}
 */
function cuid() {
  const ts   = toBase36(Date.now(), 8);
  const cnt  = toBase36(_nextCounter(), 4);
  const rand = crypto.randomBytes(4).toString('hex');
  return `c${ts}${cnt}${_fingerprint}${rand}`;
}

/**
 * Validate a CUID (v1).
 * @param {string} id
 * @returns {boolean}
 */
function isCuid(id) {
  return typeof id === 'string' && /^c[0-9a-z]{24}$/.test(id);
}

// ── CUID2 (v2 style) ──────────────────────────────────────────────────────────

const CUID2_ALPHA = 'abcdefghijklmnopqrstuvwxyz';
const CUID2_CHARS = CUID2_ALPHA + '0123456789';

/**
 * Generate a CUID2 — secure, starts with a letter, no sequential patterns.
 * @param {{ length? }} [opts]  Default length: 24
 * @returns {string}
 */
function cuid2(opts = {}) {
  const { length = 24 } = opts;
  if (length < 2 || length > 32) throw new RangeError('cuid2 length must be 2–32');

  // First char: always a letter (a–z)
  const firstByte = crypto.randomBytes(1)[0];
  const first     = CUID2_ALPHA[firstByte % 26];

  // Remaining chars: hash of (timestamp + random + fingerprint)
  const entropy = crypto.randomBytes(32).toString('hex');
  const ts      = Date.now().toString(36);
  const raw     = `${ts}${entropy}${_fingerprint}`;
  const hash    = crypto.createHash('sha256').update(raw).digest('hex');

  // Map hash hex chars to our alphabet
  let rest = '';
  for (let i = 0; rest.length < length - 1; i++) {
    const byte = parseInt(hash[(i * 2) % hash.length] + hash[(i * 2 + 1) % hash.length], 16);
    rest += CUID2_CHARS[byte % CUID2_CHARS.length];
  }

  return first + rest.slice(0, length - 1);
}

/**
 * Validate a CUID2.
 * @param {string} id
 * @returns {boolean}
 */
function isCuid2(id) {
  return typeof id === 'string'
    && id.length >= 2 && id.length <= 32
    && /^[a-z][a-z0-9]+$/.test(id);
}

/**
 * Create a CUID2 generator with a fixed length.
 * @param {{ length? }} [opts]
 * @returns {() => string}
 */
function createCuid2(opts = {}) {
  return () => cuid2(opts);
}

/**
 * Parse a CUID (v1) into its components.
 * @param {string} id
 */
function parseCuid(id) {
  if (!isCuid(id)) throw new Error('Not a valid CUID');
  return {
    timestamp:   parseInt(id.slice(1, 9), 36),
    counter:     parseInt(id.slice(9, 13), 36),
    fingerprint: id.slice(13, 17),
    random:      id.slice(17),
  };
}

module.exports = { cuid, cuid2, isCuid, isCuid2, createCuid2, parseCuid };
