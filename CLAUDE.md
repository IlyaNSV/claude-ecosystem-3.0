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

См. [ROADMAP.md](ROADMAP.md) секцию «Где мы сейчас» — single source of truth. Snapshot на момент последнего update этого файла (2026-05-27 — patch 1.3.5 shipped, DEC-DEV-0051):
- ✅ Phase 0-2 (scaffolding, Integrator read-only, Bootstrap, Product Module Discovery + drift mechanisms)
- ✅ Phase 3 (Planning + Feature Enrichment + adaptive-depth DA + cascade detection) — smoke-tested DEC-DEV-0023 + 1.1.1 patch shipped
- ✅ Phase 4 (Handoff + NFR + Product DA + Validation full + Cleanup + Language discipline) — 1.2.0; closure ritual Unit 2 DEC-DEV-0033; runtime smoke 2026-05-20 → status=fail → Phase 4 closed (DEC-DEV-0038)
- ✅ Phase 5 kickoff (DEC-DEV-0040, 2026-05-25) — Q1-Q6 + functional PMO refactor (D2-B01..05 / D2-T01..08 / D3-01..07 / D4-01..07)
- ✅ Phase 5 implementation done (DEC-DEV-0041, 2026-05-25) — 1.3.0; 10 sub-phase commits A→J; 3 commands + 4 skills + 2 subagents + 1 hook + 1 reference adapter (Q1 dual→tri-location pattern) + fixture
- ✅ Phase 5 runtime smoke + closure (DEC-DEV-0044, 2026-05-26) — 4 PASS clean (S1/S2/S4 + S3 post-fix), S6 PARTIAL→FIXED, S5 deferred. 3 bugs fixed end-to-end. Plan archived `dev/_archive/phase-5/`
- ✅ Phase 5.1 patch (DEC-DEV-0045, 2026-05-26) — bug 4 fix (3 facets) + C-03 generator regex. Local-only drift detection model. 1.3.2 released. S5 runtime verification deferred
- ⏸ Phase D — Wiki initiative DEFERRED to v1.1+ (DEC-DEV-0046, 2026-05-27) — phantom-audience guard. Design+plan+readiness preserved with DEFERRED banners. Bring-forward triggers в `dev/v1_1_backlog.md`
- ✅ **Patch 1.3.3 (DEC-DEV-0047, 2026-05-27)** — Integrator scope discipline + env tiers + PA journal + research hard approve gate. Pilot session 2026-05-27 evidence (4 patterns). 4 deliverables shipped: B-1 `environment_tiers` (SPEC §4.2.1); B-2 `hooks/integrator/scope-guard.js` PreToolUse warn-only (marker-gated, 1h stale TTL, forbidden paths .product/ .kiro/ docs/pmo/ + exceptions, Bash regex sniffer); B-3 `.claude/pending-actions.md` ecosystem-wide journal + `/ecosystem:pending-actions` + `skills/ecosystem/user-action-tracker.md`; B-4 `/integrator:research` Step 7 hard gate + SPEC §7.6 consilium-pattern. Static smoke 13/13 PASS. Runtime smoke S1-S5 deferred к next pilot session. Hard-block mode deferred v1.4.0+. 1.3.3 released, local docs polish bundled
- ✅ Local docs polish (DEC-DEV-0046) — Obsidian vault baseline + README cross-link polish shipped (bundled в 1.3.3)
- ✅ **Patch 1.3.4 (DEC-DEV-0049, 2026-05-27)** — `/ecosystem:update` Step 6 REPLACE → pattern-preserving merge. Third-party hook injections (e.g. `bd setup claude` SessionStart/PreCompact) больше не wipe'ятся при ecosystem upgrade. Driven by downstream `my-first-test` DEC-INT-0005 pilot evidence. Spec-only change (commands/ecosystem/update.md); bootstrap Step 6b уже корректен — symmetry restored. Smoke verification deferred к next pilot `/ecosystem:update`
- ✅ **Patch 1.3.5 (DEC-DEV-0051, 2026-05-27)** — `/ecosystem:update` Step 5 nuclear sync → namespace-aware sync + Step 2 backup extended до integrator-managed external paths. Same class of bug as 1.3.4 (ecosystem zone shared с third-party tools): cc-sdd kiro-* skills больше не уничтожаются при update; `.kiro/`, `.beads/` etc. backed up под `_external/` для rollback. Surfaced during static dry-run 1.3.4 spec на real downstream state. Spec-only change (Step 2/4/5/8 + Rollback)

**Перед стартом следующей phase** — пройди D7 [dev/meta-improvement/checklists/phase-kickoff.md](dev/meta-improvement/checklists/phase-kickoff.md) + соответствующий readiness:
- `dev/PATCH_1.3.3_SMOKE_TEST_PLAN.md` — runtime smoke S1-S5 (next pilot session)
- `dev/PHASE_D_DOCS_WIKI_READINESS.md` — DEFERRED; resumption при bring-forward trigger
- `dev/PHASE_6_READINESS.md` skeleton — Design Module conditional (после first UI feature)

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

### 6. Backwards compatibility пока не важна

Solo developer, нет внешних пользователей до PILOT POINT. Брейк всё что нужно. Migration scripts, deprecation policies, version compat — для post-pilot.

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
│       └── artifacts/        # 22 типа артефактов
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
1. **Прочитай этот файл** (CLAUDE.md — auto-loaded)
2. **Загляни в [DEV_JOURNAL.md](DEV_JOURNAL.md)** — последние 3-5 entries, чтобы знать недавний контекст decisions
3. **Проверь [ROADMAP.md](ROADMAP.md) секцию "Где мы сейчас"** — может быть устарела относительно git log
4. **D7 ritual** (см. [`dev/meta-improvement/`](dev/meta-improvement/)):
   - Перед phase: [`checklists/phase-kickoff.md`](dev/meta-improvement/checklists/phase-kickoff.md) + `dev/PHASE_<N>_READINESS.md`
   - После phase: [`checklists/phase-closure.md`](dev/meta-improvement/checklists/phase-closure.md)
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
