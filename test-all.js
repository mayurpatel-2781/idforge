'use strict';

/**
 * test-all.js — Master Test Suite
 * Covers all 8 phases. Run: node test-all.js
 */

const uid = require('./index');

let passed = 0, failed = 0, skipped = 0;

function assert(label, condition, debug) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}${debug !== undefined ? ' → ' + JSON.stringify(debug) : ''}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

async function run() {

// ════════════════════════════════════════════════════
section('PHASE 1 — Core Generators');

// nanoId
assert('nanoId default 21',     uid.nanoId().length === 21);
assert('nanoId size opt',       uid.nanoId({ size: 8 }).length === 8);
assert('nanoId numeric compat', uid.nanoId(8).length === 8);
assert('nanoId alphabet',       uid.nanoId({ size: 10, alphabet: 'ABC' }).split('').every(c => 'ABC'.includes(c)));
try { uid.nanoId({ size: 0 }); assert('nanoId size 0 throws', false); }
catch(e) { assert('nanoId size 0 throws', true); }

// UUID family
assert('uuid v4 format',    /^[0-9a-f-]{36}$/.test(uid.uuid()));
assert('uuidV4 version',    uid.uuidV4()[14] === '4');
assert('uuidV7 version',    uid.uuidV7()[14] === '7');
assert('uuidV5 version',    uid.uuidV5('test')[14] === '5');
assert('uuidV3 version',    uid.uuidV3('test')[14] === '3');

// Sortable
assert('ulid 26 chars',       uid.ulid().length === 26);
assert('ulid timestamp',      uid.ulidToTimestamp(uid.ulid()) > 1_000_000_000_000);
assert('ksuid 27 chars',      uid.ksuid().length === 27);
assert('ksuid date',          uid.ksuidToDate(uid.ksuid()).getFullYear() >= 2024);
assert('snowflake numeric',   /^\d+$/.test(uid.snowflakeId()));
assert('parseSnowflake date', uid.parseSnowflake(uid.snowflakeId()).date.getFullYear() >= 2024);

// Other generators
assert('typedId user',     uid.typedId('user').startsWith('usr_'));
assert('typedId order',    uid.typedId('order').startsWith('ord_'));
assert('humanId sep',      uid.humanId().includes('-'));
const s1 = uid.sequentialId(), s2 = uid.sequentialId();
assert('sequential inc',   s2 > s1);
assert('fromPattern',      uid.fromPattern('xxxx-9999').length === 9);
assert('registerTypes',    (() => { uid.registerTypes({ widget: 'wgt' }); return uid.typedId('widget').startsWith('wgt_'); })());

// ════════════════════════════════════════════════════
section('PHASE 1 — Decoder (Fixed)');

const _uuid4 = uid.uuid();
const d4 = uid.decodeId(_uuid4);
assert('decodeId uuid type',    d4.type === 'uuid-v4');
assert('decodeId uuid version', d4.version === 4);
assert('decodeId uuid raw',     d4.raw === _uuid4);

const _ulid = uid.ulid();
const dUl = uid.decodeId(_ulid);
assert('decodeId ulid type',    dUl.type === 'ulid');
assert('decodeId ulid date',    typeof dUl.date === 'string');

const _sf = uid.snowflakeId();
const dSf = uid.decodeId(_sf);
assert('decodeId snowflake type',      dSf.type === 'snowflake');
assert('decodeId snowflake ts',        typeof dSf.timestamp === 'number');
assert('decodeId snowflake machineId', typeof dSf.machineId === 'number');

const _nano = uid.nanoId();
const dNano = uid.decodeId(_nano);
assert('decodeId nanoid type',  dNano.type === 'nanoid');
assert('decodeId nanoid bits',  dNano.entropyBits > 120);

const parsed = uid.parseId(_uuid4);
assert('parseId type',       parsed.type === 'uuid-v4');
assert('parseId confidence', parsed.confidence === 'high');
assert('parseId decoded',    parsed.decoded !== undefined);

const batch3 = uid.decodeBatch([_uuid4, _ulid, _sf]);
assert('decodeBatch length', batch3.length === 3);
assert('decodeBatch types',  batch3.map(b => b.type).includes('uuid-v4'));

// ════════════════════════════════════════════════════
section('PHASE 2 — Format & Encoding');

const N = 123456789;
assert('encodeBase62 roundtrip', uid.decodeBase62(uid.encodeBase62(N)) === N);
assert('encodeBase36 roundtrip', uid.decodeBase36(uid.encodeBase36(N)) === N);
assert('prefixedId',             uid.prefixedId('usr').startsWith('usr_'));
assert('shortId length',         uid.shortId().length === 8);
assert('customLengthId',         uid.customLengthId(15).length === 15);
assert('urlSafeId no unsafe',    !/[+/=]/.test(uid.urlSafeId()));
assert('base62Id chars',         /^[0-9A-Za-z]+$/.test(uid.base62Id()));
assert('base36Id chars',         /^[0-9a-z]+$/.test(uid.base36Id()));
assert('visualId string',        typeof uid.visualId() === 'string');
assert('emojiId has emoji',      [...uid.emojiId()].some(c => c.codePointAt(0) > 127));
assert('compactId string',       typeof uid.compactId() === 'string');

// ════════════════════════════════════════════════════
section('PHASE 2 — Seeded & Advanced');

assert('hashId deterministic',   uid.hashId('hello') === uid.hashId('hello'));
assert('hashId differs',         uid.hashId('foo') !== uid.hashId('bar'));
assert('shortHashId length',     uid.shortHashId('hello', { length: 8 }).length === 8);
assert('seededId deterministic', uid.seededId('s1') === uid.seededId('s1'));
assert('seededId different',     uid.seededId('s1') !== uid.seededId('s2'));
const sgen = uid.createSeededGenerator('base');
assert('seededGen unique', sgen() !== sgen());

const ots = uid.createOneTimeStore();
ots.add('tok-1');
assert('ots.has', ots.has('tok-1'));
ots.consume('tok-1');
assert('ots consumed', !ots.has('tok-1'));
assert('ots.wasConsumed', ots.wasConsumed('tok-1'));

const bl = uid.createBlacklist(['bad-1', 'bad-2']);
assert('blacklist isBanned',  bl.isBanned('bad-1'));
assert('blacklist allows',    !bl.isBanned('good'));
bl.add('bad-3');
assert('blacklist add',       bl.isBanned('bad-3'));
assert('blacklist filter',    bl.filter(['bad-1', 'good']).length === 1);

assert('entropyId 128',       uid.entropyId({ bits: 128 }).length === 32);
assert('adaptiveId string',   typeof uid.adaptiveId() === 'string');

const cp = uid.predictCollision({ count: 1000, bits: 64 });
assert('predictCollision prob',  typeof cp.probability === 'number');
assert('predictCollision 0-1',   cp.probability >= 0 && cp.probability <= 1);

const uuidRaw  = uid.uuid();
const compressed = uid.compressId(uuidRaw);
assert('compressId shorter',  compressed.length < uuidRaw.length);
const decomp = uid.decompressId(compressed);
assert('decompressId roundtrip', decomp.toLowerCase() === uuidRaw.toLowerCase());

assert('offlineId string', typeof uid.offlineId() === 'string');

uid.registerUseCase('invoice', {
  generate: () => `inv_${uid.nanoId({ size: 12 })}`,
  validate: id => id.startsWith('inv_'),
});
assert('listUseCases has invoice', uid.listUseCases().includes('invoice'));

// ════════════════════════════════════════════════════
section('PHASE 2 — Namespace');

uid.defineNamespace('orders', { prefix: 'ord', description: 'Order IDs' });
const oid = uid.namespaceId('orders');
assert('namespaceId prefix',   oid.startsWith('ord_'));
assert('belongsTo true',       uid.belongsTo(oid, 'orders'));
assert('belongsTo false',      !uid.belongsTo(oid, 'users'));
assert('detectNamespace',      uid.detectNamespace(oid) === 'orders');
assert('listNamespaces',       uid.listNamespaces().includes('orders'));
const nsInfo = uid.getNamespace('orders');
assert('getNamespace prefix',  nsInfo?.prefix === 'ord');
uid.setEnvironment('staging');
assert('getEnvironment',       uid.getEnvironment() === 'staging');
const eid = uid.envId('orders');
assert('envId has stg',        eid.includes('stg'));
assert('reactHookCode',        uid.reactHookCode('orders').includes('useOrdersId'));
assert('vueComposableCode',    uid.vueComposableCode('orders').includes('vue'));

// ════════════════════════════════════════════════════
section('PHASE 3 — Time-based IDs');

const tsId = uid.timestampId();
assert('timestampId string',   typeof tsId === 'string' && tsId.includes('_'));
const et = uid.extractTime(tsId);
assert('extractTime Date',     et instanceof Date);
assert('extractTime year',     et.getFullYear() >= 2024);

const tw1 = uid.timeWindowId({ windowMs: 60_000 });
const tw2 = uid.timeWindowId({ windowMs: 60_000 });
assert('timeWindowId stable',  tw1 === tw2);

const ed = uid.epochDayId();
assert('epochDayId stable',    ed === uid.epochDayId());

assert('contextId',            typeof uid.contextId({ svc: 'pay', env: 'prod' }) === 'string');
assert('meaningfulId',         typeof uid.meaningfulId() === 'string');
assert('pronounceableId',      typeof uid.pronounceableId() === 'string');
assert('multiFormatId hex',    /^[0-9a-f]+$/.test(uid.multiFormatId('hex')));
assert('multiFormatId b64',    typeof uid.multiFormatId('base64') === 'string');
assert('listFormats',          uid.listFormats().includes('hex') && uid.listFormats().includes('base62'));

// ════════════════════════════════════════════════════
section('PHASE 4 — Security');

const signed = uid.signId('test-id', 'secret');
assert('signId format',          signed.includes('.'));
const verified = uid.verifySignedId(signed, 'secret');
assert('verifySignedId valid',   verified.valid);
assert('verifySignedId id',      verified.id === 'test-id');
assert('verifySignedId bad key', !uid.verifySignedId(signed, 'wrong').valid);

const encrypted = uid.encryptId(12345, 'mykey');
assert('encryptId string',       typeof encrypted === 'string');
assert('decryptId roundtrip',    uid.decryptId(encrypted, 'mykey') === 12345);

const expId = uid.expiringId({ ttl: '1h' });
assert('expiringId format',      expId.startsWith('exp_'));
assert('checkExpiry valid',      uid.checkExpiry(expId).valid);

assert('otpToken 6 digits',      /^\d{6}$/.test(uid.otpToken()));

// Fuzzy IDs
const fid = uid.fuzzyId({ size: 16 });
assert('fuzzyId has sep',        fid.includes('-'));
assert('fuzzyId crockford',      fid.replace(/-/g,'').split('').every(c => uid.CROCKFORD.includes(c)));
const vFid = uid.fuzzyId({ size: 16, separator: '' });
assert('validateFuzzy valid',    uid.validateFuzzy(vFid).valid);
const corrected = uid.correctFuzzy(vFid);
assert('correctFuzzy not null',  corrected.corrected !== null);
assert('correctFuzzy roundtrip', corrected.corrected.replace(/-/g,'') === vFid);

// ════════════════════════════════════════════════════
section('PHASE 5 — Performance & Scaling');

// Batch
const b100 = uid.batch(uid.nanoId, 100);
assert('batch length',           b100.length === 100);
assert('batch unique',           new Set(b100).size === 100);

const bu = uid.batchUnique(uid.nanoId, 50);
assert('batchUnique length',     bu.length === 50);
assert('batchUnique unique',     new Set(bu).size === 50);

// Pool
const pool = uid.createPool(uid.nanoId, 50);
const pp1 = pool.get(), pp2 = pool.get();
assert('pool.get unique',        pp1 !== pp2);

// High-perf pool
const hpool = uid.createHighPerfPool(uid.nanoId, { size: 100 });
const hp1 = hpool.get(), hp2 = hpool.get();
assert('hpool.get unique',       hp1 !== hp2);
const hs = hpool.stats();
assert('hpool stats',            hs.hits === 2 && hs.generated >= 100);

// Collision detection
const det = uid.createDetector({ namespace: 'test-phase5' });
const r1 = await det.checkAndRegister('unique-id-xyz');
assert('detector new ok',        r1.ok === true);
const r2 = await det.checkAndRegister('unique-id-xyz');
assert('detector dup collision', r2.ok === false && r2.collision === true);

// ════════════════════════════════════════════════════
section('PHASE 5 — Distributed (Federation)');

const fed = uid.createFederation({ name: 'test-fed', strategy: 'snowflake' });
const nodeA = fed.join('node-1');
const nodeB = fed.join('node-2');
const fid1 = nodeA.generate(), fid2 = nodeB.generate();
assert('federation unique',      fid1 !== fid2);
assert('federation numeric',     /^\d+$/.test(fid1));
const vf = fed.verify(fid1);
assert('federation verify owner',vf.owner === 'node-1');

// ════════════════════════════════════════════════════
section('PHASE 6 — Developer Tools');

// Storage
const store = uid.createStore({ backend: 'memory' });
await store.addLineageEntry('parent-a', { childId: 'child-1', reason: 'split' });
await store.addLineageEntry('parent-a', { childId: 'child-2', reason: 'split' });
const lin = await store.getLineage('parent-a');
assert('store lineage length',   lin.length === 2);
assert('store lineage ts',       typeof lin[0]._ts === 'number');
const children = await store.getChildren('parent-a');
assert('store children',         children.includes('child-1'));
await store.clearLineage();
assert('store clearLineage',     (await store.getLineage('parent-a')).length === 0);

// DevTools
const err = uid.createError(uid.ErrorCodes.COLLISION, 'dup', { id: 'x' });
assert('createError name',       err.name === 'UniqidError');
assert('createError code',       err.code === 'COLLISION');

uid.enableTrace();
const traceResult = uid.trace('gen', () => uid.nanoId());
assert('trace returns value',    typeof traceResult === 'string');
const traces = uid.getTraces();
assert('getTraces has entry',    traces.some(t => t.label === 'gen'));
uid.disableTrace();

const engine = uid.createValidationEngine();
engine.addRule('no-spaces', id => !/\s/.test(id) || 'no spaces');
engine.addRule('min-len',   id => id.length >= 8   || 'too short');
assert('validation passes', engine.validate(uid.nanoId()).valid);
assert('validation fails',  !engine.validate('bad id').valid);

const idsToExport = [uid.uuid(), uid.nanoId()];
const exported = uid.exportIds(idsToExport, { format: 'json', meta: { v: 1 } });
const imported = uid.importIds(exported);
assert('exportIds json',    typeof exported === 'string');
assert('importIds count',   imported.count === 2);
assert('importIds meta',    imported.meta.v === 1);

// Analytics
uid.enableDebug();
assert('isDebugMode',       uid.isDebugMode());
const wrappedFn = uid.debugWrap('test-wrap', () => 'value');
assert('debugWrap returns', wrappedFn() === 'value');
assert('getDebugLog',       uid.getDebugLog().length > 0);
uid.clearDebugLog();
assert('clearDebugLog',     uid.getDebugLog().length === 0);
uid.disableDebug();

const inspected = uid.inspectId(uid.uuid());
assert('inspectId uuid',    inspected.type === 'uuid-v4');
assert('inspectId length',  inspected.length === 36);

const apiRes = uid.apiGenerate({ type: 'nanoId', count: 5 });
assert('apiGenerate count', apiRes.ids.length === 5);

// Mock mode
uid.mockGenerator('nanoId', 'MOCK-VALUE');
uid.enableMockMode();
const mockFn = uid.withMock('nanoId', uid.nanoId);
assert('withMock returns mock', mockFn() === 'MOCK-VALUE');
uid.disableMockMode();
assert('withMock off',         mockFn() !== 'MOCK-VALUE');

// Retry
let attempts = 0;
const flaky = uid.withRetry(async () => {
  if (++attempts < 3) throw new Error('flaky');
  return 'ok';
}, { retries: 5, backoffMs: 1 });
assert('withRetry ok',     (await flaky()) === 'ok');
assert('withRetry 3 tries',attempts === 3);

// CLI
const p = uid.parseCLIArgs(['generate', 'uuid', '--count', '3']);
assert('parseCLIArgs cmd',     p.command === 'generate');
assert('parseCLIArgs count',   p.flags.count === 3);
const cliOut = uid.executeCLI({ command: 'generate', args: ['nanoid'], flags: { count: 2 } }, uid);
assert('executeCLI 2 lines',   cliOut.trim().split('\n').length === 2);

// ════════════════════════════════════════════════════
section('PHASE 7 — Framework Support');

uid.defineNamespace('react-ns', { prefix: 'rns', description: 'React test' });
const rCode = uid.reactHookCode('react-ns');
assert('reactHook has useState',   rCode.includes('useState'));
assert('reactHook has import',     rCode.includes("from 'react'"));
const vCode = uid.vueComposableCode('react-ns');
assert('vueComposable has ref',    vCode.includes('ref'));
assert('vueComposable has import', vCode.includes("from 'vue'"));
uid.setEnvironment('production');
const prodId = uid.envId('orders');
assert('envId production',         prodId.includes('prod'));

// ════════════════════════════════════════════════════
section('PHASE 8 — Chain & QR');

const chain = uid.createChain();
const b1 = chain.add('id-1');
const b2 = chain.add('id-2');
assert('chain index 0',     b1.index === 0);
assert('chain links',       b2.prevHash === b1.hash);
assert('chain verify',      chain.verify());
assert('chain length',      chain.length === 2);
assert('chain getLast',     chain.getLast().id === 'id-2');
assert('chain find',        chain.find('id-1').hash === b1.hash);

const qrAscii = uid.idToQrAscii('test-123');
assert('qrAscii border',    qrAscii.includes('─'));
assert('qrAscii has ID',    qrAscii.includes('test-123'));
const qrUrl = uid.idToQrDataUrl('test-123');
assert('qrDataUrl data:',   qrUrl.startsWith('data:text/plain'));

// ════════════════════════════════════════════════════
section('BACKWARD COMPATIBILITY — All Versions');

// v3
assert('semanticId',     uid.semanticId({ type: 'user', role: 'admin' }).startsWith('user.'));
uid.clearLineage();
const lRoot = uid.uuid();
const child  = uid.deriveId(lRoot);
assert('deriveId',       child.startsWith('drv_'));
assert('isDescendantOf', uid.isDescendantOf(child, lRoot));
assert('scopedId',       typeof uid.scopedId('tenant', 'res', uid.nanoId()) === 'string');

// v4 hierarchy
const hRoot = uid.hierarchyRoot({ label: 'org' });
const hChild = uid.hierarchyChild(hRoot, { label: 'team' });
assert('hierarchy root',   uid.depthOf(hRoot) === 0);
assert('hierarchy child',  uid.depthOf(hChild) === 1);
assert('isDescendant',     uid.isDescendant(hChild, hRoot));

// v4 rate limiter
const lim = uid.createRateLimiter({ rate: 10, burst: 10 });
assert('rateLimiter',      lim.consume('key').allowed);

// v4 migration
const mig = uid.migrateId(uid.uuid(), { toVersion: '2' });
assert('migrateId',        uid.isMigrated(mig.newId));
assert('recoverOriginal',  uid.recoverOriginal(mig.newId).valid);

// v5 compliance
const piiScan = uid.scanForPII('user_john.doe@example.com_abc123');
assert('scanForPII email',  !piiScan.clean);
assert('cleanId passes',    uid.scanForPII(uid.nanoId()).clean);

// v6 batch verify
const bvIds = [uid.nanoId(), uid.nanoId(), uid.nanoId()];
const bvResult = uid.batchVerify(bvIds, [{ name: 'len', fn: id => id.length === 21 }]);
assert('batchVerify passed', bvResult.passed === 3);

// v6 index
const idx = uid.createIndex();
idx.add(uid.uuid(), { tags: ['user', 'active'] });
idx.add(uid.nanoId(), { tags: ['session'] });
assert('index query tag',    idx.query({ tags: ['user'] }).total === 1);
assert('index stats',        idx.stats().total === 2);

// ════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(60)}`);
console.log(`  ✅ ${passed} passed   ❌ ${failed} failed   ⏭  ${skipped} skipped`);
console.log('═'.repeat(60));
if (failed > 0) process.exit(1);

} // end run()

run().catch(e => { console.error('\n💥 Uncaught error:', e.message, '\n', e.stack); process.exit(1); });
