#!/usr/bin/env node
/**
 * effect-probe.js — deterministic "effect on product" measurement for Session Audit v2.
 *
 * Increment 2 (G4). Consumed by scripts/audit-smoke.js in --classify mode: before
 * spawning the `claude -p` auditor, the driver builds an effect-probe for the audited
 * session and injects it into the prompt ({{EFFECT_PROBE}}). The LLM then interprets
 * "корректно / некорректно / можно улучшить" in terms of the matched rubric's
 * `effect_focus`. This module does the deterministic measuring; the LLM does the judging.
 *
 * What it measures (all read-only, deterministic):
 *   1. window      — session time window + pilot cwd/branch, derived from the transcript
 *                    (timestamp/cwd/gitBranch records). No hook change needed; works on
 *                    already-captured markers (DEC-DEV-0057 fork #1).
 *   2. git         — before/after commits at the window edges + `.product/` diff --numstat
 *                    + commits in window (best-effort; graceful when pilot is not a repo
 *                    or nothing was committed).
 *   3. touched     — `.product/**` files written/edited/deleted in the session (from the
 *                    transcript tool_use). Authoritative "what was touched" without git.
 *   4. post_state  — STANDALONE D7 validator over the pilot's current `.product/**`. A
 *                    documented automatable subset of the V-catalog (docs/pmo/validation.md
 *                    §5.1) — NOT a reuse of hooks/product/artifact-validate.js (CONVENTIONS
 *                    §9 forbids D7 reusing Product-module code; we borrow the *rules*, not
 *                    the code). Each finding is attributed `touched_in_session` so the LLM
 *                    can separate session-introduced issues from pre-existing debt — a
 *                    cheap regression proxy in lieu of flaky before/after re-validation.
 *   5. debts       — `.product/.pending/*` counts + `.decisions/journal.md` entry count.
 *
 * NO auto-fix (CONVENTIONS §8): this is measurement only. It never writes to `.product/`.
 *
 * Validator scope (cuttable, Incr.2): V-10, V-09, V-04, V-01 (per catalog) + B.1
 * anti-rename + dangling-ref (subset of V-11 "target missing"). Full bi-directional V-11,
 * semantic rules (V-02/03/05..08/14a/15) and before/after regression re-validation are
 * out of scope — covered by the auditor LLM and /product:validate.
 *
 * CLI: node effect-probe.js --transcript=<path> [--out=<path>] [--session-id=<id>]
 *
 * Per DEC-DEV-0057 (Session Audit v2, Increment 2). D7 dev-only.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const classify = require('./classify.js'); // reuse parseFrontmatter (DRY within D7)

const VALIDATOR_SCOPE = ['V-01', 'V-04', 'V-09', 'V-10', 'B.1-anti-rename', 'dangling-ref'];
const ANTI_RENAME_FIELDS = ['confidence_rationale', 'confidence_reasoning'];
// Artifact id prefixes that map 1:1 to a file in `.product/` (so a dangling reference is
// meaningful). JTBD-/R-(role)/DEC-/JOB- live inside artifact bodies, not as files — excluded.
const TRACKABLE_PREFIX = /^(FM|SC|BR|IC|SEG|HYP|LC|NFR|VC|VP|MK|RL)-/;
const FM_ACTIVE_STATUSES = new Set(['in-progress', 'shipped']);

// ============================================================================
// Git (isolated, best-effort — every call returns null on any failure)
// ============================================================================

function git(repoRoot, args) {
  try {
    const r = spawnSync('git', ['-C', repoRoot, ...args], {
      encoding: 'utf-8', shell: false, maxBuffer: 32 * 1024 * 1024,
    });
    if (r.error || r.status !== 0) return null;
    return (r.stdout || '').trim();
  } catch {
    return null;
  }
}

function resolvePilotRepo(cwd) {
  if (!cwd) return null;
  return git(cwd, ['rev-parse', '--show-toplevel']);
}

/**
 * Resolve before/after commits at the window edges and the `.product/` diff between them.
 * `before` = last commit at/raise before firstTs; `after` = last commit at/before lastTs.
 * committed=false when they resolve equal (session made no commits touching history).
 */
function gitWindow(repoRoot, branch, firstTs, lastTs) {
  if (!repoRoot) return { available: false, reason: 'pilot is not a git repo' };
  const ref = branch || 'HEAD';
  const before = firstTs ? git(repoRoot, ['rev-list', '-1', '--first-parent', `--before=${firstTs}`, ref]) : null;
  const after = lastTs ? git(repoRoot, ['rev-list', '-1', '--first-parent', `--before=${lastTs}`, ref]) : null;
  const out = {
    available: true,
    pilot_repo: repoRoot,
    branch: ref,
    before: before || null,
    after: after || null,
    committed: !!(before && after && before !== after),
    commits_in_window: [],
    product_diff_stat: [],
  };

  if (out.committed) {
    const log = git(repoRoot, ['log', '--first-parent', '--format=%h%x1f%s', `${before}..${after}`]);
    if (log) {
      out.commits_in_window = log.split('\n').filter(Boolean).map((l) => {
        const [hash, subject] = l.split('');
        return { hash, subject: subject || '' };
      });
    }
    const numstat = git(repoRoot, ['diff', '--numstat', `${before}..${after}`, '--', '.product/']);
    if (numstat) {
      out.product_diff_stat = numstat.split('\n').filter(Boolean).map((l) => {
        const parts = l.split('\t');
        return { file: (parts[2] || '').trim(), added: parts[0], deleted: parts[1] };
      }).filter((e) => e.file);
    }
  }
  return out;
}

// ============================================================================
// Transcript signals
// ============================================================================

function* iterRecords(transcriptPath) {
  const lines = fs.readFileSync(transcriptPath, 'utf-8').split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    try { yield JSON.parse(line); } catch { /* skip */ }
  }
}

/**
 * Derive the session window from the transcript: time bounds + pilot cwd + git branch.
 * All three live on Claude Code message records (verified across pilot transcripts).
 */
function deriveWindow(transcriptPath) {
  let firstTs = null;
  let lastTs = null;
  let cwd = null;
  let gitBranch = null;
  let records = 0;
  for (const rec of iterRecords(transcriptPath)) {
    records += 1;
    if (rec.timestamp) {
      if (!firstTs) firstTs = rec.timestamp;
      lastTs = rec.timestamp;
    }
    if (!cwd && typeof rec.cwd === 'string') cwd = rec.cwd;
    if (!gitBranch && typeof rec.gitBranch === 'string') gitBranch = rec.gitBranch;
  }
  return { first_ts: firstTs, last_ts: lastTs, cwd, git_branch: gitBranch, records };
}

/**
 * `.product/**` files touched in the session, from Write/Edit/NotebookEdit tool_use and
 * Bash `git mv`/`git rm`. Paths normalized to forward slash, made `.product/`-relative-ish
 * (kept from the `.product/` segment onward) for matching against validator findings.
 */
function touchedArtifacts(transcriptPath) {
  const files = new Set();
  const deleted = new Set();
  const viaBash = [];
  for (const rec of iterRecords(transcriptPath)) {
    const content = rec && rec.message && rec.message.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (!block || block.type !== 'tool_use') continue;
      const name = block.name;
      const input = block.input || {};
      if ((name === 'Write' || name === 'Edit' || name === 'NotebookEdit') && typeof input.file_path === 'string') {
        const p = normalizeProductPath(input.file_path);
        if (p) files.add(p);
      } else if (name === 'Bash' && typeof input.command === 'string') {
        const cmd = input.command;
        if (/\.product\//.test(cmd) && /\bgit\s+rm\b/.test(cmd)) {
          viaBash.push(cmd.slice(0, 200));
          for (const p of extractProductPaths(cmd)) deleted.add(p);
        } else if (/\.product\//.test(cmd) && /\bgit\s+mv\b/.test(cmd)) {
          viaBash.push(cmd.slice(0, 200));
        }
      }
    }
  }
  return { files: Array.from(files), deleted: Array.from(deleted), via_bash: viaBash };
}

function normalizeProductPath(p) {
  const norm = String(p).replace(/\\/g, '/');
  const idx = norm.indexOf('.product/');
  return idx === -1 ? null : norm.slice(idx);
}

function extractProductPaths(cmd) {
  const out = [];
  const re = /(\.product\/[^\s'"]+\.md)/g;
  let m;
  while ((m = re.exec(cmd.replace(/\\/g, '/'))) !== null) out.push(m[1]);
  return out;
}

// ============================================================================
// Standalone D7 validator (subset of docs/pmo/validation.md §5.1)
// ============================================================================

function listMarkdownFiles(dir, acc) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue; // skip .pending/.decisions/.da-findings/etc.
    const full = path.join(dir, e.name);
    if (e.isDirectory()) listMarkdownFiles(full, acc);
    else if (e.isFile() && e.name.endsWith('.md')) acc.push(full);
  }
  return acc;
}

function buildArtifactIndex(productDir) {
  const index = new Map();   // id -> entry
  const entries = [];        // all parsed artifacts (incl. those without id)
  const files = listMarkdownFiles(productDir, []);
  for (const file of files) {
    let data;
    try { ({ data } = classify.parseFrontmatter(fs.readFileSync(file, 'utf-8'))); } catch { continue; }
    if (!data || Object.keys(data).length === 0) continue;
    const entry = {
      id: data.id || null,
      type: data.type || null,
      status: data.status || null,
      fm: data,
      file: file.replace(/\\/g, '/'),
      relFile: normalizeProductPath(file) || file.replace(/\\/g, '/'),
    };
    entries.push(entry);
    if (entry.id && !index.has(entry.id)) index.set(entry.id, entry);
  }
  return { index, entries };
}

function asList(v) {
  if (Array.isArray(v)) return v;
  if (v == null || v === '') return [];
  return [v];
}

/**
 * Apply the automatable V-subset to the current `.product/` post-state.
 * Returns { applicable, artifact_count, validator_scope, findings, findings_count }.
 */
function validatePostState(productDir) {
  if (!productDir || !fs.existsSync(productDir)) {
    return { applicable: false, reason: `no .product/ at ${productDir}` };
  }
  const { index, entries } = buildArtifactIndex(productDir);
  const findings = [];
  const push = (rule, severity, entry, message) => findings.push({
    rule, severity, artifact: entry.id || entry.relFile, file: entry.relFile, message,
  });

  for (const e of entries) {
    const t = e.type;
    const st = e.status;

    // B.1 anti-rename — forbidden field names (advisory; warning to avoid over-alarming).
    for (const bad of ANTI_RENAME_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(e.fm, bad)) {
        push('B.1-anti-rename', 'warning', e, `non-canonical field '${bad}' (use canonical confidence_notes)`);
      }
    }

    // dangling-ref — trackable id references that do not resolve to an artifact file.
    for (const field of ['feature', 'segment', 'value_proposition', 'scenarios', 'rules', 'invariants']) {
      for (const ref of asList(e.fm[field])) {
        const id = String(ref).trim();
        if (TRACKABLE_PREFIX.test(id) && !index.has(id)) {
          push('dangling-ref', 'warning', e, `${field} → ${id} does not resolve to an artifact`);
        }
      }
    }

    if (t === 'feature-map-entry') {
      // V-10: FM must have segment + ≥1 jtbd.
      if (!e.fm.segment) push('V-10', 'blocking', e, 'FM missing segment');
      if (asList(e.fm.jtbd).length === 0) push('V-10', 'blocking', e, 'FM missing jtbd[]');
      // V-01: FM in-progress/shipped must have ≥1 active SC in scenarios[].
      if (FM_ACTIVE_STATUSES.has(st)) {
        const scs = asList(e.fm.scenarios);
        const hasActiveSc = scs.some((sc) => {
          const ref = index.get(String(sc).trim());
          return ref && ref.status === 'active';
        });
        if (!hasActiveSc) push('V-01', 'blocking', e, `FM ${st} but no active SC in scenarios[]`);
      }
    } else if (t === 'scenario') {
      // V-04: active SC must reference an FM in {in-progress, shipped}.
      if (st === 'active') {
        const fmRef = index.get(String(e.fm.feature || '').trim());
        if (!e.fm.feature) push('V-04', 'blocking', e, 'active SC missing feature reference');
        else if (fmRef && !FM_ACTIVE_STATUSES.has(fmRef.status)) {
          push('V-04', 'blocking', e, `active SC → FM ${fmRef.id} not in-progress/shipped (status=${fmRef.status})`);
        }
      }
    } else if (t === 'segment') {
      // V-09 (checkpoint at D1.4a exit, DEC-DEV-0220-e): SEG goes active at G4 BEFORE its VP
      // exists, so a null value_proposition alone is a legitimate transient, not a violation.
      // Corpus-level we CAN see the pair: flag only a missed backfill — the SEG's VP already
      // exists in the corpus but the back-reference was never written.
      if (st === 'active' && !e.fm.value_proposition) {
        const vpForSeg = entries.find(
          (x) => String(x.fm.type) === 'value-proposition'
            && String(x.fm.segment || '').trim() === String(e.fm.id).trim(),
        );
        if (vpForSeg) {
          push('V-09', 'blocking', e, `active SEG has VP ${vpForSeg.fm.id} but value_proposition not backfilled (D1.4a)`);
        }
      }
    } else if (t === 'value-proposition') {
      // V-09 VP side: at D1.4a exit the pair must be complete — an active VP must name its SEG.
      if (st === 'active' && !e.fm.segment) {
        push('V-09', 'blocking', e, 'active VP missing segment reference (1:1 SEG↔VP)');
      }
    }
  }

  const findings_count = { blocking: 0, warning: 0, info: 0 };
  for (const f of findings) {
    if (f.severity === 'blocking') findings_count.blocking += 1;
    else if (f.severity === 'warning') findings_count.warning += 1;
    else findings_count.info += 1;
  }

  return {
    applicable: true,
    product_dir: normalizeProductPath(productDir) || productDir.replace(/\\/g, '/'),
    artifact_count: entries.length,
    validator_scope: VALIDATOR_SCOPE,
    findings,
    findings_count,
  };
}

// ============================================================================
// Debts (.product/.pending/* + .decisions/journal.md)
// ============================================================================

function countYamlListItems(file) {
  try {
    const text = fs.readFileSync(file, 'utf-8');
    const n = (text.match(/^\s*-\s+/gm) || []).length;
    return n;
  } catch {
    return null;
  }
}

function readDebts(productDir) {
  const pendingDir = path.join(productDir, '.pending');
  const pending = {};
  for (const f of ['validation-pending.yaml', 'cascade-pending.yaml', 'da-pending.yaml', 'bg-candidates.yaml']) {
    const c = countYamlListItems(path.join(pendingDir, f));
    if (c !== null) pending[f] = c;
  }
  let decisions_journal_entries = null;
  try {
    const j = fs.readFileSync(path.join(productDir, '.decisions', 'journal.md'), 'utf-8');
    decisions_journal_entries = (j.match(/^##\s+/gm) || []).length;
  } catch { /* absent */ }
  return { pending, decisions_journal_entries };
}

// ============================================================================
// Assembly
// ============================================================================

/**
 * Build the full effect-probe object for one session transcript.
 * Always returns an object; sets `applicable: false` when there is no `.product/`
 * to measure (no `.product/` writes, or cwd not resolved) so the caller can pass `none` to the auditor.
 */
function buildEffectProbe({ transcriptPath, sessionId, targetProject }) {
  const notes = [];
  const window = deriveWindow(transcriptPath);
  const touched = touchedArtifacts(transcriptPath);

  const pilotRepo = resolvePilotRepo(window.cwd);
  if (!pilotRepo) notes.push('pilot cwd is not inside a git repo — git window unavailable');

  const productDir = pilotRepo
    ? path.join(pilotRepo, '.product')
    : (window.cwd ? path.join(window.cwd, '.product') : null);

  if (!productDir || !fs.existsSync(productDir)) {
    return {
      schema: 'effect-probe/v1',
      applicable: false,
      reason: 'no .product/ for this session (no .product/ writes, or cwd not resolved)',
      session_id: sessionId || null,
      target_project: targetProject || null,
      window,
      notes,
    };
  }

  const gitInfo = gitWindow(pilotRepo, window.git_branch, window.first_ts, window.last_ts);
  if (gitInfo.available && !gitInfo.committed) {
    notes.push('no commits in session window — relying on transcript touched-paths for attribution');
  }

  const post = validatePostState(productDir);

  // Attribution proxy (cheap regression signal): a finding is `touched_in_session` if its
  // file was written/edited in the transcript OR changed in the git window. Findings on
  // touched artifacts are the session's responsibility; on untouched ones — pre-existing.
  const touchedSet = new Set(touched.files);
  for (const d of (gitInfo.product_diff_stat || [])) {
    const p = normalizeProductPath(d.file) || (d.file.startsWith('.product/') ? d.file : `.product/${d.file}`);
    if (p) touchedSet.add(p);
  }
  if (post.applicable) {
    for (const f of post.findings) f.touched_in_session = touchedSet.has(f.file);
    post.findings_attributed_to_session = post.findings.filter((f) => f.touched_in_session).length;
  }

  const debts = readDebts(productDir);

  return {
    schema: 'effect-probe/v1',
    applicable: true,
    session_id: sessionId || null,
    target_project: targetProject || null,
    window,
    git: gitInfo,
    touched,
    post_state: post,
    debts,
    notes,
  };
}

// ============================================================================
// CLI
// ============================================================================

function parseArgs(argv) {
  const out = { transcript: null, out: null, sessionId: null, help: false };
  for (const a of argv) {
    if (a === '--help' || a === '-h') out.help = true;
    else if (a.startsWith('--transcript=')) out.transcript = a.slice(13);
    else if (a.startsWith('--out=')) out.out = a.slice(6);
    else if (a.startsWith('--session-id=')) out.sessionId = a.slice(13);
    else throw new Error(`Unknown argument: ${a}`);
  }
  return out;
}

function main() {
  let args;
  try { args = parseArgs(process.argv.slice(2)); } catch (e) {
    process.stderr.write(`Error: ${e.message}\n`); process.exit(2);
  }
  if (args.help || !args.transcript) {
    process.stdout.write([
      'effect-probe.js — deterministic effect-on-product measurement (Session Audit v2 Incr.2)',
      '',
      'Usage: node effect-probe.js --transcript=<path> [--out=<path>] [--session-id=<id>]',
      '',
      '  --transcript=<path>  Original session transcript JSONL (needs timestamp/cwd/gitBranch)',
      '  --out=<path>         Write effect-probe.json here (default: stdout)',
      '  --session-id=<id>    Stamp session_id into the probe',
      '',
      `Validator scope: ${VALIDATOR_SCOPE.join(', ')} (subset of docs/pmo/validation.md §5.1)`,
    ].join('\n') + '\n');
    process.exit(args.transcript ? 0 : (args.help ? 0 : 2));
  }
  if (!fs.existsSync(args.transcript)) {
    process.stderr.write(`Error: transcript not found: ${args.transcript}\n`); process.exit(1);
  }
  const probe = buildEffectProbe({ transcriptPath: args.transcript, sessionId: args.sessionId });
  const json = JSON.stringify(probe, null, 2);
  if (args.out) {
    fs.writeFileSync(args.out, json);
    process.stdout.write(`effect-probe written: ${args.out} (applicable=${probe.applicable})\n`);
  } else {
    process.stdout.write(json + '\n');
  }
  process.exit(0);
}

if (require.main === module) main();

module.exports = {
  resolvePilotRepo,
  gitWindow,
  deriveWindow,
  touchedArtifacts,
  buildArtifactIndex,
  validatePostState,
  readDebts,
  buildEffectProbe,
  VALIDATOR_SCOPE,
};
