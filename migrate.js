/* eslint-env es2020 */
'use strict';

const crypto = require('crypto');

// ── ID Migration & Versioning ─────────────────────────────────────────────────
// Wrap old IDs in a new versioned format without losing the original.
// Detect ID format/version automatically.
// Maintain a migration audit trail.

const MIGRATION_PREFIX = 'mid';
const MIGRATION_VERSION = '1';

// Registry of known ID format patterns
const _formatRegistry = new Map();
const _migrationLog = [];

/**
 * Register a named ID format for detection.
 * @param {string} name       - e.g. 'uuid-v4', 'nanoid', 'legacy-int'
 * @param {RegExp|Function} matcher
 * @param {{ version?, description? }} [meta]
 */
function registerFormat(name, matcher, meta = {}) {
  _formatRegistry.set(name, { matcher, ...meta });
}

// Built-in format detectors
registerFormat('uuid-v4',    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, { version: 4 });
registerFormat('uuid-v7',    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, { version: 7 });
registerFormat('ulid',       /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/, {});
registerFormat('nanoid',     /^[A-Za-z0-9_-]{21}$/, {});
registerFormat('snowflake',  /^\d{15,20}$/, {});
registerFormat('legacy-int', /^\d{1,10}$/, {});
registerFormat('prefixed',   /^[a-z]{2,6}_[A-Za-z0-9_-]{10,}$/, {});
registerFormat('migrated',   new RegExp(`^${MIGRATION_PREFIX}_v\\d+_`), {});

/**
 * Detect the format of an existing ID.
 * @param {string} id
 * @returns {{ format: string, meta: object } | { format: 'unknown' }}
 */
function detectFormat(id) {
  for (const [name, { matcher, ...meta }] of _formatRegistry) {
    const matched = typeof matcher === 'function' ? matcher(id) : matcher.test(id);
    if (matched) return { format: name, meta };
  }
  return { format: 'unknown', meta: {} };
}

/**
 * Migrate an old ID to a new versioned format, preserving the original.
 * The migrated ID is self-describing and reversible.
 *
 * @param {string} oldId
 * @param {{ toVersion?, reason?, secret? }} [opts]
 * @returns {{
 *   newId: string,
 *   oldId: string,
 *   oldFormat: string,
 *   version: string,
 *   timestamp: number,
 * }}
 */
function migrateId(oldId, opts = {}) {
  const { toVersion = '2', reason = 'migration', secret } = opts;

  const { format: oldFormat } = detectFormat(oldId);

  // Encode old ID as base64url to keep it safe inside the new ID
  const encoded = Buffer.from(oldId, 'utf8').toString('base64url');

  // Optional HMAC integrity tag
  let integrityTag = '';
  if (secret) {
    integrityTag = '_' + crypto
      .createHmac('sha256', secret)
      .update(`${oldId}:v${toVersion}`)
      .digest('hex')
      .slice(0, 8);
  }

  const newId = `${MIGRATION_PREFIX}_v${toVersion}_${encoded}${integrityTag}`;

  // Log migration
  const entry = {
    newId,
    oldId,
    oldFormat,
    version: toVersion,
    reason,
    timestamp: Date.now(),
  };
  _migrationLog.push(entry);

  return entry;
}

/**
 * Recover the original ID from a migrated ID.
 * @param {string} migratedId
 * @param {{ secret? }} [opts]
 * @returns {{ originalId: string, version: string, valid: boolean, integrityOk?: boolean }}
 */
function recoverOriginal(migratedId, opts = {}) {
  const { secret } = opts;

  const match = migratedId.match(new RegExp(`^${MIGRATION_PREFIX}_v(\\d+)_([A-Za-z0-9_-]+?)(?:_([0-9a-f]{8}))?$`));
  if (!match) {
    return { originalId: null, version: null, valid: false };
  }

  const [, version, encoded, givenTag] = match;

  let originalId;
  try {
    originalId = Buffer.from(encoded, 'base64url').toString('utf8');
  } catch {
    return { originalId: null, version, valid: false };
  }

  const result = { originalId, version, valid: true };

  if (secret && givenTag) {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${originalId}:v${version}`)
      .digest('hex')
      .slice(0, 8);
    result.integrityOk = givenTag === expected;
  }

  return result;
}

/**
 * Batch migrate an array of old IDs.
 * @param {string[]} ids
 * @param {{ toVersion?, reason?, secret? }} [opts]
 * @returns {Array<{ newId, oldId, oldFormat, version, timestamp }>}
 */
function batchMigrate(ids, opts = {}) {
  return ids.map(id => migrateId(id, opts));
}

/**
 * Check if an ID is already in migrated format.
 * @param {string} id
 * @returns {boolean}
 */
function isMigrated(id) {
  return id.startsWith(`${MIGRATION_PREFIX}_v`);
}

/**
 * Get the full migration audit log.
 * @param {{ limit? }} [opts]
 * @returns {object[]}
 */
function getMigrationLog(opts = {}) {
  const { limit } = opts;
  const log = [..._migrationLog].reverse(); // most recent first
  return limit ? log.slice(0, limit) : log;
}

/**
 * Clear the migration log (useful for testing).
 */
function clearMigrationLog() {
  _migrationLog.length = 0;
}

module.exports = {
  migrateId,
  recoverOriginal,
  batchMigrate,
  isMigrated,
  detectFormat,
  registerFormat,
  getMigrationLog,
  clearMigrationLog,
};
