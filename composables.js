/**
 * uuid-lab/vue — Vue 3 Composables for ID Generation
 *
 * Import in your Vue project:
 *   import { useNanoId, useUUID, useIdPool } from 'uuid-lab/vue'
 *
 * Works with: Vue 3, Nuxt 3, Vite + Vue, Quasar
 * Requires: Vue 3.2+ (Composition API)
 */

import { ref, computed, onMounted, onUnmounted, readonly, shallowRef } from 'vue';
import {
  nanoId, uuid, ulid, cuid2,
  expiringId, checkExpiry, prefixedId,
  meaningfulId, pronounceableId, seededId, humanId,
} from 'uuid-lab';

// ── useNanoId ─────────────────────────────────────────────────────────────────
/**
 * @param {{ size?, refreshMs? }} [opts]
 *
 * @example
 * const { id, regenerate, count } = useNanoId({ size: 12 });
 */
export function useNanoId(opts = {}) {
  const { size = 21, refreshMs } = opts;
  const id    = ref(nanoId({ size }));
  const count = ref(0);

  function regenerate() {
    id.value = nanoId({ size });
    count.value++;
  }

  let timer = null;
  if (refreshMs) {
    onMounted(() => { timer = setInterval(regenerate, refreshMs); });
    onUnmounted(() => clearInterval(timer));
  }

  return { id: readonly(id), regenerate, count: readonly(count) };
}

// ── useUUID ───────────────────────────────────────────────────────────────────
/**
 * @example
 * const { id, regenerate } = useUUID();
 */
export function useUUID() {
  const id    = ref(uuid());
  const count = ref(0);
  function regenerate() { id.value = uuid(); count.value++; }
  return { id: readonly(id), regenerate, count: readonly(count) };
}

// ── useULID ───────────────────────────────────────────────────────────────────
/**
 * @example
 * const { id, timestamp } = useULID();
 */
export function useULID() {
  const id    = ref(ulid());
  const count = ref(0);

  function regenerate() { id.value = ulid(); count.value++; }

  const timestamp = computed(() => {
    const C = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    let ts = 0;
    for (let i = 0; i < 10; i++) ts = ts * 32 + C.indexOf(id.value[i]);
    return new Date(ts);
  });

  return { id: readonly(id), regenerate, count: readonly(count), timestamp };
}

// ── useCuid2 ──────────────────────────────────────────────────────────────────
export function useCuid2(opts = {}) {
  const id    = ref(cuid2(opts));
  const count = ref(0);
  function regenerate() { id.value = cuid2(opts); count.value++; }
  return { id: readonly(id), regenerate, count: readonly(count) };
}

// ── useExpiringId ─────────────────────────────────────────────────────────────
/**
 * @param {{ ttl?, checkIntervalMs? }} [opts]
 *
 * @example
 * const { id, expired, expiresAt } = useExpiringId({ ttl: '1h' });
 */
export function useExpiringId(opts = {}) {
  const { ttl = '1h', checkIntervalMs = 10_000 } = opts;

  const id      = ref(expiringId({ ttl }));
  const expiry  = ref(checkExpiry(id.value));
  const expired = computed(() => !expiry.value.valid);

  function regenerate() {
    id.value     = expiringId({ ttl });
    expiry.value = checkExpiry(id.value);
  }

  let timer = null;
  onMounted(() => {
    timer = setInterval(() => { expiry.value = checkExpiry(id.value); }, checkIntervalMs);
  });
  onUnmounted(() => clearInterval(timer));

  return {
    id: readonly(id),
    expired,
    expiresAt: computed(() => expiry.value.expiresAt),
    regenerate,
  };
}

// ── useIdPool ─────────────────────────────────────────────────────────────────
/**
 * @example
 * const { next, size, refill } = useIdPool({ poolSize: 50 });
 */
export function useIdPool(opts = {}) {
  const { generator = nanoId, poolSize = 100, refillAt = 0.2 } = opts;
  const pool = shallowRef([]);
  const size = computed(() => pool.value.length);

  function refill() {
    pool.value = Array.from({ length: poolSize }, generator);
  }

  function next() {
    if (pool.value.length <= Math.floor(poolSize * refillAt)) {
      Promise.resolve().then(refill);
    }
    const arr = [...pool.value];
    const id  = arr.pop() ?? generator();
    pool.value = arr;
    return id;
  }

  onMounted(refill);

  return { next, size, refill };
}

// ── useStableId ───────────────────────────────────────────────────────────────
/**
 * ID that never changes — persists for the component lifetime.
 * Perfect for aria attributes, htmlFor, test IDs.
 *
 * @example
 * const { id } = useStableId('input');
 * // <label :for="id">Name</label><input :id="id" />
 */
export function useStableId(prefix = 'id') {
  const id = ref(null);
  onMounted(() => { if (!id.value) id.value = prefixedId(prefix, { size: 8 }); });
  return { id: readonly(id) };
}

// ── usePrefixedId ─────────────────────────────────────────────────────────────
export function usePrefixedId(prefix, opts = {}) {
  const id    = ref(prefixedId(prefix, opts));
  const count = ref(0);
  function regenerate() { id.value = prefixedId(prefix, opts); count.value++; }
  return { id: readonly(id), regenerate, count: readonly(count) };
}

// ── useMeaningfulId ───────────────────────────────────────────────────────────
/**
 * Human-readable ID: "swift-lake-4291"
 *
 * @example
 * const { id } = useMeaningfulId();
 * // <p>Your session: {{ id }}</p>
 */
export function useMeaningfulId(opts = {}) {
  const id    = ref(meaningfulId(opts));
  const count = ref(0);
  function regenerate() { id.value = meaningfulId(opts); count.value++; }
  return { id: readonly(id), regenerate, count: readonly(count) };
}

// ── useIdBatch ────────────────────────────────────────────────────────────────
/**
 * Batch of IDs. Useful for v-for lists.
 *
 * @example
 * const { ids } = useIdBatch({ count: 10 });
 * // <div v-for="id in ids" :key="id" />
 */
export function useIdBatch(opts = {}) {
  const { count = 10, generator = nanoId } = opts;
  const ids = ref(Array.from({ length: count }, generator));
  function regenerate() { ids.value = Array.from({ length: count }, generator); }
  return { ids: readonly(ids), regenerate };
}

// ── useSeededId ───────────────────────────────────────────────────────────────
/**
 * Same seed → same ID always. Great for SSR.
 *
 * @example
 * const { id } = useSeededId(userId);
 */
export function useSeededId(seed, opts = {}) {
  const id = computed(() => seededId(String(seed), opts));
  return { id };
}
