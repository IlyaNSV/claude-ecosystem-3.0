// WS-2 Волна 2 (v3, финал) — калиброванный аудит дрейфа.
// История инструмента (важна для честности отчёта):
//   v1: 30.1% STALE — НЕВЕРНО (считал ложью кросс-репо хеши, memory-ссылки, архивные DEC-DEV)
//   v2: 10.7% STALE — всё ещё неверно (относительные пути, 8-символьные UUID-префиксы как "хеши",
//                     over-firing детектора "заявлен merged")
//   v3: ниже. Правила: коммит = РОВНО 7 hex в бэктиках; PR — только существование (детектор
//       "заявлен merged" отброшен как ненадёжный: память оказалась точнее его); пути резолвятся
//       по 5 базам; архивные записи памяти — отдельная корзина.
const fs = require('fs');
const path = require('path');

const S = 'C:/Users/pw201/AppData/Local/Temp/claude/C--Users-pw201-WebstormProjects-claude-ecosystem-3-0/c72365f7-7cdd-4f17-b5ad-d10031b0d96d/scratchpad';
const REPO = 'C:/Users/pw201/WebstormProjects/claude-ecosystem-3.0';
const MEM = 'C:/Users/pw201/.claude/projects/C--Users-pw201-WebstormProjects-claude-ecosystem-3-0/memory';

const allHashes = fs.readFileSync(S + '/all-hashes.txt', 'utf8').split('\n').map(x => x.trim()).filter(Boolean);
const mainHashes = new Set(fs.readFileSync(S + '/main-hashes.txt', 'utf8').split('\n').map(x => x.trim()).filter(Boolean));
const tags = new Set(fs.readFileSync(S + '/tags.txt', 'utf8').split('\n').map(x => x.trim()).filter(Boolean));
const prs = new Map(JSON.parse(fs.readFileSync(S + '/prs.json', 'utf8')).map(p => [p.number, p]));

let journal = fs.readFileSync(REPO + '/DEV_JOURNAL.md', 'utf8');
const ja = REPO + '/dev/_archive/journal';
if (fs.existsSync(ja)) for (const f of fs.readdirSync(ja)) journal += fs.readFileSync(path.join(ja, f), 'utf8');

const in7 = new Set(allHashes.map(h => h.slice(0, 7)));
const inMain7 = new Set([...mainHashes].map(h => h.slice(0, 7)));

const CROSS = /meta-system|product-radar|Product Radar|factory-conductor|Factory Conductor|Кондуктор|Meta System|пилот|my-first-test|\bVM\b|виртуалк|Radar/i;
const PBASES = [REPO, MEM, REPO + '/dev/meta-improvement', REPO + '/dev', REPO + '/docs'];

const targets = [
  { n: 'MEMORY.md (индекс) [РЕЗИДЕНТ]', f: MEM + '/MEMORY.md', L: 'L0' },
  { n: 'CLAUDE.md проекта [РЕЗИДЕНТ]', f: REPO + '/CLAUDE.md', L: 'L0' },
  { n: 'CLAUDE.md глобальный [РЕЗИДЕНТ]', f: 'C:/Users/pw201/.claude/CLAUDE.md', L: 'L0' },
];
fs.readdirSync(MEM).filter(f => f.endsWith('.md') && f !== 'MEMORY.md').forEach(f =>
  targets.push({ n: 'memory/' + f, f: MEM + '/' + f, L: /archive/i.test(f) ? 'L1-ARCH' : 'L1' }));

const C = [];
const add = (t, ty, raw, v, d) => C.push({ tgt: t.n, L: t.L, ty, raw, v, d });

for (const t of targets) {
  let x; try { x = fs.readFileSync(t.f, 'utf8'); } catch (e) { continue; }
  const ctx = (i, w) => x.slice(Math.max(0, i - w), i + w);

  const sH = new Set();
  for (const m of x.matchAll(/`([0-9a-f]{7})`/g)) {              // РОВНО 7 — конвенция git short hash
    const h = m[1]; if (sH.has(h)) continue; sH.add(h);
    if (inMain7.has(h)) { add(t, 'commit', h, 'TRUE', 'в main'); continue; }
    if (in7.has(h)) { add(t, 'commit', h, 'STALE', 'есть, но НЕ в main'); continue; }
    add(t, 'commit', h, CROSS.test(ctx(m.index, 220)) ? 'CROSS' : 'STALE',
      CROSS.test(ctx(m.index, 220)) ? 'другой репо/пилот/VM' : 'МЁРТВЫЙ УКАЗАТЕЛЬ: нет ни в одной ветке (ветка squash-мержена или переписана)');
  }
  for (const m of x.matchAll(/`([0-9a-f]{8,40})`/g)) add(t, 'hex8+', m[1], 'AMBIG', 'не 7-hex — возможно UUID/идентификатор, не коммит');

  const sP = new Set();
  for (const m of x.matchAll(/(?:^|[^#\w])#(\d{1,4})\b/gm)) {
    const n = Number(m[1]); if (sP.has(n)) continue; sP.add(n);
    const pr = prs.get(n);
    if (pr) add(t, 'PR', '#' + n, 'TRUE', 'PR существует, состояние ' + pr.state);
    else add(t, 'PR', '#' + n, CROSS.test(ctx(m.index, 150)) ? 'CROSS' : 'STALE', 'PR не найден в этом репо');
  }

  const sV = new Set();
  for (const m of x.matchAll(/`v?(\d+\.\d+\.\d+)`|\bv(\d+\.\d+\.\d+)\b/g)) {
    const v = m[1] || m[2]; if (sV.has(v)) continue; sV.add(v);
    if (tags.has('v' + v) || tags.has(v)) add(t, 'version', v, 'TRUE', 'тег есть');
    else add(t, 'version', v, CROSS.test(ctx(m.index, 200)) ? 'CROSS' : 'STALE', 'тега нет в этом репо');
  }

  const sD = new Set();
  for (const m of x.matchAll(/DEC-DEV-(\d{4})/g)) {
    const d = m[0]; if (sD.has(d)) continue; sD.add(d);
    add(t, 'DEC-DEV', d, journal.includes(d) ? 'TRUE' : 'STALE', journal.includes(d) ? 'в журнале' : 'НЕТ в журнале');
  }

  const sF = new Set();
  for (const m of x.matchAll(/`([\w./~-]+\/[\w.-]+\.(?:md|js|cjs|mjs|yaml|yml|json|sh|ts))`|\]\(([\w./-]+\.(?:md|yaml|yml|js|cjs))\)/g)) {
    const p = (m[1] || m[2]).replace(/^\.\//, ''); if (sF.has(p)) continue; sF.add(p);
    if (/^~|^\/home|^C:|^\/Users/.test(p)) { add(t, 'path', p, 'CROSS', 'абсолютный путь вне репо'); continue; }
    if (PBASES.some(b => fs.existsSync(path.join(b, p)))) { add(t, 'path', p, 'TRUE', 'резолвится'); continue; }
    if (/^\.claude\//.test(p)) { add(t, 'path', p, 'CROSS', 'путь инсталляции .claude/'); continue; }
    add(t, 'path', p, CROSS.test(ctx(m.index, 220)) ? 'CROSS' : 'STALE', CROSS.test(ctx(m.index, 220)) ? 'другой репо/пилот' : 'БИТАЯ ССЫЛКА: не резолвится ни по одной базе');
  }
}

const VS = ['TRUE', 'STALE', 'CROSS', 'AMBIG'];
const cnt = a => VS.reduce((o, v) => (o[v] = a.filter(z => z.v === v).length, o), {});
const verifiable = C.filter(c => c.v === 'TRUE' || c.v === 'STALE');   // только то, что реально проверяемо отсюда
const g = cnt(C);

console.log('=== АУДИТ ДРЕЙФА v3 (калиброванный) ===');
console.log('всего извлечено утверждений:', C.length);
VS.forEach(v => console.log('  ' + v.padEnd(6), String(g[v]).padStart(4), '(' + (100 * g[v] / C.length).toFixed(1) + '%)'));
console.log('');
console.log('>>> ДРЕЙФ считаем ТОЛЬКО по проверяемым (TRUE+STALE =', verifiable.length + '):');
const st = verifiable.filter(c => c.v === 'STALE').length;
console.log('    STALE =', st, '=> дрейф', (100 * st / verifiable.length).toFixed(1) + '%');
console.log('');
for (const L of ['L0', 'L1', 'L1-ARCH']) {
  const c = C.filter(z => z.L === L);
  const vf = c.filter(z => z.v === 'TRUE' || z.v === 'STALE');
  const s = vf.filter(z => z.v === 'STALE').length;
  const lbl = L === 'L0' ? 'L0 резидент     ' : L === 'L1' ? 'L1 память живая ' : 'L1 память архив ';
  console.log(lbl, 'проверяемых', String(vf.length).padStart(4), '| STALE', String(s).padStart(3),
    '| дрейф', (100 * s / Math.max(1, vf.length)).toFixed(1) + '%',
    '| CROSS', c.filter(z => z.v === 'CROSS').length);
}
console.log('');
console.log('=== ОСТАТОЧНЫЕ STALE (полный список, для ручной проверки) ===');
const res = C.filter(c => c.v === 'STALE');
const byT = {};
res.forEach(c => { byT[c.ty] = byT[c.ty] || []; byT[c.ty].push(c); });
for (const ty of Object.keys(byT)) {
  console.log('\n-- ' + ty + ' (' + byT[ty].length + ') --');
  byT[ty].slice(0, 30).forEach(c => console.log('   ' + c.raw.padEnd(46) + ' | ' + c.tgt.replace('memory/', '') + ' | ' + c.d));
  if (byT[ty].length > 30) console.log('   … ещё ' + (byT[ty].length - 30));
}
fs.writeFileSync(S + '/DRIFT_v3.json', JSON.stringify(C, null, 1), 'utf8');
