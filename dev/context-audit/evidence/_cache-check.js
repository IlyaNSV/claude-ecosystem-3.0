// Решающая проверка R2: РЕАЛЬНО ли хитует prompt-кэш в наших сессиях?
// Если cache_read >> cache_creation — резидентный префикс кэшируется, экономический аргумент за рез МЁРТВ.
// Если cache_creation высок из хода в ход — кэш ломается, и вся экономика меняется.
const fs = require('fs');
const path = require('path');
const TDIR = 'C:/Users/pw201/.claude/projects/C--Users-pw201-WebstormProjects-claude-ecosystem-3-0';

let read = 0, create = 0, input = 0, output = 0, n = 0, withCache = 0;
const perSession = [];

for (const f of fs.readdirSync(TDIR).filter(x => x.endsWith('.jsonl'))) {
  let sr = 0, sc = 0, si = 0, sn = 0;
  const raw = fs.readFileSync(path.join(TDIR, f), 'utf8');
  for (const line of raw.split('\n')) {
    if (!line) continue;
    let o; try { o = JSON.parse(line); } catch (e) { continue; }
    const u = o.message && o.message.usage;
    if (!u) continue;
    n++; sn++;
    const cr = u.cache_read_input_tokens || 0;
    const cc = u.cache_creation_input_tokens || 0;
    read += cr; create += cc; sr += cr; sc += cc;
    input += u.input_tokens || 0; si += u.input_tokens || 0;
    output += u.output_tokens || 0;
    if (cr > 0) withCache++;
  }
  if (sn) perSession.push({ f: f.slice(0, 8), turns: sn, read: sr, create: sc, input: si });
}

const M = x => (x / 1e6).toFixed(1);
console.log('=== PROMPT CACHE — РЕАЛЬНОСТЬ (69 сессий) ===');
console.log('ассистент-ходов с usage:', n);
console.log('');
console.log('  cache_read_input_tokens    :', M(read), 'M   <- читаем из кэша (0.1x цены)');
console.log('  cache_creation_input_tokens:', M(create), 'M   <- пишем в кэш (1.25x цены)');
console.log('  input_tokens (некэш)       :', M(input), 'M');
console.log('  output_tokens              :', M(output), 'M');
console.log('');
const total = read + create + input;
console.log('доля префикса, обслуженная ИЗ КЭША:', (100 * read / Math.max(1, read + create)).toFixed(1) + '%');
console.log('ходов, где кэш ХИТНУЛ:', withCache, '/', n, '=', (100 * withCache / n).toFixed(1) + '%');
console.log('');
console.log('=== ЦЕНА (ставки Opus: base $15/MTok in, cache-write $18.75, cache-read $1.50) ===');
const cost = (read / 1e6) * 1.5 + (create / 1e6) * 18.75 + (input / 1e6) * 15;
const costNoCache = ((read + create + input) / 1e6) * 15;
console.log('фактически (с кэшем)  : $' + cost.toFixed(2));
console.log('если бы кэша не было  : $' + costNoCache.toFixed(2));
console.log('экономия кэша         : ' + (100 * (1 - cost / costNoCache)).toFixed(1) + '%');
console.log('');
console.log('=== ЧТО ЭТО ЗНАЧИТ ДЛЯ РЕЗА CLAUDE.md ===');
// резидент ~19k токенов. Сколько раз он был бы прочитан из кэша?
const RESIDENT_TOK = 19000;
const savedIfHalved = (RESIDENT_TOK / 2) * withCache;
console.log('резидент ≈', RESIDENT_TOK, 'токенов; ходов с кэш-хитом:', withCache);
console.log('срезав резидент ВДВОЕ, мы бы сэкономили ≈', (savedIfHalved / 1e6).toFixed(2), 'M кэш-read-токенов');
console.log('= $' + ((savedIfHalved / 1e6) * 1.5).toFixed(2), 'за ВСЕ 69 сессий');
console.log('');
console.log('=== 5 сессий с худшим кэш-хитом (create >> read = кэш ломался) ===');
perSession.filter(s => s.turns > 20).sort((a, b) => (b.create / Math.max(1, b.read)) - (a.create / Math.max(1, a.read)))
  .slice(0, 5).forEach(s => console.log('  ', s.f, 'ходов', String(s.turns).padStart(4),
    '| read', (s.read / 1e6).toFixed(1) + 'M', '| create', (s.create / 1e6).toFixed(2) + 'M',
    '| ratio create/read', (s.create / Math.max(1, s.read)).toFixed(3)));
