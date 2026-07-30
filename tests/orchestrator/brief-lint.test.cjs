'use strict';
/**
 * Contract test for orchestrator/lib/brief-lint.cjs.
 *
 * Canonizes ENFORCEMENT_PLAN pack 3 (DEC-DEV-0232) — the deterministic conductor-brief
 * linter. The contract in one line: A BRIEF THAT CHANGES A FEATURE'S CODE MUST NAME
 * THAT FEATURE'S GATE. The regression fixtures below are the literal cut shapes
 * catalogued by lesson I8_FIDELITY:
 *
 *   K3 (#1, the P21 brief) — "реализуй … закоммить" + a green deploy, no P6 anywhere.
 *   K2 (#3)                — a new feature built with no handoff → P3 → P5 layer.
 *   K1 (#4)                — a downstream `.kiro/` spec edited past the `.product/` SSOT.
 *   I-8 (#5)               — the executor ordered to stop asking questions.
 *
 * The rest lock in the ANTI-NOISE contract (doc fixes, recon briefs and pre-decided
 * answers must NOT fail) and the auditable owner escape — because a gate that cries
 * wolf gets switched off, and an escape that is invisible is not an escape but a hole.
 *
 * Node stdlib only; run with `node tests/orchestrator/brief-lint.test.cjs`.
 */

const assert = require('node:assert');

const {
  lintBrief,
  findCodeMarkers,
  hasGateName,
  hasPipelineName,
  rulesForSanctionToken,
  RULES,
  BRIEF_LINT_SCHEMA_VERSION,
} = require('../../orchestrator/lib/brief-lint.cjs');

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

/** Finding rule-ids of a report, in report order. */
const ids = (report) => report.findings.map((f) => f.id);
const names = (report) => report.findings.map((f) => f.rule);

// ---------- inline fixtures (real brief shapes from RUN-B) ----------

// #1 — the P21 brief verbatim in shape: feature code work, zero gate named.
const BRIEF_P21 = [
  'Доработай FM-005: реализуй forward-гард в middleware, закоммить.',
  'Затем deploy-to-stage → UJA PASS 7/7.',
].join('\n');

// #2 — the s31 reference brief: same work class, gate named explicitly.
const BRIEF_S31 = [
  'Доработай FM-012: реализуй ретрай-политику по BR-003.',
  'Закрывающий гейт — validate-feature-impl (полный брекет P6), без срезов.',
].join('\n');

const BRIEF_NEW_FEATURE_BYPASS = 'Построй новую фичу экспорта отчётов с нуля, напиши код и прогони тесты.';

const BRIEF_NEW_FEATURE_CANON = [
  'Построй новую фичу экспорта отчётов с нуля, напиши код.',
  'Путь канона: через product:handoff → P3 (batch-features-to-cc-sdd) → P5 (feature-to-tdd-impl).',
].join('\n');

const BRIEF_KIRO_BYPASS = 'Поправь требование в .kiro/specs/auth/requirements.md — таймаут сессии 30 мин.';

const BRIEF_KIRO_VIA_SSOT = [
  'Поправь требование в .kiro/specs/auth/requirements.md — таймаут сессии 30 мин.',
  'Сначала амендмент, после — регенерируй из .product/ (downstream перегенерить целиком).',
].join('\n');

const BRIEF_SUPPRESSION = [
  'Доработай FM-007: реализуй фильтр по владельцу.',
  'Гейт: validate-feature-impl. И не задавай вопросов, работай молча.',
].join('\n');

const BRIEF_PREDECIDED = [
  'Предрешения: ответы владельца ниже — эти развилки уже решены, поднимать заново не нужно.',
  'Всё, что вне списка предрешений, — эскалируй как обычно.',
].join('\n');

const BRIEF_REMEDIATION_FULL = [
  'REMEDIATION-RUN FM-021: догон канона по уже сделанной работе.',
  '1) handoff восстановить из кода; 2) audit-spec-fidelity (P4); 3) validate-feature-impl (P6).',
].join('\n');

const BRIEF_REMEDIATION_PARTIAL = [
  'REMEDIATION-RUN FM-021: догон канона по уже сделанной работе.',
  '1) handoff восстановить из кода; 2) validate-feature-impl (P6).',
].join('\n');

const BRIEF_RECON = 'Сними состояние пилота read-only, верни отчёт: ветки, грязь, последние 5 коммитов.';

const BRIEF_DOC_FIX = 'Фикс опечатки в README: «экосистемы» вместо «экосистеммы».';

console.log('brief-lint contract test (DEC-DEV-0232 pack 3 / I8_FIDELITY K1-K2-K3)');

// 1 — K3 REGRESSION: the P21 brief must FAIL
test('#1 P21: FM-005 + «реализуй/закоммить», ни одного гейта → FAIL R1 (K3)', () => {
  const r = lintBrief(BRIEF_P21);
  assert.strictEqual(r.verdict, 'FAIL', 'code work without a gate must FAIL');
  assert.deepStrictEqual(ids(r), ['R1'], 'exactly one finding, and it is R1');
  assert.strictEqual(r.findings[0].rule, 'code-without-gate', 'stable rule name');
  assert.strictEqual(r.findings[0].cls, 'K3', 'cut class K3');
  assert.match(r.findings[0].evidence, /реализуй/, 'evidence quotes the offending line');
  assert.match(r.findings[0].hint, /validate-feature-impl/, 'hint names the missing gate');
  assert.strictEqual(r.schema_version, BRIEF_LINT_SCHEMA_VERSION, 'schema version stamped');
  assert.deepStrictEqual(r.stats, { rules_checked: RULES.length, sanctioned: 0 }, 'no sanctions in play');
});

// 2 — the reference shape: same work, gate named → PASS
test('#2 s31: тот же класс работы + «validate-feature-impl (полный брекет P6)» → PASS', () => {
  const r = lintBrief(BRIEF_S31);
  assert.strictEqual(r.verdict, 'PASS', 'naming the gate clears the linter');
  assert.deepStrictEqual(r.findings, [], 'no findings at all');
  assert.strictEqual(hasGateName(BRIEF_S31), true, 'gate detector sees it');
  assert.strictEqual(hasGateName(BRIEF_P21), false, 'and does NOT hallucinate one in P21');
});

// 3 — K2: a new feature with no spec layer
test('#3 K2: новая фича «с нуля» + «напиши код» без handoff/P3/P5 → FAIL R2', () => {
  const bad = lintBrief(BRIEF_NEW_FEATURE_BYPASS);
  assert.strictEqual(bad.verdict, 'FAIL', 'building past the spec layer must FAIL');
  assert.deepStrictEqual(ids(bad), ['R2'], 'exactly R2 — R1 stays silent (no FM id in the brief)');
  assert.strictEqual(bad.findings[0].cls, 'K2', 'cut class K2');

  const good = lintBrief(BRIEF_NEW_FEATURE_CANON);
  assert.strictEqual(good.verdict, 'PASS', 'the canonical path clears it');
  assert.strictEqual(hasPipelineName(BRIEF_NEW_FEATURE_CANON), true, 'pipeline detector sees handoff/P3/P5');
  assert.strictEqual(hasPipelineName(BRIEF_NEW_FEATURE_BYPASS), false, 'and nothing in the bypass brief');
});

// 4 — K1: downstream spec edited past the SSOT
test('#4 K1: правка .kiro/ без упоминания .product/ → FAIL R3; с регенерацией из .product/ → PASS', () => {
  const bad = lintBrief(BRIEF_KIRO_BYPASS);
  assert.strictEqual(bad.verdict, 'FAIL', 'amendment past the SSOT must FAIL');
  assert.deepStrictEqual(ids(bad), ['R3'], 'exactly R3');
  assert.strictEqual(bad.findings[0].cls, 'K1', 'cut class K1');
  assert.match(bad.findings[0].evidence, /\.kiro\//, 'evidence quotes the downstream path');

  const good = lintBrief(BRIEF_KIRO_VIA_SSOT);
  assert.strictEqual(good.verdict, 'PASS', 'naming .product/ clears R3');
});

// 5 — I-8: the right to ask is not the conductor's to revoke
test('#5 I-8: «не задавай вопросов» → FAIL R4; «предрешения: ответы владельца» → PASS', () => {
  const bad = lintBrief(BRIEF_SUPPRESSION);
  assert.strictEqual(bad.verdict, 'FAIL', 'question suppression must FAIL');
  assert.deepStrictEqual(ids(bad), ['R4'], 'only R4 — the gate IS named, so R1 is silent');
  assert.strictEqual(bad.findings[0].cls, 'I-8', 'class I-8');

  const good = lintBrief(BRIEF_PREDECIDED);
  assert.strictEqual(good.verdict, 'PASS', 'pre-decided answers are legal narrowing, not suppression');
  assert.deepStrictEqual(good.findings, [], 'no findings');
});

// 6 — B2: a remediation run must walk all three legs
test('#6 B2: REMEDIATION-RUN со всеми тремя ногами → PASS; без audit-spec-fidelity/P4 → FAIL R5', () => {
  const full = lintBrief(BRIEF_REMEDIATION_FULL);
  assert.strictEqual(full.verdict, 'PASS', 'complete remediation passes');

  const partial = lintBrief(BRIEF_REMEDIATION_PARTIAL);
  assert.strictEqual(partial.verdict, 'FAIL', 'a missing leg must FAIL');
  assert.deepStrictEqual(ids(partial), ['R5'], 'exactly R5');
  assert.match(partial.findings[0].hint, /audit-spec-fidelity/, 'the missing leg is named in the hint');
  assert.doesNotMatch(partial.findings[0].hint, /не называет: handoff/, 'present legs are not reported missing');
});

// 7 — the owner escape: sanctioned, auditable, and never silent without a reason
test('#7 санкция: SANCTION(R1) с причиной → PASS + sanctions[]; без причины → FAIL (R1 остаётся)', () => {
  const sanctioned = lintBrief(`${BRIEF_P21}\nSANCTION(R1): владелец разрешил хотфикс без гейта, PR #250`);
  assert.strictEqual(sanctioned.verdict, 'PASS', 'a direct owner sanction narrows legitimately');
  assert.deepStrictEqual(sanctioned.findings, [], 'R1 moved out of findings');
  assert.strictEqual(sanctioned.sanctions.length, 1, 'the escape is recorded');
  assert.strictEqual(sanctioned.sanctions[0].rule, 'R1', 'which rule was waived');
  assert.match(sanctioned.sanctions[0].reason, /PR #250/, 'with the owner reason verbatim');
  assert.strictEqual(sanctioned.sanctions[0].applied, true, 'and it took effect');
  assert.deepStrictEqual(
    sanctioned.stats,
    { rules_checked: RULES.length - 1, sanctioned: 1 },
    'stats account for the waived rule'
  );

  const empty = lintBrief(`${BRIEF_P21}\nSANCTION(R1):`);
  assert.strictEqual(empty.verdict, 'FAIL', 'an unexplained escape does not work');
  assert.ok(names(empty).includes('sanction-without-reason'), 'the empty sanction is itself a finding');
  assert.ok(names(empty).includes('code-without-gate'), 'and R1 still fires');
  assert.strictEqual(empty.sanctions[0].applied, false, 'recorded as not applied');
  assert.strictEqual(empty.stats.sanctioned, 0, 'nothing was actually waived');

  // Class- and name-addressed sanctions resolve to the same rule.
  assert.deepStrictEqual(rulesForSanctionToken('K3').map((r) => r.id), ['R1'], 'by cut class');
  assert.deepStrictEqual(rulesForSanctionToken('code-without-gate').map((r) => r.id), ['R1'], 'by rule name');
  assert.deepStrictEqual(rulesForSanctionToken('R9'), [], 'unknown token addresses nothing');
  const bogus = lintBrief(`${BRIEF_P21}\nSANCTION(R9): опечатка в номере правила`);
  assert.strictEqual(bogus.verdict, 'FAIL', 'a mistyped sanction makes the gate stricter, never looser');
  assert.strictEqual(bogus.sanctions[0].applied, false, 'and is reported as not applied');
});

// 8 — recon briefs carry neither an FM id nor code markers: silence by construction
test('#8 recon: «сними состояние read-only, верни отчёт» → PASS без findings', () => {
  const r = lintBrief(BRIEF_RECON);
  assert.strictEqual(r.verdict, 'PASS', 'observe/harvest work is not code work');
  assert.deepStrictEqual(r.findings, [], 'no findings');
  assert.deepStrictEqual(findCodeMarkers(BRIEF_RECON), [], '«коммитов» is not a code marker');
});

// 9 — CRLF input is folded before anything else runs
test('#9 CRLF: \\r\\n-вход даёт отчёт, идентичный LF', () => {
  const lf = lintBrief(BRIEF_P21);
  const crlf = lintBrief(BRIEF_P21.replace(/\n/g, '\r\n'));
  assert.deepStrictEqual(crlf, lf, 'byte-identical verdict, findings and evidence');
  assert.doesNotMatch(crlf.findings[0].evidence, /\r/, 'no carriage return leaks into evidence');
});

// 10 — ANTI-NOISE: `фикс` alone is not code work (a noisy gate is a dead gate)
test('#10 анти-шум: «фикс опечатки в README» → PASS; «фикс в src/app.ts» → code-marker', () => {
  const r = lintBrief(BRIEF_DOC_FIX);
  assert.strictEqual(r.verdict, 'PASS', 'doc fixes must never trip the code rules');
  assert.deepStrictEqual(findCodeMarkers(BRIEF_DOC_FIX), [], 'guarded marker suppressed without FM/code path');
  const guarded = findCodeMarkers('Фикс в src/app.ts — регресс на пустом теле.');
  assert.deepStrictEqual(guarded.map((m) => m.id), ['фикс/почини'], 'a code path unlocks the guarded marker');
  assert.deepStrictEqual(
    findCodeMarkers('Почини FM-030 — падает на пустом вводе.').map((m) => m.id),
    ['фикс/почини'],
    'an FM id unlocks it too'
  );
});

console.log(`\n${passed} test(s) passed${process.exitCode ? ' — SOME FAILED' : ''}`);
if (process.exitCode) process.exit(process.exitCode);
