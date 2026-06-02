#!/usr/bin/env node
/**
 * patch-synth.js — patch synthesizer (G6) for Session Audit v2, Increment 3c.
 *
 * Closes the loop «journal → ecosystem improvement» WITHOUT auto-apply (CONVENTIONS §8):
 *   1. (deterministic) cluster the findings journal by (zone, check_id); keep systemic clusters
 *      (≥3 distinct findings or ≥3 instances) that still have `open` records.
 *   2. (LLM) for each cluster, run `prompts/patch-synth.md` via `claude -p`:
 *        Stage 1 ADVERSARIAL-VERIFY (≥3 independent skeptic lenses, default-refute) — this is the
 *        hard requirement from DEC-DEV-0057 Lesson #1 (a phantom finding that survives becomes a bad
 *        patch). Stage 2: if it survives, draft a patch candidate (problem, evidence, target files,
 *        type, risk, confidence). The synthesizer PROPOSES; a human runs the [Y/N/E/D] gate.
 *   3. write the candidate to patch-candidates/<zone>__<check>.md; mark journal records
 *      `patch-proposed` (survived) or `clustered` (refuted) so they are not re-synthesized.
 *
 * NO auto-fix, no commits, no source edits — only candidate files. Product-session audit only. D7 dev-only.
 *
 * CLI:
 *   node patch-synth.js --dry-run             # cluster + list systemic + render ONE prompt (no LLM)
 *   node patch-synth.js                        # synth all systemic open clusters
 *   node patch-synth.js --cluster=D2B-behavioral:C   # one cluster
 *   node patch-synth.js --limit=2 [--force] [--journal=...] [--candidates-dir=...]
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const auditJournal = require('./audit-journal.js');

const PROMOTE_INSTANCES = 3;
const SEVERITY_RANK = { blocking: 3, warning: 2, info: 1, uncertain: 0 };
const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude';
const SYNTH_TIMEOUT_MS = 600000; // 10 min — the synthesizer reads many repo files to verify.

function repoRootFrom(scriptDir) {
  return path.resolve(scriptDir, '..', '..', '..');
}

function maxSev(a, b) {
  return (SEVERITY_RANK[a] || 0) >= (SEVERITY_RANK[b] || 0) ? a : b;
}

/**
 * Group journal records into (zone, check_id) clusters carrying their full records as evidence.
 * systemic = ≥PROMOTE_INSTANCES distinct findings OR ≥PROMOTE_INSTANCES total instances.
 */
function buildClusters(map) {
  const byKey = new Map();
  for (const r of map.values()) {
    const key = `${r.zone}|${r.check_id}`;
    if (!byKey.has(key)) byKey.set(key, { zone: r.zone, check_id: r.check_id, records: [] });
    byKey.get(key).records.push(r);
  }
  const clusters = [];
  for (const c of byKey.values()) {
    const sessions = new Set();
    let instances = 0;
    let severity = 'uncertain';
    let openCount = 0;
    for (const r of c.records) {
      (r.session_ids || []).forEach((s) => sessions.add(s));
      instances += r.instances || (r.session_ids ? r.session_ids.length : 0);
      severity = maxSev(severity, r.severity);
      if ((r.status || 'open') === 'open') openCount++;
    }
    clusters.push({
      zone: c.zone,
      check_id: c.check_id,
      key: `${c.zone}:${c.check_id}`,
      distinct: c.records.length,
      instances,
      sessions: sessions.size,
      severity,
      openCount,
      systemic: c.records.length >= PROMOTE_INSTANCES || instances >= PROMOTE_INSTANCES,
      records: c.records,
    });
  }
  return clusters.sort((a, b) =>
    Number(b.systemic) - Number(a.systemic)
    || (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0)
    || b.instances - a.instances);
}

function clusterPayload(cluster) {
  return {
    zone: cluster.zone,
    check_id: cluster.check_id,
    distinct_findings: cluster.distinct,
    total_sessions: cluster.sessions,
    total_instances: cluster.instances,
    max_severity: cluster.severity,
    findings: cluster.records.map((r) => ({
      finding_id: r.finding_id,
      artifact: r.artifact,
      signature: r.signature,
      snippet: r.snippet,
      severity: r.severity,
      confidence: r.confidence,
      status: r.status,
      session_ids: r.session_ids,
      first_seen: r.first_seen,
      last_seen: r.last_seen,
    })),
  };
}

function candidateFile(dir, cluster) {
  const safe = `${cluster.zone}__${cluster.check_id}`.replace(/[^\w.-]/g, '-');
  return path.join(dir, `${safe}.md`);
}

function renderPrompt(template, { zone, checkId, clusterJson, repoRoot, candidatePath }) {
  return template
    .replace(/\{\{ZONE\}\}/g, zone)
    .replace(/\{\{CHECK_ID\}\}/g, checkId)
    .replace(/\{\{CLUSTER_JSON\}\}/g, '```json\n' + clusterJson + '\n```')
    .replace(/\{\{REPO_ROOT\}\}/g, repoRoot)
    .replace(/\{\{CANDIDATE_PATH\}\}/g, candidatePath);
}

function readVerdict(candidatePath) {
  try {
    const c = fs.readFileSync(candidatePath, 'utf-8');
    const m = c.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!m) return null;
    const v = m[1].match(/^verdict:\s*(\w+)/m);
    const g = m[1].match(/^gate:\s*(\w+)/m);
    return { verdict: v ? v[1] : null, gate: g ? g[1] : null };
  } catch { return null; }
}

function setClusterStatus(map, cluster, status) {
  for (const r of cluster.records) {
    const rec = map.get(r.finding_id);
    if (rec && (rec.status === 'open' || rec.status === 'clustered')) rec.status = status;
  }
}

function parseArgs(argv) {
  const out = { dryRun: false, cluster: null, limit: Infinity, force: false, journal: null, candidatesDir: null };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--force') out.force = true;
    else if (a.startsWith('--cluster=')) out.cluster = a.slice('--cluster='.length);
    else if (a.startsWith('--limit=')) out.limit = parseInt(a.slice('--limit='.length), 10) || Infinity;
    else if (a.startsWith('--journal=')) out.journal = a.slice('--journal='.length);
    else if (a.startsWith('--candidates-dir=')) out.candidatesDir = a.slice('--candidates-dir='.length);
  }
  return out;
}

function main() {
  const repoRoot = repoRootFrom(__dirname);
  const args = parseArgs(process.argv.slice(2));
  const journalPath = args.journal || path.join(repoRoot, 'dev', 'meta-improvement', 'audit-journal.ndjson');
  const candidatesDir = args.candidatesDir || path.join(repoRoot, 'dev', 'meta-improvement', 'patch-candidates');
  const promptPath = path.join(repoRoot, 'dev', 'meta-improvement', 'prompts', 'patch-synth.md');

  const map = auditJournal.loadJournal(journalPath);
  if (map.size === 0) { process.stderr.write(`Journal empty or not found: ${journalPath}\n`); process.exit(1); }

  let clusters = buildClusters(map).filter((c) => c.systemic);
  if (args.cluster) clusters = clusters.filter((c) => c.key === args.cluster);
  // Only clusters with at least one open record (unless --force).
  if (!args.force) clusters = clusters.filter((c) => c.openCount > 0);
  clusters = clusters.slice(0, args.limit);

  if (clusters.length === 0) {
    process.stdout.write('No systemic clusters with open findings to synthesize.\n');
    return;
  }

  process.stdout.write(`Systemic clusters to synthesize: ${clusters.length}\n`);
  for (const c of clusters) {
    process.stdout.write(`  - ${c.key}: ${c.distinct} findings / ${c.instances} instances / ${c.sessions} sessions / ${c.severity} (open=${c.openCount})\n`);
  }

  const template = fs.readFileSync(promptPath, 'utf-8');

  if (args.dryRun) {
    const first = clusters[0];
    const candidatePath = candidateFile(candidatesDir, first);
    const prompt = renderPrompt(template, {
      zone: first.zone, checkId: first.check_id,
      clusterJson: JSON.stringify(clusterPayload(first), null, 2),
      repoRoot, candidatePath,
    });
    process.stdout.write(`\n[dry-run] would write candidate(s) to ${path.relative(repoRoot, candidatesDir)}/\n`);
    process.stdout.write(`[dry-run] rendered prompt for ${first.key} (${prompt.length} chars). Head:\n\n`);
    process.stdout.write(prompt.slice(0, 1400) + '\n…\n');
    return;
  }

  fs.mkdirSync(candidatesDir, { recursive: true });
  let survived = 0;
  let refuted = 0;
  for (const c of clusters) {
    const candidatePath = candidateFile(candidatesDir, c);
    const prompt = renderPrompt(template, {
      zone: c.zone, checkId: c.check_id,
      clusterJson: JSON.stringify(clusterPayload(c), null, 2),
      repoRoot, candidatePath,
    });
    process.stdout.write(`\nSynthesizing ${c.key} → ${path.relative(repoRoot, candidatePath)} …\n`);
    const res = spawnSync(CLAUDE_BIN, ['-p', '--permission-mode', 'acceptEdits', '--add-dir', candidatesDir], {
      input: prompt, encoding: 'utf-8', timeout: SYNTH_TIMEOUT_MS,
      cwd: repoRoot, shell: process.platform === 'win32', maxBuffer: 50 * 1024 * 1024,
    });
    if (!fs.existsSync(candidatePath)) {
      process.stderr.write(`  ✗ no candidate written (${res.error ? res.error.message : 'exit ' + res.status}).\n`);
      if (res.stderr) process.stderr.write(`  stderr (head): ${String(res.stderr).slice(0, 800)}\n`);
      continue;
    }
    const v = readVerdict(candidatePath);
    if (v && v.verdict === 'survived') { setClusterStatus(map, c, 'patch-proposed'); survived++; process.stdout.write(`  ✓ survived → patch-proposed\n`); }
    else { setClusterStatus(map, c, 'clustered'); refuted++; process.stdout.write(`  • refuted/uncertain → clustered (verdict=${v ? v.verdict : '?'})\n`); }
  }

  auditJournal.writeJournal(journalPath, map);
  process.stdout.write(`\nDone: ${survived} survived (patch-proposed), ${refuted} refuted/uncertain. Journal updated.\n`);
  process.stdout.write(`Review candidates in ${path.relative(repoRoot, candidatesDir)}/ and run the [Y/N/E/D] gate.\n`);
}

if (require.main === module) main();

module.exports = { buildClusters, clusterPayload, candidateFile, renderPrompt, readVerdict };
