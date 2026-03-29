'use strict';
const uid = require('./index');

let passed = 0, failed = 0;
function assert(label, condition, debug) {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label}${debug ? ' → ' + JSON.stringify(debug) : ''}`); failed++; }
}
function section(t) { console.log(`\n${t}`); }

// ═══════════════════════════════════════════════════════
// PRESERVE ALL v2 TESTS (abbreviated)
// ═══════════════════════════════════════════════════════
section('🔵 v2 Smoke Tests');
assert('uuid v4',      /^[0-9a-f-]{36}$/.test(uid.uuid()));
assert('uuid v7',      /^[0-9a-f-]{36}$/.test(uid.uuidV7()));
assert('uuid v5 det',  uid.uuidV5('x') === uid.uuidV5('x'));
assert('ulid 26',      uid.ulid().length === 26);
assert('ksuid 27',     uid.ksuid().length === 27);
assert('snowflake',    typeof uid.snowflakeId() === 'string');
assert('nanoId 21',    uid.nanoId().length === 21);
assert('typedId',      uid.typedId('user').startsWith('usr_'));
assert('humanId',      uid.humanId().includes('-'));
uid.resetSequence(0);
assert('sequential',   uid.sequentialId() === '00000001');
assert('signId',       uid.verifySignedId(uid.signId('x','k'),'k').valid);
assert('encryptId',    uid.decryptId(uid.encryptId(999,'key16byteslong!'),'key16byteslong!') === 999);
assert('expiringId',   uid.checkExpiry(uid.expiringId({ ttl:'1h' })).valid);
assert('otpToken',     /^\d{6}$/.test(uid.otpToken()));
assert('batch 100',    uid.batch(uid.nanoId, 100).length === 100);
assert('pool get',     typeof uid.createPool(uid.nanoId).get() === 'string');
assert('bloom',        (() => { const t = uid.createCollisionTracker(); t.add('x'); return t.has('x'); })());
assert('validate',     uid.validate(uid.uuid()).valid);

// ═══════════════════════════════════════════════════════
section('🧬 Feature 1: Semantic IDs');

const sem1 = uid.semanticId({ type: 'user', role: 'admin', region: 'IN' });
assert('semantic format',       sem1.includes('.'));
assert('semantic type token',   sem1.startsWith('user.'));
assert('semantic role token',   sem1.includes('adm'));
assert('semantic region token', sem1.includes('IN'));

const vSem1 = uid.validateSemantic(sem1, { type: 'user', role: 'admin' });
assert('validate semantic ✅',  vSem1.valid);

const vSem2 = uid.validateSemantic(sem1, { type: 'order' });
assert('validate semantic ❌ wrong type', !vSem2.valid);

const vSem3 = uid.validateSemantic(sem1, { role: 'guest' });
assert('validate semantic ❌ wrong role', !vSem3.valid);

const parsed = uid.parseSemantic(sem1);
assert('parse semantic type',   parsed.type === 'user');
assert('parse semantic random', typeof parsed.random === 'string' && parsed.random.length > 0);

// Signed semantic
const sem2 = uid.semanticId({ type: 'session', env: 'production' }, { secret: 'mysec' });
assert('signed semantic',       sem2.split('.').length >= 4);

// ═══════════════════════════════════════════════════════
section('🔗 Feature 2: Relationship-Encoded IDs');

const parentId  = uid.uuid();
const commentId = uid.linkedId(parentId, { type: 'comment' });

assert('linked has prefix',        commentId.startsWith('com_'));
assert('linked structure',         commentId.split('_').length === 3);

assert('verifyLink ✅ correct parent',  uid.verifyLink(commentId, parentId));
assert('verifyLink ❌ wrong parent',    !uid.verifyLink(commentId, uid.uuid()));
assert('verifyLink ❌ wrong secret',    !uid.verifyLink(commentId, parentId, { secret: 'wrong' }));

const itemId = uid.linkedId(parentId, { type: 'item', index: 1 });
assert('linked different index unique', itemId !== commentId);
assert('linked same parent valid',      uid.verifyLink(itemId, parentId));

// ═══════════════════════════════════════════════════════
section('🎭 Feature 3: Role-Scoped IDs');

const realOrderId = 'ord_K7gF3xNpQ2aVhR9m';
const SECRET = 'scope-key-test';

const adminView    = uid.scopedId(realOrderId, { role: 'admin',    secret: SECRET });
const customerView = uid.scopedId(realOrderId, { role: 'customer', secret: SECRET });
const guestView    = uid.scopedId(realOrderId, { role: 'guest',    secret: SECRET });

assert('scoped different per role',    adminView !== customerView);
assert('scoped different roles 2',     customerView !== guestView);
assert('scoped deterministic',         uid.scopedId(realOrderId, { role: 'admin', secret: SECRET }) === adminView);
assert('scoped preserves prefix',      adminView.startsWith('ord_'));

// Resolve
const candidates = [realOrderId, 'ord_other1', 'ord_other2'];
const resolved = uid.resolveScoped(adminView, candidates, { role: 'admin', secret: SECRET });
assert('resolve scoped ✅', resolved === realOrderId);
assert('resolve scoped ❌ wrong role', uid.resolveScoped(adminView, candidates, { role: 'customer', secret: SECRET }) === null);

// Build scope map
const map = uid.buildScopeMap(candidates, { role: 'customer', secret: SECRET });
assert('scope map has entry', map.has(customerView));
assert('scope map resolves',  map.get(customerView) === realOrderId);

// ═══════════════════════════════════════════════════════
section('⏳ Feature 4: Lifecycle-State IDs');

const STATES = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];
const lifecycle1 = uid.lifecycleId('order', {
  states: STATES,
  initial: 'pending',
  secret: 'lifecycle-key',
});

assert('lifecycle format',   lifecycle1.split('_').length === 4);
assert('lifecycle entity',   lifecycle1.startsWith('order_'));
assert('lifecycle state',    lifecycle1.split('_')[1] === 'pending');

const vs1 = uid.verifyState(lifecycle1, 'pending', { secret: 'lifecycle-key' });
assert('verifyState ✅ pending',  vs1.valid);
assert('verifyState ❌ wrong',    !uid.verifyState(lifecycle1, 'shipped', { secret: 'lifecycle-key' }).valid);
assert('verifyState ❌ tampered', !uid.verifyState(lifecycle1.replace('pending', 'shipped'), 'shipped', { secret: 'lifecycle-key' }).valid);

const { id: shippedId } = uid.transition(lifecycle1, 'shipped', { secret: 'lifecycle-key' });
assert('transition state changes',   shippedId.split('_')[1] === 'shipped');
assert('transition core preserved',  uid.stableCore(shippedId) === uid.stableCore(lifecycle1));
assert('verifyState after transition', uid.verifyState(shippedId, 'shipped', { secret: 'lifecycle-key' }).valid);

// Allowed transitions
const ALLOWED = { pending: ['paid','cancelled'], paid: ['shipped'], shipped: ['delivered'] };
assert('allowed transition ok', (() => {
  try { uid.transition(lifecycle1, 'paid', { secret:'lifecycle-key', allowedTransitions: ALLOWED }); return true; }
  catch { return false; }
})());
assert('blocked transition throws', (() => {
  try { uid.transition(lifecycle1, 'shipped', { secret:'lifecycle-key', allowedTransitions: ALLOWED }); return false; }
  catch { return true; }
})());

// ═══════════════════════════════════════════════════════
section('🌡️ Feature 5: Entropy-Scored IDs');

const { id: measId, entropy: ent } = uid.measuredId({ size: 21 });
assert('measuredId produces id',      typeof measId === 'string' && measId.length === 21);
assert('entropy has bits',            typeof ent.bits === 'number' && ent.bits > 0);
assert('entropy has score',           ['critical','weak','fair','strong','excellent','cryptographic'].includes(ent.score));
assert('entropy safeFor array',       Array.isArray(ent.safeFor));
assert('entropy unsafeFor array',     Array.isArray(ent.unsafeFor));
assert('entropy recommendation',      typeof ent.recommendation === 'string');
assert('entropy collision1M',         typeof ent.collisionAt1M === 'string');
assert('entropy 21 char is strong',   ent.bits >= 120);

const { id: weakId, entropy: weakEnt } = uid.measuredId({ size: 4, alphabet: '01234567' });
assert('weak entropy score',          ['critical','weak'].includes(weakEnt.score));

const analysis = uid.analyzeEntropy('f47ac10b-58cc-4372-a567');
assert('analyzeEntropy bits',         typeof analysis.bits === 'number');
assert('analyzeEntropy score',        typeof analysis.score === 'string');

const sizeCalc = uid.sizeFor({ level: 'strong', population: 1e6 });
assert('sizeFor minChars',            typeof sizeCalc.minChars === 'number' && sizeCalc.minChars > 0);
assert('sizeFor bits sufficient',     sizeCalc.bits >= 128);

// ═══════════════════════════════════════════════════════
section('🔀 Feature 6: Deterministic Chaos IDs (DCID)');

const KEY = 'my-secret-dcid-key';
const d1 = uid.dcid(['user-42', 'workspace-99'], { key: KEY, size: 12 });
const d2 = uid.dcid(['user-42', 'workspace-99'], { key: KEY, size: 12 });
const d3 = uid.dcid(['user-42', 'workspace-99'], { key: 'wrong-key', size: 12 });
const d4 = uid.dcid(['user-99', 'workspace-99'], { key: KEY, size: 12 });

assert('dcid deterministic',          d1 === d2);
assert('dcid wrong key differs',      d1 !== d3);
assert('dcid different input differs',d1 !== d4);
assert('dcid correct length',         d1.length === 12);
assert('dcid looks random',           /^[A-Za-z0-9]+$/.test(d1));

assert('verifyDcid ✅',               uid.verifyDcid(d1, ['user-42','workspace-99'], { key: KEY, size: 12 }));
assert('verifyDcid ❌ wrong key',     !uid.verifyDcid(d1, ['user-42','workspace-99'], { key: 'wrong', size: 12 }));

// Idempotent ID — same key+inputs within time window
const idem1 = uid.idempotentId(['order-123', 'retry'], { key: KEY, windowSeconds: 300 });
const idem2 = uid.idempotentId(['order-123', 'retry'], { key: KEY, windowSeconds: 300 });
assert('idempotentId same window',    idem1 === idem2);
assert('idempotentId is string',      typeof idem1 === 'string' && idem1.length > 0);

// ═══════════════════════════════════════════════════════
section('📊 Feature 7: Telemetry / Observable IDs');

uid.telemetry.enable({ sampleRate: 1.0 }); // 100% sample for tests
uid.telemetry.reset();

// Generate some IDs to record
const wrapped = uid.withTelemetry('uuid', uid.uuid);
wrapped(); wrapped(); wrapped();

const report = uid.telemetry.report();
assert('telemetry enabled',            report.enabled);
assert('telemetry has generated',      typeof report.generated === 'object');
assert('telemetry has peakRate',       typeof report.peakRate === 'string');
assert('telemetry has uptime',         typeof report.uptime === 'string');
assert('telemetry uuid count',         (report.generated.uuid || 0) >= 3);

// Pool tracking
uid.telemetry.recordPool('nanoPool', { size: 5, capacity: 100, hitRate: 0.95 });
const r2 = uid.telemetry.report();
assert('telemetry pool stats',         r2.pools.nanoPool !== undefined);
assert('telemetry pool warning',       r2.warnings.some(w => w.includes('nanoPool')));

// Flush
const flushed = uid.telemetry.flush();
assert('flush returns report',         typeof flushed === 'object');
const r3 = uid.telemetry.report();
assert('flush resets counters',        Object.keys(r3.generated).length === 0);

uid.telemetry.disable();

// ═══════════════════════════════════════════════════════
section('🧩 Feature 8: Composable Schema IDs');

const OrderId = uid.schema([
  { key: 'prefix',    type: 'literal',   value: 'ord' },
  { key: 'tenant',    type: 'data',      encoding: 'base36', len: 6 },
  { key: 'ts',        type: 'timestamp', encoding: 'base36', len: 8 },
  { key: 'random',    type: 'random',    bits: 32, encoding: 'base62' },
  { key: 'checksum',  type: 'checksum' },
]);

const oId = OrderId.generate({ tenant: 12345 });
assert('schema generates id',         typeof oId === 'string');
assert('schema has 5 segments',       oId.split('_').length === 5);
assert('schema prefix correct',       oId.startsWith('ord_'));

const tsExtracted = OrderId.extract(oId, 'ts');
assert('schema extract timestamp',    tsExtracted instanceof Date);
assert('schema timestamp reasonable', tsExtracted.getFullYear() >= 2024);

const tenantExtracted = OrderId.extract(oId, 'tenant');
assert('schema extract data',         tenantExtracted === 12345);

const validation = OrderId.validate(oId);
assert('schema validates ✅',         validation.valid);

const tampered = oId.slice(0, -2) + 'zz';
assert('schema validates ❌ tampered', !OrderId.validate(tampered).valid);

// Counter schema
const InvoiceId = uid.schema([
  { key: 'prefix',  type: 'literal', value: 'inv' },
  { key: 'counter', type: 'counter', len: 4 },
  { key: 'random',  type: 'random',  bits: 24, encoding: 'base62' },
]);
const inv1 = InvoiceId.generate();
const inv2 = InvoiceId.generate();
assert('schema counter increments',   InvoiceId.extract(inv2, 'counter') > InvoiceId.extract(inv1, 'counter'));

// ═══════════════════════════════════════════════════════
section('🌍 Feature 9: Multi-Region Topology IDs');

uid.registerTopology({ region: 'ap-south-1', dc: 2 });

const tId1 = uid.topoId();
assert('topoId format',               tId1.includes('.'));
assert('topoId country code',         tId1.startsWith('IN.'));
assert('topoId dc',                   tId1.includes('dc2'));

const parsed2 = uid.parseTopology(tId1);
assert('parseTopology country',       parsed2.country === 'IN');
assert('parseTopology dc',            parsed2.datacenter === 2);
assert('parseTopology region',        parsed2.region === 'ap-south-1');
assert('parseTopology date',          typeof parsed2.date === 'string');
assert('parseTopology not EU',        parsed2.isEU === false);

// EU check
uid.registerTopology({ region: 'eu-central-1', dc: 1 });
const euId = uid.topoId();
assert('EU resident true',            uid.isEUResident(euId));
assert('EU resident false',           !uid.isEUResident(tId1));

assert('regionOf',                    uid.regionOf(euId) === 'eu-central-1');

// Custom region
uid.registerRegion('local-dev', { country: 'XX', zone: 'local', gdpr: false });
uid.registerTopology({ region: 'local-dev', dc: 0 });
const localId = uid.topoId();
assert('custom region works',         localId.startsWith('XX.'));

// With prefix
uid.registerTopology({ region: 'ap-south-1', dc: 1 });
const tId2 = uid.topoId({ prefix: 'evt' });
assert('topoId with prefix',          tId2.startsWith('evt_'));
assert('parse prefix',                uid.parseTopology(tId2).prefix === 'evt');

// isSameRegion
const tId3 = uid.topoId({ region: 'ap-south-1', dc: 1 });
const tId4 = uid.topoId({ region: 'eu-central-1', dc: 1 });
assert('isSameRegion true',           uid.isSameRegion(tId1, tId3));
assert('isSameRegion false',          !uid.isSameRegion(tId1, tId4));

// ═══════════════════════════════════════════════════════
section('🔄 Feature 10: ID Lineage & Audit Trail');

uid.clearLineage();
const rootId = uid.uuid();

const child1 = uid.deriveId(rootId, { reason: 'split', index: 1 });
const child2 = uid.deriveId(rootId, { reason: 'split', index: 2 });
const grandchild = uid.deriveId(child1, { reason: 'refund' });

assert('deriveId format',             child1.startsWith('drv_'));
assert('deriveId unique',             child1 !== child2);
assert('isDescendantOf ✅',           uid.isDescendantOf(child1, rootId));
assert('isDescendantOf ✅ child2',    uid.isDescendantOf(child2, rootId));
assert('isDescendantOf ❌ unrelated', !uid.isDescendantOf(child1, uid.uuid()));
assert('isDescendantOf grandchild',   uid.isDescendantOf(grandchild, child1));

const children = uid.getChildren(rootId);
assert('getChildren count',           children.length === 2);
assert('getChildren has child1',      children.includes(child1));

const lineage = uid.getLineage(child1);
assert('getLineage has records',      lineage.length > 0);
assert('getLineage has parentId',     lineage[0].parentId === rootId || lineage.some(r => r.parentId === rootId));
assert('getLineage has reason',       lineage.some(r => r.reason === 'split'));

uid.clearLineage();
assert('clearLineage works',          uid.getChildren(rootId).length === 0);

// ═══════════════════════════════════════════════════════
function printResults() {
  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  ✅ ${passed} passed    ❌ ${failed} failed`);
  console.log('═'.repeat(56));
  if (failed > 0) process.exit(1);
}
printResults();
