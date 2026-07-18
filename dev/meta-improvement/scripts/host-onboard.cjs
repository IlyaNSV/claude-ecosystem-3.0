#!/usr/bin/env node
/**
 * host-onboard.cjs — онбординг-пак хост-сессии (кондуктор / ассист-пульт, Волна 0).
 *
 * Собирает в stdout разовый «прогрев» выбранной хост-сессии из ЖИВЫХ файлов —
 * префетч ступеней L0-L2 лестницы K0 (factory-conductor/CONDUCTOR.md §Knowledge plane)
 * + указатели L3 для добора по требованию. Ничего НЕ хранит и НЕ копирует на диск:
 * каждый запуск читает актуальное состояние (анти-дрейф, K0 «резолвером, не пересказом»).
 *
 * Запуск в выбранной сессии-кондукторе (не в каждой):
 *   node dev/meta-improvement/scripts/host-onboard.cjs            # весь пак
 *   node dev/meta-improvement/scripts/host-onboard.cjs --list     # состав и размеры без тел
 *   node dev/meta-improvement/scripts/host-onboard.cjs --skip vm,concepts
 *   node dev/meta-improvement/scripts/host-onboard.cjs --only seam,plan,conductor
 *   node dev/meta-improvement/scripts/host-onboard.cjs --budget 30000   # cap, ~токены
 *
 * Read-only, zero-deps, tolerant: отсутствующий файл даёт warn-строку в паке, не падение.
 * DEC-DEV-0222.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const CONDUCTOR_REPO = path.resolve(ROOT, '..', 'factory-conductor');
const DEFAULT_BUDGET_TOKENS = 40000; // ≈20% окна 200k — верхняя граница, заданная владельцем

// Грубая оценка: русскоязычный markdown ≈ 3.2 символа/токен. Оценка, не замер.
const estTokens = (s) => Math.round(s.length / 3.2);

function readSafe(file, note) {
  try {
    return { ok: true, text: fs.readFileSync(file, 'utf8') };
  } catch (e) {
    return { ok: false, text: `⚠ НЕ НАЙДЕН/НЕЧИТАЕМ: ${file}${note ? ` — ${note}` : ''} (${e.code || e.message})` };
  }
}

function readCapped(file, capChars, note) {
  const r = readSafe(file, note);
  if (r.ok && r.text.length > capChars) {
    r.text = r.text.slice(0, capChars) +
      `\n\n… [ОБРЕЗАНО на ${capChars} символах — полный файл: ${file}]`;
  }
  return r;
}

function joinFiles(files) {
  return files
    .map((f) => {
      const r = typeof f === 'string' ? readSafe(f) : readCapped(f.file, f.cap, f.note);
      const label = typeof f === 'string' ? f : f.file;
      return `<!-- источник: ${label} -->\n${r.text.trimEnd()}`;
    })
    .join('\n\n---\n\n');
}

// slug памяти проекта: путь чекаута с [:\/.] → '-'
const memoryDir = path.join(
  os.homedir(), '.claude', 'projects', ROOT.replace(/[:\\/.]/g, '-'), 'memory'
);

const DEEPDIVE = `Указатели L3 — добор по требованию, НЕ читать сейчас. Начинай любой добор с резолвера
(dev/INFORMATION-MAP.yaml, секция выше), а не с грепа. Ответ без указателя на SSOT-источник = не ответ.

| Когда понадобится | Открыть |
|---|---|
| Семантика процессов P1-P7, гейты, роутинг линий | docs/pmo/processes.md (~1300 строк — целиком не грузить, искать секцию) |
| Validation-правила артефактов | docs/pmo/validation.md |
| Карта D1-D6 + владельцы шагов | docs/pmo/pmo-map.md · docs/MAP.md |
| Формат конкретного артефакта (24 типа) | docs/pmo/artifacts/<TYPE>.md |
| Контракт конкретной команды | commands/<module>/<name>.md (например commands/orchestrator/run.md — P6/P7/deploy вердикты) |
| Модульные контракты | docs/<module>-module/SPEC.md · docs/product-module/handoff-spec.md |
| Autonomy floor / уровни автономии | dev/AUTONOMY_POLICY_F1_CONTRACT.md |
| Process Fabric (state/events/owner-queue) | dev/process-fabric/CONCEPT.md · docs/guide/07-fabric.md |
| Свежие решения и root causes | хвост DEV_JOURNAL.md (append-only; при конфликте прав он + git log) |
| Первая продуктовая сессия / UI / имплементация | docs/guide/01-first-session.md · 04-ui-design.md · 05-implementation.md |
| Мысленная модель пайплайна D1-D6 (если context-map дайджеста мало) | docs/guide/00-concepts.md |
| Каталог скиллов (64; исполняются продуктовыми сессиями на VM) | docs/guide/08-skills.md |
| Опыт ассист-режима (наш ledger) | dev/global-loop/ASSIST_LOG.md (если уже заведён) |
| Version-skew: как ведёт себя ПРОЕКТ на VM | .claude/ инсталляции проекта по ssh — НЕ host-канон (K0, жёсткое правило) |`;

const SECTIONS = [
  {
    key: 'seam',
    title: 'Рамка трека — живой шов (инварианты, состояние, следующий шаг)',
    build: () => joinFiles([path.join(ROOT, 'dev', 'global-loop', 'SEAM.md')]),
  },
  {
    key: 'plan',
    title: 'Единый план Global Loop (волны, зависимости, где живёт работа)',
    build: () => joinFiles([path.join(ROOT, 'dev', 'global-loop', 'PLAN.md')]),
  },
  {
    key: 'conductor',
    title: 'Кондуктор — SSOT цельной картинки (архитектура, инварианты I-1..I-7, мандат, K0)',
    build: () => joinFiles([{
      file: path.join(CONDUCTOR_REPO, 'CONDUCTOR.md'),
      cap: 40000,
      note: 'ожидается локальный клон WebstormProjects/factory-conductor',
    }]),
  },
  {
    key: 'interface',
    title: 'Интерфейс фабрика ↔ пульт (каналы экосистемы) + хартия Host Console',
    build: () => joinFiles([path.join(ROOT, 'dev', 'host-console', 'TRACK.md')]),
  },
  {
    key: 'dod',
    title: 'Release DoD — критерий остановки релизного цикла (рабочий инструмент ассист-режима)',
    build: () => joinFiles([path.join(ROOT, 'dev', 'release-dod', 'TRACK.md')]),
  },
  {
    key: 'resolver',
    title: 'Резолвер знаний L1 — класс вопроса → SSOT → кому верить при конфликте',
    build: () => joinFiles([path.join(ROOT, 'dev', 'INFORMATION-MAP.yaml')]),
  },
  {
    key: 'catalogs',
    title: 'Генерируемые каталоги L2 (не дрейфуют by design): команды · глоссарий (скиллы — в deepdive)',
    build: () => joinFiles([
      path.join(ROOT, 'docs', 'guide', '02-commands.md'),
      path.join(ROOT, 'docs', 'guide', '03-glossary.md'),
    ]),
  },
  {
    key: 'concepts',
    title: 'Гейты и fabric — вердикты и машинная память линий (ядро надзора)',
    build: () => joinFiles([
      path.join(ROOT, 'docs', 'guide', '06-gates.md'),
      path.join(ROOT, 'docs', 'guide', '07-fabric.md'),
    ]),
  },
  {
    key: 'vm',
    title: 'VM-фабрика — доступ и операторские грабли (ghost-протокол, tmux, ssh)',
    build: () => joinFiles([
      {
        file: path.join(memoryDir, 'env_vm_claude_factory.md'),
        cap: 8000,
        note: 'память проекта (host-специфична)',
      },
      {
        file: fs.existsSync(path.join(os.homedir(), '.claude', 'skills', 'vm-factory-ops', 'SKILL.md'))
          ? path.join(os.homedir(), '.claude', 'skills', 'vm-factory-ops', 'SKILL.md')
          : path.join(os.homedir(), '.claude', 'skills', 'vm-factory-ops.md'),
        cap: 10000,
        note: 'глобальный скилл vm-factory-ops',
      },
    ]),
  },
  {
    key: 'deepdive',
    title: 'Дообучение по требованию — указатели L3 (НЕ читать сейчас)',
    build: () => DEEPDIVE,
  },
];

function parseArgs(argv) {
  const args = { budget: DEFAULT_BUDGET_TOKENS, list: false, only: null, skip: [], out: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--list') args.list = true;
    else if (a === '--budget') args.budget = parseInt(argv[++i], 10) || DEFAULT_BUDGET_TOKENS;
    else if (a === '--only') args.only = String(argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--skip') args.skip = String(argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--out') {
      // путь опционален: `--out` без значения → дефолтный temp-файл
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) { args.out = next; i++; }
      else args.out = defaultOutPath();
    }
    else if (a === '--help' || a === '-h') { args.help = true; }
  }
  return args;
}

function defaultOutPath() {
  return path.join(os.tmpdir(), 'claude-host-onboard-pack.md');
}

/**
 * Сборка пака. opts: { only?: string[], skip?: string[], budget?: number }.
 * Возвращает { header, summary, built[], total, overBudget, text }.
 */
function buildPack(opts = {}) {
  const only = opts.only || null;
  const skip = opts.skip || [];
  const budget = opts.budget || DEFAULT_BUDGET_TOKENS;

  const picked = SECTIONS.filter((s) =>
    (only ? only.includes(s.key) : true) && !skip.includes(s.key)
  );

  const built = picked.map((s) => {
    const body = s.build();
    return { key: s.key, title: s.title, body, tokens: estTokens(body) };
  });
  const total = built.reduce((a, b) => a + b.tokens, 0);

  const summary = [
    '| # | секция | ~токены |',
    '|---|---|---|',
    ...built.map((b, i) => `| ${i + 1} | \`${b.key}\` — ${b.title} | ~${b.tokens} |`),
    `| | **итого (оценка)** | **~${total}** |`,
  ].join('\n');

  const overBudget = total > budget;

  const header = `# ОНБОРДИНГ-ПАК ХОСТ-СЕССИИ (кондуктор / ассист-пульт — Волна 0)

Сборка: ${new Date().toISOString()} · из живых файлов (ничего не хранится) · скрипт: dev/meta-improvement/scripts/host-onboard.cjs (DEC-DEV-0222)

Ты — хост-сессия, выбранная для управления продуктовой работой на VM (режим ассист-пульта,
Волна 0 плана dev/global-loop/PLAN.md). Этот пак — разовый прогрев: ступени L0-L2 лестницы
знаний K0 загружены ниже, ступень L3 — только указателями (секция deepdive). Три закона поверх:
1. **Ответ/решение без указателя на SSOT-источник = не ответ** (K0; не отвечай «по памяти»).
2. **Version-skew:** про поведение проекта на VM — добор из ЕГО \`.claude/\`; про канон — из host-клона ecosystem.
3. **Пак может отставать от репо в момент долгой сессии** — статус и историю перед решением верифицируй git log + хвост DEV_JOURNAL, не паком.

${overBudget ? `🛑 БЮДЖЕТ ПРЕВЫШЕН: ~${total} > ${budget} токенов — урежь через --skip (кандидаты: vm, concepts, catalogs) или --budget.\n\n` : ''}${summary}
`;

  const text = [header, ...built.map((b, i) => `\n\n# ═══ ${i + 1}/${built.length} · ${b.key} — ${b.title} ═══\n\n${b.body}`)].join('');
  return { header, summary, built, total, overBudget, text };
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log('Использование: node host-onboard.cjs [--list] [--only k1,k2] [--skip k1,k2] [--budget N] [--out [файл]]');
    console.log('Секции: ' + SECTIONS.map((s) => s.key).join(', '));
    return;
  }

  const pack = buildPack(args);

  if (args.list) {
    console.log(pack.header);
    return;
  }

  if (args.out) {
    // режим для хука/слэш-команды: пак — в файл (вывод хука ограничен ~10k символов,
    // Bash-тул режет ~30k — полный пак доносится до контекста только через Read файла)
    fs.writeFileSync(args.out, pack.text, 'utf8');
    const lines = pack.text.split('\n').length;
    console.log(`ОНБОРДИНГ-ПАК ЗАПИСАН: ${args.out}`);
    console.log(`~${pack.total} токенов · ${lines} строк${pack.overBudget ? ' · 🛑 БЮДЖЕТ ПРЕВЫШЕН' : ''}`);
    console.log(`→ Прочитай файл инструментом Read ЦЕЛИКОМ${lines > 2000 ? ' (строк >2000 — дочитай offset-вызовами)' : ' (один вызов Read)'}.`);
    console.log('');
    console.log(pack.summary);
    return;
  }

  console.log(pack.text);
}

if (require.main === module) main();
module.exports = { buildPack, SECTIONS, defaultOutPath };
