/* eslint-env es2020 */
'use strict';

/**
 * query.js — ID Search / Query System + ID Grouping / Tagging
 * ─────────────────────────────────────────────────────────────
 * Features 6 & 15: Query, filter, tag, and search across ID collections.
 */

const { decodeId } = require('./decoder');

// ── ID Index ──────────────────────────────────────────────────────────────────

class IdIndex {
  constructor() {
    this._ids    = new Map();  // id → { id, type, tags, meta, addedAt }
    this._tags   = new Map();  // tag → Set<id>
    this._types  = new Map();  // type → Set<id>
  }

  /**
   * Add an ID to the index with optional tags and metadata.
   */
  add(id, { tags = [], meta = {} } = {}) {
    const decoded = decodeId(id);
    const entry = { id, type: decoded.type, tags: [...tags], meta, addedAt: Date.now(), decoded };
    this._ids.set(id, entry);

    // Index by type
    if (!this._types.has(decoded.type)) this._types.set(decoded.type, new Set());
    this._types.get(decoded.type).add(id);

    // Index by tags
    for (const tag of tags) {
      if (!this._tags.has(tag)) this._tags.set(tag, new Set());
      this._tags.get(tag).add(id);
    }
    return this;
  }

  /**
   * Add tags to an existing ID.
   */
  tag(id, ...tags) {
    const entry = this._ids.get(id);
    if (!entry) throw new Error(`ID "${id}" not in index`);
    for (const t of tags) {
      if (!entry.tags.includes(t)) entry.tags.push(t);
      if (!this._tags.has(t)) this._tags.set(t, new Set());
      this._tags.get(t).add(id);
    }
    return this;
  }

  /**
   * Remove tags from an ID.
   */
  untag(id, ...tags) {
    const entry = this._ids.get(id);
    if (!entry) return this;
    for (const t of tags) {
      entry.tags = entry.tags.filter(x => x !== t);
      this._tags.get(t)?.delete(id);
    }
    return this;
  }

  /**
   * Remove an ID from the index.
   */
  remove(id) {
    const entry = this._ids.get(id);
    if (!entry) return false;
    this._types.get(entry.type)?.delete(id);
    for (const t of entry.tags) this._tags.get(t)?.delete(id);
    this._ids.delete(id);
    return true;
  }

  /**
   * Query the index with a filter object.
   * @param {{
   *   type?: string,
   *   tags?: string[],
   *   tagMode?: 'all'|'any',
   *   meta?: object,
   *   since?: number,
   *   until?: number,
   *   search?: string,
   *   limit?: number,
   *   offset?: number,
   *   orderBy?: 'addedAt'|'id',
   *   order?: 'asc'|'desc',
   * }} filter
   */
  query(filter = {}) {
    const {
      type, tags, tagMode = 'all', meta,
      since, until, search,
      limit = Infinity, offset = 0,
      orderBy = 'addedAt', order = 'asc',
    } = filter;

    let candidates = [...this._ids.values()];

    if (type)   candidates = candidates.filter(e => e.type === type);
    if (since)  candidates = candidates.filter(e => e.addedAt >= since);
    if (until)  candidates = candidates.filter(e => e.addedAt <= until);
    if (search) candidates = candidates.filter(e => e.id.includes(search));

    if (tags?.length) {
      candidates = candidates.filter(e => {
        if (tagMode === 'all') return tags.every(t => e.tags.includes(t));
        return tags.some(t => e.tags.includes(t));
      });
    }

    if (meta) {
      candidates = candidates.filter(e =>
        Object.entries(meta).every(([k, v]) => e.meta[k] === v)
      );
    }

    candidates.sort((a, b) => {
      const cmp = orderBy === 'id' ? a.id.localeCompare(b.id) : a.addedAt - b.addedAt;
      return order === 'desc' ? -cmp : cmp;
    });

    const total = candidates.length;
    const results = candidates.slice(offset, offset === 0 && limit === Infinity ? undefined : offset + limit);

    return { total, results, offset, limit: limit === Infinity ? total : limit };
  }

  /** Get a single entry by ID. */
  get(id) { return this._ids.get(id) ?? null; }

  /** Get all IDs with a specific tag. */
  getByTag(tag) { return [...(this._tags.get(tag) ?? [])]; }

  /** Get all IDs of a specific type. */
  getByType(type) { return [...(this._types.get(type) ?? [])]; }

  /** Get all registered tags. */
  allTags() { return [...this._tags.keys()]; }

  /** Get all types in the index. */
  allTypes() { return [...this._types.keys()]; }

  /** Stats about the index. */
  stats() {
    return {
      total: this._ids.size,
      byType: Object.fromEntries([...this._types.entries()].map(([t, s]) => [t, s.size])),
      byTag:  Object.fromEntries([...this._tags.entries()].map(([t, s]) => [t, s.size])),
      tags:   this._tags.size,
    };
  }

  /** Export all entries as a plain array. */
  export() {
    return [...this._ids.values()];
  }

  /** Import entries from a plain array (e.g. from export()). */
  import(entries) {
    for (const e of entries) this.add(e.id, { tags: e.tags, meta: e.meta });
    return this;
  }
}

/**
 * Create a new ID index.
 */
function createIndex() {
  return new IdIndex();
}

module.exports = { IdIndex, createIndex };
