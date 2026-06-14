# Orchestrator Module

> **Роль:** «Тимлид PMO» — runtime-владелец зон D2-Technical + D3 и выше. Берёт PMO-процесс
> и проводит его end-to-end, оркеструя role-агентов и инструменты по регламентам.
> **Спецификация:** [`docs/orchestrator-module/SPEC.md`](../docs/orchestrator-module/SPEC.md).
> **Эмпирика:** [`dev/ORCHESTRATOR_DOGFOOD_RUN_01.md`](../dev/ORCHESTRATOR_DOGFOOD_RUN_01.md) (RUN 01 harvest).
> **Статус:** первый инкремент — **P3 `batch-features-to-cc-sdd`** (S5a, DEC-DEV-0071).
> P5 `feature-to-tdd-impl` — S5b (next).

## Принцип: оркеструем, не переписываем (DEC-DEV-0071)

Оркестратор **не дублирует** машинерию инструментов, которые завёл Интегратор. cc-sdd
уже умеет генерить спеки волнами с cross-spec review (`kiro-spec-batch`), вести steering
(`kiro-steering`), делать adversarial-review реализации (`kiro-review`). Оркестратор это
**вызывает** и добавляет лишь то, чего у инструмента нет:

1. **Мост из Product-домена** — `handoff → brief.md + roadmap.md`. Это программная замена
   `kiro-discovery` (тот `disable-model-invocation` + интерактивный → недоступен из
   Workflow). cc-sdd ничего не знает про handoff'ы Product-модуля.
2. **Детерминированные гейты, которых нет у инструмента** — content-fidelity preflight
   (адаптерный C-07) и независимый **coverage-oracle** (код по ground-truth, не self-report).
3. **Durable-скелет** — in-harness Workflow, чьи границы фаз переживают `/compact`
   (сильнейший структурный аргумент за модуль, P0-3 RUN 01).

Layer-1 (скелет процесса) и Layer-3 (гейты) — наши и детерминированы. Layer-2 (суждение:
авторинг спеков, cross-spec review) — делегирован cc-sdd.

## Структура

```
orchestrator/
├── README.md                       # этот файл
├── processes/                      # Workflow-скелеты (.mjs, in-harness)
│   └── batch-features-to-cc-sdd.mjs   # P3
└── lib/                            # детерминированные хелперы (.cjs, Node stdlib)
    └── coverage-oracle.cjs            # P1-1 независимый ID-coverage оракул

skills/orchestrator/                # регламент-методология (lazy-loaded)
├── orchestrator-init.md            # P1 — сбор контекста + resume после /compact
├── build-steering.md               # делегирует kiro-steering
├── build-briefs-from-handoff.md    # мост handoff→brief.md/roadmap (замена kiro-discovery)
└── coverage-oracle.md              # как использовать детерминированный оракул-гейт

commands/orchestrator/
└── run.md                          # /orchestrator:run <process> [--feature FM-NNN]

agents/orchestrator/                # пусто для P3 — роли делегированы cc-sdd kiro-skills
                                    # (kiro-spec-batch сам диспатчит per-feature субагентов);
                                    # P5/S5b может добавить tdd-роли (или лифтить kiro-impl/kiro-review)
```

Эти артефакты бутстрапятся в `.claude/` пользователя как и прочие модули. Per-project
state Оркестратора (run-журналы, ledger, реестры) — `.claude/orchestrator/` в проекте.

## P3 `batch-features-to-cc-sdd` — поток

```
Init      orchestrator-init: cc-sdd/kiro-spec-batch заведён? зоны покрыты? env-probe   [наш]
Steering  делегирует kiro-steering; пинит стек в tech.md                                [delegate]
Bridge    на каждый handoff: preflight C-07 (адаптер) → brief.md + roadmap-строка       [наш мост+гейт]
Author    вызывает kiro-spec-batch (волны + dispatch + 10-точечный cross-spec + fix)    [cc-sdd движок]
Coverage  на каждую фичу: coverage-oracle (детерминир., независимо от self-report)       [наш гейт]
Commit    selective commit .kiro/specs + steering                                       [наш]
```

cc-sdd's `kiro-spec-batch` Step 4 (10-точечный cross-spec consistency review + 3-раундовый
fix-loop) — **наш cross-spec слой не нужен**, он покрыт инструментом. coverage-oracle —
детерминированное **дополнение** к этому LLM-ревью, не дубль.

## Sync-обязательства

- **`lib/coverage-oracle.cjs` monotonic section-guard зеркалит** `adapters/handoff-to-ccsdd.js`
  `extractSections` (DEC-DEV-0068). Намеренно продублированы, чтобы развязать runtime install-пути
  (tri-location урок DEC-DEV-0040). Меняешь guard в адаптере — отрази здесь. Оба покрыты тестами.
- **Harness fs-constraint (DEC-DEV-0068 §D.1):** Workflow-скрипты не имеют доступа к FS/Node API
  и `Date.now()`/`Math.random()`. Поэтому каждое чтение файла / запуск адаптера-оракула / вызов
  kiro-skill / git-commit — **внутри `agent()`**, не в теле скрипта. Входы — через `args`.

## Smoke

```bash
npm run test:orchestrator     # coverage-oracle contract test (fixtures)
npm run smoke:orchestrator    # Workflow .mjs парсится в харнесс-диалекте
npm run verify                # всё вместе (+ hooks + adapters)
```

`node --check` к `.mjs` **неприменим**: харнесс-диалект (`export const meta` + top-level
`await`/`return`) — не чистый ESM. Валидатор — `smoke:orchestrator` (см. его шапку).

**Live cc-sdd прогон** (handoff → реальные `.kiro/specs/*`) требует пилота с заведённым cc-sdd
и проверяет открытый вопрос: вызывается ли `kiro-spec-batch` (он сам спавнит субагентов) из
Workflow-`agent()` — у `.mjs` Author-фаза есть fallback (прогнать kiro-spec-* пофично самому).
Это отдельный осознанный заход (S6 / прогон №2), пилот в S5a не трогаем.
