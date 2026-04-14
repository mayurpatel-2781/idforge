/* eslint-env es2020 */
'use strict';

// ── Debug State ───────────────────────────────────────────────────────────────

let _debugMode  = false;
let _debugLog   = [];
const _counters = new Map();
const _timings  = new Map();

// ── Analytics Object ──────────────────────────────────────────────────────────

const analytics = {
  track(event, data = {}) {
    const entry = { event, data, ts: Date.now() };
    if (_debugMode) _debugLog.push({ type: 'analytics', ...entry });
    const key = `event:${event}`;
    _counters.set(key, (_counters.get(key) || 0) + 1);
    return entry;
  },

  count(name) {
    return _counters.get(`event:${name}`) || 0;
  },

  snapshot() {
    return {
      ts: new Date().toISOString(),
      debug: _debugMode,
      logSize: _debugLog.length,
      counters: Object.fromEntries(_counters),
    };
  },

  reset() {
    _counters.clear();
    _timings.clear();
    _debugLog = [];
  },
};

// ── Debug Mode ────────────────────────────────────────────────────────────────

function enableDebug() {
  _debugMode = true;
}

function disableDebug() {
  _debugMode = false;
}

function isDebugMode() {
  return _debugMode;
}

function debugWrap(label, fn) {
  return function (...args) {
    const start = Date.now();
    let result, error;
    try {
      result = fn(...args);
      return result;
    } catch (e) {
      error = e;
      throw e;
    } finally {
      const durationMs = Date.now() - start;
      const entry = {
        label,
        args: args.length,
        durationMs,
        ts: new Date().toISOString(),
        error: error ? error.message : null,
      };
      _debugLog.push(entry);

      // Track timing stats
      if (!_timings.has(label)) _timings.set(label, []);
      _timings.get(label).push(durationMs);
    }
  };
}

function getDebugLog(opts = {}) {
  const { limit, label } = opts;
  let log = _debugLog;
  if (label) log = log.filter(e => e.label === label);
  if (limit) log = log.slice(-limit);
  return log;
}

function clearDebugLog() {
  _debugLog = [];
}

// ── Inspect ID ────────────────────────────────────────────────────────────────

function inspectId(id) {
  if (typeof id !== 'string') return { error: 'not a string', type: 'unknown' };

  const info = {
    raw: id,
    length: id.length,
    type: 'unknown',
    entropy: null,
    hasPrefix: false,
    prefix: null,
    separators: [],
    charset: null,
  };

  // Detect separators
  if (id.includes('-')) info.separators.push('-');
  if (id.includes('_')) info.separators.push('_');
  if (id.includes('.')) info.separators.push('.');

  // Detect prefix
  const prefixMatch = id.match(/^([a-z]{2,6})[_-]/);
  if (prefixMatch) {
    info.hasPrefix = true;
    info.prefix = prefixMatch[1];
  }

  // Detect type
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    info.type = 'uuid-v4';
    info.charset = 'hex';
  } else if (/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    info.type = 'uuid-v7';
    info.charset = 'hex';
  } else if (/^[0-9A-HJKMNP-TV-Z]{26}$/.test(id)) {
    info.type = 'ulid';
    info.charset = 'crockford-base32';
  } else if (/^\d{15,20}$/.test(id)) {
    info.type = 'snowflake';
    info.charset = 'numeric';
  } else if (id.startsWith('exp_')) {
    info.type = 'expiring';
  } else if (id.startsWith('drv_')) {
    info.type = 'derived';
  } else if (/^[A-Za-z0-9_-]{21}$/.test(id)) {
    info.type = 'nanoid';
    info.charset = 'base64url';
  } else if (info.hasPrefix) {
    info.type = 'prefixed';
  }

  // Entropy estimate (bits)
  const charsetSizes = { hex: 4, 'base64url': 6, 'crockford-base32': 5, numeric: 3.32 };
  const bitsPerChar = charsetSizes[info.charset] || 6;
  info.entropy = Math.floor(id.replace(/[-_.]/g, '').length * bitsPerChar);

  return info;
}

// ── API Generate ──────────────────────────────────────────────────────────────

function apiGenerate(opts = {}) {
  const { type = 'nanoId', count = 1, ...rest } = opts;

  // Lazy require to avoid circular deps
  const generators = {
    nanoId:      () => require('./generators').nanoId(rest),
    uuid:        () => require('crypto').randomUUID?.() || require('./generators').nanoId({ size: 36 }),
    ulid:        () => require('./index').ulid?.() || require('./generators').nanoId({ size: 26 }),
    snowflake:   () => require('./index').snowflakeId?.() || Date.now().toString(),
    prefixed:    () => require('./format').prefixedId(rest.prefix || 'id', rest),
    timestampId: () => require('./timeid').timestampId(rest),
    meaningfulId:() => require('./timeid').meaningfulId(rest),
  };

  const gen = generators[type] || generators.nanoId;

  if (count === 1) {
    const result = gen();
    return { result, type, count: 1, ts: new Date().toISOString() };
  }

  const ids = Array.from({ length: count }, gen);
  return { ids, type, count, ts: new Date().toISOString() };
}

module.exports = {
  analytics,
  enableDebug,
  disableDebug,
  isDebugMode,
  debugWrap,
  getDebugLog,
  clearDebugLog,
  inspectId,
  apiGenerate,
};
