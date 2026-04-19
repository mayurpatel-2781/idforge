/* eslint-env es2020 */
'use strict';

/**
 * analytics.js — Debug, Inspection & Analytics
 * enableDebug, debugWrap, inspectId, apiGenerate, analytics object.
 */

// ── State ─────────────────────────────────────────────────────────────────────

let _debugMode = false;
let _debugLog  = [];
const _counters = new Map();
const _timings  = new Map();

// ── Analytics Object ──────────────────────────────────────────────────────────

const analytics = {
  track(event, data = {}) {
    const key = `event:${event}`;
    _counters.set(key, (_counters.get(key) || 0) + 1);
    const entry = { event, data, ts: Date.now() };
    if (_debugMode) _debugLog.push({ type: 'analytics', ...entry });
    return entry;
  },
  count(name) {
    return _counters.get(`event:${name}`) || 0;
  },
  snapshot() {
    return {
      ts: new Date().toISOString(),
      debugMode: _debugMode,
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

function enableDebug()  { _debugMode = true; }
function disableDebug() { _debugMode = false; }
function isDebugMode()  { return _debugMode; }

function debugWrap(label, fn) {
  if (typeof fn !== 'function') throw new TypeError('debugWrap: fn must be a function');
  return function debugWrapped(...args) {
    const start = Date.now();
    let error;
    try {
      return fn(...args);
    } catch (e) {
      error = e;
      throw e;
    } finally {
      const durationMs = Date.now() - start;
      _debugLog.push({
        label,
        durationMs,
        args: args.length,
        ts: new Date().toISOString(),
        error: error ? error.message : null,
      });
      if (!_timings.has(label)) _timings.set(label, []);
      _timings.get(label).push(durationMs);
    }
  };
}

function getDebugLog(opts = {}) {
  const { limit, label } = opts;
  let log = [..._debugLog];
  if (label) log = log.filter(e => e.label === label);
  if (limit) log = log.slice(-limit);
  return log;
}

function clearDebugLog() { _debugLog = []; }

// ── Inspect ID ────────────────────────────────────────────────────────────────

const UUID_RE    = /^[0-9a-f]{8}-[0-9a-f]{4}-([0-9a-f])[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ULID_RE    = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
const SNOWFLK_RE = /^\d{15,20}$/;
const NANOID_RE  = /^[A-Za-z0-9_-]{7,64}$/;
const PREFIXED_RE= /^([a-z]{2,8})[_-][A-Za-z0-9_-]{4,}$/;

function inspectId(id) {
  if (typeof id !== 'string') return { type: 'unknown', error: 'not a string' };

  const info = {
    raw: id,
    length: id.length,
    type: 'unknown',
    entropy: null,
    hasPrefix: false,
    prefix: null,
    separators: [],
    charset: 'unknown',
  };

  if (id.includes('-')) info.separators.push('-');
  if (id.includes('_')) info.separators.push('_');
  if (id.includes('.')) info.separators.push('.');

  const prefixMatch = id.match(PREFIXED_RE);

  if (UUID_RE.test(id)) {
    const v = parseInt(id[14], 16);
    info.type = `uuid-v${v}`;
    info.charset = 'hex';
    info.entropy = 122; // v4 has 122 bits of randomness
  } else if (ULID_RE.test(id)) {
    info.type = 'ulid';
    info.charset = 'crockford-base32';
    info.entropy = Math.floor(16 * 5); // 16 random chars × 5 bits
  } else if (SNOWFLK_RE.test(id)) {
    info.type = 'snowflake';
    info.charset = 'numeric';
    info.entropy = 22; // 22 random bits
  } else if (id.startsWith('exp_')) {
    info.type = 'expiring';
  } else if (id.startsWith('drv_')) {
    info.type = 'derived';
  } else if (id.startsWith('lc_')) {
    info.type = 'lifecycle';
  } else if (id.startsWith('topo_')) {
    info.type = 'topology';
  } else if (NANOID_RE.test(id) && !UUID_RE.test(id)) {
    info.type = prefixMatch ? 'prefixed' : 'nanoid';
    info.charset = 'base64url';
    info.entropy = Math.floor(id.replace(/[_-]/g, '').length * 6);
  }

  if (prefixMatch) {
    info.hasPrefix = true;
    info.prefix = prefixMatch[1];
  }

  return info;
}

// ── API Generate ──────────────────────────────────────────────────────────────

function apiGenerate(opts = {}) {
  const { type = 'nanoId', count = 1, ...rest } = opts;
  const crypto = require('crypto');

  const generators = {
    nanoId:      () => require('./generators').nanoId(rest),
    uuid:        () => crypto.randomUUID(),
    timestampId: () => require('./timeid').timestampId(rest),
    meaningfulId:() => require('./timeid').meaningfulId(rest),
    prefixedId:  () => require('./format').prefixedId(rest.prefix || 'id', rest),
    base62:      () => require('./format').base62Id(rest),
    base36:      () => require('./format').base36Id(rest),
    shortId:     () => require('./format').shortId(rest),
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
