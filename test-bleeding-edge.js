const assert = require('assert');
const uid = require('./index');

console.log('--- Testing Bleeding-Edge Features ---');

try {
  // 1. Fractal IDs
  console.log('Testing Fractal IDs...');
  const root1 = uid.fractalRoot('my-seed');
  const root2 = uid.fractalRoot('my-seed');
  assert.strictEqual(root1, root2, 'Same seed should produce same root');
  assert.ok(root1.startsWith('frc_'), 'Fractal ID should have prefix');

  const child1 = uid.deriveFractalChild(root1, '1');
  const child2 = uid.deriveFractalChild(root1, '1');
  const child3 = uid.deriveFractalChild(root1, '2');
  assert.strictEqual(child1, child2, 'Same path should produce same child');
  assert.notStrictEqual(child1, child3, 'Different path should produce different child');

  // 2. Hardware-Bound IDs
  console.log('Testing Hardware-Bound IDs...');
  const hwId = uid.hardwareId();
  assert.ok(hwId.startsWith('hw_'), 'Hardware ID should have prefix');
  assert.ok(uid.verifyLocalHardware(hwId), 'Hardware ID should verify on local machine');

  const fakeHwId = 'hw_badfingerprint_randomstuff';
  assert.strictEqual(uid.verifyLocalHardware(fakeHwId), false, 'Fake Hardware ID should not verify');

  // 3. ZKP Linked IDs
  console.log('Testing ZKP Linked IDs...');
  const identity = uid.createZkpIdentity();
  assert.ok(identity.publicKey && identity.privateKey, 'Should generate keypair');

  const idA = uid.generateZkpId(identity);
  const idB = uid.generateZkpId(identity);
  assert.ok(idA.startsWith('zk_') && idB.startsWith('zk_'), 'ZKP IDs should have prefix');

  const proofToken = uid.createLinkProof(identity, idA, idB);
  assert.ok(uid.verifyLinkProof(idA, idB, proofToken, identity.publicKey), 'Link proof should verify with correct public key');
  
  // Test failure on bad proof
  assert.strictEqual(uid.verifyLinkProof(idB, idA, proofToken, identity.publicKey), false, 'Link proof should fail if order is wrong or tampered');

  // 4. AI-Adaptive Compressed IDs
  console.log('Testing AI-Adaptive Compressed IDs...');
  const adaptive = new uid.AdaptiveGenerator({ threshold: 4 });
  
  // Before threshold
  assert.strictEqual(adaptive.generate('ORG-1234'), 'ORG-1234');
  assert.strictEqual(adaptive.generate('ORG-5678'), 'ORG-5678');
  assert.strictEqual(adaptive.generate('ORG-9999'), 'ORG-9999');

  // Threshold hit
  const compressed1 = adaptive.generate('ORG-AAAA');
  assert.ok(compressed1.startsWith('~'), 'Should compress after threshold');
  assert.ok(compressed1.endsWith('AAAA'), 'Should preserve remainder');

  const compressed2 = adaptive.generate('ORG-BBBB');
  assert.ok(compressed2.startsWith('~'), 'Should continue compressing');
  assert.strictEqual(compressed1.substring(0, 2), compressed2.substring(0, 2), 'Should use same token for same prefix');

  // Decompress
  assert.strictEqual(adaptive.decompress(compressed1), 'ORG-AAAA', 'Should successfully decompress');
  assert.strictEqual(adaptive.decompress('ORG-1234'), 'ORG-1234', 'Should not alter uncompressed IDs');

  console.log('\n✅ All Bleeding-Edge Features passed successfully!');
} catch (e) {
  console.error('\n❌ Test failed:', e.message);
  console.error(e.stack);
  process.exit(1);
}
