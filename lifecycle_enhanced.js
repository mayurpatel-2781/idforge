/* eslint-env es2020 */
'use strict';

const crypto = require('crypto');
const { nanoId } = require('./generators');

// ── Lifecycle / State-Machine IDs (enhanced with full history) ────────────────

// In-memory transition history: coreId → [ { from, to, id, timestamp, reason } ]
const _history = new Map();

function lifecycleId(entityType, opts = {}) {
  const { states = ['created', 'active', 'closed'], initial = states[0], secret = 'lifecycle-secret' } = opts;
  if (!states.includes(initial)) throw new Error(`Initial state "${initial}" not in states: [${states.join(', ')}]`);
  const coreId  = nanoId({ size: 10, alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' });
  const payload = `${entityType}:${coreId}:${initial}`;
  const sig     = crypto.createHmac('sha256', secret).update(payload).digest('hex').slice(0, 8);
  const id      = `${entityType}_${initial}_${coreId}_${sig}`;

  // Record birth in history
  _history.set(coreId, [{
    from: null, to: initial, id, timestamp: Date.now(), reason: 'created',
  }]);

  return id;
}

function transition(currentId, newState, opts = {}) {
  const { secret = 'lifecycle-secret', allowedTransitions, reason = '' } = opts;
  const parsed = parseLifecycle(currentId, { secret });
  if (!parsed.valid) throw new Error(`Invalid lifecycle ID: ${parsed.reason}`);

  if (allowedTransitions) {
    const allowed = allowedTransitions[parsed.state] || [];
    if (!allowed.includes(newState)) {
      throw new Error(`Transition "${parsed.state}" → "${newState}" not allowed. Allowed: [${allowed.join(', ')}]`);
    }
  }

  const payload = `${parsed.entityType}:${parsed.coreId}:${newState}`;
  const sig     = crypto.createHmac('sha256', secret).update(payload).digest('hex').slice(0, 8);
  const newId   = `${parsed.entityType}_${newState}_${parsed.coreId}_${sig}`;
  const timestamp = Date.now();

  // Record transition in history
  const entry = { from: parsed.state, to: newState, id: newId, timestamp, reason };
  if (!_history.has(parsed.coreId)) _history.set(parsed.coreId, []);
  _history.get(parsed.coreId).push(entry);

  return { id: newId, previous: currentId, state: newState, timestamp };
}

function parseLifecycle(id, opts = {}) {
  const { secret = 'lifecycle-secret' } = opts;
  const parts = id.split('_');
  if (parts.length !== 4) return { valid: false, reason: 'Expected format: entityType_state_coreId_sig' };
  const [entityType, state, coreId, sig] = parts;
  const payload  = `${entityType}:${coreId}:${state}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex').slice(0, 8);
  if (sig !== expected) return { valid: false, entityType, state, coreId, reason: 'Signature mismatch — state may have been tampered' };
  return { valid: true, entityType, state, coreId, sig };
}

function verifyState(id, expectedState, opts = {}) {
  const parsed = parseLifecycle(id, opts);
  if (!parsed.valid) return { valid: false, state: 'unknown', reason: parsed.reason };
  if (parsed.state !== expectedState) return { valid: false, state: parsed.state, reason: `Expected "${expectedState}", got "${parsed.state}"` };
  return { valid: true, state: parsed.state };
}

function stableCore(id) {
  const parts = id.split('_');
  return parts.length >= 3 ? `${parts[0]}_${parts[2]}` : id;
}

// ── NEW: History & Replay ─────────────────────────────────────────────────────

/**
 * Get the full transition history for a lifecycle ID.
 * @param {string} id
 * @returns {Array<{ from, to, id, timestamp, reason }>}
 */
function getHistory(id) {
  const parsed = parseLifecycle(id, { secret: 'lifecycle-secret' });
  const coreId = parsed.valid ? parsed.coreId : _findCoreId(id);
  return _history.get(coreId) || [];
}

/**
 * Get the current state without verifying signature.
 * @param {string} id
 * @returns {string}
 */
function currentState(id) {
  return id.split('_')[1] || 'unknown';
}

/**
 * Replay state machine from history — verify every transition was valid.
 * Returns { valid, states, violations }
 * @param {string} id
 * @param {{ allowedTransitions?, secret? }} [opts]
 */
function replayHistory(id, opts = {}) {
  const { allowedTransitions, secret = 'lifecycle-secret' } = opts;
  const history = getHistory(id);
  if (history.length === 0) return { valid: false, states: [], violations: ['No history found'] };

  const states = [history[0].to];
  const violations = [];

  for (let i = 1; i < history.length; i++) {
    const { from, to } = history[i];
    states.push(to);

    if (allowedTransitions) {
      const allowed = allowedTransitions[from] || [];
      if (!allowed.includes(to)) {
        violations.push(`Invalid transition: "${from}" → "${to}" at step ${i}`);
      }
    }
  }

  return { valid: violations.length === 0, states, violations, steps: history.length };
}

/**
 * Get a timeline of an entity's life — sorted transitions with durations.
 * @param {string} id
 * @returns {Array<{ state, enteredAt, duration, durationMs }>}
 */
function getTimeline(id) {
  const history = getHistory(id);
  return history.map((entry, i) => {
    const next = history[i + 1];
    const durationMs = next ? next.timestamp - entry.timestamp : Date.now() - entry.timestamp;
    return {
      state: entry.to,
      enteredAt: new Date(entry.timestamp).toISOString(),
      reason: entry.reason || null,
      durationMs,
      duration: _humanDuration(durationMs),
      isCurrent: !next,
    };
  });
}

/**
 * Clear history (useful for testing).
 */
function clearHistory() { _history.clear(); }

function _findCoreId(id) {
  const parts = id.split('_');
  return parts.length >= 3 ? parts[2] : id;
}

function _humanDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms/1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms/60000)}m`;
  return `${(ms/3600000).toFixed(1)}h`;
}

module.exports = { lifecycleId, transition, parseLifecycle, verifyState, stableCore, getHistory, currentState, replayHistory, getTimeline, clearHistory };
