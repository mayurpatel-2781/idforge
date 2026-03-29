/* eslint-env es2020 */
'use strict';

/**
 * batchverify.js — Batch Verification + ID Comparison Utilities
 * ──────────────────────────────────────────────────────────────
 * Features 4 & 5
 */

const crypto = require('crypto');
const { decodeId, parseId } = require('./decoder');

// ── Batch Verification ────────────────────────────────────────────────────────

/**
 * Verify a batch of IDs against a set of rules.
 * @param {string[]} ids
 * @param {Array<{ name, fn }>} rules
 * @returns {{ passed, failed, results }}
 */
function batchVerify(ids, rules = []) {
  const results = ids.map(id => {
    const checks = rules.map(rule => {
      let pass = false;
      let reason = '';
      try { pass = !!rule.fn(id); } catch(e) { reason = e.message; }
      return { rule: rule.name, pass, reason };
    });
    return { id, pass: checks.every(c => c.pass), checks };
  });

  return {
    total:  results.length,
    passed: results.filter(r => r.pass).length,
    failed: results.filter(r => !r.pass).length,
    results,
  };
}

/**
 * Verify signed IDs in batch.
 * @param {Array<{id, signature}>} items
 * @param {string} key
 */
function batchVerifySigned(items, key) {
  return items.map(({ id, signature }) => {
    const expected = crypto.createHmac('sha256', key).update(id).digest('hex').slice(0, 16);
    return { id, valid: signature === expected };
  });
}

/**
 * Check a batch of IDs for collisions (duplicates within the batch itself).
 * @param {string[]} ids
 * @returns {{ unique, duplicates, collisionGroups }}
 */
function batchCheckCollisions(ids) {
  const seen = new Map();
  for (const id of ids) {
    seen.set(id, (seen.get(id) || 0) + 1);
  }
  const duplicates = [...seen.entries()].filter(([, n]) => n > 1).map(([id, count]) => ({ id, count }));
  return {
    total: ids.length,
    unique: ids.length - duplicates.reduce((s, d) => s + d.count - 1, 0),
    duplicates,
    hasDuplicates: duplicates.length > 0,
  };
}

/**
 * Validate a batch against a regex or function pattern.
 * @param {string[]} ids
 * @param {RegExp|Function} pattern
 */
function batchValidate(ids, pattern) {
  const test = typeof pattern === 'function' ? pattern : id => pattern.test(id);
  const results = ids.map(id => ({ id, valid: test(id) }));
  return {
    total: results.length,
    valid: results.filter(r => r.valid).length,
    invalid: results.filter(r => !r.valid).length,
    results,
  };
}

// ── ID Comparison Utilities ───────────────────────────────────────────────────

/**
 * Compare two IDs — checks equality, type match, relative order.
 * @param {string} a
 * @param {string} b
 * @returns {{ equal, sameType, order, typeA, typeB }}
 */
function compareIds(a, b) {
  const da = parseId(a);
  const db = parseId(b);
  return {
    equal:    a === b,
    sameType: da.type === db.type,
    typeA:    da.type,
    typeB:    db.type,
    order:    a < b ? -1 : a > b ? 1 : 0,
    lexOrder: a.localeCompare(b),
  };
}

/**
 * Sort IDs by their embedded timestamp (works for ULID, UUID v7, Snowflake, Topology).
 * Falls back to lexicographic sort for other types.
 * @param {string[]} ids
 * @param {'asc'|'desc'} direction
 */
function sortById(ids, direction = 'asc') {
  const withTs = ids.map(id => {
    const d = decodeId(id);
    const ts = d.timestamp ?? null;
    return { id, ts };
  });
  withTs.sort((a, b) => {
    if (a.ts !== null && b.ts !== null) return a.ts - b.ts;
    return a.id.localeCompare(b.id);
  });
  if (direction === 'desc') withTs.reverse();
  return withTs.map(x => x.id);
}

/**
 * Find IDs that appear in list A but not list B (diff).
 */
function diffIds(a, b) {
  const setB = new Set(b);
  const setA = new Set(a);
  return {
    onlyInA: [...setA].filter(id => !setB.has(id)),
    onlyInB: [...setB].filter(id => !setA.has(id)),
    inBoth:  [...setA].filter(id => setB.has(id)),
  };
}

/**
 * Group IDs by their decoded type.
 * @param {string[]} ids
 */
function groupByType(ids) {
  const groups = {};
  for (const id of ids) {
    const { type } = decodeId(id);
    if (!groups[type]) groups[type] = [];
    groups[type].push(id);
  }
  return groups;
}

/**
 * Deduplicate an array of IDs, preserving first occurrence.
 */
function deduplicateIds(ids) {
  return [...new Set(ids)];
}

module.exports = {
  batchVerify, batchVerifySigned, batchCheckCollisions, batchValidate,
  compareIds, sortById, diffIds, groupByType, deduplicateIds,
};
