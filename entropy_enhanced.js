/* eslint-env es2020 */
'use strict';

const { nanoId } = require('./generators');

// ── Entropy Scoring (enhanced with real randomness tests) ─────────────────────

function entropyBits(length, alphabetSize) {
  return length * Math.log2(alphabetSize);
}

function collisionProbability(n, bits) {
  const space = Math.pow(2, bits);
  return 1 - Math.exp(-(n * n) / (2 * space));
}

function scoreLabel(bits) {
  if (bits < 32)  return 'critical';
  if (bits < 64)  return 'weak';
  if (bits < 96)  return 'fair';
  if (bits < 128) return 'strong';
  if (bits < 192) return 'excellent';
  return 'cryptographic';
}

const SCORE_COLORS = {
  critical: '🔴', weak: '🟠', fair: '🟡',
  strong: '🟢', excellent: '💚', cryptographic: '🔵',
};

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

function measuredId(opts = {}) {
  const {
    size     = 21,
    alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_',
  } = opts;
  const id   = nanoId({ size, alphabet });
  const bits = entropyBits(size, alphabet.length);
  const score = scoreLabel(bits);
  const { safeFor, unsafeFor } = recommendations(bits);
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
      bits: Math.round(bits * 10) / 10,
      score, icon: SCORE_COLORS[score],
      length: size, alphabetSize: alphabet.length,
      collisionAt1K: formatPct(pop1k),
      collisionAt1M: formatPct(pop1m),
      collisionAt1B: formatPct(pop1b),
      safeFor, unsafeFor, recommendation,
    },
  };
}

// ── NEW: Real Randomness Tests ────────────────────────────────────────────────

/**
 * Chi-squared uniformity test — checks if character distribution is uniform.
 * A truly random ID should have roughly equal frequency for all chars.
 *
 * @param {string} id
 * @returns {{ chiSq: number, pValue: string, verdict: string, details: object }}
 */
function chiSquaredTest(id) {
  const observed = {};
  for (const ch of id) observed[ch] = (observed[ch] || 0) + 1;

  const k = Object.keys(observed).length; // unique chars
  if (k < 2) return { chiSq: Infinity, pValue: '~0', verdict: 'patterned', details: { reason: 'only 1 unique char' } };

  const expected = id.length / k;
  let chiSq = 0;
  for (const count of Object.values(observed)) {
    chiSq += Math.pow(count - expected, 2) / expected;
  }

  // Degrees of freedom = k - 1
  const df = k - 1;

  // Approximate p-value using Wilson–Hilferty transformation
  const pValue = _chiSqPValue(chiSq, df);

  let verdict;
  if (id.length < 8) {
    verdict = 'too-short';
  } else if (pValue < 0.001) {
    verdict = 'patterned';
  } else if (pValue < 0.05) {
    verdict = 'suspicious';
  } else {
    verdict = 'uniform';
  }

  return {
    chiSq: Math.round(chiSq * 100) / 100,
    pValue: pValue.toFixed(4),
    verdict,
    details: { uniqueChars: k, expected: Math.round(expected * 10) / 10, df },
  };
}

/**
 * Run-length test — detects sequential bias (repeating chars, ordered sequences).
 * @param {string} id
 * @returns {{ longestRun: number, avgRun: number, verdict: string }}
 */
function runLengthTest(id) {
  if (id.length < 4) return { longestRun: id.length, avgRun: id.length, verdict: 'too-short' };

  let longestRun = 1;
  let currentRun = 1;
  let totalRuns = 1;
  let runCount = 1;

  for (let i = 1; i < id.length; i++) {
    if (id[i] === id[i - 1]) {
      currentRun++;
      if (currentRun > longestRun) longestRun = currentRun;
    } else {
      totalRuns += currentRun;
      runCount++;
      currentRun = 1;
    }
  }
  totalRuns += currentRun;

  const avgRun = Math.round((totalRuns / runCount) * 100) / 100;

  // Expected longest run for random: log(n) / log(alphabet)
  const uniqueChars = new Set(id).size;
  const expectedLongest = uniqueChars > 1
    ? Math.log(id.length) / Math.log(uniqueChars)
    : id.length;

  let verdict;
  if (longestRun > expectedLongest * 3) verdict = 'sequential-bias';
  else if (longestRun > expectedLongest * 2) verdict = 'mild-bias';
  else verdict = 'random';

  return { longestRun, avgRun, expectedLongest: Math.round(expectedLongest * 10) / 10, verdict };
}

/**
 * Full randomness analysis combining chi-squared + run-length + entropy.
 * Enhanced version of analyzeEntropy().
 *
 * @param {string} id
 * @returns {object}
 */
function analyzeEntropy(id) {
  const charset = new Set(id.split('')).size;
  const bits = entropyBits(id.length, charset);
  const score = scoreLabel(bits);
  const { safeFor, unsafeFor } = recommendations(bits);

  const chiSq   = chiSquaredTest(id);
  const runLen  = runLengthTest(id);

  // Overall verdict
  let randomnessVerdict;
  if (id.length < 8) {
    randomnessVerdict = 'too-short-to-test';
  } else if (chiSq.verdict === 'patterned' || runLen.verdict === 'sequential-bias') {
    randomnessVerdict = 'biased';
  } else if (chiSq.verdict === 'suspicious' || runLen.verdict === 'mild-bias') {
    randomnessVerdict = 'suspicious';
  } else {
    randomnessVerdict = 'appears-random';
  }

  return {
    bits: Math.round(bits * 10) / 10,
    score,
    icon: SCORE_COLORS[score],
    length: id.length,
    uniqueChars: charset,
    safeFor,
    unsafeFor,
    randomness: {
      verdict: randomnessVerdict,
      chiSquared: chiSq,
      runLength: runLen,
    },
  };
}

function sizeFor(opts = {}) {
  const {
    level      = 'strong',
    population = 1e6,
    alphabet   = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_',
  } = opts;
  const TARGET_BITS = { weak: 48, fair: 80, strong: 128, excellent: 160, cryptographic: 256 };
  const target = TARGET_BITS[level] || 128;
  const extraBits = Math.ceil(Math.log2(population));
  const totalBits = target + extraBits;
  const minChars = Math.ceil(totalBits / Math.log2(alphabet.length));
  return { minChars, bits: Math.ceil(minChars * Math.log2(alphabet.length)), alphabet, level, population };
}

// ── Chi-Squared p-value approximation (Wilson–Hilferty) ──────────────────────
function _chiSqPValue(chiSq, df) {
  // Using regularized incomplete gamma function approximation
  const x = chiSq / 2;
  const a = df / 2;
  // Upper tail: 1 - P(a, x) ≈ e^(-x) * x^a / Gamma(a) ... use continued fraction
  // Simplified: Wilson-Hilferty normal approximation
  if (df <= 0) return 0;
  const z = Math.pow(chiSq / df, 1/3) - (1 - 2/(9 * df));
  const sigma = Math.sqrt(2 / (9 * df));
  const zScore = z / sigma;
  // Normal CDF upper tail
  return _normalUpperTail(zScore);
}

function _normalUpperTail(z) {
  // Abramowitz & Stegun approximation
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const pdf = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
  const p = pdf * poly;
  return z > 0 ? p : 1 - p;
}

module.exports = { measuredId, analyzeEntropy, sizeFor, entropyBits, collisionProbability, scoreLabel, chiSquaredTest, runLengthTest };
