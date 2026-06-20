# CLAUDE.md — Ecosystem 3.0 Repository

> **Что это:** контекст для Claude (или любого AI-ассистента), работающего над **самой Ecosystem 3.0** — meta-tooling для управления продуктовыми проектами через Claude Code.
>
> **НЕ путать с** `templates/project/CLAUDE.md.template` — тот шаблон для пользовательских проектов, которые поведутся **через** Ecosystem 3.0.
>
> **Этот файл — для разработчиков самой экосистемы.**

---

## Что строим

Ecosystem 3.0 — PMO-слой над Claude Code:
- **Детальный контроль** D1 (Discovery) и D2-Behavioral (поведенческая спецификация)
- **Tool-agnostic делегирование** D2-Technical и D3-D6 во внешние инструменты через универсальный `handoff.md`
- **4 модуля:** Product, Design (conditional), Integrator, Orchestrator (планируется)

Подробнее: [README.md](README.md), [ROADMAP.md](ROADMAP.md).

## Где мы сейчас

**Единственный источник статуса** — [ROADMAP.md «Где мы сейчас»](ROADMAP.md#где-мы-сейчас) (verify против `git log`). Снапшот здесь намеренно **не дублируется**: pointer-collapse против triple-declaration drift (Tier-1 doc reform; ранее README/CLAUDE/ROADMAP держали три расходящиеся копии).

`last memory-sync: 2026-06-18` — дата последней синхронизации этого файла со снапшотом ROADMAP; зеркалит строку «Последнее обновление» в [ROADMAP.md](ROADMAP.md). Если расходится с `git log` — снапшот устарел, доверяй ROADMAP + git, затем обнови эту дату.

**Перед стартом следующей phase** — пройди D7 [dev/meta-improvement/checklists/phase-kickoff.md](dev/meta-improvement/checklists/phase-kickoff.md) + соответствующий readiness:
- `dev/gates/PATCH_1.3.3_SMOKE_TEST_PLAN.md` — runtime smoke S1-S5 (next pilot session)
- `dev/deferred/PHASE_D_DOCS_WIKI_READINESS.md` — DEFERRED; resumption при bring-forward trigger
- `dev/gates/PHASE_6_SMOKE_TEST_PLAN.md` — runtime smoke S1-S7 (next pilot session); `dev/_archive/phase-6/PHASE_6_READINESS.md` archived
- `dev/gates/PHASE_7_READINESS.md` — skeleton; Integrator maintenance + verify/debug/docs scope
- `dev/gates/S_LE_LESSON_GATE_SMOKE.md` — LESSON-* gate runtime contracts (S-LE); hard-prereq перед переводом `lesson-presence-gate.js` PreToolUse warn→strict (next pilot session, DEC-DEV-0062)
- `dev/deferred/D7_DEADWEIGHT_CLEANUP.md` — 🅀 QUEUED maintenance work-order: прунинг D7 до работающего+используемого. Sequencing-триггер: D7 process-hardening (DEC-DEV-0083) смёржен в `main`

## Process triggers — harness contract (D7)

> **Auto-loaded операционный индекс: ситуация → что я (harness) обязан сделать.** Это
> SSOT-указатель; детали ритуалов — в `dev/meta-improvement/checklists/*`. Строки 🔒
> **принуждаются** блокирующим `commit-msg` gate (`process-gate.js`, DEC-DEV-0083) — обойти
> можно только осознанно через `[skip-process-gate]` в сообщении коммита. Установить gate:
> `bash dev/meta-improvement/scripts/install-pre-commit.sh`.

| Когда я делаю это… | …обязан (в том же / связанном коммите) | Деталь |
|---|---|---|
| `fix:` (багфикс) | 🔒 DEV_JOURNAL (root cause + lesson) + 🔒 CHANGELOG `[Unreleased]` если тронут consumer-zone | §1; CONVENTIONS §11.1 |
| `feat:` в consumer-zone (`commands/skills/agents/hooks/docs/templates/adapters/orchestrator` + root README/ROADMAP/install) | 🔒 CHANGELOG `[Unreleased] ### Added` + DEV_JOURNAL если был tradeoff ≥2 вариантов | accumulation contract |
| spec / scope-change | DEV_JOURNAL (rationale + impact) + CHANGELOG если влияет на consumers | §1 триггеры |
| добавил/убрал артефакт-тип или validation-правило | 🔒 count-sweep всех ~10 count-доков (`node dev/meta-improvement/scripts/check-counts.js` зелёный) | [[reference_pmo_canonical_counts]] |
| добавил/убрал команду / скилл / хук | обновить `commands/ecosystem/verify.md` (Step 4 + summary) + проверить обзорные шаблоны (`status.md`, `docs/MAP.md`) | cross-component awareness, DEC-DEV-0082 |
| архитектурный выбор из ≥2 вариантов | DEV_JOURNAL: что выбрал + почему отверг остальные | §1 |
| собрался резать версию / доставлять в пилот | `checklists/patch-cut.md` | каденс — по событию |
| собрался прогнать live-доработку в пилоте (dogfood-валидация) | `checklists/live-run-validation.md` | executor/reviewer separation; класс A (спонтанность) / B (механика) |
| перед фазой / после фазы | `checklists/phase-kickoff.md` / `phase-closure.md` | per-phase |
| рефактор с риском stale-ссылок | `patterns/spec-drift-sweep.md` (grep после) | — |

🔒 = hard-enforced. Остальное — дисциплина (+ warn-only PostToolUse напоминалки `dev-journal-reminder.js` / `phase-closure-reminder.js`).

## Принципы работы над экосистемой

### 1. DEV_JOURNAL обязателен для значимых решений

Все архитектурные решения, root causes багов, изменения scope phase — записываются в [DEV_JOURNAL.md](DEV_JOURNAL.md) с rationale и lessons. **Это не CHANGELOG** (тот для consumers). Это память будущего разработчика.

**Триггеры для записи:**
- Выбрали один из ≥2 вариантов архитектуры — запиши почему отвергли остальные
- Что-то сломалось → нашли root cause → запиши, чтобы не повторить
- Решили cut/skip часть фазы — запиши, что и почему отложено
- Spec оказался неверным на практике — запиши adjustment с обоснованием

**НЕ триггеры:** typo fixes, dependency bumps, рутинные правки документации.

### 2. Incremental pilot, не waterfall

ROADMAP помещает PILOT POINT после Phase 5 (~13-20 часов работы). **Это слишком поздно.** Smoke-test после каждой Phase, не только после полной цепочки.

После Phase N:
1. Запустить минимальный end-to-end test того, что Phase N добавила (например, после Phase 2 — `/product:init "test idea"` в test-папке)
2. Записать findings в DEV_JOURNAL
3. Решить: продолжать с Phase N+1 как запланировано, или пересмотреть приоритеты на основе pilot

### 3. Meta-проект — высокий risk самореферентного коллапса

Ecosystem 3.0 — система для управления продуктовыми проектами, **которая сама строится без использования собственной машинерии**. Это создаёт два класса проблем:
- Spec-first design без validation pилот → Phase N+1 building на ошибочных Phase N assumptions
- Отсутствие dogfood обратной связи от собственного UX

**Mitigation:** после Phase 2 smoke-test обсудить создание `.product/` для самой Ecosystem 3.0 (PS, базовые HYP, MVP scope). Не делать раньше — premature.

### 4. Cuttable scope — default

Перед началом каждой Phase задать вопрос: **«Что можно скип/упростить, чтобы получить feedback быстрее?»** Каждое spec-указание проходит этот фильтр.

Пример: Phase 3 ROADMAP включает Deep mode subagents (`market-researcher.md`, `competitor-analyst.md`). Если Quick mode из Phase 2 ещё не валидирован — Deep mode преждевременный. Откладывается.

### 5. ROADMAP — гипотеза, не contract

Оценки в часах оптимистичны. Реальность будет иной. После каждой Phase — review приоритетов (что valid, что отложить, что добавить).

### 6. Backwards compatibility — узко, не «не важна» (ревизия DEC-DEV-0083)

До 1.0 **ломать API / формы артефактов можно свободно** — внешних потребителей контракта нет. НО премиса «пользователей нет, ломай всё» больше **не** держится буквально: есть живой пилот (`my-first-test`), чьё локальное состояние обязано переживать `/ecosystem:update`. Поэтому:

- **Состояние пилота не вайпим.** Wipe-protection (`update.md` level-1/level-2), namespace-preserve третьих сторон и Orchestrator project-state — контракт, не опция.
- **Предпочитать soft-миграции:** новое поле опционально (absent == старое поведение 1:1), backfill — отдельным migration-промптом в CHANGELOG-записи (прецедент: `product_class`, DEC-DEV-0079).
- **Hard-required-field миграции** без enforcement-механизма — всё ещё post-pilot (migration runner не построен; `bootstrap.md` обещает будущий `/ecosystem:upgrade`).

Т.е. ломаем **формы** свободно, бережём **доставку и состояние пилота**. (Дрейф «не важна» ↔ практика вскрыт D7-аудитом 2026-06-19.)

## Repository structure (для AI)

```
claude-ecosystem-3.0/
├── README.md, BOOTSTRAP.md, INSTALL-HUMAN.md, CHANGELOG.md, ROADMAP.md
├── DEV_JOURNAL.md           # этот журнал (создан 2026-04-19)
├── CLAUDE.md                # этот файл — context для AI
├── dev/                                  # docs про разработку самой экосистемы
│   ├── meta-improvement/                 # D7 module (SPEC + checklists + CONVENTIONS)
│   ├── PHASE_<N>_READINESS.md            # readiness gate per phase
│   ├── PHASE_<N>_SMOKE_TEST_PLAN.md      # smoke test plan (active until run)
│   ├── v1_1_backlog.md                   # preserved deferred context
│   └── _archive/                         # archived past-phase docs
├── install.sh, install.ps1  # global installers
├── .env.template, settings.json.template, gitignore.template
├── docs/
│   ├── product-module/SPEC.md, handoff-spec.md
│   ├── design-module/SPEC.md
│   ├── integrator-module/SPEC.md
│   └── pmo/
│       ├── pmo-map.md, processes.md, validation.md
│       └── artifacts/        # 24 типа артефактов
├── commands/                 # → пользовательский .claude/commands/
│   ├── ecosystem/, integrator/, product/  # design/ — Phase 6
├── skills/                   # → .claude/skills/ (lazy-loaded methodology)
├── agents/                   # → .claude/agents/ (subagents с isolated context)
├── hooks/                    # → .claude/hooks/ (с manifest.yaml для auto-registration)
├── adapters/                 # reference-адаптеры handoff → external tool (Phase 5+)
│   └── handoff-to-ccsdd.js   # source-of-truth; instance копируется в .claude/integrator/adapters/ при /integrator:add
└── templates/
    └── project/CLAUDE.md.template  # для END-USER projects, НЕ путать с этим файлом
```

## Конвенции репозитория

### Коммиты

- Conventional commits: `feat(scope):`, `fix(scope):`, `docs(scope):`, `refactor(scope):`
- Scope обычно: `bootstrap`, `product`, `integrator`, `design`, `gitignore`, `roadmap`
- В commit message — что изменилось. **Rationale — в DEV_JOURNAL**, не в commit.

### Обновление CHANGELOG vs DEV_JOURNAL

| Что произошло | CHANGELOG | DEV_JOURNAL |
|---|---|---|
| Новая фича (`feat:`) | ✓ под `### Added` | Только если был tradeoff между альтернативами |
| Bug fix (`fix:`) | ✓ под `### Fixed` | ✓ всегда — root cause + lesson |
| Spec change | ✓ под `### Modified` | ✓ всегда — rationale + impact |
| Phase scope cut | ✓ под `### Modified` если влияет на consumers | ✓ всегда |
| Refactor (`refactor:`) | Только если меняет behavior | ✓ если non-trivial |
| Doc fix (`docs:`) | Нет | Нет |

### Файловая иерархия

- **commands/, skills/, agents/, hooks/** — артефакты, которые **попадают в `.claude/` пользователя** при bootstrap. Должны быть production-ready (никаких WIP).
- **docs/** — SPEC и каталоги. Source of truth для archteture.
- **templates/** — шаблоны, инстанциируемые при bootstrap (substitute placeholders).
- **dev/** — внутренние документы про разработку **самой экосистемы**. Не попадают в пользовательские проекты.

### Hook конвенции

Hooks живут в `hooks/<module>/<file>.js` + `hooks/<module>/manifest.yaml`. Manifest schema задокументирована в [hooks/product/manifest.yaml](hooks/product/manifest.yaml).

При добавлении нового hook:
1. Drop `.js` файл в `hooks/<module>/`
2. Добавить entry в `manifest.yaml`
3. `/ecosystem:bootstrap` (идемпотентно) подхватит автоматически

### Skill конвенции

Skills — это `.md` файлы в `skills/<module>/<name>.md` с frontmatter:
```yaml
---
description: <one-line, для discovery>
---
```

Lazy-loaded — Product Module load'ит per задаче (~3-5 одновременно).

**Convention для skills, создающих артефакты** (codified DEC-DEV-0012, 2026-04-20):

Каждый skill, создающий артефакт типа из каталога `docs/pmo/artifacts/`, **обязан содержать explicit frontmatter template** в теле skill (не только reference на artifact spec). Template должен:

1. **Перечислить все canonical fields** с правильными именами (per artifact spec)
2. **Включить anti-pattern warnings** — список запрещённых рядом-стоящих field names, которые AI склонен использовать «для естественности»
3. **Использовать ASCII slug** в naming convention для filename (per `docs/pmo/artifacts/README.md` slug rule)

**Reference implementation:**
- [`skills/product/problem-discovery.md`](skills/product/problem-discovery.md) Step 3 (после DEC-DEV-0011 fix) — explicit PS frontmatter template + anti-pattern list (`confidence_rationale`, `rationale`, `confidence_reasoning` явно запрещены)
- [`skills/product/note-promote.md`](skills/product/note-promote.md) Step 3 — explicit templates per target type (FM, SC, BR, IC, NFR, HYP) с anti-pattern warnings

**Rationale:** Phase 2 PS drift (DEC-DEV-0011) показал: skills без explicit template подвержены AI-склонности «переименовать field для естественности». Inline templates + warnings — лучшая defensive programming в skill prompts.

**При написании Phase 3 skill checklist:**
- [ ] Frontmatter template присутствует
- [ ] Все canonical fields перечислены
- [ ] Anti-pattern warnings explicit
- [ ] Filename slug rule referenced
- [ ] DEV_JOURNAL entry если non-trivial design choice

## Что делать в этой сессии (Claude)

При запуске сессии в этом репо:
0. **Сориентируйся по карте** — [docs/MAP.md](docs/MAP.md) (визуальный entry-point: pipeline D1-D6 + C4 container)
1. **Прочитай этот файл** (CLAUDE.md — auto-loaded)
2. **Загляни в [DEV_JOURNAL.md](DEV_JOURNAL.md)** — последние 3-5 entries, чтобы знать недавний контекст decisions
3. **Проверь [ROADMAP.md](ROADMAP.md) секцию "Где мы сейчас"** — может быть устарела относительно git log
4. **D7 ritual** (см. [`dev/meta-improvement/`](dev/meta-improvement/)):
   - Перед phase: [`checklists/phase-kickoff.md`](dev/meta-improvement/checklists/phase-kickoff.md) + `dev/PHASE_<N>_READINESS.md`
   - После phase: [`checklists/phase-closure.md`](dev/meta-improvement/checklists/phase-closure.md)
   - Перед доставкой в пилот / релизом: [`checklists/patch-cut.md`](dev/meta-improvement/checklists/patch-cut.md) — нарезка версии из CHANGELOG `[Unreleased]` (контракт накопления + cut — CONVENTIONS §11)
   - При architectural decisions: [`patterns/`](dev/meta-improvement/patterns/) (5 patterns)
   - При memory drift: [`skills/memory-sync.md`](dev/meta-improvement/skills/memory-sync.md)
   - Verify update outcome: [`scripts/verify-update.sh`](dev/meta-improvement/scripts/verify-update.sh)
   - Hook reminder зарегистрирован (`.claude/settings.local.json` PostToolUse Bash) — fires на phase-completion commits
5. Перед commit-ом значимых изменений — спроси «нужна ли DEV_JOURNAL запись?»

## Memory

У меня (Claude) есть persistent memory для этого проекта в `~/.claude/projects/C--Users-pw201-WebstormProjects-claude-ecosystem-3-0/memory/`. Содержит:
- User profile (solo dev, methodology-conscious, RU)
- Project status snapshot
- Architecture summary
- Methodology agreements (DEV journal, dogfooding, incremental pilot)
- DEV journal reference

Memory может устаревать. Всегда верифицируй по git log / DEV_JOURNAL / CHANGELOG перед actионом.
