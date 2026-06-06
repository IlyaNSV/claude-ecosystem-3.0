# Session Audit v2 — Design Doc

> **Status:** **SHIPPED Инкр.1+2+3** — Инкр.1 (DEC-DEV-0056) · Инкр.2 (DEC-DEV-0057) · Инкр.3 (DEC-DEV-0059, merge PR #21) · **Created:** 2026-05-31 · документ сохраняется как as-built инженерная справка
> **Decision refs:** [DEC-DEV-0056](../DEV_JOURNAL.md) (Инкр.1) · [DEC-DEV-0057](../DEV_JOURNAL.md) (Инкр.2) · [DEC-DEV-0059](../DEV_JOURNAL.md) (Инкр.3 kickoff — re-anchor оракула; 0058 занят параллельной Orchestrator-сессией)
> **Scope Инкр.3 (поставлен):** re-anchor оракула на **PMO-зоны (two-axis multi-label)** + накопительный findings-журнал + синтезатор патчей.
> **Важно (DEC-DEV-0059):** механизм аудитит **только продуктовые сессии**. `ecosystem-dev`/self-dev аудит выкинут. Зоны — **owned-only** (D1, D2-B вкл. design, integrator-handoff); делегированные D2-T/D3/D4 невидимы в Claude-сессии.
> **Принадлежность:** D7 meta-improvement. Артефакт dev-only, НЕ деплоится в пользовательские проекты (CONVENTIONS §2/§9).

---

## 0. Зачем

Текущий `audit-smoke` ориентирован на **проверку конкретной фазы реализации экосистемы** (`--phase=N` → smoke-план → coverage сценариев). Потребность: превратить его в **замкнутый автоматический механизм**, который:

1. при появлении транскрипта новой сессии запускается сам (полу-авто);
2. **сам определяет специфику сессии** (напр. «первая сессия после поставки модуля Design» vs «обычная сессия баг-фикса»);
3. по специфике понимает, **с чем и по каким критериям** сопоставлять проделанное и **как это повлияло на продуктовый проект**;
4. фиксирует «что корректно / что нет / что можно улучшить» в **журнале аудита сессий**;
5. из накопленных записей журнала позже **синтезирует патчи-улучшения** для самой экосистемы.

Этот документ — инженерный дизайн под эту потребность, разбитый на инкременты. Все три инкремента поставлены (SHIPPED Инкр.1+2+3); ниже — as-built описание механизма.

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
   2. Классификатор → зоны[] (multi-label, owned-only) + mode                    ← [Инкр.1]  G2
   3. Zone-references → ОБЪЕДИНЁННЫЙ baseline + criteria всех затронутых зон   ← [Инкр.1]  G3
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

## 4. Инкремент 1: классификатор + реестр рубрик

### 4.1 Двухступенчатая классификация (детерминированно → LLM)

Повторяем паттерн движка (детерминированный счёт + LLM-интерпретация). **Пре-пасс на JS** в драйвере собирает «профиль сессии» из дешёвых сигналов:

- `cwd` / `target_project` (из маркера) — какой проект;
- **git в окне сессии**: `git log` между HEAD начала и конца → scope коммитов (`feat`/`fix`/`refactor`/`docs`/`chore` + `(product|design|integrator|…)`);
- **slash-команды** из транскрипта (`/design:*`, `/product:feature`, `/ecosystem:update`, `/integrator:add`) — сильнейший сигнал намерения (уже извлекается в Step 1);
- **тронутые пути**: `.product/features/` vs `business-rules/` vs `mockups/` vs `dev/meta-improvement/`;
- **временная привязка**: дата сессии vs дата поставки модуля/тега в `CHANGELOG`/`git tag` → детект «первая сессия после поставки модуля X».

Пре-пасс выдаёт `session-profile.json` + кандидат-класс. LLM-аудитор подтверждает/уточняет класс (видит намерение в user-сообщениях, ловит override). Дёшево, воспроизводимо, устойчиво к ошибкам односигнальной эвристики. Класс пишется в отчёт с `confidence` для ревизии.

### 4.2 Таксономия классов и реестр рубрик

> **⚠ SUPERSEDED частично (DEC-DEV-0059, Инкр.3a):** модель «один task-class через argmax» заменяется на **two-axis zone-anchored multi-label** (см. новый §6.0). Таблица ниже сохранена как исторический контекст Инкр.1; строка `ecosystem-dev` **удалена** — механизм аудитит только продуктовые сессии.

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
| ~~**ecosystem-dev**~~ | ❌ **УДАЛЕНО** (DEC-DEV-0059) — аудитим только продуктовые сессии, не self-dev экосистемы | — | — | — |
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

> **✅ Реализовано (Инкр.2, DEC-DEV-0057):** [`scripts/effect-probe.js`](meta-improvement/scripts/effect-probe.js).
> Окно сессии деривируется из транскрипта (`timestamp`/`cwd`/`gitBranch`) — хук не тронут, работает
> ретроактивно на captured-маркерах. `before`/`after` — `git rev-list --before=<ts>` на ветке пилота
> (graceful: `committed:false` когда коммитов в окне нет). Валидатор — **standalone** (не реюз
> Product-хука, §9): подмножество V-01/V-04/V-09/V-10 + B.1-anti-rename + dangling-ref (subset V-11).
> Вместо хрупкой before/after re-валидации — **атрибуция** `touched_in_session` (находка на тронутом
> сессией артефакте = её ответственность; на нетронутом = pre-existing debt). Full before/after diff и
> drift-сигнал отложены. Проводка — `--classify` ветка драйвера → `{{EFFECT_PROBE}}` → Step 3.5 промпта.

---

## 6. Инкремент 3: журнал аудита + синтез патчей

> **Порядок (DEC-DEV-0059):** 3a (re-anchor оракула, §6.0) → 3b (журнал, §6.1) → 3c (синтезатор, §6.2). Один branch `feat/session-audit-v2-incr3`.

### 6.0 Re-anchor оракула: two-axis zone-anchored (3a) — supersedes §4.2

**Проблема Инкр.1 (вскрыта на kickoff):** рубрики ключены по абстрактному task-class, классификатор берёт argmax (один победитель). Это (а) lossy для мульти-зонных сессий (одна продуктовая сессия легитимно идёт D1→D2-B→handoff), (б) неверная ось — эталон «как должно было пройти» привязан к PMO-зоне/модулю, а не к задаче (критерии A–G уже кластеризуются по зонам).

**Модель — две ортогональные оси:**

1. **Зона (первичная, multi-label, owned-only).** Классификатор детектит ВСЕ затронутые зоны (по порогу активации, не argmax). Owned-зоны — единственные, что видны в Claude-сессии продукта:

   | zone id | модуль | baseline (ground truth) | criteria |
   |---|---|---|---|
   | `D1-discovery` | Product | `processes.md` (P1), `product-module/SPEC.md`, `artifacts/{PS,HYP,SEG,VP,MR,CA,MVP,RM,RL}` | A, E, D |
   | `D2B-behavioral` | Product | `processes.md` (P-RULE-01/02), `product-module/SPEC.md` F.0–F.10, `artifacts/{FM,SC,BR,IC,LC,NFR,VC,RPM,BG}` | A, B, C, D, F |
   | `D2B04-design` | Design | `design-module/SPEC.md`, `artifacts/{MK,DS,NM}` | A, D, F |
   | `D6-integrator` | Integrator | `integrator-module/SPEC.md`, `handoff-spec.md` | handoff DoR, V-11 |

   Делегированные D2-T/D3/D4/D5 **не заводятся** — их работы в Claude-сессии нет, виден только handoff в них (= D6).

2. **Mode (вторичная, модификатор строгости).** `feature | fix | refactor | maintenance` из commit_type + occasion-флаг `module-shakedown`. Модулирует строгость (semantic vs cosmetic; напр. cosmetic-правка BR не требует DA).

**Аудитор** читает ОБЪЕДИНЕНИЕ baseline всех затронутых зон как ground truth; criteria — объединение по зонам, отфильтрованное mode.

**ecosystem-dev удалён** (только продуктовый аудит). Inventory чистки — DEC-DEV-0059 Outcome (6 мест).

**Хранение:** `rubrics/` остаётся data-driven (концепт «task-class рубрика» → «zone-reference»; зоны не хардкодятся в коде — добавить зону = добавить `.md`). Имя директории `rubrics/` сохраняем для стабильности ссылок (переименование — §8).

### 6.1 Накопительный findings-журнал (G5)

Сейчас находки эфемерны (per-phase summary пересобираются и теряются; Processed — плоский индекс обработки). Между «сырыми per-session findings» и «дистиллированными `patterns/`» **нет постоянного слоя**.

Предложение: **append-only** `dev/meta-improvement/audit-journal.ndjson` (или `.yaml`) с устойчивым ключом:

```yaml
- finding_id: <hash(zone|check_id|artifact|signature)>   # zone-anchored (DEC-DEV-0059)
  first_seen: <ISO>     last_seen: <ISO>
  session_ids: [<uuid>, …]      # накопление инстансов
  zone: D2B-behavioral          # первичная ось (§6.0)
  mode: fix                     # вторичная ось (модификатор)
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
findings-журнал → кластеризация по (zone, check_id, signature)   ← zone-anchored (DEC-DEV-0059)
  → recurring (≥3 инстансов) = systemic
  → ADVERSARIAL-VERIFY (несколько скептиков на кластер, default-refute)  ← ОБЯЗАТЕЛЬНО (DEC-DEV-0057 Lesson #1)
       выжил ≥majority → patch-кандидат; иначе → drop / status: uncertain
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

1. **Переименование** `/meta:audit-smoke` → `/meta:audit` (и `audit-smoke.js` → `audit.js`?) — обобщение vs стабильность ссылок. **Всё ещё отложено** (Инкр.1+2 не трогали имя; ссылок на `audit-smoke` много — стабильность пока перевешивает). Пересмотреть при Инкр.3.
2. ✅ **Реестр рубрик: формат** — выбран `rubrics/*.md` + парсируемый frontmatter (Инкр.1).
3. **Журнал: `.ndjson` vs `.yaml`** (Инкр.3) — append-эффективность vs читаемость.
4. ✅ **Триггер интервал** — `audit-watch.js` дефолт `--since=1h`, рекомендуемый `/loop 45m` (Инкр.2). Гайд: `--since` ≥ интервала; widening для catch-up. См. `checklists/audit-watch.md`.

---

## 9. Инкрементальный план

| Инкр. | Содержание | Gap | Smoke-критерий | Статус |
|---|---|---|---|---|
| **1** | Классификатор + реестр рубрик; универсальный режим без `--phase` | G2,G3 | Классы/рубрики на 3–4 Processed-сессиях совпадают с реальностью; вердикты не хуже | **✅ done** — deterministic smoke 8/8 + live `claude -p` E2E (integration) на ветке `feat/session-audit-v2-incr1`; класс. на 4 реальных транскриптах верна |
| 2 | Полу-авто триггер (`audit-watch.js`+`/loop`) + effect-probe | G1,G4 | Полу-авто вход идемпотентен; effect-probe корректен на пилоте | **✅ done** — `effect-probe.js` (window из транскрипта + git-окно + standalone-валидатор V-01/04/09/10 + B.1 + dangling-ref + attribution `touched_in_session`); проводка в `--classify` через `{{EFFECT_PROBE}}` + Step 3.5; `audit-watch.js` + `checklists/audit-watch.md`; classifier coverage-gap (user-typed slash) закрыт. 12/12 unit + live E2E (04649f41 → attributed V-09 на SEG-003). DEC-DEV-0057 |
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
