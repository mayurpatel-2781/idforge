/* eslint-env es2020 */
'use strict';

/**
 * async_gen.js — Async / Streaming Generation + Caching + Access Control
 * ────────────────────────────────────────────────────────────────────────
 * Features 12, 21, 14
 */

const crypto = require('crypto');
const { nanoId } = require('./generators');
const { emit } = require('./plugin');

// ── Async / Streaming ID Generation ──────────────────────────────────────────

/**
 * Generate IDs as an async iterator (stream).
 * Useful for generating large batches without blocking the event loop.
 *
 * @param {Function} generatorFn
 * @param {{ count?, chunkSize?, delayMs? }} opts
 * @yields {string} ID
 *
 * @example
 *   for await (const id of streamIds(nanoId, { count: 1000, chunkSize: 50 })) {
 *     db.insert(id);
 *   }
 */
async function* streamIds(generatorFn, opts = {}) {
  const { count = Infinity, chunkSize = 100, delayMs = 0, ...genOpts } = opts;
  let generated = 0;

  while (generated < count) {
    const batch = Math.min(chunkSize, count - generated);
    for (let i = 0; i < batch; i++) {
      yield generatorFn(genOpts);
      generated++;
    }
    if (delayMs > 0 && generated < count) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

/**
 * Collect N IDs from a stream into an array.
 * @param {AsyncIterable} stream
 * @param {number} n
 */
async function collectFromStream(stream, n) {
  const results = [];
  for await (const id of stream) {
    results.push(id);
    if (results.length >= n) break;
  }
  return results;
}

/**
 * Generate a large batch asynchronously, yielding progress callbacks.
 * @param {Function} generatorFn
 * @param {number} total
 * @param {{ onProgress?, chunkSize? }} opts
 */
async function generateAsync(generatorFn, total, opts = {}) {
  const { onProgress, chunkSize = 500 } = opts;
  const results = [];
  let done = 0;

  while (done < total) {
    const batch = Math.min(chunkSize, total - done);
    for (let i = 0; i < batch; i++) results.push(generatorFn());
    done += batch;
    if (onProgress) onProgress({ done, total, pct: Math.round(done / total * 100) });
    if (done < total) await new Promise(r => setImmediate ? setImmediate(r) : setTimeout(r, 0));
  }
  return results;
}

// ── Caching Layer ─────────────────────────────────────────────────────────────

class IdCache {
  /**
   * @param {{ maxSize?, ttlMs? }} opts
   */
  constructor(opts = {}) {
    const { maxSize = 1000, ttlMs = 0 } = opts;
    this._maxSize = maxSize;
    this._ttlMs   = ttlMs;       // 0 = no expiry
    this._cache   = new Map();   // key → { value, expiresAt }
    this._hits    = 0;
    this._misses  = 0;
  }

  set(key, value) {
    if (this._cache.size >= this._maxSize) {
      // Evict oldest (first inserted)
      const firstKey = this._cache.keys().next().value;
      this._cache.delete(firstKey);
    }
    this._cache.set(key, {
      value,
      expiresAt: this._ttlMs > 0 ? Date.now() + this._ttlMs : Infinity,
    });
  }

  get(key) {
    const entry = this._cache.get(key);
    if (!entry) { this._misses++; return null; }
    if (Date.now() > entry.expiresAt) { this._cache.delete(key); this._misses++; return null; }
    this._hits++;
    return entry.value;
  }

  has(key) { return this.get(key) !== null; }
  delete(key) { this._cache.delete(key); }
  clear() { this._cache.clear(); }

  stats() {
    const total = this._hits + this._misses;
    return {
      size: this._cache.size,
      maxSize: this._maxSize,
      hits: this._hits,
      misses: this._misses,
      hitRate: total > 0 ? `${((this._hits / total) * 100).toFixed(1)}%` : '0%',
    };
  }
}

/**
 * Wrap a deterministic generator with a cache (e.g. for dcid).
 * Same inputs → returns cached output without recomputing.
 */
function withCache(generatorFn, opts = {}) {
  const cache = new IdCache(opts);
  return function cachedGenerator(...args) {
    const key = JSON.stringify(args);
    const cached = cache.get(key);
    if (cached !== null) return cached;
    const result = generatorFn(...args);
    cache.set(key, result);
    return result;
  };
}

function createCache(opts = {}) { return new IdCache(opts); }

// ── Access Control ────────────────────────────────────────────────────────────

class AccessControl {
  constructor() {
    this._policies = [];  // { name, match, permissions }
    this._roles    = new Map();  // roleName → Set<permission>
  }

  /**
   * Define a role with a set of permissions.
   * @param {string} role
   * @param {string[]} permissions
   */
  defineRole(role, permissions) {
    this._roles.set(role, new Set(permissions));
    return this;
  }

  /**
   * Add a policy — maps an ID pattern to required permissions.
   * @param {{ name, match: RegExp|Function, require: string[] }} policy
   */
  addPolicy(policy) {
    this._policies.push(policy);
    return this;
  }

  /**
   * Check if a role has permission to perform an action on an ID.
   * @param {string} role
   * @param {string} action   - e.g. 'read', 'write', 'delete'
   * @param {string} id
   * @returns {{ allowed: boolean, reason?: string }}
   */
  check(role, action, id) {
    const rolePerms = this._roles.get(role);
    if (!rolePerms) return { allowed: false, reason: `Unknown role: "${role}"` };

    for (const policy of this._policies) {
      const matches = typeof policy.match === 'function' ? policy.match(id) : policy.match.test(id);
      if (matches) {
        const required = policy.require ?? [];
        const missing  = required.filter(p => !rolePerms.has(p) && !rolePerms.has(`${action}:*`) && !rolePerms.has('*'));
        if (missing.length > 0) {
          return { allowed: false, reason: `Missing permissions: ${missing.join(', ')}`, policy: policy.name };
        }
      }
    }

    // Default: check if role has the action permission
    const allowed = rolePerms.has(action) || rolePerms.has('*');
    return { allowed, reason: allowed ? undefined : `Role "${role}" lacks permission "${action}"` };
  }

  /**
   * List all roles and their permissions.
   */
  listRoles() {
    return Object.fromEntries([...this._roles.entries()].map(([r, p]) => [r, [...p]]));
  }
}

function createAccessControl() { return new AccessControl(); }

module.exports = {
  streamIds, collectFromStream, generateAsync,
  IdCache, createCache, withCache,
  AccessControl, createAccessControl,
};
