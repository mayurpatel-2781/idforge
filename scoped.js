/* eslint-env es2020 */
'use strict';

const crypto = require('crypto');

// ── Role-Scoped IDs ───────────────────────────────────────────────────────────
// The same resource gets a different ID per viewer role.
// Both are deterministically reversible with the secret.

const SCOPE_SEP = '_';

/**
 * Generate a role-scoped view of a resource ID.
 * Same resource + same role + same secret → always same scoped ID.
 * Different role → completely different-looking ID.
 *
 * @param {string} resourceId    - the real internal ID
 * @param {{ role, secret }}  opts
 * @returns {string}             - scoped ID safe to expose to client
 */
function scopedId(resourceId, opts = {}) {
  const { role = 'user', secret = 'scope-secret' } = opts;
  const input = `${role}:${resourceId}`;

  // Deterministic but opaque: HMAC-SHA256, take first 16 bytes → base64url
  const hash = crypto
    .createHmac('sha256', secret)
    .update(input)
    .digest('base64url')
    .slice(0, 22); // ~132 bits

  // Preserve type prefix if present (e.g. "ord_")
  const prefixMatch = resourceId.match(/^([a-z]{2,6})_/);
  const prefix = prefixMatch ? prefixMatch[1] + SCOPE_SEP : '';

  return `${prefix}${hash}`;
}

/**
 * Resolve a scoped ID back to the real resource ID.
 * Requires knowing the role and iterating your resource list,
 * OR use resolveFromMap() for O(1) lookup.
 *
 * @param {string} scoped       - the scoped ID the client sent
 * @param {string[]} candidates - list of real resource IDs to try
 * @param {{ role, secret }}  opts
 * @returns {string|null}       - real resource ID, or null
 */
function resolveScoped(scoped, candidates, opts = {}) {
  for (const candidate of candidates) {
    if (scopedId(candidate, opts) === scoped) return candidate;
  }
  return null;
}

/**
 * Build a reverse-lookup map for fast scoped ID resolution.
 * Pre-compute scoped → real for a list of resource IDs.
 *
 * @param {string[]} resourceIds
 * @param {{ role, secret }} opts
 * @returns {Map<string, string>}   scopedId → realId
 */
function buildScopeMap(resourceIds, opts = {}) {
  const map = new Map();
  for (const id of resourceIds) {
    map.set(scopedId(id, opts), id);
  }
  return map;
}

/**
 * Check if two scoped IDs refer to the same underlying resource
 * (even if generated with different roles)
 *
 * @param {string} scopedA
 * @param {string} scopedB
 * @param {{ roleA, roleB, secret, candidates }} opts
 * @returns {boolean}
 */
function isSameResource(scopedA, scopedB, opts = {}) {
  const { roleA, roleB, secret, candidates = [] } = opts;
  const realA = resolveScoped(scopedA, candidates, { role: roleA, secret });
  const realB = resolveScoped(scopedB, candidates, { role: roleB, secret });
  return realA !== null && realA === realB;
}

module.exports = { scopedId, resolveScoped, buildScopeMap, isSameResource };
