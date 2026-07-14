#!/usr/bin/env node
'use strict';
/**
 * seam-freshness-warn.js — Stop hook (warn-only) — context-seam staleness tripwire.
 *
 * ЗАЧЕМ. Шов (dev/<dir>/SEAM.md) — контракт продолжения между сессиями. Он полезен ровно
 * настолько, насколько отражает ТЕКУЩЕЕ состояние работы. Провал, который этот хук ловит:
 * сессия наработала кучу изменений в рабочем дереве, но шов не тронула — и следующий «я»
 * поднимется по устаревшему контракту. Хук замечает «рабочее дерево ушло далеко вперёд шва»
 * и напоминает обновить шов (или закрыть его). ДЕТЕКТ-ONLY: сам ничего не пишет.
 *
 * ЛОГИКА (warn срабатывает только при И-И-И):
 *   1) есть активные швы (dev/<dir>/SEAM.md со `status: ACTIVE` в первых 30 строках), И
 *   2) `git status --porcelain` непуст (строка dev/meta-improvement/audit-index.md игнорируется —
 *      это чужой перманентный WIP), И
 *   3) mtime самого свежего изменённого файла новее mtime КАЖДОГО активного шва больше чем на 2ч
 *      (⇔ новее самого свежего шва больше чем на 2ч).
 *   → однострочный warn в stdout.
 *
 * НЕ БЛОКИРУЕТ НИКОГДА. Всегда exit 0 (в отличие от lesson-gate — тот единственный блокирующий
 * Stop-хук в экосистеме). Git недоступен / не репозиторий / любая ошибка → тихий exit 0.
 * Zero-deps (fs/path/child_process). Порог 2ч — крупная правка успеет, а «дошлифовал шов и
 * закрыл ход» — нет ложной тревоги.
 *
 * ВЫВОД. Однострочный warn идёт в STDERR — консистентно с двумя другими warn-only
 * Stop-хуками экосистемы (subagent-watchdog, lesson-gate warn-mode). Решение ревью
 * 2026-07-14 (main-сессия DEC-DEV-0202): конвенция репо бьёт первоначальный бриф.
 *
 * ── ROLLBACK ────────────────────────────────────────────────────────────────
 *   - Instant OFF, no code change: set env  SEAM_FRESHNESS_WARN=0
 *   - Disable entirely: remove the Stop entry from .claude/settings.local.json
 *     (registration is local — that file is gitignored; delivery gap = DEF-CTX-4).
 *
 * Registration (ecosystem repo, .claude/settings.local.json):
 *   "Stop": [{ "hooks": [{ "type": "command",
 *     "command": "node dev/meta-improvement/hooks/seam-freshness-warn.js" }] }]
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const HEAD_LINES_FOR_STATUS = 30;
const IGNORED_DIRTY = 'dev/meta-improvement/audit-index.md'; // foreign permanent WIP — never our signal
const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000;               // 2 hours

// Toggle OFF without touching settings.
if (process.env.SEAM_FRESHNESS_WARN === '0') process.exit(0);

try {
  main();
} catch (_) {
  // Warn-only sensor must never wound the session — fail open.
}
process.exit(0);

// ── main ─────────────────────────────────────────────────────────────────────
function main() {
  // Stop payload is JSON on stdin. Not required for the logic — we only lift cwd from it.
  let payload = {};
  try { payload = JSON.parse(fs.readFileSync(0, 'utf-8')); } catch { /* fine */ }

  const cwd = payload.cwd || process.cwd();

  const repoRoot = gitRoot(cwd);
  if (!repoRoot) return; // git unavailable / not a repo → silent

  // (1) active seams?
  const seams = collectActiveSeams(path.join(repoRoot, 'dev'));
  if (!seams.length) return;

  // (2) working tree dirty (excluding the foreign audit-index WIP)?
  const dirty = dirtyFiles(cwd, repoRoot);
  if (!dirty.length) return;

  // mtime of the freshest changed file. Deletions / unstat-able entries are skipped.
  let freshestChange = -Infinity;
  for (const abs of dirty) {
    try {
      const mt = fs.statSync(abs).mtimeMs;
      if (mt > freshestChange) freshestChange = mt;
    } catch { /* deleted / unreadable — skip */ }
  }
  if (freshestChange === -Infinity) return; // nothing stat-able to compare

  // mtime of the freshest active seam (the binding one: work must beat EVERY seam by >2h,
  // which is equivalent to beating the newest seam by >2h).
  let newestSeam = null;
  let newestSeamMtime = -Infinity;
  for (const s of seams) {
    try {
      const mt = fs.statSync(s.seamPath).mtimeMs;
      if (mt > newestSeamMtime) { newestSeamMtime = mt; newestSeam = s; }
    } catch { /* skip */ }
  }
  if (!newestSeam) return; // could not stat any seam → cannot judge

  // (3) work newer than every active seam by > 2h?
  if (freshestChange - newestSeamMtime <= STALE_THRESHOLD_MS) return;

  const rel = relPath(repoRoot, newestSeam.seamPath);
  const extra = seams.length > 1 ? ` (+${seams.length - 1} др. активн. шов(а/ов))` : '';
  process.stderr.write(
    `⚠ seam-freshness: рабочее дерево менялось позже шва ${rel} (>2ч)${extra} — ` +
    `обнови шов или пометь status: CLOSED. Тумблер: SEAM_FRESHNESS_WARN=0\n`);
}

// ── git ──────────────────────────────────────────────────────────────────────
function gitRoot(cwd) {
  const r = git(['rev-parse', '--show-toplevel'], cwd);
  if (!r) return null;
  const root = r.trim();
  return root ? root : null;
}

// Returns absolute paths of changed files (porcelain), minus the ignored foreign WIP.
function dirtyFiles(cwd, repoRoot) {
  const out = git(['status', '--porcelain'], cwd);
  if (out == null) return [];
  const files = [];
  for (const raw of out.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    // porcelain v1: "XY <path>"; renames/copies: "XY <old> -> <new>".
    let p = raw.slice(3).trim();
    const arrow = p.indexOf(' -> ');
    if (arrow >= 0) p = p.slice(arrow + 4).trim();
    p = unquotePath(p);
    if (!p || p === IGNORED_DIRTY) continue;
    files.push(path.join(repoRoot, p));
  }
  return files;
}

function git(args, cwd) {
  try {
    const res = spawnSync('git', args, { cwd, encoding: 'utf-8', timeout: 10000 });
    if (!res || res.status !== 0 || typeof res.stdout !== 'string') return null;
    return res.stdout;
  } catch {
    return null;
  }
}

// git quotes paths with special chars in "..."; strip the quotes (best-effort, ASCII paths
// in this repo). A non-quoted path is returned unchanged.
function unquotePath(p) {
  if (p.length >= 2 && p.startsWith('"') && p.endsWith('"')) {
    return p.slice(1, -1);
  }
  return p;
}

// ── seam discovery (same contract as seam-reinject-compact.js) ────────────────
function collectActiveSeams(devDir) {
  let entries;
  try { entries = fs.readdirSync(devDir, { withFileTypes: true }); } catch { return []; }
  const seams = [];
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const seamPath = path.join(devDir, ent.name, 'SEAM.md');
    let text;
    try { text = fs.readFileSync(seamPath, 'utf-8'); } catch { continue; }
    if (isActive(text)) seams.push({ dir: ent.name, seamPath });
  }
  return seams;
}

function isActive(text) {
  const head = text.split(/\r?\n/).slice(0, HEAD_LINES_FOR_STATUS);
  for (const line of head) {
    const m = /^\s*status\s*:\s*(.+?)\s*$/i.exec(line);
    if (!m) continue;
    const val = m[1].replace(/\s+#.*$/, '').trim().toLowerCase();
    if (val === 'active') return true;
  }
  return false;
}

function relPath(root, p) {
  try { return path.relative(root, p).replace(/\\/g, '/'); } catch { return p; }
}
