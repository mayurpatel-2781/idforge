/* eslint-env es2020 */
'use strict';

/**
 * timeid.js — Time-based ID Strategies
 * timestampId, extractTime, timeWindowId, epochDayId,
 * contextId, meaningfulId, pronounceableId, multiFormatId, listFormats.
 */

const crypto = require('crypto');
const { nanoId, ALPHA_BASE62 } = require('./generators');

// ── Timestamp ID ──────────────────────────────────────────────────────────────

function timestampId(opts = {}) {
  const { encoding = 'base36', randomSize = 8 } = opts;
  const ts = encoding === 'base36'
    ? Date.now().toString(36)
    : Date.now().toString();
  const rand = nanoId({ size: randomSize });
  return `${ts}_${rand}`;
}

/**
 * Extract the embedded timestamp from various ID formats.
 * Returns a Date or null.
 */
function extractTime(id) {
  if (typeof id !== 'string' || !id) return null;

  // exp_ format: exp_<epochMs>_<rand>
  if (id.startsWith('exp_')) {
    const ts = parseInt(id.split('_')[1]);
    if (!isNaN(ts) && ts > 1e12) return new Date(ts);
  }

  // timestampId format: <base36ts>_<rand>
  if (id.includes('_')) {
    const part = id.split('_')[0];
    const ts   = parseInt(part, 36);
    if (!isNaN(ts) && ts > 1_000_000_000_000 && ts < 9_999_999_999_999) {
      return new Date(ts);
    }
  }

  // Snowflake: large decimal integer
  if (/^\d{15,20}$/.test(id)) {
    try {
      const ts = Number(BigInt(id) >> 22n);
      if (ts > 1_000_000_000_000 && ts < 9_999_999_999_999) return new Date(ts);
    } catch { /* not a valid bigint */ }
  }

  // ULID: first 10 chars of Crockford base32 = timestamp
  const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  if (/^[0-9A-HJKMNP-TV-Z]{26}$/i.test(id)) {
    const upper = id.toUpperCase();
    let ts = 0;
    let valid = true;
    for (let i = 0; i < 10; i++) {
      const idx = CROCKFORD.indexOf(upper[i]);
      if (idx === -1) { valid = false; break; }
      ts = ts * 32 + idx;
    }
    if (valid && ts > 1_000_000_000_000) return new Date(ts);
  }

  return null;
}

// ── Time Window ID ────────────────────────────────────────────────────────────

const _windowCache = new Map();

function timeWindowId(opts = {}) {
  const { windowMs = 60_000, prefix = 'tw' } = opts;
  const window  = Math.floor(Date.now() / windowMs);
  const cacheKey = `${prefix}:${windowMs}`;
  const cached  = _windowCache.get(cacheKey);

  if (cached && cached.window === window) return cached.id;

  const id = `${prefix}_${window.toString(36)}`;
  _windowCache.set(cacheKey, { window, id });
  return id;
}

// ── Epoch Day ID ──────────────────────────────────────────────────────────────

const _dayCache = { day: null, ids: new Map() };

function epochDayId(opts = {}) {
  const { prefix = 'day' } = opts;
  const MS_PER_DAY = 86_400_000;
  const day        = Math.floor(Date.now() / MS_PER_DAY);

  if (_dayCache.day === day && _dayCache.ids.has(prefix)) {
    return _dayCache.ids.get(prefix);
  }

  if (_dayCache.day !== day) {
    _dayCache.day = day;
    _dayCache.ids.clear();
  }

  const id = `${prefix}_${day.toString(36)}`;
  _dayCache.ids.set(prefix, id);
  return id;
}

// ── Context ID ────────────────────────────────────────────────────────────────

function contextId(context = {}, opts = {}) {
  const { randomSize = 8 } = opts;
  const parts = Object.entries(context)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${String(v).slice(0, 12)}`)
    .join('|');
  const hash = crypto.createHash('md5').update(parts).digest('hex').slice(0, 8);
  const rand = nanoId({ size: randomSize });
  return `ctx_${hash}_${rand}`;
}

// ── Meaningful / Human ID ─────────────────────────────────────────────────────

const ADJECTIVES = [
  'swift','calm','brave','bright','quick','dark','eager','fair',
  'grand','happy','kind','lively','noble','proud','rare','true',
  'vivid','warm','young','zesty','bold','cool','deep','pure','soft',
];
const NOUNS = [
  'order','invoice','user','session','product','event','record',
  'entry','token','batch','request','report','ticket','task','note',
  'asset','claim','draft','grant','issue',
];

function meaningfulId(opts = {}) {
  const { noun, adjective, separator = '-', withTimestamp = false } = opts;
  const adj  = adjective || ADJECTIVES[crypto.randomInt(ADJECTIVES.length)];
  const nn   = noun      || NOUNS[crypto.randomInt(NOUNS.length)];
  const rand = String(crypto.randomInt(1000, 9999));
  const base = `${adj}${separator}${nn}${separator}${rand}`;
  return withTimestamp ? `${base}${separator}${Date.now().toString(36)}` : base;
}

// ── Pronounceable ID ──────────────────────────────────────────────────────────

const CONSONANTS = 'bcdfghjklmnpqrstvwxyz';
const VOWELS     = 'aeiou';

function pronounceableId(opts = {}) {
  const { syllables = 4, separator = '-', capitalize = false } = opts;
  const bytes = crypto.randomBytes(syllables * 2);
  let result  = '';

  for (let i = 0; i < syllables; i++) {
    const c = CONSONANTS[bytes[i * 2]     % CONSONANTS.length];
    const v = VOWELS    [bytes[i * 2 + 1] % VOWELS.length];
    result  += c + v;
  }

  if (capitalize) result = result.charAt(0).toUpperCase() + result.slice(1);

  if (separator && result.length > 4) {
    const mid = Math.floor(result.length / 2);
    return result.slice(0, mid) + separator + result.slice(mid);
  }
  return result;
}

// ── Multi-Format ID ───────────────────────────────────────────────────────────

const FORMATS = {
  hex(size = 16) {
    return crypto.randomBytes(Math.ceil(size / 2)).toString('hex').slice(0, size);
  },
  base64(size = 16) {
    return crypto.randomBytes(Math.ceil(size * 3 / 4)).toString('base64url').slice(0, size);
  },
  base36(size = 16) {
    const alpha = '0123456789abcdefghijklmnopqrstuvwxyz';
    const bytes = crypto.randomBytes(size);
    return Array.from({ length: size }, (_, i) => alpha[bytes[i] % 36]).join('');
  },
  base62(size = 16) {
    return nanoId({ size, alphabet: ALPHA_BASE62 });
  },
  decimal(size = 16) {
    const bytes = crypto.randomBytes(size);
    return Array.from({ length: size }, (_, i) => bytes[i] % 10).join('');
  },
  binary(size = 8) {
    const bytes = crypto.randomBytes(Math.ceil(size / 8));
    return bytes.reduce((acc, b) => acc + b.toString(2).padStart(8, '0'), '').slice(0, size);
  },
  uuid() {
    return require('crypto').randomUUID();
  },
};

function multiFormatId(format = 'hex', opts = {}) {
  const { size } = opts;
  const fn = FORMATS[format];
  if (!fn) throw new Error(`Unknown format: "${format}". Available: ${listFormats().join(', ')}`);
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
