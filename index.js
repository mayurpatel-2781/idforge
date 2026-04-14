/* eslint-env es2020 */
'use strict';

/**
 * uuid-lab v4.0.0
 * v4 adds 7 new features:
 *   1. Fuzzy / Typo-Resistant IDs  (Crockford Base32 + Luhn checksum + auto-correct)
 *   2. Composite / Compound IDs    (reversible multi-ID encoding for join tables)
 *   3. Hierarchical / Path IDs     (materialized path IDs for trees, prefix queries)
 *   4. ID Rate Limiter             (token-bucket per-key throttling)
 *   5. ID Migration & Versioning   (format detection, reversible migration, audit log)
 *   6. Real Randomness Testing     (chi-squared + run-length tests on existing IDs)
 *   7. Lifecycle History & Replay  (full audit trail, timeline, state replay)
 *   + Enhanced Telemetry:          p50/p75/p95/p99 latency percentiles + histogram
 */

const crypto = require('crypto');

// ── Generators ──────────────────────────────────────────────────────────────────
const { nanoId, typedId, registerTypes, TYPE_REGISTRY, humanId, sequentialId, resetSequence, getSequence, fromPattern } = require('./generators');

// ── v3 modules ─────────────────────────────────────────────────────────────────
const semantic_mod  = require('./semantic');
const lineage_mod   = require('./lineage');
const scoped_mod    = require('./scoped');
const chaos_mod     = require('./chaos');
const schema_mod    = require('./schema');
const topology_mod  = require('./topology');

// ── v3 enhanced modules ────────────────────────────────────────────────────────
const entropy_mod   = require('./entropy_enhanced');
const lifecycle_mod = require('./lifecycle_enhanced');
const telemetry_mod = require('./telemetry_enhanced');

// ── v4 new modules ─────────────────────────────────────────────────────────────
const fuzzy_mod     = require('./fuzzy');
const compound_mod  = require('./compound');
const hierarchy_mod = require('./hierarchy');
const ratelimit_mod = require('./ratelimit');
const migrate_mod   = require('./migrate');

// ── UUID helpers ────────────────────────────────────────────────────────────────
function uuid()  { return crypto.randomUUID ? crypto.randomUUID() : uuidV4(); }
function uuidV4(){ const b=crypto.randomBytes(16); b[6]=(b[6]&0x0f)|0x40; b[8]=(b[8]&0x3f)|0x80; const h=b.toString('hex'); return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`; }
function uuidV7(){ const b=crypto.randomBytes(16); const ms=Date.now(); b[0]=(ms/Math.pow(2,40))&0xff; b[1]=(ms/Math.pow(2,32))&0xff; b[2]=(ms/Math.pow(2,24))&0xff; b[3]=(ms/Math.pow(2,16))&0xff; b[4]=(ms/Math.pow(2,8))&0xff; b[5]=ms&0xff; b[6]=(b[6]&0x0f)|0x70; b[8]=(b[8]&0x3f)|0x80; const h=b.toString('hex'); return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`; }
function uuidV5(name){ const h=crypto.createHash('sha1').update(name).digest('hex'); return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-${((parseInt(h.slice(16,18),16)&0x3f)|0x80).toString(16)}${h.slice(18,20)}-${h.slice(20,32)}`; }
function uuidV3(name){ const h=crypto.createHash('md5').update(name).digest('hex'); return `${h.slice(0,8)}-${h.slice(8,12)}-3${h.slice(13,16)}-${((parseInt(h.slice(16,18),16)&0x3f)|0x80).toString(16)}${h.slice(18,20)}-${h.slice(20,32)}`; }
const UUID_NAMESPACES = {};

// ── Timestamp helpers ───────────────────────────────────────────────────────────
function timestampId(){ return Date.now().toString(36)+crypto.randomBytes(4).toString('hex'); }
function ulid(){ const t=Date.now(); let s=''; const C='0123456789ABCDEFGHJKMNPQRSTVWXYZ'; let n=t; for(let i=9;i>=0;i--){s=C[n%32]+s;n=Math.floor(n/32);} s=s.padStart(10,C[0]); const r=crypto.randomBytes(16); let rs=''; for(let i=0;i<16;i++)rs+=C[r[i]%32]; return (s+rs).slice(0,26); }
function ulidToTimestamp(u){ const C='0123456789ABCDEFGHJKMNPQRSTVWXYZ'; let t=0; for(let i=0;i<10;i++)t=t*32+C.indexOf(u[i]); return t; }
function ksuid(){ const t=Math.floor(Date.now()/1000)-1400000000; const buf=Buffer.alloc(20); buf.writeUInt32BE(t,0); crypto.randomBytes(16).copy(buf,4); return buf.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'').slice(0,27); }
function ksuidToDate(k){ return new Date((Buffer.from(k+'==','base64').readUInt32BE(0)+1400000000)*1000); }
function snowflakeId(){ return (BigInt(Date.now())<<BigInt(22)|BigInt(crypto.randomBytes(3).readUIntBE(0,3))).toString(); }
function parseSnowflake(s){ const ts=Number(BigInt(s)>>BigInt(22)); return { timestamp:ts, date:new Date(ts) }; }

// ── Encoding helpers ────────────────────────────────────────────────────────────
const ENCODINGS = { base64:'base64', hex:'hex', base62:'base62' };
function customId(opts={}){ return nanoId(opts); }
function convertEncoding(id){ return id; }
function maskId(id,reveal=4){ return '*'.repeat(Math.max(0,id.length-reveal))+id.slice(-reveal); }
function geoId(lat,lng){ return `geo_${lat.toFixed(4)}_${lng.toFixed(4)}_${nanoId({size:8})}`; }
function parseGeoId(id){ const p=id.split('_'); return p.length>=4?{lat:+p[1],lng:+p[2],rand:p[3]}:null; }

// ── Security helpers ────────────────────────────────────────────────────────────
function signId(id,key){ const sig=crypto.createHmac('sha256',key).update(id).digest('hex').slice(0,16); return `${id}.${sig}`; }
function verifySignedId(signed,key){ const lastDot=signed.lastIndexOf('.'); const id=signed.slice(0,lastDot); const sig=signed.slice(lastDot+1); const exp=crypto.createHmac('sha256',key).update(id).digest('hex').slice(0,16); return {valid:sig===exp,id}; }
function encryptId(n,key){ const k=crypto.createHash('sha256').update(key).digest().slice(0,16); const c=crypto.createCipheriv('aes-128-ecb',k,null); return Buffer.concat([c.update(Buffer.from(String(n),'utf8')),c.final()]).toString('hex'); }
function decryptId(hex,key){ const k=crypto.createHash('sha256').update(key).digest().slice(0,16); const c=crypto.createDecipheriv('aes-128-ecb',k,null); return +Buffer.concat([c.update(Buffer.from(hex,'hex')),c.final()]).toString('utf8'); }
function expiringId(opts={}){ const ttlMs={'1h':3600000,'1d':86400000,'7d':604800000}[opts.ttl||'1h']||3600000; return `exp_${Date.now()+ttlMs}_${nanoId({size:8})}`; }
function checkExpiry(id){ const parts=id.split('_'); const exp=parseInt(parts[1]); return {valid:exp>Date.now(),expiresAt:new Date(exp)}; }
function otpToken(){ return crypto.randomInt(100000,999999).toString(); }

// ── Performance helpers ─────────────────────────────────────────────────────────
function batch(fn,n,...args){ return Array.from({length:n},()=>fn(...args)); }
function batchUnique(fn,n,...args){ const s=new Set(); while(s.size<n)s.add(fn(...args)); return [...s]; }
async function batchAsync(fn,n,...args){ return batch(fn,n,...args); }
class IdPool{ constructor(fn,size=100){ this._fn=fn; this._pool=batch(fn,size); } get(){ if(!this._pool.length)this._pool=batch(this._fn,100); return this._pool.pop(); } }
function createPool(fn,size=100){ return new IdPool(fn,size); }
class BloomFilter{ constructor(){ this._s=new Set(); } add(x){ this._s.add(x); } has(x){ return this._s.has(x); } }
function createCollisionTracker(){ return new BloomFilter(); }

// ── Factory helpers ─────────────────────────────────────────────────────────────
function createGenerator(opts={}){ return ()=>nanoId(opts); }
const schemas={};
function getZodSchemas(){ return {}; }
function getJoiSchemas(){ return {}; }

// ── Validation helpers ──────────────────────────────────────────────────────────
const PATTERNS = { uuid:/^[0-9a-f-]{36}$/ };
function validate(id){ return { valid:typeof id==='string'&&id.length>0 }; }
function parse(id){ return { id, type:migrate_mod.detectFormat(id).format }; }

// ── Named exports ───────────────────────────────────────────────────────────────
const { semanticId, validateSemantic, parseSemantic, registerSchema } = semantic_mod;
const { linkedId, verifyLink, deriveId, isDescendantOf, getLineage, getChildren, clearLineage } = lineage_mod;
const { scopedId, resolveScoped, buildScopeMap, isSameResource } = scoped_mod;
const { lifecycleId, transition, parseLifecycle, verifyState, stableCore, getHistory, currentState, replayHistory, getTimeline, clearHistory } = lifecycle_mod;
const { measuredId, analyzeEntropy, sizeFor, entropyBits, collisionProbability, chiSquaredTest, runLengthTest } = entropy_mod;
const { dcid, verifyDcid, idempotentId } = chaos_mod;
const { telemetry, withTelemetry } = telemetry_mod;
const { schema, IdSchema } = schema_mod;
const { topoId, parseTopology, isEUResident, regionOf, isSameRegion, registerTopology, registerRegion, REGION_MAP } = topology_mod;
const { fuzzyId, validateFuzzy, correctFuzzy, parseFuzzy, CROCKFORD } = fuzzy_mod;
const { compoundId, splitId, sharedComponents, hasComponent, timedCompoundId, extractTimestamp } = compound_mod;
const { hierarchyRoot, hierarchyChild, parseHierarchy, parentOf, depthOf, isDescendant, isDirectChild, subtreeRange, lowestCommonAncestor, reparent, topoSort } = hierarchy_mod;
const { IdRateLimiter, createRateLimiter } = ratelimit_mod;
const { migrateId, recoverOriginal, batchMigrate, isMigrated, detectFormat, registerFormat, getMigrationLog, clearMigrationLog } = migrate_mod;

module.exports = {
  // UUID
  uuid, uuidV4, uuidV7, uuidV5, uuidV3, UUID_NAMESPACES,
  // Sortable
  timestampId, ulid, ulidToTimestamp, ksuid, ksuidToDate, snowflakeId, parseSnowflake,
  // Generators
  humanId, fromPattern, sequentialId, resetSequence, getSequence, nanoId, typedId, registerTypes, TYPE_REGISTRY,
  // Encoding
  customId, convertEncoding, maskId, geoId, parseGeoId, ENCODINGS,
  // Security
  signId, verifySignedId, sign: signId, verify: verifySignedId, encryptId, decryptId, expiringId, checkExpiry, otpToken,
  // Validation
  validate, parse, detectType: detectFormat, PATTERNS,
  // Performance
  batch, batchUnique, batchAsync, createPool, IdPool, createCollisionTracker, BloomFilter,
  // Factory
  createGenerator, schemas, getZodSchemas, getJoiSchemas,

  // ══ v3 ════════════════════════════════════════════════════════════
  semanticId, validateSemantic, parseSemantic, registerSchema,
  linkedId, verifyLink,
  scopedId, resolveScoped, buildScopeMap, isSameResource,
  lifecycleId, transition, parseLifecycle, verifyState, stableCore,
  measuredId, analyzeEntropy, sizeFor, entropyBits, collisionProbability,
  dcid, verifyDcid, idempotentId,
  telemetry, withTelemetry,
  schema, IdSchema,
  topoId, parseTopology, isEUResident, regionOf, isSameRegion, registerTopology, registerRegion, REGION_MAP,
  deriveId, isDescendantOf, getLineage, getChildren, clearLineage,

  // ══ v4 NEW ════════════════════════════════════════════════════════
  // 1. Fuzzy / Typo-Resistant IDs
  fuzzyId, validateFuzzy, correctFuzzy, parseFuzzy, CROCKFORD,
  // 2. Composite / Compound IDs
  compoundId, splitId, sharedComponents, hasComponent, timedCompoundId, extractTimestamp,
  // 3. Hierarchical / Path IDs
  hierarchyRoot, hierarchyChild, parseHierarchy, parentOf, depthOf,
  isDescendant, isDirectChild, subtreeRange, lowestCommonAncestor, reparent, topoSort,
  // 4. Rate Limiter
  IdRateLimiter, createRateLimiter,
  // 5. ID Migration & Versioning
  migrateId, recoverOriginal, batchMigrate, isMigrated, detectFormat, registerFormat, getMigrationLog, clearMigrationLog,
  // 6. Real Randomness Tests
  chiSquaredTest, runLengthTest,
  // 7. Lifecycle History
  getHistory, currentState, replayHistory, getTimeline, clearHistory,
};

// ══ v5 PREMIUM FEATURES ═══════════════════════════════════════════
const collision_mod  = require('./collision');
const federation_mod = require('./federation');
const compliance_mod = require('./compliance');
const dashboard_mod  = require('./dashboard');

const {
  CollisionDetector, ScalableBloomFilter, MemoryBackend,
  createDetector, createRegistry,
} = collision_mod;

const {
  Federation, FederationNode,
  createFederation, snowflake64, parseSnowflake64,
} = federation_mod;

const {
  scanForPII, scanBatch, verifyPseudonymization,
  checkDataResidency, generateComplianceReport, formatReport,
  PII_PATTERNS, GDPR_ZONES, HIPAA_REGIONS,
} = compliance_mod;

const {
  Dashboard, createDashboard, TimeSeriesBuffer, AlertEngine,
} = dashboard_mod;

Object.assign(module.exports, {
  // Collision Detection
  CollisionDetector, ScalableBloomFilter, MemoryBackend,
  createDetector, createRegistry,

  // Federation
  Federation, FederationNode,
  createFederation, snowflake64, parseSnowflake64,

  // Compliance
  scanForPII, scanBatch, verifyPseudonymization,
  checkDataResidency, generateComplianceReport, formatReport,
  PII_PATTERNS, GDPR_ZONES, HIPAA_REGIONS,

  // Dashboard
  Dashboard, createDashboard, TimeSeriesBuffer, AlertEngine,
});

// ══ v6 — 30 NEW FEATURES ══════════════════════════════════════════
const decoder_mod    = require('./decoder');
const storage_mod    = require('./storage');
const batchverify_mod= require('./batchverify');
const query_mod      = require('./query');
const prevention_mod = require('./prevention');
const plugin_mod     = require('./plugin');
const async_mod      = require('./async_gen');
const devtools_mod   = require('./devtools');
const docgen_mod     = require('./docgen');

Object.assign(module.exports, {
  // 1 & 2: Reverse decode + global parser
  decodeId: decoder_mod.decodeId,
  parseId:  decoder_mod.parseId,
  decodeBatch: decoder_mod.decodeBatch,
  registerDecoder: decoder_mod.registerDecoder,

  // 3: Persistent storage
  createStore: storage_mod.createStore,
  PersistentStore: storage_mod.PersistentStore,

  // 4 & 5: Batch verification + comparison
  batchVerify: batchverify_mod.batchVerify,
  batchVerifySigned: batchverify_mod.batchVerifySigned,
  batchCheckCollisions: batchverify_mod.batchCheckCollisions,
  batchValidate: batchverify_mod.batchValidate,
  compareIds: batchverify_mod.compareIds,
  sortById: batchverify_mod.sortById,
  diffIds: batchverify_mod.diffIds,
  groupByType: batchverify_mod.groupByType,
  deduplicateIds: batchverify_mod.deduplicateIds,

  // 6 & 15: Query + tagging
  createIndex: query_mod.createIndex,
  IdIndex: query_mod.IdIndex,

  // 7, 8, 9: Collision prevention + versioning + schema migration
  createSafeGenerator: prevention_mod.createSafeGenerator,
  registerVersion: prevention_mod.registerVersion,
  versionedGenerate: prevention_mod.versionedGenerate,
  detectVersion: prevention_mod.detectVersion,
  registerMigration: prevention_mod.registerMigration,
  migrateVersion: prevention_mod.migrateVersion,

  // 10, 20, 22: Plugin + config + events
  configure: plugin_mod.configure,
  getConfig: plugin_mod.getConfig,
  on: plugin_mod.on,
  off: plugin_mod.off,
  once: plugin_mod.once,
  emit: plugin_mod.emit,
  registerWebhook: plugin_mod.registerWebhook,
  use: plugin_mod.use,
  applyMiddleware: plugin_mod.applyMiddleware,
  listPlugins: plugin_mod.listPlugins,

  // 12, 21, 14: Async/stream + cache + access control
  streamIds: async_mod.streamIds,
  collectFromStream: async_mod.collectFromStream,
  generateAsync: async_mod.generateAsync,
  createCache: async_mod.createCache,
  withCache: async_mod.withCache,
  createAccessControl: async_mod.createAccessControl,

  // 17, 18, 26, 16, 29: Debug + logging + validation + export/import + test utils
  UniqidError: devtools_mod.UniqidError,
  ErrorCodes: devtools_mod.ErrorCodes,
  createError: devtools_mod.createError,
  logger: devtools_mod.logger,
  enableTrace: devtools_mod.enableTrace,
  disableTrace: devtools_mod.disableTrace,
  trace: devtools_mod.trace,
  getTraces: devtools_mod.getTraces,
  createValidationEngine: devtools_mod.createValidationEngine,
  createCommonRules: devtools_mod.createCommonRules,
  exportIds: devtools_mod.exportIds,
  importIds: devtools_mod.importIds,
  enableMockMode: devtools_mod.enableMockMode,
  disableMockMode: devtools_mod.disableMockMode,
  mockGenerator: devtools_mod.mockGenerator,
  withMock: devtools_mod.withMock,
  testIds: devtools_mod.testIds,
  assertId: devtools_mod.assertId,

  // 27, 25, 24, 30, 19: Retry + monitor + CLI + docgen + TS types
  withRetry: docgen_mod.withRetry,
  withFallback: docgen_mod.withFallback,
  monitor: docgen_mod.monitor,
  parseCLIArgs: docgen_mod.parseCLIArgs,
  executeCLI: docgen_mod.executeCLI,
  generateSchemaDocs: docgen_mod.generateSchemaDocs,
  generateTypeScript: docgen_mod.generateTypeScript,
  generateDocs: docgen_mod.generateDocs,
});

// ══ v7 NEW FEATURES ═══════════════════════════════════════════════
const format_mod    = require('./format');
const advanced_mod  = require('./advanced');
const namespace_mod = require('./namespace');
const timeid_mod    = require('./timeid');
const analytics_mod = require('./analytics');

Object.assign(module.exports, {
  // Format & Encoding
  prefixedId: format_mod.prefixedId,
  shortId: format_mod.shortId,
  customLengthId: format_mod.customLengthId,
  urlSafeId: format_mod.urlSafeId,
  base62Id: format_mod.base62Id,
  base36Id: format_mod.base36Id,
  encodeBase62: format_mod.encodeBase62,
  decodeBase62: format_mod.decodeBase62,
  encodeBase36: format_mod.encodeBase36,
  decodeBase36: format_mod.decodeBase36,
  visualId: format_mod.visualId,
  emojiId: format_mod.emojiId,
  compactId: format_mod.compactId,

  // Advanced Features
  hashId: advanced_mod.hashId,
  shortHashId: advanced_mod.shortHashId,
  seededId: advanced_mod.seededId,
  createSeededGenerator: advanced_mod.createSeededGenerator,
  createOneTimeStore: advanced_mod.createOneTimeStore,
  createBlacklist: advanced_mod.createBlacklist,
  entropyId: advanced_mod.entropyId,
  adaptiveId: advanced_mod.adaptiveId,
  registerUseCase: advanced_mod.registerUseCase,
  listUseCases: advanced_mod.listUseCases,
  predictCollision: advanced_mod.predictCollision,
  compressId: advanced_mod.compressId,
  decompressId: advanced_mod.decompressId,
  offlineId: advanced_mod.offlineId,

  // Namespace
  defineNamespace: namespace_mod.defineNamespace,
  namespaceId: namespace_mod.namespaceId,
  belongsTo: namespace_mod.belongsTo,
  detectNamespace: namespace_mod.detectNamespace,
  listNamespaces: namespace_mod.listNamespaces,
  getNamespace: namespace_mod.getNamespace,
  setEnvironment: namespace_mod.setEnvironment,
  getEnvironment: namespace_mod.getEnvironment,
  envId: namespace_mod.envId,
  reactHookCode: namespace_mod.reactHookCode,
  vueComposableCode: namespace_mod.vueComposableCode,

  // Time-based IDs
  timestampId: timeid_mod.timestampId,
  extractTime: timeid_mod.extractTime,
  timeWindowId: timeid_mod.timeWindowId,
  epochDayId: timeid_mod.epochDayId,
  contextId: timeid_mod.contextId,
  meaningfulId: timeid_mod.meaningfulId,
  pronounceableId: timeid_mod.pronounceableId,
  multiFormatId: timeid_mod.multiFormatId,
  listFormats: timeid_mod.listFormats,

  // Analytics & Debug
  analytics: analytics_mod.analytics,
  enableDebug: analytics_mod.enableDebug,
  disableDebug: analytics_mod.disableDebug,
  isDebugMode: analytics_mod.isDebugMode,
  debugWrap: analytics_mod.debugWrap,
  getDebugLog: analytics_mod.getDebugLog,
  clearDebugLog: analytics_mod.clearDebugLog,
  inspectId: analytics_mod.inspectId,
  apiGenerate: analytics_mod.apiGenerate,
});

// ══ v8 REMAINING FEATURES ══════════════════════════════════════════
const chain_mod = require('./chain');
Object.assign(module.exports, {
  // Blockchain-style IDs
  createChain: chain_mod.createChain,
  IdChain:     chain_mod.IdChain,
  idToQrAscii: chain_mod.idToQrAscii,
  idToQrDataUrl: chain_mod.idToQrDataUrl,
  // High-performance pool
  createHighPerfPool: chain_mod.createHighPerfPool,
  HighPerformancePool: chain_mod.HighPerformancePool,
});
