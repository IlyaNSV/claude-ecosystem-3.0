#!/usr/bin/env node
/**
 * classify.js — Session classifier + rubric registry loader for Session Audit v2.
 *
 * Deterministic pre-pass consumed by scripts/audit-smoke.js in --classify mode:
 *   1. loadRubrics(repoRoot)          → parse dev/meta-improvement/rubrics/*.md
 *   2. extractSignals(transcript, …)  → session profile from transcript + marker
 *   3. classifySession(signals, …)    → { class, confidence, scores }
 *   4. renderRubricBlock / renderSessionProfile → text injected into auditor prompt
 *
 * Pure & deterministic: no Date.now()/random in classification logic — timing
 * signals derive from inputs passed in (marker.ended_at + CHANGELOG date), so
 * the same inputs always yield the same class (unit-testable).
 *
 * Per DEC-DEV-0056 (Session Audit v2, Increment 1). D7 dev-only.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SIGNAL_TYPES = new Set([
  'slash_command', 'written_path', 'commit_type', 'commit_scope', 'subagent_type', 'flag',
]);
const RECENT_SHIP_DAYS = 21;
// A lone weight-1 signal is not enough to assign a specific class — below this
// the session falls to mixed-uncertain rather than a low-evidence guess.
const MIN_DECISIVE_SCORE = 2;

// ============================================================================
// Minimal frontmatter reader (controlled rubric grammar only)
// ============================================================================

function stripQuotes(s) {
  const t = (s || '').trim();
  const m = t.match(/^(['"])(.*)\1$/);
  return m ? m[2] : t;
}

/**
 * Parse rubric frontmatter. Supports: `key: scalar`, inline list `key: [a, b]`,
 * and block list (`key:` then indented `  - item` lines). Returns { data, body }.
 */
function parseFrontmatter(content) {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return { data: {}, body: content };
  const lines = m[1].split(/\r?\n/);
  const body = content.slice(m[0].length).replace(/^\r?\n/, '');
  const data = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) { i++; continue; }
    const kv = line.match(/^([\w_]+):\s*(.*)$/);
    if (!kv) { i++; continue; }
    const key = kv[1];
    const val = kv[2];

    if (val === '') {
      const list = [];
      let j = i + 1;
      while (j < lines.length && /^\s+-\s+/.test(lines[j])) {
        list.push(stripQuotes(lines[j].replace(/^\s+-\s+/, '')));
        j++;
      }
      data[key] = list; // possibly empty
      i = list.length > 0 ? j : i + 1;
      continue;
    }

    const inline = val.match(/^\[(.*)\]$/);
    if (inline) {
      data[key] = inline[1].trim() === ''
        ? []
        : inline[1].split(',').map((s) => stripQuotes(s)).filter(Boolean);
      i++;
      continue;
    }

    data[key] = stripQuotes(val);
    i++;
  }
  return { data, body };
}

// ============================================================================
// Rubric registry
// ============================================================================

function parseTriggers(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const entry of raw) {
    const parts = String(entry).split('|');
    if (parts.length < 3) continue;
    const [signal, match] = parts;
    const weight = parseInt(parts[2], 10);
    if (!SIGNAL_TYPES.has(signal) || !Number.isFinite(weight)) continue;
    out.push({ signal, match, weight });
  }
  return out;
}

function rubricsDir(repoRoot) {
  return path.join(repoRoot, 'dev', 'meta-improvement', 'rubrics');
}

function loadRubrics(repoRoot) {
  const dir = rubricsDir(repoRoot);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md');
  const rubrics = [];
  for (const f of files) {
    const { data, body } = parseFrontmatter(fs.readFileSync(path.join(dir, f), 'utf-8'));
    if (!data.id) continue;
    rubrics.push({
      id: data.id,
      title: data.title || data.id,
      triggers: parseTriggers(data.triggers),
      criteria: Array.isArray(data.criteria) ? data.criteria : [],
      baseline: Array.isArray(data.baseline) ? data.baseline : [],
      effect_focus: data.effect_focus || '',
      body: (body || '').trim(),
    });
  }
  return rubrics;
}

// ============================================================================
// Signal extraction
// ============================================================================

function parseCommitFromBash(cmd, types, scopes) {
  if (!/\bgit\s+commit\b/.test(cmd)) return;
  // Best-effort: -m "msg" / -m 'msg'. Heredoc / -F not parsed (Increment 1).
  const messages = [];
  const re = /-m\s+("([^"]*)"|'([^']*)')/g;
  let mm;
  while ((mm = re.exec(cmd)) !== null) messages.push(mm[2] != null ? mm[2] : mm[3]);
  for (const msg of messages) {
    const cc = msg.match(/^(\w+)(?:\(([^)]+)\))?!?:/);
    if (cc) {
      types.push(cc[1].toLowerCase());
      if (cc[2]) scopes.push(cc[2].toLowerCase());
    }
  }
}

function uniq(arr) {
  return Array.from(new Set(arr.filter((x) => x != null && x !== '')));
}

/**
 * Build the session profile from the original transcript JSONL + marker.
 * `context` (optional): { repoRoot } — enables best-effort module_recently_shipped.
 */
function extractSignals(transcriptPath, marker, context) {
  const slash_commands = [];
  const subagent_types = [];
  const written_paths = [];
  const bash_commands = [];
  const commit_types = [];
  const commit_scopes = [];
  const cwds = [];

  const lines = fs.readFileSync(transcriptPath, 'utf-8').split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    let rec;
    try { rec = JSON.parse(line); } catch { continue; }
    if (rec && typeof rec.cwd === 'string') cwds.push(rec.cwd);
    const content = rec && rec.message && rec.message.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (!block || block.type !== 'tool_use') continue;
      const name = block.name;
      const input = block.input || {};
      if (name === 'SlashCommand' && typeof input.command === 'string') {
        slash_commands.push(input.command.trim());
      } else if ((name === 'Write' || name === 'Edit' || name === 'NotebookEdit') && typeof input.file_path === 'string') {
        written_paths.push(input.file_path.replace(/\\/g, '/'));
      } else if (name === 'Bash' && typeof input.command === 'string') {
        bash_commands.push(input.command);
        parseCommitFromBash(input.command, commit_types, commit_scopes);
      } else if (name === 'Agent' || name === 'Task') {
        subagent_types.push(input.subagent_type || input.description || '');
      }
    }
  }

  const cwdStr = (uniq(cwds).join(' ') + ' ' + (marker && marker.target_project || '')).toLowerCase();
  const wp = uniq(written_paths);
  const flags = {
    is_ecosystem_repo: /claude-ecosystem/.test(cwdStr),
    touched_product: wp.some((p) => p.includes('.product/')),
    has_feature_artifact: wp.some((p) => /\.product\/features\//.test(p)),
    has_design_artifact: wp.some((p) => /\.product\/(mockups|design-system)/.test(p) || /\/(MK|NM|DS)-/.test(p)),
    has_discovery_artifact: wp.some((p) => /\.product\/(problems|hypotheses|segments|value-prop|market|competitive)/.test(p)),
    module_recently_shipped: false,
  };

  if (context && context.repoRoot && marker && marker.ended_at) {
    flags.module_recently_shipped = computeRecentlyShipped(context.repoRoot, marker.ended_at);
  }

  return {
    slash_commands: uniq(slash_commands),
    subagent_types: uniq(subagent_types),
    written_paths: wp,
    commit_types: uniq(commit_types),
    commit_scopes: uniq(commit_scopes),
    target_project: (marker && marker.target_project) || null,
    session_end_reason: (marker && marker.reason) || null,
    flags,
  };
}

function computeRecentlyShipped(repoRoot, endedAtIso) {
  try {
    const changelog = fs.readFileSync(path.join(repoRoot, 'CHANGELOG.md'), 'utf-8');
    const m = changelog.match(/^##\s*\[[0-9][0-9.]*\]\s*[—\-]\s*(\d{4}-\d{2}-\d{2})/m);
    if (!m) return false;
    const shipped = Date.parse(m[1]);
    const ended = Date.parse(endedAtIso);
    if (!Number.isFinite(shipped) || !Number.isFinite(ended)) return false;
    const days = (ended - shipped) / (24 * 60 * 60 * 1000);
    return days >= 0 && days <= RECENT_SHIP_DAYS;
  } catch {
    return false;
  }
}

// ============================================================================
// Classification
// ============================================================================

function triggerMatches(trig, signals) {
  switch (trig.signal) {
    case 'slash_command': return signals.slash_commands.some((c) => c.startsWith(trig.match));
    case 'written_path': return signals.written_paths.some((p) => p.includes(trig.match));
    case 'commit_type': return signals.commit_types.includes(trig.match);
    case 'commit_scope': return signals.commit_scopes.includes(trig.match);
    case 'subagent_type': return signals.subagent_types.some((s) => s.includes(trig.match));
    case 'flag': return !!signals.flags[trig.match];
    default: return false;
  }
}

function scoreRubric(signals, rubric) {
  let sum = 0;
  for (const trig of rubric.triggers) {
    if (triggerMatches(trig, signals)) sum += trig.weight;
  }
  return sum;
}

/**
 * Returns { class, confidence: high|medium|low, scores: [{id, score}] }.
 * Deterministic. Falls back to 'mixed-uncertain' when no decisive winner.
 */
function classifySession(signals, rubrics) {
  const scored = rubrics
    .filter((r) => r.triggers.length > 0)
    .map((r) => ({ id: r.id, score: scoreRubric(signals, r) }))
    .sort((a, b) => b.score - a.score);

  const fallback = { class: 'mixed-uncertain', scores: scored };

  if (scored.length === 0 || scored[0].score < MIN_DECISIVE_SCORE) {
    return { ...fallback, confidence: 'low' };
  }

  const top = scored[0];
  const second = scored[1] || { score: 0 };
  const tie = scored.filter((s) => s.score === top.score).length > 1;
  if (tie) return { ...fallback, confidence: 'low' };

  const margin = top.score - second.score;
  let confidence;
  if (top.score >= 4 && margin >= 2) confidence = 'high';
  else if (top.score >= 2 && margin >= 1) confidence = 'medium';
  else confidence = 'low';

  return { class: top.id, confidence, scores: scored };
}

// ============================================================================
// Rendering (text injected into the auditor prompt)
// ============================================================================

function renderSessionProfile(signals) {
  const compact = {
    slash_commands: signals.slash_commands,
    subagent_types: signals.subagent_types,
    written_paths: signals.written_paths.slice(0, 40),
    commit_types: signals.commit_types,
    commit_scopes: signals.commit_scopes,
    target_project: signals.target_project,
    session_end_reason: signals.session_end_reason,
    flags: signals.flags,
  };
  return '```json\n' + JSON.stringify(compact, null, 2) + '\n```';
}

function renderRubricBlock(rubric, verdict) {
  const baseline = rubric.baseline.length
    ? rubric.baseline.map((b) => `- ${b}`).join('\n')
    : '- (нет явного — общая сверка с процесс-каталогом)';
  const criteria = rubric.criteria.length ? rubric.criteria.join(', ') : '(общая сверка)';
  return [
    `## Selected rubric — ${rubric.id} (class confidence: ${verdict.confidence})`,
    '',
    'Ты в **rubric-guided режиме**. Используй baseline ниже как ground truth (читай эти файлы),',
    'приоритизируй перечисленные criteria, можешь скипнуть нерелевантные catalog-проверки.',
    'Если профиль сессии явно не соответствует этому классу — отметь это advisory-находкой',
    '(check_id: class-mismatch, severity: info) и поясни; НЕ переклассифицируй сам.',
    '',
    '**Baseline (с чем сравнивать):**',
    baseline,
    '',
    `**Criteria (приоритет, check_id):** ${criteria}`,
    '',
    `**Effect focus (контекст):** ${rubric.effect_focus || '(n/a)'}`,
    '',
    '**Rationale рубрики:**',
    rubric.body || '(нет)',
  ].join('\n');
}

module.exports = {
  parseFrontmatter,
  parseTriggers,
  loadRubrics,
  extractSignals,
  computeRecentlyShipped,
  scoreRubric,
  classifySession,
  renderSessionProfile,
  renderRubricBlock,
};
