/* eslint-env es2020 */
'use strict';

/**
 * federation.js — Multi-Service ID Federation
 * ─────────────────────────────────────────────
 * Coordinates globally unique ID spaces across independent microservices
 * without a single point of failure.
 *
 * Strategies:
 *   'range'      — Each node owns a numeric range (e.g. node 3 owns 3_000_000–3_999_999)
 *   'prefix'     — Each node generates IDs with a unique prefix
 *   'snowflake'  — Distributed snowflake with configurable machine ID
 *   'epoch'      — Time-partitioned namespaces (safe for parallel services)
 *
 * Usage:
 *   const fed = createFederation({ strategy: 'prefix', services: ['orders', 'payments'] });
 *   const node = fed.join('orders-service-1');
 *   const id = node.generate();           // globally unique within federation
 *   fed.verify(id);                        // which service owns this ID?
 */

const crypto = require('crypto');
const { nanoId } = require('./generators');

// ── Snowflake-style distributed ID ────────────────────────────────────────────

const EPOCH = 1_700_000_000_000n; // Custom epoch: Nov 2023

function snowflake64({ machineId = 0, sequence = 0, timestamp } = {}) {
  const ts  = BigInt(timestamp ?? Date.now()) - EPOCH;
  const mid = BigInt(machineId & 0x3FF);    // 10 bits: up to 1023 machines
  const seq = BigInt(sequence   & 0xFFF);   // 12 bits: up to 4095 per ms
  return ((ts << 22n) | (mid << 12n) | seq).toString();
}

function parseSnowflake64(id) {
  const n   = BigInt(id);
  const ts  = Number(n >> 22n) + Number(EPOCH);
  const mid = Number((n >> 12n) & 0x3FFn);
  const seq = Number(n & 0xFFFn);
  return { timestamp: ts, date: new Date(ts), machineId: mid, sequence: seq };
}

// ── Federation Node ───────────────────────────────────────────────────────────

class FederationNode {
  constructor(federation, nodeId, opts = {}) {
    this._fed      = federation;
    this.nodeId    = nodeId;
    this._seq      = 0;
    this._lastMs   = 0;
    this._opts     = opts;
    this._generated = 0;
    this._joinedAt  = Date.now();

    // Assign machine ID from federation
    this.machineId = opts.machineId ?? federation._assignMachineId(nodeId);

    // Range allocation (for 'range' strategy)
    this._range = opts.range ?? null;
    this._rangePtr = this._range?.start ?? 0;
  }

  /**
   * Generate a globally unique ID for this node.
   * @param {{ meta? }} [opts]
   * @returns {string}
   */
  generate(opts = {}) {
    const strategy = this._fed.strategy;
    let id;

    switch (strategy) {
      case 'snowflake': {
        const now = Date.now();
        if (now === this._lastMs) {
          this._seq++;
          if (this._seq > 4095) {
            // Sequence exhausted — wait for next ms
            this._seq = 0;
            this._lastMs = now + 1;
          }
        } else {
          this._seq = 0;
          this._lastMs = now;
        }
        id = snowflake64({ machineId: this.machineId, sequence: this._seq, timestamp: this._lastMs });
        break;
      }

      case 'prefix': {
        const prefix = this._fed._prefixFor(this.nodeId);
        const rand   = nanoId({ size: 12, alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' });
        id = `${prefix}_${rand}`;
        break;
      }

      case 'range': {
        if (!this._range) throw new Error(`Node "${this.nodeId}" has no range assigned`);
        if (this._rangePtr > this._range.end) {
          throw new Error(`Node "${this.nodeId}" range exhausted (${this._range.start}–${this._range.end})`);
        }
        id = String(this._rangePtr++).padStart(this._fed._idWidth, '0');
        break;
      }

      case 'epoch': {
        const window = Math.floor(Date.now() / this._fed._epochWindowMs);
        const rand   = nanoId({ size: 10, alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' });
        id = `${this.machineId.toString(36).padStart(3,'0')}_${window.toString(36)}_${rand}`;
        break;
      }

      default:
        throw new Error(`Unknown strategy: ${strategy}`);
    }

    this._generated++;
    this._fed._recordGeneration(this.nodeId, id);
    return id;
  }

  /**
   * Generate a batch of IDs.
   * @param {number} count
   */
  generateBatch(count) {
    return Array.from({ length: count }, () => this.generate());
  }

  /**
   * Get statistics for this node.
   */
  stats() {
    return {
      nodeId:     this.nodeId,
      machineId:  this.machineId,
      strategy:   this._fed.strategy,
      generated:  this._generated,
      joinedAt:   new Date(this._joinedAt).toISOString(),
      range:      this._range ?? null,
      rangeUsed:  this._range ? this._rangePtr - this._range.start : null,
      rangeLeft:  this._range ? this._range.end - this._rangePtr + 1 : null,
    };
  }

  /**
   * Leave the federation gracefully.
   */
  leave() {
    this._fed._removeNode(this.nodeId);
  }
}

// ── Federation ────────────────────────────────────────────────────────────────

class Federation {
  /**
   * @param {{
   *   name?: string,
   *   strategy?: 'snowflake'|'prefix'|'range'|'epoch',
   *   rangeSize?: number,
   *   idWidth?: number,
   *   epochWindowMs?: number,
   *   maxNodes?: number,
   * }} opts
   */
  constructor(opts = {}) {
    const {
      name         = 'default',
      strategy     = 'snowflake',
      rangeSize    = 1_000_000,
      idWidth      = 12,
      epochWindowMs = 60_000,
      maxNodes     = 1023,
    } = opts;

    this.name           = name;
    this.strategy       = strategy;
    this._rangeSize     = rangeSize;
    this._idWidth       = idWidth;
    this._epochWindowMs = epochWindowMs;
    this._maxNodes      = maxNodes;

    this._nodes          = new Map();    // nodeId → FederationNode
    this._machineIds     = new Set();    // allocated machine IDs
    this._nextMachineId  = 1;
    this._nextRangeStart = 0;
    this._generationLog  = [];
    this._createdAt      = Date.now();
  }

  /**
   * Join the federation as a named node.
   * @param {string} nodeId   - unique name for this service instance (e.g. 'orders-us-east-1')
   * @returns {FederationNode}
   */
  join(nodeId) {
    if (this._nodes.has(nodeId)) return this._nodes.get(nodeId);
    if (this._nodes.size >= this._maxNodes) {
      throw new Error(`Federation "${this.name}" is full (max ${this._maxNodes} nodes)`);
    }

    const machineId = this._assignMachineId(nodeId);
    const range     = this.strategy === 'range' ? this._allocateRange() : null;

    const node = new FederationNode(this, nodeId, { machineId, range });
    this._nodes.set(nodeId, node);
    return node;
  }

  /**
   * Verify which node owns an ID and parse its metadata.
   * @param {string} id
   * @returns {{ owner?: string, strategy: string, parsed: object }}
   */
  verify(id) {
    switch (this.strategy) {
      case 'snowflake': {
        try {
          const parsed = parseSnowflake64(id);
          const owner  = [...this._nodes.values()].find(n => n.machineId === parsed.machineId);
          return { owner: owner?.nodeId ?? null, strategy: 'snowflake', parsed };
        } catch { return { owner: null, strategy: 'snowflake', parsed: {} }; }
      }

      case 'prefix': {
        const pfxPart = id.split('_')[0];
        const owner   = [...this._nodes.entries()].find(([nid]) =>
          this._prefixFor(nid) === pfxPart
        );
        return { owner: owner?.[0] ?? null, strategy: 'prefix', parsed: { prefix: pfxPart } };
      }

      case 'range': {
        const n = parseInt(id, 10);
        const owner = [...this._nodes.values()].find(node =>
          node._range && n >= node._range.start && n <= node._range.end
        );
        return { owner: owner?.nodeId ?? null, strategy: 'range', parsed: { value: n } };
      }

      case 'epoch': {
        const parts = id.split('_');
        const mid   = parseInt(parts[0], 36);
        const owner = [...this._nodes.values()].find(n => n.machineId === mid);
        return { owner: owner?.nodeId ?? null, strategy: 'epoch', parsed: { machineId: mid } };
      }

      default:
        return { owner: null, strategy: this.strategy, parsed: {} };
    }
  }

  /**
   * Get federation-wide statistics.
   */
  stats() {
    const nodeStats = [...this._nodes.values()].map(n => n.stats());
    const totalGenerated = nodeStats.reduce((s, n) => s + n.generated, 0);
    return {
      name:          this.name,
      strategy:      this.strategy,
      nodes:         this._nodes.size,
      totalGenerated,
      createdAt:     new Date(this._createdAt).toISOString(),
      nodeStats,
    };
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  _assignMachineId(nodeId) {
    // Deterministic machine ID from nodeId hash
    const hash = crypto.createHash('sha256').update(nodeId).digest();
    let mid = hash.readUInt16BE(0) % this._maxNodes;
    while (this._machineIds.has(mid)) mid = (mid + 1) % this._maxNodes;
    this._machineIds.add(mid);
    return mid;
  }

  _prefixFor(nodeId) {
    return crypto.createHash('sha256').update(nodeId).digest('hex').slice(0, 6);
  }

  _allocateRange() {
    const start = this._nextRangeStart;
    const end   = start + this._rangeSize - 1;
    this._nextRangeStart = end + 1;
    return { start, end };
  }

  _recordGeneration(nodeId, id) {
    // Keep last 1000 in rolling log
    if (this._generationLog.length >= 1000) this._generationLog.shift();
    this._generationLog.push({ nodeId, id, ts: Date.now() });
  }

  _removeNode(nodeId) {
    this._nodes.delete(nodeId);
  }
}

/**
 * Create a new federation.
 * @param {{ name?, strategy?, rangeSize?, maxNodes? }} opts
 */
function createFederation(opts = {}) {
  return new Federation(opts);
}

module.exports = {
  Federation,
  FederationNode,
  createFederation,
  snowflake64,
  parseSnowflake64,
};
