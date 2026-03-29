/* eslint-env es2020 */
'use strict';

/**
 * docgen.js — Documentation Generator + Auto-retry + Monitoring + CLI + TypeScript
 * ──────────────────────────────────────────────────────────────────────────────────
 * Features 30, 27, 25, 24, 19
 */

const { decodeId } = require('./decoder');

// ── Auto Retry / Fallback ─────────────────────────────────────────────────────

/**
 * Wrap any generator with automatic retry and fallback.
 * @param {Function} primaryFn
 * @param {{ retries?, backoffMs?, fallback?, onRetry? }} opts
 */
function withRetry(primaryFn, opts = {}) {
  const { retries = 3, backoffMs = 50, fallback, onRetry } = opts;
  return async function retryWrapper(...args) {
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await primaryFn(...args);
      } catch(e) {
        lastErr = e;
        if (onRetry) onRetry({ attempt, error: e, args });
        if (attempt < retries) await new Promise(r => setTimeout(r, backoffMs * (attempt + 1)));
      }
    }
    if (fallback) {
      try { return await fallback(...args); } catch {}
    }
    throw lastErr;
  };
}

/**
 * Wrap with a fallback chain — tries each function in order.
 * @param {Function[]} fns
 */
function withFallback(...fns) {
  return async function fallbackChain(...args) {
    for (const fn of fns) {
      try { return await fn(...args); } catch {}
    }
    throw new Error('All fallback strategies exhausted');
  };
}

// ── Monitoring Hooks ──────────────────────────────────────────────────────────

class Monitor {
  constructor() {
    this._metrics   = new Map();
    this._probes    = [];
    this._snapshots = [];
    this._interval  = null;
  }

  /**
   * Increment a named counter.
   */
  count(name, value = 1) {
    this._metrics.set(name, (this._metrics.get(name) ?? 0) + value);
  }

  /**
   * Record a gauge value (e.g. current pool size).
   */
  gauge(name, value) {
    this._metrics.set(name, value);
  }

  /**
   * Record a timing sample in ms.
   */
  timing(name, ms) {
    const key = `timing:${name}`;
    if (!this._metrics.has(key)) this._metrics.set(key, []);
    const arr = this._metrics.get(key);
    arr.push(ms);
    if (arr.length > 1000) arr.shift();
  }

  /**
   * Register a probe — a function that returns metrics on demand.
   * @param {string} name
   * @param {Function} fn  - () => object
   */
  probe(name, fn) {
    this._probes.push({ name, fn });
    return this;
  }

  /**
   * Take a snapshot of all current metrics.
   */
  snapshot() {
    const metrics = {};
    for (const [k, v] of this._metrics) {
      if (Array.isArray(v)) {
        const sorted = [...v].sort((a, b) => a - b);
        const pct = (p) => sorted[Math.ceil(p / 100 * sorted.length) - 1] ?? 0;
        metrics[k] = { count: v.length, p50: pct(50), p95: pct(95), p99: pct(99), min: sorted[0], max: sorted[sorted.length - 1] };
      } else {
        metrics[k] = v;
      }
    }
    for (const { name, fn } of this._probes) {
      try { metrics[`probe:${name}`] = fn(); } catch {}
    }
    const snap = { ts: new Date().toISOString(), metrics };
    this._snapshots.push(snap);
    if (this._snapshots.length > 100) this._snapshots.shift();
    return snap;
  }

  /**
   * Start auto-snapshotting every N seconds.
   */
  startPolling(intervalSec = 60, cb) {
    this._interval = setInterval(() => {
      const snap = this.snapshot();
      if (cb) cb(snap);
    }, intervalSec * 1000);
    if (this._interval.unref) this._interval.unref();
  }

  stopPolling() { if (this._interval) { clearInterval(this._interval); this._interval = null; } }

  history(n = 10) { return this._snapshots.slice(-n); }
  reset()         { this._metrics.clear(); this._snapshots = []; }
}

const monitor = new Monitor();

// ── CLI Support ───────────────────────────────────────────────────────────────

/**
 * Parse CLI arguments into a structured command.
 * Supports: uniqid-pro generate uuid  --count 5
 *           uniqid-pro decode <id>
 *           uniqid-pro scan <id>
 * @param {string[]} argv  - process.argv.slice(2)
 */
function parseCLIArgs(argv = []) {
  const command = argv[0];
  const args    = [];
  const flags   = {};

  for (let i = 1; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      flags[key] = val === 'true' ? true : val === 'false' ? false : isNaN(val) ? val : Number(val);
    } else {
      args.push(argv[i]);
    }
  }
  return { command, args, flags };
}

/**
 * Execute a CLI command and return output string.
 * @param {object} parsed  - result of parseCLIArgs
 * @param {object} uid     - the uniqid-pro module
 */
function executeCLI(parsed, uid) {
  const { command, args, flags } = parsed;
  const count  = flags.count || 1;
  const lines  = [];

  switch (command) {
    case 'generate': {
      const type = args[0] || 'nanoid';
      const fn = {
        nanoid:    () => uid.nanoId(flags.size),
        uuid:      () => uid.uuid(),
        ulid:      () => uid.ulid(),
        snowflake: () => uid.snowflakeId(),
        ksuid:     () => uid.ksuid(),
        humanid:   () => uid.humanId(),
        fuzzy:     () => uid.fuzzyId(),
      }[type];
      if (!fn) return `Unknown type: ${type}. Available: nanoid, uuid, ulid, snowflake, ksuid, humanid, fuzzy`;
      for (let i = 0; i < count; i++) lines.push(fn());
      break;
    }
    case 'decode': {
      const id = args[0];
      if (!id) return 'Usage: decode <id>';
      const decoded = uid.decodeId(id);
      return JSON.stringify(decoded, null, 2);
    }
    case 'scan': {
      const id = args[0];
      if (!id) return 'Usage: scan <id>';
      const result = uid.scanForPII(id);
      return JSON.stringify(result, null, 2);
    }
    case 'entropy': {
      const id = args[0];
      if (!id) return 'Usage: entropy <id>';
      return JSON.stringify(uid.analyzeEntropy(id), null, 2);
    }
    case 'validate': {
      const id = args[0];
      if (!id) return 'Usage: validate <id>';
      return JSON.stringify(uid.parseId(id), null, 2);
    }
    case 'help':
    default:
      return [
        'uniqid-pro CLI',
        '  generate <type> [--count N] [--size N]',
        '  decode <id>',
        '  scan <id>',
        '  entropy <id>',
        '  validate <id>',
        '  help',
      ].join('\n');
  }
  return lines.join('\n');
}

// ── Documentation Generator ───────────────────────────────────────────────────

/**
 * Generate Markdown documentation for a schema definition.
 * @param {object} schemaDef  - { name, description, segments, examples? }
 */
function generateSchemaDocs(schemaDef) {
  const { name, description, segments = [], examples = [] } = schemaDef;
  const lines = [
    `## ${name}`,
    '',
    description ? `${description}` : '',
    '',
    '### Format',
    '',
    '| Segment | Type | Encoding | Description |',
    '|---------|------|----------|-------------|',
    ...segments.map(s => `| \`${s.key}\` | ${s.type || 'literal'} | ${s.encoding || '—'} | ${s.description || ''} |`),
    '',
  ];

  if (examples.length) {
    lines.push('### Examples', '');
    for (const ex of examples) lines.push(`\`\`\`\n${ex}\n\`\`\``);
    lines.push('');
  }

  return lines.filter(l => l !== undefined).join('\n');
}

/**
 * Generate TypeScript type definitions for a schema.
 * @param {object} schemaDef
 */
function generateTypeScript(schemaDef) {
  const { name, segments = [] } = schemaDef;
  const typeName = name.replace(/[^a-zA-Z0-9]/g, '').replace(/^./, c => c.toUpperCase());
  const fields = segments.map(s => {
    const tsType = s.type === 'timestamp' ? 'Date' : s.type === 'counter' ? 'number' : s.type === 'data' ? 'string | number' : 'string';
    return `  ${s.key}${s.optional ? '?' : ''}: ${tsType};`;
  });
  return [
    `/** Auto-generated by uniqid-pro docgen */`,
    `export interface ${typeName}Decoded {`,
    ...fields,
    `  raw: string;`,
    `  type: '${name.toLowerCase()}';`,
    `}`,
    '',
    `export type ${typeName}Id = string & { readonly __brand: '${name}' };`,
  ].join('\n');
}

/**
 * Generate full project documentation for all registered schemas.
 * @param {Array<object>} schemas
 */
function generateDocs(schemas, opts = {}) {
  const { format = 'markdown', title = 'uniqid-pro Schema Reference' } = opts;
  if (format === 'typescript') return schemas.map(generateTypeScript).join('\n\n');
  const header = [`# ${title}`, '', `Generated: ${new Date().toISOString()}`, ''];
  const body   = schemas.map(generateSchemaDocs);
  return [...header, ...body].join('\n');
}

module.exports = {
  withRetry, withFallback,
  Monitor, monitor,
  parseCLIArgs, executeCLI,
  generateSchemaDocs, generateTypeScript, generateDocs,
};
