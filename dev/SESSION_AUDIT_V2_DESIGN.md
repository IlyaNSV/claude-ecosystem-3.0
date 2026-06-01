# Session Audit v2 — Design Doc

> **Status:** DESIGN DRAFT (не реализовано) · **Created:** 2026-05-31 · **Decision ref:** [DEC-DEV-0056](../DEV_JOURNAL.md)
> **Scope сейчас:** Инкремент 1 — **универсальный аудит** (классификатор сессий + реестр рубрик) поверх существующего `--no-plan`.
> **Целевой триггер:** полу-авто (`/loop` / `CronCreate`), территория Инкремента 2.
> **Принадлежность:** D7 meta-improvement. Артефакт dev-only, НЕ деплоится в пользовательские проекты (CONVENTIONS §2/§9).

---

## 0. Зачем

Текущий `audit-smoke` ориентирован на **проверку конкретной фазы реализации экосистемы** (`--phase=N` → smoke-план → coverage сценариев). Потребность: превратить его в **замкнутый автоматический механизм**, который:

1. при появлении транскрипта новой сессии запускается сам (полу-авто);
2. **сам определяет специфику сессии** (напр. «первая сессия после поставки модуля Design» vs «обычная сессия баг-фикса»);
3. по специфике понимает, **с чем и по каким критериям** сопоставлять проделанное и **как это повлияло на продуктовый проект**;
4. фиксирует «что корректно / что нет / что можно улучшить» в **журнале аудита сессий**;
5. из накопленных записей журнала позже **синтезирует патчи-улучшения** для самой экосистемы.

Этот документ — инженерный дизайн под эту потребность, разбитый на инкременты. Активная работа сейчас — Инкремент 1.

---

## 1. Точка отсчёта (что уже построено — проверено по коду)

Движок **не монолит под фазу**, в нём уже есть зачатки универсальности:

- **Capture/audit развязаны** (DEC-DEV-0034). SessionEnd-хук [`hooks/session-audit.js`](meta-improvement/hooks/session-audit.js) пишет дешёвый идемпотентный маркер в [`audit-index.md`](meta-improvement/audit-index.md) Pending; тяжёлый `claude -p`-аудит — отдельно. Прототип со spawn `claude -p` прямо из хука **осознанно отвергнут**. → фундамент сохраняем.
- **Универсальный режим уже есть.** Флаг `--no-plan` ([`scripts/audit-smoke.js`](meta-improvement/scripts/audit-smoke.js):69,539) запускает аудитора без фазы в режиме `catalog-only`. Промпт [`prompts/session-audit.md`](meta-improvement/prompts/session-audit.md) Step 0 уже выбирает режим Full/Catalog-only.
- **Универсальная база сравнения подключена.** Аудитор (Step 3, `check_id` A–G) проверяет процесс-каталог независимо от фазы: A=frontmatter B.1, B=P-RULE-01 (IC→DA), C=P-RULE-02 (BR→DA), D=V-11 bi-dir, E=Discovery sequence, F=skill discipline, G=phase-boundary hygiene. Читает `docs/pmo/processes.md`, `validation.md`, `artifacts/<TYPE>.md`, `CLAUDE.md` — то есть **полный каталог корректности**, не привязанный к фазе.
- **Детерминированное ядро + LLM-нарратив.** `computeAggregate()` (строки 413–499) считает покрытие/находки кодом; LLM пишет только прозу. Образец для классификатора.
- **Salvage-устойчивость** (707–739): отчёт — источник истины, таймаут `claude -p` не роняет результат.
- **Structured findings.** Per-session frontmatter уже machine-parseable: `check_id / severity / confidence / artifact / snippet` (Step 4 промпта).

**Вывод:** переписывать с нуля не нужно. Нужно «вывернуть» выбор рубрики: сделать его **результатом классификации сессии**, а не аргументом `--phase`.

---

## 2. Gap-анализ (желаемое → текущее)

| # | Что нужно | Что есть | Зазор | Инкремент |
|---|---|---|---|---|
| G1 | Автозапуск при появлении транскрипта | Ручной `/meta:audit-smoke` | Нет триггера | 2 |
| G2 | Самоопределение специфики сессии | Человек передаёт `--phase=N` | **Нет классификатора** | **1** |
| G3 | По специфике выбрать «с чем / по каким критериям» | Бинарно: smoke-plan vs catalog-only | **Нет реестра рубрик** | **1** |
| G4 | Оценка «как повлияло на продуктовый проект» | Только coverage + catalog | Нет dimension «эффект на `.product/`» | 2 |
| G5 | Журнал: корректно/некорректно/улучшить | Плоская Processed-таблица + эфемерные per-phase summary | Нет накопительного findings-журнала | 3 |
| G6 | Из журнала синтезировать патчи | Всё вручную через DEC-DEV | Нет синтезатора | 3 |

---

## 3. Целевая архитектура (замкнутый цикл)

```
[Сессия в продуктовом проекте завершается]
   │  SessionEnd hook (capture, идемпотентно)          ← ОСТАВЛЯЕМ
   ▼
[audit-index Pending]  (обогатить: cwd, git HEAD, branch)   ← мелкая правка [Инкр.2]
   │  ТРИГГЕР: полу-авто /loop · CronCreate · ручной /meta:audit   ← [Инкр.2]
   ▼
[Драйвер audit v2]
   1. Детерминир. пре-пасс (JS): профиль сессии — commits, slash-cmds, тронутые пути, git-diff .product/
   2. Классификатор → session-class                    ← [Инкр.1]  G2
   3. Реестр рубрик → baseline + criteria + effect-focus   ← [Инкр.1]  G3
   4. claude -p аудитор, параметризован РУБРИКОЙ (не --phase)   ← [Инкр.1] эволюция Step 0/2.5/3
        + dimension «эффект на .product/» (effect-probe)   ← [Инкр.2]  G4
   ▼
[Per-session report (richer)]  +  [Накопительный findings-журнал]   ← [Инкр.3]  G5
   │  накопление across сессий и фаз
   ▼
[Синтезатор патчей] — кластеризация recurring findings → patch-кандидаты   ← [Инкр.3]  G6
   │  human gate [Y/N/E/D]   (surface-only, NO auto-fix — CONVENTIONS §8)
   ▼
[DEC-DEV запись + commit/PR]  — применяет человек/ассистент вручную
```

---

## 4. Инкремент 1 (АКТИВНЫЙ): классификатор + реестр рубрик

### 4.1 Двухступенчатая классификация (детерминированно → LLM)

Повторяем паттерн движка (детерминированный счёт + LLM-интерпретация). **Пре-пасс на JS** в драйвере собирает «профиль сессии» из дешёвых сигналов:

- `cwd` / `target_project` (из маркера) — какой проект;
- **git в окне сессии**: `git log` между HEAD начала и конца → scope коммитов (`feat`/`fix`/`refactor`/`docs`/`chore` + `(product|design|integrator|…)`);
- **slash-команды** из транскрипта (`/design:*`, `/product:feature`, `/ecosystem:update`, `/integrator:add`) — сильнейший сигнал намерения (уже извлекается в Step 1);
- **тронутые пути**: `.product/features/` vs `business-rules/` vs `mockups/` vs `dev/meta-improvement/`;
- **временная привязка**: дата сессии vs дата поставки модуля/тега в `CHANGELOG`/`git tag` → детект «первая сессия после поставки модуля X».

Пре-пасс выдаёт `session-profile.json` + кандидат-класс. LLM-аудитор подтверждает/уточняет класс (видит намерение в user-сообщениях, ловит override). Дёшево, воспроизводимо, устойчиво к ошибкам односигнальной эвристики. Класс пишется в отчёт с `confidence` для ревизии.

### 4.2 Таксономия классов и реестр рубрик

Рубрика = тройка **«baseline (с чем сопоставить) + criteria (по каким критериям) + effect-focus (что проверить в продукте)»**. Хранится как **данные** — `dev/meta-improvement/rubrics/*.md` (или `rubrics.yaml`), НЕ хардкод в промпте. Это позволяет добавлять классы без правки кода.

| session-class | Триггер-сигналы | Baseline (с чем сравнить) | Criteria | Effect-on-product focus |
|---|---|---|---|---|
| **module-delivery-shakedown** | первая сессия после поставки модуля/фазы; вызовы новых команд | smoke-план модуля + его SPEC | покрытие сценариев модуля + A–G | новые артефакты валидны, hooks сработали |
| **discovery** (D1) | PS/MR/CA/SEG/VP/HYP, `/product:init`,`plan` | D1-последовательность, гейты G1/G4/G4a/G5 | E (lineage), порядок гейтов, frontmatter | PS→HYP цепочка связна, BG extraction |
| **feature-definition** (P2) | FM/SC/BR/IC/LC, `/product:feature`,`handoff` | F.0–F.10 flow, P-RULE-01/02, handoff DoR | B,C (DA), A, D (bi-dir), DoR-blockers | FM-граф консистентен, handoff не stale |
| **design** | MK/DS/NM, `/design:*` | design SPEC + design smoke | design-validate правила, token coverage | mockups↔FM/SC связаны |
| **integration** | `/integrator:*`, adapters/contracts | integrator SPEC, contract schema | scope-guard границы, journal autolog | active-tools/contracts целостны |
| **bug-fix** | `fix(...)` коммиты, нет новых feature-артефактов | **прежнее валидное состояние** (regression baseline) | не сломаны ли инварианты/валидация; журналирование fix | regression: ранее-валидные артефакты/hooks не «покраснели» |
| **refactor** | `refactor(...)` | behavior-preservation | doc-consistency, нет дрейфа терминов | поведение сохранено |
| **maintenance/docs** | `docs`/`chore` | лёгкая | только convention | минимальный |
| **ecosystem-dev** (meta/D7) | работа в репо самой экосистемы | D7 CONVENTIONS, kickoff/closure | DEC-DEV дисциплина, phase hygiene (G) | n/a (нет `.product/`) |
| **mixed / uncertain** | конфликт сигналов | catalog-only (текущий fallback) | A–G | best-effort |

Это прямой ответ на «сам определяет специфику и понимает как проверять». Ключевой сдвиг промпта: Step 0 вместо таблицы Full/Catalog-only читает **выбранную рубрику** и подставляет её baseline+criteria в Step 2.5/3.

### 4.3 Изменения в коде/промпте (Инкремент 1)

- **Драйвер** `audit-smoke.js`: добавить пре-классификатор (новый модуль `classify.js`), новый режим запуска без `--phase` (поверх `--no-plan`), резолв рубрики из реестра, проброс выбранной рубрики в `runAuditor()` через новые `{{...}}`-плейсхолдеры.
- **Промпт** `session-audit.md`: Step 0 → «прочитай рубрику {{RUBRIC_PATH}} + профиль {{SESSION_PROFILE}}»; Step 2.5/3 параметризуются baseline/criteria рубрики; во frontmatter отчёта добавить `session_class`, `class_confidence`.
- **Реестр** `rubrics/` + `rubrics/README.md` (как выбирается класс, как добавить новый).
- **Имя:** рассмотреть переименование `/meta:audit-smoke` → `/meta:audit` (обобщение), сохранив `audit-smoke` как режим. (Решение отложено — см. §8.)

### 4.4 Smoke (Инкремент 1)

Прогнать v2 на 3–4 уже накопленных Processed-сессиях (`my-first-test`, phase 4/5) с `--force`, сверить присвоенные классы и выбранные рубрики с реальностью; сверить, что вердикты не хуже старых. Зафиксировать в DEV_JOURNAL.

---

## 5. Инкремент 2: триггер (полу-авто) + эффект на продукт

### 5.1 Триггер — решение и обоснование (проверено эмпирически)

Выбран **полу-авто** триггер (`/loop` или `CronCreate`), работающий пока Claude открыт. Сравнение примитивов:

- **routines / `RemoteTrigger`** исполняются **в облаке claude.ai** → **не видят** локальные транскрипты `C:\Users\pw201\.claude\projects\` и локальный git. **Дисквалифицированы** для локального аудита (пока транскрипты не вынесены в облако).
- **`CronCreate` / `/loop` / `Monitor`** — требуют открытой Claude-сессии (CronCreate живёт только в текущей сессии, auto-expire 7 дней; loop крутится пока сессия открыта). → **выбранный полу-авто режим.**
- **Windows Task Scheduler** → `node audit-smoke.js --since=24h` — единственный по-настоящему автономный (когда Claude закрыт). Записан как **upgrade-path** на будущее, не выбран сейчас.

Реализация полу-авто: оставить SessionEnd-хук (capture) + сделать драйвер идемпотентным; запуск через `/loop <interval> node …audit-smoke.js …` либо durable `CronCreate`. Ручной `/meta:audit` остаётся как «прямо сейчас».

> Транскрипты: `C:\Users\pw201\.claude\projects\<slug>\<uuid>.jsonl`; **один проект → много slug-директорий** (worktree / sub-cwd); subagent-транскрипты в подпапке `…\<uuid>\subagents\` — их фильтровать (не аудитить как «сессии»). Маркер обогатить `git HEAD` начала сессии для effect-diff.

### 5.2 Эффект на продуктовый проект (G4) — deterministic effect-probe

Аудитор read-only и не зовёт slash-команды → чистое решение: **детерминированный замер в драйвере до спавна**:

- `git diff .product/` за окно сессии → что создано/изменено/удалено;
- прогон валидатора по **пост-состоянию** (node-обёртка над validation-каталогом, без slash-команд) → какие V-правила «красные», появились ли НОВЫЕ нарушения, которых не было до;
- чтение `.product/.pending/*` + `.product/.decisions/journal.md` → зафиксированы ли решения, остались ли висящие cascade/DA-долги;
- (опц.) drift-сигнал относительно якоря (PS/primary HYP/MVP) — переиспользуя логику `drift-detector`.

`effect-probe.json` подаётся аудитору как вход; LLM интерпретирует «корректно/некорректно/можно лучше» в терминах рубрики.

---

## 6. Инкремент 3: журнал аудита + синтез патчей

### 6.1 Накопительный findings-журнал (G5)

Сейчас находки эфемерны (per-phase summary пересобираются и теряются; Processed — плоский индекс обработки). Между «сырыми per-session findings» и «дистиллированными `patterns/`» **нет постоянного слоя**.

Предложение: **append-only** `dev/meta-improvement/audit-journal.ndjson` (или `.yaml`) с устойчивым ключом:

```yaml
- finding_id: <hash(check_id|class|artifact|signature)>
  first_seen: <ISO>     last_seen: <ISO>
  session_ids: [<uuid>, …]      # накопление инстансов
  session_class: bug-fix
  target_project: my-first-test
  check_id: B           severity: blocking   confidence: high
  signature: "IC edit без DA-review"
  status: open | clustered | patch-proposed | patched | dismissed
  dismiss_reason: <если dismissed>
  dec_dev_ref: <если вылилось в патч>
```

Промоушн-семантика заимствуется у [`patterns/`](meta-improvement/patterns/) (provisional→validated, правило 3 инстансов).

### 6.2 Синтезатор патчей (G6)

**Переиспользуем как паттерн (не код):**
- `meta-feedback` — образец trust-asymmetry «AI surfaces, human decides», формат proposal, цикл `[Y/N/E/D]`, suppression-окно. **НО** это Level A (per-project config в `.product/`); CONVENTIONS §9 запрещает реюз Product-модуля для D7. → синтезатор живёт в `dev/meta-improvement/`, пишет DEC-DEV (не DEC-META), не трогает `.product/`.
- `phase-audit-summary` recommendations — уже почти patch-spec (action+scope+rationale+instance-count).
- `v1_1_backlog` `Bring-forward trigger` — формат условия активации patch-кандидата.

**Жёсткий инвариант (CONVENTIONS §8):** «No auto-fix Stage 2; surface findings, человек решает». Синтезатор **предлагает**, не применяет.

**Пайплайн:**
```
findings-журнал → кластеризация по (check_id, class, signature)
  → recurring (≥3 инстансов) = systemic
  → patch-кандидат {проблема, инстансы-evidence, целевые файлы, тип
       (codify-pattern | patch-template | add-hook | doc-fix | spec-change), risk, confidence, оценка}
  → human gate [Y/N/E/D]
  → [Y] → DEC-DEV черновик + (опц.) ветка/PR; журнал status: patched, dec_dev_ref
  → [N] → status: dismissed + reason, suppress-окно
```
Тип «codify-pattern» вливается в `patterns/` (provisional→validated). Это замыкает «journal → улучшение экосистемы» без auto-apply.

---

## 7. Ограничения D7 и риски

- **CONVENTIONS §8 — no auto-fix.** Синтезатор = surfacing. Не нарушать.
- **Mechanism-ratio (§3):** checklist→skill→command→hook; прыжок вверх обосновать в DEC-DEV (прецедент composite hook+command в Phase 4.1). Классификатор по сути требует кода → обосновано.
- **Самореферентный коллапс (CLAUDE.md §3).** Анализатор сессий экосистемы обкатывается на сессиях экосистемы/пилота. Митигация — инкрементальный dogfood, smoke после каждого инкремента.
- **Стоимость.** `claude -p` на сессию. Пре-пасс отсеивает тривиальные (docs/chore → лёгкая рубрика / skip); `--since` батчит.
- **Ошибки классификации.** Fallback `mixed/uncertain` → catalog-only; класс с confidence в отчёте.
- **Effect-probe требует before/after** → обогатить маркер `git HEAD` начала; учесть один-проект-много-slug.
- **Windows.** `spawnSync(…, shell: win32)` уже в коде; OS-scheduler (если позже) — ручная настройка задачи.

---

## 8. Открытые решения (отложены)

1. **Переименование** `/meta:audit-smoke` → `/meta:audit` (и `audit-smoke.js` → `audit.js`?) — обобщение vs стабильность ссылок. Решить на старте реализации Инкр.1.
2. **Реестр рубрик: формат** — `rubrics/*.md` (читаемо, как `patterns/`) vs единый `rubrics.yaml` (machine-friendly). Склоняюсь к `*.md` + парсируемый frontmatter.
3. **Журнал: `.ndjson` vs `.yaml`** (Инкр.3) — append-эффективность vs читаемость.
4. **Триггер интервал** для полу-авто `/loop` (Инкр.2).

---

## 9. Инкрементальный план

| Инкр. | Содержание | Gap | Smoke-критерий | Статус |
|---|---|---|---|---|
| **1** | Классификатор + реестр рубрик; универсальный режим без `--phase` | G2,G3 | Классы/рубрики на 3–4 Processed-сессиях совпадают с реальностью; вердикты не хуже | **реализован** (deterministic smoke 8/8; live `claude -p` E2E pending) |
| 2 | Полу-авто триггер (`/loop`/`CronCreate`) + effect-probe | G1,G4 | Полу-авто прогон на пилоте; effect-diff корректен | planned |
| 3 | Накопительный findings-журнал + синтезатор патчей | G5,G6 | ≥3 повтора сигнатуры → корректный patch-кандидат через `[Y/N/E/D]` | planned |

Каждый инкремент — DEC-DEV запись + smoke (принцип «после Phase N — мини-тест»).

---

## 10. Ссылки

- Движок: [`scripts/audit-smoke.js`](meta-improvement/scripts/audit-smoke.js) · парсер: [`scripts/audit-index.js`](meta-improvement/scripts/audit-index.js)
- Промпты: [`prompts/session-audit.md`](meta-improvement/prompts/session-audit.md) · [`prompts/phase-audit-summary.md`](meta-improvement/prompts/phase-audit-summary.md)
- Хук: [`hooks/session-audit.js`](meta-improvement/hooks/session-audit.js) · индекс: [`audit-index.md`](meta-improvement/audit-index.md)
- Конвенции: [`CONVENTIONS.md`](meta-improvement/CONVENTIONS.md) (§2 location, §3 ratio, §8 no-auto-fix, §9 self-application)
- Паттерны: [`patterns/`](meta-improvement/patterns/) (provisional→validated) · backlog: [`v1_1_backlog.md`](v1_1_backlog.md)
- Референс-паттерн: `skills/product/meta-feedback.md` (trust-asymmetry, Level A — не реюзать код)
- Решение: [DEC-DEV-0056](../DEV_JOURNAL.md)
