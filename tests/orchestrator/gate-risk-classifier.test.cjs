'use strict';
/**
 * Contract test for orchestrator/lib/gate-risk-classifier.cjs.
 *
 * Canonizes P0-2 (gate-risk-classifier) from Orchestrator dogfood RUN 01
 * (DEC-DEV-0068; design dev/ORCHESTRATOR_GATE_RISK_CLASSIFIER.md). The regression
 * lock is the design §6 validation table: the predicate MUST reproduce the human's
 * actual gate decisions — 16/17 without the M5 first-task rule, 17/17 with it. The
 * one design discrepancy (task 1.1 scaffold) is the M5 case and is asserted both ways.
 *
 * Also locks the key refinement (§3): an invariant enforced DECLARATIVELY (UNIQUE/
 * CHECK) is LOW, imperatively is HIGH — "touches an invariant" is not enough.
 *
 * Node stdlib only; run with `node tests/orchestrator/gate-risk-classifier.test.cjs`
 * or `npm run test:orchestrator:classifier`.
 */

const assert = require('node:assert');
const {
  classifyTask,
  deriveRegistry,
  parseTasks,
} = require('../../orchestrator/lib/gate-risk-classifier.cjs');

// load-bearing registry seed from design §5.3 (auth / FM-001), illustrative
const REG = {
  invariants: [
    { id: 'IC-001', enforcement: 'declarative' },  // email uniqueness — UNIQUE index
    { id: 'IC-002', enforcement: 'imperative' },    // token row-lock FOR UPDATE
    { id: 'IC-003', enforcement: 'imperative' },    // ≤5 sessions LRU
    { id: 'IC-004', enforcement: 'declarative' },   // field CHECK constraint
    { id: 'IC-006', enforcement: 'imperative' },    // atomic reset $transaction
    { id: 'BR-020', enforcement: 'imperative' },    // reset timing-jitter
  ],
};

const ctx = (over = {}) => ({ requirementText: '', registry: REG, isFirstTask: false, m5: true, ...over });
const tierOf = (task, over) => classifyTask(task, ctx(over)).tier;

let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log('  ✓', name); }
  catch (e) { console.error('  ✗', name, '\n      ', e.message); process.exitCode = 1; }
}

console.log('gate-risk-classifier contract test (DEC-DEV-0068 P0-2 — design §6 reproduction)');

// ---- design §6 validation table: 17 RUN 01 gate decisions ----
// Each fixture folds the resolved requirement text into `text` (the helper scans
// text+requirementText+boundary together, as the CLI does).
const TABLE = [
  // id,   expected, task
  ['4.3', 'HIGH', { text: 'implement consume( token ) shared primitive with FOR UPDATE row-lock', boundary: 'apps/api/src/modules/auth', requirements: ['IC-002'] }],
  ['4.4', 'HIGH', { text: 'SessionService with LRU eviction; safe-redirect after login', boundary: 'apps/api/src/modules/auth', requirements: ['IC-003'] }],
  ['4.5', 'HIGH', { text: 'CAPTCHA gate and constant-time anti-enumeration on login', boundary: 'apps/api/src/modules/auth', requirements: [] }],
  ['4.6', 'HIGH', { text: 'atomic reset: single $transaction, FOR UPDATE on token AND user; timing padTo 600ms', boundary: 'apps/api/src/modules/auth', requirements: ['IC-006', 'BR-020'] }],
  ['4.7', 'HIGH', { text: 'distrust-reset and OAuth login with CSRF state verification', boundary: 'apps/api/src/modules/auth', requirements: [], crossFm: true }],
  ['5.1', 'HIGH', { text: 'HTTP controller: secure cookie + CSRF token verify', boundary: 'apps/api/src/http', requirements: [] }],
  ['5.4', 'HIGH', { text: 'emit idempotent trial-started signal to billing', boundary: 'apps/api/src/modules/auth', requirements: [], crossFm: true }],
  ['1.2', 'LOW', { text: 'docker compose up postgres + redis stack', boundary: 'monorepo-scaffold', requirements: [] }],
  ['1.3', 'LOW', { text: 'prisma init; UNIQUE index on email_normalized; CHECK constraint on status', boundary: 'packages/db', requirements: ['IC-001'] }],
  ['2.1', 'LOW', { text: 'define Prisma models User, AuthToken; UNIQUE INDEX email_normalized; CHECK status schema migration', boundary: 'packages/db', requirements: ['IC-001', 'IC-004'] }],
  ['4.2', 'LOW', { text: 'scenario test: concurrent signup with same email is rejected by the unique index', boundary: 'apps/api/test/scenarios', requirements: ['IC-001'] }],
  ['5.2', 'LOW', { text: 'login and signup React pages', boundary: 'apps/web', requirements: [] }],
  ['5.3', 'LOW', { text: 'BullMQ worker wiring for async jobs', boundary: 'apps/worker', requirements: [] }],
  ['6.1', 'LOW', { text: 'unit tests for error envelope helper', boundary: 'packages/shared/__tests__', requirements: [] }],
  // 1.1 is the M5 case — asserted separately below (HIGH with M5, LOW without)
];

test('design §6: all 14 non-1.1 rows reproduce the human gate decision', () => {
  for (const [id, expected, task] of TABLE) {
    const got = tierOf({ id, ...task });
    assert.strictEqual(got, expected, `task ${id}: expected ${expected}, got ${got} (why: ${classifyTask({ id, ...task }, ctx()).why})`);
  }
});

// 1.1 scaffold — the single §6 discrepancy, resolved by M5 (variant A)
const scaffold = { id: '1.1', text: 'init monorepo pnpm workspaces; apps/{api,worker,web}; packages/{db,shared}', boundary: 'monorepo-scaffold', requirements: [] };
test('1.1 scaffold: HIGH with M5 (first-task rule) → 17/17', () => {
  assert.strictEqual(tierOf(scaffold, { isFirstTask: true, m5: true }), 'HIGH', 'M5 makes the first task HIGH');
  assert.deepStrictEqual(classifyTask(scaffold, ctx({ isFirstTask: true, m5: true })).why, ['M5-first-task']);
});
test('1.1 scaffold: LOW without M5 (the design 16/17 discrepancy, safe direction)', () => {
  assert.strictEqual(tierOf(scaffold, { isFirstTask: true, m5: false }), 'LOW', 'without M5 the predicate under-checks 1.1 — never a false-LOW on a load-bearing task');
});

// ---- key refinement §3: enforcement decides, not "touches an invariant" ----
test('declarative invariant (UNIQUE) → LOW; imperative (FOR UPDATE) → HIGH', () => {
  const decl = { id: 'd', text: 'add UNIQUE index migration', boundary: 'packages/db', requirements: ['IC-001'] };
  const imp = { id: 'i', text: 'consume token with FOR UPDATE row-lock', boundary: 'apps/api/src/modules/auth', requirements: ['IC-002'] };
  assert.strictEqual(tierOf(decl), 'LOW', 'declarative IC-001 stays LOW');
  assert.strictEqual(tierOf(imp), 'HIGH', 'imperative IC-002 is HIGH');
});

// ---- DEFAULT §8: uncertain → HIGH ----
test('uncertain task (no markers, no profile) → DEFAULT HIGH (confidence low)', () => {
  const v = classifyTask({ id: 'x', text: 'do the thing', boundary: 'somewhere/unknown', requirements: [] }, ctx());
  assert.strictEqual(v.tier, 'HIGH');
  assert.strictEqual(v.confidence, 'low');
  assert.strictEqual(v.default_applied, true);
});

// ---- registry derivation §5.1 ----
test('deriveRegistry: scans invariant text → imperative vs declarative', () => {
  const reg = deriveRegistry([
    { id: 'IC-006', text: 'atomic reset performed in a single $transaction with FOR UPDATE' },
    { id: 'IC-001', text: 'email uniqueness enforced by a UNIQUE index' },
  ]);
  const ic6 = reg.invariants.find((i) => i.id === 'IC-006');
  const ic1 = reg.invariants.find((i) => i.id === 'IC-001');
  assert.strictEqual(ic6.enforcement, 'imperative', 'IC-006 → imperative (M2)');
  assert.strictEqual(ic1.enforcement, 'declarative', 'IC-001 → declarative (UNIQUE, no markers)');
});
test('deriveRegistry: override wins over derivation', () => {
  const reg = deriveRegistry([{ id: 'IC-009', text: 'plain field' }], [{ id: 'IC-009', enforcement: 'imperative' }]);
  assert.strictEqual(reg.invariants.find((i) => i.id === 'IC-009').enforcement, 'imperative');
});

// ---- tasks.md DAG parser ----
test('parseTasks: id / boundary / requirements / depends / (P) / first-task', () => {
  const md = [
    '## 1. Foundation',
    '- [x] 1.1 scaffold monorepo',
    '  - _Requirements: 12.1_',
    '  - _Boundary: monorepo-scaffold_',
    '- [ ] 2.2 (P) error envelope',
    '  - Observable: identical generic responses',
    '  - _Requirements: 10.1, 10.2_',
    '  - _Boundary: packages/shared_',
    '  - _Depends: 1.1_',
  ].join('\n');
  const tasks = parseTasks(md);
  assert.strictEqual(tasks.length, 2, 'two sub-tasks parsed');
  assert.strictEqual(tasks[0].id, '1.1');
  assert.strictEqual(tasks[0].isFirstTask, true, '1.1 is first');
  assert.strictEqual(tasks[0].done, true, '1.1 done [x]');
  assert.strictEqual(tasks[1].id, '2.2');
  assert.strictEqual(tasks[1].parallel, true, '(P) marker');
  assert.deepStrictEqual(tasks[1].requirements, ['10.1', '10.2']);
  assert.strictEqual(tasks[1].boundary, 'packages/shared');
  assert.deepStrictEqual(tasks[1].depends, ['1.1']);
  assert.match(tasks[1].text, /identical generic responses/, 'Observable body folded into text');
});

console.log(`\n${passed} test(s) passed${process.exitCode ? ' — SOME FAILED' : ''}`);
if (process.exitCode) process.exit(process.exitCode);
