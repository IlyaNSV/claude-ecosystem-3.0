# Чек-лист готовности к Phase 4

> **Назначение:** проверки и решения, которые нужно сделать **до** старта Phase 4 (Handoff + NFR + Product DA + Validation full).
>
> **Статус (2026-04-29):** Phase 3 прошла smoke test, патч 1.1.1 выпущен (DEC-DEV-0023). Блокер из секции A снят. Архитектурные пункты C.1-C.5 + новый D.5 + A.3 — всё ещё в ожидании.
>
> **Принцип:** не блокировать перфекционизмом, но и не пропускать критичные пункты. Каждому пункту присвоен приоритет: 🔴 блокер, 🟡 важный, 🔵 необязательный.

---

## Статус-баннер

✅ **Реализация Phase 3 завершена (DEC-DEV-0014, 2026-04-27).**
✅ **Smoke test Phase 3 проведён, патч 1.1.1 выпущен (DEC-DEV-0023, 2026-04-29).**

Что осталось до старта Phase 4:
- [x] **Реальный smoke test Phase 3** — проведён 2026-04-29 на `my-first-test` (5.5 часа сквозного прогона, 12 находок, исправления вошли в 1.1.1)
- [x] Находки smoke test разобраны; регрессии исправлены (4 hook-бага + 1 пробел в lifecycle валидации + кодификация 5 skill-конвенций + 1 решение по схеме отложено)
- [ ] Архитектурные вопросы Phase 4 решены (секция C ниже)
- [ ] Объём Phase 4 подтверждён, дисциплина scope применена
- [ ] Действие пользователя R2: `/ecosystem:update` на `my-first-test` (проверяет, что исправления 1.1.1 распространяются)
- [ ] Действие пользователя R4: повторный прогон smoke test после исправлений (валидирует F1-F5 в реальном workflow)

**Гейт Phase 3 полностью закрыт. Старт Phase 4 заблокирован только архитектурными решениями C.1-C.5 + новым D.5 + A.3.**

---

## A. Результаты smoke test Phase 3 (🟢 ЗАКРЫТО — DEC-DEV-0023)

### A.1 Реальный прогон на my-first-test

Проведён 2026-04-29: интегрированный сквозной прогон pipeline (bootstrap → Discovery → Planning → enrichment FM-001) вместо изолированных сценариев. Функционально критерии приёмки выполнены — весь поток P1.B + P2.A прогнан end-to-end.

- [x] `/product:plan` flow доведён до завершения. Находки: 8 записей DEC-PLAN в журнале решений тестового проекта; дисциплина планирования в норме.
- [x] `/product:feature FM-001` доведён до завершения (F.1-F.10). Находки: создано 23 BR + 7 SC + 7 IC + 7 VC + 3 LC + RPM; A1 auto-approve корректно сработал для LC/VC/RPM.
- [x] Извлечение BG-кандидатов — **молча упало**: TDZ-баг в `bg-extractor.js` (119 ReferenceError), 0 кандидатов извлечено. Исправление: F1 в DEC-DEV-0023.
- [x] `/product:cascade --pending` отработан — 396 записей (большинство ложные срабатывания). Исправление: F2/F3 forward-driven + дедупликация в DEC-DEV-0023.
- [x] Проверка D2 overrides — в smoke не отработана (сценариев override не возникло); отложена до следующего пилота.
- [x] Оркестрация DA через хуки — отработала 55 раз корректно, находки собраны inline в DEC-PLAN-006 (4 важных, 5 обсуждение).

**Приёмка:** функционально прогнано 4+ сценария; патч 1.1.1 закрывает выявленные регрессии. Phase 3 поставлена → Phase 4 разблокирована.

### A.2 Ретроактивная запись в DEV_JOURNAL

- [x] **DEC-DEV-0023** — результаты smoke test Phase 3 зафиксированы (2026-04-29). Записаны уроки + 12 находок + пакет исправлений Path Z + таблица refinement.

### A.3 Унаследованные проблемы из DEC-DEV-0013 B.1 (всё ещё открыты)

- [ ] Неканонические поля в `skills/product/hypothesis-formulation.md` (по наблюдению DEC-DEV-0013 B.1) — закрыть или явно отложить? `success_threshold` вместо канонического `target_value`; в шаблоне отсутствуют `segment` / `value_proposition`.
- **Замечание:** в smoke test DEC-DEV-0023 не всплыло (существующие HYP из прошлой сессии — frontmatter повторно не валидировался). Нужно решить до старта Phase 4 либо явно зафиксировать отсрочку.

---

## B. Соответствие deliverables Phase 4 (по ROADMAP)

Объём Phase 4 по ROADMAP (~10 файлов; **состав без изменений** после DEC-DEV-0023, но появились новые входные данные и ограничения):

**commands/product/:**
- [ ] `handoff.md` — D1 modes (draft/production), D2 overrides
- [ ] `validate.md` — полная валидация по требованию. **Унаследовать паттерн auto-purge из `artifact-validate.js` (DEC-DEV-0023 F5).**
- [ ] `cleanup.md` — детекция orphan'ов V-15 (`--dry-run`). **Рассмотреть интеграцию с `/product:cascade --pending --revalidate` (Q7) + чистка stale-записей в `validation-pending`** — см. D.5 ниже.
- [ ] `da-review.md` — ручной триггер F.9 (Mode: full по обновлённому `devils-advocate.md`). **Схема вывода кодифицирована — использовать структурированный YAML-блок `da_findings:` по разделу «Structured DA findings format» в `feature-session.md` (DEC-DEV-0023 F8).**
- [ ] `clarify.md` — канал вопросов получателя
- [ ] `nfr-review.md` — F.5a Ask/Define. **Источник входа кодифицирован — потреблять существующие артефакты `NOTE-NNN` с `promote_target: NFR` (Q4 NOTE creation guidance в `feature-session.md`).**
- [ ] `nfr-upgrade-tier.md` — пакетный пересмотр при смене tier

**skills/product/:**
- [ ] `handoff-generator.md` — 13 секций, mode-aware DoR (D1), вычисление хеша
- [ ] `nfr-review.md` — интеграция sanity ranges, guardrails. **Потреблять очередь NOTE-NNN с `promote_target=NFR` по Q4.**
- [ ] `product-da-review.md` — вызывает business DA agent (Mode: full), обрабатывает находки. **Вывод структурирован по схеме F8.**
- [ ] `validation-runner.md` — tier-aware (B1), quiet-mode-aware (B2), 5 точек выполнения. **Паттерн auto-purge (F5) уже в `artifact-validate.js` — runner расширяет, не переизобретает.**

**hooks/product/:**
- [ ] `product-handoff-gate.js` — PreToolUse-блокировка без валидного handoff (по SPEC §6.6). **ОБЯЗАН пройти `verify-hooks.js` smoke до коммита (phase-closure Шаг 3 + pre-commit gate по DEC-DEV-0023 F6/R3).**

### B.1 Quality gate для хуков (добавлено в DEC-DEV-0023)

Все новые хуки Phase 4 (на текущий момент запланирован: `product-handoff-gate.js`) должны:

1. Пройти `node dev/meta-improvement/scripts/verify-hooks.js` (smoke runner) — exit 0 + отсутствие фатальных паттернов в stderr.
2. Если установлен pre-commit (`bash dev/meta-improvement/scripts/install-pre-commit.sh`) — он автоматически блокирует коммит, если verify-hooks падает.
3. Шаг 3 «Hook runtime smoke (≤5 мин)» в phase-closure ритуале запускает тот же verify после завершения реализации Phase 4.

Чтобы добавить новый хук в массив TEST_CASES в `smoke-hooks.js` — см. [smoke-hooks.js TEST_CASES](meta-improvement/scripts/smoke-hooks.js).

---

## C. Архитектурные вопросы Phase 4 (🟡 важно)

### C.1 Вычисление хеша handoff на CRLF

**Проблема:** V-H-04 — детекция drift по SHA-256; авто-конвертация CRLF на Windows может вызывать ложные срабатывания drift detection.

**Решить до реализации:**
- [ ] Вычисление хеша нормализует line endings (только LF)? Или хеш включает CRLF?
- [ ] Тест на Windows + Unix для подтверждения консистентности хеша

### C.2 Жёсткость enforcement sanity ranges для NFR

**Проблема:** В spec NFR.md §5 прописаны sanity-check диапазоны по tier. Workflow F.5a предлагает дефолты; пользователь может переопределить с rationale (`sanity_check: overridden`).

**Решить до реализации:**
- [ ] Workflow для override строгий (требовать ревью Product DA для каждого переопределённого NFR)? Или informational warning достаточно?
- [ ] Авто-определение tier — читать `RM.current_phase` или явно спрашивать у пользователя при каждом вызове F.5a?

### C.3 Интеграция ручного `/product:da-review` Mode: full

**Проблема:** Обновлённый `devils-advocate.md` поддерживает Mode: full (всегда 6-lens). Команда `/product:da-review` (Phase 4) должна корректно конструировать brief.

**Статус решения (DEC-DEV-0023 F8):** Схема вывода известна — структурированный YAML-блок `da_findings:` с обязательным `revisit_trigger` для accepted/deferred резолюций. Задокументировано в [skills/product/feature-session.md](../skills/product/feature-session.md), раздел «Structured DA findings format в decision journal».

**Решить до реализации:**
- [ ] Формат brief для ручного режима — симметричный hook-driven adaptive? Или специфичный шаблон Mode: full?
- [ ] Куда писать вывод — в тот же `.product/.da-findings/` или в отдельный (например, `.da-findings/manual/`)?

### C.4 Validation runner skill — 5 точек выполнения

**Проблема:** В `validation.md` §3 перечислены 5 точек выполнения (inline / approve gate / handoff / on-demand / periodic). Phase 4 реализует `/product:validate` для on-demand. Остальные точки уже покрыты хуками.

**Решить до реализации:**
- [ ] Validation runner skill читает V-* правила из каталога `validation.md` программно? Или хардкодит список правил?
- [ ] Формат отчёта — JSON + markdown (по примеру в `validation.md` §10.3)?

### C.5 Cleanup orphan detection — связка с Phase 6 Design + чистка pending (расширено в DEC-DEV-0023)

**Проблема:** Детекция orphan'ов V-15 включает MK/DS/NM (артефакты Phase 6). Phase 4 `/product:cleanup` поставляется без них (Phase 6 условная).

**Расширение DEC-DEV-0023:** cleanup также должен обрабатывать stale-записи в:
- `.product/.pending/cascade-pending.yaml` — авто-чистка устаревших записей cascade (либо вызывать `/product:cascade --pending --revalidate` под капотом, либо иметь собственную purge-логику).
- `.product/.pending/validation-pending.yaml` — проверять, что auto-purge применён (паттерн F5); сигнализировать о несоответствиях.
- `.product/.pending/da-pending.yaml` — флагировать записи для уже active артефактов (DA уже обработала).

**Решить до реализации:**
- [ ] Phase 4 cleanup исключает проверку MK/DS/NM; Phase 6 расширяет? Или условный флаг в команде?
- [ ] Cleanup вызывает `/product:cascade --pending --revalidate` как под-шаг? Или собственная purge-логика?
- [ ] Pending hygiene в cleanup = обязательное (поведение по умолчанию) или opt-in (флаг `--pending-hygiene`)?

### C.6 Архитектура bootstrap update mechanism — ✅ ЗАКРЫТО (DEC-DEV-0020, 2026-04-28)

**Проблема (DEC-DEV-0019):** Stock `/ecosystem:bootstrap` на существующем pilot-проекте имел 4 архитектурных проблемы — контаминация dev-only файлами, `cp -rn` только дополняет, перезапись `manifest.yaml` ломает auto-registration хуков, дыра в UX при re-install.

**Решение: Path Y реализован заранее** (по запросу пользователя «закрыть сейчас, не подмешивать в Phase 4»).

Standalone-команда `/ecosystem:update` поставлена (коммит `<TBD>`):
- Allowlist-only sync (поддиректории: `commands/`, `skills/`, `agents/`, `hooks/`, `docs/`, `templates/`, `output-styles/`; root-файлы: README, BOOTSTRAP, CHANGELOG, ROADMAP, install.sh/.ps1, .env.template, gitignore.template)
- Sync в стиле rsync (удаляет obsolete + копирует свежее)
- Перезапись `manifest.yaml` + повторное выведение секции hooks в `settings.json` (раздел permissions сохраняется дословно)
- Бэкап по умолчанию: `.claude/` → `.claude-backup-<timestamp>/`
- Зона never-copy явно прописана (CLAUDE.md в root, DEV_JOURNAL.md, dev/, INSTALL-HUMAN.md) — закрывает контаминацию из Finding A
- Флаг `--dry-run` для предпросмотра перед apply
- В `bootstrap.md` добавлена рекомендация использовать `/ecosystem:update` для re-install (закрывает дыру в UX из Finding D; legacy опция (b) Merge помечена как DEPRECATED)

**Статус для kickoff Phase 4:** РАЗБЛОКИРОВАНО. Deliverables Phase 4 (`handoff.md`, NFR-команды, validation runner и т.д.) дойдут до существующих пилотов через `/ecosystem:update`. C.6 больше не блокер.

**Осталось:** прогон теста на `my-first-test` (интерактивная сессия пользователя по инструкциям в DEC-DEV-0020 Шаг 5). После успешного теста пункт полностью закрыт.

---

## D. Дисциплина scope для Phase 4 (🟡 важно — против over-engineering)

### D.1 Handoff modes (D1) — оба режима поставляем?

В ROADMAP сказано про оба: `--mode draft` (3 блокера) и `--mode production` (8 блокеров). Оба должны работать, чтобы модификация D1 считалась полной.

- [ ] Оба режима реализованы и протестированы? Или сначала только production, draft в minor follow-up?

### D.2 NFR Review — разделение F.5a.0 Ask + F.5a.1 Define

По `processes.md §3.2` F.5a — две фазы:
- F.5a.0 Ask (обязательная)
- F.5a.1 Define (условная — по выбору пользователя [Y])

- [ ] Обе фазы поставляем в Phase 4? Или сначала только Ask, Define через отдельную команду?

### D.3 Product DA Review F.9 — отдельная команда `/product:da-review`

DA по каждому BR/IC уже происходит автоматически (Phase 3 hooks). F.9 = явный pre-handoff ревью на уровне FM (Mode: full).

- [ ] F.9 — ручной триггер через `/product:da-review FM-<NNN>` в Phase 4? Или авто-триггер перед `/product:handoff`?

### D.4 Validation full — 33 V-* + 10 V-H-* + 8 V-MK-*?

Phase 4 `/product:validate --deep` выпускает «все V-*». Phase 6 покрывает V-MK-* (условный Design module).

- [ ] Phase 4 поставляет V-* + V-H-*; V-MK-* пропускаются с graceful note?

### D.5 Интеграция cleanup и pending hygiene (добавлено в DEC-DEV-0023)

`/product:cleanup` (Phase 4) и `/product:cascade --pending --revalidate` (1.1.1, DEC-DEV-0023 Q7) пересекаются по hygiene-домену. Нужно решение:

- [ ] **Вариант A — единый sweep:** `/product:cleanup` под капотом вызывает cascade revalidate + обрабатывает purge `validation-pending` + детекцию orphan'ов в одном вызове. Пользователь периодически запускает cleanup.
- [ ] **Вариант B — раздельные обязанности:** `/product:cleanup` = только детекция orphan'ов; cascade hygiene остаётся в `/product:cascade --pending --revalidate`. Пользователь по дисциплине запускает обе команды.
- [ ] **Вариант C — гибрид:** в cleanup есть флаг `--pending-hygiene`; по умолчанию = только orphan'ы (быстро); флаг включает полный sweep.

Рекомендация на 2026-04-29: **Вариант C** — гибкость без принудительного бандла. Выбрать явно на kickoff Phase 4.

### D.6 Отсрочки до v1.1+ — Phase 4 ими не ограничена (добавлено в DEC-DEV-0023)

Следующие пункты отложены до v1.1+; Phase 4 НЕ должна пытаться их закрыть:

- **Схема BR.feature** (DEC-DEV-0023 Q2) — текущий скаляр `feature: FM-NNN` для Phase 4 работает. v1.1 рассмотрит варианты global/array/extends (триггер для bring-forward: вторая FM enrichment с болью переиспользования общих правил).
- **Reverse-driven cascade — дополнительные правила ревью** (например, изменение BR → LC.rules содержит BR → ревью V-06) — v1.2. cascade-check.js в Phase 4 остаётся forward-driven; ручной `/product:cascade --pending --revalidate` остаётся обходом, если пользователь явно хочет покрыть reverse-кейсы.
- **Расширение smoke runner для новых хуков** — добавление записи в массив TEST_CASES в `dev/meta-improvement/scripts/smoke-hooks.js` (мало усилий, делается при добавлении хука).

---

## E. Гейт пилотной валидации (🔴 блокер — самый важный пункт)

### E.1 Реальные `/product:plan` + `/product:feature` на my-first-test

По плану Phase 3.I — см. секцию A выше.

### E.2 Решение: продолжать с Phase 4 как есть или пересматривать?

**По результатам smoke test:**
- [ ] Если 4+ сценариев проходят — переходить к Phase 4 по чек-листу ниже
- [ ] Если 3 или меньше — разобрать находки, исправить регрессии Phase 3, повторить smoke до Phase 4
- [ ] Если smoke выявит необходимость архитектурного переосмысления — эскалировать; возможно изменение scope Phase 4

---

## F. Мета (🔵 необязательно)

### F.1 Актуализация записей в memory

Обновить memory после Phase 3 + smoke test:
- [x] `project_ecosystem_status.md` — обновлено 2026-04-29 (DEC-DEV-0023 P3); отражает: Phase 3 прошла smoke + 1.1.1 + Phase 4 разблокирована
- [x] `feedback_methodology.md` — добавлен пункт 4 (smoke runner для хуков обязателен в pre-commit, по DEC-DEV-0023)
- [x] `MEMORY.md` — индекс обновлён
- [ ] `project_ecosystem_architecture.md` — добавить архитектурные паттерны Phase 3 (A1 auto-approve, оркестрация DA через stderr, scope cascade — только V-11 forward-driven после DEC-DEV-0023, расположение журнала решений, схема structured DA findings)

### F.2 Дисциплина CHANGELOG vs DEV_JOURNAL (продолжение)

- [ ] Каждое значимое исправление/решение в Phase 4 → запись в DEV_JOURNAL (по правилам CLAUDE.md)
- [ ] CHANGELOG обновляется только при release-worthy изменениях (например, 1.2.0 после Phase 4)

### F.3 Проверка dogfood

- [ ] Пересмотреть — нужен ли самой Ecosystem 3.0 свой `.product/`? Phase 3 получилась объёмной; могло бы дать пользу явное FM-* для commands/skills/hooks. Out-of-scope для Phase 4; пометить для будущего рассмотрения.

### F.4 Ревью приоритетов backlog'а v1.1

После 2-3 реальных Discoveries / Features:
- [ ] Atomic mass-rename — проверить частоту (5+ переименований в месяц?)
- [ ] Subagents в Deep mode — упёрлись в лимиты Quick mode?
- [ ] Полный BFS cascade auto-fix — проявляется ли паттерн из резолюций cascade-pending?
- [ ] Bundle approve UX — достаточный объём, чтобы инвестировать в UX?

---

## G. Definition of Done для Phase 4

Phase 4 считается «done», когда:
- [ ] `/product:handoff FM-<NNN> --mode draft` → status: partial — handoff для PoC (3 блокера)
- [ ] `/product:handoff FM-<NNN> --mode production` → все 8 блокеров обеспечены
- [ ] Детекция drift по SHA-хешу работает между `.product/` и handoff (CRLF-safe)
- [ ] `/product:validate --deep` покрывает V-01..V-16 + V-H-01..V-H-10 (V-MK-* отложены до Phase 6)
- [ ] `/product:da-review FM-<NNN>` запускает business DA в Mode: full
- [ ] Находки DA пишутся в `.product/.da-findings/`
- [ ] Разделение F.5a.0 Ask + F.5a.1 Define работает; sanity ranges обеспечены
- [ ] `approve_overrides` (D2) работают — временный пропуск blocker'а с rationale
- [ ] **Smoke test Phase 4:** прогнать `/product:handoff` + `/product:da-review` + `/product:validate` на `my-first-test` FM-001 (если предусловие smoke 3.I выполнено)
- [ ] DEV_JOURNAL обновлён: находки и ключевые решения Phase 4
- [ ] CHANGELOG обновлён ([1.2.0] или аналог)

---

## Совет: как пользоваться этим чек-листом

1. **Сначала секция A** (smoke test Phase 3). Без результатов — Phase 4 не разблокирована.
2. **Потом секция C** (архитектурные вопросы) — каждый пункт = решение, которое надо принять и зафиксировать в DEV_JOURNAL как DEC-DEV-NNNN.
3. **Потом секция D** (дисциплина scope) — отрезать всё, что не must-have для Phase 4 done.
4. **Секция E.2** — явное решение по результатам smoke test.
5. **B и F** — параллельно, по мере необходимости.

**Когда всё ☑ → начинать реализацию Phase 4.**

**Если в процессе Phase 4 вскроется что-то, что должно было быть здесь** — добавь сюда сейчас (для готовности Phase 5) + запиши в DEV_JOURNAL.
