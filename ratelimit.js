/* eslint-env es2020 */
'use strict';

// ── ID Rate Limiter ───────────────────────────────────────────────────────────
// Token-bucket algorithm. Per-key limiting (per user, tenant, IP, etc.)
// Prevents entropy exhaustion and DB flooding in high-volume scenarios.

/**
 * Token bucket rate limiter for ID generation.
 *
 * @param {{
 *   rate: number,          // tokens added per second
 *   burst: number,         // max tokens (burst capacity)
 *   keyTTL?: number,       // ms before idle keys are pruned (default: 60000)
 * }} opts
 */
class IdRateLimiter {
  constructor(opts = {}) {
    const { rate = 100, burst = 200, keyTTL = 60_000 } = opts;
    if (rate <= 0) throw new Error('rate must be > 0');
    if (burst < rate) throw new Error('burst must be >= rate');

    this._rate   = rate;      // tokens/sec
    this._burst  = burst;     // bucket max
    this._keyTTL = keyTTL;
    this._buckets = new Map(); // key → { tokens, lastRefill, hits, blocked }

    // Prune idle keys periodically
    this._pruneInterval = setInterval(() => this._prune(), keyTTL);
    if (this._pruneInterval.unref) this._pruneInterval.unref();
  }

  /**
   * Try to consume 1 token for a given key.
   * Returns whether the request is allowed.
   *
   * @param {string} key        - e.g. user ID, tenant ID, IP address
   * @param {{ cost? }} [opts]  - cost: tokens to consume (default 1)
   * @returns {{
   *   allowed: boolean,
   *   remaining: number,       // tokens left in bucket
   *   retryAfterMs: number,    // ms until next token available (0 if allowed)
   *   key: string,
   * }}
   */
  consume(key, opts = {}) {
    const cost = opts.cost ?? 1;
    const now = Date.now();
    let bucket = this._buckets.get(key);

    if (!bucket) {
      bucket = { tokens: this._burst, lastRefill: now, hits: 0, blocked: 0 };
      this._buckets.set(key, bucket);
    }

    // Refill tokens based on elapsed time
    const elapsed = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(this._burst, bucket.tokens + elapsed * this._rate);
    bucket.lastRefill = now;

    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      bucket.hits++;
      return { allowed: true, remaining: Math.floor(bucket.tokens), retryAfterMs: 0, key };
    }

    // Not enough tokens
    bucket.blocked++;
    const retryAfterMs = Math.ceil(((cost - bucket.tokens) / this._rate) * 1000);
    return { allowed: false, remaining: 0, retryAfterMs, key };
  }

  /**
   * Wrap a generator function with rate limiting.
   * Throws RateLimitError when blocked.
   *
   * @param {Function} generatorFn
   * @param {string} key
   * @param {{ cost? }} [opts]
   * @returns {Function}
   */
  wrap(generatorFn, key, opts = {}) {
    return (...args) => {
      const result = this.consume(key, opts);
      if (!result.allowed) {
        const err = new Error(`Rate limit exceeded for key "${key}". Retry after ${result.retryAfterMs}ms`);
        err.name = 'RateLimitError';
        err.retryAfterMs = result.retryAfterMs;
        err.key = key;
        throw err;
      }
      return generatorFn(...args);
    };
  }

  /**
   * Peek at the current state of a key without consuming tokens.
   * @param {string} key
   * @returns {{ tokens: number, hits: number, blocked: number } | null}
   */
  peek(key) {
    const bucket = this._buckets.get(key);
    if (!bucket) return null;
    const now = Date.now();
    const elapsed = (now - bucket.lastRefill) / 1000;
    const tokens = Math.min(this._burst, bucket.tokens + elapsed * this._rate);
    return { tokens: Math.floor(tokens), hits: bucket.hits, blocked: bucket.blocked };
  }

  /**
   * Reset tokens for a specific key (e.g. after a verified payment).
   * @param {string} key
   */
  reset(key) {
    this._buckets.delete(key);
  }

  /**
   * Get a usage report for all active keys.
   * @returns {object[]}
   */
  report() {
    const now = Date.now();
    const rows = [];
    for (const [key, bucket] of this._buckets) {
      const elapsed = (now - bucket.lastRefill) / 1000;
      const tokens = Math.min(this._burst, bucket.tokens + elapsed * this._rate);
      rows.push({
        key,
        tokens: Math.floor(tokens),
        capacity: this._burst,
        hits: bucket.hits,
        blocked: bucket.blocked,
        blockRate: bucket.hits + bucket.blocked > 0
          ? `${((bucket.blocked / (bucket.hits + bucket.blocked)) * 100).toFixed(1)}%`
          : '0%',
      });
    }
    return rows.sort((a, b) => b.blocked - a.blocked);
  }

  /**
   * Destroy the limiter and clear the prune interval.
   */
  destroy() {
    clearInterval(this._pruneInterval);
    this._buckets.clear();
  }

  _prune() {
    const cutoff = Date.now() - this._keyTTL;
    for (const [key, bucket] of this._buckets) {
      if (bucket.lastRefill < cutoff) this._buckets.delete(key);
    }
  }
}

/**
 * Create a new IdRateLimiter instance.
 * @param {{ rate?, burst?, keyTTL? }} [opts]
 * @returns {IdRateLimiter}
 */
function createRateLimiter(opts = {}) {
  return new IdRateLimiter(opts);
}

module.exports = { IdRateLimiter, createRateLimiter };
