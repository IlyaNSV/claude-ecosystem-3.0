#!/usr/bin/env node
/**
 * parse-sessions.cjs — Фаза 0 (3.1 + M12) анализа эффективности Global Loop.
 *
 * Строит из jsonl-транскриптов две таблицы по схемам PREREG §4:
 *   DATASET/sessions.csv   — сессионные агрегаты (токены, wall-clock, tool-calls, инциденты, субагенты)
 *   DATASET/toolcalls.csv  — плоский поток tool-call'ов с dup_index для loop-ratio (M12)
 *
 * Источники (provenance пишется в каждую строку):
 *   - VM-CORPUS (копия корпуса VM, снята 2026-07-29) — executor-сессии пилота + их субагенты
 *   - хост-корпус ~/.claude/projects/C--Users-pw201-WebstormProjects-claude-ecosystem-3-0 (+ ce3-wt-global-loop)
 *   - harvest RUN-* — только для разметки cond-sNN (session_id → метка)
 *
 * Ничего не мутирует, кроме файлов внутри analysis/DATASET/.
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');

const HOME = process.env.USERPROFILE || process.env.HOME;
const ROOT = path.resolve(__dirname, '..');            // dev/global-loop/analysis
const OUT = path.join(ROOT, 'DATASET');
const WS = path.join(HOME, 'WebstormProjects');
const VM_CORPUS = path.join(WS, 'vm-harvests', 'VM-CORPUS', '-home-cc-dev-projects-my-first-test');
const VM_CORPUS_ECO = path.join(WS, 'vm-harvests', 'VM-CORPUS', '-home-cc-dev-projects-claude-ecosystem-3-0');
const HOST_PROJ = path.join(HOME, '.claude', 'projects', 'C--Users-pw201-WebstormProjects-claude-ecosystem-3-0');
const HOST_PROJ_WT = path.join(HOME, '.claude', 'projects', 'C--Users-pw201-WebstormProjects-ce3-wt-global-loop');
const HARVEST = [
  path.join(WS, 'vm-harvests', 'RUN-2026-07-17-A'),
  path.join(WS, 'vm-harvests', 'RUN-2026-07-22-B'),
];

const GAP_ACTIVE_MS = 15 * 60 * 1000;   // PREREG §3: интервал >15 мин = простой
const GAP_STALL_MS = 5 * 60 * 1000;     // PREREG: разрыв >5 мин = кандидат в api-инцидент

// ---------- утилиты ----------
const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);
const csvEsc = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
function writeCsv(file, header, rows) {
  const fd = fs.createWriteStream(file);
  fd.write(header.join(',') + '\n');
  for (const r of rows) fd.write(header.map((h) => csvEsc(r[h])).join(',') + '\n');
  fd.end();
}

/** нормализованный отпечаток аргументов tool-call (для детекта повторов, M12) */
function argDigest(name, input) {
  if (!input || typeof input !== 'object') return sha1(name + '|' + String(input));
  const pick = (...keys) => keys.map((k) => (input[k] === undefined ? '' : String(input[k]))).join('|');
  let key;
  switch (name) {
    case 'Bash': case 'PowerShell': key = String(input.command || '').replace(/\s+/g, ' ').trim(); break;
    case 'Read': case 'NotebookEdit': key = pick('file_path', 'offset', 'limit'); break;
    case 'Write': key = pick('file_path'); break;
    case 'Edit': key = pick('file_path', 'old_string'); break;
    case 'Grep': key = pick('pattern', 'path', 'glob', 'output_mode'); break;
    case 'Glob': key = pick('pattern', 'path'); break;
    default: {
      const o = {};
      for (const k of Object.keys(input).sort()) {
        const v = input[k];
        o[k] = typeof v === 'string' ? v.slice(0, 400) : v;
      }
      key = JSON.stringify(o);
    }
  }
  return sha1(name + '|' + key);
}
function fileTarget(name, input) {
  if (!input || typeof input !== 'object') return '';
  return input.file_path || input.path || input.notebook_path || '';
}

// ---------- разбор одного jsonl ----------
async function parseJsonl(file) {
  const st = {
    lines: 0, parseFail: 0, sessionId: '', cwd: '', gitBranch: '', version: '',
    firstTs: null, lastTs: null, tsList: [],
    msgsAssistant: 0, msgsUser: 0, apiErrorMsgs: 0,
    tok: { out: 0, in_fresh: 0, cache_read: 0, cache_create: 0 },
    models: new Map(), tools: [], toolResults: new Map(), userPrompts: [],
  };
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    st.lines++;
    let o; try { o = JSON.parse(line); } catch { st.parseFail++; continue; }
    if (o.sessionId && !st.sessionId) st.sessionId = o.sessionId;
    if (o.cwd && !st.cwd) st.cwd = o.cwd;
    if (o.gitBranch && !st.gitBranch) st.gitBranch = o.gitBranch;
    if (o.version && !st.version) st.version = o.version;
    if (o.timestamp) {
      const t = Date.parse(o.timestamp);
      if (!Number.isNaN(t)) { st.tsList.push(t); if (st.firstTs === null || t < st.firstTs) st.firstTs = t; if (st.lastTs === null || t > st.lastTs) st.lastTs = t; }
    }
    if (o.isApiErrorMessage) st.apiErrorMsgs++;
    const m = o.message;
    if (o.type === 'assistant' && m) {
      st.msgsAssistant++;
      if (m.model) st.models.set(m.model, (st.models.get(m.model) || 0) + 1);
      const u = m.usage || {};
      st.tok.out += u.output_tokens || 0;
      st.tok.in_fresh += u.input_tokens || 0;
      st.tok.cache_read += u.cache_read_input_tokens || 0;
      st.tok.cache_create += u.cache_creation_input_tokens || 0;
      if (Array.isArray(m.content)) {
        for (const c of m.content) {
          if (c && c.type === 'tool_use') {
            st.tools.push({ ts: o.timestamp || '', id: c.id, name: c.name, digest: argDigest(c.name, c.input), target: fileTarget(c.name, c.input) });
          }
        }
      }
    } else if (o.type === 'user' && m) {
      st.msgsUser++;
      if (Array.isArray(m.content)) {
        for (const c of m.content) {
          if (c && c.type === 'tool_result') st.toolResults.set(c.tool_use_id, !!c.is_error);
        }
      } else if (typeof m.content === 'string' && !o.isMeta) {
        st.userPrompts.push({ ts: o.timestamp || '', text: m.content });
      }
    }
  }
  return st;
}

// ---------- субагенты сессии ----------
async function parseSubagents(dir) {
  const res = { files: 0, tok_out: 0, tok_ctx: 0, models: new Map(), toolCalls: 0 };
  if (!fs.existsSync(dir)) return res;
  const stack = [dir], jsonls = [];
  while (stack.length) {
    const d = stack.pop();
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.name.endsWith('.jsonl')) jsonls.push(p);
    }
  }
  res.files = jsonls.length;
  for (const f of jsonls) {
    const rl = readline.createInterface({ input: fs.createReadStream(f), crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line.trim()) continue;
      let o; try { o = JSON.parse(line); } catch { continue; }
      const m = o.message;
      if (o.type === 'assistant' && m) {
        if (m.model) res.models.set(m.model, (res.models.get(m.model) || 0) + 1);
        const u = m.usage || {};
        res.tok_out += u.output_tokens || 0;
        res.tok_ctx += (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
        if (Array.isArray(m.content)) for (const c of m.content) if (c && c.type === 'tool_use') res.toolCalls++;
      }
    }
  }
  return res;
}

// ---------- разметка cond-sNN по harvest ----------
async function buildCondMap() {
  const map = new Map(); // sessionId -> {label, run, harvestFile}
  for (const dir of HARVEST) {
    if (!fs.existsSync(dir)) continue;
    const run = /RUN-2026-07-17-A/.test(dir) ? 'RUN-A' : 'RUN-B';
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.jsonl')) continue;
      const label = (f.match(/^(cond-s\d+(?:-partial)?|extra-[0-9a-f]+)/) || [null, f.replace('.jsonl', '')])[0];
      const full = path.join(dir, f);
      const rl = readline.createInterface({ input: fs.createReadStream(full), crlfDelay: Infinity });
      let sid = '';
      for await (const line of rl) {
        if (!line.trim()) continue;
        try { const o = JSON.parse(line); if (o.sessionId) { sid = o.sessionId; break; } } catch { /* ignore */ }
      }
      rl.close();
      if (!sid) continue;
      // Коллизия: один sessionId может иметь несколько harvest-файлов (cond-s12 ≡ extra-*, cond-s35 ≡ s35-partial).
      // Приоритет — «чистой» метке cond-sNN; служебные снимки копятся в aliases.
      const prev = map.get(sid);
      const isClean = /^cond-s\d+$/.test(label);
      if (!prev) map.set(sid, { label, run, harvestFile: path.basename(full), aliases: [] });
      else if (isClean && !/^cond-s\d+$/.test(prev.label)) {
        map.set(sid, { label, run, harvestFile: path.basename(full), aliases: [...prev.aliases, prev.label] });
      } else prev.aliases.push(label);
    }
  }
  return map;
}

function epochOf(firstTs, layer) {
  if (firstTs === null) return 'unknown';
  const t = firstTs;
  const d = (s) => Date.parse(s);
  if (t < d('2026-07-17T00:00:00Z')) return 'pre-conductor';
  if (t < d('2026-07-21T00:00:00Z')) return 'RUN-A';
  if (t < d('2026-07-24T12:00:00Z')) return 'RUN-B';
  return 'post-run';
}

// ---------- главный проход ----------
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const condMap = await buildCondMap();
  console.log(`cond-map: ${condMap.size} harvest-транскриптов размечено`);

  const targets = [];
  const addDir = (dir, layer, subagentBase) => {
    if (!fs.existsSync(dir)) { console.log(`SKIP (нет): ${dir}`); return; }
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.jsonl')) targets.push({ file: path.join(dir, f), layer, subagentDir: subagentBase ? path.join(dir, f.replace(/\.jsonl$/, ''), 'subagents') : null });
    }
  };
  addDir(VM_CORPUS, 'executor', true);
  addDir(VM_CORPUS_ECO, 'executor-eco', true);
  addDir(HOST_PROJ, 'host', true);
  addDir(HOST_PROJ_WT, 'host', true);
  console.log(`файлов к разбору: ${targets.length}`);

  const sessions = [], toolrows = [];
  let done = 0;
  for (const t of targets) {
    const st = await parseJsonl(t.file);
    const sub = await parseSubagents(t.subagentDir);
    const sid = st.sessionId || path.basename(t.file, '.jsonl');
    const cond = condMap.get(sid) || null;

    // wall-clock
    const ts = st.tsList.sort((a, b) => a - b);
    let active = 0, stalls = 0, maxGap = 0;
    for (let i = 1; i < ts.length; i++) {
      const gap = ts[i] - ts[i - 1];
      if (gap <= GAP_ACTIVE_MS) active += gap;
      if (gap > GAP_STALL_MS) stalls++;
      if (gap > maxGap) maxGap = gap;
    }
    const modelPrimary = [...st.models.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    const layer = t.layer;
    const epoch = epochOf(st.firstTs, layer);

    // tool-calls + dup_index (M12)
    const seen = new Map();
    for (const tc of st.tools) {
      const n = (seen.get(tc.digest) || 0);
      seen.set(tc.digest, n + 1);
      toolrows.push({
        session_id: sid, layer, run_epoch: epoch, cond_label: cond ? cond.label : '',
        ts: tc.ts, tool_name: tc.name, arg_digest: tc.digest, dup_index: n,
        is_error: st.toolResults.has(tc.id) ? (st.toolResults.get(tc.id) ? 1 : 0) : '',
        file_target: tc.target, source_file: path.basename(t.file),
      });
    }
    const dupCalls = st.tools.length - seen.size;

    sessions.push({
      session_id: sid, layer, run_epoch: epoch,
      cond_label: cond ? cond.label : '', cond_aliases: cond ? cond.aliases.join(' ') : '',
      harvest_file: cond ? cond.harvestFile : '',
      source_file: t.file.replace(HOME, '~'),
      model_primary: modelPrimary,
      models_all: [...st.models.entries()].map(([k, v]) => `${k}:${v}`).join(' '),
      first_ts: st.firstTs ? new Date(st.firstTs).toISOString() : '',
      last_ts: st.lastTs ? new Date(st.lastTs).toISOString() : '',
      wall_span_min: st.firstTs && st.lastTs ? +(((st.lastTs - st.firstTs) / 60000).toFixed(1)) : 0,
      wall_active_min: +((active / 60000).toFixed(1)),
      max_gap_min: +((maxGap / 60000).toFixed(1)),
      msgs_assistant: st.msgsAssistant, msgs_user: st.msgsUser,
      tok_out: st.tok.out, tok_in_fresh: st.tok.in_fresh,
      tok_cache_read: st.tok.cache_read, tok_cache_create: st.tok.cache_create,
      ctx_processed: st.tok.in_fresh + st.tok.cache_read + st.tok.cache_create,
      tool_calls_total: st.tools.length, tool_calls_dup: dupCalls,
      loop_ratio: st.tools.length ? +(dupCalls / st.tools.length).toFixed(3) : '',
      tool_errors: [...st.toolResults.values()].filter(Boolean).length,
      api_error_msgs: st.apiErrorMsgs, stall_gaps_gt5min: stalls,
      subagent_files: sub.files, subagent_tok_out: sub.tok_out, subagent_ctx: sub.tok_ctx,
      subagent_tool_calls: sub.toolCalls,
      subagent_models: [...sub.models.entries()].map(([k, v]) => `${k}:${v}`).join(' '),
      tok_out_total: st.tok.out + sub.tok_out,
      user_prompts: st.userPrompts.length,
      lines: st.lines, parse_fail: st.parseFail,
      git_branch: st.gitBranch, cwd: st.cwd, cli_version: st.version,
    });
    if (++done % 25 === 0) console.log(`  ... ${done}/${targets.length}`);
  }

  const S_HDR = Object.keys(sessions[0]);
  writeCsv(path.join(OUT, 'sessions.csv'), S_HDR, sessions.sort((a, b) => (a.first_ts < b.first_ts ? -1 : 1)));
  const T_HDR = ['session_id', 'layer', 'run_epoch', 'cond_label', 'ts', 'tool_name', 'arg_digest', 'dup_index', 'is_error', 'file_target', 'source_file'];
  writeCsv(path.join(OUT, 'toolcalls.csv'), T_HDR, toolrows);

  // сводка в stdout (не в отчёт — отчётные числа считает отдельный шаг)
  const by = (pred) => sessions.filter(pred);
  const sum = (arr, k) => arr.reduce((a, r) => a + (Number(r[k]) || 0), 0);
  for (const ep of ['pre-conductor', 'RUN-A', 'RUN-B', 'post-run', 'unknown']) {
    for (const ly of ['executor', 'executor-eco', 'host']) {
      const g = by((r) => r.run_epoch === ep && r.layer === ly);
      if (!g.length) continue;
      console.log(`${ep}/${ly}: n=${g.length} tok_out=${sum(g, 'tok_out')} sub_out=${sum(g, 'subagent_tok_out')} ctx=${sum(g, 'ctx_processed')} tools=${sum(g, 'tool_calls_total')} active_h=${(sum(g, 'wall_active_min') / 60).toFixed(1)}`);
    }
  }
  console.log(`\nsessions.csv: ${sessions.length} строк; toolcalls.csv: ${toolrows.length} строк → ${OUT}`);
})();
