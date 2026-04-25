/* eslint-env es2020 */
'use strict';

/**
 * deterministic.js — Deterministic & Hash-based IDs
 *
 * SHA-2 (sha256, sha512), SHA-3 (sha3-256, sha3-512),
 * HMAC-based, namespace-scoped deterministic IDs.
 * Same input → always same output.
 */

const crypto = require('crypto');

// ── Supported algorithms ──────────────────────────────────────────────────────

const SUPPORTED = {
  'sha256':    { bits: 256,  family: 'sha2' },
  'sha512':    { bits: 512,  family: 'sha2' },
  'sha3-256':  { bits: 256,  family: 'sha3' },
  'sha3-512':  { bits: 512,  family: 'sha3' },
  'sha3-224':  { bits: 224,  family: 'sha3' },
  'sha3-384':  { bits: 384,  family: 'sha3' },
  'shake256':  { bits: 256,  family: 'sha3' },
  'md5':       { bits: 128,  family: 'md5'  }, // for legacy compat only
};

function _validateAlgo(algorithm) {
  if (!SUPPORTED[algorithm]) {
    throw new Error(`Unsupported algorithm: "${algorithm}". Supported: ${Object.keys(SUPPORTED).join(', ')}`);
  }
}

// ── Core hash ID ──────────────────────────────────────────────────────────────

/**
 * Generate a deterministic ID from any input using a hash function.
 * Same input + same algorithm = same output every time.
 *
 * @param {string|object} input
 * @param {{ algorithm?, encoding?, length?, prefix? }} [opts]
 * @returns {string}
 */
function deterministicId(input, opts = {}) {
  const {
    algorithm = 'sha256',
    encoding  = 'hex',
    length,
    prefix    = '',
  } = opts;

  _validateAlgo(algorithm);

  const normalized = typeof input === 'object'
    ? JSON.stringify(input, Object.keys(input).sort()) // stable JSON
    : String(input);

  let hash;
  if (algorithm === 'shake256') {
    // SHAKE-256 is an XOF, needs outputLength
    hash = crypto.createHash('shake256', { outputLength: 32 }).update(normalized).digest(encoding);
  } else {
    hash = crypto.createHash(algorithm).update(normalized).digest(encoding);
  }

  const result = length ? hash.slice(0, length) : hash;
  return prefix ? `${prefix}_${result}` : result;
}

/**
 * SHA-3 256-bit deterministic ID.
 * @param {string} input
 * @param {{ length?, encoding?, prefix? }} [opts]
 */
function sha3Id(input, opts = {}) {
  return deterministicId(input, { ...opts, algorithm: 'sha3-256' });
}

/**
 * SHA-3 512-bit deterministic ID.
 */
function sha3Id512(input, opts = {}) {
  return deterministicId(input, { ...opts, algorithm: 'sha3-512' });
}

/**
 * SHA-256 deterministic ID.
 */
function sha2Id(input, opts = {}) {
  return deterministicId(input, { ...opts, algorithm: 'sha256' });
}

// ── HMAC-based IDs ────────────────────────────────────────────────────────────

/**
 * HMAC-keyed deterministic ID — only reproducible with the same key.
 * Useful for server-side deterministic tokens that clients can't forge.
 *
 * @param {string} input
 * @param {string} secretKey
 * @param {{ algorithm?, length?, encoding? }} [opts]
 */
function hmacId(input, secretKey, opts = {}) {
  const { algorithm = 'sha256', length = 32, encoding = 'hex' } = opts;
  if (!secretKey) throw new TypeError('hmacId: secretKey is required');
  return crypto
    .createHmac(algorithm, secretKey)
    .update(String(input))
    .digest(encoding)
    .slice(0, length);
}

// ── Namespace-scoped deterministic ID ─────────────────────────────────────────

/**
 * Generate a deterministic ID scoped to a namespace.
 * namespace + input → always the same ID, different namespaces → different IDs.
 *
 * @param {string} namespace
 * @param {string} input
 * @param {{ algorithm?, length? }} [opts]
 */
function namespacedId(namespace, input, opts = {}) {
  const { algorithm = 'sha256', length = 32 } = opts;
  _validateAlgo(algorithm);
  const combined = `${namespace}:${input}`;
  return crypto.createHash(algorithm).update(combined).digest('hex').slice(0, length);
}

// ── Composite deterministic ID ────────────────────────────────────────────────

/**
 * Hash multiple values together into one deterministic ID.
 * Order of values matters.
 *
 * @param {string[]} values
 * @param {{ algorithm?, length? }} [opts]
 */
function compositeId(values, opts = {}) {
  const { algorithm = 'sha256', length = 32 } = opts;
  _validateAlgo(algorithm);
  if (!Array.isArray(values) || values.length === 0)
    throw new TypeError('compositeId: values must be a non-empty array');
  const combined = values.map(String).join('|');
  return crypto.createHash(algorithm).update(combined).digest('hex').slice(0, length);
}

// ── Content-addressable ID ────────────────────────────────────────────────────

/**
 * Generate a content-addressable ID (like git blob hashing).
 * Identical content always produces the same ID — perfect for dedup.
 *
 * @param {string|Buffer} content
 * @param {{ algorithm? }} [opts]
 */
function contentId(content, opts = {}) {
  const { algorithm = 'sha256' } = opts;
  _validateAlgo(algorithm);
  const buf  = Buffer.isBuffer(content) ? content : Buffer.from(String(content), 'utf8');
  const size = buf.length;
  // Git-style: hash of "blob {size}\0{content}"
  const header = Buffer.from(`blob ${size}\0`);
  return crypto.createHash(algorithm)
    .update(Buffer.concat([header, buf]))
    .digest('hex');
}

// ── List supported algorithms ─────────────────────────────────────────────────

function listAlgorithms() {
  return Object.entries(SUPPORTED).map(([name, info]) => ({ name, ...info }));
}

module.exports = {
  deterministicId,
  sha3Id,
  sha3Id512,
  sha2Id,
  hmacId,
  namespacedId,
  compositeId,
  contentId,
  listAlgorithms,
};
