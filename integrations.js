/* eslint-env es2020 */
'use strict';

/**
 * integrations.js — Ecosystem & Integrations
 * ──────────────────────────────────────────
 * Provides ready-to-use middleware and adapters for Express,
 * MongoDB (Mongoose), PostgreSQL (Sequelize), and GraphQL.
 */

const crypto = require('crypto');
const { nanoId } = require('./generators');

function _uuidV4() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

// ── Express Middleware ────────────────────────────────────────────────────────

/**
 * Express middleware that adds a unique Request ID (correlation ID) to
 * every incoming request and outgoing response header.
 * 
 * @param {{ headerName?: string, generator?: Function }} opts
 * @returns {Function} Express middleware (req, res, next)
 */
function expressMiddleware(opts = {}) {
  const headerName = opts.headerName || 'X-Request-Id';
  const generator = opts.generator || (() => nanoId());

  return function uuidLabMiddleware(req, res, next) {
    // Use existing header if present, otherwise generate new
    const reqId = req.headers[headerName.toLowerCase()] || generator();
    
    // Attach to request object for downstream use
    req.id = reqId;
    req.correlationId = reqId;

    // Set header on response
    res.setHeader(headerName, reqId);
    
    next();
  };
}

// ── Database Adapters ─────────────────────────────────────────────────────────

/**
 * Mongoose Plugin to automatically assign a unique ID to a specified field.
 * 
 * Usage:
 *   const schema = new mongoose.Schema({ ... });
 *   schema.plugin(mongoosePlugin, { field: '_id', generator: nanoId });
 * 
 * @param {object} schema Mongoose schema
 * @param {{ field?: string, generator?: Function }} opts
 */
function mongoosePlugin(schema, opts = {}) {
  const field = opts.field || '_id';
  const generator = opts.generator || (() => nanoId());

  // Add the field to the schema if it doesn't exist
  if (!schema.path(field)) {
    schema.add({ [field]: { type: String, unique: true } });
  }

  // Pre-validate hook to generate the ID
  schema.pre('validate', function(next) {
    if (this.isNew && !this[field]) {
      this[field] = generator();
    }
    next();
  });
}

/**
 * Helper for Sequelize models to define an ID column with an automatic generator.
 * 
 * Usage:
 *   const User = sequelize.define('User', {
 *     id: sequelizeAdapter(DataTypes.STRING, { generator: uuidV4 })
 *   });
 * 
 * @param {object} dataType Sequelize DataType (e.g. DataTypes.STRING)
 * @param {{ generator?: Function }} opts
 * @returns {object} Column definition
 */
function sequelizeAdapter(dataType, opts = {}) {
  const generator = opts.generator || (() => _uuidV4());
  
  return {
    type: dataType,
    primaryKey: true,
    defaultValue: () => generator(),
  };
}

// ── GraphQL Integration ───────────────────────────────────────────────────────

/**
 * Creates a custom GraphQL Scalar Type for validating specific ID formats.
 * Note: Requires `graphql` module to be installed by the user.
 * 
 * Usage:
 *   const UuidScalar = createGraphQLScalar('UUID', validateUUID);
 * 
 * @param {string} name Scalar name
 * @param {Function} validatorFn Function returning boolean
 * @param {string} description Description of the scalar
 * @returns {object} GraphQLScalarType definition object (duck-typed)
 */
function createGraphQLScalar(name, validatorFn, description = 'Custom ID Scalar') {
  // We return an object that matches the GraphQLScalarType config structure.
  // The user will pass this into `new GraphQLScalarType(config)`.
  return {
    name,
    description,
    serialize(value) {
      if (typeof value !== 'string') throw new TypeError(`${name} cannot represent non-string value`);
      if (!validatorFn(value)) throw new TypeError(`Value is not a valid ${name}: ${value}`);
      return value;
    },
    parseValue(value) {
      if (typeof value !== 'string') throw new TypeError(`${name} cannot represent non-string value`);
      if (!validatorFn(value)) throw new TypeError(`Value is not a valid ${name}: ${value}`);
      return value;
    },
    parseLiteral(ast) {
      // Kind.STRING is 'StringValue' in graphql-js
      if (ast.kind === 'StringValue') {
        if (validatorFn(ast.value)) return ast.value;
        throw new TypeError(`Value is not a valid ${name}`);
      }
      return null;
    }
  };
}

module.exports = {
  expressMiddleware,
  mongoosePlugin,
  sequelizeAdapter,
  createGraphQLScalar,
};
