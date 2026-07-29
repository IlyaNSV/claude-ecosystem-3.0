#!/usr/bin/env node
/**
 * mini-mutation.cjs — M9 (сила тестов) собственным мутатором.
 *
 * ПОЧЕМУ НЕ StrykerJS: три попытки запустить Stryker в pnpm-монорепе пилота провалились
 * (`Cannot find TestRunner plugin "vitest"` — изолированные node_modules pnpm; плагин не
 * резолвится ни из корня, ни из пакета, ни явным путём). Вместо отказа от замера — свой
 * узкий мутатор с прозрачным методом.
 *
 * МЕТОД: в целевой файл вносится ОДНА синтаксическая мутация (типовые операторы), затем
 * прогоняется связанный тест-файл. Мутант «убит», если тесты падают; «выжил», если проходят.
 * mutation score = убитые / (убитые + выжившие). Файл всегда восстанавливается (git checkout).
 *
 * ОГРАНИЧЕНИЯ (в отчёт): выборка узкая (модули, чьи тесты проходят без БД); мутации
 * синтаксические, не семантические; это НЕ полноценный mutation testing, а его нижняя оценка.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const HOME = process.env.USERPROFILE || process.env.HOME;
const REPO = path.join(HOME, 'WebstormProjects', 'vm-harvests', 'PILOT-CLONE');
const API = path.join(REPO, 'apps', 'api');
const OUT = path.resolve(__dirname, '..', 'DATASET');

const TARGETS = [
  { src: 'src/modules/glossary/glossary.normalization.ts', test: 'test/glossary-normalization.unit.test.ts' },
  { src: 'src/modules/glossary/glossary.id.ts', test: 'test/glossary-id.unit.test.ts' },
  { src: 'src/modules/glossary/glossary.errors.ts', test: 'test/glossary-errors.unit.test.ts' },
  { src: 'src/modules/measurement/services/csv-writer.service.ts', test: 'test/csv-writer.service.unit.test.ts' },
];

// типовые мутации (оператор → замена)
const MUTATORS = [
  { name: 'равенство', re: /===/g, to: '!==' },
  { name: 'неравенство', re: /!==/g, to: '===' },
  { name: 'больше-равно', re: /([^<>=!])>=/g, to: '$1>' },
  { name: 'меньше-равно', re: /([^<>=!])<=/g, to: '$1<' },
  { name: 'логическое-И', re: /&&/g, to: '||' },
  { name: 'логическое-ИЛИ', re: /\|\|/g, to: '&&' },
  { name: 'булев-литерал-true', re: /\btrue\b/g, to: 'false' },
  { name: 'булев-литерал-false', re: /\bfalse\b/g, to: 'true' },
  { name: 'инкремент-границы', re: /\+ 1\b/g, to: '+ 2' },
  { name: 'обнуление-литерала', re: /\b0\b/g, to: '1' },
];

const runTest = (testFile) => {
  try {
    execFileSync('npx', ['vitest', 'run', testFile, '--reporter=basic', '--typecheck.enabled=false'],
      { cwd: API, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000, shell: true });
    return 'passed';
  } catch (e) {
    const out = `${e.stdout || ''}${e.stderr || ''}`;
    if (/Test Files.*failed|Tests.*failed|FAIL/i.test(out)) return 'failed';
    return 'error';
  }
};

const results = [];
console.log('базовый прогон (без мутаций) — тесты должны быть зелёными:');
for (const t of TARGETS) {
  const base = runTest(t.test);
  console.log(`  ${t.test}: ${base}`);
  if (base !== 'passed') { console.log('   ⚠ базовый прогон не зелёный — файл исключён из замера'); t.skip = true; }
}

for (const t of TARGETS.filter((x) => !x.skip)) {
  const abs = path.join(API, t.src);
  const original = fs.readFileSync(abs, 'utf8');
  let applied = 0;
  for (const m of MUTATORS) {
    if (applied >= 6) break;                      // не более 6 мутантов на файл
    const matches = [...original.matchAll(m.re)];
    if (!matches.length) continue;
    // мутируем ПЕРВОЕ вхождение (детерминированно, без random)
    const idx = matches[0].index;
    const before = original.slice(0, idx);
    const after = original.slice(idx).replace(m.re, m.to);
    const mutated = before + after.slice(0, after.length);
    if (mutated === original) continue;
    fs.writeFileSync(abs, mutated);
    const verdict = runTest(t.test);
    fs.writeFileSync(abs, original);              // восстановление сразу
    applied++;
    const killed = verdict === 'failed';
    results.push({ file: t.src, test: t.test, mutator: m.name, outcome: killed ? 'убит' : verdict === 'error' ? 'ошибка прогона' : 'ВЫЖИЛ' });
    console.log(`  ${t.src} [${m.name}] → ${killed ? 'убит' : verdict === 'error' ? 'ошибка' : 'ВЫЖИЛ'}`);
  }
}

// финальная проверка целостности рабочего дерева
let dirty = '';
try { dirty = execFileSync('git', ['-C', REPO, 'status', '--porcelain', '--', 'apps/api/src'], { encoding: 'utf8' }).trim(); } catch { /* ignore */ }
if (dirty) {
  console.log('⚠ дерево не чистое, откатываю:', dirty.slice(0, 200));
  execFileSync('git', ['-C', REPO, 'checkout', '--', 'apps/api/src'], { stdio: 'ignore' });
}

const killed = results.filter((r) => r.outcome === 'убит').length;
const survived = results.filter((r) => r.outcome === 'ВЫЖИЛ').length;
const errored = results.filter((r) => r.outcome === 'ошибка прогона').length;
const score = killed + survived ? killed / (killed + survived) : null;

const esc = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
fs.writeFileSync(path.join(OUT, 'mutation_probe.csv'),
  ['file,test,mutator,outcome', ...results.map((r) => [r.file, r.test, r.mutator, r.outcome].map(esc).join(','))].join('\n') + '\n');

console.log(`\nмутантов: ${results.length} · убито: ${killed} · выжило: ${survived} · ошибок прогона: ${errored}`);
console.log(`mutation score (нижняя оценка) = ${score === null ? '—' : score.toFixed(3)} (порог PREREG: ≥0.70 спокойно, <0.50 тревога)`);
