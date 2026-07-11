# Сверка реестра разрывов G01–G36 — что закрыто фактически (2026-07-10)

> **Что это:** пост-graduation обязательство №2 ([EXECUTION_ROADMAP](../EXECUTION_ROADMAP.md)
> §«Пост-graduation обязательства», DEC-DEV-0167). Сверка реестра
> [APPENDIX-B](APPENDIX-B-gap-analysis.md) §1 против фактического состояния main
> (`ab314be`, после merge PR #144): что закрыли Fabric (0153–0155, 0162–0165) и
> параллельная дорожка quick-wins (0156–0160), что осталось и куда роутится остаток.
> **APPENDIX-B не редактируется** — он as-is снапшот аудита (конвенция AUDIT §7);
> живой статус разрывов — здесь.
>
> **Метод:** каждый статус подтверждён артефактом в репо (путь/строка — recon-прогон
> 2026-07-10) либо записью DEV_JOURNAL/PR. Не «по памяти».

## Итог одним взглядом

| Статус | Сколько | Какие |
|---|---|---|
| ✅ **Закрыт** | 9 | G05 G06 G19 G20 G23 G32 (машинно) + G18 G33 G35 (doc-drift quick-wins, DEC-DEV-0170) |
| 🟡 **Частично закрыт / существенно сужен** | 10 | G03 G04 G07 G09 G10 G11 G12 G13 + G17 G21 (DEC-DEV-0170) |
| ⬜ **Открыт** | 17 | G01 G02 G08 G14–G16 G22 G24–G31 G34 G36 |

Ключевой сдвиг: диагноз аудита «между сенсором и мышцей стоит человек» для **fabric-tracked
линии P3→P7 снят** — PA-мост + bracket-guard + owner-queue дают замкнутый машинный контур
(live-подтверждено G-A/G-B/G-C). Вне fabric-линии (product-сегмент, Integrator, D7-гигиена)
разрывы остаются как были.

## ✅ Закрыто машинно

| # | Чем закрыт | Доказательство |
|---|---|---|
| G05 | SubagentStop-watchdog: wipe/overwrite очереди без состоявшегося ревью детектится | `hooks/product/subagent-watchdog.js` (заголовок: «closes audit gaps G05 + G06»); DEC-DEV-0159, PR #134 |
| G06 | Тот же watchdog ловит спавн ревьюера под НЕ-каноническим agent type | там же |
| G19 | Линтер catalog↔runner в блокирующем verify | `dev/meta-improvement/scripts/check-validation-sync.cjs`; `package.json` → `check:validation-sync` в цепочке `verify`; DEC-DEV-0158, PR #133 |
| G20 | Шаблон пилота несёт канонические счётчики | `templates/project/CLAUDE.md.template:224-225` — «44 validation rules», «24 artifact types»; DEC-DEV-0156, PR #131 |
| G23 | process-gate ставится автоматически на `npm install` | `package.json:7` `"prepare": "node dev/meta-improvement/scripts/install-git-hooks.cjs --best-effort"`; DEC-DEV-0157, PR #132 |
| G32 | Аллокатор DEC-DEV атомарен: `--claim` резервирует в git-common-dir + сканит локальные ветки | `next-dec-dev.js` claim-режим; DEC-DEV-0160, PR #135 |

## 🟡 Частично закрыто / сужено

| # | Что закрыто | Что осталось → куда роутится |
|---|---|---|
| G03 | Для fabric-tracked линий PA-канал получил слушателя end-to-end: human-gate → каноническая PA-запись + owner-queue, `pa-scan [--tick]` (done→tick, dismissed→surfaced), SessionStart-инжект статуса (DEC-DEV-0155; live: PA-045, критерий G-C). Оговорка ANOM-5 закрыта тем же днём: owner-queue самоочищается на write-path, `status` показывает stale отдельно (DEC-DEV-0168) | PA-трафик **вне** fabric-инстансов (эскалации P2–P7 без `--fabric`, product-routed drifts) — по-прежнему write-only |
| G04 | Generic await→resume для fabric-линии работает: parked-состояния + resume-события + PA-мост (live: `awaiting_product` PA-051/052 → консилиум → resume, DEC-DEV-0162). **OD7 capability-контур ПОСТРОЕН (DEC-DEV-0171):** §6 BLOCK паркует линию (`awaiting_capability`/`awaiting_capability_impl`), capability-spec едет payload'ом в PA, resume = bracket-ре-ран (P5 продолжает с tasks.md-чекбоксов) | **LIVE-ВАЛИДИРОВАН по совокупности:** прогон 2026-07-10 = условный GO (парковка + payload + resume + continuation PASS; `OD7_LIVE_RUN_GRADE_REPORT.md`) → фиксы дефектов DEC-DEV-0174 → **R1 re-run 2026-07-11 = PASS** (park machine-backed ledger-брекетом диспетчера; `OD7_R1_RERUN_BRIEF.md` §Outcome, DEC-DEV-0175). Остаток: ветка `env.up` — event-gated |
| G07 | Сегмент P3→P7 накрыт state-machine: charter `feature-production-line` + prescriptions + инжект статуса — «пропущенный шаг» теперь виден машинно | Product-сегмент (init→plan→feature→handoff) — всё ещё текстовые «Next:»; charter №2 product-front срезан (2e) → **фаза 4 по live-триггеру** |
| G09 | Orphan-статус снят: первый живой потребитель `autonomy-policy.cjs` = fabric-engine (`fabric-engine.cjs:43`), `--autonomy L0\|L1` сквозной в `run.md`; чек-лист F1 §6 закрыт 6/6 (DEC-DEV-0154) | Полное F2-wiring (автономия на всех гейтах экосистемы) — отдельный vision-трек, coordination-gated |
| G10 | Live-прогон 0162 снял «не подтверждён живьём»: P3 `batch-features-to-cc-sdd` → P4 (поймал 2 реальных LOW-дрейфа BR-081) → P5 (19/19 тасков, run-id-backed) → P6×2 NO-GO→GO (добор G-B, 0163) на пилоте FM-006. DEF-4 закрыт: P7 probe сканирует workspaces (DEC-DEV-0168) | Ветка `runtime_gate_retry`/`evt:env.up` честно live-невалидирована (более не маскируется DEF-4 — проверится естественным триггером) |
| G11 | Для fabric-tracked прогонов появился детерминированный след: `ingest` требует result-file + `--run-id`, bracket-guard отбивает голый tick (exit 2), подделка видна post-hoc (события без run_id / ledger без брекетов / нереалистичные интервалы — урок 0163) | Runtime-доказательства «агент реально запустил .cjs» вне fabric-линии нет — prompted как был |
| G12 | bracket-guard DEF-3 (DEC-DEV-0163, PR #141): для fabric-tracked линий брекет ledger start→finish→ingest **принудителен**, эскейп `--force-manual` аудируем в `why[]`; live-долг run-ledger закрыт (R10). Рекомендация судьи выполнена: reason эскейпа обязан ссылаться на существующую PA (DEC-DEV-0168) | Вне `--fabric` wiring остаётся поведенческим контрактом |
| G13 | Уточнение факта аудита: читатель заявлен — `commands/orchestrator/run.md:2` «Reads handoffs + tool-docs»; P3 живьём прогнан | Чтение prompted (LLM-инструкция), машинного подтверждения потребления tool-docs нет |

## ⬜ Открыто — с роутингом

**Tier-0 (блокеры цели «идея → прод») — отдельные substrate-gated треки, НЕ Fabric:**
- **G01** Epic E (последняя миля: CI/build, deploy/rollback, monitoring) — не существует; vision-эпик E(+F3).
- **G02** external tool → назад в `.product/` (result-ingest) — не существует; трек E15/G02.

**Кандидаты фазы 4 Fabric (старт строго по live-триггерам, EXECUTION_ROADMAP §Фаза 4):**
- **G08** авто-шов handoff→integrator:add — product-front charter (вместе с product-остатком G07).
- **G28** `expires_at`-sweeper (сейчас только inline-проверка при чтении, `artifact-validate.js:447`) — единственный остаток очереди AUDIT §6; temporal-актуатор.
- **G29** periodic stale-draft sweep — тот же temporal-актуатор.

**Пост-обязательство №4 (параллельные инициативы аудита; recon 2026-07-10 подтвердил — ничего из этого не появилось):**
- **G14** `commands/integrator/{verify,debug,replace,docs}.md` — файлов нет (Integrator Phase-7), живые ссылки на них остаются битыми (→ см. Дельту 2026-07-11); **G15** confidence-downgrade lifecycle без точки входа (зависит от G14) (→ см. Дельту 2026-07-11); **G16** `hooks/integrator/{drift-check,contract-validate}.js` — файлов нет (→ см. Дельту 2026-07-11).
- **G36** субагенты market-researcher / competitor-analyst / screen-generator — файлов нет, Deep Discovery нефункционален.
- ~~Doc-дрейфы G17/G18/G33/G35~~ — **закрыты/сужены DEC-DEV-0170** (см. таблицы выше): G18 — `integrator/update.md` Pre-flight теперь вызывает scan (SPEC §13.1 строка replace промаркирована Phase-7); G33 — ручной baseline в `verify.md` Step 4/summary заменён сверкой с генерируемым `02-commands.md`; G35 — мёртвая ссылка `disable-d7-audit` заменена честным «команда сознательно не существует»; **G17 частично** — `/ecosystem:update` Step 8 сёрфейсит условный next-step `/integrator:update --repair` (prompted; детерминированный hook = G16, Phase-7); **G21 частично** — баннеры пост-spec расширений в Product/Design SPEC (двусторонний дрейф промаркирован; вписывание в тело SPEC — отдельный doc-трек).
- **G24** session-audit opt-in per-pilot + хардкод-путь.

**D7-гигиена / без активного трека (заносится в backlog, владелец приоритизирует):**
- **G25** Pending-маркеры audit-index без обязательства прогона; **G26** feedback-intake — intake построен (0097), авто-триггера нет; **G27** patch-candidates без reminder.
- **G22** handoff-staleness на стороне Integrator: в `add.md`/`update.md` шага пересчёта хэшей нет (grep пуст), hash-логика живёт только в `hooks/product/lib/hash.js`.
- **G30** adaptive-depth классификатор без мета-верификации (watchdog G05/G06 страхует смежное — что ревью состоялось и правильным агентом, — но не классификацию depth).
- **G31** bg-rename: `bg-rename.md` явно «Atomic apply deferred к v1.1».
- **G34** guard резолвимости путей INFORMATION-MAP — скрипта нет (grep по scripts/ и workflows/ пуст).

**Upstream-долг graduation-прогона** (не G-номера, но из той же сверки): DEF-4 + ANOM-5 +
`--force-manual` reason→PA — ✅ закрыт тем же днём (DEC-DEV-0168, пост-обязательство №3).

## Короткий ответ

Из 36 разрывов аудита (после доборов 2026-07-10, DEC-DEV-0168/0170) **9 закрыты** (машинно:
G05/G06 watchdog, G19 линтер, G20 шаблон, G23 auto-install гейта, G32 атомарный аллокатор;
doc-drift: G18 scan-в-update, G33 сверка с генерируемым каталогом, G35 честное отсутствие
команды), **10 частично** — для fabric-tracked линии P3→P7 контур «сенсор→мышца» замкнут
(PA-мост + самоочистка owner-queue, bracket-guard c PA-валидируемым эскейпом, live-подтверждено)
+ G17 prompted-repair / G21 баннеры дрейфа, **17 открыты**: Tier-0 (G01 Epic E, G02
result-ingest) — отдельные substrate-gated треки; G08/G28/G29 — кандидаты фазы 4 по
live-триггерам; G14–G16/G24/G36 — пост-обязательство №4; G22/G25–G27/G30/G31/G34 — backlog
D7-гигиены на приоритизацию владельцем.

---

## Дельта 2026-07-11 (после сверки)

> **Аддитивный постскриптум** (существующие секции выше не переписаны — конвенция:
> живой статус дополняется, снапшот сверки остаётся as-was). Фиксирует сдвиг по
> Integrator Phase-7 (G14/G15/G16), случившийся ПОСЛЕ recon 2026-07-10, когда
> пост-обязательство №4 честно отмечало «ничего из этого не появилось».

**Integrator Phase-7 построен (DEC-DEV-0176, PR #156) — G14/G15/G16 закрыты:**

- **G14 → закрыт на 3/4.** Построены `commands/integrator/{verify,debug,docs}.md`;
  живые ссылки на них перестали быть битыми. Четвёртая команда — `/integrator:replace`
  — **сознательно CUT до v1.1+** (единственный установленный D2-Tech инструмент = cc-sdd,
  содержательный тест replace невозможен); bring-forward-триггер = **второй D2-Tech
  инструмент в пилоте**. Мёртвые ссылки на replace аннотированы честно.
- **G15 → закрыт.** Точка входа в confidence-downgrade lifecycle (SPEC §4.4) добавлена
  явным шагом в `debug.md`: systematic issues → роутинг в `/product:validation-tune`
  (propose confidence-downgrade). Зависимость от G14 снята.
- **G16 → закрыт по существу.** Построен `hooks/integrator/drift-check.js` (SessionStart,
  detect-only, warn-only, fail-open) + разделяемая либа `hooks/integrator/lib/drift-checks.cjs`
  (D1 semver + D2 CONTRACT_SCHEMA_VERSION + staleness `last_audit`) — проактивный слушатель
  дрейфа. Второй хук — `contract-validate.js` (PreToolUse) — **сознательно CUT до v1.1+**
  (валидация спекулятивна, нет наблюдённого класса дефекта, который она ловит и который
  пропустят drift-check+verify); bring-forward-триггер = **живой битый контракт, прошедший
  мимо drift-check/verify**.

**Runtime-валидация прогнана (DEC-DEV-0177, batch 4 смоук-планов на VM-пилоте):**
Phase-7 живьём здоров — verify/debug/docs PASS (debug попутно нашёл живой дефект). Прогон
вскрыл **DEF-SMK-1**: drift-оси D1/D2/D3 хука/либы были **слепы на реальной схеме
active-tools.yaml** — парсер ждал поле `adapter`, которого в реальной форме нет (связь
tool→adapter живёт в `CNT-*.yaml` `transformation.script`); staleness-нога при этом работала
live. Юниты дефект не ловили — фикстуры были самодельной формы.

**DEF-SMK-1 пофикшен (DEC-DEV-0178, PR #163):** adapter-резолв переведён на скан CNT-контрактов
(канон, не новое поле) + страховочная `(unattributed)`-сетка; юниты подняты на РЕАЛЬНОЙ форме
схемы (24→33). Тем самым drift-контур G16 стал видеть дрейф на реальном пилоте.

Итог по пост-обязательству №4: **G14/G15/G16 закрыты** (G14 — 3/4, replace осознанно
отложен); открытыми в №4 остаются **G24** и **G36** (Deep Discovery субагенты).
