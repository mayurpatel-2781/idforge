'use strict';
const uid = require('./index');

let passed = 0, failed = 0;
function assert(label, condition, debug) {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label}${debug !== undefined ? ' → ' + JSON.stringify(debug) : ''}`); failed++; }
}
function section(t) { console.log(`\n${t}`); }
async function asyncAssert(label, promise, check) {
  try { const v = await promise; if (check(v)) { console.log(`  ✅ ${label}`); passed++; } else { console.error(`  ❌ ${label}`); failed++; } }
  catch(e) { console.error(`  ❌ ${label} threw: ${e.message}`); failed++; }
}

async function run() {

// ═══════════════════════════════════════════════════════
section('🔍 Feature A: Cloud Collision Detection');

const det = uid.createDetector({ namespace: 'orders', bloomCapacity: 10_000 });

// Basic uniqueness
const id1 = uid.nanoId();
const r1 = await det.checkAndRegister(id1);
assert('checkAndRegister new id ok',       r1.ok === true);
assert('checkAndRegister not collision',   r1.collision === false);

// Second registration of same ID should collide
const r2 = await det.checkAndRegister(id1);
assert('checkAndRegister duplicate detected', r2.ok === false);
assert('checkAndRegister collision flag',     r2.collision === true);

// isUnique
const id2 = uid.nanoId();
const u1  = await det.isUnique(id2);
assert('isUnique unseen id true',          u1.unique === true);
assert('isUnique has layers',              u1.layers !== undefined);

await det.register(id2);
const u2 = await det.isUnique(id2);
assert('isUnique seen id false',           u2.unique === false);

// register with throwOnCollision
let threw = false;
try { await det.register(id1, { throwOnCollision: true }); }
catch(e) { threw = e.name === 'CollisionError' && e.id === id1; }
assert('CollisionError thrown on dup',     threw);

// registerBatch
const ids = Array.from({ length: 5 }, () => uid.nanoId());
ids.push(id1); // one duplicate
const batch = await det.registerBatch(ids);
assert('registerBatch registered 5',       batch.registered.length === 5);
assert('registerBatch collision 1',        batch.collisions.length === 1);
assert('registerBatch collision is id1',   batch.collisions[0] === id1);

// stats
const stats = await det.stats();
assert('stats has registrations',          stats.registrations >= 2);
assert('stats has collisions',             stats.collisions >= 2);
assert('stats has collisionRate',          typeof stats.collisionRate === 'string');
assert('stats has bloomFillRatio',         typeof stats.bloomFillRatio === 'string');
assert('stats namespace correct',          stats.namespace === 'orders');

// Bloom filter directly
const bf = new uid.ScalableBloomFilter({ capacity: 1000, errorRate: 0.01 });
bf.add('hello');
assert('bloom filter has item',            bf.has('hello'));
assert('bloom filter misses unknown',      !bf.has('world'));
assert('bloom filter count',               bf.count === 1);

// Registry
const registry = uid.createRegistry({ bloomCapacity: 1000 });
const ns1 = registry.namespace('users');
const ns2 = registry.namespace('products');
await ns1.checkAndRegister('usr_1');
await ns2.checkAndRegister('prd_1');
assert('registry namespaces isolated',     (await ns1.isUnique('prd_1')).unique === true);
assert('registry lists namespaces',        registry.namespaces().includes('users'));

const globalStats = await registry.globalStats();
assert('registry globalStats',             globalStats.users !== undefined);

// clear
await det.clear();
const afterClear = await det.isUnique(id1);
assert('clear resets detector',            afterClear.unique === true);

// ═══════════════════════════════════════════════════════
section('🌐 Feature B: Multi-Service ID Federation');

// Snowflake strategy
const fed1 = uid.createFederation({ name: 'platform', strategy: 'snowflake' });
const nodeA = fed1.join('orders-us-east-1');
const nodeB = fed1.join('payments-us-west-2');

const sfId1 = nodeA.generate();
const sfId2 = nodeB.generate();
assert('snowflake generates string',       typeof sfId1 === 'string');
assert('snowflake ids unique',             sfId1 !== sfId2);
assert('snowflake ids are numeric strings', /^\d+$/.test(sfId1));

const v1 = fed1.verify(sfId1);
assert('verify finds owning node',         v1.owner === 'orders-us-east-1');
assert('verify has parsed timestamp',      v1.parsed.date instanceof Date);

// Same node rejoins (idempotent)
const nodeA2 = fed1.join('orders-us-east-1');
assert('join idempotent',                  nodeA2 === nodeA);

// generateBatch
const batch2 = nodeA.generateBatch(10);
assert('generateBatch length',             batch2.length === 10);
assert('generateBatch all unique',         new Set(batch2).size === 10);

// node stats
const nStats = nodeA.stats();
assert('node stats nodeId',                nStats.nodeId === 'orders-us-east-1');
assert('node stats generated count',       nStats.generated >= 11);
assert('node stats strategy',              nStats.strategy === 'snowflake');

// Federation stats
const fStats = fed1.stats();
assert('fed stats nodes',                  fStats.nodes === 2);
assert('fed stats totalGenerated',         fStats.totalGenerated >= 12);
assert('fed stats nodeStats array',        Array.isArray(fStats.nodeStats));

// Prefix strategy
const fed2 = uid.createFederation({ name: 'prefix-fed', strategy: 'prefix' });
const nodeC = fed2.join('service-alpha');
const nodeD = fed2.join('service-beta');
const pId1  = nodeC.generate();
const pId2  = nodeD.generate();
assert('prefix ids have underscore',       pId1.includes('_'));
assert('prefix ids start differently',     pId1.split('_')[0] !== pId2.split('_')[0]);
const vp1 = fed2.verify(pId1);
assert('prefix verify owner',              vp1.owner === 'service-alpha');

// Range strategy
const fed3 = uid.createFederation({ name: 'range-fed', strategy: 'range', rangeSize: 1000, idWidth: 10 });
const nodeE = fed3.join('shard-1');
const nodeF = fed3.join('shard-2');
const rId1  = nodeE.generate();
const rId2  = nodeF.generate();
assert('range ids are zero-padded numbers', /^\d{10}$/.test(rId1));
assert('range ids in different ranges',     rId1 !== rId2);
const vr1 = fed3.verify(rId1);
assert('range verify owner',               vr1.owner === 'shard-1');
const vr2 = fed3.verify(rId2);
assert('range verify owner shard-2',       vr2.owner === 'shard-2');

// Epoch strategy
const fed4 = uid.createFederation({ name: 'epoch-fed', strategy: 'epoch', epochWindowMs: 60_000 });
const nodeG = fed4.join('worker-1');
const eId1  = nodeG.generate();
assert('epoch id has underscores',         eId1.split('_').length === 3);
const ve1 = fed4.verify(eId1);
assert('epoch verify finds owner',         ve1.owner === 'worker-1');

// Leave
nodeG.leave();
assert('leave removes from federation',    fed4.stats().nodes === 0);

// parseSnowflake64
const parsed64 = uid.parseSnowflake64(sfId1);
assert('parseSnowflake64 has date',        parsed64.date instanceof Date);
assert('parseSnowflake64 has machineId',   typeof parsed64.machineId === 'number');
assert('parseSnowflake64 date reasonable', parsed64.date.getFullYear() >= 2024);

// ═══════════════════════════════════════════════════════
section('📋 Feature C: GDPR / HIPAA Compliance Reports');

// PII scanner
const cleanId   = uid.nanoId();
const emailId   = `user_john.doe@example.com_${uid.nanoId({ size: 6 })}`;
const phoneId   = `ref_+1-555-867-5309_${uid.nanoId({ size: 6 })}`;
const ssnId     = `record_123-45-6789_end`;

const s1 = uid.scanForPII(cleanId);
assert('scanForPII clean id',              s1.clean === true);
assert('scanForPII no findings',           s1.findings.length === 0);
assert('scanForPII risk none',             s1.riskLevel === 'none');

const s2 = uid.scanForPII(emailId);
assert('scanForPII detects email',         !s2.clean);
assert('scanForPII email finding type',    s2.findings.some(f => f.type === 'email'));
assert('scanForPII email risk high',       s2.riskLevel === 'high');

const s3 = uid.scanForPII(ssnId);
assert('scanForPII detects SSN',           !s3.clean);
assert('scanForPII SSN risk critical',     s3.riskLevel === 'critical');

// scanBatch
const mixedIds = [cleanId, uid.nanoId(), emailId, phoneId, uid.uuid()];
const batch3   = uid.scanBatch(mixedIds);
assert('scanBatch total count',            batch3.summary.total === 5);
assert('scanBatch clean count',            batch3.summary.clean === 3);
assert('scanBatch flagged count',          batch3.summary.flagged === 2);
assert('scanBatch results array',          Array.isArray(batch3.results));

// verifyPseudonymization
const goodId = uid.nanoId({ size: 21 });
const vp     = uid.verifyPseudonymization(goodId);
assert('verifyPseudonymization good id',    vp.compliant === true);
assert('verifyPseudonymization has checks', Array.isArray(vp.checks));
assert('verifyPseudonymization gdprArticle', typeof vp.gdprArticle === 'string');
assert('verifyPseudonymization verdict',    typeof vp.verdict === 'string');

const badId = '12345'; // sequential integer
const vpBad = uid.verifyPseudonymization(badId);
assert('verifyPseudonymization bad id fails', vpBad.compliant === false);
assert('verifyPseudonymization flags sequential', vpBad.checks.some(c => c.name === 'not-sequential' && !c.passed));

// checkDataResidency
uid.registerTopology({ region: 'eu-central-1', dc: 1 });
const euTopoId = uid.topoId();
const dr1 = uid.checkDataResidency(euTopoId, { requiredFramework: 'GDPR' });
assert('checkDataResidency EU compliant',   dr1.compliant === true);
assert('checkDataResidency EU region',      dr1.region === 'DE');

uid.registerTopology({ region: 'us-east-1', dc: 1 });
const usTopoId = uid.topoId();
const dr2 = uid.checkDataResidency(usTopoId, { requiredFramework: 'GDPR' });
assert('checkDataResidency US not EU',      dr2.compliant === false);

const dr3 = uid.checkDataResidency(usTopoId, { requiredFramework: 'HIPAA' });
assert('checkDataResidency US HIPAA ok',    dr3.compliant === true);

const drUnknown = uid.checkDataResidency(cleanId, { requiredFramework: 'GDPR' });
assert('checkDataResidency unknown id',     drUnknown.compliant === null);

// generateComplianceReport
const testIds = [
  ...Array.from({ length: 20 }, () => uid.nanoId()),
  emailId,        // one PII violation
  badId,          // one pseudonymization failure
  euTopoId,       // EU residency
  usTopoId,       // non-EU
];

const report = uid.generateComplianceReport(testIds, {
  framework: 'GDPR',
  environment: 'test',
});
assert('report has reportId',              typeof report.reportId === 'string');
assert('report has generatedAt',           typeof report.generatedAt === 'string');
assert('report has verdict',               ['COMPLIANT','NON-COMPLIANT'].includes(report.verdict));
assert('report has piiScan',               report.piiScan.total === testIds.length);
assert('report pii flagged >= 1',          report.piiScan.flagged >= 1);
assert('report pseudonymization checked',  report.pseudonymization.checked > 0);
assert('report has recommendations',       Array.isArray(report.recommendations));
assert('report has legalReferences',       report.legalReferences.length > 0);
assert('report legalRefs include GDPR',    report.legalReferences.some(r => r.includes('GDPR')));

// formatReport
const formatted = uid.formatReport(report);
assert('formatReport is string',           typeof formatted === 'string');
assert('formatReport has verdict line',    formatted.includes('VERDICT'));
assert('formatReport has PII section',     formatted.includes('PII SCAN'));
assert('formatReport has GDPR refs',       formatted.includes('GDPR'));

// GDPR_ZONES / HIPAA_REGIONS exports
assert('GDPR_ZONES is Set',               uid.GDPR_ZONES instanceof Set);
assert('GDPR_ZONES includes DE',          uid.GDPR_ZONES.has('DE'));
assert('HIPAA_REGIONS is Set',            uid.HIPAA_REGIONS instanceof Set);
assert('HIPAA_REGIONS includes US',       uid.HIPAA_REGIONS.has('US'));

// ═══════════════════════════════════════════════════════
section('📊 Feature D: ID Analytics Dashboard');

// Setup
uid.telemetry.enable({ sampleRate: 1.0 });
uid.telemetry.reset();
for (let i = 0; i < 20; i++) uid.telemetry.record('nanoId', { latencyMs: Math.random() * 5 });
for (let i = 0; i < 10; i++) uid.telemetry.record('uuid',   { latencyMs: Math.random() * 2 });

const det2  = uid.createDetector({ namespace: 'dash-test' });
await det2.register(uid.nanoId());
await det2.register(uid.nanoId());

const fed5  = uid.createFederation({ name: 'dash-fed', strategy: 'snowflake' });
const nodeH = fed5.join('node-1');
nodeH.generate(); nodeH.generate();

const dash = uid.createDashboard({
  telemetry:   uid.telemetry,
  detectors:   new Map([['dash-test', det2]]),
  federations: new Map([['dash-fed',  fed5]]),
});

const snap = await dash.snapshot();
assert('snapshot has capturedAt',          typeof snap.capturedAt === 'string');
assert('snapshot has uptimeMs',            snap.uptimeMs >= 0);
assert('snapshot has uptimeHuman',         typeof snap.uptimeHuman === 'string');
assert('snapshot has generation',          snap.generation !== undefined);
assert('snapshot byType has nanoId',       (snap.generation.byType.nanoId ?? 0) >= 20);
assert('snapshot has latency section',     snap.latency !== null);
assert('snapshot latency has p99',         typeof snap.latency.p99 === 'number');
assert('snapshot has collisions section',  snap.collisions !== undefined);
assert('snapshot collisions registrations >=2', snap.collisions.registrations >= 2);
assert('snapshot collision byNamespace',   Array.isArray(snap.collisions.byNamespace));
assert('snapshot has federation section',  snap.federation !== undefined);
assert('snapshot federation nodes >= 1',   snap.federation.totalNodes >= 1);
assert('snapshot has alerts section',      snap.alerts !== undefined);
assert('snapshot alerts is array',         Array.isArray(snap.alerts.active));
assert('snapshot series is array',         Array.isArray(snap.generation.series));

// Second snapshot builds time series
const snap2 = await dash.snapshot();
assert('second snapshot increments count', snap2.snapshotCount === 2);
assert('series grows after 2 snaps',       snap2.generation.series.length >= 2);

// ASCII output
const ascii = await dash.ascii(snap);
assert('ascii is string',                  typeof ascii === 'string');
assert('ascii has border chars',           ascii.includes('─'));
assert('ascii has uptime',                 ascii.includes('uptime'));

// Custom alert
const dash2 = uid.createDashboard({ telemetry: uid.telemetry });
dash2.addAlert({
  name:      'test-alert',
  severity:  'info',
  condition: m => true, // always fires
  message:   'Test alert fired',
});
const snap3 = await dash2.snapshot();
assert('custom alert fires',               snap3.alerts.active.some(a => a.name === 'test-alert'));
assert('custom alert has severity',        snap3.alerts.active[0]?.severity !== undefined);

// TimeSeriesBuffer
const tsb = new uid.TimeSeriesBuffer(5);
[10, 20, 30, 40, 50].forEach(v => tsb.push(v));
assert('TimeSeriesBuffer length',          tsb.length === 5);
assert('TimeSeriesBuffer movingAvg',       tsb.movingAvg() === 30);
tsb.push(60); // should evict 10
assert('TimeSeriesBuffer evicts old',      tsb.length === 5);
assert('TimeSeriesBuffer latest',          tsb.latest.value === 60);

// watch / stopWatching
let watchCount = 0;
dash.watch(50, () => watchCount++);
await new Promise(r => setTimeout(r, 160));
dash.stopWatching();
assert('watch called multiple times',      watchCount >= 2);

uid.telemetry.disable();

// ═══════════════════════════════════════════════════════
section('🔵 All v3 + v4 features still pass');
assert('uuid works',    /^[0-9a-f-]{36}$/.test(uid.uuid()));
assert('nanoId works',  uid.nanoId().length === 21);
assert('fuzzyId works', typeof uid.fuzzyId() === 'string');
const cmp = uid.compoundId([uid.uuid(), uid.uuid()]);
assert('compoundId works', uid.splitId(cmp).valid);
const org = uid.hierarchyRoot({ label: 'org' });
assert('hierarchy works', uid.depthOf(org) === 0);
assert('rate limiter works', uid.createRateLimiter({ rate: 10, burst: 10 }).consume('x').allowed);
const mig = uid.migrateId(uid.uuid());
assert('migrateId works', uid.isMigrated(mig.newId));

// ═══════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(60)}`);
console.log(`  ✅ ${passed} passed    ❌ ${failed} failed`);
console.log('═'.repeat(60));
if (failed > 0) process.exit(1);

} // end run()

run().catch(e => { console.error(e); process.exit(1); });
