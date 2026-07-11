# Phase 7 Smoke Test Plan — Integrator maintenance (runtime, pilot session)

> **Статус:** ✅ **ПРОГНАН 2026-07-11 и АРХИВИРОВАН** (smoke-batch, DEC-DEV-0177; вердикты судьи — `dev/gates/SMOKE_BATCH_2026-07-11_BRIEF.md` §Outcome): **S1/S2/S3/S5 PASS · S4 PARTIAL** (staleness-нога хука live-сработала в реальной сессии, drift-ось слепа — **DEF-SMK-1**, фикс follow-up'ом). Debug попутно нашёл живой дефект (ложный C-03 на FM-006). Phase 7 = built **и validated** (с оговоркой S4/DEF-SMK-1).
> Изначально: ⏳ QUEUED — runtime smoke на пилоте `my-first-test` (VM), следующий VM-визит после доставки версии с Phase 7.
> **Предусловие:** `/ecosystem:update` пилота до версии, содержащей Phase 7; активный инструмент cc-sdd (есть с Phase 5).
> **Дисциплина:** live-run-validation класс B (механика по брифу); executor-сессии bypass; канон не править во время прогона; дефекты фиксировать письменно, чинить после.
> **Static-эквиваленты уже покрыты** юнитами/wiring в `npm run verify` (`tests/integrator/`) — этот план только про runtime-поведение, которое статикой не поймать.

## Сценарии

### S1 — `/integrator:verify` на реальном состоянии
Прогнать на пилоте (cc-sdd установлен, контракты живые). Ожидаемо: per-tool отчёт (tool доступен / контракты валидны / pmo-mapping без orphan / drift D1-D3), рекомендации вместо самопочинки, `last_audit` штампован в `active-tools.yaml`, session-marker снят в Final. FAIL-класс: команда чинит что-то сама или пишет вне Integrator-зоны.

### S2 — `/integrator:debug` на реальном/историческом симптоме
Субъект — реальная запись project-journal (например, исторический drift-fix) или живой дефект, если всплывёт. Ожидаемо: journal lookup → гипотеза → предложение → approve-gate ДО любых правок → journal entry `DEC-INT-NNNN` (в т.ч. при отмене). Проверить G15-роутинг: на systematic-классе команда предлагает `/product:validation-tune` propose downgrade (не делает сама).

### S3 — `/integrator:docs --tool cc-sdd`
Ожидаемо: `.claude/integrator/tool-docs/cc-sdd.md` по структуре SPEC §14.2, universal English. Затем: вписать вручную секцию с маркером `<!-- manual: do not regenerate -->`, перегенерировать — manual-блок пережил реген (§14.4).

### S4 — `drift-check.js` SessionStart hook
(a) Свежая сессия в пилоте при чистом состоянии → хук молчит (no-op, не шумит каждую сессию). (b) Срежиссировать drift в изолированной ветке пилота (правка `CONTRACT_SCHEMA_VERSION` в instance-адаптере) ИЛИ staleness (last_audit >90d в фикстуре) → новая сессия получает additionalContext-ноту с рекомендацией `/integrator:verify`. (c) `INTEGRATOR_DRIFT_CHECK=0` → молчит. FAIL-класс: хук блокирует/замедляет старт сессии, шумит на чистом состоянии.

### S5 — отказы честные
`/integrator:verify` и `/integrator:docs` в проекте БЕЗ Integrator-состояния (нет `active-tools.yaml`) → честный отказ «Integrator не активен», не пустой отчёт/файл.

## Judge
Нейтральный судья (opus, фиксированная модель) по транскриптам; executor не видит этот план (промпты — verbatim из брифа прогона, отдельно пре-регистрируемого).
