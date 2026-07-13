# Context-audit D6 — Tech Debt (побочный улов зондов)

> **Источник:** контекст-аудит DEC-DEV-0197, решение **D6** ([`dev/context-audit/SEAM.md`](../context-audit/SEAM.md) §3 — «в бэклог отдельными задачами»). Первичное наблюдение — [`dev/context-audit/REPORT.md`](../context-audit/REPORT.md) §«Побочный улов — три реальных дефекта, которых никто не искал» (строки 158-162).
>
> **Контекст:** это **не** отложенная фича и **не** находка по фазе. Три реальных дефекта, вскрытых зондами контекст-аудита (P1-P5) как побочный улов — их никто не искал, и ни один из них не был заведён нигде до 2026-07-13 (grep по `v1_1_backlog.md` / ROADMAP / DEV_JOURNAL / `deferred/` / `gates/` → 0). Аудит их **не чинил** осознанно: фикс каждого — отдельная работа с тестами.
>
> **Статус позиций:** `[OPEN]` / `[FIXED]` / `[DEFERRED]`. При взятии в работу — обновить статус + ссылку на коммит/PR/DEC-DEV и запись в «Журнале статусов».
>
> **Координаты проверены** 2026-07-13 на ветке `feat/context-audit-enforcement` (перечитаны файлы, не пересказ разведки).

---

## Как читать

- **ID** — по конвенции репо `DEF-<TRACK>-<N>` (как `DEF-SMK-1`, `DEF-OD7-1..3`). Track `CTX` = context-audit.
- Каждая запись самодостаточна: координаты, **последствие** (почему это дефект, а не «несоответствие»), набросок фикса, связи. Цель — чтобы долг можно было взять в работу **не восстанавливая контекст аудита**.
- **DEF-CTX-2 и DEF-CTX-3 связаны** — см. «Связь» в обеих; порядок работ имеет значение.

---

## Errors for fix

### DEF-CTX-1 — `[OPEN]` NFR: enum-дрейф спек↔скилл + примеры нарушают собственную схему + нет enforcement

**Что наблюдается.** Три слоя одного дефекта вокруг NFR-фронтматтера:

1. **Enum-дрейф.** [`docs/pmo/artifacts/NFR.md:71`](../../docs/pmo/artifacts/NFR.md) держит `sanity_check: passed | overridden | failed`. [`skills/product/nfr-review.md:203`](../../skills/product/nfr-review.md) объявляет `sanity_check: failed` **НЕ каноничным** (per DEC-DEV-0025 C.2 + Ambiguity 9): «runtime использует только `passed | overridden`; state `failed` deprecated (legacy NFRs treat как `overridden` с empty rationale + backfill prompt)». Спек и скилл расходятся буквально в enum'е.
2. **Примеры нарушают собственную схему.** `NFR.md:73` объявляет `confidence: high | medium | low` **обязательным** (C2 modification). Оба «Good»-примера внутри самой `NFR.md` — `:244` «Good (MVP uptime)» (фронтматтер `:257`) и `:313` «Good (MVP performance, per feature)» (фронтматтер `:326`) — поля `confidence` **не содержат**.
3. **Машинного enforcement нет.** [`docs/pmo/validation.md:373`](../../docs/pmo/validation.md) V-18 (per-type frontmatter schema conformance) покрывает только IC/BR/SC — `validation.md:376` «Artifacts affected: IC-*, BR-*, SC-*». NFR в scope не входит ⇒ **ни один** из двух дрейфов выше не ловится `artifact-validate.js`.

**Почему это дефект (последствие).** `NFR.md` — канонический документ типа: из него пишут скиллы, на него смотрит человек/AI при ручном авторинге, из него копипастят примеры. Сейчас он (а) разрешает состояние, которое runtime считает мёртвым, и (б) сам себя не соблюдает в примерах, которые копируют. Единственный автоматический сторож фронтматтера (V-18) на NFR не смотрит. Итог: NFR, созданный **строго по спеку и его же примеру**, проходит валидацию с `sanity_check: failed` и без обязательного `confidence` — и расхождение всплывает, только если кто-то откроет скилл. Это ровно тот класс drift'а, который DEC-DEV-0064 закрывал для IC (сигнатура `type=invariant` рецидивировала across сессий) — но для NFR сторож не поставлен.

**Набросок фикса** (порядок важен — сперва решить, что канон):

1. **Решить, кто прав** — `failed` жив или мёртв. По DEC-DEV-0025 runtime = `passed|overridden` ⇒ правится **спек**: `NFR.md:71` → `sanity_check: passed | overridden`, плюс строка про legacy-миграцию (`failed` ⇒ трактовать как `overridden` с пустым rationale + backfill-промпт) — формулировка уже есть в `nfr-review.md:203`.
2. **Починить оба примера** (`NFR.md:257`, `:326`): добавить `confidence` (+ `confidence_notes`, если `confidence != high`, per `NFR.md:74`). Заодно сверить **остальные** поля примеров против схемы `NFR.md:59-79` — проверялись только `confidence` / `sanity_check`, полного прохода по схеме не делали.
3. **Расширить V-18 на NFR** (`docs/pmo/validation.md:373-380` + `hooks/product/artifact-validate.js`): `type: non-functional-requirement`; `sanity_check ∈ passed|overridden`; `sanity_check=overridden ⇒ override_rationale` непустой; `confidence ∈ high|medium|low`; `confidence != high ⇒ confidence_notes`. Тир — 🟡 Warning, как у остальных V-18 (не блокировать, override-aware).
4. Если меняется список типов в scope V-18 — прогнать count-sweep (`node dev/meta-improvement/scripts/check-counts.js`) per harness-contract.

**Связь.** Самостоятельный; с DEF-CTX-2/3 не связан.

**Severity.** 🟡 Warning — тихий drift без enforcement, растёт с каждым новым NFR. Не 🔴 потому, что NFR в пилоте практически не создавались (`NFR.md` — **0 чтений за 69 сессий**, зонд P3 контекст-аудита), т.е. дефект пока не успел размножиться.

**Происхождение.** DEC-DEV-0197 / D6 — побочный улов зонда P3 (`REPORT.md:152`, `:160`).

---

### DEF-CTX-2 — `[OPEN]` `enabled_when` — мёртвое поле схемы манифеста хуков

**Что наблюдается.**

- **Задокументировано** в шапках-схемах обоих манифестов: [`hooks/product/manifest.yaml:16`](../../hooks/product/manifest.yaml) и [`hooks/orchestrator/manifest.yaml:17`](../../hooks/orchestrator/manifest.yaml) — `# enabled_when: <string>  # optional: "always" | "has_ui" | ...; default "always"`.
- **Один раз фактически проставлено:** `hooks/orchestrator/manifest.yaml:34` — `enabled_when: always`.
- **Не читается никем.** `grep -rn enabled_when` по репо (вне `.claude/worktrees/*` — там копии тех же файлов, и вне доков самого аудита): попадания **только** в этих двух манифестах. Ни одного читателя в коде (`.js` / `.cjs`), ни одного упоминания в `commands/ecosystem/bootstrap.md` и `commands/ecosystem/update.md` (grep → **0 в обоих**).
- **Схема bootstrap'а поле не знает:** `commands/ecosystem/bootstrap.md:435` перечисляет поля манифеста, которые Bootstrap реально парсит — `version`, `module`, `hooks[]` с `id`, `file`, `events[]`, `description`. `enabled_when` там **отсутствует**.

**Почему это дефект (последствие).** Мёртвое поле схемы **хуже отсутствующего**: оно задокументировано в шапке как поддерживаемое — с enum'ом значений и дефолтом — и один раз проставлено, т.е. выглядит рабочим. Следующий контрибьютор, которому понадобится условная регистрация хука (например, `has_ui` для design-хуков), поверит шапке, проставит `enabled_when: has_ui` — и получит **тихий no-op**: хук зарегистрируется всегда, без единого сообщения об ошибке. Дефект молчит ровно до момента, когда на поле впервые понадеются.

**Набросок фикса** — развилка, решать при взятии в работу:

- **Вариант A (дешёвый; дефолт при отсутствии спроса на условную регистрацию):** удалить `enabled_when` из шапок обеих схем (`hooks/product/manifest.yaml:16`, `hooks/orchestrator/manifest.yaml:17`) и снять единственное употребление (`hooks/orchestrator/manifest.yaml:34`). Схема снова описывает ровно то, что парсится. Риск нулевой — потребителей поля нет.
- **Вариант B (если условная регистрация реально нужна):** реализовать чтение в `bootstrap.md` Step 6b (`:433-461`) и `update.md` Step 6 (`:771-787`) — пропускать хуки с невыполненным условием; добавить поле в список парсимых (`bootstrap.md:435`); **определить вычислимый источник условий** (`has_ui` — откуда берётся? `.claude/product.yaml`? наличие `.product/mockups/`? — сейчас не определено нигде).

**Связь.** **Связан с DEF-CTX-3.** `enabled_when` — ровно тот «флаг отключения хука», на котором prune-асимметрия bootstrap'а даёт тихий no-op: даже будучи реализованным (вариант B), на bootstrap-пути он **не смог бы снять** уже зарегистрированную запись из `settings.json`. ⇒ Вариант B **без** фикса DEF-CTX-3 = починка наполовину: на update-пути хук выключится, на bootstrap-пути продолжит стрелять.

**Severity.** 🟡 Warning — сегодня на поле никто не полагается (0 потребителей); стреляет при первой же попытке им воспользоваться.

**Происхождение.** DEC-DEV-0197 / D6 — побочный улов зондов контекст-аудита (`REPORT.md:161`).

---

### DEF-CTX-3 — `[OPEN]` prune-асимметрия: `update` re-derive'ит записи хуков, `bootstrap` делает additive union без prune

**Что наблюдается.**

- [`commands/ecosystem/update.md:771`](../../commands/ecosystem/update.md) Step 6 «Re-derive `.claude/settings.json` hooks section (pattern-preserving merge)»: шаг 3 (`:777`) **re-derive**'ит ecosystem-owned записи из манифестов; шаг 4 (`:780-782`) сохраняет verbatim только **не**-ecosystem записи (pattern: `^node \.claude/hooks/(product|integrator|ecosystem|design|orchestrator)/` ⇒ ecosystem-owned); шаг 5 (`:783-786`) — union + dedupe. ⇒ ecosystem-запись, **исчезнувшая из манифеста, исчезает и из `settings.json`**. Прунинг ecosystem-зоны есть (неявный — через re-derive).
- [`commands/ecosystem/bootstrap.md:427`](../../commands/ecosystem/bootstrap.md) Step 6b (шаги на `:433-461`): шаг 4 (`:442`) — «Read existing `.claude/settings.json` — preserve user-added hooks (merge, don't overwrite)»; шаг 5 (`:444-448`) — merge = «collect all command entries (**existing + new**), deduplicate by command string». **Ни одного шага удаления**: grep `remove|prune|delete|stale|drop|disable` по `:433-461` → **0**. Концепции re-derive/prune нет вообще — это чистый additive union.
- Что bootstrap **штатно перезапускается поверх существующей установки** (а не только на чистом проекте) — зафиксировано в `settings.json.template:30` (`_comment`: «User-added hooks are preserved on re-run (merge-by-command-string)») и в `CLAUDE.md` («`/ecosystem:bootstrap` (идемпотентно) подхватит автоматически»).

**Почему это дефект (последствие).** Поведение зависит от того, какой командой прошёл пользователь: **удаление/отключение хука отрабатывает на `update`-пути и молча игнорируется на `bootstrap`-пути.** Хук, выпиленный из манифеста, переживает `/ecosystem:bootstrap` в `settings.json` пилота и продолжает стрелять — а если `.js`-файл при этом уже удалён из `.claude/hooks/`, то на каждом матчащем событии получаем падение вида `Cannot find module`. Тот же механизм превращает **любой будущий флаг отключения в тихий no-op** — «выключил, а оно стреляет» (ближайший кандидат — `enabled_when`, DEF-CTX-2). Сейчас дефект латентен только потому, что хуки из манифестов ещё ни разу не удаляли.

**Набросок фикса.**

1. Внести в `bootstrap.md` Step 6b (`:444-448`) ту же **re-derive**-семантику, что в `update.md` Step 6 (`:777-786`): ecosystem-owned записи (тот же pattern `^node \.claude/hooks/(product|integrator|ecosystem|design|orchestrator)/`) — перевыводить из манифестов; всё остальное — сохранять verbatim. Тогда инвариант «нет в манифесте ⇒ нет в `settings.json`» держится на **обоих** путях.
2. **Попутно снять внутреннее противоречие самого bootstrap'а** (вскрылось при верификации координат): Step 6a (`:416-420`) буквально предписывает `cp .claude/settings.json.template .claude/settings.json` **безусловно** — что затёрло бы и user-, и third-party-записи, — а Step 6b (`:442`) обещает «preserve user-added hooks». Что из двух истинно на re-run, в тексте **не разрешено**. Фиксеру придётся определить явно (вероятная правка: 6a выполняется, только если файла нет).
3. **Поправить ложную сноску:** `update.md:791` утверждает, что merge-семантика update'а «matching Bootstrap Step 6b semantics (`commands/ecosystem/bootstrap.md:441-446` — symmetry restored)». В части **прунинга это неверно**: симметрия восстановлена только по сохранению third-party записей, но не по re-derive. Оставить как есть — значит воспроизвести дефект в голове следующего читателя.
4. **Wipe-protection пилота (DEC-DEV-0049) не ослаблять:** re-derive касается **только** ecosystem-owned записей; third-party инъекции (`bd setup claude` и пр.) сохраняются verbatim — иначе повторим DEC-INT-0005 (снесённые хуки `bd` на каждом `/ecosystem:update`).

**Связь.** **Связан с DEF-CTX-2.** Правильный порядок работ: сперва **DEF-CTX-3** (сделать prune симметричным), и только потом — если решено идти вариантом B — **DEF-CTX-2** (реализовать `enabled_when`). В обратном порядке флаг получится нерабочим на bootstrap-пути.

**Severity.** 🟡 Warning **латентный** → 🔴 в момент, когда из манифеста впервые удалят или отключат хук: тогда это тихая регрессия в установке пилота.

**Происхождение.** DEC-DEV-0197 / D6 — побочный улов зондов контекст-аудита (`REPORT.md:162`).

---

### DEF-CTX-4 — `[OPEN]` dev-хуки (SessionStart / PostToolUse) не доставляются: регистрация живёт в gitignored-файле

**Что наблюдается.** Все dev-хуки экосистемы (`dev/meta-improvement/hooks/*.js` — `rails-session-start.js`, `d7-hygiene-reminder.js`, `context-map-session-start.js`, три PostToolUse-напоминалки) зарегистрированы **только** в `.claude/settings.local.json`, который **gitignored** (`.gitignore` → `/.claude/*`). ⇒ В свежем клоне репо, на VM и в любом worktree этих хуков **нет вообще**. Контраст: git-хуки (`process-gate`, `pre-commit`) имеют установщик — `install-git-hooks.cjs`, запускаемый автоматически через npm `prepare` (DEC-DEV-0157).

**Почему это дефект (последствие).** Механизм, который экосистема считает частью своего harness-контракта (`CLAUDE.md` §«Что делать в этой сессии» ссылается на push-дайджесты как на данность), **фактически существует на одной машине**. Три следствия:
1. **Ложная уверенность.** Документация описывает поведение (RAILS-дайджест, context-map-дайджест, D7-гигиена), которого в чужом окружении не будет — и никто не узнает: хуки fail-safe, они молчат.
2. **VM/CI-слепота.** Именно то окружение, где мутации harness положено валидировать **без самореференции** (VM), не получает валидируемый механизм.
3. **Асимметрия принуждения.** Блокирующие git-хуки ставятся автоматически, а информирующие dev-хуки — вручную и незаписанно. Слабейшее звено — незадокументированное.

**Набросок фикса.** По образцу `install-git-hooks.cjs`: скрипт, который **идемпотентно домешивает** ecosystem-owned SessionStart/PostToolUse записи в `.claude/settings.local.json` (создавая файл, если его нет), не затирая пользовательские; вызов — из npm `prepare` рядом с установкой git-хуков. Ключевое: merge, не overwrite (`settings.local.json` — пользовательский файл; wipe-protection пилота — контракт, не опция). Открытый вопрос: нужен ли этим хукам вообще запуск в чужом окружении (например, `d7-hygiene-reminder` завязан на `dev/`-артефакты) — часть может быть осмысленно repo-only, и тогда фикс = **явно это записать**, а не молча полагаться на локальную настройку.

**Связь.** Самостоятельный. Вскрыт при исполнении **D1** (перевод карт в push-канал): новый хук унаследовал ровно ту же дыру, что и `rails-session-start.js` — то есть дефект **не новый**, а системный.

**Severity.** 🟡 Warning — сегодня работает на машине владельца, где и ведётся разработка. Стреляет при первом же переносе (VM, второй разработчик, CI, worktree-агент).

**Происхождение.** DEC-DEV-0197 / D1 (побочная находка исполнения, не зонда).

---

## Журнал статусов

| Дата | Изменение | Кто |
|---|---|---|
| 2026-07-13 | Файл создан по решению D6 контекст-аудита (DEC-DEV-0197); DEF-CTX-1/2/3 заведены как `[OPEN]`, координаты перепроверены по файлам | контекст-аудит, исполнение D6 |
| 2026-07-13 | `DEF-CTX-4` добавлен `[OPEN]` — dev-хуки не доставляются (регистрация в gitignored `settings.local.json`); вскрыт при исполнении D1 | контекст-аудит, исполнение D1 |
