/* eslint-env es2020 */
'use strict';

/**
 * tokens.js — Advanced Security Tokens and Zero-Knowledge IDs
 * ───────────────────────────────────────────────────────────
 * Provides JWT-like authenticated IDs, and cryptographic commitments
 * (Zero-knowledge IDs) for privacy-preserving verification.
 */

const crypto = require('crypto');
const { nanoId } = require('./generators');

// ── JWT-like Token IDs ────────────────────────────────────────────────────────

/**
 * Generate a cryptographically signed token ID with an embedded payload.
 * Useful for stateless sessions, password resets, or API keys.
 * Format: `tk_<base64url_payload>.<signature>`
 *
 * @param {object} payload JSON payload to embed
 * @param {string} secret Secret key for signing
 * @param {{ expiresIn?: number }} opts Options (expiresIn is in seconds)
 * @returns {string}
 */
function tokenId(payload = {}, secret, opts = {}) {
  if (!secret) throw new Error('tokenId: secret is required');

  const claims = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    jti: nanoId({ size: 12 }),
  };

  if (opts.expiresIn) {
    claims.exp = claims.iat + opts.expiresIn;
  }

  const encodedPayload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');

  return `tk_${encodedPayload}.${signature}`;
}

/**
 * Verify and decode a token ID.
 * @param {string} token The token ID
 * @param {string} secret The secret key used to sign it
 * @returns {{ valid: boolean, payload?: object, error?: string }}
 */
function verifyTokenId(token, secret) {
  if (!secret) throw new Error('verifyTokenId: secret is required');
  if (!token || !token.startsWith('tk_')) {
    return { valid: false, error: 'Invalid token format' };
  }

  const parts = token.slice(3).split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Malformed token' };
  }

  const [encodedPayload, signature] = parts;
  
  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');

  // Use timing-safe equal to prevent timing attacks
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { valid: false, error: 'Invalid signature' };
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    
    // Check expiration
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
      return { valid: false, error: 'Token expired' };
    }

    return { valid: true, payload };
  } catch (err) {
    return { valid: false, error: 'Failed to parse payload' };
  }
}

// ── Zero-Knowledge IDs (Commitments) ──────────────────────────────────────────

/**
 * Create a cryptographic commitment to an ID without revealing it.
 * Uses a blinding factor (salt) so the hash cannot be easily reversed.
 *
 * @param {string} id The actual ID to commit to
 * @param {string} [blindingFactor] Optional custom salt. If omitted, one is generated.
 * @returns {{ commitment: string, blindingFactor: string }}
 */
function commitId(id, blindingFactor = null) {
  const salt = blindingFactor || crypto.randomBytes(16).toString('hex');
  const commitment = crypto
    .createHash('sha256')
    .update(`${salt}:${id}`)
    .digest('hex');
    
  return { commitment, blindingFactor: salt };
}

/**
 * Verify that a specific ID matches a previously generated commitment,
 * given the blinding factor used during creation.
 *
 * @param {string} commitment The public commitment hash
 * @param {string} id The ID to verify
 * @param {string} blindingFactor The secret blinding factor
 * @returns {boolean} True if the ID matches the commitment
 */
function verifyCommitment(commitment, id, blindingFactor) {
  const expected = crypto
    .createHash('sha256')
    .update(`${blindingFactor}:${id}`)
    .digest('hex');
  return commitment === expected;
}

module.exports = {
  tokenId,
  verifyTokenId,
  commitId,
  verifyCommitment,
};
