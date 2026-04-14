/**
 * esm.mjs — ESM (ES Module) entry point for uuid-lab
 * Supports tree-shaking — import only what you need.
 *
 * Usage:
 *   import { nanoId, uuid, semanticId } from 'uuid-lab/esm'
 *   import { createDetector } from 'uuid-lab/esm'
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const uid = require('./index.js');

// ── Core generators ───────────────────────────────────────────────────────────
export const uuid            = uid.uuid;
export const uuidV4          = uid.uuidV4;
export const uuidV7          = uid.uuidV7;
export const uuidV5          = uid.uuidV5;
export const uuidV3          = uid.uuidV3;
export const ulid            = uid.ulid;
export const ulidToTimestamp = uid.ulidToTimestamp;
export const ksuid           = uid.ksuid;
export const snowflakeId     = uid.snowflakeId;
export const parseSnowflake  = uid.parseSnowflake;
export const nanoId          = uid.nanoId;
export const humanId         = uid.humanId;
export const typedId         = uid.typedId;
export const sequentialId    = uid.sequentialId;
export const otpToken        = uid.otpToken;
export const fromPattern     = uid.fromPattern;

// ── Encoding ──────────────────────────────────────────────────────────────────
export const maskId          = uid.maskId;
export const geoId           = uid.geoId;
export const parseGeoId      = uid.parseGeoId;
export const encodeBase62    = uid.encodeBase62;
export const decodeBase62    = uid.decodeBase62;
export const encodeBase36    = uid.encodeBase36;
export const decodeBase36    = uid.decodeBase36;

// ── Format ────────────────────────────────────────────────────────────────────
export const prefixedId      = uid.prefixedId;
export const shortId         = uid.shortId;
export const customLengthId  = uid.customLengthId;
export const urlSafeId       = uid.urlSafeId;
export const base62Id        = uid.base62Id;
export const base36Id        = uid.base36Id;
export const visualId        = uid.visualId;
export const emojiId         = uid.emojiId;
export const compactId       = uid.compactId;

// ── Security ──────────────────────────────────────────────────────────────────
export const signId          = uid.signId;
export const verifySignedId  = uid.verifySignedId;
export const encryptId       = uid.encryptId;
export const decryptId       = uid.decryptId;
export const expiringId      = uid.expiringId;
export const checkExpiry     = uid.checkExpiry;

// ── Advanced ──────────────────────────────────────────────────────────────────
export const hashId              = uid.hashId;
export const shortHashId         = uid.shortHashId;
export const seededId            = uid.seededId;
export const createSeededGenerator = uid.createSeededGenerator;
export const createOneTimeStore  = uid.createOneTimeStore;
export const createBlacklist     = uid.createBlacklist;
export const entropyId           = uid.entropyId;
export const adaptiveId          = uid.adaptiveId;
export const offlineId           = uid.offlineId;
export const compressId          = uid.compressId;
export const decompressId        = uid.decompressId;
export const predictCollision    = uid.predictCollision;

// ── Semantic & Relationship ───────────────────────────────────────────────────
export const semanticId      = uid.semanticId;
export const validateSemantic= uid.validateSemantic;
export const parseSemantic   = uid.parseSemantic;
export const linkedId        = uid.linkedId;
export const verifyLink      = uid.verifyLink;
export const scopedId        = uid.scopedId;

// ── Lifecycle ─────────────────────────────────────────────────────────────────
export const lifecycleId     = uid.lifecycleId;
export const transition      = uid.transition;
export const verifyState     = uid.verifyState;
export const getHistory      = uid.getHistory;
export const getTimeline     = uid.getTimeline;

// ── Entropy ───────────────────────────────────────────────────────────────────
export const measuredId      = uid.measuredId;
export const analyzeEntropy  = uid.analyzeEntropy;
export const entropyBits     = uid.entropyBits;
export const chiSquaredTest  = uid.chiSquaredTest;

// ── Chaos / DCID ─────────────────────────────────────────────────────────────
export const dcid            = uid.dcid;
export const verifyDcid      = uid.verifyDcid;
export const idempotentId    = uid.idempotentId;

// ── Topology ──────────────────────────────────────────────────────────────────
export const topoId          = uid.topoId;
export const parseTopology   = uid.parseTopology;
export const isEUResident    = uid.isEUResident;
export const registerTopology= uid.registerTopology;

// ── Hierarchy ─────────────────────────────────────────────────────────────────
export const hierarchyRoot   = uid.hierarchyRoot;
export const hierarchyChild  = uid.hierarchyChild;
export const parseHierarchy  = uid.parseHierarchy;
export const depthOf         = uid.depthOf;
export const parentOf        = uid.parentOf;
export const isDescendant    = uid.isDescendant;
export const subtreeRange    = uid.subtreeRange;

// ── Compound ──────────────────────────────────────────────────────────────────
export const compoundId      = uid.compoundId;
export const splitId         = uid.splitId;
export const hasComponent    = uid.hasComponent;

// ── Fuzzy ─────────────────────────────────────────────────────────────────────
export const fuzzyId         = uid.fuzzyId;
export const validateFuzzy   = uid.validateFuzzy;
export const correctFuzzy    = uid.correctFuzzy;

// ── Rate Limiter ──────────────────────────────────────────────────────────────
export const createRateLimiter = uid.createRateLimiter;

// ── Migration ─────────────────────────────────────────────────────────────────
export const migrateId       = uid.migrateId;
export const recoverOriginal = uid.recoverOriginal;
export const detectFormat    = uid.detectFormat;
export const isMigrated      = uid.isMigrated;

// ── Collision Detection ───────────────────────────────────────────────────────
export const createDetector  = uid.createDetector;
export const createRegistry  = uid.createRegistry;

// ── Federation ────────────────────────────────────────────────────────────────
export const createFederation= uid.createFederation;

// ── Compliance ────────────────────────────────────────────────────────────────
export const scanForPII              = uid.scanForPII;
export const generateComplianceReport= uid.generateComplianceReport;
export const formatReport            = uid.formatReport;

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const createDashboard = uid.createDashboard;

// ── Decode / Parse ────────────────────────────────────────────────────────────
export const decodeId        = uid.decodeId;
export const parseId         = uid.parseId;
export const decodeBatch     = uid.decodeBatch;

// ── Storage ───────────────────────────────────────────────────────────────────
export const createStore     = uid.createStore;

// ── Batch & Query ─────────────────────────────────────────────────────────────
export const batchVerify     = uid.batchVerify;
export const compareIds      = uid.compareIds;
export const sortById        = uid.sortById;
export const diffIds         = uid.diffIds;
export const groupByType     = uid.groupByType;
export const createIndex     = uid.createIndex;

// ── Versioning & Migration ────────────────────────────────────────────────────
export const registerVersion     = uid.registerVersion;
export const versionedGenerate   = uid.versionedGenerate;
export const registerMigration   = uid.registerMigration;
export const migrateVersion      = uid.migrateVersion;

// ── Plugin / Events / Config ──────────────────────────────────────────────────
export const configure       = uid.configure;
export const getConfig       = uid.getConfig;
export const on              = uid.on;
export const off             = uid.off;
export const emit            = uid.emit;
export const use             = uid.use;

// ── Async / Cache ─────────────────────────────────────────────────────────────
export const streamIds       = uid.streamIds;
export const generateAsync   = uid.generateAsync;
export const createCache     = uid.createCache;
export const withCache       = uid.withCache;
export const createAccessControl = uid.createAccessControl;

// ── DevTools ──────────────────────────────────────────────────────────────────
export const createValidationEngine = uid.createValidationEngine;
export const exportIds       = uid.exportIds;
export const importIds       = uid.importIds;
export const testIds         = uid.testIds;
export const assertId        = uid.assertId;
export const enableTrace     = uid.enableTrace;
export const trace           = uid.trace;
export const ErrorCodes      = uid.ErrorCodes;
export const createError     = uid.createError;

// ── Retry / Monitor / CLI / Docs ──────────────────────────────────────────────
export const withRetry       = uid.withRetry;
export const withFallback    = uid.withFallback;
export const monitor         = uid.monitor;
export const parseCLIArgs    = uid.parseCLIArgs;
export const executeCLI      = uid.executeCLI;
export const generateDocs    = uid.generateDocs;
export const generateTypeScript = uid.generateTypeScript;

// ── Namespace & Env ───────────────────────────────────────────────────────────
export const defineNamespace = uid.defineNamespace;
export const namespaceId     = uid.namespaceId;
export const setEnvironment  = uid.setEnvironment;
export const envId           = uid.envId;
export const reactHookCode   = uid.reactHookCode;
export const vueComposableCode = uid.vueComposableCode;

// ── Time IDs ──────────────────────────────────────────────────────────────────
export const timestampId     = uid.timestampId;
export const extractTime     = uid.extractTime;
export const timeWindowId    = uid.timeWindowId;
export const meaningfulId    = uid.meaningfulId;
export const pronounceableId = uid.pronounceableId;
export const multiFormatId   = uid.multiFormatId;
export const contextId       = uid.contextId;

// ── Analytics & Debug ─────────────────────────────────────────────────────────
export const analytics       = uid.analytics;
export const enableDebug     = uid.enableDebug;
export const debugWrap       = uid.debugWrap;
export const inspectId       = uid.inspectId;
export const apiGenerate     = uid.apiGenerate;

// ── Performance ───────────────────────────────────────────────────────────────
export const batch           = uid.batch;
export const createPool      = uid.createPool;

// ── Default export (full module) ──────────────────────────────────────────────
export default uid;
