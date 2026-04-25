/* eslint-env es2020 */
'use strict';

const crypto = require('crypto');
const { nanoId, ALPHA_BASE62 } = require('./generators');

// ── Holographic IDs (Error-Correcting) ────────────────────────────────────────

// CRC16 CCITT for checksum generation
function crc16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) > 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
    }
  }
  return crc & 0xFFFF;
}

function intToBase62(num, length) {
  let res = '';
  let n = num;
  while (n > 0 || res.length < length) {
    res = ALPHA_BASE62[n % 62] + res;
    n = Math.floor(n / 62);
  }
  return res.slice(-length);
}

/**
 * Generates an ID with built-in error correction (Holographic ID).
 * Appends a 3-character checksum that allows for single-character typo recovery.
 */
function holographicId(opts = {}) {
  const { size = 16 } = opts;
  const core = nanoId({ size });
  const checksum = crc16(core);
  const parity = intToBase62(checksum, 3);
  return `${core}${parity}`;
}

/**
 * Validates a Holographic ID.
 */
function verifyHolographic(id) {
  if (typeof id !== 'string' || id.length < 4) return false;
  const core = id.slice(0, -3);
  const parity = id.slice(-3);
  return intToBase62(crc16(core), 3) === parity;
}

/**
 * Attempts to repair a Holographic ID if it contains a single-character typo.
 */
function repairHolographic(id) {
  if (verifyHolographic(id)) return { valid: true, id, repaired: false };
  
  // Try to fix a single-character error (brute-force substitution)
  for (let i = 0; i < id.length; i++) {
    const originalChar = id[i];
    for (let j = 0; j < 62; j++) {
      const testChar = ALPHA_BASE62[j];
      if (testChar === originalChar) continue;
      
      const testId = id.substring(0, i) + testChar + id.substring(i + 1);
      if (verifyHolographic(testId)) {
        return { valid: true, id: testId, repaired: true, original: id };
      }
    }
  }
  
  // If multiple errors, cannot easily repair without higher redundancy
  return { valid: false, reason: 'Too many errors to repair' };
}

// ── Steganographic IDs (Secret Channel) ───────────────────────────────────────

/**
 * Hides an 8-bit integer (0-255) inside a 21-character NanoID.
 * The hidden data is encoded in the parity (even/odd index) of specific characters.
 */
function steganoId(hiddenByte, key, opts = {}) {
  if (hiddenByte < 0 || hiddenByte > 255) throw new Error('hiddenByte must be 0-255');
  const { size = 21 } = opts;
  if (size < 12) throw new Error('Size must be at least 12 for 8-bit steganography');
  
  // Generate a standard NanoID first
  let idArr = nanoId({ size, alphabet: ALPHA_BASE62 }).split('');
  
  // Determine which 8 positions will hold the hidden bits using the key
  const positions = [];
  const hash = crypto.createHmac('sha256', key).update('stegano').digest();
  let hashIdx = 0;
  
  while (positions.length < 8) {
    const pos = hash[hashIdx] % size;
    if (!positions.includes(pos)) {
      positions.push(pos);
    }
    hashIdx = (hashIdx + 1) % hash.length;
  }
  
  // Embed the bits
  for (let i = 0; i < 8; i++) {
    const bit = (hiddenByte >> i) & 1;
    const pos = positions[i];
    let charIdx = ALPHA_BASE62.indexOf(idArr[pos]);
    
    // Ensure the character's index parity matches the bit (0 = even, 1 = odd)
    if ((charIdx % 2) !== bit) {
      charIdx = (charIdx + 1) % 62;
      idArr[pos] = ALPHA_BASE62[charIdx];
    }
  }
  
  return idArr.join('');
}

/**
 * Extracts the hidden 8-bit integer from a Steganographic ID.
 */
function extractStegano(id, key) {
  const size = id.length;
  const positions = [];
  const hash = crypto.createHmac('sha256', key).update('stegano').digest();
  let hashIdx = 0;
  
  while (positions.length < 8) {
    const pos = hash[hashIdx] % size;
    if (!positions.includes(pos)) {
      positions.push(pos);
    }
    hashIdx = (hashIdx + 1) % hash.length;
  }
  
  let hiddenByte = 0;
  for (let i = 0; i < 8; i++) {
    const pos = positions[i];
    const charIdx = ALPHA_BASE62.indexOf(id[pos]);
    if (charIdx === -1) return null; // Invalid character
    
    const bit = charIdx % 2;
    hiddenByte |= (bit << i);
  }
  
  return hiddenByte;
}

// ── Proof-of-Work IDs (Anti-Spam) ─────────────────────────────────────────────

/**
 * Generates an ID challenge for Proof of Work.
 */
function generatePowChallenge(opts = {}) {
  const { difficulty = 4 } = opts; // Number of leading zero hex chars required
  const challenge = nanoId({ size: 16 });
  return { challenge, difficulty };
}

/**
 * Solves a PoW challenge (usually done on the client side).
 */
function solvePowChallenge(challenge, difficulty) {
  const targetPrefix = '0'.repeat(difficulty);
  let nonce = 0;
  while (true) {
    const hash = crypto.createHash('sha256').update(`${challenge}:${nonce}`).digest('hex');
    if (hash.startsWith(targetPrefix)) {
      return { id: `${challenge}_${nonce}`, hash };
    }
    nonce++;
  }
}

/**
 * Verifies a Proof-of-Work ID.
 */
function verifyPow(id, difficulty) {
  const parts = id.split('_');
  if (parts.length !== 2) return false;
  const [challenge, nonce] = parts;
  const targetPrefix = '0'.repeat(difficulty);
  const hash = crypto.createHash('sha256').update(`${challenge}:${nonce}`).digest('hex');
  return hash.startsWith(targetPrefix);
}

// ── Quantum-Lattice IDs (Future-Proof Entropy) ────────────────────────────────

/**
 * Generates a high-entropy ID using a Learning With Errors (LWE) inspired mixing function.
 * This introduces structured noise to the entropy pool, conceptually mimicking lattice crypto.
 */
function latticeId(opts = {}) {
  const { size = 32 } = opts; // Need larger size for lattice entropy
  
  // 1. Secret vector (s) - random bytes
  const s = crypto.randomBytes(16);
  
  // 2. Public matrix (A) - seeded pseudo-random bytes
  const A = crypto.createHash('sha3-256').update(crypto.randomBytes(32)).digest();
  
  // 3. Error vector (e) - Gaussian-like noise (approximated)
  const e = Buffer.alloc(16);
  for (let i = 0; i < 16; i++) {
    // Sum of 4 random bytes minus 510 gives a crude Gaussian around 0
    let noise = (crypto.randomInt(256) + crypto.randomInt(256) + crypto.randomInt(256) + crypto.randomInt(256)) - 510;
    // Map noise into a byte range cleanly
    e[i] = Math.abs(noise) % 256;
  }
  
  // 4. Calculate b = (A * s + e) mod q (simplified matrix multiplication for entropy mixing)
  const b = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    let sum = e[i % 16]; // Add error term
    for (let j = 0; j < 16; j++) {
      sum += A[(i * 16 + j) % 32] * s[j];
    }
    b[i] = sum % 256;
  }
  
  // 5. Final mix with SHA3-512 to collapse the lattice vector into an ID
  const hash = crypto.createHash('sha3-512').update(b).digest();
  
  // 6. Encode to Base62
  let num = BigInt('0x' + hash.toString('hex').slice(0, Math.min(64, size * 2))); // Take enough bytes
  let result = '';
  while (num > 0n && result.length < size) {
    result = ALPHA_BASE62[Number(num % 62n)] + result;
    num = num / 62n;
  }
  
  // Pad if necessary (rare, but possible with BigInt division)
  while (result.length < size) {
    result = ALPHA_BASE62[crypto.randomInt(62)] + result;
  }
  
  return `ql_${result}`;
}

module.exports = {
  holographicId,
  verifyHolographic,
  repairHolographic,
  steganoId,
  extractStegano,
  generatePowChallenge,
  solvePowChallenge,
  verifyPow,
  latticeId
};
