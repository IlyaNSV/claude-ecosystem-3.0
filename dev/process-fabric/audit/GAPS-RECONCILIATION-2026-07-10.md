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
| ✅ **Закрыт машинно** | 6 | G05 G06 G19 G20 G23 G32 |
| 🟡 **Частично закрыт / существенно сужен** | 8 | G03 G04 G07 G09 G10 G11 G12 G13 |
| ⬜ **Открыт** | 22 | G01 G02 G08 G14–G18 G21 G22 G24–G31 G33–G36 |

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
| G03 | Для fabric-tracked линий PA-канал получил слушателя end-to-end: human-gate → каноническая PA-запись + owner-queue, `pa-scan [--tick]` (done→tick, dismissed→surfaced), SessionStart-инжект статуса (DEC-DEV-0155; live: PA-045, критерий G-C) | PA-трафик **вне** fabric-инстансов (эскалации P2–P7 без `--fabric`, product-routed drifts) — по-прежнему write-only. Оговорка ANOM-5 (owner-queue append-only, без dequeue → stale false-positive) → **пост-обяз. №3** |
| G04 | Generic await→resume для fabric-линии работает: parked-состояния + resume-события + PA-мост (live: `awaiting_product` PA-051/052 → консилиум → resume, DEC-DEV-0162) | OD7 capability-request await→resume (P5/P7 после решения Integrator) как таковой не построен → **пост-обяз. №4** |
| G07 | Сегмент P3→P7 накрыт state-machine: charter `feature-production-line` + prescriptions + инжект статуса — «пропущенный шаг» теперь виден машинно | Product-сегмент (init→plan→feature→handoff) — всё ещё текстовые «Next:»; charter №2 product-front срезан (2e) → **фаза 4 по live-триггеру** |
| G09 | Orphan-статус снят: первый живой потребитель `autonomy-policy.cjs` = fabric-engine (`fabric-engine.cjs:43`), `--autonomy L0\|L1` сквозной в `run.md`; чек-лист F1 §6 закрыт 6/6 (DEC-DEV-0154) | Полное F2-wiring (автономия на всех гейтах экосистемы) — отдельный vision-трек, coordination-gated |
| G10 | Live-прогон 0162 снял «не подтверждён живьём»: P3 `batch-features-to-cc-sdd` → P4 (поймал 2 реальных LOW-дрейфа BR-081) → P5 (19/19 тасков, run-id-backed) → P6×2 NO-GO→GO (добор G-B, 0163) на пилоте FM-006 | P7 probe DEF-4 (false-negative на pnpm-monorepo, PA-056) → **пост-обяз. №3**; ветка `runtime_gate_retry`/`evt:env.up` честно live-невалидирована |
| G11 | Для fabric-tracked прогонов появился детерминированный след: `ingest` требует result-file + `--run-id`, bracket-guard отбивает голый tick (exit 2), подделка видна post-hoc (события без run_id / ledger без брекетов / нереалистичные интервалы — урок 0163) | Runtime-доказательства «агент реально запустил .cjs» вне fabric-линии нет — prompted как был |
| G12 | bracket-guard DEF-3 (DEC-DEV-0163, PR #141): для fabric-tracked линий брекет ledger start→finish→ingest **принудителен**, эскейп `--force-manual` аудируем в `why[]`; live-долг run-ledger закрыт (R10) | Вне `--fabric` wiring остаётся поведенческим контрактом. Рекомендация судьи: `--force-manual` reason → ссылка на PA + валидация → **пост-обяз. №3** |
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
- **G14** `commands/integrator/{verify,debug,replace,docs}.md` — файлов нет (Integrator Phase-7), живые ссылки на них остаются битыми; **G15** confidence-downgrade lifecycle без точки входа (зависит от G14); **G16** `hooks/integrator/{drift-check,contract-validate}.js` — файлов нет.
- **G36** субагенты market-researcher / competitor-analyst / screen-generator — файлов нет, Deep Discovery нефункционален.
- Doc-дрейфы: **G17** (update→repair без хука), **G18** (`integrator:scan` не вызывается из update/remove — grep пуст), **G21** (Product/Design SPEC не знают Epic A/B/D), **G33** (`verify.md:50` ручной baseline «~22» параллельно с автогенерируемым `02-commands.md`), **G35** (`disable-d7-audit` — файла нет, есть только enable).
- **G24** session-audit opt-in per-pilot + хардкод-путь.

**D7-гигиена / без активного трека (заносится в backlog, владелец приоритизирует):**
- **G25** Pending-маркеры audit-index без обязательства прогона; **G26** feedback-intake — intake построен (0097), авто-триггера нет; **G27** patch-candidates без reminder.
- **G22** handoff-staleness на стороне Integrator: в `add.md`/`update.md` шага пересчёта хэшей нет (grep пуст), hash-логика живёт только в `hooks/product/lib/hash.js`.
- **G30** adaptive-depth классификатор без мета-верификации (watchdog G05/G06 страхует смежное — что ревью состоялось и правильным агентом, — но не классификацию depth).
- **G31** bg-rename: `bg-rename.md` явно «Atomic apply deferred к v1.1».
- **G34** guard резолвимости путей INFORMATION-MAP — скрипта нет (grep по scripts/ и workflows/ пуст).

**Upstream-долг graduation-прогона** (не G-номера, но из той же сверки): DEF-4 + ANOM-5 +
`--force-manual` reason→PA — уже оформлены как пост-обязательство №3.

## Короткий ответ

Из 36 разрывов аудита **6 закрыты машинно** (G05/G06 watchdog, G19 линтер, G20 шаблон,
G23 auto-install гейта, G32 атомарный аллокатор), **8 частично закрыты Fabric'ом** — для
fabric-tracked линии P3→P7 контур «сенсор→мышца» замкнут (PA-мост, bracket-guard,
owner-queue, live-подтверждено), **22 открыты**: Tier-0 (G01 Epic E, G02 result-ingest) —
отдельные substrate-gated треки; G08/G28/G29 — кандидаты фазы 4 по live-триггерам;
G14–G18/G21/G24/G33/G35/G36 — пост-обязательство №4; G22/G25–G27/G30/G31/G34 — backlog
D7-гигиены на приоритизацию владельцем.
