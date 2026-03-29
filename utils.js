'use strict';
const crypto = require('crypto');
function randomBytes(n) { return crypto.randomBytes(n); }
function hmacShort(data, key, len = 8) {
  return crypto.createHmac('sha256', key).update(data).digest('hex').slice(0, len);
}
module.exports = { randomBytes, hmacShort };
