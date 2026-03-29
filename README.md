# idforge

**The world's most complete ID toolkit** — 219 exports, 90+ functions, 535 passing tests.

[![npm version](https://img.shields.io/npm/v/idforge.svg)](https://www.npmjs.com/package/idforge)
[![CI](https://github.com/YOUR_USERNAME/idforge/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/idforge/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D14-brightgreen)](https://nodejs.org)

---

## Installation

```bash
npm install idforge
```

---

## Quick Start

```js
const uid = require('idforge');

// Basic generators
uid.nanoId()            // → "V1StGXR8_Z5jdHi6B-myT"
uid.uuid()              // → "110e8400-e29b-41d4-a716-446655440000"
uid.ulid()              // → "01ARZ3NDEKTSV4RRFFQ69G5FAV"
uid.snowflakeId()       // → "1541815603606036480"
uid.humanId()           // → "brave-swift-4821"
uid.typedId('order')    // → "ord_V1StGXR8_Z5jdHi6B-myT"
uid.fuzzyId()           // → "3ABN-9Z2K-8QPX-7V"
```

---

## All Features

### Core Generators (v1–v2)
```js
uid.uuid()              // UUID v4
uid.uuidV7()            // UUID v7 (sortable)
uid.ulid()              // Sortable 26-char ID
uid.ksuid()             // K-Sortable unique ID
uid.snowflakeId()       // Twitter-style distributed ID
uid.nanoId(21)          // Custom size NanoId
uid.humanId()           // "brave-swift-4821"
uid.typedId('order')    // "ord_..."
uid.otpToken()          // 6-digit OTP
uid.expiringId({ttl:'1h'}) // Self-expiring ID
uid.checkExpiry(id)     // { valid, expiresAt }
uid.signId(id, 'key')   // HMAC-signed ID
uid.maskId(id, 4)       // "****...abcd"
```

### Semantic IDs (v3)
```js
uid.semanticId({ type: 'user', role: 'admin', region: 'IN' })
// → "user.adm.IN.Kq9mXaRb"

uid.validateSemantic(id, { type: 'user', role: 'admin' })
// → { valid: true }
```

### Lifecycle IDs (v3)
```js
const id = uid.lifecycleId('order', { initial: 'pending' })
// → "order_pending_Kq9mXaRb12_a1b2c3d4"

uid.transition(id, 'shipped')
// → { id: "order_shipped_...", state: "shipped" }

uid.getHistory(id)    // Full audit trail
uid.getTimeline(id)   // With durations
```

### Topology IDs (v3)
```js
uid.registerTopology({ region: 'ap-south-1', dc: 1 })
uid.topoId()          // → "IN.dc1.lkj2345-AbCdEfGh"
uid.isEUResident(id)  // → true/false (GDPR check)
```

### Deterministic Chaos IDs (v3)
```js
// Same inputs + same key = always same output
uid.dcid(['user-42', 'workspace-99'], { key: 'secret', size: 12 })
// → "Kq9mXaRbZpLw"  (deterministic)
```

### Fuzzy IDs (v4)
```js
uid.fuzzyId(16)         // → "3ABN-9Z2K-8QPX-7V"
// Crockford Base32, no I/L/O/U, Luhn checksum
uid.validateFuzzy(id)   // → { valid: true }
uid.correctFuzzy(id)    // auto-corrects typos
```

### Compound IDs (v4)
```js
const joined = uid.compoundId([userId, orderId], { tag: 'purchased' })
uid.splitId(joined)
// → { ids: [userId, orderId], tag: 'purchased', valid: true }

// Canonical order for undirected edges
uid.compoundId([a, b], { sorted: true }) === uid.compoundId([b, a], { sorted: true })
```

### Hierarchy IDs (v4)
```js
const org  = uid.hierarchyRoot('org')
const team = uid.hierarchyChild(org, 'team')
const user = uid.hierarchyChild(team, 'user')

uid.depthOf(user)             // → 2
uid.parentOf(user)            // → team path
uid.isDescendant(user, org)   // → true
uid.subtreeRange(team)        // → { gte, lt } for DB prefix queries
```

### Collision Detection (v5)
```js
const detector = uid.createDetector({ namespace: 'orders' })
const result = await detector.checkAndRegister(id)
// → { ok: true, collision: false }

// Multi-namespace
const registry = uid.createRegistry()
await registry.namespace('users').register(userId)
```

### Multi-Service Federation (v5)
```js
const fed   = uid.createFederation({ strategy: 'snowflake' })
const nodeA = fed.join('payments-service')
const id    = nodeA.generate()   // globally unique
fed.verify(id)  // → { owner: 'payments-service', ... }
```

### GDPR / HIPAA Compliance (v5)
```js
uid.scanForPII('user_john@example.com_abc')
// → { clean: false, findings: [{ type: 'email' }] }

const report = uid.generateComplianceReport(ids, { framework: 'GDPR' })
console.log(uid.formatReport(report))  // printable audit report
```

### Global ID Parser (v6)
```js
uid.decodeId('01ARZ3NDEKTSV4RRFFQ69G5FAV')
// → { type: 'ulid', timestamp: 1609459200000, date: '2021-01-01' }

uid.parseId(anyId)
// → { type, confidence: 'high'|'medium'|'low', decoded, suggestions }
```

### Query & Tag System (v6)
```js
const index = uid.createIndex()
index.add(userId, { tags: ['user', 'premium'], meta: { plan: 'pro' } })
index.add(orderId, { tags: ['order', 'active'] })

index.query({ tags: ['user'], meta: { plan: 'pro' } })
// → { total: 1, results: [...] }

index.tag(userId, 'verified')
index.query({ type: 'uuid-v4', limit: 10 })
```

### Batch Verification (v6)
```js
uid.batchVerify(ids, [
  { name: 'non-empty', fn: id => id.length > 0 },
  { name: 'typed',     fn: id => /^[a-z]+_/.test(id) },
])
// → { total, passed, failed, results }

uid.batchCheckCollisions(ids)  // find duplicates in a batch
uid.compareIds(a, b)           // { equal, sameType, order }
uid.sortById(ids)              // timestamp-aware sort
uid.diffIds(a, b)              // { onlyInA, onlyInB, inBoth }
uid.groupByType(ids)           // { 'uuid-v4': [...], 'nanoid': [...] }
```

### Validation Rules Engine (v6)
```js
const engine = uid.createValidationEngine()
engine.addRule('no-pii',   id => uid.scanForPII(id).clean || 'contains PII')
engine.addRule('min-bits', id => uid.analyzeEntropy(id).bits >= 96 || 'too weak')

engine.validate(uid.typedId('order'))     // → { valid: true }
engine.validateBatch(ids)                 // → { total, valid, invalid }
```

### Plugin / Middleware (v6)
```js
uid.use({
  name: 'logger',
  after: ctx => { console.log(`Generated: ${ctx.id}`); return ctx; }
})

uid.on('id:generated', ({ data }) => metrics.count('ids', 1))
uid.configure({ logLevel: 'info', defaultSize: 24 })
```

### Async Streaming (v6)
```js
for await (const id of uid.streamIds(uid.nanoId, { count: 1_000_000 })) {
  await db.insert(id)
}
```

### Retry & Monitoring (v6)
```js
const safe = uid.withRetry(myAsyncGenerator, { retries: 3, backoffMs: 50 })

uid.monitor.count('ids.generated', 1)
uid.monitor.timing('latency', 1.5)
uid.monitor.snapshot()  // → { metrics: { p50, p95, p99, ... } }
```

### Export / Import (v6)
```js
const json = uid.exportIds(ids, { format: 'json', meta: { env: 'prod' } })
const { ids: loaded } = uid.importIds(json)

const csv = uid.exportIds(ids, { format: 'csv' })
```

### Test Utilities (v6)
```js
uid.testIds('order', 5)
// → ['order_0001', 'order_0002', ...]

uid.enableMockMode()
uid.mockGenerator('nanoId', 'MOCK-ID')
// all nanoId() calls return 'MOCK-ID'
uid.disableMockMode()

uid.assertId(id, { minLength: 10, pattern: /^[A-Za-z0-9]+$/ })
// → { pass: true, failures: [] }
```

### CLI
```bash
npx idforge generate nanoid --count 5
npx idforge generate uuid
npx idforge decode 01ARZ3NDEKTSV4RRFFQ69G5FAV
npx idforge scan "user_john@example.com"
npx idforge entropy V1StGXR8_Z5jdHi6B-myT
npx idforge help
```

---

## TypeScript

```ts
import {
  nanoId, uuidV4, lifecycleId,
  createDetector, CollisionDetector,
  createIndex, IdIndex,
  generateComplianceReport, ComplianceReport,
  DashboardSnapshot,
} from 'idforge'
```

---

## Running Tests

```bash
npm test           # runs all 535 tests
npm run test:v3    # v1-v3 features (122 tests)
npm run test:v4    # v4 features    (142 tests)
npm run test:v5    # v5 features    (124 tests)
npm run test:v6    # v6 features    (147 tests)
```

---

## License

MIT
