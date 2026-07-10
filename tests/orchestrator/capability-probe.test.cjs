'use strict';
/**
 * Unit test for the Orchestrator capability-probe lib (DEC-DEV-0117) — the §6
 * detect-leg. The CLI's FS/env reads are environment-dependent and NOT unit-tested
 * here; the PURE functions are — they are the deterministic heart the detect-leg's
 * correctness rides on:
 *   - extractManifest(): pull the optional `external_capabilities` list from
 *     frontmatter; ABSENT ⇒ [] (backward-compat, old features behave 1:1).
 *   - parseManifestItem(): tolerant flow-mapping parse.
 *   - dispositionFor(): present ⇒ SATISFIED; absent+stand-in ⇒ DEFERRED; absent+
 *     no stand-in ⇒ BLOCK; undecided provider ⇒ provider_choice_pending (OD8). The
 *     disposition is DETERMINISTIC from the manifest, NOT a heuristic (defuses the
 *     dead-/noisy-rule risk of DEC-DEV-0081 / the S7 brief).
 *   - surface(): SATISFIED is not surfaced; access routes Integrator, provider
 *     choice routes Product.
 *
 * Node stdlib only; run with `node tests/orchestrator/capability-probe.test.cjs`.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const lib = require(path.join(__dirname, '..', '..', 'orchestrator', 'lib', 'capability-probe.cjs'));
const { parseManifestItem, extractManifest, dispositionFor, surface, summarize, parseEnvFileText, envPresence, DISPOSITION, ROUTE } = lib;

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('  ✓', name);
  } catch (e) {
    console.error('  ✗', name, '\n      ', e.message);
    process.exitCode = 1;
  }
}

console.log('orchestrator capability-probe — §6 detect-leg pure functions (DEC-DEV-0117)');

test('exports the contract surface', () => {
  assert.ok(typeof extractManifest === 'function', 'extractManifest missing');
  assert.ok(typeof dispositionFor === 'function', 'dispositionFor missing');
  assert.ok(typeof surface === 'function', 'surface missing');
  assert.deepStrictEqual(
    { ...DISPOSITION },
    { SATISFIED: 'SATISFIED', EXPECTED_ABSENT_BUT_DEFERRED: 'EXPECTED_ABSENT_BUT_DEFERRED', BLOCK: 'BLOCK' },
    'disposition enum drifted',
  );
});

test('parseManifestItem parses a YAML flow-mapping, stripping quotes', () => {
  const it = parseManifestItem('{ capability: machine-translation, secret_env: DEEPL_API_KEY, provider: "DeepL", tier: prod, dev_stand_in: Mock }');
  assert.strictEqual(it.capability, 'machine-translation');
  assert.strictEqual(it.secret_env, 'DEEPL_API_KEY');
  assert.strictEqual(it.provider, 'DeepL');
  assert.strictEqual(it.tier, 'prod');
  assert.strictEqual(it.dev_stand_in, 'Mock');
});

test('extractManifest: ABSENT key ⇒ [] (backward-compat — old features behave 1:1)', () => {
  const fm = 'id: FM-001\ntitle: "Auth"\nstatus: in-progress\n';
  assert.deepStrictEqual(extractManifest(fm), []);
});

test('extractManifest: empty list (external_capabilities: []) ⇒ []', () => {
  assert.deepStrictEqual(extractManifest('id: FM-001\nexternal_capabilities: []\nstatus: x\n'), []);
});

test('extractManifest: pulls a block list and stops at the next top-level key', () => {
  const fm = [
    'id: FM-002',
    'external_capabilities:',
    '  - { capability: machine-translation, secret_env: DEEPL_API_KEY, provider: DeepL, tier: prod, dev_stand_in: Mock }',
    '  - { capability: text-to-speech, secret_env: ELEVENLABS_API_KEY, provider: TBD, tier: prod, dev_stand_in: Mock }',
    'status: in-progress',
    'version: 4',
  ].join('\n');
  const items = extractManifest(fm);
  assert.strictEqual(items.length, 2, 'should extract exactly the two list items');
  assert.strictEqual(items[0].secret_env, 'DEEPL_API_KEY');
  assert.strictEqual(items[1].provider, 'TBD');
});

test('dispositionFor: present secret ⇒ SATISFIED', () => {
  const d = dispositionFor({ secret_env: 'DEEPL_API_KEY', dev_stand_in: 'Mock' }, true);
  assert.strictEqual(d.disposition, DISPOSITION.SATISFIED);
  assert.strictEqual(d.provider_choice_pending, false);
});

test('dispositionFor: absent + dev stand-in ⇒ EXPECTED_ABSENT_BUT_DEFERRED (tracking, non-blocking)', () => {
  const d = dispositionFor({ secret_env: 'DEEPL_API_KEY', provider: 'DeepL', tier: 'prod', dev_stand_in: 'Mock' }, false);
  assert.strictEqual(d.disposition, DISPOSITION.EXPECTED_ABSENT_BUT_DEFERRED);
});

test('dispositionFor: absent + NO stand-in ⇒ BLOCK (real access needed; OD7 await is the deferred leg)', () => {
  const d = dispositionFor({ secret_env: 'STRIPE_SECRET_KEY', provider: 'Stripe', tier: 'prod', dev_stand_in: '' }, false);
  assert.strictEqual(d.disposition, DISPOSITION.BLOCK);
});

test('dispositionFor: undecided provider (TBD) ⇒ provider_choice_pending (route Product / OD8)', () => {
  const d = dispositionFor({ secret_env: 'TTS_API_KEY', provider: 'TBD', dev_stand_in: 'Mock' }, false);
  assert.strictEqual(d.provider_choice_pending, true);
  assert.strictEqual(d.disposition, DISPOSITION.EXPECTED_ABSENT_BUT_DEFERRED, 'access axis and choice axis are orthogonal');
});

test('surface: SATISFIED is not surfaced; env presence comes from the injected predicate', () => {
  const items = [{ capability: 'mt', secret_env: 'DEEPL_API_KEY', provider: 'DeepL', tier: 'prod', dev_stand_in: 'Mock' }];
  const present = surface(items, (n) => n === 'DEEPL_API_KEY');
  assert.strictEqual(present[0].disposition, DISPOSITION.SATISFIED);
  assert.strictEqual(present[0].surface, false, 'a satisfied capability must not be surfaced');
});

test('surface: a BLOCK routes Integrator; a deferred+TBD routes both Integrator and Product', () => {
  const items = [
    { capability: 'billing', secret_env: 'STRIPE_SECRET_KEY', provider: 'Stripe', tier: 'prod', dev_stand_in: '' },
    { capability: 'tts', secret_env: 'TTS_API_KEY', provider: 'TBD', tier: 'prod', dev_stand_in: 'Mock' },
  ];
  const s = surface(items, () => false);   // nothing in env
  assert.strictEqual(s[0].disposition, DISPOSITION.BLOCK);
  assert.deepStrictEqual(s[0].routes, [ROUTE.INTEGRATOR]);
  assert.ok(s[0].surface, 'a BLOCK must surface');
  assert.strictEqual(s[1].disposition, DISPOSITION.EXPECTED_ABSENT_BUT_DEFERRED);
  assert.deepStrictEqual(s[1].routes, [ROUTE.INTEGRATOR, ROUTE.PRODUCT], 'deferred + undecided provider routes both');
});

test('surface: env_source discloses WHICH source satisfied the secret (DEC-DEV-0174, DEF-OD7-1)', () => {
  const items = [
    { capability: 'llm', secret_env: 'OPENAI_API_KEY', provider: 'OpenAI', tier: 'prod', dev_stand_in: '' },
    { capability: 'billing', secret_env: 'STRIPE_SECRET_KEY', provider: 'Stripe', tier: 'prod', dev_stand_in: '' },
  ];
  // a source-labelled predicate (what envPresence returns): the first secret sits in `.env`
  const s = surface(items, (n) => (n === 'OPENAI_API_KEY' ? '.env' : false));
  assert.strictEqual(s[0].present, true, 'a dotenv-sourced secret is PRESENT (no false-positive BLOCK)');
  assert.strictEqual(s[0].disposition, DISPOSITION.SATISFIED);
  assert.strictEqual(s[0].env_source, '.env', 'env_source carries the satisfying source');
  assert.ok(/\.env/.test(s[0].rationale), 'the rationale discloses the source');
  assert.strictEqual(s[1].env_source, null, 'an absent secret has no env_source');
  // a plain-boolean predicate (old injected style) keeps working and reads as process-env
  const b = surface([items[0]], (n) => n === 'OPENAI_API_KEY');
  assert.strictEqual(b[0].present, true);
  assert.strictEqual(b[0].env_source, 'process-env');
});

test('parseEnvFileText: dotenv-lite — comments/blank/export tolerated, quotes stripped, empty value ≠ presence', () => {
  const vars = parseEnvFileText([
    '# a comment',
    '',
    'OPENAI_API_KEY=sk-proj-abc123',
    'export QUOTED="with spaces"',
    "SINGLE='single'",
    'EMPTY=',
    'ALSO_EMPTY=""',
    'not a var line',
    '1BAD=starts-with-digit',
  ].join('\n'));
  assert.strictEqual(vars.OPENAI_API_KEY, 'sk-proj-abc123');
  assert.strictEqual(vars.QUOTED, 'with spaces');
  assert.strictEqual(vars.SINGLE, 'single');
  assert.ok(!('EMPTY' in vars), 'an empty assignment is not presence');
  assert.ok(!('ALSO_EMPTY' in vars), 'an empty quoted assignment is not presence');
  assert.ok(!('1BAD' in vars), 'an invalid key is skipped');
});

test('envPresence: process.env wins, then .env, then .env.local; absent everywhere ⇒ false (FS-level)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'capprobe-'));
  fs.writeFileSync(path.join(root, '.env'), 'FROM_DOTENV=x\nSHADOWED=file-value\n');
  fs.writeFileSync(path.join(root, '.env.local'), 'FROM_LOCAL=y\n');
  process.env.SHADOWED = 'proc-value';
  try {
    const has = envPresence(root);
    assert.strictEqual(has('SHADOWED'), 'process-env', 'a live export wins over the file');
    assert.strictEqual(has('FROM_DOTENV'), '.env');
    assert.strictEqual(has('FROM_LOCAL'), '.env.local');
    assert.strictEqual(has('NOWHERE_TO_BE_FOUND'), false);
  } finally {
    delete process.env.SHADOWED;
  }
});

test('summarize: counts blocking / deferred / satisfied + provider choices', () => {
  const items = [
    { capability: 'a', secret_env: 'A', provider: 'Stripe', dev_stand_in: '' },             // BLOCK (provider decided)
    { capability: 'b', secret_env: 'B', provider: 'DeepL', dev_stand_in: 'Mock' },          // DEFERRED (provider decided)
    { capability: 'c', secret_env: 'C', provider: 'TBD', dev_stand_in: 'Mock' },            // DEFERRED + choice pending
    { capability: 'd', secret_env: 'D', provider: 'AWS', dev_stand_in: 'Mock' },            // SATISFIED (env has D)
  ];
  const s = surface(items, (n) => n === 'D');
  const sum = summarize(s);
  assert.strictEqual(sum.blocking, 1);
  assert.strictEqual(sum.deferred, 2);
  assert.strictEqual(sum.satisfied, 1);
  assert.strictEqual(sum.provider_choices, 1);
  assert.strictEqual(sum.surfaced, 3, 'only the non-satisfied are surfaced');
});

console.log(`\n${passed} check(s) passed${process.exitCode ? ' — SOME FAILED' : ''}`);
if (process.exitCode) process.exit(process.exitCode);
