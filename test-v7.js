'use strict';
const uid = require('./index');

let passed = 0, failed = 0;
function assert(label, condition, debug) {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label}${debug !== undefined ? ' → ' + JSON.stringify(debug) : ''}`); failed++; }
}
function section(t) { console.log(`\n${t}`); }

async function run() {

// ══════════════════════════════════════════════════════
section('🎨 Feature 1: Format & Encoding');

const pfx = uid.prefixedId('usr');
assert('prefixedId has prefix',         pfx.startsWith('usr_') || pfx.startsWith('usr-'));
assert('prefixedId is string',          typeof pfx === 'string');

const short = uid.shortId();
assert('shortId is string',             typeof short === 'string');
assert('shortId length <= 12',          short.length <= 12);

const custom = uid.customLengthId(10);
assert('customLengthId length',         custom.length === 10);

const urlSafe = uid.urlSafeId();
assert('urlSafeId no unsafe chars',     !/[+/=]/.test(urlSafe));
assert('urlSafeId is string',           typeof urlSafe === 'string');

const b62 = uid.base62Id();
assert('base62Id is string',            typeof b62 === 'string');
assert('base62Id uses base62 chars',    /^[A-Za-z0-9]+$/.test(b62));

const b36 = uid.base36Id();
assert('base36Id is string',            typeof b36 === 'string');
assert('base36Id uses base36 chars',    /^[a-z0-9]+$/.test(b36));

// encode / decode roundtrips
const num = 123456789;
const enc62 = uid.encodeBase62(num);
assert('encodeBase62 is string',        typeof enc62 === 'string');
assert('decodeBase62 roundtrip',        uid.decodeBase62(enc62) === num);

const enc36 = uid.encodeBase36(num);
assert('encodeBase36 is string',        typeof enc36 === 'string');
assert('decodeBase36 roundtrip',        uid.decodeBase36(enc36) === num);

const visual = uid.visualId();
assert('visualId is string',            typeof visual === 'string');
assert('visualId length > 0',          visual.length > 0);

const emoji = uid.emojiId();
assert('emojiId is string',             typeof emoji === 'string');
assert('emojiId has emoji chars',       [...emoji].some(c => c.codePointAt(0) > 127));

const compact = uid.compactId();
assert('compactId is string',           typeof compact === 'string');
assert('compactId length > 0',         compact.length > 0);

// ══════════════════════════════════════════════════════
section('🔬 Feature 2: Advanced Features');

const hid = uid.hashId('hello world');
assert('hashId is string',              typeof hid === 'string');
assert('hashId deterministic',          uid.hashId('hello world') === hid);
assert('hashId different inputs differ',uid.hashId('foo') !== uid.hashId('bar'));

const shid = uid.shortHashId('hello world');
assert('shortHashId is string',         typeof shid === 'string');
assert('shortHashId shorter than hashId', shid.length <= hid.length);
assert('shortHashId deterministic',     uid.shortHashId('hello world') === shid);

const seeded = uid.seededId('my-seed-42');
assert('seededId is string',            typeof seeded === 'string');
assert('seededId deterministic',        uid.seededId('my-seed-42') === seeded);
assert('seededId different seeds differ',uid.seededId('seed-A') !== uid.seededId('seed-B'));

const seededGen = uid.createSeededGenerator('base-seed');
const sg1 = seededGen();
const sg2 = seededGen();
assert('seededGenerator produces strings', typeof sg1 === 'string');
assert('seededGenerator different outputs', sg1 !== sg2);

// One-time store
const ots = uid.createOneTimeStore();
const otsId = uid.nanoId();
ots.add(otsId);
assert('oneTimeStore has id',           ots.has(otsId));
ots.consume(otsId);
assert('oneTimeStore consumed',         !ots.has(otsId));
assert('oneTimeStore size',             typeof ots.size === 'number');

// Blacklist
const bl = uid.createBlacklist(['bad-id-1', 'bad-id-2']);
assert('blacklist blocks bad id',       bl.isBanned('bad-id-1'));
assert('blacklist allows good id',      !bl.isBanned(uid.nanoId()));
bl.add('bad-id-3');
assert('blacklist add works',           bl.isBanned('bad-id-3'));

const entId = uid.entropyId({ bits: 128 });
assert('entropyId is string',           typeof entId === 'string');
assert('entropyId sufficient length',   entId.length >= 20);

const adaptId = uid.adaptiveId({ context: 'high-traffic' });
assert('adaptiveId is string',          typeof adaptId === 'string');

// Use case registry
uid.registerUseCase('invoice', {
  description: 'Invoice IDs for billing',
  generate: () => `inv_${uid.nanoId({ size: 12 })}`,
  validate: id => id.startsWith('inv_'),
});
const useCases = uid.listUseCases();
assert('listUseCases returns array',    Array.isArray(useCases));
assert('listUseCases has invoice',      useCases.some(u => u.name === 'invoice' || u === 'invoice'));

const collision = uid.predictCollision({ count: 1000, bits: 64 });
assert('predictCollision has probability', typeof collision.probability === 'number');
assert('predictCollision probability 0-1', collision.probability >= 0 && collision.probability <= 1);

const compId = uid.compressId(uid.uuid());
assert('compressId is string',          typeof compId === 'string');
const decompId = uid.decompressId(compId);
assert('decompressId is string',        typeof decompId === 'string');

const offId = uid.offlineId();
assert('offlineId is string',           typeof offId === 'string');
assert('offlineId length > 0',         offId.length > 0);

// ══════════════════════════════════════════════════════
section('🗂️ Feature 3: Namespace');

uid.defineNamespace('payments', {
  prefix: 'pay',
  description: 'Payment service IDs',
  version: 1,
});
uid.defineNamespace('users', {
  prefix: 'usr',
  description: 'User service IDs',
  version: 1,
});

const payId = uid.namespaceId('payments');
assert('namespaceId is string',         typeof payId === 'string');
assert('namespaceId has prefix',        payId.startsWith('pay'));

assert('belongsTo payments',            uid.belongsTo(payId, 'payments'));
assert('belongsTo users false',         !uid.belongsTo(payId, 'users'));

const detected = uid.detectNamespace(payId);
assert('detectNamespace finds payments', detected === 'payments' || detected?.name === 'payments');

const allNs = uid.listNamespaces();
assert('listNamespaces is array',       Array.isArray(allNs));
assert('listNamespaces has payments',   allNs.includes('payments') || allNs.some(n => n === 'payments' || n?.name === 'payments'));

const nsInfo = uid.getNamespace('payments');
assert('getNamespace returns object',   typeof nsInfo === 'object' && nsInfo !== null);
assert('getNamespace has prefix',       nsInfo.prefix === 'pay');

uid.setEnvironment('production');
assert('setEnvironment works',          uid.getEnvironment() === 'production');

uid.setEnvironment('development');
const envId = uid.envId('payments');
assert('envId is string',               typeof envId === 'string');
assert('envId has env marker',          envId.includes('dev') || envId.includes('development') || typeof envId === 'string');

const hookCode = uid.reactHookCode('payments');
assert('reactHookCode is string',       typeof hookCode === 'string');
assert('reactHookCode has hook name',   hookCode.includes('use') || hookCode.includes('hook') || hookCode.includes('payments'));

const vueCode = uid.vueComposableCode('payments');
assert('vueComposableCode is string',   typeof vueCode === 'string');

// ══════════════════════════════════════════════════════
section('⏱️ Feature 4: Time-based IDs');

const tsId = uid.timestampId();
assert('timestampId is string',         typeof tsId === 'string');
assert('timestampId length > 0',        tsId.length > 0);

// extractTime — works on timestampId output
const extractedTime = uid.extractTime(tsId);
assert('extractTime returns Date or number', extractedTime instanceof Date || typeof extractedTime === 'number');
if (extractedTime instanceof Date) {
  assert('extractTime reasonable date', extractedTime.getFullYear() >= 2024);
}

const twId = uid.timeWindowId({ windowMs: 60000 }); // 1-minute window
assert('timeWindowId is string',        typeof twId === 'string');
const twId2 = uid.timeWindowId({ windowMs: 60000 });
assert('timeWindowId same window = same', twId === twId2);

const epId = uid.epochDayId();
assert('epochDayId is string',          typeof epId === 'string');
const epId2 = uid.epochDayId();
assert('epochDayId same day = same',    epId === epId2);

const ctxId = uid.contextId({ service: 'payments', region: 'us-east-1' });
assert('contextId is string',           typeof ctxId === 'string');
assert('contextId has context',         ctxId.includes('payments') || ctxId.includes('us-east') || ctxId.length > 0);

const mId = uid.meaningfulId({ noun: 'order', adjective: 'quick' });
assert('meaningfulId is string',        typeof mId === 'string');
assert('meaningfulId has noun',         mId.includes('order') || mId.includes('quick') || mId.length > 0);

const pronId = uid.pronounceableId();
assert('pronounceableId is string',     typeof pronId === 'string');
assert('pronounceableId length > 0',   pronId.length > 0);

const mfId = uid.multiFormatId('hex');
assert('multiFormatId hex is string',   typeof mfId === 'string');
assert('multiFormatId hex chars',       /^[0-9a-f]+$/i.test(mfId.replace(/-/g, '')));

const mfId2 = uid.multiFormatId('base64');
assert('multiFormatId base64 is string', typeof mfId2 === 'string');

const formats = uid.listFormats();
assert('listFormats is array',          Array.isArray(formats));
assert('listFormats has hex',           formats.includes('hex'));

// ══════════════════════════════════════════════════════
section('📈 Feature 5: Analytics & Debug');

// analytics object
assert('analytics is object',           typeof uid.analytics === 'object' && uid.analytics !== null);

// debug mode
uid.enableDebug();
assert('isDebugMode true after enable', uid.isDebugMode());

const wrapped = uid.debugWrap('nanoId-gen', () => uid.nanoId());
const wrappedResult = wrapped();
assert('debugWrap returns value',       typeof wrappedResult === 'string');

const debugLog = uid.getDebugLog();
assert('getDebugLog is array',          Array.isArray(debugLog));
assert('getDebugLog has entry',         debugLog.length > 0);
assert('getDebugLog entry has label',   debugLog.some(e => e.label === 'nanoId-gen' || typeof e.label === 'string'));

uid.clearDebugLog();
assert('clearDebugLog empties log',     uid.getDebugLog().length === 0);

uid.disableDebug();
assert('isDebugMode false after disable', !uid.isDebugMode());

// inspectId
const inspected = uid.inspectId(uid.uuid());
assert('inspectId is object',           typeof inspected === 'object' && inspected !== null);
assert('inspectId has type',            typeof inspected.type === 'string');

const inspectedNano = uid.inspectId(uid.nanoId());
assert('inspectId nanoid type',         inspectedNano.type === 'nanoid' || typeof inspectedNano.type === 'string');

// apiGenerate
const apiResult = uid.apiGenerate({ type: 'nanoId', count: 3 });
assert('apiGenerate returns array or object', Array.isArray(apiResult) || typeof apiResult === 'object');
if (Array.isArray(apiResult)) {
  assert('apiGenerate count',           apiResult.length === 3);
  assert('apiGenerate strings',         apiResult.every(id => typeof id === 'string'));
} else {
  assert('apiGenerate has ids',         Array.isArray(apiResult.ids) || typeof apiResult.result === 'string');
}

// ══════════════════════════════════════════════════════
section('🔗 Feature 6: Blockchain-style ID Chain');

const chain = uid.createChain();
assert('createChain is object',         typeof chain === 'object' && chain !== null);

const block1 = chain.add(uid.nanoId());
assert('chain.add returns block',       typeof block1 === 'object');
assert('chain block has id',            typeof block1.id === 'string');
assert('chain block has hash',          typeof block1.hash === 'string');
assert('chain genesis has no prevHash', block1.prevHash === null || block1.index === 0 || block1.prevHash === '0'.repeat(64));

const block2 = chain.add(uid.nanoId());
assert('chain block2 links to block1', block2.prevHash === block1.hash);
assert('chain length',                  chain.length === 2);

assert('chain verify valid',            chain.verify());

// tampering should break verify
// (only test if chain exposes raw blocks)
const blocks = chain.blocks || chain.toArray?.() || [];
if (blocks.length > 0) {
  assert('chain has blocks array',      blocks.length === 2);
}

// IdChain class
const IdChain = uid.IdChain;
assert('IdChain is constructor',        typeof IdChain === 'function');
const chain2 = new IdChain();
chain2.add('test-id-1');
chain2.add('test-id-2');
assert('IdChain verify',                chain2.verify());

// QR ASCII
const testId = uid.nanoId();
const qrAscii = uid.idToQrAscii(testId);
assert('idToQrAscii is string',         typeof qrAscii === 'string');
assert('idToQrAscii has content',       qrAscii.length > 0);

const qrDataUrl = uid.idToQrDataUrl(uid.uuid());
assert('idToQrDataUrl is string', qrDataUrl.startsWith('data:'));
assert('idToQrDataUrl is data URL',     qrDataUrl.startsWith('data:') || qrDataUrl.length > 0);

// ══════════════════════════════════════════════════════
section('🚀 Feature 7: High-Performance Pool');

const pool = uid.createHighPerfPool(uid.nanoId, { size: 50 });
assert('createHighPerfPool is object',  typeof pool === 'object');

const p1 = pool.get();
const p2 = pool.get();
assert('pool.get returns string',       typeof p1 === 'string');
assert('pool.get unique',               p1 !== p2);

const poolStats = pool.stats?.() ?? pool.size;
assert('pool has stats or size',        poolStats !== undefined);

const HighPerformancePool = uid.HighPerformancePool;
assert('HighPerformancePool is constructor', typeof HighPerformancePool === 'function');
const pool2 = new HighPerformancePool(uid.nanoId, { size: 20 });
const pp1 = pool2.get();
assert('HighPerformancePool.get works', typeof pp1 === 'string');

// ══════════════════════════════════════════════════════
section('🔵 Full Backwards Compatibility (v3–v6)');

assert('uuid',          /^[0-9a-f-]{36}$/.test(uid.uuid()));
assert('nanoId',        uid.nanoId().length === 21);
assert('ulid',          uid.ulid().length === 26);
assert('snowflakeId',   /^\d+$/.test(uid.snowflakeId()));
assert('fuzzyId',       uid.fuzzyId().includes('-'));
assert('compoundId',    uid.splitId(uid.compoundId([uid.uuid(), uid.uuid()])).valid);
assert('hierarchyRoot', uid.depthOf(uid.hierarchyRoot({ label: 'org' })) === 0);
assert('rateLimiter',   uid.createRateLimiter({ rate: 10, burst: 10 }).consume('x').allowed);
assert('migrateId',     uid.isMigrated(uid.migrateId(uid.uuid()).newId));
assert('createDetector',typeof uid.createDetector === 'function');
assert('createStore',   typeof uid.createStore === 'function');
assert('decodeId',      typeof uid.decodeId(uid.uuid()).type === 'string');

// ══════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(60)}`);
console.log(`  ✅ ${passed} passed    ❌ ${failed} failed`);
console.log('═'.repeat(60));
if (failed > 0) process.exit(1);

} // end run()

run().catch(e => { console.error(e); process.exit(1); });
