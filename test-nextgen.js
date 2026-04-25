const assert = require('assert');
const uid = require('./index');

console.log('--- Testing Next-Gen Advanced Features ---');

try {
  // 1. Holographic IDs
  console.log('Testing Holographic IDs (Error-Correcting)...');
  const holoId = uid.holographicId({ size: 16 });
  assert.strictEqual(holoId.length, 19, 'Holographic ID should be size + 3');
  assert.ok(uid.verifyHolographic(holoId), 'Valid ID should verify');

  // Test typo recovery (1 character change)
  const typoChar = holoId[5] === 'a' ? 'b' : 'a';
  const typoId = holoId.substring(0, 5) + typoChar + holoId.substring(6);
  assert.strictEqual(uid.verifyHolographic(typoId), false, 'Typo ID should not verify');

  const repairResult = uid.repairHolographic(typoId);
  assert.ok(repairResult.valid, 'Repair should succeed');
  assert.ok(repairResult.repaired, 'Repaired flag should be true');
  assert.strictEqual(repairResult.id, holoId, 'Repaired ID should match original');

  // 2. Steganographic IDs
  console.log('Testing Steganographic IDs (Hidden Channel)...');
  const secretKey = 'my-super-secret-key';
  const hiddenByte = 142; // arbitrary byte
  const stegId = uid.steganoId(hiddenByte, secretKey, { size: 21 });
  
  assert.strictEqual(stegId.length, 21, 'Stegano ID should maintain length');
  const extracted = uid.extractStegano(stegId, secretKey);
  assert.strictEqual(extracted, hiddenByte, 'Extracted byte should match hidden byte');

  const wrongKeyExtract = uid.extractStegano(stegId, 'wrong-key');
  assert.notStrictEqual(wrongKeyExtract, hiddenByte, 'Wrong key should extract garbage');

  // 3. Proof of Work IDs
  console.log('Testing Proof-of-Work IDs...');
  const { challenge, difficulty } = uid.generatePowChallenge({ difficulty: 3 }); // low difficulty for fast test
  assert.strictEqual(difficulty, 3, 'Difficulty should match');
  assert.ok(challenge, 'Challenge should exist');

  const { id: powId, hash } = uid.solvePowChallenge(challenge, difficulty);
  assert.ok(hash.startsWith('000'), 'Hash should start with N zeros');
  assert.ok(uid.verifyPow(powId, difficulty), 'PoW verification should succeed');
  assert.strictEqual(uid.verifyPow(powId, difficulty + 1), false, 'PoW verification should fail for higher difficulty');

  // 4. Quantum-Lattice IDs
  console.log('Testing Quantum-Lattice IDs...');
  const qlId = uid.latticeId({ size: 32 });
  assert.ok(qlId.startsWith('ql_'), 'Lattice ID should start with ql_');
  assert.strictEqual(qlId.length, 35, 'Lattice ID should be prefix + size');
  
  const qlId2 = uid.latticeId({ size: 32 });
  assert.notStrictEqual(qlId, qlId2, 'Lattice IDs should be unique');

  console.log('\n✅ All Next-Gen Advanced Features passed successfully!');
} catch (e) {
  console.error('\n❌ Test failed:', e.message);
  console.error(e.stack);
  process.exit(1);
}
