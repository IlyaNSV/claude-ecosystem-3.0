#!/usr/bin/env node
/**
 * audit-journal.js — accumulating findings journal (G5) for Session Audit v2, Increment 3b.
 *
 * Between ephemeral per-session reports (audit-reports/<uuid>.md) and distilled patterns/,
 * there was no persistent layer. This journal accumulates findings across sessions, keyed by
 * a stable zone-anchored id, so the Increment 3c synthesizer can cluster recurring (systemic)
 * findings into patch candidates.
 *
 * Key (DEC-DEV-0059): finding_id = sha1(zone | check_id | artifact | signature).
 *   - zone     — inferred from the finding's artifact path/id (falls back to session zones).
 *   - artifact — normalized (parenthetical notes stripped) but artifact ids kept.
 *   - signature — normalized snippet (ids/digits stripped) → a stable "kind of problem" label.
 * The same issue on the same artifact across N sessions accumulates in one record's
 * session_ids[]; the synthesizer (3c) clusters MULTIPLE records sharing (zone, check_id).
 *
 * Storage: ndjson at dev/meta-improvement/audit-journal.ndjson, one finding per line.
 * The writer rewrites the file deduped+sorted on each update (journal is small); human-set
 * status / dismiss_reason / dec_dev_ref are preserved across rebuilds.
 *
 * NO auto-fix (CONVENTIONS §8) — this only records. Product-session audit only. D7 dev-only.
 *
 * CLI:
 *   node audit-journal.js [--rebuild]            # scan all reports, (re)build journal (default)
 *   node audit-journal.js --report=<path> [--target=<proj>]   # ingest one report (live wiring)
 *   node audit-journal.js --stats                # print (zone,check_id) clusters + systemic flag
 *   node audit-journal.js --journal=<path>       # override journal location
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROMOTE_INSTANCES = 3; // patterns/ rule: 3+ instances → systemic (provisional→validated)
// Not real product issues → never journaled: G (removed self-dev check, DEC-DEV-0059),
// and the advisory classification meta-findings.
const SKIP_CHECK_IDS = new Set(['G', 'class-mismatch', 'zone-mismatch']);
const SEVERITY_RANK = { blocking: 3, warning: 2, info: 1, uncertain: 0 };
const CONFIDENCE_RANK = { high: 3, medium: 2, low: 1, uncertain: 0 };

function repoRootFrom(scriptDir) {
  return path.resolve(scriptDir, '..', '..', '..');
}
function defaultJournal(repoRoot) {
  return path.join(repoRoot, 'dev', 'meta-improvement', 'audit-journal.ndjson');
}
function reportsDir(repoRoot) {
  return path.join(repoRoot, 'dev', 'meta-improvement', 'audit-reports');
}

// ============================================================================
// Report frontmatter parsing (scalars + session_zones list + findings list)
// ============================================================================

function stripQ(s) {
  const t = String(s == null ? '' : s).trim();
  const m = t.match(/^(['"])([\s\S]*)\1$/);
  return m ? m[2] : t;
}

function parseInlineList(v) {
  const s = stripQ(v);
  if (!s || s === 'none' || s === '[]') return [];
  const m = s.match(/^\[(.*)\]$/);
  if (m) return m[1].split(',').map((x) => stripQ(x)).filter(Boolean);
  return [s];
}

function projectFromPath(p) {
  // Best-effort: original transcript paths embed the project slug; temp paths do not.
  const m = String(p || '').match(/WebstormProjects[-\\/]+([a-z0-9][a-z0-9-]*?)(?:--claude|[\\/]|\.jsonl|$)/i);
  return m ? m[1] : null;
}

function parseReport(reportPath) {
  const content = fs.readFileSync(reportPath, 'utf-8');
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return null;
  const lines = fm[1].split(/\r?\n/);
  const out = {
    session_id: null, audited_at: null, status: null, session_mode: null,
    session_zones: [], target_project: null, findings: [],
  };
  let inFindings = false;
  let cur = null;
  for (const raw of lines) {
    const top = raw.match(/^([\w_]+):\s*(.*)$/);
    if (top && !/^\s/.test(raw)) {
      if (cur) { out.findings.push(cur); cur = null; }
      inFindings = false;
      const k = top[1];
      const v = top[2];
      if (k === 'findings') { inFindings = true; continue; }
      if (k === 'session_zones') { out.session_zones = parseInlineList(v); continue; }
      if (k === 'session_id') out.session_id = stripQ(v);
      else if (k === 'audited_at') out.audited_at = stripQ(v);
      else if (k === 'status') out.status = stripQ(v);
      else if (k === 'session_mode') out.session_mode = stripQ(v);
      else if (k === 'transcript_path') out.target_project = projectFromPath(v);
      continue;
    }
    if (inFindings) {
      const item = raw.match(/^\s*-\s+([\w_]+):\s*(.*)$/);
      if (item) {
        if (cur) out.findings.push(cur);
        cur = {};
        cur[item[1]] = stripQ(item[2]);
        continue;
      }
      const cont = raw.match(/^\s+([\w_]+):\s*(.*)$/);
      if (cont && cur) { cur[cont[1]] = stripQ(cont[2]); continue; }
    }
  }
  if (cur) out.findings.push(cur);
  return out;
}

// ============================================================================
// Zone inference + key derivation
// ============================================================================

function zoneForArtifact(artifact) {
  const a = String(artifact || '').toLowerCase();
  if (/business-rules|invariants|\/features\/|scenarios|lifecycle|\bbr-|\bic-|\bfm-|\bsc-|\blc-|\bnfr-|\bvc-|\brpm-|\bbg-/.test(a)) return 'D2B-behavioral';
  if (/problems|hypotheses|segments|value-prop|\/market|competitive|\bps-|\bhyp-|\bseg-|\bvp-|\bmr-|\bca-/.test(a)) return 'D1-discovery';
  if (/mockups|design-system|\bmk-|\bds-|\bnm-/.test(a)) return 'D2B04-design';
  if (/integrator|handoff|adapters|active-tools|contracts/.test(a)) return 'D6-integrator';
  return null;
}

function normalizeArtifact(a) {
  return String(a || '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ') || 'unspecified';
}

function normalizeSignature(snippet) {
  return String(snippet || '')
    .toLowerCase()
    .replace(/[a-z]{2,4}-\d+(?:\.\.[a-z]{2,4}-?\d+)?/gi, '') // strip artifact ids / ranges
    .replace(/\d+/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'unspecified';
}

function findingId(zone, checkId, artifact, signature) {
  const key = `${zone}|${checkId}|${normalizeArtifact(artifact)}|${signature}`;
  return crypto.createHash('sha1').update(key).digest('hex').slice(0, 12);
}

function maxRank(a, b, ranks) {
  return (ranks[a] || 0) >= (ranks[b] || 0) ? a : b;
}

// ============================================================================
// Journal store (ndjson, deduped+sorted on write; human status preserved)
// ============================================================================

function loadJournal(journalPath) {
  const map = new Map();
  if (!fs.existsSync(journalPath)) return map;
  for (const line of fs.readFileSync(journalPath, 'utf-8').split('\n')) {
    if (!line.trim()) continue;
    try { const r = JSON.parse(line); if (r && r.finding_id) map.set(r.finding_id, r); } catch { /* skip */ }
  }
  return map;
}

function writeJournal(journalPath, map) {
  const rows = Array.from(map.values()).sort((x, y) =>
    (x.zone || '').localeCompare(y.zone || '')
    || (x.check_id || '').localeCompare(y.check_id || '')
    || (SEVERITY_RANK[y.severity] || 0) - (SEVERITY_RANK[x.severity] || 0)
    || x.finding_id.localeCompare(y.finding_id));
  fs.writeFileSync(journalPath, rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''));
  return rows.length;
}

/**
 * Ingest one parsed report into the journal map (in place). Returns count of findings ingested.
 * Idempotent: re-ingesting the same report does not double-count (session_ids is a set).
 * Preserves human-set status / dismiss_reason / dec_dev_ref on existing records.
 */
function ingestReport(map, report, targetOverride) {
  if (!report || !Array.isArray(report.findings)) return 0;
  const sid = report.session_id;
  const when = report.audited_at || '';
  const target = targetOverride || report.target_project || 'unknown';
  const mode = report.session_mode || 'unknown';
  let n = 0;
  for (const f of report.findings) {
    if (!f || !f.check_id || SKIP_CHECK_IDS.has(f.check_id)) continue;
    const zone = zoneForArtifact(f.artifact) || report.session_zones[0] || 'mixed-uncertain';
    const signature = normalizeSignature(f.snippet);
    const id = findingId(zone, f.check_id, f.artifact, signature);
    const existing = map.get(id);
    if (existing) {
      const ids = new Set(existing.session_ids || []);
      if (sid) ids.add(sid);
      existing.session_ids = Array.from(ids);
      existing.instances = existing.session_ids.length;
      existing.last_seen = when > (existing.last_seen || '') ? when : existing.last_seen;
      if (when && (!existing.first_seen || when < existing.first_seen)) existing.first_seen = when;
      existing.severity = maxRank(existing.severity, f.severity, SEVERITY_RANK);
      existing.confidence = maxRank(existing.confidence, f.confidence, CONFIDENCE_RANK);
      existing.snippet = f.snippet || existing.snippet;     // latest human-readable example
      existing.artifact = f.artifact || existing.artifact;
      existing.mode = mode;
      // status / dismiss_reason / dec_dev_ref are NOT reset — human decisions persist.
    } else {
      map.set(id, {
        finding_id: id,
        zone,
        check_id: f.check_id,
        artifact: f.artifact || 'unspecified',
        signature,
        snippet: f.snippet || '',
        severity: f.severity || 'uncertain',
        confidence: f.confidence || 'uncertain',
        mode,
        target_project: target,
        session_ids: sid ? [sid] : [],
        instances: sid ? 1 : 0,
        first_seen: when || null,
        last_seen: when || null,
        status: 'open',          // open | clustered | patch-proposed | patched | dismissed
        dismiss_reason: null,
        dec_dev_ref: null,
      });
    }
    n++;
  }
  return n;
}

function rebuild(repoRoot, journalPath) {
  const dir = reportsDir(repoRoot);
  const map = loadJournal(journalPath); // preserve human-set fields
  const files = fs.readdirSync(dir).filter((f) => /\.md$/.test(f) && !/^phase-/.test(f) && f !== 'README.md');
  let reports = 0;
  let findings = 0;
  for (const f of files) {
    const r = parseReport(path.join(dir, f));
    if (!r) continue;
    reports++;
    findings += ingestReport(map, r);
  }
  const total = writeJournal(journalPath, map);
  return { reports, findings, total };
}

// ============================================================================
// Stats / clustering preview (input for the 3c synthesizer)
// ============================================================================

function clusters(map) {
  const byKey = new Map();
  for (const r of map.values()) {
    if (r.status === 'dismissed') continue;
    const key = `${r.zone}|${r.check_id}`;
    if (!byKey.has(key)) byKey.set(key, { zone: r.zone, check_id: r.check_id, findings: 0, instances: 0, maxSeverity: 'uncertain', signatures: new Set() });
    const c = byKey.get(key);
    c.findings++;
    c.instances += r.instances || (r.session_ids ? r.session_ids.length : 0);
    c.maxSeverity = maxRank(c.maxSeverity, r.severity, SEVERITY_RANK);
    c.signatures.add(r.signature);
  }
  return Array.from(byKey.values())
    .map((c) => ({ ...c, signatures: c.signatures.size, systemic: c.findings >= PROMOTE_INSTANCES || c.instances >= PROMOTE_INSTANCES }))
    .sort((a, b) => Number(b.systemic) - Number(a.systemic) || b.instances - a.instances);
}

function printStats(map) {
  const cs = clusters(map);
  const totalFindings = map.size;
  process.stdout.write(`Journal: ${totalFindings} distinct finding(s), ${cs.length} (zone,check) cluster(s).\n\n`);
  process.stdout.write('zone | check | findings | instances | sigs | maxSev | systemic\n');
  process.stdout.write('-----|-------|----------|-----------|------|--------|---------\n');
  for (const c of cs) {
    process.stdout.write(`${c.zone} | ${c.check_id} | ${c.findings} | ${c.instances} | ${c.signatures} | ${c.maxSeverity} | ${c.systemic ? 'YES (≥' + PROMOTE_INSTANCES + ')' : '—'}\n`);
  }
  const sys = cs.filter((c) => c.systemic).length;
  process.stdout.write(`\n${sys} systemic cluster(s) (≥${PROMOTE_INSTANCES}) — candidates for the 3c synthesizer.\n`);
}

// ============================================================================
// CLI
// ============================================================================

function parseArgs(argv) {
  const out = { rebuild: false, stats: false, report: null, target: null, journal: null };
  for (const a of argv) {
    if (a === '--rebuild') out.rebuild = true;
    else if (a === '--stats') out.stats = true;
    else if (a.startsWith('--report=')) out.report = a.slice('--report='.length);
    else if (a.startsWith('--target=')) out.target = a.slice('--target='.length);
    else if (a.startsWith('--journal=')) out.journal = a.slice('--journal='.length);
  }
  return out;
}

function main() {
  const repoRoot = repoRootFrom(__dirname);
  const args = parseArgs(process.argv.slice(2));
  const journalPath = args.journal || defaultJournal(repoRoot);

  if (args.report) {
    const map = loadJournal(journalPath);
    const r = parseReport(args.report);
    if (!r) { process.stderr.write(`Could not parse report: ${args.report}\n`); process.exit(1); }
    const n = ingestReport(map, r, args.target);
    writeJournal(journalPath, map);
    process.stdout.write(`Ingested ${n} finding(s) from ${path.basename(args.report)} → ${path.relative(repoRoot, journalPath)} (${map.size} total).\n`);
    if (args.stats) printStats(map);
    return;
  }

  if (args.stats && !args.rebuild) {
    printStats(loadJournal(journalPath));
    return;
  }

  // default: rebuild
  const res = rebuild(repoRoot, journalPath);
  process.stdout.write(`Rebuilt journal from ${res.reports} report(s): ${res.findings} finding(s) ingested, ${res.total} distinct record(s) → ${path.relative(repoRoot, journalPath)}.\n`);
  if (args.stats) printStats(loadJournal(journalPath));
}

if (require.main === module) main();

module.exports = {
  parseReport,
  zoneForArtifact,
  normalizeArtifact,
  normalizeSignature,
  findingId,
  loadJournal,
  writeJournal,
  ingestReport,
  rebuild,
  clusters,
};
