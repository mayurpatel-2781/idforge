/* eslint-env es2020 */
'use strict';

/**
 * template.js — ID Templates (DSL) and Smart Recommendations
 * ──────────────────────────────────────────────────────────
 * Provides a string-based DSL for custom schema definition,
 * and an engine to recommend the best ID generator based on needs.
 */

const { nanoId, ALPHA_BASE62 } = require('./generators');

// ── Smart ID Recommendation System ────────────────────────────────────────────

const RECOMMENDATIONS = [
  {
    type: 'uuidV4',
    features: ['random', 'standard', 'database'],
    description: 'Best for standard database primary keys (128-bit random).',
  },
  {
    type: 'uuidV7',
    features: ['sortable', 'standard', 'database', 'time'],
    description: 'Best for standard databases where insertion order matters (time-sorted).',
  },
  {
    type: 'ulid',
    features: ['sortable', 'urlSafe', 'time'],
    description: 'Best for sortable IDs in URLs or distributed systems (Crockford Base32).',
  },
  {
    type: 'snowflakeId',
    features: ['sortable', 'distributed', 'numeric', 'time'],
    description: 'Best for massive scale distributed systems (Twitter Snowflake).',
  },
  {
    type: 'nanoId',
    features: ['urlSafe', 'compact', 'random'],
    description: 'Best for compact URL-safe IDs (e.g., public links, YouTube IDs).',
  },
  {
    type: 'humanId',
    features: ['readable', 'friendly'],
    description: 'Best for user-facing reference numbers or sharing.',
  },
  {
    type: 'typedId',
    features: ['prefixed', 'semantic'],
    description: 'Best for polymorphic APIs (Stripe-style IDs like cus_xxx).',
  },
];

/**
 * Recommend an ID generator based on requirements.
 * @param {string[]} requirements List of features (e.g., ['sortable', 'urlSafe'])
 * @returns {object[]} Ranked list of recommendations
 */
function recommendId(requirements = []) {
  if (!Array.isArray(requirements) || requirements.length === 0) {
    return RECOMMENDATIONS; // Return all if no specific needs
  }

  const scored = RECOMMENDATIONS.map(rec => {
    let score = 0;
    requirements.forEach(req => {
      if (rec.features.includes(req)) score++;
    });
    return { ...rec, score };
  });

  // Sort by score descending
  return scored
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ score, ...rec }) => ({ matchPercentage: Math.round((score / requirements.length) * 100), ...rec }));
}

// ── ID Templates (DSL) ────────────────────────────────────────────────────────

let _globalSeq = 0;

/**
 * Compile a string template into a fast generator function.
 * 
 * Syntax:
 * - Literal text is copied directly.
 * - [random:N] -> N random alphanumeric characters.
 * - [date:FORMAT] -> Format: YYYY, MM, DD, timestamp, ms.
 * - [seq] -> Global incrementing sequence.
 * - [prefix:STR] -> Literal prefix, but clearly defined in DSL.
 *
 * Example: compileTemplate('ord-[date:YYYYMMDD]-[random:8]')
 * 
 * @param {string} pattern The DSL pattern
 * @returns {Function} Generator function
 */
function compileTemplate(pattern) {
  if (typeof pattern !== 'string') {
    throw new TypeError('compileTemplate expects a string pattern');
  }

  // Parse the pattern into an AST of operations
  const regex = /\[([^\]]+)\]/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(pattern)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'literal', value: pattern.slice(lastIndex, match.index) });
    }

    const token = match[1];
    if (token.startsWith('random:')) {
      const len = parseInt(token.split(':')[1], 10) || 8;
      parts.push({ type: 'random', length: len });
    } else if (token.startsWith('date:')) {
      const format = token.split(':')[1];
      parts.push({ type: 'date', format });
    } else if (token === 'seq') {
      parts.push({ type: 'seq' });
    } else if (token.startsWith('prefix:')) {
      parts.push({ type: 'literal', value: token.split(':')[1] });
    } else {
      throw new Error(`Unknown template token: [${token}]`);
    }
    
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < pattern.length) {
    parts.push({ type: 'literal', value: pattern.slice(lastIndex) });
  }

  // Return optimized generator
  return function generateFromTemplate() {
    let result = '';
    for (const part of parts) {
      if (part.type === 'literal') {
        result += part.value;
      } else if (part.type === 'random') {
        result += nanoId({ size: part.length, alphabet: ALPHA_BASE62 });
      } else if (part.type === 'seq') {
        result += String(++_globalSeq);
      } else if (part.type === 'date') {
        const d = new Date();
        const f = part.format;
        if (f === 'YYYY') result += String(d.getUTCFullYear());
        else if (f === 'MM') result += String(d.getUTCMonth() + 1).padStart(2, '0');
        else if (f === 'DD') result += String(d.getUTCDate()).padStart(2, '0');
        else if (f === 'YYYYMMDD') result += `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
        else if (f === 'timestamp') result += String(Math.floor(Date.now() / 1000));
        else if (f === 'ms') result += String(Date.now());
        else result += f; // Fallback
      }
    }
    return result;
  };
}

module.exports = {
  recommendId,
  compileTemplate,
};
