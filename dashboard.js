/* eslint-env es2020 */
'use strict';

/**
 * dashboard.js — ID Analytics Dashboard
 * ───────────────────────────────────────
 * Aggregates telemetry, collision, federation, and lifecycle data
 * into a structured report that can power a web dashboard or CLI output.
 *
 * Usage:
 *   const dash = createDashboard({ telemetry, detectors, federations });
 *   const snapshot = await dash.snapshot();   // full data for a dashboard render
 *   dash.watch(1000, cb);                     // streaming updates every 1s
 *   console.log(dash.ascii());               // terminal-friendly summary
 */

const { Telemetry } = require('./telemetry_enhanced');

// ── Metric Aggregators ────────────────────────────────────────────────────────

class TimeSeriesBuffer {
  /**
   * Rolling fixed-size circular buffer of { ts, value } pairs.
   * @param {number} maxPoints
   */
  constructor(maxPoints = 60) {
    this._buf = [];
    this._max = maxPoints;
  }

  push(value) {
    this._buf.push({ ts: Date.now(), value });
    if (this._buf.length > this._max) this._buf.shift();
  }

  get points() { return [...this._buf]; }
  get latest() { return this._buf[this._buf.length - 1] ?? null; }
  get length() { return this._buf.length; }

  /** Moving average over last N points */
  movingAvg(n = 10) {
    const slice = this._buf.slice(-n);
    if (!slice.length) return 0;
    return slice.reduce((s, p) => s + p.value, 0) / slice.length;
  }

  /** Rate of change between last two points */
  rateOfChange() {
    if (this._buf.length < 2) return 0;
    const a = this._buf[this._buf.length - 2];
    const b = this._buf[this._buf.length - 1];
    const dt = (b.ts - a.ts) / 1000;
    return dt > 0 ? (b.value - a.value) / dt : 0;
  }
}

// ── Alert Engine ──────────────────────────────────────────────────────────────

class AlertEngine {
  constructor() {
    this._rules  = [];
    this._active = [];
    this._history = [];
  }

  /**
   * Add an alert rule.
   * @param {{ name, condition, severity?, message }} rule
   */
  addRule(rule) {
    this._rules.push({ severity: 'warning', ...rule });
    return this;
  }

  evaluate(metrics) {
    const now = Date.now();
    const fired = [];

    for (const rule of this._rules) {
      let triggered = false;
      try { triggered = rule.condition(metrics); } catch {}

      if (triggered) {
        const existing = this._active.find(a => a.name === rule.name);
        if (!existing) {
          const alert = {
            name:      rule.name,
            severity:  rule.severity,
            message:   typeof rule.message === 'function' ? rule.message(metrics) : rule.message,
            firedAt:   new Date(now).toISOString(),
            ts:        now,
          };
          this._active.push(alert);
          this._history.push(alert);
          fired.push(alert);
        }
      } else {
        this._active = this._active.filter(a => a.name !== rule.name);
      }
    }

    return fired;
  }

  get active()  { return [...this._active]; }
  get history() { return [...this._history].reverse().slice(0, 50); }
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

class Dashboard {
  /**
   * @param {{
   *   telemetry?,
   *   detectors?,      // Map or array of CollisionDetector
   *   federations?,    // Map or array of Federation
   *   maxHistory?,
   * }} opts
   */
  constructor(opts = {}) {
    const { maxHistory = 60 } = opts;

    this._telemetry   = opts.telemetry   ?? null;
    this._detectors   = this._toMap(opts.detectors);
    this._federations = this._toMap(opts.federations);

    this._startTime  = Date.now();
    this._snapshots  = 0;

    // Time series
    this._series = {
      generationRate:   new TimeSeriesBuffer(maxHistory),
      collisionRate:    new TimeSeriesBuffer(maxHistory),
      p99Latency:       new TimeSeriesBuffer(maxHistory),
      activeNodes:      new TimeSeriesBuffer(maxHistory),
    };

    // Alert engine with sensible defaults
    this._alerts = new AlertEngine()
      .addRule({
        name:      'high-collision-rate',
        severity:  'critical',
        condition: m => (m.collisions?.ratePercent ?? 0) > 0.1,
        message:   m => `Collision rate ${m.collisions?.ratePercent?.toFixed(3)}% exceeds 0.1% threshold`,
      })
      .addRule({
        name:      'p99-sla-breach',
        severity:  'warning',
        condition: m => (m.latency?.p99 ?? 0) > 10,
        message:   m => `p99 latency ${m.latency?.p99}ms exceeds 10ms SLA`,
      })
      .addRule({
        name:      'bloom-filter-saturation',
        severity:  'warning',
        condition: m => (m.collisions?.bloomFill ?? 0) > 80,
        message:   m => `Bloom filter ${m.collisions?.bloomFill}% full — collision false-positive rate rising`,
      })
      .addRule({
        name:      'entropy-drift',
        severity:  'info',
        condition: m => (m.entropy?.avgBits ?? 128) < 96,
        message:   'Average ID entropy below 96 bits — review generator configuration',
      });

    this._watchTimer = null;
  }

  /**
   * Take a full snapshot — suitable for rendering a dashboard.
   * @returns {Promise<DashboardSnapshot>}
   */
  async snapshot() {
    this._snapshots++;
    const now = Date.now();

    // ── Generation metrics ────────────────────────────────────────────────────
    const telReport   = this._telemetry?.report() ?? null;
    const genRate     = telReport ? parseFloat(telReport.avgRate) || 0 : 0;
    const latencyPcts = telReport?.latencyPercentiles ?? null;

    this._series.generationRate.push(genRate);
    if (latencyPcts) this._series.p99Latency.push(latencyPcts.p99 ?? 0);

    // ── Collision metrics ─────────────────────────────────────────────────────
    const collisionData = [];
    for (const [name, det] of this._detectors) {
      collisionData.push({ name, ...(await det.stats()) });
    }

    const totalCollisions    = collisionData.reduce((s, d) => s + (d.collisions ?? 0), 0);
    const totalRegistrations = collisionData.reduce((s, d) => s + (d.registrations ?? 0), 0);
    const collisionRatePct   = totalRegistrations > 0
      ? (totalCollisions / totalRegistrations) * 100 : 0;

    const bloomFillMax = collisionData.length > 0
      ? Math.max(...collisionData.map(d => parseFloat(d.bloomFillRatio) || 0))
      : 0;

    this._series.collisionRate.push(collisionRatePct);

    // ── Federation metrics ────────────────────────────────────────────────────
    const fedData = [];
    for (const [name, fed] of this._federations) {
      fedData.push({ name, ...fed.stats() });
    }
    const totalNodes = fedData.reduce((s, f) => s + (f.nodes ?? 0), 0);
    this._series.activeNodes.push(totalNodes);

    // ── Build metrics object for alert engine ─────────────────────────────────
    const metrics = {
      collisions: {
        ratePercent: collisionRatePct,
        bloomFill:   bloomFillMax,
      },
      latency: latencyPcts,
      entropy: { avgBits: 128 }, // Could be fed from entropy module
    };

    const newAlerts = this._alerts.evaluate(metrics);

    const snapshot = {
      capturedAt:    new Date(now).toISOString(),
      uptimeMs:      now - this._startTime,
      uptimeHuman:   _humanDuration(now - this._startTime),
      snapshotCount: this._snapshots,

      generation: {
        ratePerSec:  Math.round(genRate),
        rateMA10:    Math.round(this._series.generationRate.movingAvg(10)),
        byType:      telReport?.generated ?? {},
        totalLifetime: telReport?.totalGenerated ?? 0,
        series:      this._series.generationRate.points,
      },

      latency: latencyPcts ? {
        ...latencyPcts,
        series: this._series.p99Latency.points,
      } : null,

      collisions: {
        total:         totalCollisions,
        registrations: totalRegistrations,
        ratePercent:   Math.round(collisionRatePct * 1000) / 1000,
        bloomFillMax:  `${bloomFillMax.toFixed(1)}%`,
        byNamespace:   collisionData,
        series:        this._series.collisionRate.points,
      },

      federation: {
        totalNodes,
        federations: fedData,
        series:      this._series.activeNodes.points,
      },

      alerts: {
        active:  this._alerts.active,
        recent:  this._alerts.history.slice(0, 10),
        newThisSnapshot: newAlerts,
      },

      telemetry: telReport,
    };

    return snapshot;
  }

  /**
   * Start watching — calls cb with a fresh snapshot every intervalMs.
   * @param {number} intervalMs
   * @param {Function} cb
   */
  watch(intervalMs = 1000, cb) {
    this.stopWatching();
    this._watchTimer = setInterval(async () => {
      try { cb(await this.snapshot()); } catch {}
    }, intervalMs);
    if (this._watchTimer.unref) this._watchTimer.unref();
    return this;
  }

  stopWatching() {
    if (this._watchTimer) { clearInterval(this._watchTimer); this._watchTimer = null; }
    return this;
  }

  /**
   * ASCII dashboard for terminal output.
   * @param {object} [snap] - optional pre-fetched snapshot, otherwise takes a new one
   */
  async ascii(snap) {
    const s = snap ?? await this.snapshot();
    const lines = [
      '┌─────────────────────────────────────────────────┐',
      `│  uniqid-pro dashboard  •  uptime: ${s.uptimeHuman.padEnd(13)}│`,
      '├──────────────┬──────────────┬────────────────────┤',
      `│  gen/sec     │  p99 latency │  collisions        │`,
      `│  ${String(s.generation.ratePerSec).padEnd(12)}│  ${s.latency ? s.latency.p99+'ms' : 'n/a'.padEnd(10)}  │  ${String(s.collisions.total).padEnd(18)}│`,
      '├──────────────┴──────────────┴────────────────────┤',
    ];

    if (s.alerts.active.length > 0) {
      lines.push(`│  ⚠  ${s.alerts.active.length} active alert(s)`.padEnd(50) + '│');
      for (const a of s.alerts.active.slice(0, 3)) {
        lines.push(`│    [${a.severity.toUpperCase()}] ${a.name}`.slice(0, 50).padEnd(50) + '│');
      }
    } else {
      lines.push('│  ✓  all clear — no active alerts'.padEnd(50) + '│');
    }

    if (s.federation.totalNodes > 0) {
      lines.push(`│  federation nodes: ${s.federation.totalNodes}`.padEnd(50) + '│');
    }

    lines.push('└─────────────────────────────────────────────────┘');
    return lines.join('\n');
  }

  /** Add a custom alert rule */
  addAlert(rule) { this._alerts.addRule(rule); return this; }

  _toMap(input) {
    if (!input) return new Map();
    if (input instanceof Map) return input;
    if (Array.isArray(input)) return new Map(input.map((v, i) => [v.name ?? v.namespace ?? String(i), v]));
    if (typeof input === 'object') return new Map(Object.entries(input));
    return new Map();
  }
}

function _humanDuration(ms) {
  if (ms < 1000)    return `${ms}ms`;
  if (ms < 60000)   return `${(ms/1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms/60000)}m ${Math.floor((ms%60000)/1000)}s`;
  return `${(ms/3600000).toFixed(1)}h`;
}

/**
 * Create a dashboard instance.
 * @param {{ telemetry?, detectors?, federations?, maxHistory? }} opts
 */
function createDashboard(opts = {}) {
  return new Dashboard(opts);
}

module.exports = { Dashboard, createDashboard, TimeSeriesBuffer, AlertEngine };
