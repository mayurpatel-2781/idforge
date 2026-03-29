/* eslint-env es2020 */
'use strict';

const { randomBytes, hmacShort } = require('./utils');
const { nanoId } = require('./generators');

// ── Semantic ID ───────────────────────────────────────────────────────────────
// Registered semantic schemas
const _schemas = {};

/**
 * Register a semantic schema for a type
 * @param {string} type
 * @param {{ segments: object[], version?: string }} schema
 */
function registerSchema(type, schema) {
  _schemas[type] = { ...schema, type };
}

// Built-in schemas
const BUILT_IN_SCHEMAS = {
  user:    { segments: [{ key: 'type', value: 'usr' }, { key: 'random', bits: 64 }] },
  order:   { segments: [{ key: 'type', value: 'ord' }, { key: 'random', bits: 64 }] },
  session: { segments: [{ key: 'type', value: 'ses' }, { key: 'random', bits: 80 }] },
  invoice: { segments: [{ key: 'type', value: 'inv' }, { key: 'random', bits: 64 }] },
};

/**
 * Generate a context-aware semantic ID
 * Context keys are encoded as short tokens in the ID itself
 *
 * @param {{ type, role?, region?, version?, env?, [key:string]: any }} context
 * @param {{ secret?, separator? }} [opts]
 * @returns {string}
 */
function semanticId(context = {}, opts = {}) {
  const { secret, separator = '.' } = opts;
  const { type = 'obj', ...rest } = context;

  // Encode each context key as a short token
  const tokens = [type];

  // Known short-encodings
  const KNOWN = {
    role:    { admin: 'adm', user: 'usr', guest: 'gst', owner: 'own', mod: 'mod' },
    region:  { IN: 'IN', US: 'US', EU: 'EU', UK: 'UK', AU: 'AU', SG: 'SG', JP: 'JP' },
    env:     { production: 'prd', staging: 'stg', development: 'dev', test: 'tst' },
    version: {},
  };

  for (const [k, v] of Object.entries(rest)) {
    const enc = KNOWN[k] ? (KNOWN[k][v] || String(v).slice(0, 3)) : String(v).slice(0, 3);
    tokens.push(enc);
  }

  // Random tail
  const rand = nanoId({ size: 8, alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' });
  tokens.push(rand);

  // Optional signature over context
  if (secret) {
    const sig = hmacShort(JSON.stringify(context), secret, 6);
    tokens.push(sig);
  }

  return tokens.join(separator);
}

/**
 * Validate a semantic ID against an expected context
 * @param {string} id
 * @param {{ type?, role?, region?, [key:string]: any }} expected
 * @param {{ secret?, separator? }} [opts]
 * @returns {{ valid: boolean, mismatch?: string[], context: object }}
 */
function validateSemantic(id, expected = {}, opts = {}) {
  const { separator = '.' } = opts;
  const parts = id.split(separator);

  if (parts.length < 2) {
    return { valid: false, mismatch: ['format'], context: {} };
  }

  const KNOWN_REV = {
    role:   { adm: 'admin', usr: 'user', gst: 'guest', own: 'owner', mod: 'mod' },
    region: { IN: 'IN', US: 'US', EU: 'EU', UK: 'UK', AU: 'AU', SG: 'SG', JP: 'JP' },
    env:    { prd: 'production', stg: 'staging', dev: 'development', tst: 'test' },
  };

  const [type, ...rest] = parts;
  const context = { type };

  // Try to decode known tokens
  const knownKeys = Object.keys(KNOWN_REV);
  for (const token of rest.slice(0, -1)) { // skip last (random)
    for (const k of knownKeys) {
      if (KNOWN_REV[k][token]) { context[k] = KNOWN_REV[k][token]; break; }
    }
  }

  const mismatches = [];
  for (const [k, v] of Object.entries(expected)) {
    if (context[k] !== v) mismatches.push(`${k}: expected "${v}", got "${context[k]}"`);
  }

  return { valid: mismatches.length === 0, mismatch: mismatches.length ? mismatches : undefined, context };
}

/**
 * Parse a semantic ID into its context components
 * @param {string} id
 * @param {{ separator? }} [opts]
 */
function parseSemantic(id, opts = {}) {
  const { separator = '.' } = opts;
  const parts = id.split(separator);
  return {
    type:   parts[0],
    tokens: parts.slice(1, -1),
    random: parts[parts.length - 1],
    raw:    id,
  };
}

module.exports = { semanticId, validateSemantic, parseSemantic, registerSchema, BUILT_IN_SCHEMAS };
