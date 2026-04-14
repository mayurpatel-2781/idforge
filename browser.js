/**
 * browser.js — Browser Compatibility Layer
 * ──────────────────────────────────────────
 * All functions work in browser using Web Crypto API.
 * No Node.js dependencies. Use via CDN or bundler.
 *
 * Usage (browser):
 *   <script src="uuid-lab/browser.js"></script>
 *   const id = UuidLab.nanoId();
 *
 * Usage (bundler):
 *   import { nanoId, uuid } from 'uuid-lab/browser'
 */

/* global window, crypto */
'use strict';

// ── Web Crypto helpers ────────────────────────────────────────────────────────
function _rb(n) {
  const b = new Uint8Array(n);
  (typeof crypto !== 'undefined' ? crypto : globalThis.crypto).getRandomValues(b);
  return b;
}
function _hex(b) { return Array.from(b).map(x => x.toString(16).padStart(2,'0')).join(''); }
async function _hmac(key, data) {
  const e = new TextEncoder();
  const k = await (typeof crypto !== 'undefined' ? crypto : globalThis.crypto)
    .subtle.importKey('raw', e.encode(key), { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
  const sig = await (typeof crypto !== 'undefined' ? crypto : globalThis.crypto)
    .subtle.sign('HMAC', k, e.encode(data));
  return _hex(new Uint8Array(sig));
}

// ── Core generators ───────────────────────────────────────────────────────────
const A62  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const CRK  = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const SAFE = A62 + '-_';

function nanoId(size = 21, alphabet = SAFE) {
  const b = _rb(size * 2);
  let r = '';
  for (let i = 0; i < b.length && r.length < size; i++) r += alphabet[b[i] % alphabet.length];
  return r.slice(0, size);
}

function uuid() {
  const b = _rb(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = _hex(b);
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

function ulid() {
  const t = Date.now();
  let s = '', n = t;
  for (let i = 9; i >= 0; i--) { s = CRK[n % 32] + s; n = Math.floor(n / 32); }
  s = s.padStart(10, CRK[0]);
  const r = _rb(16);
  let rs = '';
  for (let i = 0; i < 16; i++) rs += CRK[r[i] % 32];
  return (s + rs).slice(0, 26);
}

function snowflakeId() {
  return ((BigInt(Date.now()) << 22n) | BigInt(Math.floor(Math.random() * 0xFFFFFF))).toString();
}

function humanId() {
  const w = ['brave','calm','dark','eager','fair','grand','happy','kind','lively','merry','noble','proud','quick','rare','swift','warm','vivid','young','bold','bright'];
  const p = () => w[_rb(1)[0] % w.length];
  return `${p()}-${p()}-${String(_rb(2).reduce((a,b,i) => a + b * (i === 0 ? 256 : 1), 0) % 9000 + 1000)}`;
}

function typedId(type, size = 21) {
  const P = { user:'usr', order:'ord', session:'ses', invoice:'inv', product:'prd', event:'evt' };
  return `${P[type] || type.slice(0,3)}_${nanoId(size)}`;
}

function shortId(size = 8) { return nanoId(size, A62); }

function prefixedId({ prefix = '', suffix = '', size = 12, separator = '_' } = {}) {
  const core = nanoId(size, A62);
  return [prefix, core, suffix].filter(Boolean).join(separator);
}

function urlSafeId(size = 21) { return nanoId(size, SAFE); }

function emojiId(size = 5) {
  const E = ['🦁','🐯','🌟','⚡','🔥','💎','🌈','🎯','🚀','🌙','🦊','🐺','🦄','🐸','🎭','🎨','🍎','🍊','🌺','🌸'];
  const b = _rb(size * 2);
  return Array.from({ length: size }, (_, i) => E[b[i] % E.length]).join('');
}

function visualId({ size = 16, groupSize = 4, separator = '-', alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' } = {}) {
  const raw = nanoId(size, alphabet);
  return (raw.match(new RegExp(`.{1,${groupSize}}`, 'g')) || [raw]).join(separator);
}

function expiringId({ ttl = '1h' } = {}) {
  const ms = { '1h': 3600000, '1d': 86400000, '7d': 604800000 }[ttl] || 3600000;
  return `exp_${Date.now() + ms}_${nanoId(8, A62)}`;
}

function checkExpiry(id) {
  const p = id.split('_');
  const exp = parseInt(p[1]);
  return { valid: exp > Date.now(), expiresAt: new Date(exp).toISOString(), expired: exp <= Date.now() };
}

function timestampId({ prefix = '', precision = 'ms' } = {}) {
  const ts = (precision === 'ms' ? Date.now() : Math.floor(Date.now() / 1000)).toString(36);
  const rand = _hex(_rb(8));
  return prefix ? `${prefix}_${ts}_${rand}` : `${ts}_${rand}`;
}

function extractTime(id) {
  const ts = parseInt(id.split('_')[0], 36);
  return { timestamp: ts, date: new Date(ts), iso: new Date(ts).toISOString() };
}

function meaningfulId({ words = 2, separator = '-', size = 4 } = {}) {
  const ADJ  = ['swift','brave','calm','dark','eager','fair','grand','happy','kind','lively','merry','noble','quick','vivid','bold'];
  const NOUN = ['star','moon','fire','wind','rock','tree','forge','spark','path','key','core','beam','rise','dawn'];
  const parts = [];
  const b = _rb(words + 1);
  for (let i = 0; i < words; i++) {
    parts.push((i < words - 1 ? ADJ : NOUN)[b[i] % (i < words - 1 ? ADJ.length : NOUN.length)]);
  }
  const num = b[words] % Math.pow(10, size);
  parts.push(String(num).padStart(size, '0'));
  return parts.join(separator);
}

function hashId(data, size = 16) {
  // Browser version uses sync approximation via btoa
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  // Use multiple rounds for better distribution
  let r = '';
  let seed = Math.abs(hash);
  for (let i = 0; r.length < size; i++) {
    seed = ((seed * 1664525 + 1013904223) & 0xffffffff) >>> 0;
    r += seed.toString(16).padStart(8, '0');
  }
  return r.slice(0, size);
}

async function hashIdAsync(data, size = 16) {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  const e   = new TextEncoder();
  const buf = await (typeof crypto !== 'undefined' ? crypto : globalThis.crypto)
    .subtle.digest('SHA-256', e.encode(str));
  return _hex(new Uint8Array(buf)).slice(0, size);
}

function seededId(seed, size = 16) { return hashId(String(seed), size); }

function offlineId() {
  const ts  = Date.now().toString(36);
  const rnd = _hex(_rb(4));
  const cnt = (typeof window !== 'undefined' ? (window.__uuidlabCnt = (window.__uuidlabCnt || 0) + 1) : Math.random()).toString(36);
  return `${ts}-${rnd}-${cnt}`;
}

function compressId(id) {
  const hex = id.replace(/-/g, '');
  if (!/^[0-9a-fA-F]+$/.test(hex)) return btoa(id).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  let num = BigInt('0x' + hex), r = '';
  while (num > 0n) { r = A62[Number(num % 62n)] + r; num /= 62n; }
  return r || A62[0];
}

function predictCollision({ alphabetSize = 62, idLength = 21, count = 1000000 } = {}) {
  const space = Math.pow(alphabetSize, idLength);
  const prob  = 1 - Math.exp(-(count * count) / (2 * space));
  const bits  = idLength * Math.log2(alphabetSize);
  return {
    bits: Math.round(bits * 10) / 10,
    probability: prob < 1e-15 ? '~0%' : (prob * 100).toExponential(3) + '%',
    safe: prob < 0.001,
    recommendation: prob < 0.0001 ? '✅ Very safe' : '⚠️ Consider larger IDs',
  };
}

function inspectId(id) {
  const uniqueChars = new Set(id).size;
  const bits = id.length * Math.log2(Math.max(uniqueChars, 2));
  return {
    id, length: id.length, uniqueChars,
    entropyBits: Math.round(bits * 10) / 10,
    entropyScore: bits < 64 ? 'weak' : bits < 128 ? 'strong' : 'excellent',
    isUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
    isULID: /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/.test(id),
  };
}

function multiFormatId(formats = ['uuid', 'nanoid', 'short']) {
  const G = { uuid, nanoid, ulid, short: shortId, meaningful: meaningfulId, emoji: emojiId, timestamp: timestampId };
  const r = {};
  for (const f of formats) r[f] = G[f]?.() ?? nanoId();
  return r;
}

function scanForPII(id) {
  const P = {
    email: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
    phone: /\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    ssn:   /(?<![a-zA-Z0-9])\d{3}-\d{2}-\d{4}(?![a-zA-Z0-9])/g,
  };
  const findings = [];
  for (const [t, p] of Object.entries(P)) if ([...id.matchAll(p)].length) findings.push(t);
  return { clean: findings.length === 0, findings };
}

// ── Bundle as UMD for browser <script> usage ──────────────────────────────────
const UuidLab = {
  nanoId, uuid, ulid, snowflakeId, humanId, typedId,
  shortId, prefixedId, urlSafeId, emojiId, visualId,
  expiringId, checkExpiry, timestampId, extractTime,
  meaningfulId, hashId, hashIdAsync, seededId,
  offlineId, compressId, predictCollision,
  inspectId, multiFormatId, scanForPII,
};

// Browser global
if (typeof window !== 'undefined') window.UuidLab = UuidLab;
if (typeof globalThis !== 'undefined') globalThis.UuidLab = UuidLab;

// CommonJS
if (typeof module !== 'undefined') module.exports = UuidLab;

// ESM
export {
  nanoId, uuid, ulid, snowflakeId, humanId, typedId,
  shortId, prefixedId, urlSafeId, emojiId, visualId,
  expiringId, checkExpiry, timestampId, extractTime,
  meaningfulId, hashId, hashIdAsync, seededId,
  offlineId, compressId, predictCollision,
  inspectId, multiFormatId, scanForPII,
};
export default UuidLab;
