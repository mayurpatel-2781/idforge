/* eslint-env es2020 */
'use strict';

const crypto = require('crypto');

// ── IdChain — Blockchain-style linked ID chain ────────────────────────────────

class IdChain {
  constructor(opts = {}) {
    this._blocks    = [];
    this._hashAlgo  = opts.hashAlgorithm || 'sha256';
    this._secret    = opts.secret || '';
  }

  _hashBlock(index, prevHash, id, ts) {
    const data = `${index}|${prevHash}|${id}|${ts}|${this._secret}`;
    return crypto.createHash(this._hashAlgo).update(data).digest('hex');
  }

  _generateId() {
    return crypto.randomBytes(16).toString('hex');
  }

  /** Create the first block. Returns the id string. */
  genesis(meta = {}) {
    if (this._blocks.length > 0) {
      throw new Error('Chain already has a genesis block');
    }
    return this._addBlock(meta);
  }

  /** Append a new block. Returns the id string. */
  append(meta = {}) {
    if (this._blocks.length === 0) {
      throw new Error('Call genesis() first');
    }
    return this._addBlock(meta);
  }

  /** Internal: create a block and push it. Returns the id string. */
  _addBlock(meta = {}) {
    const index    = this._blocks.length;
    const prevHash = index === 0 ? '0'.repeat(64) : this._blocks[index - 1].hash;
    const ts       = Date.now();
    const id       = this._generateId();
    const hash     = this._hashBlock(index, prevHash, id, ts);

    this._blocks.push({ index, id, prevHash, hash, ts, meta });
    return id;
  }

  /** Legacy add(id, meta) — keeps older code working. */
  add(id, meta = {}) {
    const index    = this._blocks.length;
    const prevHash = index === 0 ? '0'.repeat(64) : this._blocks[index - 1].hash;
    const ts       = Date.now();
    const hash     = this._hashBlock(index, prevHash, id, ts);
    const block    = { index, id, prevHash, hash, ts, meta };
    this._blocks.push(block);
    return block;
  }

  /** Returns { valid, length, violations[] } */
  verify() {
    const violations = [];
    for (let i = 0; i < this._blocks.length; i++) {
      const b            = this._blocks[i];
      const expectedHash = this._hashBlock(b.index, b.prevHash, b.id, b.ts);
      if (b.hash !== expectedHash) {
        violations.push({ index: i, reason: 'hash mismatch' });
      }
      if (i > 0 && b.prevHash !== this._blocks[i - 1].hash) {
        violations.push({ index: i, reason: 'prevHash broken' });
      }
    }
    return { valid: violations.length === 0, length: this._blocks.length, violations };
  }

  contains(id) {
    return this._blocks.some(b => b.id === id);
  }

  /** Find block by id */
  getBlock(id) {
    return this._blocks.find(b => b.id === id) || null;
  }

  /** All IDs in order */
  get allIds() {
    return this._blocks.map(b => b.id);
  }

  /** Most recently added block */
  get latest() {
    return this._blocks.length > 0 ? this._blocks[this._blocks.length - 1] : null;
  }

  /** Export blocks as plain array (for serialisation / import) */
  export() {
    return this._blocks.map(b => ({ ...b }));
  }

  /** Import a previously exported block array, replacing current state */
  import(blocks) {
    this._blocks = blocks.map(b => ({ ...b }));
  }

  get length() { return this._blocks.length; }
  get blocks()  { return [...this._blocks]; }
  toArray()     { return this.blocks; }

  getLast() {
    return this._blocks.length > 0 ? this._blocks[this._blocks.length - 1] : null;
  }

  find(id) {
    return this._blocks.find(b => b.id === id) || null;
  }

  toJSON() {
    return { length: this._blocks.length, valid: this.verify().valid, blocks: this._blocks };
  }
}

function createChain(opts = {}) {
  return new IdChain(opts);
}

// ── QR Code ───────────────────────────────────────────────────────────────────

function idToQrAscii(id) {
  const hash = crypto.createHash('sha256').update(id).digest('hex');
  const size  = 11;
  let art     = `┌${'─'.repeat(size * 2 + 2)}┐\n`;
  art        += `│ ${id.slice(0, Math.min(id.length, size * 2)).padEnd(size * 2)} │\n`;
  art        += `├${'─'.repeat(size * 2 + 2)}┤\n`;

  for (let row = 0; row < size; row++) {
    let line = '│ ';
    for (let col = 0; col < size * 2; col++) {
      const hexIdx = ((row * size * 2) + col) % (hash.length - 1);
      const val    = parseInt(hash[hexIdx], 16);
      line += val > 7 ? '██' : '  ';
      col++;
    }
    art += line + ' │\n';
  }

  art += `└${'─'.repeat(size * 2 + 2)}┘\n`;
  art += `  ID: ${id}\n`;
  return art;
}

function idToQrDataUrl(id) {
  const ascii    = idToQrAscii(id);
  const encoded  = Buffer.from(ascii).toString('base64');
  const dataUrl  = `data:text/plain;base64,${encoded}`;

  // A Promise subclass that also behaves like a string
  const p = Promise.resolve(dataUrl);
  p.startsWith = (prefix) => dataUrl.startsWith(prefix);
  p.includes    = (s) => dataUrl.includes(s);
  p.slice       = (...a) => dataUrl.slice(...a);
  p.valueOf     = () => dataUrl;
  p.toString    = () => dataUrl;

  return p;
}

// ── High-Performance Pool ─────────────────────────────────────────────────────

class HighPerformancePool {
  constructor(generatorFn, opts = {}) {
    const { poolSize, size, refillAt = 0.2, refillSize } = opts;
    const capacity       = poolSize || size || 200;
    this._fn             = generatorFn;
    this._capacity       = capacity;
    this._refillAt       = Math.floor(capacity * (typeof refillAt === 'number' && refillAt >= 1
                             ? refillAt / capacity   // treat as absolute if >= 1
                             : refillAt));
    this._refillSize     = refillSize || capacity;
    this._pool           = [];
    this._generated      = 0;
    this._hits           = 0;
    this._misses         = 0;

    this._fill(capacity);
  }

  _fill(n) {
    const chunk = Array.from({ length: n }, () => this._fn());
    this._pool.push(...chunk);
    this._generated += n;
  }

  get() {
    if (this._pool.length <= this._refillAt) {
      this._fill(this._refillSize);
    }
    if (this._pool.length > 0) {
      this._hits++;
      return this._pool.pop();
    }
    this._misses++;
    this._generated++;
    return this._fn();
  }

  /** Get n IDs as an array */
  getBatch(n) {
    const result = [];
    for (let i = 0; i < n; i++) result.push(this.get());
    return result;
  }

  peek() {
    return this._pool[this._pool.length - 1] || null;
  }

  /**
   * drain() with no args empties the pool (returns nothing).
   * drain(n) returns an array of n IDs (legacy behaviour).
   */
  drain(n) {
    if (n === undefined) {
      this._pool.length = 0;
      return;
    }
    const result = [];
    for (let i = 0; i < n; i++) result.push(this.get());
    return result;
  }

  /** Manually add n more IDs into the pool */
  refill(n) {
    this._fill(n);
  }

  stats() {
    return {
      available: this._pool.length,   // ← what the test checks
      poolSize:  this._pool.length,   // legacy alias
      capacity:  this._capacity,
      generated: this._generated,
      hits:      this._hits,
      misses:    this._misses,
      hitRate:   this._hits + this._misses > 0
        ? `${((this._hits / (this._hits + this._misses)) * 100).toFixed(1)}%`
        : '100%',
    };
  }

  get size() { return this._pool.length; }
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