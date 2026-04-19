/* eslint-env es2020 */
'use strict';

/**
 * advanced.js — Advanced ID Strategies
 * Seeded/deterministic IDs, hashing, one-time store,
 * blacklist, entropy, adaptive, use-case registry,
 * collision prediction, compression, offline IDs.
 */

const crypto = require('crypto');
const { nanoId, ALPHA_BASE62 } = require('./generators');

// ── Hash-based IDs ────────────────────────────────────────────────────────────

function hashId(input, opts = {}) {
  const { algorithm = 'sha256', encoding = 'hex', length } = opts;
  const h = crypto.createHash(algorithm).update(String(input)).digest(encoding);
  return length ? h.slice(0, length) : h;
}

function shortHashId(input, opts = {}) {
  const { length = 12, algorithm = 'sha256' } = opts;
  return hashId(input, { algorithm, encoding: 'hex', length });
}

// ── Seeded / Deterministic IDs ────────────────────────────────────────────────

const SEED_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function seededId(seed, opts = {}) {
  const { size = 21 } = opts;
  // HMAC-SHA256 as PRNG for determinism
  const key  = crypto.createHmac('sha256', String(seed)).update('seededId-v1').digest();
  let result = '';
  let block  = 0;
  while (result.length < size) {
    const h   = crypto.createHmac('sha256', key).update(String(block++)).digest();
    for (let i = 0; i < h.length && result.length < size; i++) {
      result += SEED_ALPHABET[h[i] % SEED_ALPHABET.length];
    }
  }
  return result.slice(0, size);
}

function createSeededGenerator(baseSeed, opts = {}) {
  let counter = 0;
  return function seededGen() {
    return seededId(`${baseSeed}:${counter++}`, opts);
  };
}

// ── One-Time Store ────────────────────────────────────────────────────────────

function createOneTimeStore() {
  const _active   = new Set();
  const _consumed = new Set();
  let   _total    = 0;

  return {
    add(id) {
      if (_consumed.has(id)) return false; // already used
      _active.add(id);
      _total++;
      return true;
    },
    has(id)  { return _active.has(id); },
    consume(id) {
      if (!_active.has(id)) return false;
      _active.delete(id);
      _consumed.add(id);
      return true;
    },
    wasConsumed(id) { return _consumed.has(id); },
    get size()      { return _active.size; },
    get totalAdded(){ return _total; },
    get totalConsumed() { return _consumed.size; },
    stats() {
      return { active: _active.size, consumed: _consumed.size, total: _total };
    },
  };
}

// ── Blacklist ─────────────────────────────────────────────────────────────────

function createBlacklist(initial = []) {
  const _banned = new Set(Array.isArray(initial) ? initial : []);

  return {
    add(id)      { _banned.add(id); return this; },
    remove(id)   { _banned.delete(id); return this; },
    isBanned(id) { return _banned.has(id); },
    filter(ids)  { return ids.filter(id => !_banned.has(id)); },
    toArray()    { return [..._banned]; },
    get size()   { return _banned.size; },
    clear()      { _banned.clear(); return this; },
  };
}

// ── Entropy ID ────────────────────────────────────────────────────────────────

function entropyId(opts = {}) {
  const { bits = 128, encoding = 'hex' } = opts;
  const bytes = Math.ceil(bits / 8);
  return crypto.randomBytes(bytes).toString(encoding === 'base64url' ? 'base64url' : 'hex');
}

// ── Adaptive ID ───────────────────────────────────────────────────────────────

const CONTEXT_SIZE_MAP = {
  'high-traffic': 32,
  'low-latency':  12,
  'secure':       48,
  'audit':        36,
  'cache':        10,
  'default':      21,
};

function adaptiveId(opts = {}) {
  const { context = 'default', size } = opts;
  const resolvedSize = size || CONTEXT_SIZE_MAP[context] || 21;
  return nanoId({ size: resolvedSize });
}

// ── Use Case Registry ─────────────────────────────────────────────────────────

const _useCaseRegistry = new Map();

function registerUseCase(name, config = {}) {
  if (!name) throw new TypeError('registerUseCase: name required');
  if (typeof config.generate !== 'function')
    throw new TypeError('registerUseCase: config.generate must be a function');
  _useCaseRegistry.set(name, { name, ...config });
}

function listUseCases() {
  return [..._useCaseRegistry.keys()];
}

function getUseCase(name) {
  return _useCaseRegistry.get(name) || null;
}

function generateForUseCase(name, ...args) {
  const uc = _useCaseRegistry.get(name);
  if (!uc) throw new Error(`Unknown use case: "${name}"`);
  return uc.generate(...args);
}

// ── Collision Prediction ──────────────────────────────────────────────────────

function predictCollision(opts = {}) {
  const { count = 1_000, bits = 128 } = opts;
  // Birthday paradox: P(collision) ≈ 1 - e^(-n(n-1)/(2N))
  // where N = 2^bits
  const n = count;
  // Use log for large N to avoid Infinity
  const logP = -(n * (n - 1)) / (2 * Math.pow(2, bits));
  const probability = Math.min(1, -Math.expm1(logP)); // 1 - e^logP

  // Count at which P(collision) ≈ 1%
  const safeCount = Math.floor(Math.sqrt(2 * Math.pow(2, bits) * 0.01));

  return {
    probability,
    probabilityPct: `${(probability * 100).toExponential(3)}%`,
    bits,
    count,
    safeCount: safeCount > Number.MAX_SAFE_INTEGER ? 'astronomical' : safeCount,
    verdict: probability < 0.000001 ? 'negligible'
      : probability < 0.001 ? 'safe'
      : probability < 0.01  ? 'low-risk'
      : 'risky',
  };
}

// ── Compress / Decompress ─────────────────────────────────────────────────────

function compressId(id) {
  if (typeof id !== 'string') throw new TypeError('compressId expects a string');
  // For UUID: strip dashes and encode as base62
  const hexOnly = id.replace(/-/g, '');
  if (/^[0-9a-f]{32}$/i.test(hexOnly)) {
    let n = BigInt('0x' + hexOnly);
    let result = '';
    const base = 62n;
    while (n > 0n) {
      result = ALPHA_BASE62[Number(n % base)] + result;
      n /= base;
    }
    return result.padStart(22, '0');
  }
  // For anything else: base64url encode
  return Buffer.from(id, 'utf8').toString('base64url');
}

function decompressId(compressed) {
  if (typeof compressed !== 'string') throw new TypeError('decompressId expects a string');
  // Try base62 UUID decode (22 chars, all base62)
  if (/^[0-9A-Za-z]{22}$/.test(compressed)) {
    try {
      let n = 0n;
      const base = 62n;
      for (const ch of compressed) {
        const idx = ALPHA_BASE62.indexOf(ch);
        if (idx === -1) throw new Error('not base62');
        n = n * base + BigInt(idx);
      }
      const hex = n.toString(16).padStart(32, '0');
      if (hex.length === 32) {
        return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
      }
    } catch { /* fall through */ }
  }
  // base64url decode
  try {
    return Buffer.from(compressed, 'base64url').toString('utf8');
  } catch {
    return compressed;
  }
}

// ── Offline-safe ID ───────────────────────────────────────────────────────────

function offlineId(opts = {}) {
  const { size = 24 } = opts;
  // ts(base36) + pid fingerprint + random — unique without network
  const ts      = Date.now().toString(36);
  const pidHex  = crypto.createHash('md5')
    .update(`${process.pid}:${process.env.HOSTNAME || 'local'}`)
    .digest('hex')
    .slice(0, 4);
  const randLen = Math.max(4, size - ts.length - pidHex.length);
  const rand    = nanoId({ size: randLen, alphabet: ALPHA_BASE62 });
  return `${ts}${pidHex}${rand}`.slice(0, size);
}

module.exports = {
  hashId,
  shortHashId,
  seededId,
  createSeededGenerator,
  createOneTimeStore,
  createBlacklist,
  entropyId,
  adaptiveId,
  registerUseCase,
  listUseCases,
  getUseCase,
  generateForUseCase,
  predictCollision,
  compressId,
  decompressId,
  offlineId,
};
