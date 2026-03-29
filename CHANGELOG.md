# Changelog

## [1.0.0] - 2025-01-01

### Added — 219 exports across 6 feature generations

#### v1–v2 Core
- UUID v4, v5, v7, v3, ULID, KSUID, Snowflake, NanoId, HumanId, TypedId, Sequential
- Pattern IDs, Timestamp IDs, GeoIDs
- ID Signing, Encryption, Expiring IDs, OTP tokens
- Batch generation, ID pools, Bloom filter collision tracking
- Full validation and type detection

#### v3 — World-first features
- Semantic IDs — context tokens embedded in ID structure
- Relationship IDs — cryptographically linked parent→child
- Role-Scoped IDs — same resource, different ID per viewer role
- Lifecycle IDs — HMAC-signed state machine IDs
- Entropy Scoring — bits, score label, collision probabilities
- Deterministic Chaos IDs (DCID) — reproducible with key, random without
- Telemetry — generation rate, pool stats, warnings
- Schema IDs — composable multi-segment IDs with checksum
- Topology IDs — region + datacenter embedded, GDPR-aware
- ID Lineage — cryptographic audit trail

#### v4 — New generators + enhancements
- Fuzzy IDs — Crockford Base32, Luhn checksum, auto-correction
- Compound IDs — encode multiple IDs into one reversible string
- Hierarchy IDs — materialized path, subtree range queries
- Rate Limiter — token-bucket, per-key, RateLimitError
- ID Migration — format detection, reversible versioned envelope
- Real Randomness Tests — chi-squared + run-length
- Lifecycle History — full audit trail, getTimeline, replayHistory
- Enhanced Telemetry — p50/p75/p95/p99 latency percentiles

#### v5 — Premium features
- Cloud Collision Detection — 3-layer bloom + exact store + pluggable backend
- Multi-Service Federation — snowflake / prefix / range / epoch strategies
- GDPR/HIPAA Compliance — PII scanner, pseudonymization verifier, audit reports
- Analytics Dashboard — time-series, alert engine, watch() streaming

#### v6 — Platform features
- Reverse Decode — extract all fields from any ID type
- Global Parser — unified auto-detect entry point
- Persistent Storage — pluggable memory / file / DB backends
- Batch Verification — rules engine across ID arrays
- Comparison Utils — compareIds, sortById, diffIds, groupByType
- Query / Tag System — searchable indexed collection with metadata
- Collision Prevention — safe generator with auto-retry
- ID Versioning — register and generate versioned schemas
- Schema Migration — multi-hop version migration
- Plugin Middleware — before/after hooks on any generator
- Event System — on/off/once/emit + webhook support
- Global Config — configure() once at startup
- Async Streaming — async generator for huge batches
- Caching Layer — LRU cache with TTL
- Access Control — role-based permission policies
- Export / Import — JSON and CSV serialization
- Debug / Trace — timing instrumentation per call
- Error Standardization — UniqidError with typed ErrorCodes
- Validation Rules Engine — composable named rules
- Retry / Fallback — withRetry + withFallback chains
- Monitoring — counters, gauges, timing percentiles, probes
- CLI Support — parseCLIArgs + executeCLI
- Doc Generator — Markdown + TypeScript interface generator
- Full TypeScript types — 219 typed exports
- Test Utilities — mockGenerator, testIds, assertId
