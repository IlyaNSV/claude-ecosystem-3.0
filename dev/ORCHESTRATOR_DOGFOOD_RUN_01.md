# Orchestrator Dogfood — RUN 01 (harvest-лог)

> **Что это:** harvest-лог **первого фактического** dogfood-прогона роли Оркестратора над cc-sdd.
> Спутник плана [`ORCHESTRATOR_DOGFOOD_PLAN.md`](plans/ORCHESTRATOR_DOGFOOD_PLAN.md) (DEC-DEV-0058) — план задаёт *что снимаем*, этот файл — *что сняли*.
> **Источник:** сессия Claude Code `sessionId=6dc62bc8-457d-4911-a412-99a46488aa46` в `my-first-test` (2026-06-13 17:48 → 2026-06-14 07:01, ~13ч). Транскрипт 6.5 МБ / 2168 строк.
> **Метод разбора:** реверс-инжиниринг через mагентный Workflow (14 агентов: 8 построчных action-леджеров по чанкам транскрипта + 5 сквозных измерений + синтез) + ручное чтение крайних чанков. Артефакты разбора — см. §8.
> **Связь:** DEC-DEV-0073 (этот harvest + правки SPEC v1.0-draft).

---

## 0. Дельта против плана — прогон вышел за scope

Pre-flight-скелет (worktree `immutable-snuggling-cascade`, 2026-06-06) ожидал **узкий** прогон: одна фича FM-001, только цепочка `route-handoff-to-cc-sdd` (D2-T spec-генерация), `--verify-only`-мост.

Фактический прогон **прожил полную цепочку D2-T → D3-impl → validation → runtime** над **батчем из 4 фич** (FM-001/002/003/005) + **полную TDD-реализацию `auth` (FM-001, 26 задач)**. Это богаче плана и потому ценнее: снят регламент не одного процесса, а **семи** (см. §3), включая зоны, которые концепт-SPEC помечал «потом».

| Поле | Значение |
|---|---|
| Run # | 01 (фактический; pre-flight-скелет не исполнялся как планировалось) |
| Проект | `C:\Users\pw201\WebstormProjects\my-first-test` (ветка `pre-cc-sdd-pilot`) |
| Модель | Opus 4.8 (1M context), effort xhigh |
| Вход | 4 handoff'а (`status: ready` FM-003/005; `status: partial` FM-001/002), `.product/` готов, `.kiro/` пуст, `src/` нет |
| Инструмент | cc-sdd v3.0.2 (`kiro-*` skills, НЕ slash-команды), адаптер `handoff-to-ccsdd.js` |
| Стек (выбран в прогоне) | TypeScript e2e — NestJS + BullMQ/Redis + Next.js/React + PostgreSQL/Prisma, Node 22 |
| Результат | auth (FM-001) реализован 26/26, 223 теста зелёные, GO; 3 остальных спека — specs-only; live dev-boot вскрыл 6 пробелов |
| Движок автономии | `/loop /kiro-impl auth` + ScheduleWakeup (self-paced), ~13 итераций, пережил один `/compact` |

---

## 1. Карта сессии де-факто (7 этапов)

| Этап | Процесс де-факто | Зона PMO | #idx | Ручное (человек) | Автономное (агенты) |
|---|---|---|---|---|---|
| **E0** | `orchestrator-init` — сбор состояния | (все) | #21–45 | свободный текст «возьмём батч фич» (#13) | Glob/Read/`bd ready`/`bd list`/граф RL-001 |
| **E1** | `decide-architecture-foundation` | D2-T01/T02 | #129–184 | **выбор стека** (гейт), синтез вердиктов, заказ консилиума | консилиум 3 архитекторов `parallel()` |
| **E2** | `batch-features-to-cc-sdd` | D2-T01/T06 | #267–446 | — (полностью автономно) | steering, briefs, spec-author ×4, cross-spec review, fix ×4, coverage |
| **E3** | `audit-spec-fidelity` — спек vs `.product` | D2-T verify | #470–536 | **заказ аудита** (#470), триаж severity | 4 fidelity-auditor `parallel()` |
| **E4** | `feature-to-tdd-impl` — TDD 26 задач auth | **D3** | #592–2025 | старт `/kiro-impl`, темп `/loop`, risk-классификация глазами | implementer ×13, adversarial-reviewer ×8, per-task commit/push, ScheduleWakeup-петля, /compact-recovery |
| **E5** | `validate-feature-impl` — GO/NO-GO | D3 verify | #2026–2122 | — | механический слой + 3 валидатора `parallel()` + verify-finding → GO |
| **E6** | `runtime-smoke-readiness` — «стартует ли dev?» | D3+ runtime | #2129–2158 | **вопрос про dev-запуск** (#2129), приоритезация 6 пробелов | живой boot, диагностика 500, re-boot |

**Структурные наблюдения:**
- **D1 (Discovery) отсутствует** — Оркестратор входит с готовыми `.product/` и handoff'ами. Подтверждает зону концепта (D2-T+).
- **Граница автономии смещается вправо.** Все 4 человеческих гейта — в E0/E1 (scope/архитектура, первая треть). Весь E4 (23 из 26 задач) — без единого человеческого гейта. Суждение человека концентрируется в scope-defining фазе, не в исполнении.
- **Два терминальных состояния, не одно.** E5 даёт feature-GO; E6 показывает feature-GO ≠ dev-ready. Оркестратор сейчас их не различает.
- **«Руки» оснащены заранее, вне сессии.** В E4–E6 человек НЕ вмешивался по инфра-дефицитам — Docker/pnpm/Node/beads/cc-sdd работали автономно. Вмешательство осталось на runtime-обвязке (E6).

---

## 2. Harvest по плановым целям (4 вещи на шаг)

План требовал на каждом шаге фиксировать: (1) фактическую последовательность, (2) точки решений, (3) capability-запросы Интегратору, (4) гейты. Сводка:

### 2.1. Фактическая последовательность
Снята как 7-этапная карта (§1) + детерминированные Workflow-скелеты для P3 и P5 (см. `out-dim-1`, §8). Жёсткие зависимости (что нельзя параллелить): волновой барьер cross-spec; RED→GREEN внутри задачи; depends-цепочка задач tasks.md.

### 2.2. Точки решений (суждение vs детерминизм)
- **Подлинно неустранимые человеческие суждения — только 2:** выбор tech-стека (цементируется в 4 design.md) и «что считаем deliverable». Остальные 2.5 из 4 гейтов — артефакт отсутствия авто-вывода зависимостей и tier-механики с дефолтами.
- **Самое частое недокодифицированное суждение** — выбор тяжести verification-гейта (inline vs independent reviewer). Принималось глазами по маркерам задачи на каждой итерации E4. → кандидат P0 `gate-risk-classifier`.

### 2.3. Capability-запросы Интегратору — **канал §6 НЕ активировался ни разу**
Главный вывод прогона по §6: за 13ч ни один из ~24 дефицитов не прошёл через канал `request→оснащение→исполнение`, потому что:
- инфра (Docker/pnpm/Node/beads/cc-sdd) **оснащена заранее**, вне сессии;
- env-дефициты (#2 Node18-vs-22, #5 esbuild-decorator, #6 prisma-dotenv) Оркестратор **поглотил сам** — нарушив границу;
- внешние API/секреты (#16–21) **замокал** (отложил provisioning);
- prod-инфра (#12 Hetzner, #21 ЮKassa) **вынес в follow-up**.

Полный реестр дефицитов (24 строки, тип «руки/голова», как должен был выглядеть capability-spec, как решено, autonomy-tier) — `out-dim-3`, §8. Два опорных кейса:
- **✅ эталон §6:** Docker-стек (#10) — хост дал docker-tool («Интегратор оснастил»), `docker compose up pg+redis` + per-iteration `docker ps healthy` исполнял Оркестратор. Ровно модель §6.
- **✗ анти-эталон:** фикс адаптера CNT-001 (#195–262) — Оркестратор обнаружил дефект (✓ его зона), но **сам починил адаптер** (✗ зона Интегратора). Должен был `capability-request(type:tool, id:CNT-001)`.

### 2.4. Гейты
3-слойная модель детерминизма (§2 SPEC) подтвердилась эмпирически на каждом уровне:
- **Слой-3 verify ловил реальные дефекты:** адаптер `--verify-only` вскрыл silent fidelity-loss (#195); adversarial-reviewer дал единственный REJECT на HIGH-tier задаче (4.6 timing-oracle, #1434); feature-gate поймал кросс-задачный `/reset` vs `/reset-password` (#2050).
- **Human-гейты:** 4 AskUserQuestion, все в E0/E1. **2 из 4 были ОТКЛОНЕНЫ** с «хочу уточнить» (#118 стек, #461 глубина) → §7 моделирует approve как бинарный, реальность дала `rejected → clarify-loop → новый гейт`.

---

## 3. Каталог процессов (снято: 7 регламентов)

Концепт-SPEC знал **1** процесс (`route-handoff-to-cc-sdd`). Прогон раскрыл **7**:

| # | Процесс (playbook) | Зона | Триггер | Role-агенты | Где в сессии |
|---|---|---|---|---|---|
| **P1** | `orchestrator-init` (+resume после /compact) | все | старт / re-entry | — | #21–45, #1145–1168 |
| **P2** | `decide-architecture-foundation` (опц.) | D2-T01/02 | scope-defining gate | architecture-consilium ×3 | #129–184 |
| **P3** | `batch-features-to-cc-sdd` ⟸ **это и есть §8 первый инкремент** | D2-T01/06 | батч handoff'ов | spec-author, cross-spec-reviewer, spec-fixer | #267–446 |
| **P4** | `audit-spec-fidelity` | D2-T verify | перед route-to-impl | fidelity-auditor ×N | #470–536 |
| **P5** | `feature-to-tdd-impl` | D3 | spec готов, depth=до-кода | tdd-implementer, adversarial-reviewer | #592–2025 |
| **P6** | `validate-feature-impl` (GO-gate) | D3 verify | последняя `[x]` | 3 валидатора | #2026–2122 |
| **P7** | `runtime-smoke-readiness` | D3+ runtime | «стартует ли dev?» | — (+capability→Integrator) | #2129–2158 |

`P2` опционален (нужен при нерешённой архитектурной развилке); `P7` раскрыт, но **не оснащён** (нет D3-runtime инструментов).

Детерминированные shape-скелеты P3 и P5 (с `[S]`/`agent()`/`[GATE]`/`[AUTONOMY]`-разметкой) — `out-dim-1` §C.

---

## 4. Таксономия role-агентов (11 ролей)

Де-факто возникло **11 различимых ролей**, **все собирались вручную из general-purpose субагентов** (хотя `kiro-*` шаблоны уже существовали). Каждая должна возвращать **structured-verdict schema** (делает синтез вердиктов детерминированным).

| ID | Роль | Фаза | Parallel/Seq | Гейт после |
|---|---|---|---|---|
| RA-1 | `architecture-consilium` (multi-prior) | E1 | parallel ×3 | синтез-агрегатор → human-gate |
| RA-2 | `spec-author` (cc-sdd pipeline 1 фичи) | E2 | волна1 seq, волна2 par ×3 | spec verify + coverage |
| RA-3/3' | `cross-spec-reviewer` (+re-reviewer) | E2 | sequential | arbitration → fix → re-review |
| RA-4 | `spec-fixer` (consumer-conform) | E2 | parallel ×4 (scope-изоляция) | RA-3' |
| RA-5 | `fidelity-auditor` (spec vs .product) | E3 | parallel ×4 | триаж → spec-fix / product-feedback |
| RA-6/6' | `tdd-implementer` (+remediation) | E4 | sequential | inline-verify / RA-7 |
| RA-7 | `adversarial-task-reviewer` | E4 | sequential (выборочно) | сам и есть verify-gate |
| RA-8/9/10 | `requirements-coverage` / `design-alignment` / `integration-boundary` валидаторы | E5 | parallel ×3 | verify-finding → fix → GO/NO-GO |
| **RA-0** | `orchestrator-controller` (мета, **главный агент**) | все | — | владеет всем sequencing'ом |

**RA-0** — ровно та роль, которую проектируемый Оркестратор должен нести **Workflow-скелетом, а не суждением**. Большинство gap'ов прогона = «решения RA-0, которые надо кодифицировать в скелет»: sequencing, risk-классификация гейта, синтез вердиктов, owner-arbitration, selective-commit, ведение cross-task contract-ledger, self-pacing, re-orientation после /compact.

Полные job-description'ы (входы/выходы/контракт) — `out-dim-1` §A.

---

## 5. Ключевые находки (приоритизированы)

### P0 — без этого детерминизм держится на человеке
- **P0-1. Content-level verification-oracle (не presence-level).** Самая ценная находка. Адаптер CNT-001 прошёл `--verify-only` exit 0, но тихо клал WCAG в `scenarios`, UI в `business_rules` (root cause: §10 UI с вложенной нумерацией `## N.` → плоский last-write-wins затёр §1-7). C-04 проверял **наличие** номеров секций, не **семантику**. Правило: `scenarios ⊨ ∀ /SC-\d+/`, `business_rules ⊨ ∀ /BR-\d+/`, `∀ §handoff → ровно одно target-поле (no last-write-wins)`. (#195–237)
- **P0-2. `gate-risk-classifier` (inline vs independent reviewer)** как предикат, не суждение. Требует **машинного реестра load-bearing инвариантов** (IC-001..007, BR-007/009/012/013/020). Доказательство ценности: единственный REJECT пришёлся ровно на HIGH-tier (IC-006). (#748 vs #1592, #1434)
- **P0-3. In-harness Workflow durable skeleton.** После `/compact` (полная потеря контекста) цикл восстановился побайтово из git+tasks.md+beads — потому что скелет был экстернализован вручную. Workflow-скрипт даёт это by-design. **Сильнейший структурный аргумент ЗА модуль.** (#1082–1168)
- **P0-4. Каталог role-агентов с structured-verdict schema** (см. §4).

### P1 — закрывает реально пойманные дефекты
- **P1-1.** Coverage-oracle «не доверяй self-report» (ID извлекаются независимо от субагента). (#436, #2048)
- **P1-2.** Pre-impl fidelity-аудит как штатный гейт + **авто-re-audit после remediation** (ремедиация сама внесла дрейф: D-1 #501 = следствие cross-spec FIX 4 с фиктивным trace IC-013).
- **P1-3.** Persistent inter-task **Notes-ledger** forward-deps (cross-task контракты жили в tasks.md прозой ad-hoc: `consume(tx)` #897, esbuild-обход #971, eviction-seam #1551).
- **P1-4.** Capability self-check с **version-compat матрицей** + env-readiness-probe (#537 pnpm-vs-Node18 `EBADENGINE`, #963 esbuild — всплыли реактивно внутри субагента).
- **P1-5.** Cross-task feature-level GO-gate (per-task недостаточен: дефект `/reset` жил на границе двух зелёных задач). (#2048–2097)
- **P1-6.** Boundary-oracle (авто-фильтр ambient-churn `.beads/`/`project-journal.md`; детектор cross-boundary touch). (#818, #1334)

### P2 — архитектурные пробелы (новые каналы)
- **P2-1.** `runtime-smoke-readiness` gate — «223 теста зелёные ≠ приложение стартует»: live-boot дал 500 (`.env` не грузится процессом) + 5 инфра-пробелов. (#2129–2158)
- **P2-2.** Обратный канал **Оркестратор→Product** — fidelity-аудит нашёл дефекты самого `.product` (#486–500 NFR-004/005 backoff vs BR-040; устаревшие event-имена); «design молчит → дефолт 30д» (#1715). Это не Integrator-capability, владелец = Product.
- **P2-3.** Remediation-loop с reduced re-gate + критерием выхода (`all RESOLVED`). (#1440–1462, #428)

---

## 6. Открытые вопросы (что dogfood НЕ снял)

1. **§6 не провалидирован на D3** — канал ни разу не сработал (всё оснащено заранее). §6 нагрузится только на E4 с **неоснащённой** инфрой. Нужен прогон без pre-equipping.
2. **Граница Orchestrator↔Integrator не enforced** — Оркестратор по умолчанию её поглощает (#29, #2), потому что починить самому быстрее, чем эскалировать в вакуум. Async `request→await→resume` — гипотеза, не проверена.
3. **`disable-model-invocation` на `/kiro-impl`** (#581) — прямой конфликт с автономией. Либо process-skills получают orchestrator-invocation-режим (harness-change), либо P5 реализуется нативно (не через `/kiro-impl`). Второе рекомендовано, не прототипировано.
4. **Cross-session durability** не существовала — её маскировал человек за терминалом 13ч. ScheduleWakeup = session-only. Внешний планировщик (n8n/cloud routine) — гипотеза, dogfood его не упражнял.
5. **E6 runtime-readiness** раскрыт, но не оснащён — граница «фича готова» vs «приложение под ключ» не формализована.
6. **Multi-feature очередь** не проверена — прошла одна фича (auth). На нескольких фичах /compact будет частым, надёжность resume не дотестирована.
7. **«Неустранимость» выбора стека** опирается на одну сессию с одним стеком — нужен прогон с другой развилкой, чтобы подтвердить, что консилиум-синтез автоматизируем.

---

## 7. След в репозитории экосистемы (action item)

Баг адаптера, пойманный и починенный пилотом (§10 UI-подсекции затирают §1-7 + regex генератора не признаёт `v1.4.0`), **всё ещё живёт в эталоне экосистемы** `adapters/handoff-to-ccsdd.js` (source of truth):
- `extractSections` (строка ~208) ключует секции плоско по номеру, без monotonic-increase guard;
- `SUPPORTED_HANDOFF_GENERATOR_RE` (строка 39) = `/^product-module-v1\.(0|1|2)(\.\d+)?$/` — не покрывает `v1.4.0`.

Фикс из пилота не доехал upstream. Вписывается в DEC-DEV-0065 (двусторонний дрейф пилот↔экосистема). **→ отдельный fix-коммит в экосистему** (рекомендованный шаг 2).

---

## 8. Артефакты разбора

Полный разбор (временно, вне git): `C:\Users\pw201\AppData\Local\Temp\sess-audit-6dc62bc8\`
- `timeline.md` — компактный таймлайн всех 1226 событий;
- `chunk-01..08.md` — читаемые срезы транскрипта с полными thinking-блоками;
- `out-ledger-01..08.md` — построчные action-леджеры (что/почему/как/как-должен-оркестратор/gap);
- `out-dim-1..5.md` — 5 сквозных измерений (роли+каталог / гейты+автономия / capability / движок / ручные-точки);
- `out-synth.md` — синтез (вход в дизайн).

> Метод (mагентный Workflow) сам по себе — переиспользуемый паттерн для аудита длинных автономных сессий; кандидат на канонизацию в D7.

---

## 9. Трекер прогресса (живой)

> **SSOT прогресса** доработки модуля по результатам аудита. Обновляется по мере landing'а каждого шага. Источники follow-up'ов: DEC-DEV-0073 §Follow-ups + синтез (`out-synth.md` §5). Зеркалится в harness `/tasks` на время сессии. Ветка: `feat/orchestrator-dogfood-run01`.

| Шаг | Что | Связь | Статус | Commit |
|---|---|---|---|---|
| **S1** | Harvest сессии + SPEC v0.1→v1.0-draft | DEC-DEV-0073 | ✅ done | `5a4f906` |
| **S2** | Канонизация **P0-1** (content-level oracle C-07) + upstream-фикс адаптера + регресс-тест | DEC-DEV-0074 / follow-up #1 | ✅ done | `880f97d` |
| **S3** | `gate-risk-classifier` (**P0-2**) + реестр load-bearing инвариантов — **design** (`dev/ORCHESTRATOR_GATE_RISK_CLASSIFIER.md`, валидирован 16/17 против RUN 01; wiring отложен в S5 per OD10) | follow-up #2 | ✅ design done | `5350a6d` |
| **S4** | Решить **OD10** — scope 1-го инкремента | follow-up #3 | ✅ done → **E2+E4** (DEC-DEV-0075) | (journal) |
| **S5-kickoff** | D7 phase-kickoff build P3+P5: решения A1–A6, scope-cuts, split, Q1–Q4 подтверждены, harness-ограничение D.1 | follow-up #4 | ✅ done (`ORCHESTRATOR_BUILD_KICKOFF.md`) | `a6078fc` (+resolutions) |
| **S5a** | **Build P3** `batch-features-to-cc-sdd` — **ГИБРИД** (DEC-DEV-0076): оркеструем `kiro-spec-batch` (он делает волны+dispatch+10-точечный cross-spec+fix), добавляем мост `handoff→brief.md/roadmap` (замена `kiro-discovery`) + preflight C-07 + детерминир. `coverage-oracle` + durable Workflow-скелет. Дропнуты как дубль: spec-author/cross-spec-reviewer/spec-fixer + arbitrate-cross-spec. `build-steering`→делегирует `kiro-steering`. Smoke на fixtures зелёный (`npm run verify` exit 0: adapters 4/4, oracle 6/6, workflow-smoke 2/2). | follow-up #4 | ✅ done | (этот коммит) |
| **S5b** | **Build P5** `feature-to-tdd-impl` — **тонкий native + ЛИФТ kiro-impl** (DEC-DEV-0077). `kiro-impl` зрелый, но `disable-model-invocation` (OD9) → Workflow владеет минимальным dispatch-FSM, но лифтит всё: агент читает `kiro-impl/templates/{implementer,reviewer,debugger}-prompt.md` в прогоне + зовёт `kiro-review`/`kiro-verify-completion`/`kiro-validate-impl`. Net-new = `gate-risk-classifier.cjs` (P0-2, предикат HIGH/LOW, §6-регрессия **17/17** с M5) + durable скелет. Tasks последовательно (git-safety). Smoke зелёный (`npm run verify` exit 0: oracle 6/6, classifier 8/8, workflow-smoke 3/3). | follow-up #4 | ✅ done | (этот коммит) |
| **S6** | Прогон №2 (`feature-to-tdd-impl` FM-002 localization, P5/D3) — провалидировать §6 на D3 (откр. вопрос №1) | follow-up #5 | ✅ done (DEC-DEV-0081) | (журнал) |

> **Итог S6 (2026-06-18→19, DEC-DEV-0081):** §6-A…E + Q#2 = **FAIL** — канал не сработал по реальному provider-пробелу. Root-cause: §6 = **обработчик блокировок, не детектор пробелов** (block-only keying); spec-mandated Mock (DEC-A06) сделал отложенность не-блокирующей → instruction-silent. Контраст billing(блок→сработал, защитимый in-zone fix) vs providers(mock→молчок). Конкретный баг: субагент честно записал отложенность в **CONCERNS**, но `feature-to-tdd-impl.mjs` его роняет (не читает/не возвращает). Фикс = 5 ранжированных (#1 CONCERNS-propagation / #2 GO-disclosure / #5 §6-E рубрика — валидируемы сейчас; #3 env-probe deferred-disposition / #4 tracking-rule — нужен S7). DEC-DEV-0078 update-smoke = **PASS**. Журнал прогона: пилот `.claude/orchestrator/runs/S6-FEEDBACK-JOURNAL.md` (FB-012…018). Реализация фиксов + S7 detect-leg ретест — open.

**Уже закрыто внутри S1 (не отдельные шаги):** SPEC-правки §6/OD5 (типология +env-constraint/secret, `route`, раздельные tier'ы, async-протокол OD7), §7-bis (re-formulation-петля), §2-bis (движок), каталог 7 процессов, таксономия 11 ролей.

**Прочие follow-up'ы (P1/P2, backlog — не на критическом пути первого инкремента):** coverage-oracle как требование ко всем гейтам (P1-1); pre-impl fidelity-аудит штатным шагом + авто-re-audit (P1-2); persistent Notes-ledger (P1-3); env-readiness-probe в init (P1-4, частично описан §5.4 SPEC); boundary-oracle (P1-6); runtime-smoke-readiness P7 (P2-1, нужен D3-runtime); обратный канал →Product (P2-2, OD8). Подробности — §5.
