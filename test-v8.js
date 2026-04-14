'use strict';
const uid = require('./index');

let passed = 0, failed = 0;
function assert(label, condition, debug) {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label}${debug !== undefined ? ' → ' + JSON.stringify(debug) : ''}`); failed++; }
}
function section(t) { console.log(`\n${t}`); }

// ══════════════════════════════════════════════════════
section('⛓️  Blockchain-style ID Chain');

const chain = uid.createChain({ secret: 'test-secret' });
const g = chain.genesis({ data: 'first block' });
assert('genesis returns id',         typeof g === 'string');
assert('chain length 1',             chain.length === 1);
assert('genesis block exists',       chain.contains(g));

const id2 = chain.append({ data: 'second block' });
const id3 = chain.append({ data: 'third block' });
assert('append returns id',          typeof id2 === 'string');
assert('chain length 3',             chain.length === 3);
assert('chain contains id2',         chain.contains(id2));

const v = chain.verify();
assert('chain verify valid',         v.valid);
assert('chain verify length',        v.length === 3);
assert('chain verify no violations', v.violations.length === 0);

const block = chain.getBlock(id2);
assert('getBlock has id',            block.id === id2);
assert('getBlock has index',         block.index === 1);
assert('getBlock has prevHash',      typeof block.prevHash === 'string');
assert('getBlock has hash',          typeof block.hash === 'string');

assert('allIds length',              chain.allIds.length === 3);
assert('latest is id3',              chain.latest.id === id3);

const exported = chain.export();
assert('export is array',            Array.isArray(exported));
assert('export length 3',            exported.length === 3);

const chain2 = uid.createChain({ secret: 'test-secret' });
chain2.import(exported);
assert('import length',              chain2.length === 3);
assert('imported verify valid',      chain2.verify().valid);

// QR ASCII
const qr = uid.idToQrAscii(uid.nanoId());
assert('idToQrAscii is string',      typeof qr === 'string');
assert('idToQrAscii has borders',    qr.includes('┌') && qr.includes('┘'));

// QR Data URL
const qrPromise = uid.idToQrDataUrl(uid.uuid());
assert('idToQrDataUrl returns promise', qrPromise instanceof Promise);

// ══════════════════════════════════════════════════════
section('🚀 High-Performance Pool');

const pool = uid.createHighPerfPool(uid.nanoId, { poolSize: 100, refillAt: 10, refillSize: 50 });
const p1 = pool.get();
const p2 = pool.get();
assert('pool.get returns string',    typeof p1 === 'string');
assert('pool.get unique',            p1 !== p2);
assert('pool.get nanoid length',     p1.length === 21);

const batch = pool.getBatch(10);
assert('pool.getBatch length',       batch.length === 10);
assert('pool.getBatch all unique',   new Set(batch).size === 10);

const stats = pool.stats();
assert('pool stats available',       typeof stats.available === 'number');
assert('pool stats hits',            stats.hits >= 12);
assert('pool stats hitRate',         typeof stats.hitRate === 'string');

pool.drain();
const afterDrain = pool.get(); // should still work via fallback
assert('pool works after drain',     typeof afterDrain === 'string');

pool.refill(50);
assert('pool refill increases pool', pool.stats().available >= 49);

// ══════════════════════════════════════════════════════
section('🌐 ESM Module');

// Test ESM file exists and has correct exports marker
const fs = require('fs');
const esmContent = fs.readFileSync('./esm.mjs', 'utf8');
assert('esm.mjs exists',             esmContent.length > 0);
assert('esm has export const uuid',  esmContent.includes('export const uuid'));
assert('esm has export default',     esmContent.includes('export default'));
assert('esm has nanoId export',      esmContent.includes('export const nanoId'));
assert('esm has createDetector',     esmContent.includes('export const createDetector'));
assert('esm has tree-shaking exports', esmContent.includes('export const analytics'));

// ══════════════════════════════════════════════════════
section('🌍 Browser Compatibility Layer');

const browserContent = fs.readFileSync('./browser.js', 'utf8');
assert('browser.js exists',          browserContent.length > 0);
assert('browser no require(crypto)', !browserContent.includes("require('crypto')"));
assert('browser has getRandomValues',browserContent.includes('getRandomValues'));
assert('browser has UuidLab global', browserContent.includes('window.UuidLab'));
assert('browser has nanoId',         browserContent.includes('function nanoId'));
assert('browser has uuid',           browserContent.includes('function uuid'));
assert('browser has ulid',           browserContent.includes('function ulid'));
assert('browser has emojiId',        browserContent.includes('function emojiId'));
assert('browser has scanForPII',     browserContent.includes('function scanForPII'));
assert('browser module.exports',     browserContent.includes('module.exports'));

// ══════════════════════════════════════════════════════
section('📦 Package Configuration');

const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
assert('package name uuid-lab',      pkg.name === 'uuid-lab');
assert('package has bin entry',      pkg.bin?.['uuid-lab'] === './bin/uuid-lab.js');
assert('exports has esm',            pkg.exports?.['./esm'] === './esm.mjs');
assert('exports has browser',        pkg.exports?.['./browser'] === './browser.js');
assert('exports has dot require',    pkg.exports?.['.']?.require === './index.js');
assert('exports has dot import',     pkg.exports?.['.']?.import === './esm.mjs');
assert('files has bin/',             pkg.files?.includes('bin/'));
assert('files has mjs',              pkg.files?.some(f => f.includes('mjs')));

// ══════════════════════════════════════════════════════
section('🖥️  CLI Executable');

const binContent = fs.readFileSync('./bin/uuid-lab.js', 'utf8');
assert('bin file exists',            binContent.length > 0);
assert('bin has shebang',            binContent.startsWith('#!/usr/bin/env node'));
assert('bin has generate cmd',       binContent.includes("case 'generate'"));
assert('bin has decode cmd',         binContent.includes("case 'decode'"));
assert('bin has scan cmd',           binContent.includes("case 'scan'"));
assert('bin has inspect cmd',        binContent.includes("case 'inspect'"));
assert('bin has compress cmd',       binContent.includes("case 'compress'"));
assert('bin has predict cmd',        binContent.includes("case 'predict'"));
assert('bin has formats cmd',        binContent.includes("case 'formats'"));
assert('bin has help cmd',           binContent.includes("case 'help'"));

// Test CLI execution
const { execSync } = require('child_process');
const out1 = execSync('node bin/uuid-lab.js generate nanoid').toString().trim();
assert('CLI generate nanoid',        out1.length === 21);

const out2 = execSync('node bin/uuid-lab.js generate uuid').toString().trim();
assert('CLI generate uuid',          /^[0-9a-f-]{36}$/.test(out2));

const out3 = execSync('node bin/uuid-lab.js generate nanoid --count 3').toString().trim();
assert('CLI generate --count 3',     out3.split('\n').length === 3);

const out4 = execSync('node bin/uuid-lab.js decode ' + out2).toString().trim();
assert('CLI decode uuid',            out4.includes('uuid-v4'));

const out5 = execSync('node bin/uuid-lab.js entropy ' + out1).toString().trim();
assert('CLI entropy has bits',       out5.includes('bits'));

const out6 = execSync('node bin/uuid-lab.js formats').toString().trim();
assert('CLI formats lists types',    out6.includes('nanoid'));

const out7 = execSync('node bin/uuid-lab.js generate meaningful --count 2').toString().trim();
assert('CLI meaningful count 2',     out7.split('\n').length === 2);

const out8 = execSync('node bin/uuid-lab.js generate emoji').toString().trim();
assert('CLI generate emoji',         typeof out8 === 'string' && out8.length > 0);

const out9 = execSync('node bin/uuid-lab.js compress ' + out2 + ' 2>&1').toString().trim();
assert('CLI compress uuid',          out9.includes('Compressed'));

// ══════════════════════════════════════════════════════
section('🔵 Full backwards compatibility');
assert('uuid',       /^[0-9a-f-]{36}$/.test(uid.uuid()));
assert('nanoId',     uid.nanoId().length === 21);
assert('hashId',     uid.hashId('test').length === 16);
assert('adaptiveId', uid.adaptiveId('session').startsWith('ses_'));
assert('chain',      uid.createChain().genesis().length > 0);
assert('highperf',   typeof uid.createHighPerfPool(uid.nanoId).get() === 'string');

// ══════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(60)}`);
console.log(`  ✅ ${passed} passed    ❌ ${failed} failed`);
console.log('═'.repeat(60));
if (failed > 0) process.exit(1);
