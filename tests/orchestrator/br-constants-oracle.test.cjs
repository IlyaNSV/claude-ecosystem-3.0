'use strict';
/**
 * Contract test for orchestrator/lib/br-constants-oracle.cjs.
 *
 * Canonizes ENFORCEMENT_PLAN pack 2.1 (DEC-DEV-0231) — the deterministic CODE ↔ BR
 * numeric-constant oracle. The two regression cases below are the literal failure
 * shapes of the M16 causal probe (DEC-DEV-0229):
 *
 *   #1 TRUNCATED SCHEDULE — the BR declares an auto-retry schedule 15/30/60, the code
 *      implements only 15/30. Must surface as `mismatched`, never as a pass.
 *   #2 CAP ACCEPTED "AS THE CLIENT SAID IT" — the BR fixes a 180-minute video ceiling
 *      that no code constant claims. Must surface as `missing`, never as silence.
 *
 * The rest lock in the anti-noise contract (artifact ids / dates / §refs / step refs /
 * versions are NOT constants) — because a gate that cries wolf gets switched off.
 *
 * Node stdlib only; run with `node tests/orchestrator/br-constants-oracle.test.cjs`.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const {
  extractRuleBlocks,
  extractConstantsFromBlock,
  extractConstants,
  computeConstantsCheck,
  BR_CONSTANTS_SCHEMA_VERSION,
} = require('../../orchestrator/lib/br-constants-oracle.cjs');

const FIX = path.join(__dirname, '..', 'fixtures');
const readFix = (f) => fs.readFileSync(path.join(FIX, f), 'utf8');

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

// ---------- inline fixtures (no fixture files: these shapes are test-local) ----------

const BLOCK_BUDGET = [
  '### BR-001 — Минимальный бюджет кампании',
  '',
  'min_budget = 50',
].join('\n');

const BLOCK_RETRY = [
  '### BR-002 — Расписание авто-повторов',
  '',
  '- **retry_backoff:** 15/30/60',
  '',
  '**Statement:** Система повторяет отправку по расписанию (см. §4, шаг 2).',
].join('\n');

const BLOCK_VIDEO = [
  '### BR-003 — Ограничения видео',
  '',
  'Максимальная длительность ролика — 180 мин, размер файла до 25 MB.',
  'Для trial-аккаунта действует cap 30 мин.',
].join('\n');

const BLOCK_PREDICATE = [
  '### BR-004 — Границы бюджета',
  '',
  'Допустимо: budget >= 50 AND budget <= 100000.',
].join('\n');

const BLOCK_NOISE = [
  '### BR-005 — Ссылки без констант',
  '',
  'См. BR-010 и SC-005 шаг 3, §7.',
  'created: 2026-05-10',
  'version: 2',
].join('\n');

const BLOCK_LOCALE = [
  '### BR-006 — Тайминг',
  '',
  'Ролик длится 1,5 часа максимум.',
].join('\n');

const BLOCK_NAMED = [
  '### BR-007 — Ретраи',
  '',
  'Max Retries: 3',
].join('\n');

const HANDOFF_WITH_RULES = [
  '---',
  'id: HANDOFF-FM-042',
  'version: 1',
  'created: 2026-05-25',
  'max_retries: 99',
  '---',
  '',
  '## 5. Scenarios',
  '',
  '### SC-001 — Отправка',
  'Шагов 7 штук, таймаут 45 мин.',
  '',
  '## 6. Business Rules',
  '',
  BLOCK_BUDGET,
  '',
  BLOCK_RETRY,
  '',
  '## 7. Entity Lifecycles',
  '',
  'нет числовых констант',
].join('\n');

const HANDOFF_NO_SECTION_6 = [
  '---',
  'id: HANDOFF-FM-043',
  '---',
  '',
  '## 5. Scenarios',
  '',
  '### SC-001 — Пусто',
  'Всё укладывается в 42 минуты.',
].join('\n');

console.log('br-constants-oracle contract test (DEC-DEV-0231 pack 2.1 / M16 DEC-DEV-0229)');

// 1 — block cutting: preamble before the first ### BR- heading is ignored
test('extractRuleBlocks: two BR blocks, section preamble ignored', () => {
  const section = [
    'Преамбула секции: здесь 5 упоминаний и прочий текст.',
    '',
    '### BR-001 — Первое',
    'текст один',
    '',
    '### BR-002 — Второе',
    'текст два',
  ].join('\n');
  const blocks = extractRuleBlocks(section);
  assert.strictEqual(blocks.length, 2, 'exactly two blocks');
  assert.deepStrictEqual(blocks.map((b) => b.rule), ['BR-001', 'BR-002'], 'ordered rule ids');
  assert.match(blocks[0].text, /текст один/, 'first block keeps its body');
  assert.doesNotMatch(blocks[0].text, /Преамбула/, 'preamble is not absorbed into BR-001');
  assert.match(blocks[1].text, /текст два/, 'second block keeps its body');
});

// 2 — parameter line
test('parameter: `min_budget = 50` → one parameter constant', () => {
  const cs = extractConstantsFromBlock('BR-001', BLOCK_BUDGET);
  assert.strictEqual(cs.length, 1, 'exactly one constant');
  assert.strictEqual(cs[0].kind, 'parameter', 'kind=parameter');
  assert.strictEqual(cs[0].name, 'min_budget', 'name captured');
  assert.deepStrictEqual(cs[0].values, ['50'], 'value canonised');
  assert.strictEqual(cs[0].rule, 'BR-001', 'rule attached');
});

// 3 — parameter whose VALUE is a slash-list: one constant with three values
test('parameter: `- **retry_backoff:** 15/30/60` → ONE constant, values 15/30/60', () => {
  const cs = extractConstantsFromBlock('BR-002', BLOCK_RETRY);
  assert.strictEqual(cs.length, 1, 'whole-line consumption: no duplicate slash-list entry');
  assert.strictEqual(cs[0].kind, 'parameter', 'kind=parameter');
  assert.strictEqual(cs[0].name, 'retry_backoff', 'markdown bullet+bold tolerated');
  assert.deepStrictEqual(cs[0].values, ['15', '30', '60'], 'all three schedule steps');
});

// 4 — M16 REGRESSION #1: truncated retry schedule 15/30/60 → 15/30
test('M16 #1: code implements 15/30 of a 15/30/60 schedule → mismatched, passed=false', () => {
  const source = extractConstantsFromBlock('BR-002', BLOCK_RETRY);
  const check = computeConstantsCheck(source, [
    { rule: 'BR-002', name: 'retry_backoff', values: [15, 30], where: 'src/scheduler.ts:42' },
  ]);
  assert.strictEqual(check.passed, false, 'truncation must FAIL the gate');
  assert.strictEqual(check.mismatched.length, 1, 'one mismatch');
  assert.deepStrictEqual(check.mismatched[0].expected, ['15', '30', '60'], 'spec side');
  assert.deepStrictEqual(check.mismatched[0].found, ['15', '30'], 'code side');
  assert.strictEqual(check.mismatched[0].where, 'src/scheduler.ts:42', 'code coordinate relayed');
  assert.strictEqual(check.missing.length, 0, 'the constant was matched, not missing');
  assert.strictEqual(check.schema_version, BR_CONSTANTS_SCHEMA_VERSION, 'schema version stamped');
});

// 5 — M16 REGRESSION #2: the 180-min cap nobody claimed ("accepted as the client said it")
test('M16 #2: 180-min video cap with no code claim → missing, passed=false', () => {
  const source = extractConstantsFromBlock('BR-003', BLOCK_VIDEO);
  const check = computeConstantsCheck(source, [
    { rule: 'BR-003', raw: '25 MB', values: [25], where: 'src/upload.ts:8' },
    { rule: 'BR-003', raw: '30 мин', values: [30], where: 'src/trial.ts:11' },
  ]);
  assert.strictEqual(check.passed, false, 'an unclaimed spec ceiling must FAIL the gate');
  assert.strictEqual(check.missing.length, 1, 'exactly one unclaimed constant');
  assert.deepStrictEqual(check.missing[0].values, ['180'], 'the 180-minute ceiling');
  assert.strictEqual(check.missing[0].unit, 'мин', 'unit preserved');
  assert.strictEqual(check.matched.length, 2, 'the other two constants reconciled');
  assert.strictEqual(check.mismatched.length, 0, 'no value disagreements');
});

// 6 — number + unit
test('unit-number: `180 мин`, `25 MB`, `30 мин` extracted with units', () => {
  const cs = extractConstantsFromBlock('BR-003', BLOCK_VIDEO);
  assert.strictEqual(cs.length, 3, 'three unit-numbers');
  assert.deepStrictEqual(cs.map((c) => c.kind), ['unit-number', 'unit-number', 'unit-number'], 'all unit-number');
  assert.deepStrictEqual(cs.map((c) => c.values[0]), ['180', '25', '30'], 'values in document order');
  assert.deepStrictEqual(cs.map((c) => c.unit), ['мин', 'MB', 'мин'], 'units captured verbatim');
  assert.deepStrictEqual(cs.map((c) => c.name), [null, null, null], 'no name for unit-numbers');
  assert.ok(cs.every((c) => c.raw.length <= 120), 'raw fragments clipped to ≤120 chars');
});

// 7 — comparison predicates
test('predicate: `budget >= 50 AND budget <= 100000` → two predicate constants', () => {
  const cs = extractConstantsFromBlock('BR-004', BLOCK_PREDICATE);
  assert.strictEqual(cs.length, 2, 'two predicates');
  assert.deepStrictEqual(cs.map((c) => c.kind), ['predicate', 'predicate'], 'kind=predicate');
  assert.deepStrictEqual(cs.map((c) => c.values[0]), ['50', '100000'], 'both bounds');
  assert.match(cs[0].raw, />=\s*50/, 'operator kept in raw evidence');
});

// 8 — anti-noise: ids / dates / §refs / step refs / versions are NOT constants
test('noise: BR-010, SC-005 шаг 3, §7, created: 2026-05-10, version: 2 → zero constants', () => {
  const cs = extractConstantsFromBlock('BR-005', BLOCK_NOISE);
  assert.deepStrictEqual(cs, [], 'masking + frontmatter-name exclusion yield nothing');
});

// 9 — fabricated: claim on a rule that declares no constants
test('fabricated: claim for BR-999 → fabricated, passed=false', () => {
  const source = extractConstantsFromBlock('BR-001', BLOCK_BUDGET);
  const check = computeConstantsCheck(source, [
    { rule: 'BR-001', name: 'min_budget', values: [50] },
    { rule: 'BR-999', name: 'ghost_limit', values: [5], where: 'src/ghost.ts:1' },
  ]);
  assert.strictEqual(check.fabricated.length, 1, 'one fabricated claim');
  assert.strictEqual(check.fabricated[0].rule, 'BR-999', 'the invented rule');
  assert.strictEqual(check.missing.length, 0, 'the real constant was claimed');
  assert.strictEqual(check.passed, false, 'fabrication FAILS the gate');
});

// 10 — extraneous: extra claim on a valid rule is reported but does NOT fail
test('extraneous: unmatched claim of a valid rule → reported, passed stays true', () => {
  const source = extractConstantsFromBlock('BR-001', BLOCK_BUDGET);
  const check = computeConstantsCheck(source, [
    { rule: 'BR-001', name: 'min_budget', values: [50] },
    { rule: 'BR-001', name: 'nonexistent_knob', values: [7], where: 'src/knob.ts:3' },
  ]);
  assert.strictEqual(check.extraneous.length, 1, 'the extra claim is surfaced');
  assert.strictEqual(check.extraneous[0].name, 'nonexistent_knob', 'which claim');
  assert.strictEqual(check.matched.length, 1, 'the real constant still reconciled');
  assert.strictEqual(check.passed, true, 'code may hold constants the BR never fixed');
});

// 11 — locale: decimal comma canonised to a dot
test('locale: `1,5 часа` → value "1.5"', () => {
  const cs = extractConstantsFromBlock('BR-006', BLOCK_LOCALE);
  assert.strictEqual(cs.length, 1, 'one constant');
  assert.deepStrictEqual(cs[0].values, ['1.5'], 'comma decimal canonised');
  assert.strictEqual(cs[0].unit, 'часа', 'unit captured');
});

// 12 — name matching is case- and whitespace-insensitive
test('name matching: `Max Retries` ↔ claim `max_retries` reconcile', () => {
  const source = extractConstantsFromBlock('BR-007', BLOCK_NAMED);
  assert.strictEqual(source[0].name, 'Max Retries', 'source name as written');
  const check = computeConstantsCheck(source, [
    { rule: 'BR-007', name: '  MAX_retries ', values: 3 },
  ]);
  assert.strictEqual(check.matched.length, 1, 'matched across case/space normalisation');
  assert.strictEqual(check.passed, true, 'scalar claim value accepted');
});

// 13 — a handoff without §6 is a legitimate shape, not an error
test('missing §6: constants_total=0 and empty claims → passed=true', () => {
  const constants = extractConstants(HANDOFF_NO_SECTION_6);
  assert.deepStrictEqual(constants, [], 'nothing extracted, no throw');
  const check = computeConstantsCheck(constants, []);
  assert.strictEqual(check.constants_total, 0, 'zero constants');
  assert.strictEqual(check.passed, true, 'vacuously passed');
});

// 14 — end-to-end: frontmatter stripped, only the requested section scanned
test('extractConstants: frontmatter + §5 noise excluded, §6 rules extracted', () => {
  const cs = extractConstants(HANDOFF_WITH_RULES);
  assert.strictEqual(cs.length, 2, 'only the two §6 constants');
  assert.deepStrictEqual(cs.map((c) => c.rule), ['BR-001', 'BR-002'], 'both rules, in order');
  assert.deepStrictEqual(cs.map((c) => c.name), ['min_budget', 'retry_backoff'], 'names');
  const flat = cs.flatMap((c) => c.values);
  assert.ok(!flat.includes('99'), 'frontmatter max_retries: 99 stripped');
  assert.ok(!flat.includes('45') && !flat.includes('7'), '§5 numbers not scanned');
});

// 15 — real handoff fixture: no false positives on prose-only Business Rules
test('FM-FIXTURE-001 §6 (prose-only BR-001): zero false-positive constants', () => {
  const cs = extractConstants(readFix('FM-FIXTURE-001-handoff.md'));
  assert.deepStrictEqual(cs, [], 'a BR with no numbers yields no constants');
});

console.log(`\n${passed} test(s) passed${process.exitCode ? ' — SOME FAILED' : ''}`);
if (process.exitCode) process.exit(process.exitCode);
