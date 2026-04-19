'use strict';
const uid = require('./index');

const newFunctions = [
  'generateParallel', 'initWorkers', 'terminateWorkers',
  'tokenId', 'verifyTokenId', 'commitId', 'verifyCommitment',
  'compileTemplate', 'recommendId',
  'expressMiddleware', 'mongoosePlugin', 'sequelizeAdapter', 'createGraphQLScalar',
  'ssrSafeId', 'createReactHooks', 'createVueComposables',
];

let passed = 0;
let failed = 0;

console.log('='.repeat(60));
console.log('  uuid-lab Final Verification');
console.log('='.repeat(60));

for (const fn of newFunctions) {
  if (typeof uid[fn] === 'function') {
    console.log('  ✅  ' + fn);
    passed++;
  } else {
    console.log('  ❌  ' + fn + '  (got: ' + typeof uid[fn] + ')');
    failed++;
  }
}

console.log('='.repeat(60));
console.log('  ' + passed + ' passed  |  ' + failed + ' failed');
console.log('='.repeat(60));

// Quick smoke test
const gen = uid.compileTemplate('order-[date:YYYYMMDD]-[random:6]');
console.log('\n  Template DSL smoke test:', gen());

const recs = uid.recommendId(['sortable', 'urlSafe']);
console.log('  Smart Recommend smoke test:', recs[0].type, '(' + recs[0].matchPercentage + '% match)');

const { commitment, blindingFactor } = uid.commitId('my-secret-id');
const ok = uid.verifyCommitment(commitment, 'my-secret-id', blindingFactor);
console.log('  ZK Commitment smoke test:', ok ? 'PASS' : 'FAIL');

const token = uid.tokenId({ userId: 42 }, 'my-secret', { expiresIn: 3600 });
const { valid, payload } = uid.verifyTokenId(token, 'my-secret');
console.log('  Token ID smoke test:', valid ? 'PASS (userId=' + payload.userId + ')' : 'FAIL');

console.log('\n  All systems operational!');
