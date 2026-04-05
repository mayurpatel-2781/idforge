# uuid-lab

**The world's most complete ID toolkit** — 219 exports, 90+ functions, 535 passing tests.

[![npm version](https://img.shields.io/npm/v/uuid-lab.svg)](https://www.npmjs.com/package/uuid-lab)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D14-brightgreen)](https://nodejs.org)

---

## Installation

```bash
npm install uuid-lab
```

---

## Quick Start

```js
const uid = require('uuid-lab');

uid.nanoId()           // → "V1StGXR8_Z5jdHi6B-myT"
uid.uuid()             // → "110e8400-e29b-41d4-a716-446655440000"
uid.ulid()             // → "01ARZ3NDEKTSV4RRFFQ69G5FAV"
uid.snowflakeId()      // → "1541815603606036480"
uid.humanId()          // → "brave-swift-4821"
uid.typedId('order')   // → "ord_V1StGXR8_Z5jdHi6B-myT"
uid.fuzzyId()          // → "3ABN-9Z2K-8QPX-7V"
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
```

### Lifecycle IDs (v3)
```js
const id = uid.lifecycleId('order', { initial: 'pending' })
uid.transition(id, 'shipped')
uid.getHistory(id)    // Full audit trail
uid.getTimeline(id)   // With durations
```

### Topology IDs (v3)
```js
uid.registerTopology({ region: 'ap-south-1', dc: 1 })
uid.topoId()          // → "IN.dc1.lkj2345-AbCdEfGh"
uid.isEUResident(id)  // GDPR check
```

### Deterministic Chaos IDs (v3)
```js
// Same inputs + same key = always same output
uid.dcid(['user-42', 'workspace-99'], { key: 'secret', size: 12 })
```

### Fuzzy IDs (v4)
```js
uid.fuzzyId(16)         // → "3ABN-9Z2K-8QPX-7V"
uid.validateFuzzy(id)   // → { valid: true }
uid.correctFuzzy(id)    // auto-corrects typos
```

### Compound IDs (v4)
```js
const joined = uid.compoundId([userId, orderId], { tag: 'purchased' })
uid.splitId(joined)     // → { ids: [userId, orderId], valid: true }
```

### Hierarchy IDs (v4)
```js
const org  = uid.hierarchyRoot('org')
const team = uid.hierarchyChild(org, 'team')
uid.depthOf(team)             // → 1
uid.isDescendant(team, org)   // → true
uid.subtreeRange(org)         // → { gte, lt } for DB prefix queries
```

### Collision Detection (v5)
```js
const detector = uid.createDetector({ namespace: 'orders' })
const result = await detector.checkAndRegister(id)
// → { ok: true, collision: false }
```

### Multi-Service Federation (v5)
```js
const fed   = uid.createFederation({ strategy: 'snowflake' })
const nodeA = fed.join('payments-service')
const id    = nodeA.generate()   // globally unique
fed.verify(id)  // → { owner: 'payments-service' }
```

### GDPR / HIPAA Compliance (v5)
```js
uid.scanForPII('user_john@example.com_abc')
// → { clean: false, findings: [{ type: 'email' }] }

const report = uid.generateComplianceReport(ids, { framework: 'GDPR' })
console.log(uid.formatReport(report))
```

### Global ID Parser (v6)
```js
uid.decodeId('01ARZ3NDEKTSV4RRFFQ69G5FAV')
// → { type: 'ulid', timestamp: 1609459200000, date: '2021-01-01' }

uid.parseId(anyId)
// → { type, confidence: 'high'|'medium'|'low', decoded }
```

### Query & Tag System (v6)
```js
const index = uid.createIndex()
index.add(userId, { tags: ['user', 'premium'], meta: { plan: 'pro' } })
index.query({ tags: ['user'], meta: { plan: 'pro' } })
index.tag(userId, 'verified')
```

### Batch Verification (v6)
```js
uid.batchVerify(ids, [
  { name: 'non-empty', fn: id => id.length > 0 },
])
uid.batchCheckCollisions(ids)
uid.compareIds(a, b)
uid.sortById(ids)
uid.diffIds(a, b)
uid.groupByType(ids)
```

### Validation Rules Engine (v6)
```js
const engine = uid.createValidationEngine()
engine.addRule('no-pii', id => uid.scanForPII(id).clean || 'contains PII')
engine.validate(uid.typedId('order'))
engine.validateBatch(ids)
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
const safe = uid.withRetry(myGenerator, { retries: 3, backoffMs: 50 })
uid.monitor.count('ids.generated', 1)
uid.monitor.snapshot()
```

### Export / Import (v6)
```js
const json = uid.exportIds(ids, { format: 'json' })
const { ids: loaded } = uid.importIds(json)
```

### Test Utilities (v6)
```js
uid.testIds('order', 5)
// → ['order_0001', 'order_0002', ...]

uid.enableMockMode()
uid.mockGenerator('nanoId', 'MOCK-ID')
uid.disableMockMode()

uid.assertId(id, { minLength: 10, pattern: /^[A-Za-z0-9]+$/ })
```

### CLI
```bash
npx uuid-lab generate nanoid --count 5
npx uuid-lab generate uuid
npx uuid-lab decode 01ARZ3NDEKTSV4RRFFQ69G5FAV
npx uuid-lab scan "user_john@example.com"
npx uuid-lab entropy V1StGXR8_Z5jdHi6B-myT
npx uuid-lab help
```

---

## TypeScript

```ts
import {
  nanoId, uuidV4, lifecycleId,
  createDetector, CollisionDetector,
  createIndex, IdIndex,
  generateComplianceReport, ComplianceReport,
} from 'uuid-lab'
```

---

## Running Tests

```bash
npm test           # runs all 535 tests
npm run test:v3    # 122 tests
npm run test:v4    # 142 tests
npm run test:v5    # 124 tests
npm run test:v6    # 147 tests
```

---

## License

MIT
