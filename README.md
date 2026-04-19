# 🚀 uuid-lab

> **The most advanced ID generation toolkit for Node.js & JavaScript**  
> ⚡ 200+ utilities · 🔐 Security-first · 🌍 Distributed-ready · 🧠 Smart · 📦 Production-grade

[![npm version](https://img.shields.io/npm/v/uuid-lab.svg)](https://www.npmjs.com/package/uuid-lab)
[![license](https://img.shields.io/npm/l/uuid-lab.svg)](./LICENSE)
[![tests](https://img.shields.io/badge/tests-738%20passed-brightgreen.svg)](#testing)

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Generators](#core-generators)
- [Format & Encoding](#format--encoding)
- [Security & Tokens](#security--tokens)
- [Parallel Generation (Worker Threads)](#parallel-generation-worker-threads)
- [ID DSL & Templates](#id-dsl--templates)
- [Smart Recommendation](#smart-recommendation)
- [Distributed Systems](#distributed-systems)
- [Collision Detection](#collision-detection)
- [Namespace System](#namespace-system)
- [Hierarchical IDs](#hierarchical-ids)
- [Compound & Fuzzy IDs](#compound--fuzzy-ids)
- [Lifecycle & State IDs](#lifecycle--state-ids)
- [Semantic & Relationship IDs](#semantic--relationship-ids)
- [Time-based IDs](#time-based-ids)
- [Analytics & Observability](#analytics--observability)
- [GDPR / HIPAA Compliance](#gdpr--hipaa-compliance)
- [Ecosystem Integrations](#ecosystem-integrations)
- [Framework Support](#framework-support)
- [ID Migration & Versioning](#id-migration--versioning)
- [DevTools & CLI](#devtools--cli)
- [High-Performance Pool](#high-performance-pool)
- [Blockchain-style ID Chain](#blockchain-style-id-chain)
- [TypeScript Support](#typescript-support)
- [ESM Support](#esm-support)
- [Testing](#testing)
- [License](#license)

---

## Installation

```bash
npm install uuid-lab
```

---

## Quick Start

```js
const uid = require('uuid-lab');

uid.nanoId();          // → 'V1StGXR8_Z5jdHi6B-myT'
uid.uuid();            // → 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
uid.ulid();            // → '01ARZ3NDEKTSV4RRFFQ69G5FAV'
uid.snowflakeId();     // → '7291234567890123'
uid.nanoId({ size: 12, alphabet: 'abc123' });
```

---

## Core Generators

| Function | Description | Example Output |
|---|---|---|
| `uuid()` | UUID v4 | `f47ac10b-58cc-4372-a567-...` |
| `uuidV4()` | UUID v4 explicit | `f47ac10b-58cc-4372-a567-...` |
| `uuidV7()` | UUID v7 (time-ordered) | `018e2b5a-dead-7000-...` |
| `uuidV5(name, ns)` | UUID v5 (deterministic) | deterministic string |
| `nanoId(opts?)` | Cryptographically secure random | `V1StGXR8_Z5jdHi6B-myT` |
| `ulid()` | Sortable, URL-safe | `01ARZ3NDEKTSV4RRFFQ69G5FAV` |
| `snowflakeId()` | Twitter-style Snowflake | `7291234567890123` |
| `ksuid()` | K-Sortable Unique ID | 27-char alphanumeric |
| `typedId(type)` | Prefixed typed ID | `usr_V1StGXR8_Z5jdHi6B` |
| `humanId()` | Human-readable words | `brave-hawk-4521` |
| `sequentialId()` | Auto-incrementing | `00000001` |

---

## Format & Encoding

```js
uid.prefixedId('usr');            // → 'usr_V1StGXR8_Z5jdHi6B-myT'
uid.shortId();                    // → 'aB3cD9'  (≤12 chars)
uid.customLengthId(32);           // → 32-char ID
uid.urlSafeId();                  // → no +/= chars
uid.base62Id();                   // → base62 chars only
uid.base36Id();                   // → lowercase alphanumeric
uid.visualId();                   // → easy-to-read font-safe
uid.emojiId();                    // → 🦊🌊🔥...
uid.compactId();                  // → shortest possible unique
uid.hashId('my-input');           // → deterministic SHA hash
uid.seededId('seed');             // → deterministic from seed
uid.encodeBase62(bigInt);         // encode number to base62
uid.decodeBase62(str);            // decode base62 to number
```

---

## Security & Tokens

### JWT-like Token IDs

```js
const token = uid.tokenId({ userId: 42, role: 'admin' }, 'my-secret', {
  expiresIn: 3600   // seconds
});
// → 'eyJ...<signed payload>...'

const { valid, payload, expired } = uid.verifyTokenId(token, 'my-secret');
// → { valid: true, payload: { userId: 42, role: 'admin' }, expired: false }
```

### Zero-Knowledge Commitments

```js
// Commit to an ID without revealing it
const { commitment, blindingFactor } = uid.commitId('my-secret-id');

// Later, prove you know it without revealing the ID
const ok = uid.verifyCommitment(commitment, 'my-secret-id', blindingFactor);
// → true
```

### Tamper-Proof IDs

```js
uid.signId('my-id', 'secret');       // append HMAC signature
uid.encryptId('my-id', 'key');       // AES-256 encrypted
uid.expiringId({ ttl: 3600 });       // auto-expiring ID
uid.checkExpiry(id);                 // { expired: false, remainingMs: 3599000 }
```

---

## Parallel Generation (Worker Threads)

Generate millions of IDs using all CPU cores simultaneously:

```js
const { generateParallel, terminateWorkers } = require('uuid-lab');

// Generate 1,000,000 nanoIds in parallel
const ids = await generateParallel('nanoId', 1_000_000);
console.log(ids.length);  // 1000000, ~160,000 IDs/sec

// Clean up when done
terminateWorkers();
```

**Supported generators:** `nanoId`, `uuid`, `uuidV4`, `typedId`, `humanId`, `sequentialId`, `fromPattern`

---

## ID DSL & Templates

Define ID schemas with a simple pattern language:

```js
const gen = uid.compileTemplate('ord-[date:YYYYMMDD]-[random:8]-[seq:4]');
gen();  // → 'ord-20260419-aB3cD9eF-0001'
gen();  // → 'ord-20260419-xY7pQ2rS-0002'
```

**Available tokens:**

| Token | Description | Example |
|---|---|---|
| `[random:N]` | N random URL-safe chars | `aB3cD9eF` |
| `[date:FORMAT]` | Date using YYYY/MM/DD | `20260419` |
| `[uuid]` | Full UUID v4 | `f47ac10b-...` |
| `[nano]` | NanoID (21 chars) | `V1StGXR8_Z5jd...` |
| `[ulid]` | ULID (26 chars) | `01ARZ3NDEK...` |
| `[seq:N]` | Zero-padded sequence | `0042` |
| `[ts]` | Unix timestamp ms | `1713526800000` |
| `[literal]` | Literal text | as-is |

---

## Smart Recommendation

Let the library choose the best generator for your requirements:

```js
const results = uid.recommendId(['sortable', 'urlSafe', 'distributed']);

// → [
//   { type: 'ulid', matchPercentage: 100, description: '...' },
//   { type: 'uuidV7', matchPercentage: 75, description: '...' },
//   ...
// ]
```

**Available requirement tags:** `sortable`, `urlSafe`, `distributed`, `secure`, `humanReadable`, `short`, `deterministic`, `collision-resistant`

---

## Distributed Systems

### Multi-Service ID Federation

```js
const { FederationNode, createFederation } = require('uuid-lab');

const node = new FederationNode({ nodeId: 'eu-west-1', strategy: 'snowflake' });
const id = node.generate();          // unique per node, globally unique

const fed = createFederation();
fed.join(node);
const { owner } = fed.verify(id);   // → 'eu-west-1'
```

### Clock Drift Handling

Snowflake generation is now protected against NTP clock drift:

```js
const node = new FederationNode({
  nodeId: 'node-1',
  strategy: 'snowflake',
  clockDriftStrategy: 'logical'  // or 'reject'
});
```

### ID Reservation System

Safely reserve IDs before committing them (prevents race conditions):

```js
const detector = uid.createDetector();
const reservation = await detector.reserve('my-id');

// ... validate your data ...

await detector.commitReservation(reservation.token);   // lock it in
// or
await detector.releaseReservation(reservation.token);  // roll back
```

### Multi-Region Topology IDs

```js
uid.topoId({ country: 'DE', dc: 'eu-central-1' });
// → 'DE_ec1_20260419_V1StGXR8'

const meta = uid.parseTopology(id);
// → { country: 'DE', dc: 'eu-central-1', isEU: true, date: '2026-04-19' }
```

---

## Collision Detection

```js
const detector = uid.createDetector({ namespace: 'users' });

const result = await detector.checkAndRegister('some-id');
// → { registered: true, isCollision: false }

const result2 = await detector.checkAndRegister('some-id');
// → { registered: false, isCollision: true }

detector.stats();
// → { registrations: 2, collisions: 1, collisionRate: 0.5, bloomFillRatio: 0.001 }
```

**Redis backend:**

```js
const detector = uid.createDetector({
  namespace: 'prod',
  backend: 'redis',
  redisUrl: 'redis://localhost:6379'
});
```

---

## Namespace System

```js
uid.defineNamespace('payments', { prefix: 'pay', separator: '_' });

const id = uid.namespaceId('payments');  // → 'pay_V1StGXR8_Z5jdHi6B'
uid.belongsTo(id, 'payments');           // → true
uid.detectNamespace(id);                 // → 'payments'
uid.listNamespaces();                    // → ['payments', ...]

// Environment-aware IDs
uid.setEnvironment('prod');
uid.envId('payments');                   // → 'prod_pay_V1StGXR8...'
```

---

## Hierarchical IDs

```js
const org  = uid.hierarchyRoot({ label: 'org' });
const team = uid.hierarchyChild(org, { label: 'team' });
const user = uid.hierarchyChild(team, { label: 'user' });

uid.depthOf(user);              // → 2
uid.parentOf(user);             // → team id
uid.isDescendant(user, org);    // → true
uid.isDirectChild(team, org);   // → true
uid.parseHierarchy(user);       // → { depth: 2, root, parent, leaf, labels }

// Subtree range queries (for range-based DB scans)
uid.subtreeRange(team);         // → { gte: '...', lte: '...' }

// Lowest Common Ancestor
uid.lca(user1, user2);          // → team id

// Topological sort
uid.topoSort([user, team, org]); // → [org, team, user]
```

---

## Compound & Fuzzy IDs

### Compound IDs

```js
const id = uid.compoundId([userId, orderId]);
const { valid, components } = uid.splitId(id);
// → { valid: true, components: [userId, orderId] }

uid.hasComponent(id, userId);            // → true
uid.sharedComponents(id1, id2);         // → common component IDs
uid.timedCompoundId([a, b]);            // → compound + timestamp
```

### Fuzzy / Typo-Resistant IDs

```js
const id = uid.fuzzyId({ prefix: 'INV' });
// uses Crockford Base32 (no confusing chars: O/0, I/l)

const { valid, autoFixed } = uid.validateFuzzy(id);
const corrected = uid.correctFuzzy(typoId);  // auto-correct common typos
uid.parseFuzzy(id);  // → { body, checkChar, valid, prefix }
```

---

## Lifecycle & State IDs

```js
const id = uid.lifecycleId('order', 'pending');
uid.verifyState(id, 'pending');           // → true
uid.verifyState(id, 'shipped');           // → false

const updated = uid.transitionState(id, 'shipped', {
  allowed: ['pending → processing', 'processing → shipped']
});

// Full lifecycle history
uid.getHistory(id);      // → [{ from, to, ts, reason }, ...]
uid.replayHistory(id);   // → { valid, states, steps }
uid.getTimeline(id);     // → [{ state, enteredAt, duration, isCurrent }]
```

---

## Semantic & Relationship IDs

```js
// Semantic IDs embed type/role/region
const id = uid.semanticId({ type: 'user', role: 'admin', region: 'eu' });
uid.validateSemantic(id);          // → { valid: true }
uid.parseSemantic(id);             // → { type: 'user', role: 'admin', region: 'eu' }

// Relationship-encoded IDs
const child = uid.linkedId(parentId, childIndex, 'secret');
uid.verifyLink(child, parentId, 'secret');   // → true

// Role-scoped IDs (same entity, different per role)
const adminView  = uid.scopedId('user-123', 'admin');
const guestView  = uid.scopedId('user-123', 'guest');
// adminView !== guestView, but both map back to 'user-123'
```

---

## Time-based IDs

```js
uid.timestampId();                        // → ID with embedded timestamp
uid.extractTime(ulid);                    // → Date object
uid.timeWindowId({ window: 60_000 });     // same per 60s window
uid.epochDayId();                         // same for the whole day
uid.contextId('checkout');                // → 'checkout_<timestamp>_<random>'
uid.meaningfulId();                       // → 'swift-hawk_<timestamp>'
uid.pronounceableId();                    // → easy to say aloud
uid.multiFormatId('my-id', ['hex', 'base64']); // multiple encodings at once
```

---

## Analytics & Observability

### Metrics API

```js
const snap = uid.dashboardSnapshot();
// → {
//     capturedAt, uptimeHuman,
//     generation: { total, byType: { nanoId: 42, ... } },
//     latency: { p50, p95, p99, min, max, mean },
//     collisions: { total, byNamespace },
//     federation: { nodes, totalGenerated },
//     alerts: []
//   }

uid.renderAsciiDashboard();  // pretty terminal dashboard
```

### Event Hooks

```js
uid.on('generate', ({ type, id }) => console.log('Generated:', type, id));
uid.on('collision', ({ id, namespace }) => alert(`Collision: ${id}`));
uid.once('generate', handler);   // fire once
uid.off('generate', handler);    // unsubscribe
```

### Logging / Debug

```js
uid.enableDebug();
uid.debugWrap('myGen', () => uid.nanoId());
uid.getDebugLog();    // → [{ label, id, durationMs, ts }]
uid.clearDebugLog();
uid.disableDebug();
```

### Telemetry

```js
const report = uid.flushTelemetry();
// → { generated, collisions, peakRate, uptime, latencyPercentiles, histogram }
```

---

## GDPR / HIPAA Compliance

```js
// Scan an ID for accidentally embedded PII
uid.scanForPII('user@email.com_abc123');
// → { risk: 'high', findings: [{ type: 'email', risk: 'high' }] }

// Verify pseudonymization
uid.verifyPseudonymization(id);
// → { verdict: 'COMPLIANT', checks: [...], gdprArticle: 'Art. 4(5)' }

// Data residency check
uid.checkDataResidency(topoId);
// → { compliant: true, region: 'EU', gdprApplies: true }

// Full compliance report
const report = uid.generateComplianceReport([id1, id2, id3]);
uid.formatReport(report);  // → formatted string report
```

---

## Ecosystem Integrations

### Express Middleware

```js
const express = require('express');
const { expressMiddleware } = require('uuid-lab');

const app = express();
app.use(expressMiddleware({ headerName: 'X-Request-Id' }));
// req.id and res header are now automatically set on every request
```

### Mongoose Plugin

```js
const mongoose = require('mongoose');
const { mongoosePlugin } = require('uuid-lab');

const UserSchema = new mongoose.Schema({ name: String });
UserSchema.plugin(mongoosePlugin, { field: '_id', generator: () => uid.nanoId() });
```

### Sequelize Adapter

```js
const { DataTypes } = require('sequelize');
const { sequelizeAdapter } = require('uuid-lab');

const User = sequelize.define('User', {
  id: sequelizeAdapter(DataTypes.STRING, { generator: () => uid.nanoId() })
});
```

### GraphQL Custom Scalar

```js
const { GraphQLScalarType } = require('graphql');
const { createGraphQLScalar } = require('uuid-lab');

const NanoIdScalar = new GraphQLScalarType(
  createGraphQLScalar('NanoID', (val) => val.length === 21)
);
```

---

## Framework Support

### React (SSR-safe)

```js
const { createReactHooks } = require('uuid-lab');
const { useSafeId, useCorrelationId } = createReactHooks(React);

function MyComponent() {
  const id = useSafeId('btn-');     // hydration-safe unique ID
  return <button id={id}>Click</button>;
}
```

### Vue 3 Composables

```js
const { createVueComposables } = require('uuid-lab');
const { useSafeId } = createVueComposables(vue);

// In your setup():
const id = useSafeId('input-');  // reactive ref, updates after mount
```

### Next.js / SSR

```js
const { ssrSafeId } = require('uuid-lab');

// Returns a deterministic prefix-based ID on the server,
// and a random ID on the client — preventing hydration mismatches
const id = ssrSafeId('ssr');
```

---

## ID Migration & Versioning

```js
// Detect format of any legacy ID
uid.detectFormat('f47ac10b-58cc-4372-a567-0e02b2c3d479');  // → 'uuid-v4'
uid.detectFormat('01ARZ3NDEKTSV4RRFFQ69G5FAV');            // → 'ulid'
uid.detectFormat('12345');                                  // → 'legacy-int'

// Migrate old IDs to new format
const { newId, oldId, isMigrated } = uid.migrateId(legacyId);
uid.isMigrated(newId);              // → true
uid.recoverOriginal(newId);         // → { originalId, version, integrity: true }

// Batch migrate
const results = uid.batchMigrate([id1, id2, id3]);

// Migration audit log
uid.getMigrationLog();              // → [{ from, to, reason, ts }]
uid.clearMigrationLog();
```

---

## DevTools & CLI

### Interactive CLI

```bash
# Generate IDs
npx uuid-lab generate nanoid
npx uuid-lab generate uuid --count 5
npx uuid-lab generate nanoId --count 10 --size 12

# Decode any ID
npx uuid-lab decode f47ac10b-58cc-4372-a567-0e02b2c3d479

# Help
npx uuid-lab help
```

### Error Handling

```js
const { createError, ErrorCodes } = require('uuid-lab');

throw createError('ID already exists', ErrorCodes.COLLISION, { id: 'my-id' });
// → UuidLabError: ID already exists [COLLISION] { id: 'my-id' }
```

### Validation

```js
uid.validate('some-id', { minLength: 8, noSpaces: true });
// → { valid: true, violations: [] }

uid.validateBatch([id1, id2, id3], rules);
// → { total: 3, invalid: 1, results: [...] }

uid.commonRules.noEmpty(id);
uid.commonRules.minLength(8)(id);
```

### Code Generation

```js
uid.generateSchemaDocs(schema);   // → markdown table
uid.generateTypeScript(schema);   // → TypeScript interface
uid.generateDocs(schema);         // → full docs page
```

### Testing Utilities

```js
uid.withMock(() => uid.nanoId(), 'mock-id-123');  // returns mock during fn
uid.testIds(5, 'nanoid');         // → deterministic test IDs
uid.assertId(id, { type: 'nanoid', length: 21 });
```

---

## High-Performance Pool

Pre-generates IDs in background batches for zero-latency retrieval:

```js
const pool = uid.createHighPerfPool(uid.nanoId, {
  size: 1000,
  refillThreshold: 0.2   // refill when 20% remaining
});

pool.get();             // instant, pre-generated
pool.drain(50);         // pull 50 IDs at once
pool.peek();            // preview without consuming
pool.stats();           // { poolSize, generated, hits, refills, hitRate }
pool.size;              // current available count
```

The pool **auto-scales** — it increases batch size when hit rate is high and decreases it when utilization is low.

---

## Blockchain-style ID Chain

Tamper-evident, cryptographically-linked audit trails:

```js
const chain = uid.createChain({ hashAlgorithm: 'sha256' });  // or 'sha512'

const genesis = chain.genesis({ data: 'audit-start' });
const block1  = chain.add(uid.nanoId(), { label: 'user-created' });
const block2  = chain.add(uid.nanoId(), { label: 'order-placed' });

chain.verify();          // → true (tamper-proof)
chain.length;            // → 3
chain.getLast();         // → block2
chain.find(genesis.id);  // → genesis block
chain.toJSON();          // → { valid: true, length: 3, blocks: [...] }
```

### QR Code Generation

```js
// ASCII art QR (terminal display)
const ascii = uid.idToQrAscii('my-id');
console.log(ascii);

// Data URL (embed in HTML/PDF)
const dataUrl = uid.idToQrDataUrl('my-id');
// → 'data:text/plain;base64,...'
```

---

## TypeScript Support

Full TypeScript definitions included — no `@types` package needed.

```ts
import {
  nanoId, uuid, ulid,
  generateParallel,
  tokenId, verifyTokenId, commitId, verifyCommitment,
  compileTemplate, recommendId,
  expressMiddleware, mongoosePlugin, sequelizeAdapter, createGraphQLScalar,
  ssrSafeId, createReactHooks, createVueComposables,
  createChain, IdChain, idToQrAscii,
  createHighPerfPool, HighPerformancePool,
} from 'uuid-lab';

const ids: string[] = await generateParallel('nanoId', 10000);
const gen: () => string = compileTemplate('order-[date:YYYYMMDD]-[random:8]');
```

---

## ESM Support

```js
// Works natively with ES Modules
import { nanoId, generateParallel, tokenId, compileTemplate } from 'uuid-lab';
```

---

## Testing

Run the full test suite:

```bash
node test-v3.js   # Semantic, Relationship, Entropy, Topology — 122 tests
node test-v4.js   # Fuzzy, Compound, Hierarchy, Migration — 142 tests
node test-v5.js   # Collision Detection, Federation, GDPR — 124 tests
node test-v6.js   # Decode, Batch Verify, Query, DevTools — 147 tests
node test-v7.js   # Format, Namespace, Time-based, Analytics — 129 tests
node test-v8.js   # Chain, QR, Pool, Integration — 74 tests

node verify.js       # Verify all 16 new features load correctly
node test-fuzz.js    # Fuzz test: 10,000 garbage inputs
node test-stress.js  # Stress test: 1,000,000 IDs via worker threads
```

**Total: 738 tests, 0 failures**

| Metric | Result |
|---|---|
| Tests passing | ✅ 738 / 738 |
| Fuzz safety | ✅ 10,000 random inputs handled |
| Throughput | ⚡ ~160,000+ IDs/sec (parallel) |
| Collisions (1M sample) | ✅ 0 detected |

---

## License

MIT © Mayur Patel
