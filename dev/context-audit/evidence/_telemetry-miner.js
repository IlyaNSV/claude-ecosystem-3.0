// WS-2 Волна 1 — телеметрия: что главный агент РЕАЛЬНО читал/искал за 69 сессий.
// Read-only. Выход — агрегаты, не содержимое.
const fs = require('fs');
const path = require('path');

const TDIR = 'C:/Users/pw201/.claude/projects/C--Users-pw201-WebstormProjects-claude-ecosystem-3-0';
const REPO = 'C:/Users/pw201/WebstormProjects/claude-ecosystem-3.0';
const MEMDIR = TDIR + '/memory';
const OUT = 'C:/Users/pw201/AppData/Local/Temp/claude/C--Users-pw201-WebstormProjects-claude-ecosystem-3-0/c72365f7-7cdd-4f17-b5ad-d10031b0d96d/scratchpad/TELEMETRY.md';

const norm = p => String(p || '').replace(/\\/g, '/').replace(/\/+$/, '');
const rel = p => {
  const n = norm(p);
  const r = norm(REPO);
  return n.toLowerCase().startsWith(r.toLowerCase()) ? n.slice(r.length + 1) : n;
};

// ---------- ground truth: what docs exist in the repo ----------
const DOC_EXT = new Set(['.md', '.yaml', '.yml']);
const repoDocs = new Map(); // relpath -> bytes
(function walk(dir) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const e of ents) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === '.claude') continue;
      walk(full);
    } else if (DOC_EXT.has(path.extname(e.name).toLowerCase())) {
      repoDocs.set(rel(full), fs.statSync(full).size);
    }
  }
})(REPO);

const memFiles = fs.readdirSync(MEMDIR).filter(f => f.endsWith('.md'));
const memSlugs = memFiles.map(f => f.replace(/\.md$/, ''));

// ---------- scan transcripts ----------
const files = fs.readdirSync(TDIR).filter(f => f.endsWith('.jsonl'));

const toolCounts = {};
const reads = new Map();   // relpath -> {n, sessions:Set, full:0, partial:0}
const greps = [];          // {pattern, path}
const globs = [];
const skillCalls = {};
const agentSpawns = {};
let archiveTouches = 0, totalPathTouches = 0;
const memRecallSessions = {}; // slug -> Set(session)
let totalToolCalls = 0;
const sessionDates = [];

for (const f of files) {
  const sid = f.replace(/\.jsonl$/, '');
  const raw = fs.readFileSync(path.join(TDIR, f), 'utf8');
  const st = fs.statSync(path.join(TDIR, f));
  sessionDates.push(st.mtime);

  // memory-recall approximation: slug mentioned inside a system-reminder block in this session
  for (const slug of memSlugs) {
    if (raw.includes(slug)) {
      memRecallSessions[slug] = memRecallSessions[slug] || new Set();
      memRecallSessions[slug].add(sid);
    }
  }

  for (const line of raw.split('\n')) {
    if (!line) continue;
    let o; try { o = JSON.parse(line); } catch (e) { continue; }
    const msg = o.message;
    if (!msg || !Array.isArray(msg.content)) continue;
    for (const c of msg.content) {
      if (c.type !== 'tool_use') continue;
      totalToolCalls++;
      toolCounts[c.name] = (toolCounts[c.name] || 0) + 1;
      const inp = c.input || {};

      if (c.name === 'Read' && inp.file_path) {
        const r = rel(inp.file_path);
        totalPathTouches++;
        if (/_archive|\/deferred\//i.test(norm(inp.file_path))) archiveTouches++;
        const e = reads.get(r) || { n: 0, sessions: new Set(), full: 0, partial: 0 };
        e.n++;
        e.sessions.add(sid);
        if (inp.limit === undefined && inp.offset === undefined) e.full++; else e.partial++;
        reads.set(r, e);
      }
      if (c.name === 'Grep') {
        greps.push({ pattern: String(inp.pattern || ''), path: inp.path ? rel(inp.path) : '(cwd)' });
        totalPathTouches++;
        if (inp.path && /_archive|\/deferred\//i.test(norm(inp.path))) archiveTouches++;
      }
      if (c.name === 'Glob') globs.push(String(inp.pattern || ''));
      if (c.name === 'Skill') skillCalls[inp.skill] = (skillCalls[inp.skill] || 0) + 1;
      if (c.name === 'Agent') agentSpawns[inp.subagent_type || '?'] = (agentSpawns[inp.subagent_type || '?'] || 0) + 1;
    }
  }
}

// ---------- derive ----------
const readList = [...reads.entries()].map(([p, e]) => ({
  p, n: e.n, s: e.sessions.size, full: e.full, partial: e.partial,
  bytes: repoDocs.get(p) || null,
}));
readList.sort((a, b) => b.n - a.n);

const readDocSet = new Set(readList.map(r => r.p));
const neverRead = [...repoDocs.entries()].filter(([p]) => !readDocSet.has(p));
const neverReadBytes = neverRead.reduce((s, [, b]) => s + b, 0);
const allDocBytes = [...repoDocs.values()].reduce((s, b) => s + b, 0);

// full reads of big files = token waste candidates
const bigFullReads = readList
  .filter(r => r.bytes && r.bytes > 60 * 1024 && r.full > 0)
  .sort((a, b) => (b.full * b.bytes) - (a.full * a.bytes));

// the always-on / pointer docs — were they actually used? (tests H6)
const POINTERS = ['docs/MAP.md', 'dev/INFORMATION-MAP.yaml', 'dev/meta-improvement/rails/RAILS.md',
  'ROADMAP.md', 'DEV_JOURNAL.md', 'CHANGELOG.md', 'README.md', 'CLAUDE.md'];

const memUsage = memSlugs.map(s => ({ s, n: (memRecallSessions[s] || new Set()).size }))
  .sort((a, b) => b.n - a.n);

const dates = sessionDates.sort((a, b) => a - b);
const fmt = d => d.toISOString().slice(0, 10);
const kb = b => (b / 1024).toFixed(1);

// ---------- report ----------
const L = [];
L.push('# WS-2 Волна 1 — Телеметрия (что агент РЕАЛЬНО читал)');
L.push('');
L.push('Источник: ' + files.length + ' транскриптов, ' + fmt(dates[0]) + ' … ' + fmt(dates[dates.length - 1]) + '. Всего tool-вызовов: ' + totalToolCalls + '.');
L.push('');
L.push('## 1. Распределение инструментов');
L.push('');
L.push('| tool | вызовов |');
L.push('|---|--:|');
Object.entries(toolCounts).sort((a, b) => b[1] - a[1]).slice(0, 18)
  .forEach(([k, v]) => L.push('| ' + k + ' | ' + v + ' |'));
L.push('');

L.push('## 2. Топ-30 читаемых файлов');
L.push('');
L.push('| файл | чтений | сессий | целиком | частично | KB |');
L.push('|---|--:|--:|--:|--:|--:|');
readList.slice(0, 30).forEach(r =>
  L.push('| ' + r.p + ' | ' + r.n + ' | ' + r.s + ' | ' + r.full + ' | ' + r.partial + ' | ' + (r.bytes ? kb(r.bytes) : '-') + ' |'));
L.push('');

L.push('## 3. Чтение больших файлов ЦЕЛИКОМ (кандидаты в токен-слив)');
L.push('');
L.push('| файл | KB | раз целиком | ~сожжено KB |');
L.push('|---|--:|--:|--:|');
bigFullReads.slice(0, 15).forEach(r =>
  L.push('| ' + r.p + ' | ' + kb(r.bytes) + ' | ' + r.full + ' | ' + kb(r.bytes * r.full) + ' |'));
L.push('');
L.push('Суммарно сожжено на полных чтениях файлов >60KB: **' + kb(bigFullReads.reduce((s, r) => s + r.bytes * r.full, 0)) + ' KB**');
L.push('');

L.push('## 4. Указатели/каноны — используются ли на практике (H6)');
L.push('');
L.push('| док | чтений | в скольких сессиях (из ' + files.length + ') |');
L.push('|---|--:|--:|');
POINTERS.forEach(p => {
  const r = readList.find(x => x.p === p);
  L.push('| ' + p + ' | ' + (r ? r.n : 0) + ' | ' + (r ? r.s : 0) + ' |');
});
L.push('');

L.push('## 5. Мёртвый груз репо (H2)');
L.push('');
L.push('Всего doc-файлов в репо (без .claude/): **' + repoDocs.size + '** (' + kb(allDocBytes) + ' KB)');
L.push('Хоть раз открывались: **' + readDocSet.size + '**');
L.push('НИ РАЗУ не открывались: **' + neverRead.length + '** (' + kb(neverReadBytes) + ' KB, ' + (100 * neverReadBytes / allDocBytes).toFixed(0) + '% от массы)');
L.push('');
L.push('20 крупнейших ни разу не прочитанных:');
L.push('');
L.push('| файл | KB |');
L.push('|---|--:|');
neverRead.sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([p, b]) => L.push('| ' + p + ' | ' + kb(b) + ' |'));
L.push('');

L.push('## 6. Загрязнение архивом');
L.push('');
L.push('Обращений к путям с `_archive`/`deferred`: **' + archiveTouches + '** из ' + totalPathTouches + ' path-обращений (' + (100 * archiveTouches / Math.max(1, totalPathTouches)).toFixed(1) + '%)');
L.push('');

L.push('## 7. Память — в скольких сессиях слаг вообще всплывал (приблизительно)');
L.push('');
L.push('| memory | сессий (из ' + files.length + ') |');
L.push('|---|--:|');
memUsage.forEach(m => L.push('| ' + m.s + ' | ' + m.n + ' |'));
L.push('');

L.push('## 8. Скиллы и субагенты');
L.push('');
L.push('Skill: ' + (Object.keys(skillCalls).length ? JSON.stringify(skillCalls) : 'ни разу'));
L.push('Agent subagent_type: ' + (Object.keys(agentSpawns).length ? JSON.stringify(agentSpawns) : 'ни разу'));
L.push('');

L.push('## 9. Grep — топ-25 паттернов');
L.push('');
const gp = {};
greps.forEach(g => { gp[g.pattern] = (gp[g.pattern] || 0) + 1; });
L.push('Всего grep-вызовов: ' + greps.length + ', уникальных паттернов: ' + Object.keys(gp).length);
L.push('');
Object.entries(gp).sort((a, b) => b[1] - a[1]).slice(0, 25)
  .forEach(([k, v]) => L.push('- `' + k.slice(0, 90) + '` — ' + v));

fs.writeFileSync(OUT, L.join('\n'), 'utf8');
console.log('written:', OUT);
console.log('');
console.log('=== КЛЮЧЕВЫЕ ЦИФРЫ ===');
console.log('транскриптов:', files.length, '| tool-вызовов:', totalToolCalls);
console.log('doc-файлов в репо:', repoDocs.size, '(' + kb(allDocBytes) + ' KB)');
console.log('НИ РАЗУ не открывались:', neverRead.length, '(' + kb(neverReadBytes) + ' KB =', (100 * neverReadBytes / allDocBytes).toFixed(0) + '% массы)');
console.log('полных чтений файлов >60KB сожгло:', kb(bigFullReads.reduce((s, r) => s + r.bytes * r.full, 0)), 'KB');
console.log('архив-обращений:', archiveTouches, '/', totalPathTouches, '=', (100 * archiveTouches / Math.max(1, totalPathTouches)).toFixed(1) + '%');
console.log('');
console.log('Указатели (чтений / сессий):');
POINTERS.forEach(p => { const r = readList.find(x => x.p === p); console.log('  ', p.padEnd(38), (r ? r.n : 0), '/', (r ? r.s : 0)); });
console.log('');
console.log('Топ-12 читаемых:');
readList.slice(0, 12).forEach(r => console.log('  ', String(r.n).padStart(3), 'x', r.p, r.bytes ? '(' + kb(r.bytes) + ' KB, целиком ' + r.full + ')' : ''));
