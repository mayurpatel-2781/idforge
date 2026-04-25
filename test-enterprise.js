/* eslint-env es2020 */
'use strict';

const uid = require('./index');
const { enterprise } = uid;

let passed = 0, failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

async function run() {
  console.log('\n════════════════════════════════════════════════════');
  console.log('  TESTING ENTERPRISE FEATURES');
  console.log('════════════════════════════════════════════════════\n');

  // 1. CRDT Clocks
  const l1 = new enterprise.LamportClock('nodeA');
  const l2 = new enterprise.LamportClock('nodeB');
  const t1 = l1.increment(); // "1:nodeA"
  l2.update(t1); // l2.counter becomes 2
  const t2 = l2.increment(); // "3:nodeB"
  assert('LamportClock increment', t1 === '1:nodeA');
  assert('LamportClock causality', t2 === '3:nodeB');

  const v1 = new enterprise.VectorClock('A');
  v1.tick();
  const state1 = v1.tick(); // A: 2
  assert('VectorClock local tick', state1['A'] === 2);
  v1.merge({ 'B': 5 }); // A: 2, B: 5
  const state2 = v1.tick(); // A: 3, B: 5
  assert('VectorClock merge', state2['A'] === 3 && state2['B'] === 5);

  // 2. Token Manager (Revocable)
  const tm = new enterprise.TokenManager();
  const token = await tm.createToken({ user: 'alice' });
  assert('TokenManager creation', token.startsWith('tk_pro_'));
  assert('TokenManager validity', await tm.isValid(token));
  
  await tm.revokeToken(token);
  assert('TokenManager revocation', !(await tm.isValid(token)));

  // 3. Post-Quantum IDs
  const pq1 = enterprise.pqId();
  const pq2 = enterprise.pqId();
  assert('pqId format', pq1.startsWith('pq_') && pq1.length === 67);
  assert('pqId unique', pq1 !== pq2);

  // 4. Anomaly Detection
  const ad = new enterprise.AnomalyDetector({ threshold: 5, windowSize: 10 });
  // Train with varied steady values to avoid tiny stdDev
  ad.observe(10); ad.observe(11); ad.observe(9); ad.observe(10); ad.observe(11);
  ad.observe(9); ad.observe(10); ad.observe(11); ad.observe(9); ad.observe(10);
  
  const normal = ad.observe(11);
  assert('AnomalyDetector normal', !normal.anomaly);
  const anomaly = ad.observe(100);
  assert('AnomalyDetector detected', anomaly.anomaly);

  // 5. Prometheus Export
  const prom = enterprise.toPrometheus({
    generation: { total: 100, rate: 5.5 },
    system: { cpu: 22 }
  });
  assert('toPrometheus HELP', prom.includes('# HELP uuid_lab_generation_total'));
  assert('toPrometheus VALUE', prom.includes('uuid_lab_system_cpu 22'));

  // 6. Alert Manager
  process.env.NODE_ENV = 'test';
  const am = new enterprise.AlertManager({ name: 'TestManager' });
  am.registerChannel('slack', { type: 'webhook', url: 'https://hooks.slack.com/test' });
  am.addRule('Security Rule', (ev) => ev === 'ANOMALY', 'slack');
  
  const results = await am.notify('ANOMALY', { details: 'test-detect' });
  assert('AlertManager notify triggered', results.length === 1);
  assert('AlertManager notify result', results[0].status === 'sent');

  // 7. Entropy Heatmap
  const heatmap = enterprise.generateEntropyHeatmap([uid.uuid(), '12345']);
  assert('EntropyHeatmap count', heatmap.length === 2);
  assert('EntropyHeatmap risk low', heatmap[0].risk === 'low');
  assert('EntropyHeatmap risk high', heatmap[1].risk === 'high');

  console.log(`\n════════════════════════════════════════════════════`);
  console.log(`  ✅ ${passed} passed   ❌ ${failed} failed`);
  console.log(`════════════════════════════════════════════════════\n`);

  if (failed > 0) process.exit(1);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
