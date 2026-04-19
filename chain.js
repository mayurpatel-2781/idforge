/* eslint-env es2020 */
'use strict';

/**
 * chain.js — Blockchain-style ID Chain, QR codes, High-Performance Pool
 */

const crypto = require('crypto');

// ── IdChain ───────────────────────────────────────────────────────────────────

class IdChain {
  constructor(opts = {}) {
    this._blocks   = [];
    this._hashAlgo = opts.hashAlgorithm || 'sha256';
  }

  _hashBlock(index, prevHash, id, ts, extra) {
    const data = `${index}|${prevHash}|${id}|${ts}|${JSON.stringify(extra || {})}`;
    return crypto.createHash(this._hashAlgo).update(data).digest('hex');
  }

  /**
   * Create the genesis (first) block. Alias for the first add() call
   * with a special "genesis" ID and zeroed prevHash.
   * @param {object} [meta]  Any metadata to embed (data, ts, etc.)
   * @returns {Block}
   */
  genesis(meta = {}) {
    if (this._blocks.length > 0)
      throw new Error('genesis() can only be called on an empty chain');
    const index    = 0;
    const prevHash = '0'.repeat(64);
    const ts       = Date.now();
    const id       = meta.id || `genesis_${ts}`;
    // Strip structural fields from meta so they don't overwrite block properties
    const { id: _i, index: _idx, prevHash: _p, hash: _h, ts: _t, ...cleanMeta } = meta;
    const hash     = this._hashBlock(index, prevHash, id, ts, cleanMeta);
    const block    = { index, id, prevHash, hash, ts, ...cleanMeta };
    this._blocks.push(block);
    return block;
  }

  /**
   * Add a block to the chain.
   * @param {string} id
   * @param {object} [meta]
   */
  add(id, meta = {}) {
    const index    = this._blocks.length;
    const prevHash = index === 0
      ? '0'.repeat(64)
      : this._blocks[index - 1].hash;
    const ts   = Date.now();
    // Strip structural fields from meta so they don't overwrite block properties
    const { id: _i, index: _idx, prevHash: _p, hash: _h, ts: _t, ...cleanMeta } = meta;
    const hash = this._hashBlock(index, prevHash, id, ts, cleanMeta);
    const block = { index, id, prevHash, hash, ts, ...cleanMeta };
    this._blocks.push(block);
    return block;
  }

  /**
   * Verify the entire chain's integrity.
   */
  verify() {
    for (let i = 0; i < this._blocks.length; i++) {
      const b        = this._blocks[i];
      const expected = this._hashBlock(b.index, b.prevHash, b.id, b.ts,
        // Reconstruct cleanMeta (exclude all structural fields)
        (() => {
          const { index, id, prevHash, hash, ts, ...meta } = b;
          return meta;
        })()
      );
      if (b.hash !== expected) return false;
      if (i > 0 && b.prevHash !== this._blocks[i - 1].hash) return false;
    }
    return true;
  }

  get length()  { return this._blocks.length; }
  get blocks()  { return [...this._blocks]; }

  getLast()     { return this._blocks.at(-1) || null; }

  find(id) {
    return this._blocks.find(b => b.id === id || (id === 'genesis' && b.index === 0)) || null;
  }

  toArray() { return this.blocks; }

  toJSON() {
    return { length: this._blocks.length, valid: this.verify(), blocks: this._blocks };
  }
}

function createChain(opts = {}) {
  return new IdChain(opts);
}

// ── QR Code ───────────────────────────────────────────────────────────────────

function idToQrAscii(id) {
  if (typeof id !== 'string') throw new TypeError('idToQrAscii expects a string');
  const hash = crypto.createHash('sha256').update(id).digest('hex');
  const W    = 11;
  const COL  = W * 2;

  let art  = `┌${'─'.repeat(COL + 2)}┐\n`;
  art     += `│ ${id.slice(0, Math.min(id.length, COL)).padEnd(COL)} │\n`;
  art     += `├${'─'.repeat(COL + 2)}┤\n`;

  for (let row = 0; row < W; row++) {
    let line = '│ ';
    for (let col = 0; col < W; col++) {
      const hexIdx = ((row * W) + col) % (hash.length - 1);
      const val    = parseInt(hash[hexIdx], 16);
      line += val > 7 ? '██' : '  ';
    }
    art += line + ' │\n';
  }

  art += `└${'─'.repeat(COL + 2)}┘`;
  return art;
}

function idToQrDataUrl(id) {
  const ascii   = idToQrAscii(id);
  const encoded = Buffer.from(ascii, 'utf8').toString('base64');
  return `data:text/plain;charset=utf-8;base64,${encoded}`;
}

// ── High-Performance Pool ─────────────────────────────────────────────────────

class HighPerformancePool {
  constructor(generatorFn, opts = {}) {
    if (typeof generatorFn !== 'function')
      throw new TypeError('HighPerformancePool: generatorFn must be a function');
    const { size = 200, refillThreshold = 0.2, batchSize, autoScale = false } = opts;
    this._fn        = generatorFn;
    this._capacity  = size;
    this._threshold = Math.max(1, Math.floor(size * refillThreshold));
    this._batchSize = batchSize || size;
    this._autoScale = autoScale;
    this._pool      = [];
    this._stats     = { generated: 0, hits: 0, refills: 0 };
    this._hitsInWindow = 0;
    this._lastWindowTime = Date.now();
    this._refill(size);
  }

  _refill(n) {
    for (let i = 0; i < n; i++) this._pool.push(this._fn());
    this._stats.generated += n;
    this._stats.refills++;
  }

  _checkAutoScale() {
    if (!this._autoScale) return;
    const now = Date.now();
    if (now - this._lastWindowTime > 1000) { // Check every second
      const rate = this._hitsInWindow; // Hits per second
      if (rate > this._capacity * 2) {
        // Scale up based on demand
        this._capacity = Math.min(this._capacity * 2, 100000);
        this._batchSize = this._capacity;
        this._threshold = Math.max(1, Math.floor(this._capacity * 0.2));
      } else if (rate < this._capacity / 4 && this._capacity > 200) {
        // Scale down to free memory
        this._capacity = Math.max(Math.floor(this._capacity * 0.8), 200);
        this._batchSize = this._capacity;
        this._threshold = Math.max(1, Math.floor(this._capacity * 0.2));
        // Prune excess array elements safely
        if (this._pool.length > this._capacity) {
          this._pool.length = this._capacity;
        }
      }
      this._hitsInWindow = 0;
      this._lastWindowTime = now;
    }
  }

  get() {
    if (this._autoScale) {
      this._hitsInWindow++;
      if (this._stats.hits % 50 === 0) this._checkAutoScale();
    }
    if (this._pool.length <= this._threshold) {
      this._refill(Math.max(this._batchSize, this._capacity - this._pool.length));
    }
    this._stats.hits++;
    return this._pool.pop() ?? this._fn();
  }

  drain(n) { return Array.from({ length: n }, () => this.get()); }
  peek()   { return this._pool.at(-1) || null; }

  get size() { return this._pool.length; }

  stats() {
    return {
      poolSize:  this._pool.length,
      capacity:  this._capacity,
      autoScale: this._autoScale,
      generated: this._stats.generated,
      hits:      this._stats.hits,
      refills:   this._stats.refills,
    };
  }
}

function createHighPerfPool(generatorFn, opts = {}) {
  return new HighPerformancePool(generatorFn, opts);
}

module.exports = {
  IdChain,
  createChain,
  idToQrAscii,
  idToQrDataUrl,
  HighPerformancePool,
  createHighPerfPool,
};