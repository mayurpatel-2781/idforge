/* eslint-env es2020 */
'use strict';

/**
 * parallel.js — Worker Thread / Parallel ID Generation
 * ──────────────────────────────────────────────────────
 * Uses Node.js worker_threads to generate massive batches
 * of IDs concurrently across multiple CPU cores.
 */

const { Worker, isMainThread, parentPort } = require('worker_threads');
const os = require('os');
const path = require('path');

if (!isMainThread) {
  // Inside the worker thread — use generators directly to avoid circular dep
  const crypto = require('crypto');
  const gen = require('./generators');

  // Build a lightweight generator map (mirrors the main index.js exports)
  const generators = {
    nanoId:       gen.nanoId,
    typedId:      gen.typedId,
    humanId:      gen.humanId,
    sequentialId: gen.sequentialId,
    fromPattern:  gen.fromPattern,
    uuid:         () => crypto.randomUUID ? crypto.randomUUID() : generators.uuidV4(),
    uuidV4:       () => {
      const b = crypto.randomBytes(16);
      b[6] = (b[6] & 0x0f) | 0x40;
      b[8] = (b[8] & 0x3f) | 0x80;
      const h = b.toString('hex');
      return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
    },
  };

  parentPort.on('message', (msg) => {
    const { id, type, count, opts } = msg;
    try {
      const fn = generators[type];
      if (!fn || typeof fn !== 'function') {
        throw new Error(`Unknown generator type: ${type}`);
      }
      
      const ids = Array.from({ length: count }, () => fn(opts));
      parentPort.postMessage({ id, ids });
    } catch (err) {
      parentPort.postMessage({ id, error: err.message });
    }
  });
} else {
  // Main thread
  const numCPUs = os.cpus().length;
  let workers = [];
  let nextWorker = 0;
  let taskId = 0;
  const callbacks = new Map();

  /**
   * Initialize the worker pool. Called automatically, but can be called manually.
   * @param {number} count Number of workers (defaults to numCPUs - 1)
   */
  function initWorkers(count = Math.max(1, numCPUs - 1)) {
    if (workers.length > 0) return;
    for (let i = 0; i < count; i++) {
      const worker = new Worker(__filename);
      worker.on('message', (msg) => {
        const { id, ids, error } = msg;
        const cb = callbacks.get(id);
        if (cb) {
          callbacks.delete(id);
          if (error) cb.reject(new Error(error));
          else cb.resolve(ids);
        }
      });
      workers.push(worker);
    }
  }

  /**
   * Generate a large batch of IDs in parallel across worker threads.
   * @param {string} type Name of the generator function (e.g. 'nanoId', 'uuidV4')
   * @param {number} count Total number of IDs to generate
   * @param {object} opts Options for the generator
   * @returns {Promise<string[]>} Array of generated IDs
   */
  async function generateParallel(type = 'nanoId', count = 1000, opts = {}) {
    initWorkers();
    const workerCount = workers.length;
    const chunk = Math.ceil(count / workerCount);
    
    const promises = [];
    let remaining = count;

    for (let i = 0; i < workerCount && remaining > 0; i++) {
      const currentChunk = Math.min(chunk, remaining);
      remaining -= currentChunk;
      
      const p = new Promise((resolve, reject) => {
        const id = ++taskId;
        callbacks.set(id, { resolve, reject });
        const worker = workers[nextWorker];
        nextWorker = (nextWorker + 1) % workerCount;
        worker.postMessage({ id, type, count: currentChunk, opts });
      });
      promises.push(p);
    }

    const results = await Promise.all(promises);
    return results.flat();
  }

  /**
   * Terminate all workers to free up resources.
   */
  function terminateWorkers() {
    workers.forEach(w => w.terminate());
    workers = [];
    callbacks.clear();
  }

  module.exports = {
    generateParallel,
    initWorkers,
    terminateWorkers,
  };
}
