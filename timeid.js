/* eslint-env es2020 */
'use strict';

const crypto = require('crypto');
const { nanoId } = require('./generators');

// ── Timestamp ID ──────────────────────────────────────────────────────────────

function timestampId(opts = {}) {
  const { encoding = 'base36', randomSize = 8 } = opts;
  const ts = encoding === 'base36'
    ? Date.now().toString(36)
    : Date.now().toString();
  const rand = nanoId({ size: randomSize });
  return `${ts}_${rand}`;
}

function extractTime(id) {
  // Handles: timestampId (base36_rand), snowflake (numeric), ulid, exp_ prefixed
  if (typeof id !== 'string') return null;

  // exp_ format: exp_<timestamp>_<rand>
  if (id.startsWith('exp_')) {
    const ts = parseInt(id.split('_')[1]);
    return isNaN(ts) ? null : new Date(ts);
  }

  // timestampId format: <base36>_<rand>
  if (id.includes('_')) {
    const part = id.split('_')[0];
    const ts = parseInt(part, 36);
    if (!isNaN(ts) && ts > 1_000_000_000_000) return new Date(ts);
  }

  // Pure numeric (snowflake-like)
  if (/^\d{15,20}$/.test(id)) {
    const ts = Number(BigInt(id) >> BigInt(22));
    if (ts > 1_000_000_000_000) return new Date(ts);
  }

  // hex timestamp prefix
  const hexTs = parseInt(id.slice(0, 8), 16);
  if (!isNaN(hexTs) && hexTs > 1_000_000_000) return new Date(hexTs * 1000);

  return null;
}

// ── Time Window ID ────────────────────────────────────────────────────────────

const _windowCache = new Map();

function timeWindowId(opts = {}) {
  const { windowMs = 60_000, prefix = 'tw' } = opts;
  const window = Math.floor(Date.now() / windowMs);
  const key = `${prefix}:${windowMs}`;

  if (_windowCache.has(key) && _windowCache.get(key).window === window) {
    return _windowCache.get(key).id;
  }

  const id = `${prefix}_${window.toString(36)}`;
  _windowCache.set(key, { window, id });
  return id;
}

// ── Epoch Day ID ──────────────────────────────────────────────────────────────

const _dayCache = { day: null, id: null };

function epochDayId(opts = {}) {
  const { prefix = 'day' } = opts;
  const MS_PER_DAY = 86_400_000;
  const day = Math.floor(Date.now() / MS_PER_DAY);

  if (_dayCache.day === day) return _dayCache.id;

  const id = `${prefix}_${day.toString(36)}`;
  _dayCache.day = day;
  _dayCache.id = id;
  return id;
}

// ── Context ID ────────────────────────────────────────────────────────────────

function contextId(context = {}, opts = {}) {
  const { size = 8 } = opts;
  const parts = Object.entries(context)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${String(v).slice(0, 8)}`)
    .join('|');
  const hash = crypto.createHash('md5').update(parts).digest('hex').slice(0, 8);
  const rand = nanoId({ size });
  return `ctx_${hash}_${rand}`;
}

// ── Meaningful ID ─────────────────────────────────────────────────────────────

const ADJECTIVES = ['swift','calm','brave','bright','quick','dark','eager','fair','grand','happy','kind','lively','noble','proud','rare','true','vivid','warm','young','zesty','bold','cool','deep','pure','soft'];
const NOUNS = ['order','invoice','user','session','product','event','record','entry','token','batch','request','report','ticket','task','note'];

function meaningfulId(opts = {}) {
  const { noun, adjective, separator = '-', withTimestamp = false } = opts;
  const adj = adjective || ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const nn  = noun      || NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const rand = Math.floor(Math.random() * 9000 + 1000);
  const base = `${adj}${separator}${nn}${separator}${rand}`;
  if (withTimestamp) return `${base}${separator}${Date.now().toString(36)}`;
  return base;
}

// ── Pronounceable ID ──────────────────────────────────────────────────────────

const CONSONANTS = 'bcdfghjklmnpqrstvwxyz';
const VOWELS     = 'aeiou';

function pronounceableId(opts = {}) {
  const { syllables = 4, separator = '-' } = opts;
  const bytes = crypto.randomBytes(syllables * 2);
  let result = '';

  for (let i = 0; i < syllables; i++) {
    const c = CONSONANTS[bytes[i * 2]     % CONSONANTS.length];
    const v = VOWELS    [bytes[i * 2 + 1] % VOWELS.length];
    result += c + v;
  }

  if (separator) {
    const half = Math.floor(result.length / 2);
    return result.slice(0, half) + separator + result.slice(half);
  }
  return result;
}

// ── Multi-Format ID ───────────────────────────────────────────────────────────

const FORMATS = {
  hex:    (size = 16) => crypto.randomBytes(Math.ceil(size / 2)).toString('hex').slice(0, size),
  base64: (size = 16) => crypto.randomBytes(Math.ceil(size * 3 / 4)).toString('base64url').slice(0, size),
  base36: (size = 16) => {
    let result = '';
    const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    const bytes = crypto.randomBytes(size);
    for (let i = 0; i < size; i++) result += chars[bytes[i] % 36];
    return result;
  },
  decimal: (size = 16) => {
    let result = '';
    const bytes = crypto.randomBytes(size);
    for (let i = 0; i < size; i++) result += bytes[i] % 10;
    return result;
  },
  binary: (size = 8) => {
    let result = '';
    const bytes = crypto.randomBytes(Math.ceil(size / 8));
    for (const byte of bytes) result += byte.toString(2).padStart(8, '0');
    return result.slice(0, size);
  },
};

function multiFormatId(format = 'hex', opts = {}) {
  const { size } = opts;
  const fn = FORMATS[format];
  if (!fn) throw new Error(`Unknown format: ${format}. Available: ${listFormats().join(', ')}`);
  return fn(size);
}

function listFormats() {
  return Object.keys(FORMATS);
}

module.exports = {
  timestampId,
  extractTime,
  timeWindowId,
  epochDayId,
  contextId,
  meaningfulId,
  pronounceableId,
  multiFormatId,
  listFormats,
};
