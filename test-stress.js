/* eslint-env es2020 */
'use strict';

/**
 * test-stress.js — Stress Testing (Parallel)
 * ──────────────────────────────────────────
 * Tests the worker-thread parallel generation at scale.
 */

const { generateParallel, initWorkers, terminateWorkers } = require('./parallel');

const TOTAL_IDS = 1_000_000;

async function run() {
  console.log(`Starting stress test: generating ${TOTAL_IDS} IDs across worker threads...`);
  const start = Date.now();
  
  try {
    const ids = await generateParallel('nanoId', TOTAL_IDS);
    const duration = Date.now() - start;
    
    console.log(`✅ Generated ${ids.length} IDs in ${duration}ms`);
    console.log(`⚡ Throughput: ${Math.floor((TOTAL_IDS / duration) * 1000).toLocaleString()} IDs/sec`);
    
    // Quick collision check on a sample
    const sampleSize = Math.min(100000, TOTAL_IDS);
    const sample = new Set(ids.slice(0, sampleSize));
    if (sample.size !== sampleSize) {
      console.error('❌ Collision detected in sample!');
    } else {
      console.log('✅ No collisions detected in sample subset.');
    }
    
  } catch (err) {
    console.error('❌ Stress test failed:', err);
  } finally {
    terminateWorkers();
  }
}

run();
