/**
 * uuid-lab — TypeScript Definitions
 * Comprehensive ID generation library covering all strategies.
 */

// ── Shared Types ──────────────────────────────────────────────────────────────

export interface NanoIdOpts {
  size?: number;
  alphabet?: string;
}

export interface DecodeResult {
  type: string;
  raw: string;
  version?: number;
  timestamp?: number;
  date?: string;
  machineId?: number;
  sequence?: number;
  entropyBits?: number;
  prefix?: string;
  body?: string;
  state?: string;
  country?: string | null;
  isEU?: boolean;
  error?: string;
  [key: string]: unknown;
}

export interface ParseResult {
  type: string;
  confidence: 'high' | 'medium' | 'low' | 'none';
  decoded: DecodeResult;
}

export interface ValidationResult {
  valid: boolean;
  corrected?: string;
  autoFixed?: Array<{ from: string; to: string }>;
  errors?: string[];
}

export interface CollisionPrediction {
  probability: number;
  probabilityPct: string;
  bits: number;
  count: number;
  safeCount: number | string;
  verdict: 'negligible' | 'safe' | 'low-risk' | 'risky';
}

// ── UUID ──────────────────────────────────────────────────────────────────────

export function uuid(): string;
export function uuidV4(): string;
export function uuidV7(): string;
export function uuidV5(name: string): string;
export function uuidV3(name: string): string;
export const UUID_NAMESPACES: Record<string, string>;

// ── Sortable / Time ───────────────────────────────────────────────────────────

export function ulid(): string;
export function ulidToTimestamp(id: string): number;
export function ksuid(): string;
export function ksuidToDate(id: string): Date;
export function snowflakeId(): string;
export function parseSnowflake(id: string): { timestamp: number; date: Date };

// ── Core Generators ───────────────────────────────────────────────────────────

export function nanoId(opts?: NanoIdOpts | number): string;
export function typedId(type: string, opts?: NanoIdOpts): string;
export function registerTypes(map: Record<string, string>): void;
export const TYPE_REGISTRY: Record<string, string>;
export function humanId(opts?: { separator?: string; words?: number; withNumber?: boolean }): string;
export function sequentialId(opts?: { pad?: number; prefix?: string }): string;
export function resetSequence(n?: number): void;
export function getSequence(): number;
export function fromPattern(pattern: string): string;

export const ALPHA_BASE64URL: string;
export const ALPHA_BASE62: string;
export const ALPHA_BASE36: string;
export const ALPHA_HEX: string;

// ── Encoding ──────────────────────────────────────────────────────────────────

export function maskId(id: string, reveal?: number): string;
export function geoId(lat: number, lng: number): string;
export function parseGeoId(id: string): { lat: number; lng: number; rand: string } | null;
export const ENCODINGS: Record<string, string>;
export const PATTERNS: Record<string, RegExp>;

// ── Security ──────────────────────────────────────────────────────────────────

export function signId(id: string, key: string): string;
export function verifySignedId(signed: string, key: string): { valid: boolean; id: string };
export const sign: typeof signId;
export const verify: typeof verifySignedId;
export function encryptId(n: number | string, key: string): string;
export function decryptId(hex: string, key: string): number;
export function expiringId(opts?: { ttl?: '1h' | '1d' | '7d' }): string;
export function checkExpiry(id: string): { valid: boolean; expiresAt: Date };
export function otpToken(): string;
export function tokenId(payload: object, secret: string, opts?: { expiresIn?: number }): string;
export function verifyTokenId(token: string, secret: string): { valid: boolean; payload?: object; error?: string };
export function commitId(id: string, blindingFactor?: string | null): { commitment: string; blindingFactor: string };
export function verifyCommitment(commitment: string, id: string, blindingFactor: string): boolean;

// ── Validation ────────────────────────────────────────────────────────────────

export function validate(id: string): { valid: boolean };
export function parse(id: string): { id: string; type: string };

// ── Performance ───────────────────────────────────────────────────────────────

export function batch<T>(fn: (...args: unknown[]) => T, n: number, ...args: unknown[]): T[];
export function batchUnique<T>(fn: (...args: unknown[]) => T, n: number, ...args: unknown[]): T[];
export function batchAsync<T>(fn: (...args: unknown[]) => T, n: number, ...args: unknown[]): Promise<T[]>;

export class IdPool {
  constructor(fn: () => string, size?: number);
  get(): string;
}
export function createPool(fn: () => string, size?: number): IdPool;

export class BloomFilter {
  add(item: string): void;
  has(item: string): boolean;
}
export function createCollisionTracker(): BloomFilter;
export function createGenerator(opts?: NanoIdOpts): () => string;

// ── Format & Encoding (v7) ────────────────────────────────────────────────────

export function encodeBase62(num: number | bigint): string;
export function decodeBase62(str: string): number;
export function encodeBase36(num: number | bigint): string;
export function decodeBase36(str: string): number;
export function prefixedId(prefix: string, opts?: { size?: number; separator?: string }): string;
export function shortId(opts?: { size?: number }): string;
export function customLengthId(length: number, opts?: NanoIdOpts): string;
export function urlSafeId(opts?: { size?: number }): string;
export function base62Id(opts?: { size?: number }): string;
export function base36Id(opts?: { size?: number }): string;
export function visualId(opts?: { size?: number; separator?: string; groupSize?: number }): string;
export function emojiId(opts?: { count?: number }): string;
export function compactId(opts?: { randomSize?: number }): string;

// ── Advanced (v7) ─────────────────────────────────────────────────────────────

export function hashId(input: string, opts?: { algorithm?: string; encoding?: string; length?: number }): string;
export function shortHashId(input: string, opts?: { length?: number; algorithm?: string }): string;
export function seededId(seed: string, opts?: { size?: number }): string;
export function createSeededGenerator(baseSeed: string, opts?: { size?: number }): () => string;

export interface OneTimeStore {
  add(id: string): boolean;
  has(id: string): boolean;
  consume(id: string): boolean;
  wasConsumed(id: string): boolean;
  readonly size: number;
  stats(): { active: number; consumed: number; total: number };
}
export function createOneTimeStore(): OneTimeStore;

export interface Blacklist {
  add(id: string): Blacklist;
  remove(id: string): Blacklist;
  isBanned(id: string): boolean;
  filter(ids: string[]): string[];
  toArray(): string[];
  readonly size: number;
}
export function createBlacklist(initial?: string[]): Blacklist;

export function entropyId(opts?: { bits?: number; encoding?: string }): string;
export function adaptiveId(opts?: { context?: string; size?: number }): string;
export function registerUseCase(name: string, config: { generate: () => string; [key: string]: unknown }): void;
export function listUseCases(): string[];
export function predictCollision(opts?: { count?: number; bits?: number }): CollisionPrediction;
export function compressId(id: string): string;
export function decompressId(compressed: string): string;
export function offlineId(opts?: { size?: number }): string;
export function compileTemplate(pattern: string): () => string;
export function recommendId(requirements?: string[]): Array<{ type: string; features: string[]; description: string; matchPercentage: number }>;
export function expressMiddleware(opts?: { headerName?: string; generator?: () => string }): (req: object, res: object, next: () => void) => void;
export function mongoosePlugin(schema: object, opts?: { field?: string; generator?: () => string }): void;
export function sequelizeAdapter(dataType: object, opts?: { generator?: () => string }): object;
export function createGraphQLScalar(name: string, validatorFn: (val: string) => boolean, description?: string): object;
export function ssrSafeId(serverPrefix?: string): string;
export function createReactHooks(React: object): { useSafeId: (prefix?: string, generator?: () => string) => string; useCorrelationId: (generator?: () => string) => string };
export function createVueComposables(vue: object): { useSafeId: (prefix?: string, generator?: () => string) => object };

// ── Namespace (v7) ────────────────────────────────────────────────────────────

export interface NamespaceConfig {
  prefix?: string;
  separator?: string;
  size?: number;
  description?: string;
  version?: number;
}
export function defineNamespace(name: string, config?: NamespaceConfig): NamespaceConfig;
export function getNamespace(name: string): NamespaceConfig | null;
export function listNamespaces(): string[];
export function namespaceId(namespaceName: string): string;
export function belongsTo(id: string, namespaceName: string): boolean;
export function detectNamespace(id: string): string | null;
export function setEnvironment(env: string): void;
export function getEnvironment(): string;
export function envId(namespaceName: string): string;
export function reactHookCode(namespaceName: string): string;
export function vueComposableCode(namespaceName: string): string;

// ── Time-based IDs (v7) ───────────────────────────────────────────────────────

export function timestampId(opts?: { encoding?: string; randomSize?: number }): string;
export function extractTime(id: string): Date | null;
export function timeWindowId(opts?: { windowMs?: number; prefix?: string }): string;
export function epochDayId(opts?: { prefix?: string }): string;
export function contextId(context?: Record<string, string>, opts?: { randomSize?: number }): string;
export function meaningfulId(opts?: { noun?: string; adjective?: string; separator?: string; withTimestamp?: boolean }): string;
export function pronounceableId(opts?: { syllables?: number; separator?: string; capitalize?: boolean }): string;
export function multiFormatId(format?: string, opts?: { size?: number }): string;
export function listFormats(): string[];

// ── Analytics & Debug (v7) ───────────────────────────────────────────────────

export const analytics: {
  track(event: string, data?: Record<string, unknown>): { event: string; data: unknown; ts: number };
  count(name: string): number;
  snapshot(): Record<string, unknown>;
  reset(): void;
};
export function enableDebug(): void;
export function disableDebug(): void;
export function isDebugMode(): boolean;
export function debugWrap<T extends (...args: unknown[]) => unknown>(label: string, fn: T): T;
export function getDebugLog(opts?: { limit?: number; label?: string }): unknown[];
export function clearDebugLog(): void;
export function inspectId(id: string): {
  raw: string; length: number; type: string;
  entropy: number | null; hasPrefix: boolean; prefix: string | null;
  separators: string[]; charset: string;
};
export function apiGenerate(opts?: { type?: string; count?: number; [key: string]: unknown }): {
  result?: string; ids?: string[]; type: string; count: number; ts: string;
};

// ── Blockchain Chain (v8) ────────────────────────────────────────────────────

export interface Block {
  index: number;
  id: string;
  prevHash: string;
  hash: string;
  ts: number;
  [key: string]: unknown;
}

export class IdChain {
  constructor(opts?: { hashAlgorithm?: string });
  add(id: string, meta?: Record<string, unknown>): Block;
  verify(): boolean;
  getLast(): Block | null;
  find(id: string): Block | null;
  toArray(): Block[];
  toJSON(): { length: number; valid: boolean; blocks: Block[] };
  readonly length: number;
  readonly blocks: Block[];
}
export function createChain(opts?: { hashAlgorithm?: string }): IdChain;
export function idToQrAscii(id: string): string;
export function idToQrDataUrl(id: string): string;

export class HighPerformancePool {
  constructor(generatorFn: () => string, opts?: { size?: number; refillThreshold?: number; batchSize?: number });
  get(): string;
  drain(n: number): string[];
  peek(): string | null;
  stats(): { poolSize: number; capacity: number; autoScale: boolean; generated: number; hits: number; refills: number };
  readonly size: number;
}
export function createHighPerfPool(generatorFn: () => string, opts?: { size?: number; refillThreshold?: number; batchSize?: number; autoScale?: boolean }): HighPerformancePool;

export function generateParallel(type?: string, count?: number, opts?: object): Promise<string[]>;
export function initWorkers(count?: number): void;
export function terminateWorkers(): void;

// ── Decoder (v6) ─────────────────────────────────────────────────────────────

export function decodeId(id: string): DecodeResult;
export function parseId(id: string): ParseResult;
export function decodeBatch(ids: string[]): DecodeResult[];
export function registerDecoder(name: string, config: { pattern?: RegExp; decode: (id: string) => DecodeResult | null }): void;

// ── Storage (v6) ─────────────────────────────────────────────────────────────

export interface LineageEntry {
  childId?: string;
  reason?: string;
  _ts: number;
  [key: string]: unknown;
}

export class PersistentStore {
  constructor(opts?: { backend?: 'memory' | 'file' | object; filePath?: string });
  addLineageEntry(parentId: string, entry: Omit<LineageEntry, '_ts'>): Promise<void>;
  getLineage(id: string): Promise<LineageEntry[]>;
  getChildren(parentId: string): Promise<string[]>;
  clearLineage(): Promise<void>;
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  keys(prefix?: string): Promise<string[]>;
  count(): Promise<number>;
  clear(): Promise<void>;
  readonly backendName: string;
}
export function createStore(opts?: { backend?: 'memory' | 'file' | object; filePath?: string }): PersistentStore;

// ── Collision Detection (v5) ──────────────────────────────────────────────────

export class CollisionDetector {
  constructor(opts?: { namespace?: string; backend?: string | object; bloomCapacity?: number; bloomErrorRate?: number; onCollision?: (id: string, ns: string) => void });
  isUnique(id: string): Promise<{ unique: boolean; checkedAt: number; layers: object }>;
  register(id: string, opts?: { meta?: object; throwOnCollision?: boolean }): Promise<{ registered: boolean; collision: boolean; id: string }>;
  checkAndRegister(id: string, opts?: object): Promise<{ ok: boolean; id: string; collision: boolean }>;
  registerBatch(ids: string[], opts?: object): Promise<{ registered: string[]; collisions: string[] }>;
  stats(): Promise<object>;
  clear(): Promise<void>;
}
export class ScalableBloomFilter {
  constructor(opts?: { capacity?: number; errorRate?: number });
  add(item: string): void;
  has(item: string): boolean;
  readonly count: number;
  readonly fillRatio: number;
}
export function createDetector(opts?: object): CollisionDetector;
export function createRegistry(opts?: object): { namespace(ns: string): CollisionDetector; globalStats(): Promise<object>; namespaces(): string[] };

// ── Fuzzy (v4) ───────────────────────────────────────────────────────────────

export function fuzzyId(opts?: { size?: number; prefix?: string; separator?: string }): string;
export function validateFuzzy(id: string): ValidationResult;
export function correctFuzzy(id: string): { corrected: string | null; position?: number };
export function parseFuzzy(id: string, opts?: { prefix?: string }): { prefix: string | null; body: string; checkChar: string; valid: boolean; raw: string };
export const CROCKFORD: string;
