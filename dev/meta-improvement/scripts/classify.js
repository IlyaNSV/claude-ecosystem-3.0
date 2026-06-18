#!/usr/bin/env node
/**
 * classify.js — Session zone classifier + zone-reference registry for Session Audit v2.
 *
 * Deterministic pre-pass consumed by scripts/audit-smoke.js in --classify mode:
 *   1. loadZones(repoRoot)            → parse dev/meta-improvement/rubrics/*.md (zone-references)
 *   2. extractSignals(transcript, …)  → session profile from transcript + marker
 *   3. classifyZones(signals, zones)  → { zones: [{id,score,confidence}], mode, shakedown, fallback }
 *   4. renderZonesBlock / renderSessionProfile → text injected into auditor prompt
 *
 * Two-axis model (DEC-DEV-0059, Increment 3a re-anchor):
 *   - PRIMARY axis: zone coverage (MULTI-LABEL, owned-only PMO zones). One product
 *     session legitimately spans D1 → D2-B → handoff, so we activate ALL zones whose
 *     score clears the threshold — not a single argmax winner.
 *   - SECONDARY axis: work mode (feature|fix|refactor|maintenance from commit types) +
 *     a module-shakedown occasion flag. Modulates strictness; it does NOT pick the baseline.
 * Audits PRODUCT sessions only — ecosystem self-dev (Level B) is out of scope (DEC-DEV-0059).
 *
 * Pure & deterministic: no Date.now()/random in classification logic — timing signals
 * derive from inputs (marker.ended_at + CHANGELOG date), so the same inputs always yield
 * the same result (unit-testable).
 *
 * Per DEC-DEV-0056 (Increment 1) + DEC-DEV-0059 (Increment 3a re-anchor). D7 dev-only.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SIGNAL_TYPES = new Set([
  'slash_command', 'written_path', 'commit_type', 'commit_scope', 'subagent_type', 'flag',
]);
const RECENT_SHIP_DAYS = 21;
// A zone activates only when its score clears this bar; a lone weight-1 signal is not
// enough to pull a zone's full baseline/criteria into the audit (multi-label, not argmax).
const ZONE_ACTIVATION_SCORE = 2;

// ============================================================================
// Minimal frontmatter reader (controlled zone-reference grammar only)
// ============================================================================

function stripQuotes(s) {
  const t = (s || '').trim();
  const m = t.match(/^(['"])(.*)\1$/);
  return m ? m[2] : t;
}

/**
 * Parse zone-reference frontmatter. Supports: `key: scalar`, inline list `key: [a, b]`,
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
// Zone-reference registry
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

/**
 * Load zone-references from dev/meta-improvement/rubrics/*.md. Each file is one PMO zone
 * (owned-only) or the `mixed-uncertain` fallback. Data-driven: adding a zone = adding a
 * `.md` file, no code change. Directory name stays `rubrics/` for reference stability.
 */
function loadZones(repoRoot) {
  const dir = rubricsDir(repoRoot);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md');
  const zones = [];
  for (const f of files) {
    const { data, body } = parseFrontmatter(fs.readFileSync(path.join(dir, f), 'utf-8'));
    if (!data.id) continue;
    zones.push({
      id: data.id,
      title: data.title || data.id,
      module: data.module || '',
      triggers: parseTriggers(data.triggers),
      criteria: Array.isArray(data.criteria) ? data.criteria : [],
      baseline: Array.isArray(data.baseline) ? data.baseline : [],
      effect_focus: data.effect_focus || '',
      body: (body || '').trim(),
    });
  }
  return zones;
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
 * Extract user-typed slash commands from a user message.
 *
 * Coverage-gap fix (Incr.2, DEC-DEV-0057): the `SlashCommand` tool_use only
 * captures *assistant-invoked* commands. User-typed `/foo:bar` commands surface
 * in user messages as a `<command-name>/foo:bar</command-name>` tag emitted by
 * Claude Code (verified across pilot transcripts). Without this, pilot sessions
 * driven entirely by user-typed commands had `slash_commands: []`, starving the
 * classifier of its strongest intent signal. `content` may be a string or an
 * array of text blocks.
 */
function extractUserSlashCommands(content) {
  let text = '';
  if (typeof content === 'string') {
    text = content;
  } else if (Array.isArray(content)) {
    text = content
      .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text)
      .join('\n');
  }
  if (!text) return [];
  const out = [];
  const re = /<command-name>\s*(\/[^<\s]+)\s*<\/command-name>/g;
  let m;
  while ((m = re.exec(text)) !== null) out.push(m[1].trim());
  return out;
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
  const workflow_scripts = [];

  const lines = fs.readFileSync(transcriptPath, 'utf-8').split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    let rec;
    try { rec = JSON.parse(line); } catch { continue; }
    const msg = rec && rec.message;
    const content = msg && msg.content;
    // User-typed slash commands live in user messages (string or text blocks),
    // not in SlashCommand tool_use. Capture them before the array-only guard.
    if (msg && msg.role === 'user') {
      for (const c of extractUserSlashCommands(content)) slash_commands.push(c);
    }
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
      } else if (name === 'Workflow') {
        // Orchestrator P3/P5 run via the Workflow tool — its core action. Without
        // capturing it, an orchestrator session is invisible to the classifier and
        // gets misrouted (live-run RUN 01 c4546225 → D6/maintenance). Record the
        // process script (named or scriptPath); inline `script:` workflows have neither.
        const sp = typeof input.scriptPath === 'string' ? input.scriptPath
          : (typeof input.name === 'string' ? input.name : '');
        if (sp) workflow_scripts.push(sp.replace(/\\/g, '/'));
      }
    }
  }

  const wp = uniq(written_paths);
  const ws = uniq(workflow_scripts);
  const flags = {
    touched_product: wp.some((p) => p.includes('.product/')),
    has_feature_artifact: wp.some((p) => /\.product\/features\//.test(p)),
    has_design_artifact: wp.some((p) => /\.product\/(mockups|design-system)/.test(p) || /\/(MK|NM|DS)-/.test(p)),
    has_discovery_artifact: wp.some((p) => /\.product\/(problems|hypotheses|segments|value-prop|market|competitive)/.test(p)),
    used_orchestrator_workflow: ws.some((s) => /orchestrator\/processes\//.test(s)),
    module_recently_shipped: false,
  };

  if (context && context.repoRoot && marker && marker.ended_at) {
    flags.module_recently_shipped = computeRecentlyShipped(context.repoRoot, marker.ended_at);
  }

  return {
    slash_commands: uniq(slash_commands),
    subagent_types: uniq(subagent_types),
    written_paths: wp,
    workflow_scripts: ws,
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
// Classification (two-axis: zones multi-label + mode modifier)
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

function scoreZone(signals, zone) {
  let sum = 0;
  for (const trig of zone.triggers) {
    if (triggerMatches(trig, signals)) sum += trig.weight;
  }
  return sum;
}

function zoneConfidence(score) {
  if (score >= 4) return 'high';
  if (score >= 2) return 'medium';
  return 'low';
}

/**
 * Work-mode modifier (secondary axis) from conventional-commit types. Returns the
 * STRICTEST mode present (feature > refactor > fix > maintenance) so a mixed session
 * is audited at the higher bar. 'unknown' when no commits → auditor applies full strictness.
 */
function detectMode(signals) {
  const t = signals.commit_types || [];
  if (t.includes('feat')) return 'feature';
  if (t.includes('refactor')) return 'refactor';
  if (t.includes('fix')) return 'fix';
  if (t.length > 0 && t.every((x) => x === 'docs' || x === 'chore')) return 'maintenance';
  return 'unknown';
}

/**
 * MULTI-LABEL zone classification (DEC-DEV-0059). Returns every zone whose score clears
 * ZONE_ACTIVATION_SCORE — not a single argmax winner — because a product session can
 * legitimately span several owned zones. `fallback: true` (zones: []) when nothing clears
 * the bar → auditor runs catalog-only (mixed-uncertain). Deterministic.
 *
 * Returns { zones: [{id, score, confidence}], fallback, mode, shakedown, scores }.
 */
function classifyZones(signals, zones) {
  const scored = zones
    .filter((z) => z.triggers.length > 0)
    .map((z) => ({ id: z.id, score: scoreZone(signals, z) }))
    .sort((a, b) => b.score - a.score);

  const active = scored
    .filter((s) => s.score >= ZONE_ACTIVATION_SCORE)
    .map((s) => ({ id: s.id, score: s.score, confidence: zoneConfidence(s.score) }));

  return {
    zones: active,
    fallback: active.length === 0,
    mode: detectMode(signals),
    shakedown: !!(signals.flags && signals.flags.module_recently_shipped),
    scores: scored,
  };
}

// ============================================================================
// Rendering (text injected into the auditor prompt)
// ============================================================================

function renderSessionProfile(signals) {
  const compact = {
    slash_commands: signals.slash_commands,
    subagent_types: signals.subagent_types,
    workflow_scripts: signals.workflow_scripts || [],
    written_paths: signals.written_paths.slice(0, 40),
    commit_types: signals.commit_types,
    commit_scopes: signals.commit_scopes,
    target_project: signals.target_project,
    session_end_reason: signals.session_end_reason,
    flags: signals.flags,
  };
  return '```json\n' + JSON.stringify(compact, null, 2) + '\n```';
}

/**
 * Render the `{{RUBRIC_BLOCK}}` text for the auditor: the UNION of baseline + criteria
 * across all activated zones, plus the mode modifier. Falls back to a catalog-only block
 * when no zone activated.
 */
function renderZonesBlock(classification, zones) {
  const byId = new Map(zones.map((z) => [z.id, z]));
  const active = classification.zones.map((z) => byId.get(z.id)).filter(Boolean);
  const modeLine = `**Mode (строгость):** ${classification.mode}`
    + (classification.shakedown ? ' · occasion: **module-shakedown** (вероятно первая боевая сессия после поставки модуля — проверь, что поставленный модуль реально работает)' : '');

  if (active.length === 0) {
    const fb = byId.get('mixed-uncertain');
    return [
      '## Selected zones — none decisive (mixed / uncertain)',
      '',
      modeLine,
      '',
      'Детерминированный классификатор не выделил ни одной зоны с достаточным сигналом.',
      'Работай в **catalog-only** режиме: общая сверка с процесс-каталогом (A–F), без зонного приоритета.',
      fb && fb.body ? '\n**Rationale fallback:**\n' + fb.body : '',
    ].join('\n');
  }

  const baselineSet = [];
  const criteriaSet = new Set();
  for (const z of active) {
    for (const b of z.baseline) if (!baselineSet.includes(b)) baselineSet.push(b);
    for (const c of z.criteria) criteriaSet.add(c);
  }
  const zoneLines = active.map((z) =>
    `- **${z.id}**${z.module ? ` (${z.module})` : ''} — ${z.title}`
    + `\n  criteria: ${z.criteria.join(', ') || '(общая)'} · effect_focus: ${z.effect_focus || 'n/a'}`
  ).join('\n');
  const baselineLines = baselineSet.length
    ? baselineSet.map((b) => `- ${b}`).join('\n')
    : '- (нет явного — общая сверка с процесс-каталогом)';

  return [
    `## Selected zones (multi-label) — ${active.map((z) => z.id).join(', ')}`,
    '',
    modeLine,
    '',
    'Ты в **zone-guided режиме**. Сессия могла затронуть НЕСКОЛЬКО зон — проверяй против',
    'ОБЪЕДИНЕНИЯ их baseline (читай эти файлы как ground truth) и приоритизируй объединённые criteria.',
    'mode модулирует строгость: `maintenance`/`fix` → не штрафуй за отсутствие тяжёлых ритуалов на',
    'косметических правках; `feature`/`refactor`/`unknown` → полная строгость.',
    'Если профиль сессии явно противоречит назначенным зонам — отметь advisory-находкой',
    '(check_id: zone-mismatch, severity: info) и поясни; НЕ переклассифицируй сам.',
    '',
    '**Затронутые зоны:**',
    zoneLines,
    '',
    '**Baseline (объединение, читай как ground truth):**',
    baselineLines,
    '',
    `**Criteria (объединение, check_id):** ${Array.from(criteriaSet).join(', ') || '(общая сверка)'}`,
  ].join('\n');
}

module.exports = {
  parseFrontmatter,
  parseTriggers,
  loadZones,
  extractUserSlashCommands,
  extractSignals,
  computeRecentlyShipped,
  scoreZone,
  zoneConfidence,
  detectMode,
  classifyZones,
  renderSessionProfile,
  renderZonesBlock,
};
