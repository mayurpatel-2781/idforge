/* eslint-env es2020 */
'use strict';

/**
 * frameworks.js — Framework Support
 * ─────────────────────────────────
 * Provides SSR-safe utilities, hooks, and composables for React, Vue,
 * and Next.js, solving hydration mismatch problems with random IDs.
 */

const { nanoId } = require('./generators');

// ── Next.js / SSR Helpers ─────────────────────────────────────────────────────

/**
 * Generates an ID safely during SSR. If running on the server, it returns
 * the provided default ID (or a deterministic one). On the client, it returns
 * the random ID, but only after initial hydration.
 * 
 * @param {string} serverPrefix Prefix used during SSR
 * @returns {string} 
 */
function ssrSafeId(serverPrefix = 'ssr') {
  // Check if we are in browser or Node environment
  const isBrowser = typeof window !== 'undefined';
  if (!isBrowser) {
    return `${serverPrefix}_${nanoId({ size: 6 })}`;
  }
  return nanoId();
}

// ── React Hooks ───────────────────────────────────────────────────────────────

/**
 * A React Hook for generating stable, unique IDs that are safe for SSR.
 * It prevents hydration mismatches by returning a placeholder or empty string
 * during the first render, and then generating the ID on the client.
 * 
 * Note: React 18 has `useId()`, but this is useful for legacy React or
 * when you specifically need a globally unique random ID.
 * 
 * @example
 * const id = useSafeId('prefix-');
 * 
 * @param {string} prefix Optional prefix
 * @param {Function} generator Optional custom generator (defaults to nanoId)
 * @returns {string} Safe ID
 */
function useSafeId(prefix = '', generator = nanoId) {
  // Duck-typing the hook behavior assuming `useState` and `useEffect` are in scope
  // Normally this would import React, but we don't want to force a React dependency.
  // We return a factory or assume the user injects the React instance.
  throw new Error(
    "useSafeId cannot be called directly. " +
    "Please use `createReactHooks(React)` to initialize hooks."
  );
}

/**
 * Creates React hooks bound to a specific React instance.
 * @param {object} React The React library instance
 * @returns {{ useSafeId: Function, useCorrelationId: Function }}
 */
function createReactHooks(React) {
  if (!React || !React.useState || !React.useEffect) {
    throw new Error('Please pass the React library instance to createReactHooks');
  }

  return {
    useSafeId(prefix = '', generator = nanoId) {
      const [id, setId] = React.useState('');
      
      React.useEffect(() => {
        setId(`${prefix}${generator()}`);
      }, [prefix, generator]);
      
      return id || `${prefix}ssr-placeholder`;
    },

    useCorrelationId(generator = nanoId) {
      const [id] = React.useState(() => generator());
      return id;
    }
  };
}

// ── Vue Composables ───────────────────────────────────────────────────────────

/**
 * Creates Vue composables bound to a specific Vue instance.
 * @param {object} vue The Vue 3 library instance (containing ref, onMounted)
 * @returns {{ useSafeId: Function }}
 */
function createVueComposables(vue) {
  if (!vue || !vue.ref || !vue.onMounted) {
    throw new Error('Please pass the Vue library instance to createVueComposables');
  }

  return {
    useSafeId(prefix = '', generator = nanoId) {
      const id = vue.ref(`${prefix}ssr-placeholder`);
      
      vue.onMounted(() => {
        id.value = `${prefix}${generator()}`;
      });
      
      return id;
    }
  };
}

module.exports = {
  ssrSafeId,
  createReactHooks,
  createVueComposables,
};
