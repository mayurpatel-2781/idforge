'use strict';
const crypto = require('crypto');
const DEFAULT_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function nanoId(opts = {}) {
  const { size = 21, alphabet = DEFAULT_ALPHABET } = opts;
  const bytes = crypto.randomBytes(size * 2);
  let result = '';
  for (let i = 0; i < bytes.length && result.length < size; i++) {
    const idx = bytes[i] % alphabet.length;
    result += alphabet[idx];
  }
  return result.slice(0, size);
}
const TYPE_PREFIXES = { user: 'usr', order: 'ord', session: 'ses', invoice: 'inv', product: 'prd', event: 'evt' };
const TYPE_REGISTRY = { ...TYPE_PREFIXES };
function typedId(type, opts = {}) {
  const prefix = TYPE_REGISTRY[type] || type.slice(0, 3);
  return `${prefix}_${nanoId(opts)}`;
}
function registerTypes(map) { Object.assign(TYPE_REGISTRY, map); }
function humanId(opts = {}) {
  const words = ['brave','calm','dark','eager','fair','grand','happy','kind','lively','merry','noble','proud','quick','rare','swift','true','vivid','warm','young','zesty'];
  const pick = () => words[Math.floor(Math.random() * words.length)];
  return `${pick()}-${pick()}-${Math.floor(Math.random()*9000+1000)}`;
}
let _seq = 0;
function sequentialId(opts = {}) { return String(++_seq).padStart(8, '0'); }
function resetSequence(n = 0) { _seq = n; }
function getSequence() { return _seq; }
function fromPattern(pattern) {
  return pattern.replace(/[xX]/g, c => {
    const r = Math.floor(Math.random() * 16);
    return c === 'x' ? r.toString(16) : (r & 0x3 | 0x8).toString(16);
  });
}
module.exports = { nanoId, typedId, registerTypes, TYPE_REGISTRY, humanId, sequentialId, resetSequence, getSequence, fromPattern };
