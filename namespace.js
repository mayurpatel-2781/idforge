/* eslint-env es2020 */
'use strict';

const { nanoId } = require('./generators');

// ── Namespace Registry ────────────────────────────────────────────────────────

const _namespaces = new Map();
let _currentEnvironment = 'development';

function defineNamespace(name, config = {}) {
  _namespaces.set(name, {
    name,
    prefix: config.prefix || name.slice(0, 3).toLowerCase(),
    description: config.description || '',
    version: config.version || 1,
    separator: config.separator || '_',
    size: config.size || 16,
    ...config,
  });
}

function getNamespace(name) {
  return _namespaces.get(name) || null;
}

function listNamespaces() {
  return [..._namespaces.keys()];
}

function namespaceId(namespaceName, opts = {}) {
  const ns = _namespaces.get(namespaceName);
  if (!ns) throw new Error(`Namespace "${namespaceName}" not defined. Call defineNamespace() first.`);
  const { prefix, separator, size } = ns;
  return `${prefix}${separator}${nanoId({ size })}`;
}

function belongsTo(id, namespaceName) {
  const ns = _namespaces.get(namespaceName);
  if (!ns) return false;
  const { prefix, separator } = ns;
  return id.startsWith(`${prefix}${separator}`);
}

function detectNamespace(id) {
  for (const [name, ns] of _namespaces) {
    const { prefix, separator } = ns;
    if (id.startsWith(`${prefix}${separator}`)) return name;
  }
  return null;
}

// ── Environment ───────────────────────────────────────────────────────────────

function setEnvironment(env) {
  _currentEnvironment = env;
}

function getEnvironment() {
  return _currentEnvironment;
}

const ENV_CODES = {
  production:  'prod',
  staging:     'stg',
  development: 'dev',
  test:        'tst',
  local:       'lcl',
};

function envId(namespaceName, opts = {}) {
  const ns = _namespaces.get(namespaceName);
  const prefix = ns ? ns.prefix : (namespaceName.slice(0, 3).toLowerCase());
  const envCode = ENV_CODES[_currentEnvironment] || _currentEnvironment.slice(0, 3);
  const rand = nanoId({ size: 12 });
  return `${prefix}_${envCode}_${rand}`;
}

// ── Code Generation ───────────────────────────────────────────────────────────

function reactHookCode(namespaceName) {
  const ns = _namespaces.get(namespaceName) || { name: namespaceName, prefix: namespaceName };
  const hookName = `use${ns.name.charAt(0).toUpperCase() + ns.name.slice(1)}Id`;
  return `import { useState, useCallback } from 'react';
import { namespaceId } from 'uuid-lab';

export function ${hookName}() {
  const [id, setId] = useState(() => namespaceId('${namespaceName}'));
  const regenerate = useCallback(() => setId(namespaceId('${namespaceName}')), []);
  return { id, regenerate };
}`;
}

function vueComposableCode(namespaceName) {
  const ns = _namespaces.get(namespaceName) || { name: namespaceName };
  const composableName = `use${ns.name.charAt(0).toUpperCase() + ns.name.slice(1)}Id`;
  return `import { ref } from 'vue';
import { namespaceId } from 'uuid-lab';

export function ${composableName}() {
  const id = ref(namespaceId('${namespaceName}'));
  const regenerate = () => { id.value = namespaceId('${namespaceName}'); };
  return { id, regenerate };
}`;
}

module.exports = {
  defineNamespace,
  namespaceId,
  belongsTo,
  detectNamespace,
  listNamespaces,
  getNamespace,
  setEnvironment,
  getEnvironment,
  envId,
  reactHookCode,
  vueComposableCode,
};
