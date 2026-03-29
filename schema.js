/* eslint-env es2020 */
'use strict';

const crypto = require('crypto');
const { randomBytes } = require('./utils');

// ── Composable / Structured Schema IDs ────────────────────────────────────────

const SEGMENT_ENCODINGS = {
  base36:    '0123456789abcdefghijklmnopqrstuvwxyz',
  base62:    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
  base64url: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_',
};

function encodeNum(n, alphabet, minLen = 1) {
  const base = BigInt(alphabet.length);
  let num = BigInt(n);
  let result = '';
  while (num > 0n) { result = alphabet[Number(num % base)] + result; num /= base; }
  return result.padStart(minLen, alphabet[0]) || alphabet[0];
}

function decodeNum(str, alphabet) {
  const base = BigInt(alphabet.length);
  let num = 0n;
  for (const c of str) {
    const idx = alphabet.indexOf(c);
    if (idx < 0) throw new Error(`Invalid char "${c}" for alphabet`);
    num = num * base + BigInt(idx);
  }
  return Number(num);
}

function crc8(str) {
  let crc = 0;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i);
    for (let j = 0; j < 8; j++) crc = (crc & 0x80) ? ((crc << 1) ^ 0x07) & 0xFF : (crc << 1) & 0xFF;
  }
  return crc.toString(16).padStart(2, '0');
}

class IdSchema {
  /**
   * @param {Array<{
   *   key: string,
   *   type?: 'literal'|'timestamp'|'random'|'counter'|'data'|'checksum',
   *   value?: string,
   *   bits?: number,
   *   encoding?: string,
   *   len?: number,
   * }>} segments
   * @param {{ separator?, version? }} [opts]
   */
  constructor(segments, opts = {}) {
    this._segments  = segments;
    this._separator = opts.separator || '_';
    this._version   = opts.version   || 1;
    this._counter   = 0;
  }

  /**
   * Generate an ID from this schema
   * @param {object} [data]   - values for 'data' type segments
   * @returns {string}
   */
  generate(data = {}) {
    const parts = [];

    for (const seg of this._segments) {
      switch (seg.type || 'literal') {
        case 'literal':
          parts.push(seg.value || '');
          break;

        case 'timestamp': {
          const ms  = Date.now();
          const enc = SEGMENT_ENCODINGS[seg.encoding || 'base36'];
          const len = seg.len || Math.ceil((seg.bits || 42) / Math.log2(enc.length));
          parts.push(encodeNum(ms, enc, len));
          break;
        }

        case 'random': {
          const enc  = SEGMENT_ENCODINGS[seg.encoding || 'base62'];
          const bits = seg.bits || 32;
          const len  = seg.len || Math.ceil(bits / Math.log2(enc.length));
          const buf  = randomBytes(Math.ceil(len * Math.log2(enc.length) / 8));
          let   num  = BigInt('0x' + buf.toString('hex')) % (BigInt(enc.length) ** BigInt(len));
          let   r    = '';
          const base = BigInt(enc.length);
          for (let i = 0; i < len; i++) { r = enc[Number(num % base)] + r; num /= base; }
          parts.push(r);
          break;
        }

        case 'counter': {
          const enc = SEGMENT_ENCODINGS[seg.encoding || 'base36'];
          const len = seg.len || 4;
          parts.push(encodeNum(++this._counter, enc, len));
          break;
        }

        case 'data': {
          const val = data[seg.key];
          if (val === undefined) throw new Error(`Missing data key "${seg.key}"`);
          const enc = SEGMENT_ENCODINGS[seg.encoding || 'base36'];
          if (typeof val === 'number' || typeof val === 'bigint') {
            parts.push(encodeNum(val, enc, seg.len || 4));
          } else {
            // Hash string data into compact form
            const hash = crypto.createHash('sha256').update(String(val)).digest();
            const num  = hash.readBigUInt64BE(0);
            parts.push(encodeNum(num, enc, seg.len || 8));
          }
          break;
        }

        case 'checksum': {
          const soFar = parts.join(this._separator);
          parts.push(crc8(soFar));
          break;
        }

        default:
          parts.push(seg.value || '');
      }
    }

    return parts.join(this._separator);
  }

  /**
   * Extract a specific segment from a generated ID
   * @param {string} id
   * @param {string} segmentKey
   * @returns {string|number|Date|null}
   */
  extract(id, segmentKey) {
    const parts = id.split(this._separator);
    const segIdx = this._segments.findIndex(s => s.key === segmentKey);
    if (segIdx < 0 || segIdx >= parts.length) return null;

    const seg = this._segments[segIdx];
    const raw = parts[segIdx];

    switch (seg.type) {
      case 'timestamp': {
        const enc = SEGMENT_ENCODINGS[seg.encoding || 'base36'];
        const ms  = decodeNum(raw, enc);
        return new Date(ms);
      }
      case 'counter':
      case 'data': {
        const enc = SEGMENT_ENCODINGS[seg.encoding || 'base36'];
        return decodeNum(raw, enc);
      }
      default:
        return raw;
    }
  }

  /**
   * Validate a generated ID against this schema (checksum + structure)
   * @param {string} id
   * @returns {{ valid: boolean, reason?: string }}
   */
  validate(id) {
    const parts = id.split(this._separator);
    if (parts.length !== this._segments.length) {
      return { valid: false, reason: `Expected ${this._segments.length} segments, got ${parts.length}` };
    }

    // Find checksum segment
    const csIdx = this._segments.findIndex(s => s.type === 'checksum');
    if (csIdx >= 0) {
      const withoutCs = parts.slice(0, csIdx).join(this._separator);
      const expected  = crc8(withoutCs);
      if (parts[csIdx] !== expected) {
        return { valid: false, reason: `Checksum mismatch: expected "${expected}", got "${parts[csIdx]}"` };
      }
    }

    return { valid: true };
  }

  /** Reset internal counter */
  resetCounter() { this._counter = 0; }
}

/**
 * Create an ID schema
 * @param {Array} segments
 * @param {{ separator?, version? }} [opts]
 * @returns {IdSchema}
 */
function schema(segments, opts = {}) {
  return new IdSchema(segments, opts);
}

module.exports = { schema, IdSchema, SEGMENT_ENCODINGS };
