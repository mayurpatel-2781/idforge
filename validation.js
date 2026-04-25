/* eslint-env es2020 */
'use strict';

/**
 * validation.js — TypeScript-safe ID Validation Schemas
 *
 * Provides validators that work WITHOUT requiring zod/joi to be installed.
 * If zod/joi ARE installed, returns real schema objects.
 * Also provides standalone validators that work everywhere.
 */

// ── Regex patterns ────────────────────────────────────────────────────────────

const PATTERNS = {
  uuid:        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  uuidV4:      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  uuidV7:      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  ulid:        /^[0-9A-HJKMNP-TV-Z]{26}$/i,
  nanoid:      /^[A-Za-z0-9_-]{21}$/,
  nanoidAny:   /^[A-Za-z0-9_-]{7,64}$/,
  cuid:        /^c[0-9a-z]{24}$/,
  cuid2:       /^[a-z][a-z0-9]{1,31}$/,
  ksuid:       /^[A-Za-z0-9_-]{27}$/,
  snowflake:   /^\d{15,20}$/,
  prefixed:    /^[a-z]{2,8}_[A-Za-z0-9_-]{4,}$/,
  expiring:    /^exp_\d+_[A-Za-z0-9_-]+$/,
  mongoObjectId: /^[0-9a-f]{24}$/i,
  hex32:       /^[0-9a-f]{32}$/i,
};

// ── Standalone validators (no dependencies) ───────────────────────────────────

function isUUID(id)          { return PATTERNS.uuid.test(id); }
function isUUIDv4(id)        { return PATTERNS.uuidV4.test(id); }
function isUUIDv7(id)        { return PATTERNS.uuidV7.test(id); }
function isULID(id)          { return PATTERNS.ulid.test(id); }
function isNanoId(id)        { return PATTERNS.nanoid.test(id); }
function isCuid(id)          { return PATTERNS.cuid.test(id); }
function isCuid2(id)         { return PATTERNS.cuid2.test(id); }
function isKSUID(id)         { return PATTERNS.ksuid.test(id); }
function isSnowflake(id)     { return PATTERNS.snowflake.test(id); }
function isPrefixed(id, pfx) { return pfx ? id.startsWith(`${pfx}_`) : PATTERNS.prefixed.test(id); }
function isExpiring(id)      { return PATTERNS.expiring.test(id); }
function isMongoId(id)       { return PATTERNS.mongoObjectId.test(id); }

/**
 * Auto-detect ID type and validate.
 * @param {string} id
 * @returns {{ valid: boolean, type: string, errors: string[] }}
 */
function validateAny(id) {
  if (typeof id !== 'string' || !id) {
    return { valid: false, type: 'unknown', errors: ['ID must be a non-empty string'] };
  }
  for (const [type, pattern] of Object.entries(PATTERNS)) {
    if (pattern.test(id)) return { valid: true, type, errors: [] };
  }
  return { valid: false, type: 'unknown', errors: ['No known ID format matched'] };
}

/**
 * Validate with a specific rule set.
 * @param {string} id
 * @param {{ type?, minLength?, maxLength?, pattern?, prefix?, notExpired? }} rules
 */
function validateId(id, rules = {}) {
  const errors = [];

  if (typeof id !== 'string') { errors.push('Must be a string'); return { valid: false, errors }; }
  if (!id.length)              { errors.push('Must not be empty'); return { valid: false, errors }; }

  if (rules.type) {
    const pattern = PATTERNS[rules.type];
    if (pattern && !pattern.test(id)) errors.push(`Must be a valid ${rules.type}`);
  }
  if (rules.minLength && id.length < rules.minLength)
    errors.push(`Must be at least ${rules.minLength} characters`);
  if (rules.maxLength && id.length > rules.maxLength)
    errors.push(`Must be at most ${rules.maxLength} characters`);
  if (rules.pattern && !rules.pattern.test(id))
    errors.push('Must match required pattern');
  if (rules.prefix && !id.startsWith(`${rules.prefix}_`))
    errors.push(`Must start with prefix "${rules.prefix}_"`);
  if (rules.notExpired && id.startsWith('exp_')) {
    const ts = parseInt(id.split('_')[1]);
    if (!isNaN(ts) && ts < Date.now()) errors.push('ID has expired');
  }

  return { valid: errors.length === 0, errors };
}

// ── Zod-compatible schema builder (works without zod installed) ───────────────

/**
 * Build a Zod schema for an ID type.
 * If zod is installed in the project: returns real z.string().regex(...)
 * If not installed: returns a lightweight object with .parse() and .safeParse()
 *
 * @param {string} type  e.g. 'uuid', 'nanoid', 'ulid', 'cuid2'
 * @param {{ optional?, nullable?, description? }} [opts]
 */
function zodSchema(type, opts = {}) {
  const pattern = PATTERNS[type];
  if (!pattern) throw new Error(`Unknown ID type for zodSchema: "${type}"`);

  // Try to use real zod if available
  try {
    const z = require('zod');
    let schema = z.string().regex(pattern, `Must be a valid ${type}`);
    if (opts.description) schema = schema.describe(opts.description);
    if (opts.optional)    schema = schema.optional();
    if (opts.nullable)    schema = schema.nullable();
    return schema;
  } catch {
    // Fallback: lightweight zod-compatible schema
    return _buildFallbackSchema(type, pattern, opts);
  }
}

function _buildFallbackSchema(type, pattern, opts) {
  const schema = {
    _type: type,
    _pattern: pattern,
    _optional: opts.optional || false,
    _nullable: opts.nullable || false,
    _description: opts.description || `A valid ${type} ID`,

    parse(value) {
      const result = this.safeParse(value);
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },

    safeParse(value) {
      if (value === undefined && this._optional) return { success: true, data: value };
      if (value === null      && this._nullable) return { success: true, data: value };
      if (typeof value !== 'string') {
        return { success: false, error: { message: `Expected string, got ${typeof value}` } };
      }
      if (!this._pattern.test(value)) {
        return { success: false, error: { message: `Invalid ${this._type}: "${value}"` } };
      }
      return { success: true, data: value };
    },

    optional() { return { ...this, _optional: true }; },
    nullable() { return { ...this, _nullable: true }; },
    describe(d) { return { ...this, _description: d }; },

    // JSON Schema compatible
    toJsonSchema() {
      return {
        type: 'string',
        pattern: this._pattern.source,
        description: this._description,
      };
    },
  };
  return schema;
}

// ── Joi-compatible schema builder ─────────────────────────────────────────────

/**
 * Build a Joi schema for an ID type.
 * If joi is installed: returns real Joi.string().pattern(...)
 * If not: returns lightweight compatible object.
 *
 * @param {string} type
 * @param {{ optional?, allow? }} [opts]
 */
function joiSchema(type, opts = {}) {
  const pattern = PATTERNS[type];
  if (!pattern) throw new Error(`Unknown ID type for joiSchema: "${type}"`);

  try {
    const Joi = require('joi');
    let schema = Joi.string().pattern(pattern).label(type);
    if (opts.optional) schema = schema.optional();
    if (opts.allow)    schema = schema.allow(...opts.allow);
    return schema;
  } catch {
    return _buildFallbackJoiSchema(type, pattern, opts);
  }
}

function _buildFallbackJoiSchema(type, pattern, opts) {
  return {
    _type: type,
    _pattern: pattern,
    validate(value, joiOpts = {}) {
      if (opts.optional && value === undefined) return { error: null, value };
      if (typeof value !== 'string') {
        return { error: new Error(`"${type}" must be a string`), value };
      }
      if (!pattern.test(value)) {
        return { error: new Error(`"${type}" with value "${value}" fails pattern`), value };
      }
      return { error: null, value };
    },
    optional() { return { ...this }; },
  };
}

// ── JSON Schema (OpenAPI compatible) ─────────────────────────────────────────

/**
 * Generate a JSON Schema object for an ID type.
 * Use directly in OpenAPI/Swagger specs or ajv validation.
 */
function jsonSchema(type, opts = {}) {
  const pattern = PATTERNS[type];
  if (!pattern) throw new Error(`Unknown type: ${type}`);
  return {
    type: 'string',
    pattern: pattern.source,
    description: opts.description || `A valid ${type} identifier`,
    examples: opts.examples || [],
    ...(opts.minLength ? { minLength: opts.minLength } : {}),
    ...(opts.maxLength ? { maxLength: opts.maxLength } : {}),
  };
}

/**
 * Get all built-in schema definitions as a JSON Schema $defs block.
 * Paste directly into your OpenAPI spec.
 */
function allJsonSchemas() {
  return {
    $defs: Object.fromEntries(
      Object.keys(PATTERNS).map(type => [type, jsonSchema(type)])
    ),
  };
}

module.exports = {
  // Patterns
  PATTERNS,
  // Validators
  isUUID, isUUIDv4, isUUIDv7, isULID, isNanoId,
  isCuid, isCuid2, isKSUID, isSnowflake, isPrefixed,
  isExpiring, isMongoId,
  validateAny, validateId,
  // Schema builders
  zodSchema, joiSchema, jsonSchema, allJsonSchemas,
};
