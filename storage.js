/* eslint-env es2020 */
'use strict';

/**
 * storage.js — Persistent Lineage Storage
 * ─────────────────────────────────────────
 * Feature 3: Replaces in-memory Map with a pluggable storage backend.
 * Backends: memory (default) | file (JSON) | custom (any DB adapter)
 */

const fs   = require('fs');
const path = require('path');

// ── Backend Adapters ──────────────────────────────────────────────────────────

class MemoryStorageBackend {
  constructor() { this._store = new Map(); }
  async get(key)        { return this._store.get(key) ?? null; }
  async set(key, value) { this._store.set(key, value); }
  async delete(key)     { this._store.delete(key); }
  async keys(prefix)    { return [...this._store.keys()].filter(k => !prefix || k.startsWith(prefix)); }
  async clear()         { this._store.clear(); }
  async count()         { return this._store.size; }
  get name()            { return 'memory'; }
}

class FileStorageBackend {
  constructor(filePath = './uniqid-lineage.json') {
    this._path = filePath;
    this._cache = null;
  }
  _load() {
    if (this._cache) return this._cache;
    try {
      this._cache = JSON.parse(fs.readFileSync(this._path, 'utf8'));
    } catch { this._cache = {}; }
    return this._cache;
  }
  _save() {
    fs.writeFileSync(this._path, JSON.stringify(this._cache, null, 2));
  }
  async get(key)        { return this._load()[key] ?? null; }
  async set(key, value) { this._load()[key] = value; this._save(); }
  async delete(key)     { delete this._load()[key]; this._save(); }
  async keys(prefix)    { return Object.keys(this._load()).filter(k => !prefix || k.startsWith(prefix)); }
  async clear()         { this._cache = {}; this._save(); }
  async count()         { return Object.keys(this._load()).length; }
  get name()            { return 'file'; }
}

// ── PersistentStore ───────────────────────────────────────────────────────────

class PersistentStore {
  /**
   * @param {{ backend?: 'memory'|'file'|object, filePath?: string }} opts
   */
  constructor(opts = {}) {
    const { backend = 'memory', filePath } = opts;
    if (backend === 'memory')       this._backend = new MemoryStorageBackend();
    else if (backend === 'file')    this._backend = new FileStorageBackend(filePath);
    else if (typeof backend === 'object') this._backend = backend; // custom adapter
    else                            this._backend = new MemoryStorageBackend();
  }

  // ── Lineage API ─────────────────────────────────────────────────────────────

  async addLineageEntry(parentId, entry) {
    const key = `lineage:${parentId}`;
    const existing = (await this._backend.get(key)) || [];
    existing.push({ ...entry, _ts: Date.now() });
    await this._backend.set(key, existing);
  }

  async getLineage(id) {
    return (await this._backend.get(`lineage:${id}`)) || [];
  }

  async getChildren(parentId) {
    const entries = await this.getLineage(parentId);
    return entries.map(e => e.childId).filter(Boolean);
  }

  async clearLineage() {
    const keys = await this._backend.keys('lineage:');
    await Promise.all(keys.map(k => this._backend.delete(k)));
  }

  // ── Generic KV API ──────────────────────────────────────────────────────────

  async get(key)        { return this._backend.get(key); }
  async set(key, value) { return this._backend.set(key, value); }
  async delete(key)     { return this._backend.delete(key); }
  async keys(prefix)    { return this._backend.keys(prefix); }
  async count()         { return this._backend.count(); }
  async clear()         { return this._backend.clear(); }

  get backendName()     { return this._backend.name; }
}

/**
 * Create a persistent store.
 * @param {{ backend?, filePath? }} opts
 */
function createStore(opts = {}) {
  return new PersistentStore(opts); // has addLineageEntry ✅
}

module.exports = { PersistentStore, MemoryStorageBackend, FileStorageBackend, createStore };
