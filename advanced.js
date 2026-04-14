/* eslint-env es2020 */
'use strict';

const crypto = require('crypto');
const { nanoId } = require('./generators');

// ── Hash-based IDs ────────────────────────────────────────────────────────────

function hashId(input, opts = {}) {
  const { algorithm = 'sha256', encoding = 'hex', length = 16 } = opts;
  return crypto.createHash(algorithm).update(String(input)).digest(encoding).slice(0, length);
}

function shortHashId(input, opts = {}) {
  const { length = 12 } = opts;
  return hashId(input, { algorithm: 'sha256', encoding: 'hex' }).slice(0, length);
}

// ── Seeded IDs ────────────────────────────────────────────────────────────────

function seededId(seed, opts = {}) {
  // Deterministic: same seed → same ID every time
  const { size = 21 } = opts;
  const hash = crypto.createHash('sha256').update(String(seed)).digest('hex');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let result = '';
  for (let i = 0; result.length < size; i++) {
    const idx = parseInt(hash.slice((i * 2) % (hash.length - 1), (i * 2) % (hash.length - 1) + 2), 16);
    result += alphabet[idx % alphabet.length];
    if (i > size * 4) break; // safety
  }
  return result.slice(0, size);
}

function createSeededGenerator(baseSeed) {
  let counter = 0;
  return function () {
    return seededId(`${baseSeed}:${counter++}`);
  };
}

// ── One-Time Store ────────────────────────────────────────────────────────────

function createOneTimeStore() {
  const _store = new Set();
  const _consumed = new Set();

  return {
    add(id) { _store.add(id); },
    has(id) { return _store.has(id); },
    consume(id) {
      if (!_store.has(id)) return false;
      _store.delete(id);
      _consumed.add(id);
      return true;
    },
    wasConsumed(id) { return _consumed.has(id); },
    get size() { return _store.size; },
  };
}

// ── Blacklist ─────────────────────────────────────────────────────────────────

function createBlacklist(initial = []) {
  const _banned = new Set(initial);

  return {
    add(id) { _banned.add(id); },
    remove(id) { _banned.delete(id); },
    isBanned(id) { return _banned.has(id); },
    filter(ids) { return ids.filter(id => !_banned.has(id)); },
    get size() { return _banned.size; },
    toArray() { return [..._banned]; },
  };
}

// ── Entropy ID ────────────────────────────────────────────────────────────────

function entropyId(opts = {}) {
  const { bits = 128 } = opts;
  const bytes = Math.ceil(bits / 8);
  return crypto.randomBytes(bytes).toString('hex');
}

// ── Adaptive ID ───────────────────────────────────────────────────────────────

function adaptiveId(optsOrContext = {}) {
  const opts = typeof optsOrContext === 'string' ? { context: optsOrContext } : optsOrContext;
  const { context = 'default', size } = opts;
  const contextSizes = { 'high-traffic': 32, 'low-latency': 12, 'secure': 48, 'default': 21 };
  const resolvedSize = size || contextSizes[context] || 21;
  // Build a 3-char prefix from the context name
  const prefix = context.replace(/[^a-z0-9]/gi, '').slice(0, 3).toLowerCase() + '_';
  return prefix + nanoId({ size: resolvedSize });
}

// ── Use Case Registry ─────────────────────────────────────────────────────────

const _useCaseRegistry = new Map();

function registerUseCase(name, config = {}) {
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
  if (!uc) throw new Error(`Unknown use case: ${name}`);
  if (typeof uc.generate !== 'function') throw new Error(`Use case "${name}" has no generate fn`);
  return uc.generate(...args);
}

// ── Collision Prediction ──────────────────────────────────────────────────────

function predictCollision(opts = {}) {
  const { count = 1000, bits = 128 } = opts;
  // Birthday paradox approximation: P ≈ 1 - e^(-n²/2N)
  const N = Math.pow(2, bits);
  const n = count;
  const exponent = -(n * n) / (2 * N);
  const probability = 1 - Math.exp(exponent);
  const safeCount = Math.floor(Math.sqrt(2 * N * 0.01)); // count where P < 1%

  return {
    probability,
    probabilityPct: `${(probability * 100).toExponential(3)}%`,
    bits,
    count,
    safeCount,
    verdict: probability < 0.001 ? 'safe' : probability < 0.01 ? 'low-risk' : 'risky',
  };
}

// ── Compress / Decompress ─────────────────────────────────────────────────────

const BASE62_ALPHA = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function compressId(id) {
  // Convert hex/UUID to base62 for shorter representation
  const hex = id.replace(/-/g, '');
  if (!/^[0-9a-f]+$/i.test(hex)) {
    // Not hex — just base64url encode it
    return Buffer.from(id).toString('base64url');
  }
  let num = BigInt('0x' + hex);
  let result = '';
  const base = BigInt(62);
  while (num > 0n) {
    result = BASE62_ALPHA[Number(num % base)] + result;
    num /= base;
  }
  return result || '0';
}

function decompressId(compressed) {
  // Try base62 decode first
  let isBase62 = compressed.split('').every(c => BASE62_ALPHA.includes(c));
  if (isBase62) {
    try {
      let num = 0n;
      const base = BigInt(62);
      for (const ch of compressed) {
        num = num * base + BigInt(BASE62_ALPHA.indexOf(ch));
      }
      const hex = num.toString(16).padStart(32, '0');
      // Reconstruct UUID format if 32 hex chars
      if (hex.length === 32) {
        return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
      }
      return hex;
    } catch (_) { /* fall through */ }
  }
  // base64url decode
  try {
    return Buffer.from(compressed, 'base64url').toString('utf8');
  } catch (_) {
    return compressed;
  }
}

// ── Offline ID ────────────────────────────────────────────────────────────────

function offlineId(opts = {}) {
  // Combines timestamp + machine fingerprint + random for offline uniqueness
  const { size = 24 } = opts;
  const ts = Date.now().toString(36);
  const machine = crypto.createHash('md5')
    .update(process.pid.toString() + (process.env.HOSTNAME || 'local'))
    .digest('hex')
    .slice(0, 6);
  const rand = nanoId({ size: size - ts.length - machine.length });
  return `${ts}${machine}${rand}`.slice(0, size);
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
