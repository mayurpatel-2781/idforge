/* eslint-env es2020 */
'use strict';

/**
 * compat.js — Database Compatibility Helpers
 *
 * MongoDB : ObjectId generation, validation, timestamp extraction
 * PostgreSQL : UUID cast helpers, index-friendly sortable IDs
 * MySQL / SQLite : Auto-increment compatible helpers
 */

const crypto = require('crypto');

// ══════════════════════════════════════════════════════════════════════════════
// MONGODB COMPATIBILITY
// ══════════════════════════════════════════════════════════════════════════════

let _objectIdCounter = crypto.randomBytes(3).readUIntBE(0, 3);
const _machineId     = crypto.randomBytes(3).toString('hex');
const _processId     = (process.pid % 0xFFFF).toString(16).padStart(4, '0');

/**
 * Generate a MongoDB-compatible ObjectId (24-char hex string).
 * Format: {4-byte timestamp}{3-byte machine}{2-byte pid}{3-byte counter}
 * @returns {string}
 */
function mongoObjectId() {
  const ts  = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
  const cnt = ((_objectIdCounter++) & 0xFFFFFF).toString(16).padStart(6, '0');
  return `${ts}${_machineId}${_processId}${cnt}`;
}

/**
 * Validate a MongoDB ObjectId.
 * @param {string} id
 * @returns {boolean}
 */
function isObjectId(id) {
  return typeof id === 'string' && /^[0-9a-f]{24}$/i.test(id);
}

/**
 * Extract the timestamp from a MongoDB ObjectId.
 * @param {string} id
 * @returns {Date}
 */
function objectIdToDate(id) {
  if (!isObjectId(id)) throw new Error('Not a valid ObjectId');
  const ts = parseInt(id.slice(0, 8), 16);
  return new Date(ts * 1000);
}

/**
 * Convert a Date to the ObjectId prefix (for range queries).
 * e.g. find all docs created after a date:
 *   { _id: { $gt: dateToObjectId(myDate) } }
 * @param {Date} date
 * @returns {string}
 */
function dateToObjectId(date) {
  const ts = Math.floor((date instanceof Date ? date : new Date(date)).getTime() / 1000);
  return ts.toString(16).padStart(8, '0') + '0'.repeat(16);
}

/**
 * MongoDB-ready ID object (mimics mongoose ObjectId interface).
 */
function createObjectId() {
  const id = mongoObjectId();
  return {
    id,
    toString()    { return id; },
    toHexString() { return id; },
    toJSON()      { return id; },
    getTimestamp(){ return objectIdToDate(id); },
    equals(other) { return String(other) === id; },
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// POSTGRESQL COMPATIBILITY
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a UUID v4 — native PostgreSQL uuid type compatible.
 * @returns {string}
 */
function pgUUID() {
  return crypto.randomUUID ? crypto.randomUUID() : _uuidV4Fallback();
}

function _uuidV4Fallback() {
  const b = crypto.randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

/**
 * Generate a UUID v7 — time-ordered, perfect for PostgreSQL primary keys.
 * Sorts correctly in B-tree indexes unlike random UUIDs.
 * @returns {string}
 */
function pgUUIDv7() {
  const b  = crypto.randomBytes(16);
  const ms = Date.now();
  b[0] = (ms / 2**40) & 0xff; b[1] = (ms / 2**32) & 0xff;
  b[2] = (ms / 2**24) & 0xff; b[3] = (ms / 2**16) & 0xff;
  b[4] = (ms / 2**8)  & 0xff; b[5] = ms & 0xff;
  b[6] = (b[6] & 0x0f) | 0x70; b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

/**
 * Cast a string to PostgreSQL uuid type format (validates + normalizes).
 * Throws if not a valid UUID.
 * @param {string} id
 * @returns {string}
 */
function pgCastUUID(id) {
  const normalized = String(id).toLowerCase().trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(normalized)) {
    throw new Error(`Cannot cast "${id}" to PostgreSQL uuid type`);
  }
  return normalized;
}

/**
 * Generate a PostgreSQL-friendly ULID.
 * ULIDs sort correctly as text in PostgreSQL (unlike UUID v4).
 * @returns {string}
 */
function pgULID() {
  const C = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const t = Date.now();
  let s = '', n = t;
  for (let i = 9; i >= 0; i--) { s = C[n % 32] + s; n = Math.floor(n / 32); }
  s = s.padStart(10, C[0]);
  const r = crypto.randomBytes(16);
  let rs = '';
  for (let i = 0; i < 16; i++) rs += C[r[i] % 32];
  return (s + rs).slice(0, 26);
}

/**
 * Generate a BIGINT-compatible snowflake ID for PostgreSQL BIGINT columns.
 * @returns {string}  (string representation of BigInt — use BigInt() in JS)
 */
function pgBigInt() {
  return (BigInt(Date.now()) << 22n | BigInt(crypto.randomBytes(3).readUIntBE(0, 3))).toString();
}

/**
 * SQL fragment helpers — returns parameterized placeholders.
 * Usage: pgInsert({ id: pgUUID(), name: 'test' })
 * → { sql: 'INSERT INTO t (id,name) VALUES ($1,$2)', values: [...] }
 */
function pgInsert(table, data) {
  const keys   = Object.keys(data);
  const values = Object.values(data);
  const cols   = keys.join(', ');
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  return {
    sql:    `INSERT INTO ${table} (${cols}) VALUES (${placeholders})`,
    values,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// MYSQL / SQLITE COMPATIBILITY
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a UUID suitable for MySQL BINARY(16) columns.
 * Stores as raw bytes for efficiency.
 * @returns {Buffer}
 */
function mysqlBinaryUUID() {
  const b = crypto.randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  return b;
}

/**
 * Convert MySQL BINARY(16) buffer back to UUID string.
 * @param {Buffer} buf
 * @returns {string}
 */
function mysqlBinaryToUUID(buf) {
  const h = buf.toString('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

/**
 * Generate a short integer-compatible ID for legacy MySQL AUTO_INCREMENT columns.
 * Produces a time-ordered 53-bit safe integer.
 * @returns {number}
 */
function mysqlSafeInt() {
  // 41-bit timestamp (ms) + 12-bit random
  const ts   = Date.now() & 0x1FFFFFFFFFF; // 41 bits
  const rand = crypto.randomInt(0, 4096);  // 12 bits
  return (ts * 4096) + rand;
}

// ══════════════════════════════════════════════════════════════════════════════
// ORM HELPERS (Prisma, TypeORM, Sequelize)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Get default field definitions for common ORM schemas.
 * @param {'prisma'|'typeorm'|'sequelize'} orm
 * @param {'uuid'|'ulid'|'cuid2'|'objectid'} idType
 */
function ormDefault(orm, idType = 'uuid') {
  const generators = {
    uuid:     () => pgUUID(),
    ulid:     () => pgULID(),
    objectid: () => mongoObjectId(),
  };

  const gen = generators[idType] || generators.uuid;

  if (orm === 'prisma') {
    return {
      comment: `Add to your Prisma schema:`,
      schema: idType === 'uuid'
        ? `id String @id @default(uuid())`
        : `id String @id @default("")  // generate in application: ${idType}()`,
      generate: gen,
    };
  }

  if (orm === 'typeorm') {
    return {
      comment: `TypeORM column decorator:`,
      decorator: idType === 'uuid'
        ? `@PrimaryGeneratedColumn('uuid')`
        : `@PrimaryColumn({ type: 'varchar', length: 26 })`,
      generate: gen,
    };
  }

  if (orm === 'sequelize') {
    return {
      comment: `Sequelize model definition:`,
      field: {
        id: {
          type: idType === 'objectid' ? 'STRING(24)' : 'STRING(36)',
          primaryKey: true,
          defaultValue: gen,
        },
      },
      generate: gen,
    };
  }

  return { generate: gen };
}

module.exports = {
  // MongoDB
  mongoObjectId,
  isObjectId,
  objectIdToDate,
  dateToObjectId,
  createObjectId,
  // PostgreSQL
  pgUUID,
  pgUUIDv7,
  pgCastUUID,
  pgULID,
  pgBigInt,
  pgInsert,
  // MySQL / SQLite
  mysqlBinaryUUID,
  mysqlBinaryToUUID,
  mysqlSafeInt,
  // ORM helpers
  ormDefault,
};
