/* eslint-env es2020 */
'use strict';

/**
 * test-fuzz.js — Fuzz Testing
 * ───────────────────────────
 * Feeds random garbage data into the parsing and validation
 * functions to ensure they handle invalid input gracefully without crashing.
 */

const crypto = require('crypto');
const uid = require('./index');

const ITERATIONS = 10000;
let crashes = 0;

console.log(`Starting fuzz testing with ${ITERATIONS} iterations...`);

for (let i = 0; i < ITERATIONS; i++) {
  // Generate random garbage string
  const garbage = crypto.randomBytes(Math.floor(Math.random() * 64)).toString('ascii');
  
  try {
    uid.parse(garbage);
    uid.validate(garbage);
    uid.detectType(garbage);
    uid.decompressId(garbage);
    uid.checkExpiry(garbage);
    uid.verifyTokenId(garbage, 'secret');
  } catch (err) {
    // We expect some functions to throw TypeError or specific errors on bad input.
    // If it's a standard Error or TypeError, it's handled. 
    // If it crashes the process, that's a failure (caught by process crash).
    // Let's just catch them and count unexpected ones if needed.
    if (!(err instanceof TypeError) && !err.message.includes('Invalid') && !err.message.includes('Malformed')) {
      crashes++;
      console.error(`Unexpected crash with input: ${garbage}`, err);
    }
  }
}

if (crashes === 0) {
  console.log('✅ Fuzz testing passed. All functions handled garbage data safely.');
} else {
  console.error(`❌ Fuzz testing failed. ${crashes} unexpected crashes occurred.`);
}
