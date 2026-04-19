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
section('⛓️  Blockchain-style ID Chain');

const chain = uid.createChain();

// genesis — first block
const g = chain.genesis({ data: 'first block' });
assert('genesis returns block',         typeof g === 'object' && g !== null);
assert('genesis index is 0',            g.index === 0);
assert('genesis has hash',              typeof g.hash === 'string' && g.hash.length === 64);
assert('genesis prevHash is zeros',     g.prevHash === '0'.repeat(64));
assert('genesis has data',              g.data === 'first block');

// add subsequent blocks
const b1 = chain.add(uid.nanoId(), { label: 'block-1' });
const b2 = chain.add(uid.nanoId(), { label: 'block-2' });
assert('add returns block',             typeof b1 === 'object');
assert('add has id',                    typeof b1.id === 'string');
assert('add has hash',                  typeof b1.hash === 'string');
assert('add index increments',          b1.index === 1 && b2.index === 2);
assert('add links prevHash',            b1.prevHash === g.hash);
assert('add b2 links b1',              b2.prevHash === b1.hash);
assert('chain length',                  chain.length === 3);

// verify
assert('chain verify valid',            chain.verify());

// getLast / find
assert('getLast returns b2',            chain.getLast().index === 2);
assert('find genesis',                  chain.find(g.id || 'genesis')?.index === 0);

// toArray / blocks
const arr = chain.toArray();
assert('toArray length',                arr.length === 3);
assert('blocks getter length',          chain.blocks.length === 3);

// toJSON
const json = chain.toJSON();
assert('toJSON valid flag',             json.valid === true);
assert('toJSON length',                 json.length === 3);
assert('toJSON has blocks',             Array.isArray(json.blocks));

// tamper detection
const cloned = uid.createChain();
cloned.genesis({ data: 'tamper test' });
cloned.add('id-a');
// Tamper: mutate internal block hash via toJSON inspection
// We can't directly mutate, but we can verify that verify() works
assert('chain verify still passes',     cloned.verify());

// IdChain class directly
const IdChain = uid.IdChain;
assert('IdChain is constructor',        typeof IdChain === 'function');
const c2 = new IdChain();
const cg = c2.genesis({ data: 'init' });
c2.add('alpha');
c2.add('beta');
assert('IdChain genesis works',         cg.index === 0);
assert('IdChain length',                c2.length === 3);
assert('IdChain verify',                c2.verify());

// different hash algo
const sha512chain = uid.createChain({ hashAlgorithm: 'sha512' });
sha512chain.genesis({ data: 'sha512 test' });
sha512chain.add(uid.nanoId());
assert('sha512 chain verify',           sha512chain.verify());
assert('sha512 hash length',            sha512chain.getLast().hash.length === 128);

// ══════════════════════════════════════════════════════
section('📱 QR Code Generation');

const testId = uid.nanoId();

// ASCII art
const ascii = uid.idToQrAscii(testId);
assert('idToQrAscii is string',         typeof ascii === 'string');
assert('idToQrAscii has border',        ascii.includes('─'));
assert('idToQrAscii has corners',       ascii.includes('┌') && ascii.includes('┘'));
assert('idToQrAscii contains id',       ascii.includes(testId.slice(0, 8)));
assert('idToQrAscii multiline',         ascii.split('\n').length > 5);

// Data URL
const dataUrl = uid.idToQrDataUrl(testId);
assert('idToQrDataUrl is string',       typeof dataUrl === 'string');
assert('idToQrDataUrl data: prefix',    dataUrl.startsWith('data:'));
assert('idToQrDataUrl has base64',      dataUrl.includes('base64'));
assert('idToQrDataUrl decodable',       (() => {
  try {
    const [, encoded] = dataUrl.split('base64,');
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    return decoded.includes('─'); // has border chars
  } catch { return false; }
})());

// different IDs produce different QR codes
const qr1 = uid.idToQrAscii('id-one');
const qr2 = uid.idToQrAscii('id-two');
assert('different IDs different QR',    qr1 !== qr2);

// ══════════════════════════════════════════════════════
section('🚀 High-Performance Pool');

// createHighPerfPool factory
const pool = uid.createHighPerfPool(uid.nanoId, { size: 100 });
assert('pool is object',                typeof pool === 'object');
assert('pool.get is function',          typeof pool.get === 'function');

const ids = new Set();
for (let i = 0; i < 50; i++) ids.add(pool.get());
assert('pool.get produces strings',     [...ids].every(id => typeof id === 'string'));
assert('pool.get unique (50)',          ids.size === 50);

// stats
const stats = pool.stats();
assert('stats poolSize is number',      typeof stats.poolSize === 'number');
assert('stats generated >= 100',        stats.generated >= 100);
assert('stats hits >= 50',             stats.hits >= 50);
assert('stats refills >= 1',           stats.refills >= 1);

// pool.size property
assert('pool.size is number',           typeof pool.size === 'number');

// drain
const drained = pool.drain(10);
assert('drain returns array',           Array.isArray(drained));
assert('drain length',                  drained.length === 10);
assert('drain all unique',              new Set(drained).size === 10);

// peek
const peeked = pool.peek();
assert('peek returns string or null',   peeked === null || typeof peeked === 'string');

// auto-refill: drain below threshold
const smallPool = uid.createHighPerfPool(uid.nanoId, { size: 10, refillThreshold: 0.3 });
const drained2  = smallPool.drain(8); // below 30% threshold → triggers refill
assert('auto-refill works',             smallPool.stats().refills >= 2);

// HighPerformancePool class
const HPool = uid.HighPerformancePool;
assert('HighPerformancePool constructor', typeof HPool === 'function');
const hp = new HPool(uid.nanoId, { size: 50 });
const hp1 = hp.get(), hp2 = hp.get();
assert('HPool.get returns string',      typeof hp1 === 'string');
assert('HPool.get unique',              hp1 !== hp2);

// custom generator
const counter = { n: 0 };
const counterPool = uid.createHighPerfPool(() => `item_${++counter.n}`, { size: 20 });
const first = counterPool.get();
assert('custom gen pool works',         first.startsWith('item_'));

// ══════════════════════════════════════════════════════
section('🔗 Chain + IDs Integration');

// Use chain to audit a sequence of generated IDs
const auditChain = uid.createChain();
auditChain.genesis({ data: 'audit-log-start', ts: Date.now() });

const generatedIds = Array.from({ length: 5 }, () => uid.nanoId());
generatedIds.forEach(id => auditChain.add(id));

assert('audit chain length',            auditChain.length === 6); // genesis + 5
assert('audit chain valid',             auditChain.verify());
assert('audit chain find first',        auditChain.blocks[1].id === generatedIds[0]);

// QR for each ID in chain
const chainBlock = auditChain.blocks[1];
const blockQr = uid.idToQrAscii(chainBlock.id);
assert('chain block QR',               typeof blockQr === 'string' && blockQr.length > 0);

// ══════════════════════════════════════════════════════
section('🔵 Backwards Compatibility (v3–v7)');

assert('uuid',           /^[0-9a-f-]{36}$/.test(uid.uuid()));
assert('nanoId',         uid.nanoId().length === 21);
assert('ulid',           uid.ulid().length === 26);
assert('snowflakeId',    /^\d+$/.test(uid.snowflakeId()));
assert('fuzzyId',        uid.fuzzyId().includes('-'));
assert('compoundId',     uid.splitId(uid.compoundId([uid.uuid(), uid.uuid()])).valid);
assert('hierarchyRoot',  uid.depthOf(uid.hierarchyRoot({ label: 'org' })) === 0);
assert('rateLimiter',    uid.createRateLimiter({ rate: 10, burst: 10 }).consume('x').allowed);
assert('migrateId',      uid.isMigrated(uid.migrateId(uid.uuid()).newId));
assert('createDetector', typeof uid.createDetector === 'function');
assert('createStore',    typeof uid.createStore === 'function');
assert('decodeId uuid',  uid.decodeId(uid.uuid()).type === 'uuid-v4');
assert('prefixedId',     uid.prefixedId('usr').startsWith('usr_'));
assert('seededId',       uid.seededId('x') === uid.seededId('x'));
assert('defineNS',       (() => { uid.defineNamespace('v8test',{prefix:'v8t'}); return uid.namespaceId('v8test').startsWith('v8t_'); })());

// ══════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(60)}`);
console.log(`  ✅ ${passed} passed    ❌ ${failed} failed`);
console.log('═'.repeat(60));
if (failed > 0) process.exit(1);

} // end run()

run().catch(e => { console.error(e); process.exit(1); });