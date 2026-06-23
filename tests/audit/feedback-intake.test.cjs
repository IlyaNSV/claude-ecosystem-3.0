'use strict';
/**
 * Unit test for feedback-intake.js — the receiving-side consolidator for the upstream
 * feedback contour (DEC-DEV-0097; phase 2 of DEC-DEV-0090).
 *
 * The three phase-2 jobs are deterministic and testable without a live pilot, so this leans on
 * fixtures that exercise each one + its edges:
 *   (1) AUTO-PICKUP   — parseOutbox (UF-NNN) + parseFeedbackLedger (FB-LR table) parse the
 *                       real on-disk shapes the capture side writes.
 *   (3) UNIFIED       — unify() maps all three sources (outbox / ledger / Session Audit ndjson)
 *       CONTRACT       onto ONE shape with a normalized severity + a shared signature.
 *   (2) DEDUPE        — dedupe() against a DEV_JOURNAL fixture yields the right disposition:
 *                       ported (self-declared + in journal) / likely-ported (named by a DEC-DEV
 *                       or a foreign self-ref) / open (needs triage). No silent dedupe loss.
 *
 * Node stdlib only; run with `node tests/audit/feedback-intake.test.cjs` or `npm run test:audit`.
 */

const assert = require('node:assert');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const fi = require(path.join(REPO_ROOT, 'dev', 'meta-improvement', 'scripts', 'feedback-intake.js'));
const { parseOutbox, parseFeedbackLedger, unify, dedupe, intake, severityFromEmoji, severityFromAudit, SOURCES, SEVERITY } = fi;

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

console.log('feedback-intake — receiving-side consolidator (DEC-DEV-0097)');

// ---- fixtures --------------------------------------------------------------

const OUTBOX = `# Upstream feedback outbox

## 🟠 UF-007 — V-12 references artifact field \`owner_fm\` that no spec defines

**Источник:** /product:validation-tune escalation
**Класс:** SYSTEMIC — reproduces in any project (rule defect)
**Симптом:** V-12 fails on every VC whose frontmatter is spec-correct.
**Корневая причина:** rule body reads \`owner_fm\`; the canonical field is \`owner\` (docs/pmo/artifacts/VC.md).
**Предлагаемый фикс (для экосистемы):** update V-12 to read \`owner\`; add a field sweep.
**Статус:** captured — awaiting delivery upstream.

## 🔴 UF-008 — journal hook crashes on Windows backslash paths

**Источник:** manual scan
**Класс:** SYSTEMIC
**Симптом:** dev-journal-reminder.js throws on backslash paths.
**Корневая причина:** path handling assumes forward slashes.
**Статус:** ported → DEC-DEV-0099

## 🟡 UF-009 — verify.md command count drifts after a new command

**Источник:** manual scan
**Симптом:** stale per-namespace count.
**Статус:** captured — awaiting delivery.

## 🟢 UF-010 — cosmetic label misnomer

**Симптом:** a label reads oddly.
**Статус:** ported → DEC-DEV-0500
`;

const LEDGER = `# FB-ledger

| id | sev | run | finding | corrected root-cause | route / status |
|---|---|---|---|---|---|
| FB-LR-03 | 🔴 | B | verify-finding is order-sensitive (TOCTOU) | grep of the current tree only | **FIXED (T2, DEC-DEV-0093):** order-aware verify |
| FB-LR-10 | 🟡 | A | No PA dedup — repeated audits append near-duplicate PAs | append + commit a new PA | **QUEUED:** dedup pre-filter in audit-spec-fidelity |
`;

// a DEV_JOURNAL fixture: 0099 + 0093 exist; 0100 NAMES UF-007 (but UF-007 didn't self-declare);
// 0500 does NOT exist (UF-010 self-declares a foreign ref); FB-LR-10 is named nowhere.
const DEV_JOURNAL = `# DEV Journal

## DEC-DEV-0093 — order-aware verify
Fixes FB-LR-03 (and FB-LR-13). Order-aware disposition.

## DEC-DEV-0099 — windows hook path fix
Closes UF-008 — backslash path crash in the journal hook.

## DEC-DEV-0100 — validation field reconcile
Touched a few rules; in passing also noted UF-007 as related context.
`;

const AUDIT_RECORDS = [
  { finding_id: 'abc123', severity: 'warning', snippet: 'IC missing severity/entity', signature: 'ic-missing-severity', status: 'patched', dec_dev_ref: 'DEC-DEV-0093', session_ids: ['s1'], instances: 1 },
  { finding_id: 'def456', severity: 'info', snippet: 'HYP created by direct write', signature: 'hyp-direct-write', status: 'open', dec_dev_ref: null, session_ids: ['s2', 's3'], instances: 2 },
];

// ---- (1) AUTO-PICKUP -------------------------------------------------------

test('parseOutbox: parses UF-NNN entries with severity, title, fields, self-declared DEC-DEV', () => {
  const ufs = parseOutbox(OUTBOX);
  assert.strictEqual(ufs.length, 4, `expected 4 UF entries, got ${ufs.length}`);
  const u7 = ufs.find((u) => u.source_ref === 'UF-007');
  assert.ok(u7, 'UF-007 not parsed');
  assert.strictEqual(u7.severity, SEVERITY.high, 'UF-007 emoji 🟠 → high');
  assert.ok(/owner_fm/.test(u7.title), 'UF-007 title lost');
  assert.ok(/canonical field is/.test(u7.root_cause), 'UF-007 root cause not captured');
  assert.ok(/update V-12/.test(u7.proposed_fix), 'UF-007 proposed fix not captured');
  assert.deepStrictEqual(u7.self_dec_dev, [], 'UF-007 has no self-declared DEC-DEV (status captured)');
  const u8 = ufs.find((u) => u.source_ref === 'UF-008');
  assert.strictEqual(u8.severity, SEVERITY.critical, 'UF-008 emoji 🔴 → critical');
  assert.deepStrictEqual(u8.self_dec_dev, ['DEC-DEV-0099'], 'UF-008 self-declares DEC-DEV-0099 in status');
});

test('parseFeedbackLedger: parses FB-LR table rows (sev emoji, finding, route + self DEC-DEV)', () => {
  const fbs = parseFeedbackLedger(LEDGER);
  assert.strictEqual(fbs.length, 2, `expected 2 FB rows, got ${fbs.length}`);
  const fb3 = fbs.find((f) => f.source_ref === 'FB-LR-03');
  assert.ok(fb3, 'FB-LR-03 not parsed');
  assert.strictEqual(fb3.severity, SEVERITY.critical, 'FB-LR-03 🔴 → critical');
  assert.deepStrictEqual(fb3.self_dec_dev, ['DEC-DEV-0093'], 'FB-LR-03 route names DEC-DEV-0093');
  const fb10 = fbs.find((f) => f.source_ref === 'FB-LR-10');
  assert.deepStrictEqual(fb10.self_dec_dev, [], 'FB-LR-10 is QUEUED — no DEC-DEV yet');
});

// ---- (3) UNIFIED CONTRACT --------------------------------------------------

test('unify: all three sources map onto one shape (uid/source/source_ref/severity/signature)', () => {
  const fromOutbox = unify(parseOutbox(OUTBOX)[0], SOURCES.OUTBOX);
  const fromLedger = unify(parseFeedbackLedger(LEDGER)[0], SOURCES.LEDGER);
  const fromAudit = unify(AUDIT_RECORDS[0], SOURCES.AUDIT);
  for (const f of [fromOutbox, fromLedger, fromAudit]) {
    for (const k of ['uid', 'source', 'source_ref', 'severity', 'title', 'signature', 'status']) {
      assert.ok(k in f, `unified record missing key: ${k} (source ${f.source})`);
    }
  }
  assert.strictEqual(fromOutbox.source, SOURCES.OUTBOX);
  assert.strictEqual(fromLedger.source, SOURCES.LEDGER);
  assert.strictEqual(fromAudit.source, SOURCES.AUDIT);
  assert.strictEqual(fromAudit.severity, SEVERITY.medium, 'audit warning → medium');
  assert.ok(fromOutbox.signature && fromOutbox.signature !== 'unspecified', 'outbox signature derived');
});

test('severity mappings: emoji + audit words → the unified scale', () => {
  assert.strictEqual(severityFromEmoji('🔴'), SEVERITY.critical);
  assert.strictEqual(severityFromEmoji('🟠→🟢'), SEVERITY.high, 'first matched colour wins');
  assert.strictEqual(severityFromEmoji('🟡'), SEVERITY.medium);
  assert.strictEqual(severityFromEmoji('🟢'), SEVERITY.low);
  assert.strictEqual(severityFromEmoji('ℹ️'), SEVERITY.info);
  assert.strictEqual(severityFromAudit('blocking'), SEVERITY.high);
  assert.strictEqual(severityFromAudit('warning'), SEVERITY.medium);
  assert.strictEqual(severityFromAudit('info'), SEVERITY.low);
  assert.strictEqual(severityFromAudit('uncertain'), SEVERITY.info);
});

// ---- (2) DEDUPE against DEV_JOURNAL ----------------------------------------

test('dedupe: ported — self-declares a DEC-DEV that EXISTS in the journal', () => {
  const findings = parseOutbox(OUTBOX).map((r) => unify(r, SOURCES.OUTBOX));
  const out = dedupe(findings, DEV_JOURNAL);
  const u8 = out.find((f) => f.source_ref === 'UF-008');
  assert.strictEqual(u8.disposition, 'ported', 'UF-008 → DEC-DEV-0099 (in journal) → ported');
  assert.strictEqual(u8.dec_dev_ref, 'DEC-DEV-0099');
});

test('dedupe: likely-ported — a DEC-DEV entry NAMES the ref (finding did not self-declare)', () => {
  const findings = parseOutbox(OUTBOX).map((r) => unify(r, SOURCES.OUTBOX));
  const out = dedupe(findings, DEV_JOURNAL);
  const u7 = out.find((f) => f.source_ref === 'UF-007');
  assert.strictEqual(u7.disposition, 'likely-ported', 'UF-007 named by DEC-DEV-0100 → likely-ported');
  assert.ok(/DEC-DEV-0100/.test(u7.dec_dev_ref), 'the naming DEC-DEV must be surfaced (no silent dedupe loss)');
});

test('dedupe: likely-ported — self-declares a FOREIGN DEC-DEV the journal lacks (flag, do not trust)', () => {
  const findings = parseOutbox(OUTBOX).map((r) => unify(r, SOURCES.OUTBOX));
  const out = dedupe(findings, DEV_JOURNAL);
  const u10 = out.find((f) => f.source_ref === 'UF-010');
  assert.strictEqual(u10.disposition, 'likely-ported', 'UF-010 self-ref DEC-DEV-0500 not in journal → flagged');
  assert.ok(/not found/.test(u10.dec_dev_ref), 'a foreign ref must be flagged for verification');
});

test('dedupe: open — neither self-declared nor named anywhere → needs triage', () => {
  const findings = parseOutbox(OUTBOX).map((r) => unify(r, SOURCES.OUTBOX));
  const out = dedupe(findings, DEV_JOURNAL);
  const u9 = out.find((f) => f.source_ref === 'UF-009');
  assert.strictEqual(u9.disposition, 'open', 'UF-009 unmentioned → open');
  assert.strictEqual(u9.dec_dev_ref, null);
  // a QUEUED ledger item with no DEC-DEV is also open
  const fb = dedupe(parseFeedbackLedger(LEDGER).map((r) => unify(r, SOURCES.LEDGER)), DEV_JOURNAL);
  assert.strictEqual(fb.find((f) => f.source_ref === 'FB-LR-10').disposition, 'open', 'a QUEUED ledger row is open');
  assert.strictEqual(fb.find((f) => f.source_ref === 'FB-LR-03').disposition, 'ported', 'FB-LR-03 → DEC-DEV-0093 (in journal) → ported');
});

test('dedupe: a Session Audit record with dec_dev_ref in the journal → ported; without → open', () => {
  const findings = AUDIT_RECORDS.map((r) => unify(r, SOURCES.AUDIT));
  const out = dedupe(findings, DEV_JOURNAL);
  assert.strictEqual(out.find((f) => f.source_ref === 'abc123').disposition, 'ported', 'audit rec w/ DEC-DEV-0093 → ported');
  assert.strictEqual(out.find((f) => f.source_ref === 'def456').disposition, 'open', 'audit rec w/o dec_dev_ref → open');
});

// ---- end-to-end intake -----------------------------------------------------

test('intake: reconciles all three sources + correct summary counts', () => {
  const res = intake({ outboxText: OUTBOX, ledgerText: LEDGER, journalRecords: AUDIT_RECORDS, devJournalText: DEV_JOURNAL });
  assert.strictEqual(res.summary.total, 8, '4 UF + 2 FB + 2 audit = 8');
  assert.strictEqual(res.summary.by_source[SOURCES.OUTBOX], 4);
  assert.strictEqual(res.summary.by_source[SOURCES.LEDGER], 2);
  assert.strictEqual(res.summary.by_source[SOURCES.AUDIT], 2);
  // open: UF-009 + FB-LR-10 + audit def456 = 3
  assert.strictEqual(res.summary.open, 3, `expected 3 open, got ${res.summary.open}`);
  // ported: UF-008 + FB-LR-03 + audit abc123 = 3
  assert.strictEqual(res.summary.ported, 3, `expected 3 ported, got ${res.summary.ported}`);
  // likely-ported: UF-007 + UF-010 = 2
  assert.strictEqual(res.summary.likely_ported, 2, `expected 2 likely-ported, got ${res.summary.likely_ported}`);
  // sorted: the critical finding (UF-008) leads
  assert.strictEqual(res.findings[0].severity, SEVERITY.critical, 'highest severity sorts first');
});

test('intake: empty inputs → no findings, no throw', () => {
  const res = intake({});
  assert.strictEqual(res.summary.total, 0);
  assert.deepStrictEqual(res.findings, []);
});

console.log(`\n${passed} check(s) passed${process.exitCode ? ' — SOME FAILED' : ''}`);
if (process.exitCode) process.exit(process.exitCode);
