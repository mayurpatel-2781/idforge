/* eslint-env es2020 */
'use strict';

// ── Observable / Telemetry Layer (enhanced with p50/p95/p99) ─────────────────

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
    this._slaBudgetMs = null; // p99 SLA target
  }

  enable(opts = {}) {
    this._enabled    = true;
    this._sampleRate = opts.sampleRate || 0.1;
    this._flushCb    = opts.onFlush    || null;
    this._slaBudgetMs = opts.slaBudgetMs || null;
    this._startTime  = Date.now();
    if (opts.flushEvery) {
      this._flushInterval = setInterval(() => this.flush(), opts.flushEvery * 1000);
      if (this._flushInterval.unref) this._flushInterval.unref();
    }
    return this;
  }

  disable() {
    this._enabled = false;
    if (this._flushInterval) { clearInterval(this._flushInterval); this._flushInterval = null; }
    return this;
  }

  record(type, opts = {}) {
    if (!this._enabled) return;
    if (Math.random() > this._sampleRate) return;
    this._counters[type] = (this._counters[type] || 0) + 1;
    const now = Date.now();
    this._rateWindow.push(now);
    const cutoff = now - 1000;
    this._rateWindow = this._rateWindow.filter(t => t > cutoff);
    const rate = this._rateWindow.length / this._sampleRate;
    if (rate > this._peakRate) this._peakRate = rate;
    if (opts.latencyMs !== undefined) {
      this._latencies.push(opts.latencyMs);
      // SLA breach check
      if (this._slaBudgetMs !== null) {
        const p99 = this._percentile(99);
        if (p99 > this._slaBudgetMs) {
          this._warn(`SLA breach: p99 latency ${p99.toFixed(2)}ms exceeds budget ${this._slaBudgetMs}ms`);
        }
      }
    }
    this._checkWarnings();
  }

  recordPool(name, { size, capacity, hitRate }) {
    if (!this._enabled) return;
    this._poolStats[name] = { size, capacity, hitRate, ts: Date.now() };
    if (size / capacity < 0.1) this._warn(`Pool "${name}" below 10% (${size}/${capacity}) — consider increasing size`);
  }

  _warn(msg) {
    const existing = this._warnings.find(w => w.msg === msg);
    if (!existing) this._warnings.push({ msg, ts: Date.now() });
  }

  _checkWarnings() {
    const total = Object.values(this._counters).reduce((a, b) => a + b, 0);
    if (total > 10000 / this._sampleRate) this._warn('High volume: >10,000 IDs generated — verify pool sizes');
  }

  // ── NEW: Percentile latency calculation ────────────────────────────────────

  _percentile(p) {
    if (this._latencies.length === 0) return 0;
    const sorted = [...this._latencies].sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }

  /**
   * Get latency percentiles: p50, p75, p95, p99.
   * @returns {{ p50, p75, p95, p99, min, max, count } | null}
   */
  latencyPercentiles() {
    if (this._latencies.length === 0) return null;
    const sorted = [...this._latencies].sort((a, b) => a - b);
    const pct = (p) => {
      const idx = Math.ceil((p / 100) * sorted.length) - 1;
      return Math.round(sorted[Math.max(0, idx)] * 100) / 100;
    };
    return {
      p50:   pct(50),
      p75:   pct(75),
      p95:   pct(95),
      p99:   pct(99),
      min:   sorted[0],
      max:   sorted[sorted.length - 1],
      count: sorted.length,
      mean:  Math.round((sorted.reduce((a, b) => a + b, 0) / sorted.length) * 100) / 100,
    };
  }

  /**
   * Get a latency histogram with configurable bucket boundaries.
   * @param {number[]} [buckets] - upper bounds in ms e.g. [0.1, 0.5, 1, 5, 10, 50, 100]
   * @returns {Array<{ le: number, count: number, pct: string }>}
   */
  latencyHistogram(buckets = [0.1, 0.5, 1, 2, 5, 10, 25, 50, 100, Infinity]) {
    const result = buckets.map(le => ({ le, count: 0 }));
    for (const lat of this._latencies) {
      for (const bucket of result) {
        if (lat <= bucket.le) { bucket.count++; break; }
      }
    }
    const total = this._latencies.length || 1;
    return result.map(b => ({
      le: b.le === Infinity ? '+Inf' : `${b.le}ms`,
      count: b.count,
      pct: `${((b.count / total) * 100).toFixed(1)}%`,
    }));
  }

  report() {
    const totalGenerated  = Object.values(this._counters).reduce((a, b) => a + b, 0);
    const uptime          = this._startTime ? Math.floor((Date.now() - this._startTime) / 1000) : 0;
    const avgRate         = uptime > 0 ? (totalGenerated / uptime / this._sampleRate).toFixed(1) : '0';

    let avgLatency = null;
    if (this._latencies.length > 0) {
      avgLatency = (this._latencies.reduce((a, b) => a + b, 0) / this._latencies.length).toFixed(3);
    }

    const scaledCounters = {};
    for (const [k, v] of Object.entries(this._counters)) scaledCounters[k] = Math.round(v / this._sampleRate);

    return {
      enabled:          this._enabled,
      uptime:           `${uptime}s`,
      generated:        scaledCounters,
      totalGenerated:   Math.round(totalGenerated / this._sampleRate),
      peakRate:         `${Math.round(this._peakRate)} ids/sec`,
      avgRate:          `${avgRate} ids/sec`,
      avgLatencyMs:     avgLatency,
      latencyPercentiles: this.latencyPercentiles(),
      pools:            this._poolStats,
      warnings:         this._warnings.map(w => w.msg),
      sampleRate:       this._sampleRate,
    };
  }

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

  reset() { this.flush(); this._startTime = Date.now(); return this; }
}

const telemetry = new Telemetry();

function withTelemetry(type, fn) {
  return function (...args) {
    const start = Date.now();
    const result = fn(...args);
    telemetry.record(type, { latencyMs: Date.now() - start });
    return result;
  };
}

module.exports = { telemetry, withTelemetry, Telemetry };
