#!/usr/bin/env node
/**
 * feedback-intake.js — receiving-side consolidator for the upstream feedback contour
 * (DEC-DEV-0097; phase 2 of DEC-DEV-0090's feedback-contour split). D7 dev-only — lives
 * under dev/meta-improvement/, NOT shipped to product projects (like audit-journal.js).
 *
 * WHY (DEC-DEV-0090 phase 2): DEC-DEV-0090 split feedback into a project-local contour
 * (`/product:validation-tune`) and an upstream contour (`/ecosystem:meta-feedback`, which
 * captures SYSTEMIC defects into a committed pilot outbox `.product/.upstream/feedback-outbox.md`
 * as `UF-NNN`). v1 shipped the CAPTURE side; the RECEIVING side — picking that outbox up in the
 * ecosystem repo, deduping it against decisions already made, and reconciling it with the OTHER
 * two upstream sources (the Orchestrator FEEDBACK-JOURNAL / FB-ledger and Session Audit's
 * audit-journal.ndjson) — was deferred to phase 2. This lib is that receiving side. It does the
 * three phase-2 jobs and nothing more:
 *   (1) AUTO-PICKUP   — parse a pilot's UF-NNN outbox (and, optionally, the FB-ledger + the
 *                       Session Audit journal) into records, by code.
 *   (2) DEDUPE        — classify each against DEV_JOURNAL.md so an already-ported / already-
 *                       decided finding is not re-triaged (ported | likely-ported | open).
 *   (3) UNIFIED       — normalize all three sources onto ONE finding contract, so the receiver
 *       CONTRACT       reads one shape regardless of where a finding came from.
 *
 * CAPTURE, DON'T FIX (DEC-DEV-0090 invariant): this NEVER edits an ecosystem artifact, never
 * writes the outbox, never auto-applies a fix. It reads + reconciles + reports. Acceptance
 * (turning an `open` finding into a DEC-DEV-* patch) stays a human act in the ecosystem repo.
 *
 * CONSOLIDATE, DON'T DUPLICATE: reuses audit-journal.js's normalizeSignature/findingId so the
 * Session Audit read model and this one share the same "kind of problem" signature + key space.
 *
 * EXIT CODES: 0 ran ok (report / JSON on stdout) · 2 usage/internal error.
 * Dual-use: require() it for the pure parsers/reconcilers (unit-tested, no required input file);
 * run it as a CLI pointed at an outbox.
 *
 *   node feedback-intake.js --outbox <path> [--dev-journal <path>] [--ledger <path>]
 *                           [--journal <ndjson>] [--json]
 *
 * Node stdlib only; cross-platform.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Consolidate with the Session Audit read model — same signature/key space (DEC-DEV-0059).
const aj = require('./audit-journal.js');

const FEEDBACK_INTAKE_SCHEMA_VERSION = 1;

// ---------------------------------------------------------------------------
// Unified severity scale — the common axis all three sources map onto.
// ---------------------------------------------------------------------------
const SEVERITY = { critical: 'critical', high: 'high', medium: 'medium', low: 'low', info: 'info' };
const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

// FEEDBACK-JOURNAL / outbox emoji legend (skills/ecosystem/meta-feedback.md):
// 🔴 critical · 🟠 high · 🟡 medium · 🟢 low/positive · ℹ️ note.
function severityFromEmoji(s) {
  const t = String(s || '');
  if (/🔴/.test(t)) return SEVERITY.critical;
  if (/🟠/.test(t)) return SEVERITY.high;
  if (/🟡/.test(t)) return SEVERITY.medium;
  if (/🟢/.test(t)) return SEVERITY.low;
  if (/ℹ️|ℹ/.test(t)) return SEVERITY.info;
  // word forms (an outbox heading may spell it)
  const w = t.toLowerCase();
  if (/\bcritical\b/.test(w)) return SEVERITY.critical;
  if (/\bhigh\b/.test(w)) return SEVERITY.high;
  if (/\bmedium\b/.test(w)) return SEVERITY.medium;
  if (/\blow\b|\bpositive\b/.test(w)) return SEVERITY.low;
  return SEVERITY.info;
}

// Session Audit severity {blocking,warning,info,uncertain} → the unified scale. Conservative:
// audit's rule-severity axis is not the same as upstream impact, so we do NOT inflate it —
// blocking→high (not critical), warning→medium, info→low, uncertain→info.
function severityFromAudit(s) {
  switch (String(s || '').toLowerCase()) {
    case 'blocking': return SEVERITY.high;
    case 'warning': return SEVERITY.medium;
    case 'info': return SEVERITY.low;
    default: return SEVERITY.info;
  }
}

// ---------------------------------------------------------------------------
// A DEC-DEV ref declared INSIDE a finding's own text (status / route). The presence of
// "DEC-DEV-NNNN" or "ported → DEC-DEV-NNNN" / "FIXED (… DEC-DEV-NNNN)" means the source
// already records the decision → the finding is `ported` (self-declared).
// ---------------------------------------------------------------------------
const DEC_DEV_RE = /DEC-DEV-(\d{3,4})/g;

function decDevRefsIn(text) {
  const out = [];
  const s = String(text || '');
  let m;
  DEC_DEV_RE.lastIndex = 0;
  while ((m = DEC_DEV_RE.exec(s)) !== null) out.push(`DEC-DEV-${m[1]}`);
  return out;
}

// ---------------------------------------------------------------------------
// (1) AUTO-PICKUP parsers — one per source, each → an array of RAW records.
// ---------------------------------------------------------------------------

/**
 * Parse the upstream outbox (.product/.upstream/feedback-outbox.md). Entries are
 * `## <severity-emoji> UF-NNN — <title>` blocks with **bold-label** fields. Tolerant of
 * the RU labels the capture skill writes (Источник / Класс / Симптом / Корневая причина /
 * Доказательство / Предлагаемый фикс / Статус) and their EN equivalents.
 */
function parseOutbox(text) {
  const src = String(text || '');
  const out = [];
  // split on UF headings; keep the heading line with its block
  const re = /^##\s+(.*?)\bUF-(\d{1,4})\b\s*[—:-]?\s*(.*)$/gim;
  const heads = [];
  let m;
  while ((m = re.exec(src)) !== null) {
    heads.push({ index: m.index, sevText: m[1] || '', num: m[2], title: (m[3] || '').trim() });
  }
  for (let i = 0; i < heads.length; i += 1) {
    const h = heads[i];
    const body = src.slice(h.index, i + 1 < heads.length ? heads[i + 1].index : src.length);
    const field = (labels) => {
      for (const lab of labels) {
        const fm = body.match(new RegExp(`\\*\\*${lab}[^*:]*:?\\*\\*\\s*([^\\n]*(?:\\n(?!\\s*\\*\\*|##)[^\\n]*)*)`, 'i'));
        if (fm) return fm[1].replace(/\s+/g, ' ').trim();
      }
      return '';
    };
    const status = field(['Статус', 'Status']);
    out.push({
      source_ref: `UF-${h.num}`,
      severity: severityFromEmoji(h.sevText),
      title: h.title || field(['Симптом', 'Symptom']) || `UF-${h.num}`,
      root_cause: field(['Корневая причина', 'Root cause', 'Root-cause']),
      proposed_fix: field(['Предлагаемый фикс', 'Proposed fix', 'Fix']),
      symptom: field(['Симптом', 'Symptom']),
      status: status || 'captured',
      self_dec_dev: decDevRefsIn(status),
    });
  }
  return out;
}

/**
 * Parse the Orchestrator FB-ledger markdown table (dev/ORCHESTRATOR_LIVE_RUN_FB_LEDGER.md):
 * `| id | sev | run | finding | corrected root-cause | route / status |`. The route/status
 * cell carries the FIXED/QUEUED state + any DEC-DEV ref. id is FB-LR-NN (or FB-NNN).
 */
function parseFeedbackLedger(text) {
  const src = String(text || '');
  const out = [];
  for (const line of src.split(/\r?\n/)) {
    const row = line.match(/^\s*\|\s*(FB(?:-LR)?-\d+)\s*\|(.+)\|\s*$/i);
    if (!row) continue;
    const cells = row[2].split('|').map((c) => c.trim());
    // cells: [sev, run, finding, root-cause, route/status]  (5 cells after the id)
    if (cells.length < 5) continue;
    const [sev, , finding, rootCause, route] = cells;
    out.push({
      source_ref: row[1].toUpperCase(),
      severity: severityFromEmoji(sev),
      title: finding.replace(/\s+/g, ' ').trim(),
      root_cause: rootCause.replace(/\s+/g, ' ').trim(),
      proposed_fix: '',
      status: route.replace(/\s+/g, ' ').replace(/\*\*/g, '').trim(),
      self_dec_dev: decDevRefsIn(route),
    });
  }
  return out;
}

/**
 * Read the Session Audit ndjson journal (dev/meta-improvement/audit-journal.ndjson) into raw
 * records via audit-journal.js's loader, so the same finding store feeds the unified contract.
 */
function readJournalRecords(journalPath) {
  if (!journalPath || !fs.existsSync(journalPath)) return [];
  return Array.from(aj.loadJournal(journalPath).values());
}

// ---------------------------------------------------------------------------
// (3) UNIFIED CONTRACT — normalize a raw record from any source onto one shape.
// ---------------------------------------------------------------------------
const SOURCES = {
  OUTBOX: 'upstream-outbox',
  LEDGER: 'feedback-journal',
  AUDIT: 'session-audit',
};

function unify(raw, source) {
  if (source === SOURCES.AUDIT) {
    // a Session Audit ndjson record
    const selfRef = raw.dec_dev_ref ? [raw.dec_dev_ref] : [];
    return {
      uid: `${source}:${raw.finding_id}`,
      source,
      source_ref: raw.finding_id,
      severity: severityFromAudit(raw.severity),
      title: raw.snippet || raw.artifact || raw.check_id || raw.finding_id,
      signature: raw.signature || aj.normalizeSignature(raw.snippet),
      root_cause: '',
      proposed_fix: '',
      status: raw.status || 'open',
      self_dec_dev: selfRef,
      instances: raw.instances || (raw.session_ids ? raw.session_ids.length : 1),
    };
  }
  // outbox (UF) or ledger (FB) — markdown-derived
  return {
    uid: `${source}:${raw.source_ref}`,
    source,
    source_ref: raw.source_ref,
    severity: raw.severity || SEVERITY.info,
    title: raw.title || raw.source_ref,
    signature: aj.normalizeSignature(`${raw.title} ${raw.root_cause || ''}`),
    root_cause: raw.root_cause || '',
    proposed_fix: raw.proposed_fix || '',
    status: raw.status || 'captured',
    self_dec_dev: raw.self_dec_dev || [],
    instances: 1,
  };
}

// ---------------------------------------------------------------------------
// (2) DEDUPE against decisions already made — read DEV_JOURNAL.md and decide a disposition.
// ---------------------------------------------------------------------------

/**
 * Build a map: source_ref token (UF-NNN / FB-LR-NN / FB-NNN) → [DEC-DEV-NNNN, ...] that
 * MENTION it, by scanning the journal's DEC-DEV sections. A finding whose ref is named in a
 * DEC-DEV entry has very likely already been decided/ported even if its own status text is stale.
 */
function indexDevJournal(devJournalText) {
  const src = String(devJournalText || '');
  const refToDecDev = new Map();     // 'UF-007' → Set('DEC-DEV-0097')
  const decDevNumbers = new Set();   // all DEC-DEV-NNNN headers seen
  // split into sections at "## DEC-DEV-NNNN"
  const re = /^##\s+DEC-DEV-(\d{3,4})\b/gim;
  const marks = [];
  let m;
  while ((m = re.exec(src)) !== null) { marks.push({ index: m.index, dec: `DEC-DEV-${m[1]}` }); decDevNumbers.add(`DEC-DEV-${m[1]}`); }
  for (let i = 0; i < marks.length; i += 1) {
    const section = src.slice(marks[i].index, i + 1 < marks.length ? marks[i + 1].index : src.length);
    const refRe = /\b(UF-\d{1,4}|FB(?:-LR)?-\d+)\b/gi;
    let r;
    while ((r = refRe.exec(section)) !== null) {
      const ref = r[1].toUpperCase();
      if (!refToDecDev.has(ref)) refToDecDev.set(ref, new Set());
      refToDecDev.get(ref).add(marks[i].dec);
    }
  }
  return { refToDecDev, decDevNumbers };
}

/**
 * Annotate each unified finding with a disposition:
 *   ported        — the finding self-declares a DEC-DEV (its status/route names one) AND that
 *                   DEC-DEV exists in the journal → the decision is recorded; do not re-triage.
 *   likely-ported — a DEC-DEV entry NAMES this finding's ref (or it self-declares a DEC-DEV the
 *                   journal doesn't contain — a stale/foreign ref) → surface for a human confirm.
 *   open          — neither → needs upstream triage.
 * No silent dedupe loss: every dedup carries the matched DEC-DEV in `dec_dev_ref`.
 */
function dedupe(findings, devJournalText) {
  const { refToDecDev, decDevNumbers } = indexDevJournal(devJournalText);
  return findings.map((f) => {
    const selfRefs = (f.self_dec_dev || []).filter(Boolean);
    const namedBy = refToDecDev.get(String(f.source_ref).toUpperCase());
    let disposition;
    let decRef = null;
    const selfInJournal = selfRefs.find((d) => decDevNumbers.has(d));
    if (selfInJournal) {
      disposition = 'ported';
      decRef = selfInJournal;
    } else if (namedBy && namedBy.size) {
      disposition = 'likely-ported';
      decRef = Array.from(namedBy).sort().join(', ');
    } else if (selfRefs.length) {
      // self-declares a DEC-DEV the journal doesn't have — a foreign/stale ref; flag, don't trust
      disposition = 'likely-ported';
      decRef = `${selfRefs.join(', ')} (not found in this journal — verify)`;
    } else {
      disposition = 'open';
    }
    return { ...f, disposition, dec_dev_ref: decRef };
  });
}

// ---------------------------------------------------------------------------
// Orchestrator — run pickup + unify + dedupe over whatever sources were given.
// ---------------------------------------------------------------------------
function intake(opts) {
  const o = opts || {};
  const findings = [];
  if (o.outboxText != null) for (const r of parseOutbox(o.outboxText)) findings.push(unify(r, SOURCES.OUTBOX));
  if (o.ledgerText != null) for (const r of parseFeedbackLedger(o.ledgerText)) findings.push(unify(r, SOURCES.LEDGER));
  if (Array.isArray(o.journalRecords)) for (const r of o.journalRecords) findings.push(unify(r, SOURCES.AUDIT));
  const reconciled = dedupe(findings, o.devJournalText || '');
  reconciled.sort((a, b) =>
    (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0)
    || a.disposition.localeCompare(b.disposition)
    || a.uid.localeCompare(b.uid));
  const summary = {
    total: reconciled.length,
    open: reconciled.filter((f) => f.disposition === 'open').length,
    likely_ported: reconciled.filter((f) => f.disposition === 'likely-ported').length,
    ported: reconciled.filter((f) => f.disposition === 'ported').length,
    by_source: {
      [SOURCES.OUTBOX]: reconciled.filter((f) => f.source === SOURCES.OUTBOX).length,
      [SOURCES.LEDGER]: reconciled.filter((f) => f.source === SOURCES.LEDGER).length,
      [SOURCES.AUDIT]: reconciled.filter((f) => f.source === SOURCES.AUDIT).length,
    },
  };
  return { schema_version: FEEDBACK_INTAKE_SCHEMA_VERSION, summary, findings: reconciled };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function repoRootFrom(scriptDir) { return path.resolve(scriptDir, '..', '..', '..'); }

function parseArgs(argv) {
  const a = {};
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i += 1) {
    const t = rest[i];
    const next = () => rest[(i += 1)];
    switch (t) {
      case '--help': case '-h': a.help = true; break;
      case '--outbox': a.outbox = next(); break;
      case '--ledger': a.ledger = next(); break;
      case '--journal': a.journal = next(); break;
      case '--dev-journal': a.devJournal = next(); break;
      case '--json': a.json = true; break;
      default: break;
    }
  }
  return a;
}

function readIf(p) {
  if (!p) return null;
  try { return fs.readFileSync(p, 'utf8'); } catch (e) { process.stderr.write(`WARN: cannot read ${p}: ${e.message}\n`); return null; }
}

function printHelp() {
  process.stdout.write([
    'feedback-intake.js — receiving-side consolidator for the upstream feedback contour (DEC-DEV-0097)',
    '',
    'node feedback-intake.js --outbox <path> [--dev-journal <path>] [--ledger <path>] [--journal <ndjson>] [--json]',
    '',
    '  --outbox       a pilot .product/.upstream/feedback-outbox.md (UF-NNN entries)',
    '  --ledger       the Orchestrator FB-ledger (dev/ORCHESTRATOR_LIVE_RUN_FB_LEDGER.md)',
    '  --journal      the Session Audit ndjson (default: dev/meta-improvement/audit-journal.ndjson)',
    '  --dev-journal  DEV_JOURNAL.md to dedupe against (default: repo root DEV_JOURNAL.md)',
    '  --json         emit JSON instead of the table',
    '',
    'Reconciles all sources onto ONE finding contract + a disposition (open | likely-ported | ported).',
    'Capture-don\'t-fix: reads + reports only; never edits an artifact or the outbox.',
  ].join('\n') + '\n');
}

function printReport(res) {
  const s = res.summary;
  process.stdout.write(`feedback-intake: ${s.total} finding(s) — ${s.open} OPEN, ${s.likely_ported} likely-ported, ${s.ported} ported.\n`);
  process.stdout.write(`  by source: outbox ${s.by_source['upstream-outbox']} · feedback-journal ${s.by_source['feedback-journal']} · session-audit ${s.by_source['session-audit']}\n\n`);
  process.stdout.write('disp | sev | source | ref | dec-dev | title\n');
  process.stdout.write('-----|-----|--------|-----|---------|------\n');
  for (const f of res.findings) {
    process.stdout.write(`${f.disposition} | ${f.severity} | ${f.source} | ${f.source_ref} | ${f.dec_dev_ref || '—'} | ${String(f.title).slice(0, 80)}\n`);
  }
  const open = res.findings.filter((f) => f.disposition === 'open');
  if (open.length) {
    process.stdout.write(`\n${open.length} OPEN finding(s) need upstream triage (→ a DEC-DEV-* in this repo):\n`);
    for (const f of open) process.stdout.write(`  • [${f.severity}] ${f.source_ref}: ${String(f.title).slice(0, 90)}\n`);
  }
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) { printHelp(); process.exit(0); }
  const repoRoot = repoRootFrom(__dirname);
  if (!args.outbox && !args.ledger && !args.journal) {
    process.stderr.write('ERROR: nothing to pick up — pass at least one of --outbox / --ledger / --journal.\n\n');
    printHelp();
    process.exit(2);
  }
  const devJournalPath = args.devJournal || path.join(repoRoot, 'DEV_JOURNAL.md');
  const journalPath = args.journal || (fs.existsSync(path.join(repoRoot, 'dev', 'meta-improvement', 'audit-journal.ndjson'))
    ? path.join(repoRoot, 'dev', 'meta-improvement', 'audit-journal.ndjson')
    : null);
  const res = intake({
    outboxText: readIf(args.outbox),
    ledgerText: readIf(args.ledger),
    journalRecords: args.journal || (!args.outbox && !args.ledger) ? readJournalRecords(journalPath) : undefined,
    devJournalText: readIf(devJournalPath) || '',
  });
  if (args.json) process.stdout.write(JSON.stringify(res, null, 2) + '\n');
  else printReport(res);
  process.exit(0);
}

if (require.main === module) main();

module.exports = {
  FEEDBACK_INTAKE_SCHEMA_VERSION,
  SEVERITY,
  SEVERITY_RANK,
  SOURCES,
  severityFromEmoji,
  severityFromAudit,
  decDevRefsIn,
  parseOutbox,
  parseFeedbackLedger,
  readJournalRecords,
  unify,
  indexDevJournal,
  dedupe,
  intake,
};
