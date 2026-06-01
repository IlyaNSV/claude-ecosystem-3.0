#!/usr/bin/env node
/**
 * audit-smoke.js — D7 conformance auditor CLI (Phase 4.1).
 *
 * Reads Pending markers from dev/meta-improvement/audit-index.md, spawns
 * `claude -p` per session against the active phase smoke test plan,
 * writes per-session reports and a phase-level summary.
 *
 * Usage:
 *   node dev/meta-improvement/scripts/audit-smoke.js --phase=<N> [options]
 *
 * Options:
 *   --phase=<N>             Phase number to audit against (required unless --no-plan)
 *   --no-plan               Skip smoke plan; per-session auditor runs catalog-only
 *   --classify              Universal mode: classify each session and audit against the
 *                           matched rubric (dev/meta-improvement/rubrics/). No --phase needed.
 *   --since=<duration>      Filter Pending by recency (e.g., 24h, 7d, 30m)
 *   --target-project=<name> Filter Pending by target project basename
 *   --session-id=<uuid>     Audit a single session (must be in Pending or use --transcript)
 *   --transcript=<path>     Audit a single transcript not in index (synthetic marker)
 *   --force                 Re-audit sessions already in Processed (overwrite report)
 *   --dry-run               Print what would be audited; don't spawn auditor
 *   --skip-aggregate        Skip phase-summary aggregator (per-session only)
 *   --re-aggregate          Rebuild phase aggregate + summary from all Processed
 *                           reports for the phase, without re-running per-session
 *                           audits. Requires --phase=<N>.
 *   --help, -h              Print help
 *
 * Env:
 *   CLAUDE_CLI_PATH         Override path to `claude` binary (default: PATH)
 *   AUDIT_SMOKE_TIMEOUT_MS  Per-auditor spawn timeout (default: 1200000 = 20 min)
 *
 * Exit codes:
 *   0  — success (all sessions audited, no FAIL status)
 *   1  — fatal error (repo root not found, args invalid, etc.)
 *   2  — args validation failed
 *   3  — one or more sessions ended with status: fail
 *
 * Per DEC-DEV-0034.
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const auditIndex = require('./audit-index.js');
const classify = require('./classify.js');
const effectProbe = require('./effect-probe.js');

const DEFAULT_CLAUDE_BIN = process.env.CLAUDE_CLI_PATH || 'claude';
const AUDITOR_TIMEOUT_MS = parseInt(process.env.AUDIT_SMOKE_TIMEOUT_MS || '1200000', 10);
const MAX_TRANSCRIPT_CHARS = 2000;
const RELEVANT_TOOLS = new Set([
  'Write', 'Edit', 'NotebookEdit', 'Bash', 'SlashCommand', 'Agent', 'Read', 'Task',
]);

// ============================================================================
// Args
// ============================================================================

function parseArgs(argv) {
  const out = {
    phase: null, since: null, target: null, sessionId: null, transcript: null,
    force: false, dryRun: false, noPlan: false, skipAggregate: false,
    reAggregate: false, help: false, classify: false,
  };
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--force') out.force = true;
    else if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--no-plan') out.noPlan = true;
    else if (arg === '--skip-aggregate') out.skipAggregate = true;
    else if (arg === '--re-aggregate') out.reAggregate = true;
    else if (arg === '--classify') out.classify = true;
    else if (arg.startsWith('--phase=')) out.phase = parseInt(arg.slice(8), 10);
    else if (arg.startsWith('--since=')) out.since = arg.slice(8);
    else if (arg.startsWith('--target-project=')) out.target = arg.slice(17);
    else if (arg.startsWith('--session-id=')) out.sessionId = arg.slice(13);
    else if (arg.startsWith('--transcript=')) out.transcript = arg.slice(13);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return out;
}

function printHelp() {
  const header = `${path.basename(__filename)} — D7 conformance auditor CLI`;
  process.stdout.write(`${header}\n\n`);
  process.stdout.write(fs.readFileSync(__filename, 'utf-8').split('\n').slice(2, 38).join('\n').replace(/^ \* ?/gm, '') + '\n');
}

// ============================================================================
// Repo root
// ============================================================================

function findRepoRoot(start) {
  let dir = path.resolve(start);
  while (dir !== path.parse(dir).root) {
    if (fs.existsSync(path.join(dir, 'CLAUDE.md')) && fs.existsSync(path.join(dir, 'DEV_JOURNAL.md'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  const scriptRepoRoot = path.resolve(__dirname, '..', '..', '..');
  if (fs.existsSync(path.join(scriptRepoRoot, 'CLAUDE.md')) && fs.existsSync(path.join(scriptRepoRoot, 'DEV_JOURNAL.md'))) {
    return scriptRepoRoot;
  }
  return null;
}

// ============================================================================
// Plan parsing
// ============================================================================

function parsePlan(planPath) {
  const content = fs.readFileSync(planPath, 'utf-8');
  const scenarios = [];
  let current = null;
  for (const rawLine of content.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    const headerMatch = line.match(/^###\s+(S\d+)\s+(?:—|--)\s+(.+?)(?:\s+—\s+|\s+--\s+|$)/);
    if (headerMatch) {
      if (current) scenarios.push(current);
      current = { id: headerMatch[1], title: headerMatch[2].trim(), acceptance: [] };
      continue;
    }
    if (current) {
      const accMatch = line.match(/^\s*-\s+\[[ xX]\]\s+(.+)$/);
      if (accMatch) current.acceptance.push(accMatch[1].trim());
    }
  }
  if (current) scenarios.push(current);
  return scenarios;
}

// ============================================================================
// Time
// ============================================================================

function parseSinceDuration(s) {
  if (!s) return null;
  const m = s.match(/^(\d+)(m|h|d)$/);
  if (!m) throw new Error(`Invalid --since value: ${s} (expected e.g. 24h, 7d, 30m)`);
  const n = parseInt(m[1], 10);
  const mult = { m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 }[m[2]];
  return n * mult;
}

// ============================================================================
// Discovery
// ============================================================================

function discoverSessions(repoRoot, args) {
  // Override forms first
  if (args.transcript) {
    const tpath = path.resolve(args.transcript);
    if (!fs.existsSync(tpath)) throw new Error(`Transcript not found: ${tpath}`);
    const sid = args.sessionId || path.basename(tpath, path.extname(tpath));
    return [{
      session_id: sid,
      ended_at: new Date().toISOString(),
      target_project: '(override)',
      transcript_path: tpath,
      reason: 'override',
      source: 'override',
    }];
  }

  // From audit-index Pending
  const indexContent = auditIndex.readIndex(repoRoot);
  let pending = auditIndex.parsePending(indexContent);

  // Filter by session-id
  if (args.sessionId) {
    pending = pending.filter((p) => p.session_id === args.sessionId);
    if (pending.length === 0) {
      throw new Error(`Session ${args.sessionId} not found in Pending. Pass --transcript=<path> to audit ad-hoc.`);
    }
  }

  // Filter by target-project
  if (args.target) {
    pending = pending.filter((p) => p.target_project === args.target);
  }

  // Filter by --since
  if (args.since) {
    const cutoffMs = Date.now() - parseSinceDuration(args.since);
    pending = pending.filter((p) => {
      const t = Date.parse(p.ended_at);
      return Number.isFinite(t) && t >= cutoffMs;
    });
  }

  // Filter by force / already-processed
  if (!args.force) {
    const processed = auditIndex.parseProcessed(indexContent);
    const processedIds = new Set(processed.map((p) => p.session_id));
    pending = pending.filter((p) => !processedIds.has(p.session_id));
  }

  return pending.map((p) => ({ ...p, source: 'index' }));
}

// ============================================================================
// Transcript pre-processing
// ============================================================================

function preprocessTranscript(srcPath, dstPath) {
  const lines = fs.readFileSync(srcPath, 'utf-8').split('\n');
  const out = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    let rec;
    try { rec = JSON.parse(line); } catch { continue; }
    if (!isRelevantRecord(rec)) continue;
    out.push(JSON.stringify(stripLargeContent(rec)));
  }
  fs.writeFileSync(dstPath, out.join('\n'));
  return out.length;
}

function isRelevantRecord(rec) {
  const role = rec?.message?.role;
  const content = rec?.message?.content;
  if (!Array.isArray(content)) return false;
  if (role === 'user') {
    return content.some((b) => b && (b.type === 'text' || b.type === 'tool_result'));
  }
  if (role === 'assistant') {
    return content.some((b) => b && b.type === 'tool_use' && RELEVANT_TOOLS.has(b.name));
  }
  return false;
}

function stripLargeContent(rec) {
  const clone = JSON.parse(JSON.stringify(rec));
  const content = clone.message?.content;
  if (!Array.isArray(content)) return clone;
  for (const block of content) {
    if (!block) continue;
    if (block.type === 'text' && typeof block.text === 'string' && block.text.length > MAX_TRANSCRIPT_CHARS) {
      block.text = block.text.slice(0, MAX_TRANSCRIPT_CHARS) + `\n...[truncated, original length ${block.text.length}]`;
    }
    if (block.type === 'tool_result' && typeof block.content === 'string' && block.content.length > MAX_TRANSCRIPT_CHARS) {
      block.content = block.content.slice(0, MAX_TRANSCRIPT_CHARS) + `\n...[truncated, original length ${block.content.length}]`;
    }
    if (block.type === 'tool_use' && block.input && typeof block.input === 'object') {
      for (const key of Object.keys(block.input)) {
        const v = block.input[key];
        if (typeof v === 'string' && v.length > MAX_TRANSCRIPT_CHARS) {
          block.input[key] = v.slice(0, MAX_TRANSCRIPT_CHARS) + `\n...[truncated, original length ${v.length}]`;
        }
      }
    }
  }
  return clone;
}

// ============================================================================
// Auditor spawn
// ============================================================================

// Render an effect-probe object into the prompt block. Caps the findings list so a
// messy pilot can't blow up the prompt; counts stay authoritative.
function renderEffectProbe(probe) {
  if (!probe || !probe.applicable) return 'none';
  const clone = JSON.parse(JSON.stringify(probe));
  const ps = clone.post_state;
  if (ps && Array.isArray(ps.findings) && ps.findings.length > 60) {
    const total = ps.findings.length;
    // Keep blocking first, then the rest, up to 60.
    const ordered = ps.findings.slice().sort((a, b) => (a.severity === 'blocking' ? -1 : 1) - (b.severity === 'blocking' ? -1 : 1));
    ps.findings = ordered.slice(0, 60);
    ps.findings_truncated = `showing 60 of ${total} (counts above are full)`;
  }
  return '```json\n' + JSON.stringify(clone, null, 2) + '\n```';
}

function runAuditor(opts) {
  const templatePath = path.join(opts.repoRoot, 'dev', 'meta-improvement', 'prompts', 'session-audit.md');
  const template = fs.readFileSync(templatePath, 'utf-8');
  const prompt = template
    .replace(/\{\{SESSION_ID\}\}/g, opts.sessionId)
    .replace(/\{\{TRANSCRIPT_PATH\}\}/g, opts.transcriptPath)
    .replace(/\{\{REPO_ROOT\}\}/g, opts.repoRoot)
    .replace(/\{\{REPORT_PATH\}\}/g, opts.reportPath)
    .replace(/\{\{SESSION_END_REASON\}\}/g, opts.sessionEndReason || 'unknown')
    .replace(/\{\{PHASE\}\}/g, opts.phase != null ? String(opts.phase) : 'none')
    .replace(/\{\{SMOKE_PLAN_PATH\}\}/g, opts.smokePlanPath || 'none')
    .replace(/\{\{SESSION_CLASS\}\}/g, opts.sessionClass || 'none')
    .replace(/\{\{CLASS_CONFIDENCE\}\}/g, opts.classConfidence || 'none')
    .replace(/\{\{SESSION_PROFILE\}\}/g, opts.sessionProfile || 'none')
    .replace(/\{\{RUBRIC_BLOCK\}\}/g, opts.rubricBlock || '')
    .replace(/\{\{EFFECT_PROBE\}\}/g, opts.effectProbe || 'none');

  const transcriptDir = path.dirname(opts.transcriptPath);
  const cliArgs = [
    '-p',
    '--permission-mode', 'acceptEdits',
    '--add-dir', transcriptDir,
  ];

  return spawnSync(opts.claudeBin, cliArgs, {
    input: prompt,
    encoding: 'utf-8',
    timeout: AUDITOR_TIMEOUT_MS,
    cwd: opts.repoRoot,
    shell: process.platform === 'win32',
    maxBuffer: 50 * 1024 * 1024,
  });
}

function runAggregator(opts) {
  const templatePath = path.join(opts.repoRoot, 'dev', 'meta-improvement', 'prompts', 'phase-audit-summary.md');
  if (!fs.existsSync(templatePath)) {
    return { status: 1, stderr: `Aggregator template not found: ${templatePath}` };
  }
  const template = fs.readFileSync(templatePath, 'utf-8');
  const prompt = template
    .replace(/\{\{PHASE\}\}/g, String(opts.phase))
    .replace(/\{\{AGGREGATE_JSON_PATH\}\}/g, opts.aggregateJsonPath)
    .replace(/\{\{REPORTS_DIR\}\}/g, opts.reportsDir)
    .replace(/\{\{SMOKE_PLAN_PATH\}\}/g, opts.smokePlanPath || 'none')
    .replace(/\{\{REPORT_PATH\}\}/g, opts.reportPath)
    .replace(/\{\{REPO_ROOT\}\}/g, opts.repoRoot);

  return spawnSync(opts.claudeBin, ['-p', '--permission-mode', 'acceptEdits'], {
    input: prompt,
    encoding: 'utf-8',
    timeout: AUDITOR_TIMEOUT_MS,
    cwd: opts.repoRoot,
    shell: process.platform === 'win32',
    maxBuffer: 50 * 1024 * 1024,
  });
}

// ============================================================================
// Report frontmatter parsing (minimal YAML — supports our schema only)
// ============================================================================

function parseReportFrontmatter(content) {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!m) return null;
  return parseSimpleYaml(m[1]);
}

function parseSimpleYaml(yaml) {
  const result = {};
  const lines = yaml.split(/\r?\n/);
  let currentMap = null;
  let currentMapKey = null;
  let inFindings = false;
  let currentFinding = null;
  result.findings = [];

  for (const raw of lines) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;

    // Top-level key
    const topMatch = raw.match(/^([\w_]+):\s*(.*)$/);
    if (topMatch && !raw.startsWith(' ') && !raw.startsWith('\t')) {
      if (inFindings && currentFinding) result.findings.push(currentFinding);
      currentFinding = null;
      inFindings = false;
      currentMap = null;
      currentMapKey = null;

      const key = topMatch[1];
      const value = topMatch[2];
      if (value === '') {
        if (key === 'findings') {
          inFindings = true;
        } else {
          result[key] = {};
          currentMap = result[key];
          currentMapKey = key;
        }
      } else {
        result[key] = parseScalar(value);
      }
      continue;
    }

    // Findings: array item start
    if (inFindings) {
      const itemMatch = raw.match(/^\s*-\s+([\w_]+):\s*(.*)$/);
      if (itemMatch) {
        if (currentFinding) result.findings.push(currentFinding);
        currentFinding = {};
        currentFinding[itemMatch[1]] = parseScalar(itemMatch[2]);
        continue;
      }
      const contMatch = raw.match(/^\s+([\w_]+):\s*(.*)$/);
      if (contMatch && currentFinding) {
        currentFinding[contMatch[1]] = parseScalar(contMatch[2]);
        continue;
      }
    }

    // Nested key (1-level under previous top map)
    const nestedMatch = raw.match(/^\s+([\w_]+):\s*(.*)$/);
    if (nestedMatch && currentMap) {
      currentMap[nestedMatch[1]] = parseScalar(nestedMatch[2]);
    }
  }

  if (inFindings && currentFinding) result.findings.push(currentFinding);
  return result;
}

function parseScalar(s) {
  s = (s || '').trim();
  if (s === '') return null;
  if (s === 'null' || s === '~') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  if (/^-?\d+\.\d+$/.test(s)) return parseFloat(s);
  if (/^['"](.*)['"]$/.test(s)) return s.slice(1, -1);
  return s;
}

// ============================================================================
// Aggregate computation (deterministic)
// ============================================================================

const VERDICT_PRECEDENCE = ['COVERED', 'PARTIAL', 'FAIL', 'UNCERTAIN', 'NOT-COVERED'];

function pickBestVerdict(verdicts) {
  if (verdicts.length === 0) return 'NOT-COVERED';
  for (const v of VERDICT_PRECEDENCE) {
    if (verdicts.includes(v)) return v;
  }
  return 'NOT-COVERED';
}

function computeAggregate(reports, plan, phase) {
  const matrix = {};
  for (const sc of plan) {
    matrix[sc.id] = {
      title: sc.title,
      by_session: {},
      best_verdict: 'NOT-COVERED',
      conflict: false,
    };
  }

  for (const r of reports) {
    const sid = r.frontmatter.session_id || r.session.session_id;
    const scenarios = r.frontmatter.scenarios || {};
    for (const [scId, verdict] of Object.entries(scenarios)) {
      if (!matrix[scId]) {
        matrix[scId] = { title: '(not in plan)', by_session: {}, best_verdict: 'NOT-COVERED', conflict: false };
      }
      matrix[scId].by_session[sid] = String(verdict).toUpperCase().replace(/^[^A-Z]+/, '');
    }
  }

  for (const id of Object.keys(matrix)) {
    const verdicts = Object.values(matrix[id].by_session);
    matrix[id].best_verdict = pickBestVerdict(verdicts);
    const distinctActive = new Set(verdicts.filter((v) => v !== 'NOT-COVERED'));
    matrix[id].conflict = distinctActive.size > 1;
  }

  const coverage_summary = {
    total_scenarios: plan.length,
    covered: 0, partial: 0, fail: 0, not_covered: 0, uncertain: 0,
  };
  for (const m of Object.values(matrix)) {
    const v = m.best_verdict;
    if (v === 'COVERED') coverage_summary.covered++;
    else if (v === 'PARTIAL') coverage_summary.partial++;
    else if (v === 'FAIL') coverage_summary.fail++;
    else if (v === 'UNCERTAIN') coverage_summary.uncertain++;
    else coverage_summary.not_covered++;
  }

  // Findings: raw union, group by (check_id, artifact, severity)
  const groups = new Map();
  for (const r of reports) {
    const sid = r.frontmatter.session_id || r.session.session_id;
    for (const f of (r.frontmatter.findings || [])) {
      const key = `${f.check_id || '?'}|${f.artifact || '?'}|${f.severity || '?'}`;
      if (!groups.has(key)) {
        groups.set(key, {
          check_id: f.check_id, severity: f.severity, confidence: f.confidence,
          artifact: f.artifact, snippet: f.snippet,
          sessions: [],
        });
      }
      groups.get(key).sessions.push(sid);
    }
  }
  const findings = Array.from(groups.values());

  const findings_count = { blocking: 0, warning: 0, info: 0, uncertain: 0 };
  for (const f of findings) {
    const sev = (f.severity || '').toLowerCase();
    if (sev === 'blocking') findings_count.blocking++;
    else if (sev === 'warning') findings_count.warning++;
    else if (sev === 'info') findings_count.info++;
    else if (sev === 'uncertain') findings_count.uncertain++;
  }

  let status = 'clean';
  if (coverage_summary.fail > 0) status = 'fail';
  else if (coverage_summary.partial > 0) status = 'partial';
  else if (findings_count.blocking > 0) status = 'fail';
  else if (findings_count.warning > 0 || findings_count.info > 0) status = 'findings';

  return {
    phase,
    aggregated_at: new Date().toISOString(),
    sessions: reports.map((r) => r.frontmatter.session_id || r.session.session_id),
    sessions_count: reports.length,
    status,
    coverage_summary,
    coverage_matrix: matrix,
    findings,
    findings_count,
  };
}

// ============================================================================
// Main
// ============================================================================

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(`Error: ${e.message}\n`);
    process.exit(2);
  }

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const repoRoot = findRepoRoot(process.cwd());
  if (!repoRoot) {
    process.stderr.write('Error: could not locate ecosystem repo root from cwd or script location.\n');
    process.exit(1);
  }

  // Validate
  if (args.reAggregate) {
    if (args.phase == null) {
      process.stderr.write('Error: --re-aggregate requires --phase=<N>.\n');
      process.exit(2);
    }
    if (args.noPlan) {
      process.stderr.write('Error: --re-aggregate is incompatible with --no-plan (aggregator needs the plan).\n');
      process.exit(2);
    }
    if (args.sessionId || args.transcript || args.force || args.dryRun || args.skipAggregate) {
      process.stderr.write('Error: --re-aggregate is incompatible with --session-id, --transcript, --force, --dry-run, --skip-aggregate.\n');
      process.exit(2);
    }
  } else if (args.phase == null && !args.noPlan && !args.sessionId && !args.transcript && !args.classify) {
    process.stderr.write('Error: --phase=<N> is required (or pass --classify, --no-plan, --session-id, --transcript).\n');
    process.exit(2);
  }

  // Locate smoke plan
  let smokePlanPath = null;
  let plan = null;
  if (args.phase != null && !args.noPlan) {
    const live = path.join(repoRoot, 'dev', `PHASE_${args.phase}_SMOKE_TEST_PLAN.md`);
    const archived = path.join(repoRoot, 'dev', '_archive', `phase-${args.phase}`, `PHASE_${args.phase}_SMOKE_TEST_PLAN.md`);
    if (fs.existsSync(live)) smokePlanPath = live;
    else if (fs.existsSync(archived)) smokePlanPath = archived;

    if (smokePlanPath) {
      plan = parsePlan(smokePlanPath);
      process.stdout.write(`Loaded smoke plan: ${path.relative(repoRoot, smokePlanPath)} (${plan.length} scenarios)\n`);
    } else {
      process.stdout.write(`Smoke plan not found for Phase ${args.phase}; running catalog-only.\n`);
    }
  }

  // Re-aggregate path: rebuild aggregate JSON + summary from existing Processed reports
  if (args.reAggregate) {
    if (!plan) {
      process.stderr.write(`Error: --re-aggregate requires a loadable smoke plan for phase ${args.phase}.\n`);
      process.exit(1);
    }
    const reportsDir = path.join(repoRoot, 'dev', 'meta-improvement', 'audit-reports');
    fs.mkdirSync(reportsDir, { recursive: true });

    const indexContent = auditIndex.readIndex(repoRoot);
    const processed = auditIndex.parseProcessed(indexContent);
    const phaseStr = String(args.phase);
    const targetRows = processed.filter((p) => String(p.phase) === phaseStr);

    if (targetRows.length === 0) {
      process.stderr.write(`Error: no Processed sessions found for phase ${args.phase} in audit-index.\n`);
      process.exit(1);
    }

    process.stdout.write(`Re-aggregating ${targetRows.length} Processed session(s) for phase ${args.phase}…\n`);

    const reports = [];
    for (const row of targetRows) {
      const reportPath = path.join(reportsDir, `${row.session_id}.md`);
      if (!fs.existsSync(reportPath)) {
        process.stderr.write(`  warning: report missing for ${row.session_id} at ${path.relative(repoRoot, reportPath)}; skipping\n`);
        continue;
      }
      let frontmatter;
      try {
        const reportContent = fs.readFileSync(reportPath, 'utf-8');
        frontmatter = parseReportFrontmatter(reportContent);
      } catch (e) {
        process.stderr.write(`  warning: report parse failed for ${row.session_id}: ${e.message}\n`);
        continue;
      }
      if (!frontmatter) {
        process.stderr.write(`  warning: report frontmatter unparseable for ${row.session_id}\n`);
        continue;
      }
      reports.push({
        session: { session_id: row.session_id, target_project: row.target_project },
        frontmatter,
        reportPath,
      });
      process.stdout.write(`  loaded ${row.session_id} (status=${frontmatter.status})\n`);
    }

    if (reports.length === 0) {
      process.stderr.write('Error: no parseable per-session reports found for phase.\n');
      process.exit(1);
    }

    process.stdout.write(`\nComputing aggregate from ${reports.length} report(s)…\n`);
    const aggregate = computeAggregate(reports, plan, args.phase);
    const aggregatePath = path.join(reportsDir, `phase-${args.phase}-aggregate.json`);
    fs.writeFileSync(aggregatePath, JSON.stringify(aggregate, null, 2));
    process.stdout.write(`Aggregate JSON: ${path.relative(repoRoot, aggregatePath)}\n`);

    const summaryPath = path.join(reportsDir, `phase-${args.phase}-summary.md`);
    process.stdout.write('Running aggregator…\n');
    const aggResult = runAggregator({
      aggregateJsonPath: aggregatePath,
      reportsDir,
      smokePlanPath,
      phase: args.phase,
      reportPath: summaryPath,
      repoRoot,
      claudeBin: DEFAULT_CLAUDE_BIN,
    });
    if (aggResult.status === 0 && fs.existsSync(summaryPath)) {
      process.stdout.write(`Phase summary: ${path.relative(repoRoot, summaryPath)}\n`);
    } else {
      process.stderr.write(`Aggregator failed (exit ${aggResult.status}).\n`);
      if (aggResult.error) process.stderr.write(`  error: ${aggResult.error.message}\n`);
      if (aggResult.stderr) process.stderr.write(`  stderr: ${String(aggResult.stderr).slice(0, 500)}\n`);
      process.exit(1);
    }

    const failed = reports.filter((r) => r.frontmatter.status === 'fail').length;
    const partial = reports.filter((r) => r.frontmatter.status === 'partial').length;
    process.stdout.write(`\nDone: ${reports.length} session(s) re-aggregated; ${failed} FAIL; ${partial} PARTIAL\n`);
    process.exit(failed > 0 ? 3 : 0);
  }

  // Discover sessions
  let sessions;
  try {
    sessions = discoverSessions(repoRoot, args);
  } catch (e) {
    process.stderr.write(`Error: ${e.message}\n`);
    process.exit(1);
  }

  if (sessions.length === 0) {
    process.stdout.write('No sessions to audit (Pending empty after filters).\n');
    process.exit(0);
  }

  process.stdout.write(`Found ${sessions.length} session(s) to audit.\n`);

  if (args.dryRun) {
    for (const s of sessions) {
      process.stdout.write(`  [dry-run] would audit ${s.session_id} (target=${s.target_project}; src=${s.source})\n`);
    }
    process.exit(0);
  }

  // Prepare dirs
  const reportsDir = path.join(repoRoot, 'dev', 'meta-improvement', 'audit-reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-smoke-'));

  // Load rubric registry once (classify mode)
  let rubrics = null;
  if (args.classify) {
    try {
      rubrics = classify.loadRubrics(repoRoot);
      process.stdout.write(`Classify mode: loaded ${rubrics.length} rubric(s).\n`);
    } catch (e) {
      process.stderr.write(`Error: failed to load rubrics: ${e.message}\n`);
      process.exit(1);
    }
  }

  // Per-session audit loop
  const succeeded = [];
  for (const session of sessions) {
    process.stdout.write(`\nAuditing ${session.session_id} (target=${session.target_project})…\n`);

    if (!fs.existsSync(session.transcript_path)) {
      process.stderr.write(`  transcript not found: ${session.transcript_path}; skipping\n`);
      continue;
    }

    const reportPath = path.join(reportsDir, `${session.session_id}.md`);
    const tmpTranscript = path.join(tmpDir, `${session.session_id}.jsonl`);

    let recordCount;
    try {
      recordCount = preprocessTranscript(session.transcript_path, tmpTranscript);
    } catch (e) {
      process.stderr.write(`  pre-processing failed: ${e.message}\n`);
      continue;
    }
    process.stdout.write(`  preprocessed: ${recordCount} relevant records\n`);

    // Classify (universal mode) — deterministic pre-pass picks the rubric
    let classification = null;
    let rubricBlock = '';
    let sessionProfile = '';
    if (args.classify && rubrics) {
      try {
        const signals = classify.extractSignals(session.transcript_path, session, { repoRoot });
        classification = classify.classifySession(signals, rubrics);
        const rubric = rubrics.find((r) => r.id === classification.class)
          || rubrics.find((r) => r.id === 'mixed-uncertain');
        if (rubric) {
          rubricBlock = classify.renderRubricBlock(rubric, classification);
          sessionProfile = classify.renderSessionProfile(signals);
        }
        process.stdout.write(`  classified: ${classification.class} (confidence=${classification.confidence})\n`);
      } catch (e) {
        process.stderr.write(`  classification failed: ${e.message}; auditor runs catalog-only\n`);
      }
    }

    // Effect-probe (universal mode only, G4): deterministic measure of the session's effect
    // on the pilot's .product/. Uses the ORIGINAL transcript (needs timestamp/cwd/gitBranch).
    // Non-fatal: on failure or no .product/, the auditor runs without it (EFFECT_PROBE=none).
    let effectProbeBlock = 'none';
    if (args.classify) {
      try {
        const probe = effectProbe.buildEffectProbe({
          transcriptPath: session.transcript_path,
          sessionId: session.session_id,
          targetProject: session.target_project,
        });
        if (probe && probe.applicable) {
          const probePath = path.join(tmpDir, `${session.session_id}.effect-probe.json`);
          fs.writeFileSync(probePath, JSON.stringify(probe, null, 2));
          effectProbeBlock = renderEffectProbe(probe);
          const fc = probe.post_state.findings_count;
          process.stdout.write(`  effect-probe: ${fc.blocking}B/${fc.warning}W post-state, ${probe.post_state.findings_attributed_to_session} attributed to session\n`);
        } else {
          process.stdout.write(`  effect-probe: n/a (${probe ? probe.reason : 'no probe'})\n`);
        }
      } catch (e) {
        process.stderr.write(`  effect-probe failed: ${e.message}; auditor runs without it\n`);
      }
    }

    const result = runAuditor({
      sessionId: session.session_id,
      transcriptPath: tmpTranscript,
      phase: args.phase,
      smokePlanPath,
      repoRoot,
      reportPath,
      sessionEndReason: session.reason || 'unknown',
      claudeBin: DEFAULT_CLAUDE_BIN,
      sessionClass: classification ? classification.class : '',
      classConfidence: classification ? classification.confidence : '',
      rubricBlock,
      sessionProfile,
      effectProbe: effectProbeBlock,
    });

    // A non-zero exit or spawn error (e.g. ETIMEDOUT) does not by itself mean
    // the audit failed: `claude -p` can finish writing the report and then be
    // killed for not terminating within the spawn timeout. Treat the report
    // file as the source of truth — salvage it when it exists and parses, and
    // only hard-fail when no usable report was produced.
    const exitProblem = result.error
      ? `spawn error: ${result.error.message}`
      : (result.status !== 0 ? `auditor exited ${result.status}` : null);

    if (!fs.existsSync(reportPath)) {
      process.stderr.write(`  ${exitProblem || 'auditor finished'} — report missing at ${reportPath}\n`);
      if (result.stdout) process.stderr.write(`  stdout (head): ${String(result.stdout).slice(0, 1500)}\n`);
      if (result.stderr) process.stderr.write(`  stderr (head): ${String(result.stderr).slice(0, 1500)}\n`);
      continue;
    }

    let frontmatter;
    try {
      const reportContent = fs.readFileSync(reportPath, 'utf-8');
      frontmatter = parseReportFrontmatter(reportContent);
    } catch (e) {
      process.stderr.write(`  report parse failed: ${e.message}\n`);
      continue;
    }
    if (!frontmatter) {
      process.stderr.write(`  report frontmatter unparseable\n`);
      if (exitProblem) process.stderr.write(`  (auditor also reported: ${exitProblem})\n`);
      continue;
    }

    if (exitProblem) {
      process.stdout.write(`  ⚠ ${exitProblem} — but a parseable report was written; salvaging.\n`);
    }

    succeeded.push({ session, frontmatter, reportPath });

    try {
      if (session.source === 'index') {
        auditIndex.moveToProcessed(repoRoot, session.session_id, {
          audited_at: frontmatter.audited_at || new Date().toISOString(),
          target_project: session.target_project,
          phase: args.classify ? '—' : (frontmatter.phase != null ? frontmatter.phase : (args.phase != null ? args.phase : '—')),
          mode: (args.classify && classification) ? `class:${classification.class}` : (frontmatter.mode || (smokePlanPath ? 'full' : 'catalog-only')),
          status: frontmatter.status || 'error',
          coverage_summary: frontmatter.coverage_summary,
          findings_count: frontmatter.findings_count,
          report_path: reportPath,
        });
      }
      process.stdout.write(`  ✓ status=${frontmatter.status} → ${path.relative(repoRoot, reportPath)}\n`);
    } catch (e) {
      process.stderr.write(`  warning: index update failed: ${e.message}\n`);
    }
  }

  // Aggregate phase
  if (succeeded.length > 0 && plan && args.phase != null && !args.skipAggregate) {
    process.stdout.write('\nComputing aggregate…\n');
    const aggregate = computeAggregate(succeeded, plan, args.phase);
    const aggregatePath = path.join(reportsDir, `phase-${args.phase}-aggregate.json`);
    fs.writeFileSync(aggregatePath, JSON.stringify(aggregate, null, 2));
    process.stdout.write(`Aggregate JSON: ${path.relative(repoRoot, aggregatePath)}\n`);

    const summaryPath = path.join(reportsDir, `phase-${args.phase}-summary.md`);
    process.stdout.write('Running aggregator…\n');
    const aggResult = runAggregator({
      aggregateJsonPath: aggregatePath,
      reportsDir,
      smokePlanPath,
      phase: args.phase,
      reportPath: summaryPath,
      repoRoot,
      claudeBin: DEFAULT_CLAUDE_BIN,
    });
    if (aggResult.status === 0 && fs.existsSync(summaryPath)) {
      process.stdout.write(`Phase summary: ${path.relative(repoRoot, summaryPath)}\n`);
    } else {
      process.stderr.write(`Aggregator failed (exit ${aggResult.status}).\n`);
      if (aggResult.stderr) process.stderr.write(`  stderr: ${String(aggResult.stderr).slice(0, 500)}\n`);
    }
  }

  // Cleanup tmp
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}

  // Final tally
  const failed = succeeded.filter((r) => r.frontmatter.status === 'fail').length;
  const partial = succeeded.filter((r) => r.frontmatter.status === 'partial').length;
  process.stdout.write(`\nDone: ${succeeded.length}/${sessions.length} audited; ${failed} FAIL; ${partial} PARTIAL\n`);
  process.exit(failed > 0 ? 3 : 0);
}

main();
