#!/usr/bin/env node
/**
 * env-readiness.cjs — deterministic substrate-readiness probe + suite-failure
 * classifier for the Orchestrator P5/P6 gate-outcome contract (DEC-DEV-0092,
 * N+2 increment; work-order dev/ORCHESTRATOR_N2_GATE_CONTRACT_WORKORDER.md).
 *
 * WHY THIS EXISTS (live-run B, FB-LR-02 / FB-LR-04 / FB-LR-09 — DEC-DEV-0091):
 *   P6's mechanical layer conflated a DOWN substrate (Docker/Postgres/Redis not
 *   up) with "the code failed": build was GREEN but 181 PrismaClientInitialization
 *   Errors → `!mechPassed` → NO-GO. That is a FALSE NO-GO — the gate never got to
 *   judge the code. The contract models the gate outcome on TWO orthogonal axes —
 *     verdict   ∈ {GO, NO-GO, MANUAL_VERIFY}  — "is the code good?"
 *     readiness ∈ {READY, DEGRADED, ENV_NOT_READY} — "did the gate get to judge?"
 *   This lib owns the readiness axis as CODE (not LLM initiative), in two modes:
 *     probe             — is the substrate the project actually USES up?
 *     classify-failures — are ALL suite failures substrate errors (env), or are
 *                         some real test failures (code)?
 *   An agent runs this via Bash and RELAYS its JSON; the readiness verdict comes
 *   from code, mirroring coverage-oracle / fidelity-oracle (DEC-DEV-0073 §D.1: the
 *   Workflow script may not touch the FS / child_process — only an agent / a lib
 *   like this may).
 *
 * CONSERVATIVE BY DESIGN: a substrate the project does NOT use is `skipped`, never
 *   a readiness failure; readiness only drops to ENV_NOT_READY when a substrate the
 *   project clearly USES is DOWN (or its migration history is inconsistent —
 *   FB-LR-09). Probe uncertainty is `unknown`, which does NOT degrade readiness.
 *   The lib NEVER upgrades a verdict toward GO — it only blocks a false NO-GO.
 *
 * EXIT CODES: 0 ran ok (readiness/classification in JSON) · 2 usage/internal error.
 * Dual-use: `require()` it for the pure classifiers (unit-tested, no child_process);
 * run it as a CLI for the live probe.
 *
 * Node stdlib only; cross-platform.
 */

'use strict';

const fs = require('fs');
const cp = require('child_process');

const ENV_SCHEMA_VERSION = 1;

const READINESS = { READY: 'READY', DEGRADED: 'DEGRADED', ENV_NOT_READY: 'ENV_NOT_READY' };

// ---------------------------------------------------------------------------
// Substrate-error allowlist (work-order step 2). A suite failure line matching
// one of these is a SUBSTRATE error (the env was not ready), NOT a real test
// failure. Each entry is labelled so the relayed JSON + the wiring test can name
// which substrate was down. Keep this the single source of truth for the
// allowlist — both modes and the unit test read it.
// ---------------------------------------------------------------------------
const SUBSTRATE_ALLOWLIST = [
  { label: 'postgres-init', re: /PrismaClientInitializationError/i },
  { label: 'db-refused', re: /ECONNREFUSED[^\n]*(?::5432|\b5432\b)/i },
  { label: 'redis-refused', re: /ECONNREFUSED[^\n]*(?::6379|\b6379\b)/i },
  { label: 'redis-down', re: /redis[^\n]*(?:ECONNREFUSED|ETIMEDOUT|connection is closed|stream isn't writeable)/i },
  { label: 'db-unreachable', re: /(?:Can't reach database server|P1001|database system is starting up)/i },
  { label: 'docker-daemon', re: /Cannot connect to the Docker daemon/i },
  { label: 'docker-npipe', re: /\\\\\.\\pipe\\docker_engine|\bnpipe:\/\//i },
  { label: 'host-unresolved', re: /getaddrinfo (?:ENOTFOUND|EAI_AGAIN)/i },
];

/**
 * Classify a list of suite-failure strings against the substrate allowlist.
 * all_substrate is true ONLY when there is ≥1 failure and EVERY failure is a
 * substrate error → a RED suite that is an env artifact, not code. A single real
 * failure flips all_substrate to false (conservative: never mask a code defect).
 */
function classifyFailures(failures) {
  const list = (failures || []).map((f) => String(f)).filter((s) => s.trim());
  const substrate = [];
  const real = [];
  for (const line of list) {
    const hit = SUBSTRATE_ALLOWLIST.find((a) => a.re.test(line));
    if (hit) substrate.push({ line, substrate: hit.label });
    else real.push(line);
  }
  return {
    total: list.length,
    substrate_failures: substrate,
    real_failures: real,
    all_substrate: list.length > 0 && real.length === 0,
    allowlist: SUBSTRATE_ALLOWLIST.map((a) => a.label),
  };
}

/**
 * Derive the readiness verdict from a set of substrate checks. ENV_NOT_READY if
 * any USED substrate is down or its migration history is inconsistent (FB-LR-09);
 * else READY. DEGRADED is NOT decided here — it is the caller's axis (P5 upstream
 * blocked tasks), folded in by the consumer.
 */
function classifyReadiness(checks) {
  const notReady = (checks || []).filter((c) => c.status === 'down' || c.status === 'inconsistent');
  if (notReady.length) {
    return {
      readiness: READINESS.ENV_NOT_READY,
      reasons: notReady.map((c) => `${c.name}: ${c.detail || c.status}`),
    };
  }
  return { readiness: READINESS.READY, reasons: [] };
}

// ---------------------------------------------------------------------------
// CLI probe (only runs in CLI mode — child_process lives here, never on require)
// ---------------------------------------------------------------------------
function has(file) {
  try { return !!file && fs.existsSync(file); } catch (_e) { return false; }
}

function firstExisting(candidates) {
  return candidates.find(has) || null;
}

function tryRun(cmd, cmdArgs) {
  try {
    const r = cp.spawnSync(cmd, cmdArgs, { encoding: 'utf8', timeout: 20000, windowsHide: true });
    if (r.error) return { ran: false, ok: false, detail: r.error.code === 'ENOENT' ? 'tool-not-installed' : r.error.message };
    const out = `${r.stdout || ''}${r.stderr || ''}`.replace(/\s+/g, ' ').trim();
    return { ran: true, ok: r.status === 0, status: r.status, detail: out.slice(0, 240) };
  } catch (e) {
    return { ran: false, ok: false, detail: e.message };
  }
}

function probe(opts) {
  const checks = [];

  // 1) Docker daemon (only if the project ships a compose file, unless forced)
  const compose = opts.compose || firstExisting([
    'docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml',
  ]);
  if (opts.docker !== false && compose) {
    const di = tryRun('docker', ['info', '--format', '{{.ServerVersion}}']);
    if (!di.ran) checks.push({ name: 'docker-daemon', status: 'skipped', detail: di.detail });
    else checks.push({ name: 'docker-daemon', status: di.ok ? 'up' : 'down', detail: di.ok ? `server ${di.detail}` : (di.detail || 'docker info failed') });
  } else {
    checks.push({ name: 'docker-daemon', status: 'skipped', detail: 'no compose file detected' });
  }

  // 2) Postgres (only if a DB is in play: prisma schema or compose or --db-port)
  const prismaSchema = opts.prismaSchema || firstExisting(['prisma/schema.prisma']);
  const usesDb = !!opts.dbPort || !!prismaSchema || !!compose;
  if (opts.db !== false && usesDb) {
    const pg = tryRun('pg_isready', ['-h', opts.dbHost || '127.0.0.1', '-p', String(opts.dbPort || 5432)]);
    if (!pg.ran) checks.push({ name: 'postgres', status: 'skipped', detail: 'pg_isready not installed' });
    else checks.push({ name: 'postgres', status: pg.ok ? 'up' : 'down', detail: pg.detail || `pg_isready :${opts.dbPort || 5432}` });
  }

  // 3) Redis (only if --redis-port or compose mentions redis)
  const usesRedis = !!opts.redisPort || (compose && /redis/i.test((() => { try { return fs.readFileSync(compose, 'utf8'); } catch (_e) { return ''; } })()));
  if (opts.redis !== false && usesRedis) {
    const rc = tryRun('redis-cli', ['-p', String(opts.redisPort || 6379), 'ping']);
    if (!rc.ran) checks.push({ name: 'redis', status: 'skipped', detail: 'redis-cli not installed' });
    else checks.push({ name: 'redis', status: rc.ok && /PONG/i.test(rc.detail) ? 'up' : 'down', detail: rc.detail || `ping :${opts.redisPort || 6379}` });
  }

  // 4) Migration-history integrity (FB-LR-09): a substrate can be "up" yet its
  //    migration history be out of sync — an implementer then does an ad-hoc
  //    `prisma migrate resolve` inside an impl task. Codify it as a readiness gate.
  if (opts.migrations !== false && prismaSchema) {
    const ms = tryRun('npx', ['--no-install', 'prisma', 'migrate', 'status', '--schema', prismaSchema]);
    if (!ms.ran) checks.push({ name: 'migrations', status: 'skipped', detail: 'prisma not runnable (--no-install)' });
    else if (ms.ok) checks.push({ name: 'migrations', status: 'up', detail: 'history consistent' });
    else if (/P1001|Can't reach database|ECONNREFUSED/i.test(ms.detail)) checks.push({ name: 'migrations', status: 'down', detail: 'cannot reach DB for migrate status' });
    else if (/not yet been applied|drift|not in sync|pending migration/i.test(ms.detail)) checks.push({ name: 'migrations', status: 'inconsistent', detail: 'migration history not in sync (FB-LR-09)' });
    else checks.push({ name: 'migrations', status: 'unknown', detail: ms.detail.slice(0, 160) });
  }

  const verdict = classifyReadiness(checks);
  return {
    env_schema_version: ENV_SCHEMA_VERSION,
    mode: 'probe',
    readiness: verdict.readiness,
    reasons: verdict.reasons,
    checks,
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const a = { docker: undefined, db: undefined, redis: undefined, migrations: undefined };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i += 1) {
    const t = rest[i];
    const next = () => rest[(i += 1)];
    switch (t) {
      case '--help': case '-h': a.help = true; break;
      case '--failures': a.failures = next(); break;
      case '--compose': a.compose = next(); break;
      case '--prisma-schema': a.prismaSchema = next(); break;
      case '--db-host': a.dbHost = next(); break;
      case '--db-port': a.dbPort = next(); break;
      case '--redis-port': a.redisPort = next(); break;
      case '--no-docker': a.docker = false; break;
      case '--no-db': a.db = false; break;
      case '--no-redis': a.redis = false; break;
      case '--no-migrations': a.migrations = false; break;
      default: break;
    }
  }
  return a;
}

function printHelp() {
  process.stdout.write([
    'env-readiness.cjs — substrate-readiness probe + suite-failure classifier',
    '',
    'PROBE (default):  node env-readiness.cjs [--compose f] [--prisma-schema f] [--db-port N] [--redis-port N] [--no-db ...]',
    '  → JSON { readiness: READY|ENV_NOT_READY, checks:[{name,status,detail}], reasons:[] }',
    '',
    'CLASSIFY FAILURES: node env-readiness.cjs --failures <file-with-one-failure-per-line>',
    '  → JSON { all_substrate: bool, substrate_failures, real_failures, allowlist }',
    '  all_substrate=true ⇒ a RED suite that is an env artifact, not code ⇒ readiness=ENV_NOT_READY.',
  ].join('\n') + '\n');
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) { printHelp(); process.exit(0); }

  let output;
  if (args.failures) {
    let raw;
    try { raw = fs.readFileSync(args.failures, 'utf8'); } catch (e) {
      console.error(`ERROR: cannot read --failures file: ${e.message}`); process.exit(2);
    }
    const lines = raw.replace(/\r\n/g, '\n').split('\n').map((s) => s.trim()).filter(Boolean);
    output = { env_schema_version: ENV_SCHEMA_VERSION, mode: 'classify-failures', ...classifyFailures(lines) };
  } else {
    output = probe(args);
  }
  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = {
  ENV_SCHEMA_VERSION,
  READINESS,
  SUBSTRATE_ALLOWLIST,
  classifyFailures,
  classifyReadiness,
  probe,
};
