#!/usr/bin/env node
/* eslint-env es2020 */
'use strict';

/**
 * uuid-lab CLI
 *
 * Usage:
 *   uuid-lab generate uuid
 *   uuid-lab generate nanoid --size 12 --count 5
 *   uuid-lab generate ulid --count 3
 *   uuid-lab decode <id>
 *   uuid-lab validate <id>
 *   uuid-lab inspect <id>
 *   uuid-lab bench
 *   uuid-lab help
 */

const uid = require('../index');

// ── Color helpers (no dependencies) ──────────────────────────────────────────
const isTTY   = process.stdout.isTTY;
const c = {
  reset:  isTTY ? '\x1b[0m'  : '',
  bold:   isTTY ? '\x1b[1m'  : '',
  dim:    isTTY ? '\x1b[2m'  : '',
  green:  isTTY ? '\x1b[32m' : '',
  cyan:   isTTY ? '\x1b[36m' : '',
  yellow: isTTY ? '\x1b[33m' : '',
  red:    isTTY ? '\x1b[31m' : '',
  blue:   isTTY ? '\x1b[34m' : '',
};

const ok  = (s) => console.log(`${c.green}${s}${c.reset}`);
const log = (s) => console.log(s);
const dim = (s) => console.log(`${c.dim}${s}${c.reset}`);
const hdr = (s) => console.log(`\n${c.bold}${c.cyan}${s}${c.reset}`);
const warn= (s) => console.error(`${c.yellow}⚠  ${s}${c.reset}`);
const fail= (s) => { console.error(`${c.red}✖  ${s}${c.reset}`); process.exit(1); };

// ── Arg parser ────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args  = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        const n = Number(next);
        flags[key] = isNaN(n) ? next : n;
        i++;
      } else {
        flags[key] = true;
      }
    } else if (a.startsWith('-') && a.length === 2) {
      flags[a.slice(1)] = true;
    } else {
      args.push(a);
    }
  }
  return { args, flags };
}

// ── Generators map ────────────────────────────────────────────────────────────

const GENERATORS = {
  uuid:          (f) => uid.uuid(),
  uuidv4:        (f) => uid.uuidV4(),
  uuidv7:        (f) => uid.uuidV7(),
  nanoid:        (f) => uid.nanoId({ size: f.size || 21 }),
  ulid:          (f) => uid.ulid(),
  ksuid:         (f) => uid.ksuid(),
  snowflake:     (f) => uid.snowflakeId(),
  cuid:          (f) => uid.cuid?.() ?? uid.nanoId({ size: 25 }),
  cuid2:         (f) => uid.cuid2?.() ?? uid.nanoId({ size: 24 }),
  human:         (f) => uid.humanId(),
  meaningful:    (f) => uid.meaningfulId(),
  pronounceable: (f) => uid.pronounceableId(),
  fuzzy:         (f) => uid.fuzzyId({ size: f.size || 16 }),
  expiring:      (f) => uid.expiringId({ ttl: f.ttl || '1h' }),
  timestamp:     (f) => uid.timestampId(),
  short:         (f) => uid.shortId({ size: f.size || 8 }),
  base62:        (f) => uid.base62Id({ size: f.size || 16 }),
  base36:        (f) => uid.base36Id({ size: f.size || 16 }),
  prefixed:      (f) => uid.prefixedId(f.prefix || 'id'),
  sha3:          (f) => uid.deterministicId?.(f.input || Date.now().toString(), { algorithm: 'sha3-256' }) ?? uid.nanoId({ size: 32 }),
  mongoId:       (f) => uid.mongoObjectId?.() ?? uid.nanoId({ size: 24 }),
};

// ── Commands ──────────────────────────────────────────────────────────────────

function cmdGenerate(args, flags) {
  const type  = (args[0] || 'uuid').toLowerCase();
  const count = Math.min(flags.count || flags.n || 1, 1000);
  const gen   = GENERATORS[type];

  if (!gen) {
    fail(`Unknown type: "${type}"\nAvailable: ${Object.keys(GENERATORS).join(', ')}`);
  }

  const json  = flags.json || flags.j;
  const ids   = Array.from({ length: count }, () => gen(flags));

  if (json) {
    log(JSON.stringify(count === 1 ? { id: ids[0], type } : { ids, type, count }, null, 2));
  } else {
    ids.forEach(id => ok(id));
  }
}

function cmdDecode(args, flags) {
  const id = args[0];
  if (!id) fail('Usage: uuid-lab decode <id>');

  const result = uid.decodeId(id);
  const json   = flags.json || flags.j;

  if (json) {
    log(JSON.stringify(result, null, 2));
    return;
  }

  hdr('Decoded ID');
  dim(`  Input : ${id}`);
  log(`  Type  : ${c.green}${result.type}${c.reset}`);
  if (result.version   !== undefined) log(`  Version: ${result.version}`);
  if (result.timestamp !== undefined) log(`  Time  : ${new Date(result.timestamp).toISOString()}`);
  if (result.machineId !== undefined) log(`  Machine: ${result.machineId}`);
  if (result.state     !== undefined) log(`  State : ${result.state}`);
  if (result.country   !== undefined) log(`  Country: ${result.country} (EU: ${result.isEU})`);
  if (result.entropyBits!== undefined)log(`  Entropy: ${result.entropyBits} bits`);
}

function cmdValidate(args, flags) {
  const id   = args[0];
  const type = flags.type;
  if (!id) fail('Usage: uuid-lab validate <id> [--type uuid|nanoid|ulid...]');

  let result;
  if (uid.validateAny) {
    result = uid.validateAny(id);
  } else {
    result = { valid: typeof id === 'string' && id.length > 0, type: 'unknown', errors: [] };
  }

  if (flags.json || flags.j) {
    log(JSON.stringify({ id, ...result }, null, 2));
    return;
  }

  if (result.valid) {
    ok(`✔  Valid ${result.type || 'ID'}`);
    dim(`   "${id}"`);
  } else {
    warn(`Invalid ID`);
    dim(`   "${id}"`);
    result.errors?.forEach(e => console.error(`   ${c.red}${e}${c.reset}`));
  }
}

function cmdInspect(args, flags) {
  const id = args[0];
  if (!id) fail('Usage: uuid-lab inspect <id>');

  const info = uid.inspectId ? uid.inspectId(id) : uid.decodeId(id);

  if (flags.json || flags.j) {
    log(JSON.stringify(info, null, 2));
    return;
  }

  hdr('ID Inspection');
  log(`  Raw     : ${c.cyan}${id}${c.reset}`);
  log(`  Length  : ${info.length}`);
  log(`  Type    : ${c.green}${info.type}${c.reset}`);
  if (info.entropy)    log(`  Entropy : ${info.entropy} bits`);
  if (info.prefix)     log(`  Prefix  : ${info.prefix}`);
  if (info.charset)    log(`  Charset : ${info.charset}`);
  if (info.separators?.length) log(`  Seps    : ${info.separators.join(', ')}`);
}

function cmdBench(args, flags) {
  const N = flags.n || 10_000;

  hdr(`Benchmark (${N.toLocaleString()} iterations each)`);

  const results = [];
  for (const [name, gen] of Object.entries(GENERATORS)) {
    try {
      const start = process.hrtime.bigint();
      for (let i = 0; i < N; i++) gen({});
      const ms = Number(process.hrtime.bigint() - start) / 1_000_000;
      results.push({ name, ms, ops: Math.floor(N / (ms / 1000)) });
    } catch { /* skip */ }
  }

  results.sort((a, b) => b.ops - a.ops);
  results.forEach(r => {
    const bar = '█'.repeat(Math.floor(r.ops / 200_000));
    log(`  ${r.name.padEnd(16)} ${String(r.ops.toLocaleString()).padStart(12)} ops/s  ${c.green}${bar}${c.reset}`);
  });
}

function cmdTypes() {
  hdr('Available ID Types');
  Object.keys(GENERATORS).forEach(t => log(`  ${c.cyan}${t}${c.reset}`));
}

function cmdHelp() {
  log(`
${c.bold}${c.cyan}uuid-lab${c.reset} — Comprehensive ID Generation CLI

${c.bold}USAGE${c.reset}
  uuid-lab <command> [options]

${c.bold}COMMANDS${c.reset}
  ${c.green}generate${c.reset} <type>   Generate IDs (default: uuid)
  ${c.green}decode${c.reset} <id>       Decode an ID and show its structure
  ${c.green}validate${c.reset} <id>     Validate an ID
  ${c.green}inspect${c.reset} <id>      Deep inspection of an ID
  ${c.green}bench${c.reset}             Run performance benchmark
  ${c.green}types${c.reset}             List all supported ID types
  ${c.green}help${c.reset}              Show this help

${c.bold}OPTIONS${c.reset}
  --count, -n <n>    Number of IDs to generate (max 1000)
  --size <n>         ID size (for nanoid, fuzzy, etc.)
  --prefix <s>       Prefix string (for prefixed IDs)
  --ttl <s>          TTL: 1h, 1d, 7d (for expiring IDs)
  --json, -j         Output as JSON
  --type <t>         Expected type for validate command

${c.bold}EXAMPLES${c.reset}
  uuid-lab generate uuid
  uuid-lab generate nanoid --size 12 --count 5
  uuid-lab generate ulid --count 3 --json
  uuid-lab generate prefixed --prefix usr
  uuid-lab decode 01ARZ3NDEKTSV4RRFFQ69G5FAV
  uuid-lab validate 550e8400-e29b-41d4-a716-446655440000
  uuid-lab bench --n 50000
  uuid-lab types
`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const argv  = process.argv.slice(2);
  const { args, flags } = parseArgs(argv);
  const cmd   = args[0] || 'help';
  const rest  = args.slice(1);

  switch (cmd.toLowerCase()) {
    case 'generate': case 'gen': case 'g':
      return cmdGenerate(rest, flags);
    case 'decode':   case 'd':
      return cmdDecode(rest, flags);
    case 'validate': case 'v':
      return cmdValidate(rest, flags);
    case 'inspect':  case 'i':
      return cmdInspect(rest, flags);
    case 'bench':    case 'benchmark':
      return cmdBench(rest, flags);
    case 'types':
      return cmdTypes();
    case 'help':     case '--help': case '-h':
      return cmdHelp();
    default:
      // If first arg looks like an ID, decode it
      if (cmd.length > 8 && !GENERATORS[cmd.toLowerCase()]) {
        return cmdDecode([cmd], flags);
      }
      // Otherwise treat as generate type
      return cmdGenerate([cmd, ...rest], flags);
  }
}

main();
