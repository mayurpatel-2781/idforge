/* eslint-env es2020 */
'use strict';

const crypto = require('crypto');

// ── Fuzzy / Typo-Resistant IDs ────────────────────────────────────────────────
// Uses Crockford Base32: excludes I, L, O, U to avoid visual ambiguity.
// Includes Luhn mod-N checksum for single-error detection + auto-correction.

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // 32 chars, no I/L/O/U
const CROCKFORD_SIZE = BigInt(CROCKFORD.length);

// Common transcription mistake map → canonical char
const CORRECTIONS = {
  'I': '1', 'i': '1',   // I → 1
  'L': '1', 'l': '1',   // l → 1
  'O': '0', 'o': '0',   // O → 0
  'U': 'V', 'u': 'V',   // U → V (nearest in Crockford)
  ' ': '',  '-': '',     // strip separators
};

/**
 * Generate a typo-resistant ID using Crockford Base32.
 * Safe for phone/verbal transcription. Includes checksum character.
 *
 * @param {{ size?, prefix?, separator? }} [opts]
 * @returns {string}
 */
function fuzzyId(opts = {}) {
  const { size = 16, prefix = '', separator = '-' } = opts;

  // Generate random bytes → encode in Crockford Base32
  const byteCount = Math.ceil(size * 5 / 8) + 2; // 5 bits per char
  const buf = crypto.randomBytes(byteCount);
  let num = BigInt('0x' + buf.toString('hex'));

  let raw = '';
  while (raw.length < size - 1) { // -1 for checksum
    raw = CROCKFORD[Number(num % CROCKFORD_SIZE)] + raw;
    num /= CROCKFORD_SIZE;
  }
  raw = raw.slice(-(size - 1)); // trim to needed length

  // Compute Luhn mod-32 checksum
  const checkChar = _luhnCheckChar(raw);
  const full = raw + checkChar;

  // Format with separators every 4 chars
  if (separator) {
    const chunks = full.match(/.{1,4}/g) || [full];
    const formatted = chunks.join(separator);
    return prefix ? `${prefix}${separator}${formatted}` : formatted;
  }

  return prefix ? `${prefix}-${full}` : full;
}

/**
 * Validate a fuzzy ID — returns whether the checksum is correct.
 * Tolerates separators and common transcription mistakes.
 *
 * @param {string} id
 * @returns {{ valid: boolean, corrected?: string, errors?: string[] }}
 */
function validateFuzzy(id) {
  const { normalized, corrections } = _normalize(id);

  if (normalized.length < 2) {
    return { valid: false, errors: ['ID too short'] };
  }

  const body = normalized.slice(0, -1);
  const given = normalized.slice(-1);
  const expected = _luhnCheckChar(body);

  const valid = given === expected;
  const result = { valid };

  if (corrections.length > 0) {
    result.corrected = _format(normalized);
    result.autoFixed = corrections;
  }

  if (!valid) {
    result.errors = [`Checksum mismatch — expected "${expected}", got "${given}"`];
  }

  return result;
}

/**
 * Attempt to auto-correct a fuzzy ID with a single character error.
 * Tries flipping each position through the alphabet until checksum passes.
 *
 * @param {string} id
 * @returns {{ corrected: string | null, position?: number }}
 */
function correctFuzzy(id) {
  const { normalized } = _normalize(id);

  // First check if already valid
  if (validateFuzzy(normalized).valid) {
    return { corrected: _format(normalized) };
  }

  // Try substituting each position
  const body = normalized.slice(0, -1);
  for (let i = 0; i < normalized.length; i++) {
    for (const c of CROCKFORD) {
      const attempt = normalized.slice(0, i) + c + normalized.slice(i + 1);
      if (validateFuzzy(attempt).valid) {
        return { corrected: _format(attempt), position: i };
      }
    }
  }

  return { corrected: null };
}

/**
 * Parse a fuzzy ID into its components (strips prefix and separators)
 * @param {string} id
 * @param {{ prefix?, separator? }} [opts]
 * @returns {{ body: string, checkChar: string, valid: boolean, prefix?: string }}
 */
function parseFuzzy(id, opts = {}) {
  const { prefix = '' } = opts;
  let core = id;

  // Strip known prefix
  if (prefix && core.toUpperCase().startsWith(prefix.toUpperCase() + '-')) {
    core = core.slice(prefix.length + 1);
  }

  const { normalized } = _normalize(core);
  const valid = validateFuzzy(normalized).valid;

  return {
    prefix: prefix || null,
    body: normalized.slice(0, -1),
    checkChar: normalized.slice(-1),
    valid,
    raw: id,
  };
}

// ── Internals ─────────────────────────────────────────────────────────────────

function _normalize(id) {
  const corrections = [];
  let normalized = '';

  for (const ch of id.toUpperCase()) {
    if (CORRECTIONS[ch] !== undefined) {
      if (CORRECTIONS[ch] !== '') {
        corrections.push({ from: ch, to: CORRECTIONS[ch] });
        normalized += CORRECTIONS[ch];
      }
      // else strip (separator)
    } else if (CROCKFORD.includes(ch)) {
      normalized += ch;
    }
    // else ignore unknown chars
  }

  return { normalized, corrections };
}

function _luhnCheckChar(str) {
  // Luhn mod-N algorithm with N=32 (Crockford alphabet)
  const N = CROCKFORD.length;
  let factor = 2;
  let sum = 0;

  for (let i = str.length - 1; i >= 0; i--) {
    const codePoint = CROCKFORD.indexOf(str[i]);
    let addend = factor * codePoint;
    factor = factor === 2 ? 1 : 2;
    addend = Math.floor(addend / N) + (addend % N);
    sum += addend;
  }

  const remainder = sum % N;
  const checkCodePoint = (N - remainder) % N;
  return CROCKFORD[checkCodePoint];
}

function _format(normalized) {
  return (normalized.match(/.{1,4}/g) || [normalized]).join('-');
}


module.exports = { fuzzyId, validateFuzzy, correctFuzzy, parseFuzzy, CROCKFORD };
