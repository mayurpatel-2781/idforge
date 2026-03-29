/* eslint-env es2020 */
'use strict';

const crypto = require('crypto');

// ── Deterministic Chaos IDs (DCID) ────────────────────────────────────────────
// Looks random without the key.
// Fully reproducible with the key.
// Built on keyed pseudorandom permutation (HMAC-based PRF).

const DCID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const DCID_ALPHABET_SIZE = BigInt(DCID_ALPHABET.length);

/**
 * Generate a Deterministic Chaos ID.
 * Same inputs + same key → always same ID.
 * Without the key → indistinguishable from random.
 *
 * Internals: HKDF-like PRF — HMAC-SHA256(key, inputs) → encode in alphabet
 *
 * @param {...string} inputs   - any number of string inputs (e.g. 'user-42', 'tenant-99')
 * @param {{ key, size?, version? }} opts
 * @returns {string}
 */
function dcid(inputs, opts = {}) {
  // Support both dcid(['a','b'], opts) and dcid('a', 'b', ..., opts)
  let inputArr, options;
  if (Array.isArray(inputs)) {
    inputArr = inputs;
    options  = opts;
  } else {
    // Called as dcid(str1, str2, ..., optsObj)
    const args = [inputs, ...Object.values(opts).slice(0, -1)];
    options = Object.values(opts).slice(-1)[0] || {};
    inputArr = typeof inputs === 'string' ? [inputs] : inputs;
    // Re-parse properly
    const allArgs = Array.prototype.slice.call(arguments);
    const lastArg = allArgs[allArgs.length - 1];
    options  = (typeof lastArg === 'object' && lastArg !== null && !Array.isArray(lastArg)) ? lastArg : {};
    inputArr = allArgs.filter((a, i) => typeof a === 'string' || (i === 0 && Array.isArray(a)));
    if (Array.isArray(inputArr[0])) inputArr = inputArr[0];
  }

  const { key = 'dcid-default-key', size = 12, version = 1 } = options;

  // Canonical input: join all parts with null byte separator + version
  const canonical = `v${version}:${inputArr.join('\x00')}`;

  // PRF: HMAC-SHA256(key, canonical) gives 32 bytes = 256 bits
  const prfOutput = crypto
    .createHmac('sha256', key)
    .update(canonical)
    .digest();

  // Encode to target alphabet
  let num = BigInt('0x' + prfOutput.toString('hex'));
  let result = '';
  const needed = size;

  while (result.length < needed) {
    result = DCID_ALPHABET[Number(num % DCID_ALPHABET_SIZE)] + result;
    num /= DCID_ALPHABET_SIZE;
    if (num === 0n) {
      // Re-derive with counter suffix for longer IDs
      const extra = crypto
        .createHmac('sha256', key)
        .update(canonical + ':ext:' + result.length)
        .digest();
      num = BigInt('0x' + extra.toString('hex'));
    }
  }

  return result.slice(0, size);
}

/**
 * Verify two calls produce the same ID (for testing/auditing)
 */
function verifyDcid(id, inputs, opts = {}) {
  return dcid(Array.isArray(inputs) ? inputs : [inputs], opts) === id;
}

/**
 * Generate a DCID with a timestamp window — same key+inputs within a time
 * window produce the same ID, different windows produce different IDs.
 * Useful for idempotency keys.
 *
 * @param {string|string[]} inputs
 * @param {{ key, windowSeconds?, size? }} opts
 */
function idempotentId(inputs, opts = {}) {
  const { windowSeconds = 300, key = 'idempotent-key', size = 16 } = opts;
  const window = Math.floor(Date.now() / 1000 / windowSeconds);
  const inputArr = Array.isArray(inputs) ? inputs : [inputs];
  return dcid([...inputArr, `w:${window}`], { key, size });
}

module.exports = { dcid, verifyDcid, idempotentId, DCID_ALPHABET };
