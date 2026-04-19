/* eslint-env es2020 */
'use strict';

/**
 * namespace.js — Namespace-based ID Management
 * Define namespaces, generate/validate scoped IDs,
 * environment-aware IDs, React/Vue framework code generation.
 */

const { nanoId } = require('./generators');

// ── Registry ──────────────────────────────────────────────────────────────────

const _namespaces = new Map();
let   _env        = 'development';

const ENV_CODES = {
  production:  'prod',
  staging:     'stg',
  development: 'dev',
  test:        'tst',
  local:       'lcl',
};

// ── Namespace CRUD ────────────────────────────────────────────────────────────

function defineNamespace(name, config = {}) {
  if (!name || typeof name !== 'string')
    throw new TypeError('defineNamespace: name must be a non-empty string');
  _namespaces.set(name, {
    name,
    prefix:      config.prefix      || name.slice(0, 3).toLowerCase(),
    separator:   config.separator   ?? '_',
    size:        config.size        ?? 16,
    description: config.description || '',
    version:     config.version     || 1,
    createdAt:   Date.now(),
    ...config,
  });
  return _namespaces.get(name);
}

function getNamespace(name) {
  return _namespaces.get(name) || null;
}

function listNamespaces() {
  return [..._namespaces.keys()];
}

// ── ID Generation ─────────────────────────────────────────────────────────────

function namespaceId(namespaceName, opts = {}) {
  const ns = _namespaces.get(namespaceName);
  if (!ns) throw new Error(`Namespace "${namespaceName}" not found. Call defineNamespace() first.`);
  const { prefix, separator, size } = ns;
  return `${prefix}${separator}${nanoId({ size })}`;
}

// ── Membership ────────────────────────────────────────────────────────────────

function belongsTo(id, namespaceName) {
  const ns = _namespaces.get(namespaceName);
  if (!ns) return false;
  return id.startsWith(`${ns.prefix}${ns.separator}`);
}

function detectNamespace(id) {
  for (const [name, ns] of _namespaces) {
    if (id.startsWith(`${ns.prefix}${ns.separator}`)) return name;
  }
  return null;
}

// ── Environment ───────────────────────────────────────────────────────────────

function setEnvironment(env) {
  if (!env || typeof env !== 'string') throw new TypeError('setEnvironment: env must be a string');
  _env = env;
}

function getEnvironment() { return _env; }

function envId(namespaceName, opts = {}) {
  const ns      = _namespaces.get(namespaceName);
  const prefix  = ns ? ns.prefix : namespaceName.slice(0, 3).toLowerCase();
  const envCode = ENV_CODES[_env] || _env.slice(0, 3).toLowerCase();
  const rand    = nanoId({ size: 12 });
  return `${prefix}_${envCode}_${rand}`;
}

// ── Framework Code Generation ─────────────────────────────────────────────────

function reactHookCode(namespaceName) {
  const ns = _namespaces.get(namespaceName);
  const displayName = ns ? ns.name : namespaceName;
  const pascal = displayName.charAt(0).toUpperCase() + displayName.slice(1);
  const hookName = `use${pascal}Id`;

  return `import { useState, useCallback } from 'react';
import { namespaceId } from 'uuid-lab';

/**
 * React hook for generating ${displayName} IDs.
 * @returns {{ id: string, regenerate: () => void }}
 */
export function ${hookName}() {
  const [id, setId] = useState(() => namespaceId('${namespaceName}'));
  const regenerate = useCallback(
    () => setId(namespaceId('${namespaceName}')),
    []
  );
  return { id, regenerate };
}`;
}

function vueComposableCode(namespaceName) {
  const ns = _namespaces.get(namespaceName);
  const displayName = ns ? ns.name : namespaceName;
  const pascal = displayName.charAt(0).toUpperCase() + displayName.slice(1);
  const composableName = `use${pascal}Id`;

  return `import { ref } from 'vue';
import { namespaceId } from 'uuid-lab';

/**
 * Vue composable for generating ${displayName} IDs.
 */
export function ${composableName}() {
  const id = ref(namespaceId('${namespaceName}'));
  function regenerate() {
    id.value = namespaceId('${namespaceName}');
  }
  return { id, regenerate };
}`;
}

module.exports = {
  defineNamespace,
  getNamespace,
  listNamespaces,
  namespaceId,
  belongsTo,
  detectNamespace,
  setEnvironment,
  getEnvironment,
  envId,
  reactHookCode,
  vueComposableCode,
};
