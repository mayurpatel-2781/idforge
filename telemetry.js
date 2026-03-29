/* eslint-env es2020 */
'use strict';

// ── Observable / Telemetry Layer ──────────────────────────────────────────────

class Telemetry {
  constructor() {
    this._enabled    = false;
    this._sampleRate = 0.1;
    this._counters   = {};
    this._latencies  = [];
    this._peakRate   = 0;
    this._rateWindow = [];
    this._warnings   = [];
    this._flushCb    = null;
    this._flushInterval = null;
    this._startTime  = null;
    this._poolStats  = {};
  }

  /**
   * Enable telemetry collection
   * @param {{ sampleRate?, onFlush?, flushEvery? }} [opts]
   */
  enable(opts = {}) {
    this._enabled    = true;
    this._sampleRate = opts.sampleRate || 0.1;
    this._flushCb    = opts.onFlush    || null;
    this._startTime  = Date.now();

    if (opts.flushEvery) {
      this._flushInterval = setInterval(() => this.flush(), opts.flushEvery * 1000);
      if (this._flushInterval.unref) this._flushInterval.unref();
    }
    return this;
  }

  /** Disable telemetry */
  disable() {
    this._enabled = false;
    if (this._flushInterval) { clearInterval(this._flushInterval); this._flushInterval = null; }
    return this;
  }

  /** Record an ID generation event */
  record(type, opts = {}) {
    if (!this._enabled) return;
    if (Math.random() > this._sampleRate) return;

    // Count by type
    this._counters[type] = (this._counters[type] || 0) + 1;

    // Track rate
    const now = Date.now();
    this._rateWindow.push(now);
    // Keep only last 1 second
    const cutoff = now - 1000;
    this._rateWindow = this._rateWindow.filter(t => t > cutoff);
    const rate = this._rateWindow.length / this._sampleRate; // scale by sample rate
    if (rate > this._peakRate) this._peakRate = rate;

    // Track latency if provided
    if (opts.latencyMs !== undefined) this._latencies.push(opts.latencyMs);

    // Check for warnings
    this._checkWarnings();
  }

  /** Update pool statistics */
  recordPool(name, { size, capacity, hitRate }) {
    if (!this._enabled) return;
    this._poolStats[name] = { size, capacity, hitRate, ts: Date.now() };
    if (size / capacity < 0.1) {
      this._warn(`Pool "${name}" below 10% (${size}/${capacity}) — consider increasing size`);
    }
  }

  _warn(msg) {
    const existing = this._warnings.find(w => w.msg === msg);
    if (!existing) this._warnings.push({ msg, ts: Date.now() });
  }

  _checkWarnings() {
    const total = Object.values(this._counters).reduce((a, b) => a + b, 0);
    if (total > 10000 / this._sampleRate) {
      this._warn('High volume: >10,000 IDs generated — verify pool sizes');
    }
  }

  /**
   * Get a full telemetry report
   * @returns {object}
   */
  report() {
    const totalGenerated  = Object.values(this._counters).reduce((a, b) => a + b, 0);
    const uptime          = this._startTime ? Math.floor((Date.now() - this._startTime) / 1000) : 0;
    const avgRate         = uptime > 0 ? (totalGenerated / uptime / this._sampleRate).toFixed(1) : '0';

    let avgLatency = null;
    if (this._latencies.length > 0) {
      avgLatency = (this._latencies.reduce((a, b) => a + b, 0) / this._latencies.length).toFixed(3);
    }

    // Scale counters by sample rate
    const scaledCounters = {};
    for (const [k, v] of Object.entries(this._counters)) {
      scaledCounters[k] = Math.round(v / this._sampleRate);
    }

    return {
      enabled:          this._enabled,
      uptime:           `${uptime}s`,
      generated:        scaledCounters,
      totalGenerated:   Math.round(totalGenerated / this._sampleRate),
      peakRate:         `${Math.round(this._peakRate)} ids/sec`,
      avgRate:          `${avgRate} ids/sec`,
      avgLatencyMs:     avgLatency,
      pools:            this._poolStats,
      warnings:         this._warnings.map(w => w.msg),
      sampleRate:       this._sampleRate,
    };
  }

  /** Flush metrics to the callback and reset counters */
  flush() {
    const r = this.report();
    if (this._flushCb) this._flushCb(r);
    this._counters  = {};
    this._latencies = [];
    this._rateWindow= [];
    this._warnings  = [];
    this._peakRate  = 0;
    return r;
  }

  /** Reset everything */
  reset() {
    this.flush();
    this._startTime = Date.now();
    return this;
  }
}

// Singleton telemetry instance
const telemetry = new Telemetry();

/**
 * Wrap any generator function with telemetry recording
 * @param {string} type
 * @param {Function} fn
 * @returns {Function}
 */
function withTelemetry(type, fn) {
  return function (...args) {
    const start = Date.now();
    const result = fn(...args);
    telemetry.record(type, { latencyMs: Date.now() - start });
    return result;
  };
}

module.exports = { telemetry, withTelemetry, Telemetry };
