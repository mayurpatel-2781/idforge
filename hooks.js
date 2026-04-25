/**
 * uuid-lab/react — React Hooks for ID Generation
 *
 * Import in your React project:
 *   import { useNanoId, useUUID, useULID, useIdPool } from 'uuid-lab/react'
 *
 * All hooks are SSR-safe (Next.js, Remix, Gatsby compatible).
 * No dependency on React version — works with React 16.8+, 17, 18, 19.
 */

// NOTE: This file uses React hooks. React must be installed in your project.
// This file is intentionally NOT bundled with the Node.js core package.

'use client'; // Next.js App Router compatible

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';

// ── Lazy import of uuid-lab core (works in browser via bundler) ───────────────
// Bundlers (Vite, webpack, Next.js) will tree-shake what isn't used.
import {
  nanoId, uuid, ulid, cuid2, snowflakeId,
  expiringId, checkExpiry, fuzzyId, meaningfulId,
  pronounceableId, prefixedId, seededId,
  timestampId, humanId,
} from 'uuid-lab';

// ── useNanoId ─────────────────────────────────────────────────────────────────
/**
 * Generate and optionally auto-refresh a NanoID.
 *
 * @param {{ size?, refreshMs?, refreshOnMount? }} [opts]
 * @returns {{ id: string, regenerate: () => void, count: number }}
 *
 * @example
 * const { id, regenerate } = useNanoId({ size: 12 });
 * return <button onClick={regenerate}>{id}</button>;
 */
export function useNanoId(opts = {}) {
  const { size = 21, refreshMs, refreshOnMount = false } = opts;
  const [id, setId]       = useState(() => nanoId({ size }));
  const [count, setCount] = useState(0);

  const regenerate = useCallback(() => {
    setId(nanoId({ size }));
    setCount(c => c + 1);
  }, [size]);

  // Auto-refresh
  useEffect(() => {
    if (!refreshMs) return;
    const timer = setInterval(regenerate, refreshMs);
    return () => clearInterval(timer);
  }, [refreshMs, regenerate]);

  // Regenerate on mount (useful for SSR hydration)
  useEffect(() => {
    if (refreshOnMount) regenerate();
  }, []); // eslint-disable-line

  return { id, regenerate, count };
}

// ── useUUID ───────────────────────────────────────────────────────────────────
/**
 * Generate a UUID v4.
 *
 * @example
 * const { id } = useUUID();
 */
export function useUUID(opts = {}) {
  const [id, setId]       = useState(() => uuid());
  const [count, setCount] = useState(0);
  const regenerate = useCallback(() => { setId(uuid()); setCount(c => c + 1); }, []);
  return { id, regenerate, count };
}

// ── useULID ───────────────────────────────────────────────────────────────────
/**
 * Generate a ULID (time-sortable, lexicographically ordered).
 *
 * @example
 * const { id, timestamp } = useULID();
 */
export function useULID() {
  const [id, setId]       = useState(() => ulid());
  const [count, setCount] = useState(0);
  const regenerate = useCallback(() => { setId(ulid()); setCount(c => c + 1); }, []);
  const timestamp  = useMemo(() => {
    // Extract timestamp from ULID
    const C = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    let ts = 0;
    for (let i = 0; i < 10; i++) ts = ts * 32 + C.indexOf(id[i]);
    return new Date(ts);
  }, [id]);
  return { id, regenerate, count, timestamp };
}

// ── useCuid2 ──────────────────────────────────────────────────────────────────
/**
 * Generate a CUID2 (collision-resistant, starts with a letter).
 */
export function useCuid2(opts = {}) {
  const [id, setId]       = useState(() => cuid2(opts));
  const [count, setCount] = useState(0);
  const regenerate = useCallback(() => { setId(cuid2(opts)); setCount(c => c + 1); }, []);
  return { id, regenerate, count };
}

// ── useExpiringId ─────────────────────────────────────────────────────────────
/**
 * Generate a TTL-based expiring ID. Tracks expired state.
 *
 * @param {{ ttl?: '1h'|'1d'|'7d', checkIntervalMs? }} [opts]
 *
 * @example
 * const { id, expired, expiresAt, regenerate } = useExpiringId({ ttl: '1h' });
 */
export function useExpiringId(opts = {}) {
  const { ttl = '1h', checkIntervalMs = 10_000 } = opts;
  const [id, setId]           = useState(() => expiringId({ ttl }));
  const [expiry, setExpiry]   = useState(() => checkExpiry(expiringId({ ttl })));

  const regenerate = useCallback(() => {
    const newId = expiringId({ ttl });
    setId(newId);
    setExpiry(checkExpiry(newId));
  }, [ttl]);

  // Re-check expiry on interval
  useEffect(() => {
    const timer = setInterval(() => setExpiry(checkExpiry(id)), checkIntervalMs);
    return () => clearInterval(timer);
  }, [id, checkIntervalMs]);

  return {
    id,
    expired:   !expiry.valid,
    expiresAt: expiry.expiresAt,
    regenerate,
  };
}

// ── useIdPool ─────────────────────────────────────────────────────────────────
/**
 * High-performance ID pool that pre-generates IDs.
 * Ideal for lists, tables, or any UI that needs many unique IDs fast.
 *
 * @param {{ generator?, poolSize?, refillAt? }} [opts]
 *
 * @example
 * const { next, pool, refill } = useIdPool({ poolSize: 50 });
 * const rows = items.map(item => ({ ...item, id: next() }));
 */
export function useIdPool(opts = {}) {
  const { generator = nanoId, poolSize = 100, refillAt = 0.2 } = opts;
  const poolRef = useRef([]);
  const [size, setSize] = useState(0);

  const refill = useCallback(() => {
    poolRef.current = Array.from({ length: poolSize }, generator);
    setSize(poolRef.current.length);
  }, [generator, poolSize]);

  useEffect(() => { refill(); }, [refill]);

  const next = useCallback(() => {
    if (poolRef.current.length <= Math.floor(poolSize * refillAt)) {
      // Background refill
      Promise.resolve().then(refill);
    }
    return poolRef.current.pop() ?? generator();
  }, [generator, poolSize, refillAt, refill]);

  return { next, pool: poolRef.current, size, refill };
}

// ── usePrefixedId ─────────────────────────────────────────────────────────────
/**
 * Generate a prefixed ID (e.g. usr_abc123).
 *
 * @example
 * const { id } = usePrefixedId('usr');
 * // → 'usr_Xk3mP9qR2j...'
 */
export function usePrefixedId(prefix, opts = {}) {
  const [id, setId]       = useState(() => prefixedId(prefix, opts));
  const [count, setCount] = useState(0);
  const regenerate = useCallback(() => {
    setId(prefixedId(prefix, opts));
    setCount(c => c + 1);
  }, [prefix]);
  return { id, regenerate, count };
}

// ── useStableId ───────────────────────────────────────────────────────────────
/**
 * Generate a stable ID that persists for the component lifetime.
 * Never changes between renders. Perfect for aria-labelledby, htmlFor, etc.
 *
 * @example
 * const { id } = useStableId('input');
 * return <><label htmlFor={id}>Name</label><input id={id} /></>;
 */
export function useStableId(prefix = 'id') {
  const idRef = useRef(null);
  if (idRef.current === null) {
    idRef.current = prefixedId(prefix, { size: 8 });
  }
  return { id: idRef.current };
}

// ── useIdHistory ──────────────────────────────────────────────────────────────
/**
 * Generate IDs and track history with undo support.
 *
 * @example
 * const { id, regenerate, history, undo } = useIdHistory();
 */
export function useIdHistory(opts = {}) {
  const { generator = nanoId, maxHistory = 20 } = opts;
  const [history, setHistory] = useState(() => [generator()]);
  const [cursor, setCursor]   = useState(0);

  const id = history[cursor];

  const regenerate = useCallback(() => {
    const newId = generator();
    setHistory(h => {
      const trimmed = h.slice(0, cursor + 1);
      return [...trimmed, newId].slice(-maxHistory);
    });
    setCursor(c => Math.min(c + 1, maxHistory - 1));
  }, [generator, cursor, maxHistory]);

  const undo = useCallback(() => {
    setCursor(c => Math.max(0, c - 1));
  }, []);

  const redo = useCallback(() => {
    setCursor(c => Math.min(history.length - 1, c + 1));
  }, [history.length]);

  return {
    id,
    regenerate,
    history,
    undo,
    redo,
    canUndo: cursor > 0,
    canRedo: cursor < history.length - 1,
  };
}

// ── useMeaningfulId ───────────────────────────────────────────────────────────
/**
 * Human-readable ID (e.g. "swift-lake-4291").
 *
 * @example
 * const { id } = useMeaningfulId();
 * return <div>Your session: {id}</div>;
 */
export function useMeaningfulId(opts = {}) {
  const [id, setId]       = useState(() => meaningfulId(opts));
  const [count, setCount] = useState(0);
  const regenerate = useCallback(() => { setId(meaningfulId(opts)); setCount(c => c + 1); }, []);
  return { id, regenerate, count };
}

// ── useSeededId ───────────────────────────────────────────────────────────────
/**
 * Deterministic ID from a seed — same seed always produces same ID.
 * Useful for server/client ID matching in SSR.
 *
 * @example
 * const { id } = useSeededId(userId);
 * // Server and client produce the same ID for the same userId
 */
export function useSeededId(seed, opts = {}) {
  const id = useMemo(() => seededId(String(seed), opts), [seed]);
  return { id };
}

// ── useIdBatch ────────────────────────────────────────────────────────────────
/**
 * Generate a batch of IDs at once. Useful for lists.
 *
 * @example
 * const { ids, regenerate } = useIdBatch({ count: 10 });
 * return ids.map(id => <Item key={id} />);
 */
export function useIdBatch(opts = {}) {
  const { count = 10, generator = nanoId } = opts;
  const [ids, setIds] = useState(() => Array.from({ length: count }, generator));
  const regenerate    = useCallback(() => {
    setIds(Array.from({ length: count }, generator));
  }, [count, generator]);
  return { ids, regenerate };
}
