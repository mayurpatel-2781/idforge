/* eslint-env es2020 */
'use strict';

/**
 * benchmark.js — Performance Benchmark Suite
 * Tests all ID generators for speed and uniqueness.
 * Run: node benchmark.js
 */

const uid = require('./index');

const ITERATIONS = 100_000;
const COL1 = 32;
const COL2 = 14;
const COL3 = 14;
const COL4 = 14;

function bench(label, fn, iterations = ITERATIONS) {
  // Warmup
  for (let i = 0; i < 100; i++) fn();

  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) fn();
  const end   = process.hrtime.bigint();

  const totalMs = Number(end - start) / 1_000_000;
  const opsPerSec = Math.floor(iterations / (totalMs / 1000));
  const nsPerOp   = Number(end - start) / iterations;

  return { label, totalMs, opsPerSec, nsPerOp, iterations };
}

function header(title) {
  console.log(`\n${'═'.repeat(COL1 + COL2 + COL3 + COL4 + 6)}`);
  console.log(`  ${title}`);
  console.log(`${'─'.repeat(COL1 + COL2 + COL3 + COL4 + 6)}`);
  console.log(
    '  ' +
    'Generator'.padEnd(COL1) +
    'ops/sec'.padStart(COL2) +
    'ns/op'.padStart(COL3) +
    'total(ms)'.padStart(COL4)
  );
  console.log(`${'─'.repeat(COL1 + COL2 + COL3 + COL4 + 6)}`);
}

function row(r) {
  console.log(
    '  ' +
    r.label.padEnd(COL1) +
    r.opsPerSec.toLocaleString().padStart(COL2) +
    r.nsPerOp.toFixed(1).padStart(COL3) +
    r.totalMs.toFixed(1).padStart(COL4)
  );
}

// ── Run Benchmarks ────────────────────────────────────────────────────────────

console.log('\n🚀 uuid-lab Benchmark Suite');
console.log(`   Iterations per test: ${ITERATIONS.toLocaleString()}`);
console.log(`   Node.js: ${process.version}`);

header('Core ID Generators');
[
  bench('uuid (crypto.randomUUID)',    () => uid.uuid()),
  bench('uuidV4',                      () => uid.uuidV4()),
  bench('uuidV7',                      () => uid.uuidV7()),
  bench('nanoId (21 chars)',           () => uid.nanoId()),
  bench('nanoId (8 chars)',            () => uid.nanoId({ size: 8 })),
  bench('ulid',                        () => uid.ulid()),
  bench('ksuid',                       () => uid.ksuid()),
  bench('snowflakeId',                 () => uid.snowflakeId()),
  bench('typedId',                     () => uid.typedId('user')),
  bench('humanId',                     () => uid.humanId()),
  bench('sequentialId',                () => uid.sequentialId()),
].forEach(row);

header('Format & Encoding');
[
  bench('prefixedId',                  () => uid.prefixedId('usr')),
  bench('shortId (8)',                 () => uid.shortId()),
  bench('base62Id',                    () => uid.base62Id()),
  bench('base36Id',                    () => uid.base36Id()),
  bench('urlSafeId',                   () => uid.urlSafeId()),
  bench('visualId',                    () => uid.visualId()),
  bench('compactId',                   () => uid.compactId()),
  bench('meaningfulId',                () => uid.meaningfulId()),
  bench('pronounceableId',             () => uid.pronounceableId()),
  bench('timestampId',                 () => uid.timestampId()),
].forEach(row);

header('Advanced');
[
  bench('hashId',                      () => uid.hashId('input')),
  bench('shortHashId',                 () => uid.shortHashId('input')),
  bench('seededId',                    () => uid.seededId('my-seed')),
  bench('offlineId',                   () => uid.offlineId()),
  bench('entropyId (128 bits)',         () => uid.entropyId({ bits: 128 })),
  bench('adaptiveId',                  () => uid.adaptiveId()),
  bench('compressId (uuid)',           () => uid.compressId(uid.uuid())),
].forEach(row);

header('Security');
[
  bench('signId',                      () => uid.signId(uid.nanoId(), 'secret')),
  bench('encryptId',                   () => uid.encryptId(12345, 'key')),
  bench('expiringId',                  () => uid.expiringId()),
  bench('otpToken',                    () => uid.otpToken()),
  bench('fuzzyId',                     () => uid.fuzzyId()),
].forEach(row);

header('Batch Operations');
[
  bench('batch(nanoId, 100)',          () => uid.batch(uid.nanoId, 100), 1_000),
  bench('batchUnique(nanoId, 100)',    () => uid.batchUnique(uid.nanoId, 100), 1_000),
  bench('decodeBatch (100 uuids)',     () => uid.decodeBatch(Array.from({length:100}, uid.uuid)), 1_000),
].forEach(row);

header('Pool Performance');
const pool = uid.createHighPerfPool(uid.nanoId, { size: 500 });
[
  bench('pool.get() (pre-filled)',     () => pool.get()),
  bench('createPool.get()',            () => uid.createPool(uid.nanoId).get()),
].forEach(row);

header('Decode & Parse');
const _uuid = uid.uuid();
const _ulid = uid.ulid();
const _sf   = uid.snowflakeId();
[
  bench('decodeId (uuid)',             () => uid.decodeId(_uuid)),
  bench('decodeId (ulid)',             () => uid.decodeId(_ulid)),
  bench('decodeId (snowflake)',        () => uid.decodeId(_sf)),
  bench('parseId (uuid)',              () => uid.parseId(_uuid)),
  bench('inspectId (uuid)',            () => uid.inspectId(_uuid)),
].forEach(row);

// ── Uniqueness Check ──────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(COL1 + COL2 + COL3 + COL4 + 6));
console.log('  Uniqueness Verification (10,000 each)');
console.log('─'.repeat(COL1 + COL2 + COL3 + COL4 + 6));

const N = 10_000;
function checkUnique(label, fn) {
  const ids = Array.from({ length: N }, fn);
  const unique = new Set(ids).size;
  const pct    = ((unique / N) * 100).toFixed(4);
  const ok     = unique === N ? '✅' : '❌';
  console.log(`  ${ok} ${label.padEnd(COL1 - 4)} ${String(unique).padStart(6)}/${N} (${pct}%)`);
}

checkUnique('uuid',         uid.uuid);
checkUnique('nanoId',       uid.nanoId);
checkUnique('ulid',         uid.ulid);
checkUnique('ksuid',        uid.ksuid);
checkUnique('snowflakeId',  uid.snowflakeId);
checkUnique('shortId (8)',  uid.shortId);
checkUnique('fuzzyId',      uid.fuzzyId);
checkUnique('compactId',    uid.compactId);
checkUnique('timestampId',  uid.timestampId);
checkUnique('seededId',     () => uid.seededId(uid.nanoId())); // different seeds

console.log('\n' + '═'.repeat(COL1 + COL2 + COL3 + COL4 + 6));
console.log('  ✅ Benchmark complete\n');
