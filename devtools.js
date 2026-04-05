/* eslint-env es2020 */
'use strict';

/**
 * devtools.js — Debug/Trace + Logging + Error Handling + Test Utilities
 *               + Export/Import + Validation Rules Engine
 * ──────────────────────────────────────────────────────────────────────
 * Features 17, 18, 29, 16, 26
 */

const crypto = require('crypto');
const { getConfig } = require('./plugin');

// ── Standardized Error Types ──────────────────────────────────────────────────

class UniqidError extends Error {
  constructor(message, code, meta = {}) {
    super(message);
    this.name    = 'UniqidError';
    this.code    = code;
    this.meta    = meta;
    this.ts      = new Date().toISOString();
  }
}

const ErrorCodes = {
  COLLISION:       'COLLISION',
  RATE_LIMITED:    'RATE_LIMITED',
  INVALID_ID:      'INVALID_ID',
  EXPIRED:         'EXPIRED',
  PERMISSION:      'PERMISSION_DENIED',
  VALIDATION:      'VALIDATION_FAILED',
  NOT_FOUND:       'NOT_FOUND',
  EXHAUSTED:       'EXHAUSTED',
  SCHEMA_MISMATCH: 'SCHEMA_MISMATCH',
};

function createError(code, message, meta = {}) {
  return new UniqidError(message, code, meta);
}

// ── Logging System ────────────────────────────────────────────────────────────

const LEVELS = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };

class Logger {
  constructor(opts = {}) {
    this._level    = LEVELS[opts.level ?? 'warn'] ?? 2;
    this._prefix   = opts.prefix ?? '[uuid-lab]';
    this._handlers = [];
    this._history  = [];
    this._maxHistory = opts.maxHistory ?? 500;
  }

  _log(level, ...args) {
    if (LEVELS[level] > this._level) return;
    const entry = { level, ts: new Date().toISOString(), message: args.join(' ') };
    this._history.push(entry);
    if (this._history.length > this._maxHistory) this._history.shift();
    for (const h of this._handlers) h(entry);
    if (level !== 'debug' || this._level >= 4) {
      const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
      fn(`${this._prefix} [${level.toUpperCase()}]`, ...args);
    }
  }

  error(...a)  { this._log('error', ...a); }
  warn(...a)   { this._log('warn', ...a); }
  info(...a)   { this._log('info', ...a); }
  debug(...a)  { this._log('debug', ...a); }

  setLevel(level) { this._level = LEVELS[level] ?? 2; }
  addHandler(fn)  { this._handlers.push(fn); return () => { this._handlers = this._handlers.filter(h => h !== fn); }; }
  history(n = 50) { return this._history.slice(-n); }
  clear()         { this._history = []; }
}

const logger = new Logger();

// ── Debug / Trace Mode ────────────────────────────────────────────────────────

let _traceEnabled = false;
const _traces     = [];

function enableTrace()  { _traceEnabled = true;  logger.info('Trace mode enabled'); }
function disableTrace() { _traceEnabled = false; }

function trace(label, fn) {
  if (!_traceEnabled) return fn();
  const start = performance?.now?.() ?? Date.now();
  let result;
  try {
    result = fn();
  } catch(e) {
    _traces.push({ label, error: e.message, durationMs: (performance?.now?.() ?? Date.now()) - start, ts: Date.now() });
    throw e;
  }
  const durationMs = (performance?.now?.() ?? Date.now()) - start;
  const entry = { label, durationMs: Math.round(durationMs * 1000) / 1000, ts: Date.now() };
  _traces.push(entry);
  if (_traces.length > 1000) _traces.shift();
  logger.debug(`trace [${label}] ${entry.durationMs}ms`);
  return result;
}

function getTraces(n = 50) { return _traces.slice(-n); }
function clearTraces()     { _traces.length = 0; }

// ── Validation Rules Engine ───────────────────────────────────────────────────

class ValidationEngine {
  constructor() {
    this._rules = new Map();  // ruleName → { fn, description, severity }
  }

  /**
   * Register a validation rule.
   * @param {string} name
   * @param {Function} fn  - (id) => true | string (string = error message)
   * @param {{ description?, severity? }} meta
   */
  addRule(name, fn, meta = {}) {
    this._rules.set(name, { fn, description: meta.description ?? name, severity: meta.severity ?? 'error' });
    return this;
  }

  removeRule(name) { this._rules.delete(name); return this; }

  /**
   * Validate an ID against all rules (or a subset).
   * @param {string} id
   * @param {string[]} [ruleNames]  - subset to run; all if omitted
   */
  validate(id, ruleNames) {
    const toRun = ruleNames
      ? ruleNames.map(n => [n, this._rules.get(n)]).filter(([, r]) => r)
      : [...this._rules.entries()];

    const violations = [];
    const passed     = [];

    for (const [name, rule] of toRun) {
      let result;
      try { result = rule.fn(id); } catch(e) { result = e.message; }
      if (result === true || result === undefined) {
        passed.push(name);
      } else {
        violations.push({ rule: name, message: typeof result === 'string' ? result : `Rule "${name}" failed`, severity: rule.severity });
      }
    }

    return {
      valid: violations.filter(v => v.severity === 'error').length === 0,
      passed,
      violations,
      id,
    };
  }

  /**
   * Validate a batch of IDs.
   */
  validateBatch(ids, ruleNames) {
    const results = ids.map(id => this.validate(id, ruleNames));
    return {
      total:  results.length,
      valid:  results.filter(r => r.valid).length,
      invalid: results.filter(r => !r.valid).length,
      results,
    };
  }

  listRules() {
    return [...this._rules.entries()].map(([name, r]) => ({ name, description: r.description, severity: r.severity }));
  }
}

// Built-in common rules factory
function createCommonRules() {
  const engine = new ValidationEngine();
  engine.addRule('non-empty',      id => id.length > 0 || 'ID must not be empty');
  engine.addRule('no-spaces',      id => !/\s/.test(id) || 'ID must not contain spaces');
  engine.addRule('max-length-256', id => id.length <= 256 || 'ID exceeds 256 characters');
  engine.addRule('no-control-chars', id => !/[\x00-\x1f]/.test(id) || 'ID contains control characters');
  return engine;
}

function createValidationEngine() { return new ValidationEngine(); }

// ── Export / Import ───────────────────────────────────────────────────────────

/**
 * Export a collection of IDs + metadata to a portable format.
 * @param {string[]} ids
 * @param {{ meta?, format? }} opts
 */
function exportIds(ids, opts = {}) {
  const { meta = {}, format = 'json' } = opts;
  const payload = {
    version:    '1.0',
    exportedAt: new Date().toISOString(),
    count:      ids.length,
    meta,
    ids,
  };
  if (format === 'json') return JSON.stringify(payload, null, 2);
  if (format === 'csv')  return ['id', ...Object.keys(meta)].join(',') + '\n' + ids.map(id => [id, ...Object.values(meta)].join(',')).join('\n');
  if (format === 'object') return payload;
  return JSON.stringify(payload);
}

/**
 * Import IDs from a previously exported payload.
 * @param {string|object} data
 */
function importIds(data) {
  const parsed = typeof data === 'string' ? JSON.parse(data) : data;
  return {
    ids:        parsed.ids ?? [],
    meta:       parsed.meta ?? {},
    exportedAt: parsed.exportedAt,
    count:      parsed.count ?? parsed.ids?.length ?? 0,
    version:    parsed.version,
  };
}

// ── Test Utilities / Mocking ──────────────────────────────────────────────────

let _mockMode  = false;
const _mockFns = new Map();

/**
 * Enable mock mode — generator functions return predictable values.
 */
function enableMockMode() { _mockMode = true; }
function disableMockMode() { _mockMode = false; _mockFns.clear(); }

/**
 * Register a mock for a specific generator.
 * @param {string} generatorName
 * @param {string|Function} mockValue
 */
function mockGenerator(generatorName, mockValue) {
  _mockFns.set(generatorName, typeof mockValue === 'function' ? mockValue : () => mockValue);
}

/**
 * Wrap a generator with mock support.
 */
function withMock(name, generatorFn) {
  return function(...args) {
    if (_mockMode && _mockFns.has(name)) return _mockFns.get(name)(...args);
    return generatorFn(...args);
  };
}

/**
 * Create a deterministic test ID sequence for reproducible tests.
 * @param {string} prefix
 * @param {number} count
 */
function testIds(prefix = 'test', count = 10) {
  return Array.from({ length: count }, (_, i) => `${prefix}_${String(i + 1).padStart(4, '0')}`);
}

/**
 * Assert that an ID matches expected shape.
 */
function assertId(id, expectations = {}) {
  const failures = [];
  if (expectations.type && typeof id !== expectations.type) failures.push(`expected type ${expectations.type}`);
  if (expectations.length && id.length !== expectations.length) failures.push(`expected length ${expectations.length}, got ${id.length}`);
  if (expectations.minLength && id.length < expectations.minLength) failures.push(`expected min length ${expectations.minLength}`);
  if (expectations.pattern && !expectations.pattern.test(id)) failures.push(`expected pattern ${expectations.pattern}`);
  if (expectations.prefix && !id.startsWith(expectations.prefix)) failures.push(`expected prefix "${expectations.prefix}"`);
  return { pass: failures.length === 0, failures };
}

module.exports = {
  UniqidError, ErrorCodes, createError,
  Logger, logger,
  enableTrace, disableTrace, trace, getTraces, clearTraces,
  ValidationEngine, createValidationEngine, createCommonRules,
  exportIds, importIds,
  enableMockMode, disableMockMode, mockGenerator, withMock, testIds, assertId,
};
