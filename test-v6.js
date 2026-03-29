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
section('🔍 Features 1 & 2: Reverse Decode + Global Parser');

const u = uid.uuid();
const decoded = uid.decodeId(u);
assert('decodeId uuid type',        decoded.type === 'uuid-v4');
assert('decodeId uuid version',     decoded.version === 4);
assert('decodeId uuid raw',         decoded.raw === u);

const ul = uid.ulid();
const dUlid = uid.decodeId(ul);
assert('decodeId ulid type',        dUlid.type === 'ulid');
assert('decodeId ulid has date',    typeof dUlid.date === 'string');

const sf = uid.snowflakeId();
const dSf = uid.decodeId(sf);
assert('decodeId snowflake type',   dSf.type === 'snowflake');
assert('decodeId snowflake ts',     typeof dSf.timestamp === 'number');
assert('decodeId snowflake machineId', typeof dSf.machineId === 'number');

uid.registerTopology({ region: 'eu-central-1', dc: 1 });
const topo = uid.topoId();
const dTopo = uid.decodeId(topo);
assert('decodeId topology type',    dTopo.type === 'topology');
assert('decodeId topology isEU',    dTopo.isEU === true);
assert('decodeId topology country', dTopo.country === 'DE');

const lc = await uid.lifecycleId('order', { states: ['pending','shipped','delivered'], initial: 'pending', secret: 'lifecycle-secret' });
const dLc = uid.decodeId(lc);
assert('decodeId lifecycle type',   dLc.type === 'lifecycle');
assert('decodeId lifecycle state',  dLc.state === 'pending');

const nano = uid.nanoId();
const dNano = uid.decodeId(nano);
assert('decodeId nanoid type',      dNano.type === 'nanoid');
assert('decodeId nanoid bits',      dNano.entropyBits > 120);

const parsed = uid.parseId(u);
assert('parseId type',              parsed.type === 'uuid-v4');
assert('parseId confidence high',   parsed.confidence === 'high');
assert('parseId has decoded',       parsed.decoded !== undefined);

const batch = uid.decodeBatch([u, ul, sf]);
assert('decodeBatch length',        batch.length === 3);
assert('decodeBatch types',         batch.map(b=>b.type).includes('uuid-v4'));

// ══════════════════════════════════════════════════════
section('💾 Feature 3: Persistent Lineage Storage');

const store = uid.createStore({ backend: 'memory' });
await store.addLineageEntry('parent-1', { childId: 'child-1', reason: 'split' });
await store.addLineageEntry('parent-1', { childId: 'child-2', reason: 'split' });

const lineage = await store.getLineage('parent-1');
assert('store getLineage length',   lineage.length === 2);
assert('store getLineage has ts',   typeof lineage[0]._ts === 'number');

const children = await store.getChildren('parent-1');
assert('store getChildren',         children.includes('child-1'));
assert('store getChildren count',   children.length === 2);

await store.set('meta:key1', { foo: 'bar' });
const val = await store.get('meta:key1');
assert('store generic set/get',     val?.foo === 'bar');
assert('store backendName',         store.backendName === 'memory');

await store.clearLineage();
assert('store clearLineage',        (await store.getLineage('parent-1')).length === 0);

// ══════════════════════════════════════════════════════
section('✅ Features 4 & 5: Batch Verification + Comparison');

const ids = [uid.nanoId(), uid.nanoId(), uid.nanoId()];
const rules = [
  { name: 'non-empty',    fn: id => id.length > 0 },
  { name: 'correct-len',  fn: id => id.length === 21 },
];
const bvResult = uid.batchVerify(ids, rules);
assert('batchVerify total',         bvResult.total === 3);
assert('batchVerify all passed',    bvResult.passed === 3);
assert('batchVerify results array', bvResult.results.length === 3);
assert('batchVerify checks',        bvResult.results[0].checks.length === 2);

const dupIds = [ids[0], ids[1], ids[0]];
const collisions = uid.batchCheckCollisions(dupIds);
assert('batchCheckCollisions dup',  collisions.hasDuplicates);
assert('batchCheckCollisions count',collisions.duplicates.length === 1);

const vResult = uid.batchValidate(ids, /^[A-Za-z0-9_-]{21}$/);
assert('batchValidate valid',       vResult.valid === 3);

const cmp = uid.compareIds(ids[0], ids[1]);
assert('compareIds equal false',    cmp.equal === false);
assert('compareIds sameType',       cmp.sameType === true);
assert('compareIds has order',      typeof cmp.order === 'number');

const sorted = uid.sortById([ul, uid.ulid(), uid.ulid()]);
assert('sortById length',           sorted.length === 3);

const diff = uid.diffIds([ids[0], ids[1]], [ids[1], ids[2]]);
assert('diffIds onlyInA',           diff.onlyInA.includes(ids[0]));
assert('diffIds onlyInB',           diff.onlyInB.includes(ids[2]));
assert('diffIds inBoth',            diff.inBoth.includes(ids[1]));

const grouped = uid.groupByType([uid.uuid(), uid.nanoId(), uid.ulid()]);
assert('groupByType keys',          Object.keys(grouped).length >= 2);

const dupes = uid.deduplicateIds([ids[0], ids[0], ids[1]]);
assert('deduplicateIds',            dupes.length === 2);

// ══════════════════════════════════════════════════════
section('🔎 Features 6 & 15: Query + Tagging');

const idx = uid.createIndex();
const id1 = uid.uuid();
const id2 = uid.nanoId();
const id3 = uid.ulid();

idx.add(id1, { tags: ['user', 'active'], meta: { env: 'prod' } });
idx.add(id2, { tags: ['session', 'active'], meta: { env: 'prod' } });
idx.add(id3, { tags: ['user'], meta: { env: 'dev' } });

assert('index add + get',           idx.get(id1) !== null);
assert('index type auto-detected',  idx.get(id1).type === 'uuid-v4');

const q1 = idx.query({ tags: ['active'] });
assert('query by tag',              q1.total === 2);

const q2 = idx.query({ type: 'nanoid' });
assert('query by type',             q2.total === 1);

const q3 = idx.query({ meta: { env: 'prod' } });
assert('query by meta',             q3.total === 2);

const q4 = idx.query({ limit: 1, offset: 0 });
assert('query limit',               q4.results.length === 1);

idx.tag(id1, 'premium');
assert('tag adds tag',              idx.get(id1).tags.includes('premium'));
idx.untag(id1, 'premium');
assert('untag removes tag',         !idx.get(id1).tags.includes('premium'));

assert('getByTag',                  idx.getByTag('user').length === 2);
assert('getByType',                 idx.getByType('nanoid').length === 1);
assert('allTags',                   idx.allTags().includes('active'));

const stats = idx.stats();
assert('index stats total',         stats.total === 3);
assert('index stats byType',        typeof stats.byType === 'object');

const exported = idx.export();
assert('index export',              exported.length === 3);
const idx2 = uid.createIndex();
idx2.import(exported);
assert('index import',              idx2.stats().total === 3);

// ══════════════════════════════════════════════════════
section('🛡️ Features 7, 8, 9: Prevention + Versioning + Migration');

const safeGen = uid.createSafeGenerator(uid.nanoId, { namespace: 'orders', maxRetries: 5 });
const sg1 = safeGen.generate();
const sg2 = safeGen.generate();
assert('safeGenerator generates',   typeof sg1 === 'string');
assert('safeGenerator unique',      sg1 !== sg2);
const sgStats = safeGen.stats();
assert('safeGenerator stats',       sgStats.generated === 2);

// Versioning
uid.registerVersion('myId', 1, {
  generate: () => `v1_${uid.nanoId(8)}`,
  validate: id => id.startsWith('v1_'),
});
uid.registerVersion('myId', 2, {
  generate: () => `v2_${uid.nanoId(10)}`,
  validate: id => id.startsWith('v2_'),
});
const vg = uid.versionedGenerate('myId');
assert('versionedGenerate uses latest', vg.version === 2);
assert('versionedGenerate format',  vg.id.startsWith('v2_'));
assert('versionedGenerate name',    vg.name === 'myId');

const detV = uid.detectVersion('myId', 'v1_AbCd1234');
assert('detectVersion v1',          detV === 1);
const detV2 = uid.detectVersion('myId', 'v2_AbCdEfGhIj');
assert('detectVersion v2',          detV2 === 2);

// Schema migration
uid.registerMigration('myId', 1, 2, id => id.replace('v1_', 'v2_') + 'XX');
const migrated = uid.migrateVersion('myId', 'v1_AbCd1234', { fromVersion: 1, toVersion: 2 });
assert('migrateVersion id',         migrated.id.startsWith('v2_'));
assert('migrateVersion steps',      migrated.steps.length === 1);
assert('migrateVersion originalId', migrated.originalId === 'v1_AbCd1234');

// ══════════════════════════════════════════════════════
section('🔌 Features 10, 20, 22: Plugin + Config + Events');

uid.configure({ logLevel: 'silent', defaultSize: 24 });
assert('configure sets values',     uid.getConfig('logLevel') === 'silent');
assert('getConfig specific key',    uid.getConfig('defaultSize') === 24);
assert('getConfig all returns obj', typeof uid.getConfig() === 'object');

let eventFired = false;
const unsub = uid.on('test:event', () => { eventFired = true; });
uid.emit('test:event', { foo: 'bar' });
assert('on + emit works',           eventFired);
unsub();
eventFired = false;
uid.emit('test:event', {});
assert('unsub stops events',        !eventFired);

let onceFired = 0;
uid.once('once:event', () => onceFired++);
uid.emit('once:event', {});
uid.emit('once:event', {});
assert('once fires only once',      onceFired === 1);

let mwRan = false;
uid.use({ name: 'test-middleware', after: ctx => { mwRan = true; return ctx; } });
const wrapped = uid.applyMiddleware('nanoId', uid.nanoId);
wrapped();
assert('middleware after hook runs', mwRan);
assert('listPlugins has middleware', uid.listPlugins().some(p => p.name === 'test-middleware'));

// ══════════════════════════════════════════════════════
section('⚡ Features 12, 21, 14: Async/Stream + Cache + Access Control');

const stream = uid.streamIds(uid.nanoId, { count: 10 });
const streamIds2 = await uid.collectFromStream(stream, 10);
assert('streamIds count',           streamIds2.length === 10);
assert('streamIds all unique',      new Set(streamIds2).size === 10);
assert('streamIds are strings',     streamIds2.every(id => typeof id === 'string'));

const batchAsync2 = await uid.generateAsync(uid.nanoId, 50, {
  onProgress: ({ done }) => {},
  chunkSize: 20,
});
assert('generateAsync count',       batchAsync2.length === 50);

const cache = uid.createCache({ maxSize: 5, ttlMs: 5000 });
cache.set('key1', 'value1');
cache.set('key2', 'value2');
assert('cache set/get',             cache.get('key1') === 'value1');
assert('cache miss returns null',   cache.get('nonexistent') === null);
const cStats = cache.stats();
assert('cache stats hits',          cStats.hits === 1);
assert('cache stats misses',        cStats.misses === 1);

let cacheHit = false;
const callLog = [];
const cachedFn = uid.withCache((...a) => { callLog.push(1); return uid.nanoId(...a); });
cachedFn(10); cachedFn(10);
assert('withCache prevents re-call', callLog.length === 1);

const ac = uid.createAccessControl();
ac.defineRole('admin', ['read', 'write', 'delete']);
ac.defineRole('viewer', ['read']);
ac.addPolicy({ name: 'no-delete-prod', match: /^prod_/, require: ['delete'] });

assert('ac admin can read',         ac.check('admin', 'read', 'any-id').allowed);
assert('ac admin can delete prod',  ac.check('admin', 'delete', 'prod_xyz').allowed);
assert('ac viewer cannot write',    !ac.check('viewer', 'write', 'any-id').allowed);
assert('ac unknown role blocked',   !ac.check('hacker', 'read', 'x').allowed);
assert('ac listRoles',              Object.keys(ac.listRoles()).includes('admin'));

// ══════════════════════════════════════════════════════
section('🛠️ Features 17, 18, 26, 16, 29: DevTools');

// Error handling
const err = uid.createError(uid.ErrorCodes.COLLISION, 'duplicate ID', { id: 'x' });
assert('createError name',          err.name === 'UniqidError');
assert('createError code',          err.code === 'COLLISION');
assert('createError meta',          err.meta.id === 'x');
assert('ErrorCodes has COLLISION',  typeof uid.ErrorCodes.COLLISION === 'string');

// Trace mode
uid.enableTrace();
let traceResult = uid.trace('nanoId-gen', () => uid.nanoId());
assert('trace returns value',       typeof traceResult === 'string');
const traces = uid.getTraces();
assert('getTraces has entry',       traces.some(t => t.label === 'nanoId-gen'));
assert('trace has durationMs',      typeof traces[0].durationMs === 'number');
uid.disableTrace();

// Validation engine
const engine = uid.createValidationEngine();
engine.addRule('no-spaces', id => !/\s/.test(id) || 'no spaces allowed');
engine.addRule('min-length', id => id.length >= 8 || 'too short');
assert('validation passes',         engine.validate(uid.nanoId()).valid);
assert('validation fails spaces',   !engine.validate('bad id here').valid);
assert('validation fails short',    !engine.validate('abc').valid);

const bv = engine.validateBatch([uid.nanoId(), 'bad id', uid.nanoId()]);
assert('validateBatch total',       bv.total === 3);
assert('validateBatch invalid 1',   bv.invalid === 1);
assert('validateBatch rules list',  engine.listRules().length === 2);

const common = uid.createCommonRules();
assert('commonRules passes nanoid', common.validate(uid.nanoId()).valid);
assert('commonRules fails empty',   !common.validate('').valid);

// Export / import
const idsToExport = [uid.uuid(), uid.nanoId(), uid.ulid()];
const idsExported = uid.exportIds(idsToExport, { meta: { source: 'test' }, format: 'json' });
assert('exportIds json string',     typeof idsExported === 'string');
const imp = uid.importIds(idsExported);
assert('importIds count',           imp.count === 3);
assert('importIds ids array',       imp.ids.length === 3);
assert('importIds meta',            imp.meta.source === 'test');

const csvExport = uid.exportIds(idsToExport, { format: 'csv' });
assert('exportIds csv format',      csvExport.startsWith('id'));

// Mock mode
uid.mockGenerator('nanoId', 'MOCK-ID-12345');
uid.enableMockMode();
const mockWrapped = uid.withMock('nanoId', uid.nanoId);
assert('withMock returns mock',     mockWrapped() === 'MOCK-ID-12345');
uid.disableMockMode();
assert('withMock off after disable',mockWrapped() !== 'MOCK-ID-12345');

const tids = uid.testIds('order', 5);
assert('testIds length',            tids.length === 5);
assert('testIds format',            tids[0] === 'order_0001');
assert('testIds sequential',        tids[4] === 'order_0005');

const ai = uid.assertId(uid.nanoId(), { minLength: 10, pattern: /^[A-Za-z0-9_-]+$/ });
assert('assertId passes',           ai.pass);
const aiFail = uid.assertId('bad id!', { pattern: /^[A-Za-z0-9]+$/ });
assert('assertId fails',            !aiFail.pass);

// ══════════════════════════════════════════════════════
section('🚀 Features 27, 25, 24, 30, 19: Retry + Monitor + CLI + Docs');

// withRetry
let attempts = 0;
const flaky = uid.withRetry(async () => {
  attempts++;
  if (attempts < 3) throw new Error('flaky');
  return 'success';
}, { retries: 5, backoffMs: 1 });
const retryResult = await flaky();
assert('withRetry succeeds',        retryResult === 'success');
assert('withRetry used 3 attempts', attempts === 3);

// withFallback
const fallbackFn = uid.withFallback(
  async () => { throw new Error('primary failed'); },
  async () => 'fallback-result'
);
assert('withFallback uses fallback', await fallbackFn() === 'fallback-result');

// Monitor
uid.monitor.count('ids.generated', 5);
uid.monitor.gauge('pool.size', 42);
uid.monitor.timing('generation.ms', 1.5);
uid.monitor.timing('generation.ms', 2.0);
const snap = uid.monitor.snapshot();
assert('monitor count',             snap.metrics['ids.generated'] === 5);
assert('monitor gauge',             snap.metrics['pool.size'] === 42);
assert('monitor timing p50',        snap.metrics['timing:generation.ms'].p50 <= 2.0);
assert('monitor history',           uid.monitor.history(1).length === 1);

uid.monitor.probe('custom', () => ({ status: 'ok' }));
const snap2 = uid.monitor.snapshot();
assert('monitor probe',             snap2.metrics['probe:custom']?.status === 'ok');

// CLI
const p1 = uid.parseCLIArgs(['generate', 'uuid', '--count', '3']);
assert('parseCLIArgs command',      p1.command === 'generate');
assert('parseCLIArgs args',         p1.args[0] === 'uuid');
assert('parseCLIArgs flag count',   p1.flags.count === 3);

const cliOut = uid.executeCLI({ command: 'generate', args: ['nanoid'], flags: { count: 3 } }, uid);
assert('executeCLI generates 3',    cliOut.split('\n').length === 3);

const decodeOut = uid.executeCLI({ command: 'decode', args: [uid.uuid()], flags: {} }, uid);
assert('executeCLI decode',         decodeOut.includes('uuid-v4'));

const helpOut = uid.executeCLI({ command: 'help', args: [], flags: {} }, uid);
assert('executeCLI help',           helpOut.includes('generate'));

// Doc generation
const schemaDef = {
  name: 'OrderId',
  description: 'Unique order identifier',
  segments: [
    { key: 'prefix', type: 'literal', description: 'Fixed prefix "ord"' },
    { key: 'ts',     type: 'timestamp', encoding: 'base36', description: 'Creation timestamp' },
    { key: 'rand',   type: 'random', encoding: 'base62', description: 'Random component' },
  ],
  examples: ['ord_lkjh2345_Ab3Xq7'],
};
const docs = uid.generateSchemaDocs(schemaDef);
assert('generateSchemaDocs returns string', typeof docs === 'string');
assert('docs has schema name',      docs.includes('OrderId'));
assert('docs has table',            docs.includes('| Segment |'));

const tsTypes = uid.generateTypeScript(schemaDef);
assert('generateTypeScript interface', tsTypes.includes('interface OrderIdDecoded'));
assert('generateTypeScript brand',  tsTypes.includes('__brand'));

const fullDocs = uid.generateDocs([schemaDef], { title: 'Test Docs' });
assert('generateDocs has title',    fullDocs.includes('Test Docs'));

const tsDocs = uid.generateDocs([schemaDef], { format: 'typescript' });
assert('generateDocs typescript',   tsDocs.includes('interface'));

// ══════════════════════════════════════════════════════
section('🔵 Full backwards compatibility check');
assert('uuid',      /^[0-9a-f-]{36}$/.test(uid.uuid()));
assert('nanoId',    uid.nanoId().length === 21);
assert('ulid',      uid.ulid().length === 26);
assert('fuzzyId',   uid.fuzzyId().includes('-'));
assert('collision', typeof uid.createDetector === 'function');
assert('federation',typeof uid.createFederation === 'function');
assert('compliance',typeof uid.scanForPII === 'function');
assert('dashboard', typeof uid.createDashboard === 'function');

// ══════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(60)}`);
console.log(`  ✅ ${passed} passed    ❌ ${failed} failed`);
console.log('═'.repeat(60));
if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
