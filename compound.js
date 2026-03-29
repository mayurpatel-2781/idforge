/* eslint-env es2020 */
'use strict';

const crypto = require('crypto');

// ── Composite / Compound IDs ──────────────────────────────────────────────────
// Encode multiple IDs into a single reversible string.
// Useful for join-table records, pivot tables, and multi-tenant keys.

const COMP_SEP = '\x00'; // null-byte internal separator (never appears in base64url)
const COMP_VERSION = 'c1'; // version prefix

/**
 * Combine 2 or more IDs into a single compound ID.
 * Fully reversible — splitId() returns the originals exactly.
 * Order-independent variant available via opts.sorted.
 *
 * @param {string[]} ids         - array of IDs to combine (min 2)
 * @param {{ sorted?, prefix?, tag? }} [opts]
 *   sorted: true → canonical order (set semantics, useful for undirected edges)
 *   prefix: optional string prefix like 'edge'
 *   tag:    optional label embedded in the ID (e.g. 'likes', 'follows')
 * @returns {string}
 */
function compoundId(ids, opts = {}) {
  if (!Array.isArray(ids) || ids.length < 2) {
    throw new Error('compoundId requires at least 2 IDs');
  }

  const { sorted = false, prefix = '', tag = '' } = opts;
  const ordered = sorted ? [...ids].sort() : ids;

  // Encode: version + tag + null-separated IDs → base64url
  const tagPart = tag ? `${tag}:` : '';
  const payload = `${COMP_VERSION}:${tagPart}${ordered.join(COMP_SEP)}`;
  const encoded = Buffer.from(payload, 'utf8').toString('base64url');

  return prefix ? `${prefix}_${encoded}` : encoded;
}

/**
 * Split a compound ID back into its original component IDs.
 *
 * @param {string} id
 * @param {{ prefix? }} [opts]
 * @returns {{ ids: string[], tag?: string, version: string, valid: boolean }}
 */
function splitId(id, opts = {}) {
  const { prefix = '' } = opts;

  try {
    let core = id;

    // Strip prefix
    if (prefix && core.startsWith(`${prefix}_`)) {
      core = core.slice(prefix.length + 1);
    } else if (!prefix && core.includes('_')) {
      // Auto-detect: if there's a short prefix, strip it
      const parts = core.split('_');
      if (parts[0].length <= 8) core = parts.slice(1).join('_');
    }

    const decoded = Buffer.from(core, 'base64url').toString('utf8');
    const colonIdx = decoded.indexOf(':');
    if (colonIdx < 0) return { valid: false, ids: [], version: 'unknown' };

    const version = decoded.slice(0, colonIdx);
    let rest = decoded.slice(colonIdx + 1);

    // Extract optional tag
    let tag;
    const tagMatch = rest.match(/^([^:\x00]+):([\s\S]*)$/);
    if (tagMatch && !tagMatch[1].startsWith('c')) {
      tag = tagMatch[1];
      rest = tagMatch[2];
    }

    const ids = rest.split(COMP_SEP);

    return { ids, tag, version, valid: true };
  } catch {
    return { valid: false, ids: [], version: 'unknown' };
  }
}

/**
 * Check if two compound IDs share any component IDs.
 * @param {string} a
 * @param {string} b
 * @returns {string[]} shared IDs
 */
function sharedComponents(a, b) {
  const { ids: aIds } = splitId(a);
  const { ids: bIds } = splitId(b);
  return aIds.filter(id => bIds.includes(id));
}

/**
 * Check if a compound ID contains a specific component ID.
 * @param {string} compound
 * @param {string} componentId
 * @returns {boolean}
 */
function hasComponent(compound, componentId) {
  const { ids } = splitId(compound);
  return ids.includes(componentId);
}

/**
 * Generate a compound ID that also includes a timestamp,
 * useful for timestamped relationships (e.g. "user followed team at T").
 *
 * @param {string[]} ids
 * @param {{ tag?, prefix? }} [opts]
 * @returns {string}
 */
function timedCompoundId(ids, opts = {}) {
  const ts = Date.now().toString(36);
  return compoundId([...ids, `__ts:${ts}`], opts);
}

/**
 * Extract the timestamp from a timed compound ID.
 * @param {string} id
 * @returns {Date | null}
 */
function extractTimestamp(id) {
  const { ids } = splitId(id);
  const tsEntry = ids.find(i => i.startsWith('__ts:'));
  if (!tsEntry) return null;
  return new Date(parseInt(tsEntry.slice(5), 36));
}

module.exports = {
  compoundId,
  splitId,
  sharedComponents,
  hasComponent,
  timedCompoundId,
  extractTimestamp,
};
