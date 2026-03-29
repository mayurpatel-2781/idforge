/* eslint-env es2020 */
'use strict';

const crypto = require('crypto');
const { nanoId } = require('./generators');

// ── Lifecycle / State-Machine IDs ─────────────────────────────────────────────

/**
 * Generate a lifecycle-aware ID bound to a state machine.
 * The current state is embedded and HMAC-signed — tamper-proof.
 *
 * @param {string} entityType  - e.g. 'order', 'ticket'
 * @param {{ states, initial, secret }} opts
 * @returns {string}  "entityType_state_coreId_sig"
 */
function lifecycleId(entityType, opts = {}) {
  const {
    states   = ['created', 'active', 'closed'],
    initial  = states[0],
    secret   = 'lifecycle-secret',
  } = opts;

  if (!states.includes(initial)) {
    throw new Error(`Initial state "${initial}" not in states: [${states.join(', ')}]`);
  }

  const coreId  = nanoId({ size: 10, alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' });
  const payload = `${entityType}:${coreId}:${initial}`;
  const sig     = crypto.createHmac('sha256', secret).update(payload).digest('hex').slice(0, 8);

  return `${entityType}_${initial}_${coreId}_${sig}`;
}

/**
 * Transition an ID to a new state.
 * Returns new ID string with updated state + new signature.
 * Old ID is considered superseded (you should store the transition).
 *
 * @param {string} currentId
 * @param {string} newState
 * @param {{ secret, allowedTransitions? }} opts
 * @returns {{ id: string, previous: string, state: string, timestamp: number }}
 */
function transition(currentId, newState, opts = {}) {
  const { secret = 'lifecycle-secret', allowedTransitions } = opts;
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

  return { id: newId, previous: currentId, state: newState, timestamp: Date.now() };
}

/**
 * Parse a lifecycle ID into its components and verify signature
 * @param {string} id
 * @param {{ secret? }} [opts]
 * @returns {{ valid, entityType, state, coreId, reason? }}
 */
function parseLifecycle(id, opts = {}) {
  const { secret = 'lifecycle-secret' } = opts;
  const parts = id.split('_');

  if (parts.length !== 4) {
    return { valid: false, reason: 'Expected format: entityType_state_coreId_sig' };
  }

  const [entityType, state, coreId, sig] = parts;
  const payload  = `${entityType}:${coreId}:${state}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex').slice(0, 8);

  if (sig !== expected) {
    return { valid: false, entityType, state, coreId, reason: 'Signature mismatch — state may have been tampered' };
  }

  return { valid: true, entityType, state, coreId, sig };
}

/**
 * Verify a lifecycle ID is in a specific state
 * @param {string} id
 * @param {string} expectedState
 * @param {{ secret? }} [opts]
 * @returns {{ valid: boolean, state: string, reason?: string }}
 */
function verifyState(id, expectedState, opts = {}) {
  const parsed = parseLifecycle(id, opts);
  if (!parsed.valid) return { valid: false, state: 'unknown', reason: parsed.reason };
  if (parsed.state !== expectedState) {
    return { valid: false, state: parsed.state, reason: `Expected "${expectedState}", got "${parsed.state}"` };
  }
  return { valid: true, state: parsed.state };
}

/**
 * Get the core stable part of a lifecycle ID (unchanged across transitions)
 * @param {string} id
 * @returns {string}
 */
function stableCore(id) {
  const parts = id.split('_');
  return parts.length >= 3 ? `${parts[0]}_${parts[2]}` : id;
}

module.exports = { lifecycleId, transition, parseLifecycle, verifyState, stableCore };
