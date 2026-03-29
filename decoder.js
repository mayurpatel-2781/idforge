/* eslint-env es2020 */
'use strict';

/**
 * decoder.js — Reverse ID Decoding + Global ID Parser
 * ─────────────────────────────────────────────────────
 * Features 1 & 2: Decode any ID back to its components,
 * and a single parse() entry point that auto-detects type.
 */

const crypto = require('crypto');

// ── Decoder registry ──────────────────────────────────────────────────────────

const _decoders = new Map();

/**
 * Register a custom decoder for a named ID type.
 * @param {string} type
 * @param {{ detect: (id)=>boolean, decode: (id)=>object }} decoder
 */
function registerDecoder(type, decoder) {
  _decoders.set(type, decoder);
}

// ── Built-in decoders ─────────────────────────────────────────────────────────

const BUILT_IN_DECODERS = {
  'uuid-v4': {
    detect: id => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id),
    decode: id => ({
      type: 'uuid-v4', version: 4,
      raw: id,
      hex: id.replace(/-/g, ''),
      variant: 'RFC 4122',
      random: true,
    }),
  },
  'uuid-v7': {
    detect: id => /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id),
    decode: id => {
      const hex = id.replace(/-/g, '');
      const tsMs = parseInt(hex.slice(0, 12), 16);
      return { type: 'uuid-v7', version: 7, timestamp: tsMs, date: new Date(tsMs).toISOString(), raw: id };
    },
  },
  'ulid': {
    detect: id => /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/.test(id),
    decode: id => {
      const C = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
      let ts = 0;
      for (let i = 0; i < 10; i++) ts = ts * 32 + C.indexOf(id[i]);
      return { type: 'ulid', timestamp: ts, date: new Date(ts).toISOString(), random: id.slice(10), raw: id };
    },
  },
  'snowflake': {
    detect: id => /^\d{15,20}$/.test(id),
    decode: id => {
      const n = BigInt(id);
      const ts = Number(n >> 22n);
      const machineId = Number((n >> 12n) & 0x3FFn);
      const seq = Number(n & 0xFFFn);
      return { type: 'snowflake', timestamp: ts, date: new Date(ts).toISOString(), machineId, sequence: seq, raw: id };
    },
  },
  'nanoid': {
    detect: id => /^[A-Za-z0-9_-]{21}$/.test(id),
    decode: id => ({
      type: 'nanoid', length: id.length,
      entropyBits: Math.round(id.length * Math.log2(64) * 10) / 10,
      alphabet: 'base64url', raw: id,
    }),
  },
  'topology': {
    detect: id => /^[A-Z]{2}\.dc\d+\.[0-9a-z]+-[A-Za-z0-9]+$/.test(id) || /^[a-z]+_[A-Z]{2}\.dc\d+/.test(id),
    decode: id => {
      const core = id.includes('_') ? id.slice(id.indexOf('_') + 1) : id;
      const prefix = id.includes('_') ? id.slice(0, id.indexOf('_')) : null;
      const [country, dc, rest] = core.split('.');
      const [ts, rand] = (rest || '').split('-');
      const EU = new Set(['DE','IE','FR','SE','IT','NL','PL','ES','BE','AT','FI','GR','PT','CZ','RO','HU']);
      return {
        type: 'topology', prefix, country,
        datacenter: parseInt(dc?.replace('dc', '')),
        timestamp: parseInt(ts, 36),
        date: new Date(parseInt(ts, 36)).toISOString(),
        random: rand,
        isEU: EU.has(country),
        raw: id,
      };
    },
  },
  'semantic': {
    detect: id => /^[a-z]+\.[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)+$/.test(id),
    decode: id => {
      const parts = id.split('.');
      const ROLES = { adm:'admin', usr:'user', gst:'guest', own:'owner', mod:'mod' };
      const ENVS  = { prd:'production', stg:'staging', dev:'development', tst:'test' };
      const tokens = parts.slice(1, -1).map(t => ROLES[t] || ENVS[t] || t);
      return { type: 'semantic', entityType: parts[0], tokens, random: parts[parts.length - 1], raw: id };
    },
  },
  'lifecycle': {
    detect: id => /^[a-z]+_[a-z]+_[A-Za-z0-9]{10}_[0-9a-f]{8}$/.test(id),
    decode: id => {
      const [entity, state, coreId, sig] = id.split('_');
      return { type: 'lifecycle', entity, state, coreId, signature: sig, raw: id };
    },
  },
  'prefixed': {
    detect: id => /^[a-z]{2,6}_[A-Za-z0-9_-]{10,}$/.test(id),
    decode: id => {
      const idx = id.indexOf('_');
      return { type: 'prefixed', prefix: id.slice(0, idx), body: id.slice(idx + 1), length: id.length, raw: id };
    },
  },
  'expiring': {
    detect: id => /^exp_\d{13}_[A-Za-z0-9_-]+$/.test(id),
    decode: id => {
      const parts = id.split('_');
      const exp = parseInt(parts[1]);
      return { type: 'expiring', expiresAt: new Date(exp).toISOString(), expired: exp < Date.now(), body: parts[2], raw: id };
    },
  },
  'hierarchy': {
    detect: id => id.includes('/') && /^[a-z]+_[A-Za-z0-9]+(\/[a-z]+_[A-Za-z0-9]+)+$/.test(id),
    decode: id => {
      const segs = id.split('/');
      return {
        type: 'hierarchy', depth: segs.length - 1,
        segments: segs, root: segs[0],
        parent: segs.length > 1 ? segs.slice(0, -1).join('/') : null,
        leaf: segs[segs.length - 1], raw: id,
      };
    },
  },
  'migrated': {
    detect: id => /^mid_v\d+_[A-Za-z0-9_-]+$/.test(id),
    decode: id => {
      const m = id.match(/^mid_v(\d+)_([A-Za-z0-9_-]+?)(?:_([0-9a-f]{8}))?$/);
      if (!m) return { type: 'migrated', raw: id };
      let original;
      try { original = Buffer.from(m[2], 'base64url').toString('utf8'); } catch { original = null; }
      return { type: 'migrated', version: m[1], originalId: original, hasIntegrity: !!m[3], raw: id };
    },
  },
};

// Register all built-ins
for (const [type, decoder] of Object.entries(BUILT_IN_DECODERS)) {
  _decoders.set(type, decoder);
}

/**
 * Decode a single ID — returns its type and all extractable fields.
 * @param {string} id
 * @returns {{ type: string, [key: string]: any }}
 */
function decodeId(id) {
  if (typeof id !== 'string' || !id.length) return { type: 'invalid', reason: 'empty or non-string', raw: id };
  for (const [, decoder] of _decoders) {
    if (decoder.detect(id)) return decoder.decode(id);
  }
  return {
    type: 'unknown', length: id.length,
    entropyBits: Math.round(id.length * Math.log2(new Set(id).size || 1) * 10) / 10,
    raw: id,
  };
}

/**
 * Global unified parser — auto-detects type and returns structured data.
 * The single entry point for any ID in the system.
 * @param {string} id
 * @returns {{ type, confidence, decoded, suggestions }}
 */
function parseId(id) {
  const decoded = decodeId(id);
  const matches = [];

  for (const [type, decoder] of _decoders) {
    if (decoder.detect(id)) matches.push(type);
  }

  const confidence = matches.length === 1 ? 'high' : matches.length > 1 ? 'medium' : 'low';
  const suggestions = matches.length === 0 ? _suggest(id) : [];

  return { type: decoded.type, confidence, decoded, allMatches: matches, suggestions };
}

/**
 * Decode multiple IDs at once.
 * @param {string[]} ids
 * @returns {Array<{ id, ...decoded }>}
 */
function decodeBatch(ids) {
  return ids.map(id => ({ id, ...decodeId(id) }));
}

function _suggest(id) {
  const s = [];
  if (id.length === 26) s.push('Might be a ULID — check alphabet (only 0-9A-Z without I,L,O,U)');
  if (id.length === 21) s.push('Might be a NanoId — check alphabet');
  if (/^\d+$/.test(id)) s.push('Numeric-only — might be a Snowflake or sequential ID');
  if (id.includes('-') && id.length === 36) s.push('UUID-like — check version digit at position 14');
  return s;
}

module.exports = { decodeId, parseId, decodeBatch, registerDecoder };
