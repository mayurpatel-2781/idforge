#!/usr/bin/env node
'use strict';

/**
 * uuid-lab CLI — npx uuid-lab <command> [options]
 *
 * Usage:
 *   npx uuid-lab generate nanoid --count 5
 *   npx uuid-lab generate uuid
 *   npx uuid-lab generate meaningful --count 3
 *   npx uuid-lab decode 01ARZ3NDEKTSV4RRFFQ69G5FAV
 *   npx uuid-lab scan "user_john@example.com_abc"
 *   npx uuid-lab entropy V1StGXR8_Z5jdHi6B-myT
 *   npx uuid-lab inspect <id>
 *   npx uuid-lab compress <uuid>
 *   npx uuid-lab predict --size 21 --count 1000000
 *   npx uuid-lab formats
 *   npx uuid-lab help
 */

const uid = require('../index.js');

const argv   = process.argv.slice(2);
const command = argv[0];
const args    = [];
const flags   = {};

for (let i = 1; i < argv.length; i++) {
  if (argv[i].startsWith('--')) {
    const key = argv[i].slice(2);
    const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    flags[key] = isNaN(val) ? val : Number(val);
  } else {
    args.push(argv[i]);
  }
}

const count = flags.count || flags.n || 1;

function output(data) {
  if (Array.isArray(data)) data.forEach(d => console.log(d));
  else if (typeof data === 'object') console.log(JSON.stringify(data, null, 2));
  else console.log(data);
}

const GENERATORS = {
  nanoid:       () => uid.nanoId(flags.size),
  uuid:         () => uid.uuid(),
  ulid:         () => uid.ulid(),
  ksuid:        () => uid.ksuid(),
  snowflake:    () => uid.snowflakeId(),
  human:        () => uid.humanId(),
  meaningful:   () => uid.meaningfulId({ words: flags.words || 2 }),
  pronounceable:() => uid.pronounceableId({ length: flags.size || 8 }),
  fuzzy:        () => uid.fuzzyId({ size: flags.size || 16 }),
  emoji:        () => uid.emojiId({ size: flags.size || 5 }),
  short:        () => uid.shortId({ size: flags.size || 8 }),
  visual:       () => uid.visualId({ size: flags.size || 16 }),
  timestamp:    () => uid.timestampId({ prefix: flags.prefix }),
  compact:      () => uid.compactId(),
  offline:      () => uid.offlineId(),
  otp:          () => uid.otpToken(),
  typed:        () => uid.typedId(flags.type || flags.t || 'item'),
  adaptive:     () => uid.adaptiveId(flags.usecase || flags.u || 'session'),
  prefixed:     () => uid.prefixedId({ prefix: flags.prefix || flags.p || 'id', size: flags.size || 12 }),
  base62:       () => uid.base62Id({ size: flags.size || 16 }),
  base36:       () => uid.base36Id({ size: flags.size || 16 }),
  urlsafe:      () => uid.urlSafeId({ size: flags.size || 21 }),
  expiring:     () => uid.expiringId({ ttl: flags.ttl || '1h' }),
};

switch (command) {
  case 'generate':
  case 'gen':
  case 'g': {
    const type = args[0] || 'nanoid';
    const gen  = GENERATORS[type];
    if (!gen) {
      console.error(`Unknown type: "${type}"\nAvailable: ${Object.keys(GENERATORS).join(', ')}`);
      process.exit(1);
    }
    const ids = Array.from({ length: Math.min(count, 10000) }, () => gen());
    output(ids.length === 1 ? ids[0] : ids);
    break;
  }

  case 'decode':
  case 'parse': {
    const id = args[0];
    if (!id) { console.error('Usage: uuid-lab decode <id>'); process.exit(1); }
    output(uid.decodeId(id));
    break;
  }

  case 'inspect':
  case 'info': {
    const id = args[0];
    if (!id) { console.error('Usage: uuid-lab inspect <id>'); process.exit(1); }
    output(uid.inspectId(id));
    break;
  }

  case 'scan':
  case 'pii': {
    const id = args[0];
    if (!id) { console.error('Usage: uuid-lab scan <id>'); process.exit(1); }
    const result = uid.scanForPII(id);
    if (result.clean) console.log('✅ No PII detected');
    else { console.log('⚠️  PII found:', result.findings.map(f => f.type || f).join(', ')); }
    if (flags.json) output(result);
    break;
  }

  case 'entropy': {
    const id = args[0] || uid.nanoId();
    output(uid.analyzeEntropy(id));
    break;
  }

  case 'compress': {
    const id = args[0];
    if (!id) { console.error('Usage: uuid-lab compress <id>'); process.exit(1); }
    const compressed = uid.compressId(id);
    console.log(`Original  (${id.length} chars): ${id}`);
    console.log(`Compressed (${compressed.length} chars): ${compressed}`);
    console.log(`Savings: ${id.length - compressed.length} chars (${Math.round((1 - compressed.length/id.length)*100)}%)`);
    break;
  }

  case 'predict': {
    output(uid.predictCollision({
      alphabetSize: flags.alphabet || 62,
      idLength:     flags.size || 21,
      count:        flags.count || 1000000,
    }));
    break;
  }

  case 'validate': {
    const id = args[0];
    if (!id) { console.error('Usage: uuid-lab validate <id>'); process.exit(1); }
    output(uid.parseId(id));
    break;
  }

  case 'formats': {
    console.log('Available types:');
    Object.keys(GENERATORS).forEach(t => console.log(`  ${t}`));
    break;
  }

  case 'version':
  case '-v':
  case '--version': {
    const pkg = require('../../package.json');
    console.log(`uuid-lab v${pkg.version}`);
    break;
  }

  case 'help':
  case '--help':
  case '-h':
  default: {
    console.log(`
uuid-lab — The world's most complete ID toolkit

Usage:
  uuid-lab <command> [options]

Commands:
  generate <type>     Generate IDs (alias: gen, g)
  decode <id>         Decode any ID type
  inspect <id>        Full ID inspection
  scan <id>           PII scanner
  entropy <id>        Entropy analysis
  compress <id>       Compress UUID to Base62
  predict             Collision probability
  validate <id>       Validate & detect type
  formats             List all generator types
  version             Show version

Generate types:
  nanoid, uuid, ulid, ksuid, snowflake, human, meaningful,
  pronounceable, fuzzy, emoji, short, visual, timestamp,
  compact, offline, otp, typed, adaptive, prefixed,
  base62, base36, urlsafe, expiring

Options:
  --count <n>         Number of IDs to generate
  --size <n>          ID length
  --prefix <str>      Prefix for prefixed IDs
  --type <str>        Type for typedId
  --usecase <str>     Use case for adaptiveId
  --ttl <str>         TTL for expiring IDs (1h, 1d, 7d)
  --json              Output raw JSON
  --words <n>         Word count for meaningful IDs

Examples:
  uuid-lab generate nanoid --count 5
  uuid-lab generate meaningful --count 3
  uuid-lab generate typed --type order
  uuid-lab decode 01ARZ3NDEKTSV4RRFFQ69G5FAV
  uuid-lab scan "user_john@test.com"
  uuid-lab compress 550e8400-e29b-41d4-a716-446655440000
  uuid-lab predict --size 16 --count 1000000
`);
    break;
  }
}
