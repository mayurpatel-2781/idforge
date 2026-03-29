/* eslint-env es2020 */
'use strict';

const { randomBytes } = require('./utils');
const { nanoId } = require('./generators');

// ── Entropy Scoring ───────────────────────────────────────────────────────────

/**
 * Calculate entropy bits for an ID of given length and alphabet size
 */
function entropyBits(length, alphabetSize) {
  return length * Math.log2(alphabetSize);
}

/**
 * Estimate collision probability for n IDs in a space of 2^bits
 * Birthday paradox approximation
 */
function collisionProbability(n, bits) {
  const space = Math.pow(2, bits);
  // P ≈ 1 - e^(-n²/2S)
  const exponent = -(n * n) / (2 * space);
  return 1 - Math.exp(exponent);
}

/**
 * Get human-readable score label
 */
function scoreLabel(bits) {
  if (bits < 32)  return 'critical';
  if (bits < 64)  return 'weak';
  if (bits < 96)  return 'fair';
  if (bits < 128) return 'strong';
  if (bits < 192) return 'excellent';
  return 'cryptographic';
}

const SCORE_COLORS = {
  critical:     '🔴',
  weak:         '🟠',
  fair:         '🟡',
  strong:       '🟢',
  excellent:    '💚',
  cryptographic:'🔵',
};

/**
 * Get recommended use cases based on entropy
 */
function recommendations(bits) {
  const safeFor = [];
  const unsafeFor = [];

  if (bits >= 48)  safeFor.push('short URLs', 'invite codes');
  if (bits >= 64)  safeFor.push('session tokens', 'cache keys');
  if (bits >= 80)  safeFor.push('API keys (low risk)', 'file names');
  if (bits >= 96)  safeFor.push('database primary keys', 'request IDs');
  if (bits >= 128) safeFor.push('auth tokens', 'CSRF tokens', 'API keys');
  if (bits >= 160) safeFor.push('cryptographic nonces', 'signing keys');

  if (bits < 128) unsafeFor.push('long-term auth tokens');
  if (bits < 96)  unsafeFor.push('database primary keys');
  if (bits < 80)  unsafeFor.push('session tokens');
  if (bits < 64)  unsafeFor.push('short URLs (with guessing attacks)');
  if (bits < 48)  unsafeFor.push('anything security-sensitive');

  return { safeFor, unsafeFor };
}

/**
 * Generate an ID and return it together with a full entropy analysis
 *
 * @param {{ size?, alphabet?, encoding? }} [opts]
 * @returns {{ id: string, entropy: object }}
 */
function measuredId(opts = {}) {
  const {
    size     = 21,
    alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_',
  } = opts;

  const id   = nanoId({ size, alphabet });
  const bits = entropyBits(size, alphabet.length);
  const score = scoreLabel(bits);
  const { safeFor, unsafeFor } = recommendations(bits);

  // Collision probabilities
  const pop1k   = collisionProbability(1e3,  bits);
  const pop1m   = collisionProbability(1e6,  bits);
  const pop1b   = collisionProbability(1e9,  bits);

  const formatPct = (p) => p < 1e-15 ? '~0%' : (p * 100).toExponential(2) + '%';

  let recommendation = '';
  if (bits < 64) recommendation = `⚠️  Increase to at least 16 chars for basic security`;
  else if (bits < 96) recommendation = `Consider increasing size for auth tokens`;
  else if (bits < 128) recommendation = `Good for most use cases. Use 22+ chars for auth tokens`;
  else recommendation = `✅ Strong entropy — suitable for all security contexts`;

  return {
    id,
    entropy: {
      bits:             Math.round(bits * 10) / 10,
      score,
      icon:             SCORE_COLORS[score],
      length:           size,
      alphabetSize:     alphabet.length,
      collisionAt1K:    formatPct(pop1k),
      collisionAt1M:    formatPct(pop1m),
      collisionAt1B:    formatPct(pop1b),
      safeFor,
      unsafeFor,
      recommendation,
    },
  };
}

/**
 * Analyze entropy of an existing ID string
 * @param {string} id
 * @returns {object} entropy analysis
 */
function analyzeEntropy(id) {
  const charset = new Set(id.split('')).size;
  const bits = entropyBits(id.length, charset);
  const score = scoreLabel(bits);
  const { safeFor, unsafeFor } = recommendations(bits);

  return {
    bits: Math.round(bits * 10) / 10,
    score,
    icon: SCORE_COLORS[score],
    length: id.length,
    uniqueChars: charset,
    safeFor,
    unsafeFor,
  };
}

/**
 * Calculate the minimum ID size needed for a given security level and population
 * @param {{ level?, population?, errorRate? }} opts
 * @returns {{ minChars, bits, alphabet }}
 */
function sizeFor(opts = {}) {
  const {
    level      = 'strong',         // 'weak'|'fair'|'strong'|'excellent'|'cryptographic'
    population = 1e6,
    alphabet   = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_',
  } = opts;

  const TARGET_BITS = {
    weak:         48,
    fair:         80,
    strong:       128,
    excellent:    160,
    cryptographic:256,
  };

  const target = TARGET_BITS[level] || 128;
  // Add extra bits to account for birthday paradox with given population
  const extraBits = Math.ceil(Math.log2(population));
  const totalBits = target + extraBits;

  const minChars = Math.ceil(totalBits / Math.log2(alphabet.length));

  return {
    minChars,
    bits: Math.ceil(minChars * Math.log2(alphabet.length)),
    alphabet,
    level,
    population,
  };
}

module.exports = { measuredId, analyzeEntropy, sizeFor, entropyBits, collisionProbability, scoreLabel };
