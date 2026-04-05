/* eslint-env es2020 */
'use strict';

/**
 * plugin.js — Plugin / Middleware System + Events + Global Config
 * ───────────────────────────────────────────────────────────────
 * Features 10, 22 (events), 20 (global config)
 */

const crypto = require('crypto');

// ── Global Config ─────────────────────────────────────────────────────────────

let _config = {
  defaultSecret:    'uuid-lab-default',
  defaultSize:      21,
  defaultAlphabet:  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_',
  defaultNamespace: 'default',
  logLevel:         'warn',         // 'silent'|'warn'|'info'|'debug'
  traceMode:        false,
  cacheEnabled:     false,
  cacheMaxSize:     1000,
  retryAttempts:    3,
  webhookUrl:       null,
  plugins:          [],
};

/**
 * Set global configuration.
 * @param {Partial<typeof _config>} opts
 */
function configure(opts = {}) {
  _config = { ..._config, ...opts };
  _emit('config:changed', { config: _config });
}

/**
 * Get current global config (or a specific key).
 * @param {string} [key]
 */
function getConfig(key) {
  return key ? _config[key] : { ..._config };
}

// ── Event System ──────────────────────────────────────────────────────────────

const _listeners = new Map();  // event → [ handler ]
const _webhooks  = [];

/**
 * Subscribe to an event.
 * @param {string} event
 * @param {Function} handler
 * @returns {Function} unsubscribe
 */
function on(event, handler) {
  if (!_listeners.has(event)) _listeners.set(event, []);
  _listeners.get(event).push(handler);
  return () => off(event, handler);
}

/**
 * Unsubscribe from an event.
 */
function off(event, handler) {
  const handlers = _listeners.get(event) ?? [];
  _listeners.set(event, handlers.filter(h => h !== handler));
}

/**
 * Subscribe to an event — fires once then auto-removes.
 */
function once(event, handler) {
  const wrapper = (data) => { handler(data); off(event, wrapper); };
  return on(event, wrapper);
}

/**
 * Emit an event to all listeners and registered webhooks.
 * @param {string} event
 * @param {object} data
 */
function _emit(event, data) {
  const payload = { event, data, timestamp: Date.now() };
  const handlers = _listeners.get(event) ?? [];
  const wildcards = _listeners.get('*') ?? [];
  for (const h of [...handlers, ...wildcards]) {
    try { h(payload); } catch {}
  }
  // Fire webhooks (async, non-blocking)
  for (const wh of _webhooks) {
    if (!wh.events || wh.events.includes(event) || wh.events.includes('*')) {
      _fireWebhook(wh, payload).catch(() => {});
    }
  }
}

function emit(event, data) { _emit(event, data); }

/**
 * Register a webhook URL to receive events.
 * @param {{ url, events?, secret? }} opts
 */
function registerWebhook(opts) {
  _webhooks.push(opts);
}

async function _fireWebhook(wh, payload) {
  if (!wh.url) return;
  const body = JSON.stringify(payload);
  const headers = { 'Content-Type': 'application/json' };
  if (wh.secret) {
    headers['X-Uniqid-Signature'] = crypto
      .createHmac('sha256', wh.secret).update(body).digest('hex');
  }
  // In real environments: await fetch(wh.url, { method: 'POST', headers, body })
  // For simulation, we just emit locally
  _emit('webhook:fired', { url: wh.url, event: payload.event });
}

// ── Middleware System ─────────────────────────────────────────────────────────

const _middlewares = [];

/**
 * Register a middleware function.
 * Middlewares run in order before and after ID generation.
 * @param {{ name, before?: (ctx)=>ctx, after?: (ctx)=>ctx }} middleware
 */
function use(middleware) {
  _middlewares.push(middleware);
  _config.plugins.push(middleware.name);
  _emit('plugin:registered', { name: middleware.name });
}

/**
 * Wrap a generator function with all registered middlewares.
 * @param {string} generatorName
 * @param {Function} generatorFn
 * @returns {Function}
 */
function applyMiddleware(generatorName, generatorFn) {
  return function(...args) {
    let ctx = { generatorName, args, id: null, meta: {}, timestamp: Date.now() };

    // Run before hooks
    for (const mw of _middlewares) {
      if (mw.before) ctx = mw.before(ctx) ?? ctx;
    }

    ctx.id = generatorFn(...ctx.args);

    // Run after hooks
    for (const mw of _middlewares) {
      if (mw.after) ctx = mw.after(ctx) ?? ctx;
    }

    _emit('id:generated', { generator: generatorName, id: ctx.id });
    return ctx.id;
  };
}

/**
 * List all registered plugins/middlewares.
 */
function listPlugins() {
  return _middlewares.map(m => ({ name: m.name, hooks: [m.before ? 'before' : null, m.after ? 'after' : null].filter(Boolean) }));
}

module.exports = {
  configure, getConfig,
  on, off, once, emit,
  registerWebhook,
  use, applyMiddleware, listPlugins,
};
