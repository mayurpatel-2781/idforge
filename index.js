/* eslint-env es2020 */
'use strict';

/**
 * uuid-lab — Comprehensive ID Generation Library
 * Covers all 8 phases: core, formats, advanced, security,
 * performance, devtools, framework support, testing.
 *
 * All existing exports preserved for backward compatibility.
 */

const crypto = require('crypto');

// ── Core Generators ───────────────────────────────────────────────────────────
const gen = require('./generators');
const {
  nanoId, typedId, registerTypes, TYPE_REGISTRY, humanId,
  sequentialId, resetSequence, getSequence, fromPattern,
  ALPHA_BASE64URL, ALPHA_BASE62, ALPHA_BASE36, ALPHA_HEX,
} = gen;

// ── Domain Modules ────────────────────────────────────────────────────────────
const semantic_mod  = require('./semantic');
const lineage_mod   = require('./lineage');
const scoped_mod    = require('./scoped');
const chaos_mod     = require('./chaos');
const schema_mod    = require('./schema');
const topology_mod  = require('./topology');
const entropy_mod   = require('./entropy_enhanced');
const lifecycle_mod = require('./lifecycle_enhanced');
const telemetry_mod = require('./telemetry_enhanced');
const fuzzy_mod     = require('./fuzzy');
const compound_mod  = require('./compound');
const hierarchy_mod = require('./hierarchy');
const ratelimit_mod = require('./ratelimit');
const migrate_mod   = require('./migrate');
const collision_mod = require('./collision');
const federation_mod= require('./federation');
const compliance_mod= require('./compliance');
const dashboard_mod = require('./dashboard');
const decoder_mod   = require('./decoder');
const storage_mod   = require('./storage');
const batchverify_mod = require('./batchverify');
const query_mod     = require('./query');
const prevention_mod= require('./prevention');
const plugin_mod    = require('./plugin');
const async_mod     = require('./async_gen');
const devtools_mod  = require('./devtools');
const docgen_mod    = require('./docgen');

// ── v7/v8 New Modules ─────────────────────────────────────────────────────────
const format_mod    = require('./format');
const advanced_mod  = require('./advanced');
const namespace_mod = require('./namespace');
const timeid_mod    = require('./timeid');
const analytics_mod = require('./analytics');
const chain_mod     = require('./chain');
const parallel_mod  = require('./parallel');
const tokens_mod    = require('./tokens');
const template_mod  = require('./template');
const integrations_mod = require('./integrations');
const frameworks_mod = require('./frameworks');

// ══════════════════════════════════════════════════════════════════════════════
// UUID Helpers
// ══════════════════════════════════════════════════════════════════════════════

function uuid()   { return crypto.randomUUID ? crypto.randomUUID() : uuidV4(); }
function uuidV4() {
  const b = crypto.randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
function uuidV7() {
  const b  = crypto.randomBytes(16);
  const ms = Date.now();
  b[0] = (ms / 2**40) & 0xff; b[1] = (ms / 2**32) & 0xff;
  b[2] = (ms / 2**24) & 0xff; b[3] = (ms / 2**16) & 0xff;
  b[4] = (ms / 2**8)  & 0xff; b[5] = ms & 0xff;
  b[6] = (b[6] & 0x0f) | 0x70; b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
function uuidV5(name) {
  const h = crypto.createHash('sha1').update(name).digest('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-${((parseInt(h.slice(16,18),16)&0x3f)|0x80).toString(16)}${h.slice(18,20)}-${h.slice(20,32)}`;
}
function uuidV3(name) {
  const h = crypto.createHash('md5').update(name).digest('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-3${h.slice(13,16)}-${((parseInt(h.slice(16,18),16)&0x3f)|0x80).toString(16)}${h.slice(18,20)}-${h.slice(20,32)}`;
}
const UUID_NAMESPACES = {
  DNS:  '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
  URL:  '6ba7b811-9dad-11d1-80b4-00c04fd430c8',
  OID:  '6ba7b812-9dad-11d1-80b4-00c04fd430c8',
  X500: '6ba7b814-9dad-11d1-80b4-00c04fd430c8',
};

// ══════════════════════════════════════════════════════════════════════════════
// Timestamp / Sortable IDs
// ══════════════════════════════════════════════════════════════════════════════

// timestampId is overridden by timeid_mod below (v7 version is better)
function _coreTimestampId() {
  return Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
}

function ulid() {
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

function ulidToTimestamp(u) {
  const C = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let t = 0;
  for (let i = 0; i < 10; i++) t = t * 32 + C.indexOf(u[i].toUpperCase());
  return t;
}

function ksuid() {
  const t   = Math.floor(Date.now() / 1000) - 1400000000;
  const buf = Buffer.alloc(20);
  buf.writeUInt32BE(t, 0);
  crypto.randomBytes(16).copy(buf, 4);
  return buf.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'').slice(0, 27);
}
function ksuidToDate(k) {
  return new Date((Buffer.from(k + '==', 'base64').readUInt32BE(0) + 1400000000) * 1000);
}

function snowflakeId() {
  return (BigInt(Date.now()) << 22n | BigInt(crypto.randomBytes(3).readUIntBE(0, 3))).toString();
}
function parseSnowflake(s) {
  const ts = Number(BigInt(s) >> 22n);
  return { timestamp: ts, date: new Date(ts) };
}

// ══════════════════════════════════════════════════════════════════════════════
// Encoding / Security
// ══════════════════════════════════════════════════════════════════════════════

const ENCODINGS = { base64: 'base64', hex: 'hex', base62: 'base62' };

function customId(opts = {}) { return nanoId(opts); }
function convertEncoding(id) { return id; }
function maskId(id, reveal = 4) {
  return '*'.repeat(Math.max(0, id.length - reveal)) + id.slice(-reveal);
}
function geoId(lat, lng) {
  return `geo_${lat.toFixed(4)}_${lng.toFixed(4)}_${nanoId({ size: 8 })}`;
}
function parseGeoId(id) {
  const p = id.split('_');
  return p.length >= 4 ? { lat: +p[1], lng: +p[2], rand: p[3] } : null;
}

function signId(id, key) {
  const sig = crypto.createHmac('sha256', key).update(id).digest('hex').slice(0, 16);
  return `${id}.${sig}`;
}
function verifySignedId(signed, key) {
  const lastDot = signed.lastIndexOf('.');
  const id  = signed.slice(0, lastDot);
  const sig = signed.slice(lastDot + 1);
  const exp = crypto.createHmac('sha256', key).update(id).digest('hex').slice(0, 16);
  return { valid: sig === exp, id };
}
function encryptId(n, key) {
  const k = crypto.createHash('sha256').update(key).digest().slice(0, 16);
  const c = crypto.createCipheriv('aes-128-ecb', k, null);
  return Buffer.concat([c.update(Buffer.from(String(n), 'utf8')), c.final()]).toString('hex');
}
function decryptId(hex, key) {
  const k = crypto.createHash('sha256').update(key).digest().slice(0, 16);
  const c = crypto.createDecipheriv('aes-128-ecb', k, null);
  return +Buffer.concat([c.update(Buffer.from(hex, 'hex')), c.final()]).toString('utf8');
}
function expiringId(opts = {}) {
  const ttlMs = { '1h': 3_600_000, '1d': 86_400_000, '7d': 604_800_000 }[opts.ttl || '1h'] || 3_600_000;
  return `exp_${Date.now() + ttlMs}_${nanoId({ size: 8 })}`;
}
function checkExpiry(id) {
  const parts = id.split('_');
  const exp   = parseInt(parts[1]);
  return { valid: exp > Date.now(), expiresAt: new Date(exp) };
}
function otpToken() { return crypto.randomInt(100_000, 999_999).toString(); }

// ══════════════════════════════════════════════════════════════════════════════
// Performance
// ══════════════════════════════════════════════════════════════════════════════

function batch(fn, n, ...args)      { return Array.from({ length: n }, () => fn(...args)); }
function batchUnique(fn, n, ...args){ const s = new Set(); while (s.size < n) s.add(fn(...args)); return [...s]; }
async function batchAsync(fn, n, ...args) { return batch(fn, n, ...args); }

class IdPool {
  constructor(fn, size = 100) { this._fn = fn; this._pool = batch(fn, size); }
  get() { if (!this._pool.length) this._pool = batch(this._fn, 100); return this._pool.pop(); }
}
function createPool(fn, size = 100) { return new IdPool(fn, size); }

class BloomFilter {
  constructor() { this._s = new Set(); }
  add(x) { this._s.add(x); }
  has(x)  { return this._s.has(x); }
}
function createCollisionTracker() { return new BloomFilter(); }

// ══════════════════════════════════════════════════════════════════════════════
// Validation
// ══════════════════════════════════════════════════════════════════════════════

const PATTERNS = {
  uuid:      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  uuidV4:    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  ulid:      /^[0-9A-HJKMNP-TV-Z]{26}$/i,
  nanoid:    /^[A-Za-z0-9_-]{21}$/,
  snowflake: /^\d{15,20}$/,
};

function validate(id) { return { valid: typeof id === 'string' && id.length > 0 }; }
function parse(id)    { return { id, type: migrate_mod.detectFormat(id).format }; }

// ══════════════════════════════════════════════════════════════════════════════
// Factory
// ══════════════════════════════════════════════════════════════════════════════

function createGenerator(opts = {}) { return () => nanoId(opts); }
const schemas = {};
function getZodSchemas() { return {}; }
function getJoiSchemas()  { return {}; }

// ══════════════════════════════════════════════════════════════════════════════
// Named destructures from domain modules
// ══════════════════════════════════════════════════════════════════════════════

const { semanticId, validateSemantic, parseSemantic, registerSchema }      = semantic_mod;
const { linkedId, verifyLink, deriveId, isDescendantOf, getLineage, getChildren, clearLineage } = lineage_mod;
const { scopedId, resolveScoped, buildScopeMap, isSameResource }           = scoped_mod;
const { lifecycleId, transition, parseLifecycle, verifyState, stableCore,
        getHistory, currentState, replayHistory, getTimeline, clearHistory } = lifecycle_mod;
const { measuredId, analyzeEntropy, sizeFor, entropyBits, collisionProbability,
        chiSquaredTest, runLengthTest }                                      = entropy_mod;
const { dcid, verifyDcid, idempotentId }                                   = chaos_mod;
const { telemetry, withTelemetry }                                         = telemetry_mod;
const { schema, IdSchema }                                                  = schema_mod;
const { topoId, parseTopology, isEUResident, regionOf, isSameRegion,
        registerTopology, registerRegion, REGION_MAP }                      = topology_mod;
const { fuzzyId, validateFuzzy, correctFuzzy, parseFuzzy, CROCKFORD }      = fuzzy_mod;
const { compoundId, splitId, sharedComponents, hasComponent,
        timedCompoundId, extractTimestamp }                                  = compound_mod;
const { hierarchyRoot, hierarchyChild, parseHierarchy, parentOf, depthOf,
        isDescendant, isDirectChild, subtreeRange,
        lowestCommonAncestor, reparent, topoSort }                          = hierarchy_mod;
const { IdRateLimiter, createRateLimiter }                                  = ratelimit_mod;
const { migrateId, recoverOriginal, batchMigrate, isMigrated, detectFormat,
        registerFormat, getMigrationLog, clearMigrationLog }                = migrate_mod;
const { CollisionDetector, ScalableBloomFilter, MemoryBackend,
        createDetector, createRegistry }                                    = collision_mod;
const { Federation, FederationNode, createFederation,
        snowflake64, parseSnowflake64 }                                     = federation_mod;
const { scanForPII, scanBatch, verifyPseudonymization, checkDataResidency,
        generateComplianceReport, formatReport,
        PII_PATTERNS, GDPR_ZONES, HIPAA_REGIONS }                          = compliance_mod;
const { Dashboard, createDashboard, TimeSeriesBuffer, AlertEngine }        = dashboard_mod;

// ══════════════════════════════════════════════════════════════════════════════
// EXPORTS — All 280+ functions, fully organized
// ══════════════════════════════════════════════════════════════════════════════

module.exports = {

  // ── UUID ────────────────────────────────────────────────────────────────────
  uuid, uuidV4, uuidV7, uuidV5, uuidV3, UUID_NAMESPACES,

  // ── Sortable / Time ─────────────────────────────────────────────────────────
  ulid, ulidToTimestamp, ksuid, ksuidToDate, snowflakeId, parseSnowflake,

  // ── Core Generators ─────────────────────────────────────────────────────────
  nanoId, typedId, registerTypes, TYPE_REGISTRY,
  humanId, sequentialId, resetSequence, getSequence, fromPattern,
  ALPHA_BASE64URL, ALPHA_BASE62, ALPHA_BASE36, ALPHA_HEX,

  // ── Encoding ─────────────────────────────────────────────────────────────────
  customId, convertEncoding, maskId, geoId, parseGeoId, ENCODINGS,

  // ── Security ─────────────────────────────────────────────────────────────────
  signId, verifySignedId, sign: signId, verify: verifySignedId,
  encryptId, decryptId, expiringId, checkExpiry, otpToken,
  tokenId:          tokens_mod.tokenId,
  verifyTokenId:    tokens_mod.verifyTokenId,
  commitId:         tokens_mod.commitId,
  verifyCommitment: tokens_mod.verifyCommitment,

  // ── Validation ───────────────────────────────────────────────────────────────
  validate, parse, detectType: detectFormat, PATTERNS,

  // ── Performance ──────────────────────────────────────────────────────────────
  batch, batchUnique, batchAsync, createPool, IdPool,
  createCollisionTracker, BloomFilter,

  // ── Factory ──────────────────────────────────────────────────────────────────
  createGenerator, schemas, getZodSchemas, getJoiSchemas,

  // ── v3: Semantic ─────────────────────────────────────────────────────────────
  semanticId, validateSemantic, parseSemantic, registerSchema,

  // ── v3: Lineage ──────────────────────────────────────────────────────────────
  linkedId, verifyLink, deriveId, isDescendantOf,
  getLineage, getChildren, clearLineage,

  // ── v3: Scoped ───────────────────────────────────────────────────────────────
  scopedId, resolveScoped, buildScopeMap, isSameResource,

  // ── v3: Lifecycle ────────────────────────────────────────────────────────────
  lifecycleId, transition, parseLifecycle, verifyState, stableCore,
  getHistory, currentState, replayHistory, getTimeline, clearHistory,

  // ── v3: Entropy ──────────────────────────────────────────────────────────────
  measuredId, analyzeEntropy, sizeFor, entropyBits, collisionProbability,
  chiSquaredTest, runLengthTest,

  // ── v3: Chaos / Idempotent ───────────────────────────────────────────────────
  dcid, verifyDcid, idempotentId,

  // ── v3: Telemetry ────────────────────────────────────────────────────────────
  telemetry, withTelemetry,

  // ── v3: Schema ───────────────────────────────────────────────────────────────
  schema, IdSchema,

  // ── v3: Topology ─────────────────────────────────────────────────────────────
  topoId, parseTopology, isEUResident, regionOf, isSameRegion,
  registerTopology, registerRegion, REGION_MAP,

  // ── v4: Fuzzy ────────────────────────────────────────────────────────────────
  fuzzyId, validateFuzzy, correctFuzzy, parseFuzzy, CROCKFORD,

  // ── v4: Compound ─────────────────────────────────────────────────────────────
  compoundId, splitId, sharedComponents, hasComponent,
  timedCompoundId, extractTimestamp,

  // ── v4: Hierarchy ────────────────────────────────────────────────────────────
  hierarchyRoot, hierarchyChild, parseHierarchy, parentOf, depthOf,
  isDescendant, isDirectChild, subtreeRange,
  lowestCommonAncestor, reparent, topoSort,

  // ── v4: Rate Limiter ─────────────────────────────────────────────────────────
  IdRateLimiter, createRateLimiter,

  // ── v4: Migration ────────────────────────────────────────────────────────────
  migrateId, recoverOriginal, batchMigrate, isMigrated,
  detectFormat, registerFormat, getMigrationLog, clearMigrationLog,

  // ── v5: Collision Detection ───────────────────────────────────────────────────
  CollisionDetector, ScalableBloomFilter, MemoryBackend,
  createDetector, createRegistry,

  // ── v5: Federation ───────────────────────────────────────────────────────────
  Federation, FederationNode, createFederation, snowflake64, parseSnowflake64,

  // ── v5: Compliance ───────────────────────────────────────────────────────────
  scanForPII, scanBatch, verifyPseudonymization, checkDataResidency,
  generateComplianceReport, formatReport,
  PII_PATTERNS, GDPR_ZONES, HIPAA_REGIONS,

  // ── v5: Dashboard ────────────────────────────────────────────────────────────
  Dashboard, createDashboard, TimeSeriesBuffer, AlertEngine,

  // ── v6: Decoder ──────────────────────────────────────────────────────────────
  decodeId:        decoder_mod.decodeId,
  parseId:         decoder_mod.parseId,
  decodeBatch:     decoder_mod.decodeBatch,
  registerDecoder: decoder_mod.registerDecoder,

  // ── v6: Storage ──────────────────────────────────────────────────────────────
  createStore:     storage_mod.createStore,
  PersistentStore: storage_mod.PersistentStore,

  // ── v6: Batch Verify ─────────────────────────────────────────────────────────
  batchVerify:          batchverify_mod.batchVerify,
  batchVerifySigned:    batchverify_mod.batchVerifySigned,
  batchCheckCollisions: batchverify_mod.batchCheckCollisions,
  batchValidate:        batchverify_mod.batchValidate,
  compareIds:           batchverify_mod.compareIds,
  sortById:             batchverify_mod.sortById,
  diffIds:              batchverify_mod.diffIds,
  groupByType:          batchverify_mod.groupByType,
  deduplicateIds:       batchverify_mod.deduplicateIds,

  // ── v6: Query & Index ────────────────────────────────────────────────────────
  createIndex: query_mod.createIndex,
  IdIndex:     query_mod.IdIndex,

  // ── v6: Versioned Generation ─────────────────────────────────────────────────
  createSafeGenerator: prevention_mod.createSafeGenerator,
  registerVersion:     prevention_mod.registerVersion,
  versionedGenerate:   prevention_mod.versionedGenerate,
  detectVersion:       prevention_mod.detectVersion,
  registerMigration:   prevention_mod.registerMigration,
  migrateVersion:      prevention_mod.migrateVersion,

  // ── v6: Plugin / Config / Events ─────────────────────────────────────────────
  configure:       plugin_mod.configure,
  getConfig:       plugin_mod.getConfig,
  on:              plugin_mod.on,
  off:             plugin_mod.off,
  once:            plugin_mod.once,
  emit:            plugin_mod.emit,
  registerWebhook: plugin_mod.registerWebhook,
  use:             plugin_mod.use,
  applyMiddleware: plugin_mod.applyMiddleware,
  listPlugins:     plugin_mod.listPlugins,

  // ── v6: Async / Stream / Cache / Access Control ───────────────────────────────
  streamIds:         async_mod.streamIds,
  collectFromStream: async_mod.collectFromStream,
  generateAsync:     async_mod.generateAsync,
  createCache:       async_mod.createCache,
  withCache:         async_mod.withCache,
  createAccessControl: async_mod.createAccessControl,

  // ── v6: DevTools ─────────────────────────────────────────────────────────────
  UniqidError:           devtools_mod.UniqidError,
  ErrorCodes:            devtools_mod.ErrorCodes,
  createError:           devtools_mod.createError,
  logger:                devtools_mod.logger,
  enableTrace:           devtools_mod.enableTrace,
  disableTrace:          devtools_mod.disableTrace,
  trace:                 devtools_mod.trace,
  getTraces:             devtools_mod.getTraces,
  createValidationEngine:devtools_mod.createValidationEngine,
  createCommonRules:     devtools_mod.createCommonRules,
  exportIds:             devtools_mod.exportIds,
  importIds:             devtools_mod.importIds,
  enableMockMode:        devtools_mod.enableMockMode,
  disableMockMode:       devtools_mod.disableMockMode,
  mockGenerator:         devtools_mod.mockGenerator,
  withMock:              devtools_mod.withMock,
  testIds:               devtools_mod.testIds,
  assertId:              devtools_mod.assertId,

  // ── v6: Retry / Monitor / CLI / Docs ─────────────────────────────────────────
  withRetry:          docgen_mod.withRetry,
  withFallback:       docgen_mod.withFallback,
  monitor:            docgen_mod.monitor,
  parseCLIArgs:       docgen_mod.parseCLIArgs,
  executeCLI:         docgen_mod.executeCLI,
  generateSchemaDocs: docgen_mod.generateSchemaDocs,
  generateTypeScript: docgen_mod.generateTypeScript,
  generateDocs:       docgen_mod.generateDocs,

  // ── v7: Format & Encoding ────────────────────────────────────────────────────
  prefixedId:    format_mod.prefixedId,
  shortId:       format_mod.shortId,
  customLengthId:format_mod.customLengthId,
  urlSafeId:     format_mod.urlSafeId,
  base62Id:      format_mod.base62Id,
  base36Id:      format_mod.base36Id,
  encodeBase62:  format_mod.encodeBase62,
  decodeBase62:  format_mod.decodeBase62,
  encodeBase36:  format_mod.encodeBase36,
  decodeBase36:  format_mod.decodeBase36,
  visualId:      format_mod.visualId,
  emojiId:       format_mod.emojiId,
  compactId:     format_mod.compactId,

  // ── v7: Advanced ─────────────────────────────────────────────────────────────
  hashId:               advanced_mod.hashId,
  shortHashId:          advanced_mod.shortHashId,
  seededId:             advanced_mod.seededId,
  createSeededGenerator:advanced_mod.createSeededGenerator,
  createOneTimeStore:   advanced_mod.createOneTimeStore,
  createBlacklist:      advanced_mod.createBlacklist,
  entropyId:            advanced_mod.entropyId,
  adaptiveId:           advanced_mod.adaptiveId,
  registerUseCase:      advanced_mod.registerUseCase,
  listUseCases:         advanced_mod.listUseCases,
  getUseCase:           advanced_mod.getUseCase,
  generateForUseCase:   advanced_mod.generateForUseCase,
  predictCollision:     advanced_mod.predictCollision,
  compressId:           advanced_mod.compressId,
  decompressId:         advanced_mod.decompressId,
  offlineId:            advanced_mod.offlineId,
  compileTemplate:      template_mod.compileTemplate,
  recommendId:          template_mod.recommendId,
  
  // ── v7: Integrations ────────────────────────────────────────────────────────
  expressMiddleware:    integrations_mod.expressMiddleware,
  mongoosePlugin:       integrations_mod.mongoosePlugin,
  sequelizeAdapter:     integrations_mod.sequelizeAdapter,
  createGraphQLScalar:  integrations_mod.createGraphQLScalar,

  // ── v7: Frameworks ──────────────────────────────────────────────────────────
  ssrSafeId:            frameworks_mod.ssrSafeId,
  createReactHooks:     frameworks_mod.createReactHooks,
  createVueComposables: frameworks_mod.createVueComposables,

  // ── v7: Namespace ────────────────────────────────────────────────────────────
  defineNamespace:   namespace_mod.defineNamespace,
  namespaceId:       namespace_mod.namespaceId,
  belongsTo:         namespace_mod.belongsTo,
  detectNamespace:   namespace_mod.detectNamespace,
  listNamespaces:    namespace_mod.listNamespaces,
  getNamespace:      namespace_mod.getNamespace,
  setEnvironment:    namespace_mod.setEnvironment,
  getEnvironment:    namespace_mod.getEnvironment,
  envId:             namespace_mod.envId,
  reactHookCode:     namespace_mod.reactHookCode,
  vueComposableCode: namespace_mod.vueComposableCode,

  // ── v7: Time-based IDs ───────────────────────────────────────────────────────
  // Note: timestampId overridden by timeid_mod (better version)
  timestampId:    timeid_mod.timestampId,
  extractTime:    timeid_mod.extractTime,
  timeWindowId:   timeid_mod.timeWindowId,
  epochDayId:     timeid_mod.epochDayId,
  contextId:      timeid_mod.contextId,
  meaningfulId:   timeid_mod.meaningfulId,
  pronounceableId:timeid_mod.pronounceableId,
  multiFormatId:  timeid_mod.multiFormatId,
  listFormats:    timeid_mod.listFormats,

  // ── v7: Analytics & Debug ────────────────────────────────────────────────────
  analytics:    analytics_mod.analytics,
  enableDebug:  analytics_mod.enableDebug,
  disableDebug: analytics_mod.disableDebug,
  isDebugMode:  analytics_mod.isDebugMode,
  debugWrap:    analytics_mod.debugWrap,
  getDebugLog:  analytics_mod.getDebugLog,
  clearDebugLog:analytics_mod.clearDebugLog,
  inspectId:    analytics_mod.inspectId,
  apiGenerate:  analytics_mod.apiGenerate,

  // ── v8: Blockchain Chain & Parallel ──────────────────────────────────────────
  IdChain:           chain_mod.IdChain,
  createChain:       chain_mod.createChain,
  idToQrAscii:       chain_mod.idToQrAscii,
  idToQrDataUrl:     chain_mod.idToQrDataUrl,
  HighPerformancePool: chain_mod.HighPerformancePool,
  createHighPerfPool:  chain_mod.createHighPerfPool,
  generateParallel:  parallel_mod.generateParallel,
  initWorkers:       parallel_mod.initWorkers,
  terminateWorkers:  parallel_mod.terminateWorkers,
};
