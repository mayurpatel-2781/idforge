/* eslint-env es2020 */
'use strict';

const { randomBytes } = require('./utils');
const { nanoId } = require('./generators');

// ── Multi-Region Topology IDs ─────────────────────────────────────────────────

// Region registry
const REGION_MAP = {
  // AWS-style region codes → ISO country / zone
  'ap-south-1':     { country: 'IN', zone: 'ap', gdpr: false },
  'ap-southeast-1': { country: 'SG', zone: 'ap', gdpr: false },
  'ap-northeast-1': { country: 'JP', zone: 'ap', gdpr: false },
  'ap-northeast-2': { country: 'KR', zone: 'ap', gdpr: false },
  'ap-east-1':      { country: 'HK', zone: 'ap', gdpr: false },
  'us-east-1':      { country: 'US', zone: 'us', gdpr: false },
  'us-east-2':      { country: 'US', zone: 'us', gdpr: false },
  'us-west-1':      { country: 'US', zone: 'us', gdpr: false },
  'us-west-2':      { country: 'US', zone: 'us', gdpr: false },
  'eu-west-1':      { country: 'IE', zone: 'eu', gdpr: true  },
  'eu-west-2':      { country: 'GB', zone: 'eu', gdpr: true  },
  'eu-west-3':      { country: 'FR', zone: 'eu', gdpr: true  },
  'eu-central-1':   { country: 'DE', zone: 'eu', gdpr: true  },
  'eu-north-1':     { country: 'SE', zone: 'eu', gdpr: true  },
  'eu-south-1':     { country: 'IT', zone: 'eu', gdpr: true  },
  'ca-central-1':   { country: 'CA', zone: 'ca', gdpr: false },
  'sa-east-1':      { country: 'BR', zone: 'sa', gdpr: false },
  'me-south-1':     { country: 'BH', zone: 'me', gdpr: false },
  'af-south-1':     { country: 'ZA', zone: 'af', gdpr: false },
};

// Current node config (set once at startup)
let _currentRegion = null;
let _currentDc     = 0;

/**
 * Configure the current node's topology
 * @param {{ region, dc? }} config
 */
function registerTopology(config = {}) {
  _currentRegion = config.region || null;
  _currentDc     = config.dc     || 0;
}

/**
 * Generate a topology-aware ID that embeds region + datacenter
 * @param {{ region?, dc?, prefix? }} [opts]
 * @returns {string}
 */
function topoId(opts = {}) {
  const region = opts.region || _currentRegion || 'unknown';
  const dc     = opts.dc     || _currentDc     || 0;
  const prefix = opts.prefix || '';

  const regionInfo = REGION_MAP[region];
  const countryCode = regionInfo ? regionInfo.country : region.slice(0, 2).toUpperCase();
  const dcCode      = `dc${dc}`;
  const ts          = Date.now().toString(36);
  const rand        = nanoId({ size: 8, alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' });

  const core = `${countryCode}.${dcCode}.${ts}-${rand}`;
  return prefix ? `${prefix}_${core}` : core;
}

/**
 * Parse a topology ID back to its components
 * @param {string} id
 * @returns {{ country, datacenter, timestamp, date, random, region?, isEU, prefix? }}
 */
function parseTopology(id) {
  // Strip optional prefix
  let core = id;
  let prefix = null;
  if (id.includes('_')) {
    const idx = id.indexOf('_');
    prefix = id.slice(0, idx);
    core   = id.slice(idx + 1);
  }

  const parts = core.split('.');
  if (parts.length < 3) return { error: 'Invalid topology ID format' };

  const [country, dcPart, rest] = parts;
  const dc        = parseInt(dcPart.replace('dc', ''), 10);
  const [ts, rand] = (rest || '').split('-');
  const timestamp  = parseInt(ts, 36);

  // Find matching region
  const region = Object.entries(REGION_MAP).find(([, v]) => v.country === country)?.[0];
  const regionInfo = region ? REGION_MAP[region] : null;

  return {
    country,
    datacenter:  dc,
    region:      region || null,
    zone:        regionInfo?.zone || null,
    timestamp,
    date:        new Date(timestamp).toISOString(),
    random:      rand,
    isEU:        regionInfo?.gdpr || false,
    prefix,
  };
}

/**
 * Check if an ID was created in the EU (GDPR jurisdiction)
 * @param {string} id
 * @returns {boolean}
 */
function isEUResident(id) {
  const parsed = parseTopology(id);
  return parsed.isEU === true;
}

/**
 * Get the AWS region string for an ID
 * @param {string} id
 * @returns {string|null}
 */
function regionOf(id) {
  return parseTopology(id).region;
}

/**
 * Check if two IDs were created in the same region
 */
function isSameRegion(idA, idB) {
  return regionOf(idA) === regionOf(idB);
}

/**
 * Register a custom region
 * @param {string} regionKey
 * @param {{ country, zone, gdpr }} info
 */
function registerRegion(regionKey, info) {
  REGION_MAP[regionKey] = info;
}

module.exports = {
  topoId, parseTopology,
  isEUResident, regionOf, isSameRegion,
  registerTopology, registerRegion,
  REGION_MAP,
};
