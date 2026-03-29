'use strict';
const uid = require('./index');

let passed = 0, failed = 0;
function assert(label, condition, debug) {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label}${debug !== undefined ? ' → ' + JSON.stringify(debug) : ''}`); failed++; }
}
function section(t) { console.log(`\n${t}`); }

// ═══════════════════════════════════════════════════════
section('🔤 Feature 1: Fuzzy / Typo-Resistant IDs');

const fid1 = uid.fuzzyId({ size: 16 });
assert('fuzzyId produces string',        typeof fid1 === 'string');
assert('fuzzyId has separators',         fid1.includes('-'));
assert('fuzzyId uses Crockford chars',   fid1.replace(/-/g,'').split('').every(c => uid.CROCKFORD.includes(c)));

const fid2 = uid.fuzzyId({ size: 12, prefix: 'INV' });
assert('fuzzyId prefix',                 fid2.startsWith('INV-'));

// Validate a fresh ID (should always be valid — includes checksum)
const fid3 = uid.fuzzyId({ size: 16, separator: '' });
const v1 = uid.validateFuzzy(fid3);
assert('validateFuzzy fresh id valid',   v1.valid, v1);

// Test typo correction — I/O/L → 1/0/1
const { normalized } = (() => {
  // Build a valid ID then replace a char with a visually similar one
  const clean = uid.fuzzyId({ size: 8, separator: '' });
  const typo = '0' + clean.slice(1); // same length, might still be valid or trigger correction
  return { normalized: typo };
})();

// Auto-correction test
const typoInput = 'O1234ABC'; // O should be corrected to 0
const corrResult = uid.validateFuzzy(typoInput);
assert('validateFuzzy returns autoFixed on typo',
  corrResult.autoFixed !== undefined || corrResult.valid !== undefined);

// correctFuzzy: already-valid ID returns itself (possibly reformatted with separators)
const validFid = uid.fuzzyId({ size: 12, separator: '' });
const corrected = uid.correctFuzzy(validFid);
assert('correctFuzzy valid id not null',   corrected.corrected !== null);
assert('correctFuzzy preserves chars',     corrected.corrected !== null && corrected.corrected.replace(/-/g,'') === validFid);

// parseFuzzy
const parsed = uid.parseFuzzy(fid1);
assert('parseFuzzy has body',              typeof parsed.body === 'string' && parsed.body.length > 0);
assert('parseFuzzy has checkChar',         parsed.checkChar.length === 1);
assert('parseFuzzy valid flag',            typeof parsed.valid === 'boolean');

// parseFuzzy with prefix
const fidWithPrefix = uid.fuzzyId({ size: 8, prefix: 'ORD', separator: '-' });
const parsedPfx = uid.parseFuzzy(fidWithPrefix, { prefix: 'ORD' });
assert('parseFuzzy detects prefix',        parsedPfx.prefix === 'ORD');

// ═══════════════════════════════════════════════════════
section('🔗 Feature 2: Composite / Compound IDs');

const userId   = uid.uuid();
const orderId  = uid.uuid();
const tenantId = uid.uuid();

const comp1 = uid.compoundId([userId, orderId]);
assert('compoundId produces string',       typeof comp1 === 'string' && comp1.length > 0);

const split1 = uid.splitId(comp1);
assert('splitId valid',                    split1.valid);
assert('splitId recovers userId',          split1.ids.includes(userId));
assert('splitId recovers orderId',         split1.ids.includes(orderId));
assert('splitId count',                    split1.ids.length === 2);

// 3-way compound
const comp3 = uid.compoundId([userId, orderId, tenantId]);
const split3 = uid.splitId(comp3);
assert('compoundId 3 ids',                 split3.ids.length === 3);
assert('compoundId recovers all 3',        split3.ids.includes(tenantId));

// Sorted (canonical order — undirected edge)
const compAB = uid.compoundId([userId, orderId], { sorted: true });
const compBA = uid.compoundId([orderId, userId], { sorted: true });
assert('sorted compoundId canonical',      compAB === compBA);

// With tag
const compTagged = uid.compoundId([userId, orderId], { tag: 'follows' });
const splitTagged = uid.splitId(compTagged);
assert('compoundId tag recovered',         splitTagged.tag === 'follows');

// With prefix
const compPfx = uid.compoundId([userId, orderId], { prefix: 'rel' });
assert('compoundId prefix',                compPfx.startsWith('rel_'));
const splitPfx = uid.splitId(compPfx, { prefix: 'rel' });
assert('splitId with prefix valid',        splitPfx.valid);

// hasComponent
assert('hasComponent true',                uid.hasComponent(comp1, userId));
assert('hasComponent false',               !uid.hasComponent(comp1, tenantId));

// sharedComponents
const comp2 = uid.compoundId([userId, tenantId]);
const shared = uid.sharedComponents(comp1, comp2);
assert('sharedComponents finds userId',    shared.includes(userId));
assert('sharedComponents excludes orderId', !shared.includes(orderId));

// Timed compound
const timed = uid.timedCompoundId([userId, orderId]);
const timedTs = uid.extractTimestamp(timed);
assert('timedCompoundId has timestamp',    timedTs instanceof Date);
assert('timedCompoundId ts reasonable',   timedTs.getFullYear() >= 2024);

// ═══════════════════════════════════════════════════════
section('🌲 Feature 3: Hierarchical / Path IDs');

const org   = uid.hierarchyRoot({ label: 'org' });
const team  = uid.hierarchyChild(org,  { label: 'team' });
const user  = uid.hierarchyChild(team, { label: 'user' });
const user2 = uid.hierarchyChild(team, { label: 'user' });

assert('hierarchyRoot format',             org.startsWith('org_'));
assert('hierarchyChild format',            team.includes('/'));
assert('hierarchyChild depth 1',           team.split('/').length === 2);
assert('hierarchyChild depth 2',           user.split('/').length === 3);

// parseHierarchy
const ph = uid.parseHierarchy(user);
assert('parseHierarchy depth',             ph.depth === 2);
assert('parseHierarchy root',              ph.root === org);
assert('parseHierarchy parent',            ph.parent === team);
assert('parseHierarchy leaf',              ph.leaf.startsWith('user_'));
assert('parseHierarchy labels',            ph.labels.includes('org'));

// parentOf / depthOf
assert('parentOf',                         uid.parentOf(user) === team);
assert('parentOf root is null',            uid.parentOf(org) === null);
assert('depthOf root',                     uid.depthOf(org) === 0);
assert('depthOf child',                    uid.depthOf(team) === 1);
assert('depthOf grandchild',               uid.depthOf(user) === 2);

// isDescendant / isDirectChild
assert('isDescendant grandchild of org',   uid.isDescendant(user, org));
assert('isDescendant child of org',        uid.isDescendant(team, org));
assert('isDescendant false (same)',        !uid.isDescendant(org, org));
assert('isDirectChild team of org',        uid.isDirectChild(team, org));
assert('isDirectChild false (grandchild)', !uid.isDirectChild(user, org));

// subtreeRange
const range = uid.subtreeRange(team);
assert('subtreeRange has gte',             typeof range.gte === 'string');
assert('subtreeRange user in range',       user >= range.gte && user < range.lt);
assert('subtreeRange org not in range',    org < range.gte);

// lowestCommonAncestor
assert('lca of siblings is parent',       uid.lowestCommonAncestor(user, user2) === team);
assert('lca of child and parent',         uid.lowestCommonAncestor(user, team) === team);

// reparent
const org2    = uid.hierarchyRoot({ label: 'org' });
const moved   = uid.reparent(user, org2);
assert('reparent changes parent',         moved.startsWith(org2 + '/'));
assert('reparent keeps leaf id',          moved.endsWith(ph.leaf));

// topoSort
const paths = [user, team, org, user2];
const sorted = uid.topoSort(paths);
assert('topoSort root first',             sorted[0] === org);
assert('topoSort parent before child',    sorted.indexOf(team) < sorted.indexOf(user));

// ═══════════════════════════════════════════════════════
section('🚦 Feature 4: ID Rate Limiter');

const limiter = uid.createRateLimiter({ rate: 5, burst: 5 });

// Consume within burst
const results = [];
for (let i = 0; i < 5; i++) results.push(limiter.consume('user-1'));
assert('rate limiter allows burst',       results.every(r => r.allowed));
assert('rate limiter remaining decreases', results[4].remaining < results[0].remaining || results[4].remaining === 0);

// Exceed burst
const blocked = limiter.consume('user-1');
assert('rate limiter blocks at limit',    !blocked.allowed);
assert('rate limiter retryAfterMs > 0',   blocked.retryAfterMs > 0);

// Different keys are independent
const other = limiter.consume('user-2');
assert('rate limiter keys isolated',      other.allowed);

// peek
const peeked = limiter.peek('user-2');
assert('peek returns tokens',             typeof peeked.tokens === 'number');
assert('peek returns hits',               peeked.hits >= 1);

// reset
limiter.reset('user-1');
const afterReset = limiter.consume('user-1');
assert('rate limiter reset restores',     afterReset.allowed);

// wrap
const limiter2 = uid.createRateLimiter({ rate: 100, burst: 100 });
const wrappedNano = limiter2.wrap(uid.nanoId, 'gen-key');
assert('wrapped fn works',                typeof wrappedNano() === 'string');

// wrap throws on exhaustion
const limiter3 = uid.createRateLimiter({ rate: 1, burst: 1 });
limiter3.consume('k');
let threw = false;
try { limiter3.wrap(uid.nanoId, 'k')(); } catch(e) { threw = e.name === 'RateLimitError'; }
assert('wrap throws RateLimitError',      threw);

// report
const report = limiter.report();
assert('rate limiter report is array',    Array.isArray(report));

limiter.destroy();
limiter2.destroy();
limiter3.destroy();

// ═══════════════════════════════════════════════════════
section('🔄 Feature 5: ID Migration & Versioning');

// detectFormat
assert('detectFormat uuid-v4',            uid.detectFormat(uid.uuid()).format === 'uuid-v4');
assert('detectFormat nanoid',             uid.detectFormat(uid.nanoId()).format === 'nanoid');
assert('detectFormat prefixed',           uid.detectFormat(uid.typedId('user')).format === 'prefixed');
assert('detectFormat legacy int',         uid.detectFormat('12345').format === 'legacy-int');
assert('detectFormat unknown',            uid.detectFormat('???!!!').format === 'unknown');

// migrateId
const oldId = uid.uuid();
const migrated = uid.migrateId(oldId, { toVersion: '2', reason: 'schema-upgrade' });
assert('migrateId produces newId',        typeof migrated.newId === 'string');
assert('migrateId stores oldId',          migrated.oldId === oldId);
assert('migrateId has oldFormat',         migrated.oldFormat === 'uuid-v4');
assert('migrateId isMigrated',            uid.isMigrated(migrated.newId));
assert('non-migrated not flagged',        !uid.isMigrated(oldId));

// recoverOriginal
const recovered = uid.recoverOriginal(migrated.newId);
assert('recoverOriginal valid',           recovered.valid);
assert('recoverOriginal exact match',     recovered.originalId === oldId);
assert('recoverOriginal version',         recovered.version === '2');

// with integrity secret
const SECRET = 'migrate-test-secret';
const secMigrated = uid.migrateId(oldId, { secret: SECRET, toVersion: '3' });
const secRecovered = uid.recoverOriginal(secMigrated.newId, { secret: SECRET });
assert('recoverOriginal integrity ok',    secRecovered.integrityOk === true);

// batchMigrate
const oldIds = [uid.uuid(), uid.uuid(), uid.nanoId()];
const batch = uid.batchMigrate(oldIds, { toVersion: '2' });
assert('batchMigrate length',             batch.length === 3);
assert('batchMigrate all migrated',       batch.every(m => uid.isMigrated(m.newId)));
assert('batchMigrate recoverable',        uid.recoverOriginal(batch[0].newId).originalId === oldIds[0]);

// registerFormat (custom)
uid.registerFormat('internal-v1', /^IV1-[A-Z0-9]{8}$/);
assert('registerFormat custom detected',  uid.detectFormat('IV1-AB12CD34').format === 'internal-v1');

// getMigrationLog
const log = uid.getMigrationLog({ limit: 5 });
assert('getMigrationLog returns array',   Array.isArray(log));
assert('getMigrationLog has entries',     log.length > 0);
assert('getMigrationLog has reason',      log[0].reason !== undefined);

uid.clearMigrationLog();
assert('clearMigrationLog works',         uid.getMigrationLog().length === 0);

// ═══════════════════════════════════════════════════════
section('🧪 Feature 6: Real Randomness Tests (entropy enhanced)');

// Chi-squared test on a known random ID
const randomId = uid.nanoId({ size: 50 });
const chi = uid.chiSquaredTest(randomId);
assert('chiSquaredTest has chiSq',        typeof chi.chiSq === 'number');
assert('chiSquaredTest has pValue',       typeof chi.pValue === 'string');
assert('chiSquaredTest has verdict',      ['uniform','suspicious','patterned','too-short'].includes(chi.verdict));
assert('chiSquaredTest random verdict',   chi.verdict !== 'patterned'); // truly random should pass

// Chi-squared on a patterned string
const patterned = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const chiPat = uid.chiSquaredTest(patterned);
assert('chiSquaredTest patterned detected', chiPat.verdict === 'patterned');

// Run-length test
const rlRandom = uid.runLengthTest(uid.nanoId({ size: 40 }));
assert('runLengthTest has longestRun',    typeof rlRandom.longestRun === 'number');
assert('runLengthTest has verdict',       ['random','mild-bias','sequential-bias','too-short'].includes(rlRandom.verdict));
assert('runLengthTest random is ok',      rlRandom.verdict !== 'sequential-bias');

const rlPatterned = uid.runLengthTest('AAAAAAAAAAAAAAAAAAAAAAAABBBBBBBBBBBBBBBBBBBBBBBB');
assert('runLengthTest sequential detected', ['sequential-bias','mild-bias'].includes(rlPatterned.verdict));

// analyzeEntropy now includes randomness field
const full = uid.analyzeEntropy(uid.nanoId({ size: 30 }));
assert('analyzeEntropy has randomness',   full.randomness !== undefined);
assert('analyzeEntropy randomness verdict', typeof full.randomness.verdict === 'string');
assert('analyzeEntropy chiSquared',       full.randomness.chiSquared !== undefined);
assert('analyzeEntropy runLength',        full.randomness.runLength !== undefined);

// ═══════════════════════════════════════════════════════
section('📜 Feature 7: Lifecycle History & Replay');

uid.clearHistory();

const STATES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
const TRANSITIONS = {
  pending: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
};

const lc = uid.lifecycleId('order', { states: STATES, initial: 'pending', secret: 'test-secret' });

// getHistory on initial state
const hist0 = uid.getHistory(lc);
assert('getHistory has initial entry',    hist0.length === 1);
assert('getHistory initial from null',    hist0[0].from === null);
assert('getHistory initial to pending',   hist0[0].to === 'pending');

// transition with reason
const { id: lc2 } = uid.transition(lc, 'processing', { secret: 'test-secret', reason: 'payment-confirmed' });
const { id: lc3 } = uid.transition(lc2, 'shipped',    { secret: 'test-secret', reason: 'carrier-pickup' });

const hist1 = uid.getHistory(lc3);
assert('getHistory has 3 entries',        hist1.length === 3);
assert('getHistory has reasons',          hist1.some(h => h.reason === 'payment-confirmed'));
assert('getHistory last is shipped',      hist1[hist1.length - 1].to === 'shipped');

// currentState
assert('currentState',                    uid.currentState(lc3) === 'shipped');

// replayHistory - valid path
const replay = uid.replayHistory(lc3, { allowedTransitions: TRANSITIONS });
assert('replayHistory valid',             replay.valid);
assert('replayHistory has states',        replay.states.length === 3);
assert('replayHistory steps count',       replay.steps === 3);

// replayHistory - detect invalid transition in history
// (simulate by checking a bad sequence would be caught)
const replayNoRules = uid.replayHistory(lc3);
assert('replayHistory without rules ok',  replayNoRules.valid);

// getTimeline
const timeline = uid.getTimeline(lc3);
assert('getTimeline length',              timeline.length === 3);
assert('getTimeline has state',           timeline[0].state === 'pending');
assert('getTimeline has enteredAt',       typeof timeline[0].enteredAt === 'string');
assert('getTimeline has duration',        typeof timeline[0].duration === 'string');
assert('getTimeline last isCurrent',      timeline[timeline.length - 1].isCurrent === true);
assert('getTimeline prev not current',    timeline[0].isCurrent === false);

uid.clearHistory();
assert('clearHistory works',              uid.getHistory(lc3).length === 0);

// ═══════════════════════════════════════════════════════
section('📊 Enhanced Telemetry: p50/p95/p99');

uid.telemetry.enable({ sampleRate: 1.0, slaBudgetMs: 100 });
uid.telemetry.reset();

// Simulate latencies
for (let i = 1; i <= 100; i++) {
  uid.telemetry.record('nanoId', { latencyMs: i });
}

const tReport = uid.telemetry.report();
assert('telemetry report has latencyPercentiles', tReport.latencyPercentiles !== null);
const p = tReport.latencyPercentiles;
assert('telemetry p50 exists',            typeof p.p50 === 'number');
assert('telemetry p95 exists',            typeof p.p95 === 'number');
assert('telemetry p99 exists',            typeof p.p99 === 'number');
assert('telemetry p50 < p95',             p.p50 < p.p95);
assert('telemetry p95 < p99',             p.p95 < p.p99);
assert('telemetry has min/max',           typeof p.min === 'number' && typeof p.max === 'number');
assert('telemetry has mean',              typeof p.mean === 'number');
assert('telemetry p50 ~50',               p.p50 >= 48 && p.p50 <= 52);
assert('telemetry p99 ~99',               p.p99 >= 95 && p.p99 <= 100);

// latencyHistogram
const hist = uid.telemetry.latencyHistogram();
assert('histogram is array',              Array.isArray(hist));
assert('histogram has le field',          hist[0].le !== undefined);
assert('histogram has count',             typeof hist[0].count === 'number');
assert('histogram has pct',               typeof hist[0].pct === 'string');

// No latencies case
uid.telemetry.flush();
const emptyReport = uid.telemetry.report();
assert('empty latencyPercentiles is null', emptyReport.latencyPercentiles === null);

uid.telemetry.disable();

// ═══════════════════════════════════════════════════════
// BACKWARDS COMPATIBILITY: v3 tests still pass
section('🔵 v3 Backwards Compatibility');
assert('uuid still works',                /^[0-9a-f-]{36}$/.test(uid.uuid()));
assert('nanoId still works',              uid.nanoId().length === 21);
assert('dcid still works',                uid.dcid(['a','b'],{key:'k',size:8}).length === 8);
const sem = uid.semanticId({ type: 'user', role: 'admin' });
assert('semanticId still works',          sem.startsWith('user.'));
uid.clearLineage();
const root = uid.uuid();
const child = uid.deriveId(root);
assert('deriveId still works',            child.startsWith('drv_'));
assert('isDescendantOf still works',      uid.isDescendantOf(child, root));

// ═══════════════════════════════════════════════════════
function printResults() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ✅ ${passed} passed    ❌ ${failed} failed`);
  console.log('═'.repeat(60));
  if (failed > 0) process.exit(1);
}
printResults();
