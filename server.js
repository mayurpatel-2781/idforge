/* eslint-env es2020 */
'use strict';

/**
 * server.js — UUID-Lab REST API Server
 *
 * Zero-dependency HTTP server (pure Node.js http module).
 * Rate-limited, CORS-ready, JSON API.
 *
 * Usage:
 *   node server.js               # starts on port 3000
 *   PORT=8080 node server.js     # custom port
 *
 * Or programmatically:
 *   const { createServer } = require('./server');
 *   const server = createServer({ port: 4000, rateLimit: 60 });
 *   server.start();
 */

const http = require('http');
const uid  = require('./index');

// ── Rate Limiter (in-memory, per IP) ─────────────────────────────────────────

class RateLimiter {
  constructor({ windowMs = 60_000, max = 100 } = {}) {
    this._window = windowMs;
    this._max    = max;
    this._store  = new Map();
    // Cleanup old entries every minute
    setInterval(() => this._cleanup(), 60_000).unref();
  }

  check(ip) {
    const now    = Date.now();
    const key    = ip;
    const record = this._store.get(key) || { count: 0, resetAt: now + this._window };

    if (now > record.resetAt) {
      record.count   = 0;
      record.resetAt = now + this._window;
    }

    record.count++;
    this._store.set(key, record);

    const remaining = Math.max(0, this._max - record.count);
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);

    return {
      allowed:    record.count <= this._max,
      remaining,
      retryAfter,
      resetAt:    record.resetAt,
    };
  }

  _cleanup() {
    const now = Date.now();
    for (const [key, rec] of this._store) {
      if (now > rec.resetAt) this._store.delete(key);
    }
  }
}

// ── Response helpers ──────────────────────────────────────────────────────────

function json(res, status, data) {
  const body = JSON.stringify({ ...data, _ts: new Date().toISOString() });
  res.writeHead(status, {
    'Content-Type':  'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function ok(res, data)     { json(res, 200, { ok: true,  ...data }); }
function err(res, status, message) { json(res, status, { ok: false, error: message }); }

// ── CORS headers ──────────────────────────────────────────────────────────────

function setCors(res, origins = '*') {
  res.setHeader('Access-Control-Allow-Origin',  origins);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ── Query string parser ───────────────────────────────────────────────────────

function parseQuery(url) {
  const q   = url.split('?')[1] || '';
  const out = {};
  for (const pair of q.split('&')) {
    const [k, v] = pair.split('=');
    if (k) out[decodeURIComponent(k)] = v ? decodeURIComponent(v) : true;
  }
  return out;
}

// ── Route handlers ────────────────────────────────────────────────────────────

const GENERATORS = {
  uuid:          ()     => uid.uuid(),
  uuidv4:        ()     => uid.uuidV4(),
  uuidv7:        ()     => uid.uuidV7(),
  nanoid:        (q)    => uid.nanoId({ size: parseInt(q.size) || 21 }),
  ulid:          ()     => uid.ulid(),
  ksuid:         ()     => uid.ksuid(),
  snowflake:     ()     => uid.snowflakeId(),
  cuid:          ()     => uid.cuid?.() || uid.nanoId({ size: 25 }),
  cuid2:         ()     => uid.cuid2?.() || uid.nanoId({ size: 24 }),
  prefixed:      (q)    => uid.prefixedId(q.prefix || 'id'),
  human:         ()     => uid.humanId(),
  meaningful:    ()     => uid.meaningfulId(),
  pronounceable: ()     => uid.pronounceableId(),
  fuzzy:         ()     => uid.fuzzyId(),
  expiring:      (q)    => uid.expiringId({ ttl: q.ttl || '1h' }),
  timestamp:     ()     => uid.timestampId(),
  short:         (q)    => uid.shortId({ size: parseInt(q.size) || 8 }),
  base62:        (q)    => uid.base62Id({ size: parseInt(q.size) || 16 }),
  base36:        (q)    => uid.base36Id({ size: parseInt(q.size) || 16 }),
};

function handleGenerate(req, res, path, query) {
  const type  = path.replace('/generate/', '').replace('/generate', '') || 'uuid';
  const count = Math.min(parseInt(query.count) || 1, 100); // max 100 per request
  const gen   = GENERATORS[type.toLowerCase()];

  if (!gen) {
    return err(res, 404, `Unknown ID type: "${type}". Available: ${Object.keys(GENERATORS).join(', ')}`);
  }

  try {
    const ids = count === 1
      ? gen(query)
      : Array.from({ length: count }, () => gen(query));

    ok(res, {
      type,
      count,
      ids:   Array.isArray(ids) ? ids : undefined,
      id:    Array.isArray(ids) ? undefined : ids,
      result: ids,
    });
  } catch (e) {
    err(res, 500, e.message);
  }
}

function handleDecode(req, res, query) {
  const id = query.id;
  if (!id) return err(res, 400, 'Missing ?id= parameter');
  try {
    const decoded = uid.decodeId(id);
    ok(res, { decoded });
  } catch (e) {
    err(res, 500, e.message);
  }
}

function handleValidate(req, res, query) {
  const id   = query.id;
  const type = query.type;
  if (!id) return err(res, 400, 'Missing ?id= parameter');
  try {
    const result = uid.validateAny
      ? uid.validateAny(id)
      : { valid: typeof id === 'string' && id.length > 0, type: 'unknown', errors: [] };
    ok(res, { ...result, id });
  } catch (e) {
    err(res, 500, e.message);
  }
}

function handleTypes(req, res) {
  ok(res, {
    types: Object.keys(GENERATORS),
    count: Object.keys(GENERATORS).length,
  });
}

function handleHealth(req, res) {
  ok(res, { status: 'ok', uptime: process.uptime(), version: '1.0.0' });
}

// ── Server factory ────────────────────────────────────────────────────────────

function createServer(opts = {}) {
  const {
    port       = parseInt(process.env.PORT) || 3000,
    rateLimit  = parseInt(process.env.RATE_LIMIT) || 100,
    windowMs   = 60_000,
    cors       = '*',
  } = opts;

  const limiter = new RateLimiter({ windowMs, max: rateLimit });

  const server = http.createServer((req, res) => {
    const url    = req.url || '/';
    const path   = url.split('?')[0];
    const query  = parseQuery(url);
    const ip     = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

    // CORS preflight
    setCors(res, cors);
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    // Rate limiting
    const limit = limiter.check(ip);
    res.setHeader('X-RateLimit-Limit',     rateLimit);
    res.setHeader('X-RateLimit-Remaining', limit.remaining);
    res.setHeader('X-RateLimit-Reset',     limit.resetAt);

    if (!limit.allowed) {
      res.setHeader('Retry-After', limit.retryAfter);
      return err(res, 429, `Rate limit exceeded. Retry after ${limit.retryAfter}s`);
    }

    // Routes
    if (path === '/' || path === '/health') return handleHealth(req, res);
    if (path === '/types')                  return handleTypes(req, res);
    if (path.startsWith('/generate'))       return handleGenerate(req, res, path, query);
    if (path === '/decode')                 return handleDecode(req, res, query);
    if (path === '/validate')               return handleValidate(req, res, query);

    err(res, 404, `Route not found: ${path}`);
  });

  return {
    start() {
      server.listen(port, () => {
        console.log(`\n🔑 UUID-Lab API Server`);
        console.log(`   Running at: http://localhost:${port}`);
        console.log(`   Rate limit: ${rateLimit} req/min`);
        console.log(`\n   Endpoints:`);
        console.log(`   GET /generate/uuid`);
        console.log(`   GET /generate/nanoid?size=21`);
        console.log(`   GET /generate/ulid?count=5`);
        console.log(`   GET /decode?id=<any-id>`);
        console.log(`   GET /validate?id=<any-id>`);
        console.log(`   GET /types\n`);
      });
      return this;
    },
    stop(cb) { server.close(cb); },
    server,
  };
}

// ── CLI entry ─────────────────────────────────────────────────────────────────

if (require.main === module) {
  createServer().start();
}

module.exports = { createServer, RateLimiter };
