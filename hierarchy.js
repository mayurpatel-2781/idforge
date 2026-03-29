/* eslint-env es2020 */
'use strict';

const crypto = require('crypto');
const { nanoId } = require('./generators');

// ── Hierarchical / Path IDs ───────────────────────────────────────────────────
// Materialized path IDs that encode parent-child depth.
// Enables prefix-range queries without joins.
// Format: <root_segment>/<child_segment>/.../<leaf_segment>

const HIER_SEP = '/';
const HIER_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Generate a root-level hierarchical ID.
 * @param {{ label?, size? }} [opts]
 * @returns {string}  e.g. "org_K7gF3xNp"
 */
function hierarchyRoot(opts = {}) {
  const { label = 'root', size = 8 } = opts;
  const rand = nanoId({ size, alphabet: HIER_ALPHABET });
  return `${label}_${rand}`;
}

/**
 * Generate a child ID nested under a parent path.
 * The full path encodes the entire ancestry.
 *
 * @param {string} parentPath   - result of hierarchyRoot() or hierarchyChild()
 * @param {{ label?, size? }} [opts]
 * @returns {string}  e.g. "org_K7gF3xNp/team_Qr9mZxAb"
 */
function hierarchyChild(parentPath, opts = {}) {
  const { label = 'node', size = 8 } = opts;
  const rand = nanoId({ size, alphabet: HIER_ALPHABET });
  return `${parentPath}${HIER_SEP}${label}_${rand}`;
}

/**
 * Parse a hierarchical path ID into its components.
 *
 * @param {string} pathId
 * @returns {{
 *   segments: string[],
 *   depth: number,
 *   root: string,
 *   parent: string | null,
 *   leaf: string,
 *   labels: string[],
 *   path: string
 * }}
 */
function parseHierarchy(pathId) {
  const segments = pathId.split(HIER_SEP);
  const depth = segments.length - 1; // 0 = root

  const labels = segments.map(seg => {
    const idx = seg.lastIndexOf('_');
    return idx >= 0 ? seg.slice(0, idx) : seg;
  });

  return {
    segments,
    depth,
    root: segments[0],
    parent: segments.length > 1 ? segments.slice(0, -1).join(HIER_SEP) : null,
    leaf: segments[segments.length - 1],
    labels,
    path: pathId,
  };
}

/**
 * Get the parent path of a hierarchical ID.
 * @param {string} pathId
 * @returns {string | null}
 */
function parentOf(pathId) {
  return parseHierarchy(pathId).parent;
}

/**
 * Get the depth of a node (root = 0).
 * @param {string} pathId
 * @returns {number}
 */
function depthOf(pathId) {
  return parseHierarchy(pathId).depth;
}

/**
 * Check if pathId is a descendant of ancestorPath.
 * Works purely on string prefix — no DB needed.
 *
 * @param {string} pathId
 * @param {string} ancestorPath
 * @returns {boolean}
 */
function isDescendant(pathId, ancestorPath) {
  return pathId !== ancestorPath && pathId.startsWith(ancestorPath + HIER_SEP);
}

/**
 * Check if pathId is a direct child of parentPath.
 * @param {string} pathId
 * @param {string} parentPath
 * @returns {boolean}
 */
function isDirectChild(pathId, parentPath) {
  return pathId.startsWith(parentPath + HIER_SEP) &&
    !pathId.slice(parentPath.length + 1).includes(HIER_SEP);
}

/**
 * Get the prefix query range for fetching all descendants.
 * Useful for DB range queries: WHERE id >= range.gte AND id < range.lt
 *
 * @param {string} pathId
 * @returns {{ gte: string, lt: string, prefix: string }}
 */
function subtreeRange(pathId) {
  const prefix = pathId + HIER_SEP;
  // lt: increment last char by 1 to get upper bound
  const lastChar = prefix.charCodeAt(prefix.length - 1);
  const lt = prefix.slice(0, -1) + String.fromCharCode(lastChar + 1);
  return { gte: prefix, lt, prefix };
}

/**
 * Compute the lowest common ancestor of two paths.
 * @param {string} pathA
 * @param {string} pathB
 * @returns {string | null}
 */
function lowestCommonAncestor(pathA, pathB) {
  const segsA = pathA.split(HIER_SEP);
  const segsB = pathB.split(HIER_SEP);
  const common = [];
  for (let i = 0; i < Math.min(segsA.length, segsB.length); i++) {
    if (segsA[i] === segsB[i]) common.push(segsA[i]);
    else break;
  }
  return common.length > 0 ? common.join(HIER_SEP) : null;
}

/**
 * Move a subtree to a new parent (reparent).
 * Returns new path — old path-based DB entries need updating separately.
 *
 * @param {string} pathId
 * @param {string} newParentPath
 * @returns {string}
 */
function reparent(pathId, newParentPath) {
  const { leaf } = parseHierarchy(pathId);
  return `${newParentPath}${HIER_SEP}${leaf}`;
}

/**
 * Sort an array of hierarchy paths in topological order (parents before children).
 * @param {string[]} paths
 * @returns {string[]}
 */
function topoSort(paths) {
  return [...paths].sort((a, b) => {
    const dA = depthOf(a);
    const dB = depthOf(b);
    if (dA !== dB) return dA - dB;
    return a.localeCompare(b);
  });
}

module.exports = {
  hierarchyRoot,
  hierarchyChild,
  parseHierarchy,
  parentOf,
  depthOf,
  isDescendant,
  isDirectChild,
  subtreeRange,
  lowestCommonAncestor,
  reparent,
  topoSort,
};
