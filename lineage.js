/* eslint-env es2020 */
'use strict';

const crypto = require('crypto');
const { randomBytes, hmacShort } = require('./utils');
const { nanoId } = require('./generators');

// ── Relationship-Encoded IDs ───────────────────────────────────────────────────

/**
 * Generate a child ID cryptographically linked to a parent ID
 * The link is verifiable without a DB
 *
 * @param {string} parentId
 * @param {{ type?, index?, secret? }} [opts]
 * @returns {string}
 */
function linkedId(parentId, opts = {}) {
  const { type = 'child', index = 0, secret = 'uuid-lab-link-v1' } = opts;
  // Short fingerprint of parent — 8 hex chars
  const fingerprint = crypto
    .createHmac('sha256', secret)
    .update(parentId)
    .digest('hex')
    .slice(0, 8);

  const rand = nanoId({ size: 8, alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' });
  const prefix = type.slice(0, 3);
  return `${prefix}_${fingerprint}_${rand}`;
}

/**
 * Verify a child ID was generated from a specific parent
 * @param {string} childId
 * @param {string} parentId
 * @param {{ secret? }} [opts]
 * @returns {boolean}
 */
function verifyLink(childId, parentId, opts = {}) {
  const { secret = 'uuid-lab-link-v1' } = opts;
  const parts = childId.split('_');
  if (parts.length < 3) return false;
  const embeddedFingerprint = parts[1];
  const expected = crypto
    .createHmac('sha256', secret)
    .update(parentId)
    .digest('hex')
    .slice(0, 8);
  return embeddedFingerprint === expected;
}

// ── ID Lineage & Audit Trail ──────────────────────────────────────────────────

// In-memory lineage store (can be replaced with external store)
const _lineage = new Map();

/**
 * Derive a new ID from a parent, recording the lineage
 * Cryptographically chains: child contains fingerprint of parent
 *
 * @param {string} parentId
 * @param {{ reason?, index?, secret? }} [opts]
 * @returns {string}
 */
function deriveId(parentId, opts = {}) {
  const { reason = 'derived', index = 0, secret = 'uuid-lab-lineage-v1' } = opts;

  const parentHash = crypto
    .createHmac('sha256', secret)
    .update(parentId)
    .digest('hex')
    .slice(0, 10);

  const rand  = nanoId({ size: 6, alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' });
  const childId = `drv_${parentHash}_${rand}`;

  // Store lineage
  const entry = { parentId, childId, reason, index, timestamp: Date.now() };
  if (!_lineage.has(parentId)) _lineage.set(parentId, []);
  _lineage.get(parentId).push(entry);
  _lineage.set(childId, [{ ...entry, isLeaf: true }]);

  return childId;
}

/**
 * Verify that a potential child is a descendant of a parent
 * @param {string} childId
 * @param {string} ancestorId
 * @param {{ secret? }} [opts]
 * @returns {boolean}
 */
function isDescendantOf(childId, ancestorId, opts = {}) {
  const { secret = 'uuid-lab-lineage-v1' } = opts;
  const parts = childId.split('_');
  if (parts.length < 3) return false;

  const embeddedHash = parts[1];
  const expectedHash = crypto
    .createHmac('sha256', secret)
    .update(ancestorId)
    .digest('hex')
    .slice(0, 10);

  if (embeddedHash === expectedHash) return true;

  // Also check recorded lineage
  const records = _lineage.get(ancestorId) || [];
  return records.some(r => r.childId === childId);
}

/**
 * Get the full lineage chain for an ID
 * @param {string} id
 * @returns {Array<{ parentId, childId, reason, timestamp }>}
 */
function getLineage(id) {
  const records = _lineage.get(id) || [];
  return records;
}

/**
 * Get all children derived from a parent ID
 * @param {string} parentId
 * @returns {string[]}
 */
function getChildren(parentId) {
  const records = _lineage.get(parentId) || [];
  return records.map(r => r.childId).filter(Boolean);
}

/**
 * Clear the lineage store (useful for testing)
 */
function clearLineage() { _lineage.clear(); }

module.exports = {
  linkedId, verifyLink,
  deriveId, isDescendantOf, getLineage, getChildren, clearLineage,
};
