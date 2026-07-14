# Smoke-batch 2026-07-11 — пре-регистрированный бриф (4 накопленных плана, VM-пилот)

> **Пре-регистрация:** коммитится ДО прогона (anti-tamper, live-run-validation).
> **Мандат владельца (2026-07-11):** «Прогони пачку из 4 smoke-планов на VM». Контекст: closure-finding
> Phase 7 — deferred-smoke долг = 4 плана (порог 2 превышен вдвое); прогон пачкой, новых built-фаз
> до него не наслаивать.
> **Класс:** B (функциональная механика по опубликованным планам). Рубрики = САМИ планы
> (`dev/gates/{PATCH_1.3.3,PHASE_6,PHASE_7}_SMOKE_TEST_PLAN.md` + `S_LE_LESSON_GATE_SMOKE.md`);
> executor-сессии их НЕ видят — получают операционные промпты ниже. Судья: **opus, фиксированная
> модель**, пост-фактум по транскриптам, PASS/FAIL/N-A + цитата per сценарий.
> **Доставка:** релиз **1.9.0** cut (`6da37c1`, тег) — прогону нужен `/ecosystem:update` пилота
> 1.8.1→1.9.0 (Phase-7 артефакты). Сам update = сценарий S7 Phase-6 (см. U).
> **Среда:** VM Ubuntu-ClaudeCode, пилот `~/projects/my-first-test`; скилл `vm-factory-ops`
> (bypass-мандат, base64-промпты, harvest→kill, `DISABLE_AUTOUPDATER=1`). Перед прогоном —
> офлайн-снапшот `smoke-batch-pre-run`.

## Общие правила

- Фикстуры (LESSON-файл, drift-правка адаптера, тестовые FM-записи) — ТОЛЬКО на изолированной
  ветке пилота `smoke-batch-1-9-0`; `main` пилота не трогать (кроме самого `/ecosystem:update`,
  который штатно едет в main — это реальная доставка). `.env` не редактировать; секреты не выводить.
- Канон экосистемы (`.claude/**` содержимое, кроме штатной работы команд) не править; дефекты
  фиксировать письменно, не чинить по ходу (capture-don't-fix).
- Любой исход валиден: FAIL сценария = находка, не «провал прогона»; классифицировать, не подгонять.
- После harvest каждую executor-сессию ГАСИТЬ (урок idle-TUI, скилл §4.5).
- Оператор (я, с хоста) снимает детерминированные before/after-чеки сам по ssh (не через executor).

## Порядок сессий

### U — доставка 1.9.0 = Phase-6 **S7** (update-compat) + S-LE.5 re-confirm

Оператор ДО сессии снимает before-state (ssh, read-only): sha256 `.claude/design.yaml` (если есть),
список+checksums `.product/mockups/*`, `.product/design-system.md`, `.product/.design-sessions/*`,
hooks-массив `settings.json`/`settings.local.json`, список third-party namespaces в `.claude/{commands,skills}`.
Executor-промпт (verbatim):

```text
Обнови экосистему проекта: прогони /ecosystem:update, затем /ecosystem:verify.
Держи меня в курсе ключевых решений и останавливайся там, где регламент требует
моего участия.
```

Оператор ПОСЛЕ: after-state diff по чек-листу S7 (design.yaml identical · `.product/**` untouched ·
managed namespaces обновлены · third-party preserved · hook-записи re-derived без дублей — заодно
S-LE.5: `Stop`/`PreToolUse`/`UserPromptSubmit` ровно по одной) + Phase-7 артефакты доставлены
(`.claude/commands/integrator/{verify,debug,docs}.md`, `.claude/hooks/integrator/{drift-check.js,lib/drift-checks.cjs}`,
manifest, settings-регистрация SessionStart).

### D — PHASE_7 S1-S5 (Integrator maintenance)

Одна executor-сессия на `main` пилота (verify/debug/docs read-only или декларированно-обратимы;
drift-фикстура для S4 — на ветке). Промпт (verbatim):

```text
Проведи maintenance-осмотр Integrator-зоны проекта:
1. Прогони /integrator:verify и покажи отчёт.
2. Возьми один исторический симптом из .claude/integrator/project-journal.md и
   прогони /integrator:debug по нему; на approve-гейте выбери n (не применять).
3. Прогони /integrator:docs --tool cc-sdd. Затем добавь в сгенерированный файл
   секцию, обёрнутую маркерами <!-- manual: do not regenerate --> ... <!-- /manual -->,
   и прогони /integrator:docs --tool cc-sdd повторно. Покажи, пережила ли секция реген.
По ходу держи меня в курсе ключевых решений и останавливайся там, где регламент
требует моего участия.
```

S4 (hook) — оператор+отдельные короткие сессии: (a) свежая сессия на чистом состоянии → хук молчит;
(b) на ветке `smoke-batch-1-9-0` правкой инстанс-адаптера (`CONTRACT_SCHEMA_VERSION` −1) создать
реальный drift → свежая сессия → в контексте additionalContext-нота с рекомендацией
`/integrator:verify`; (c) `INTEGRATOR_DRIFT_CHECK=0` → молчит. S5 (отказы) — оператор: CLI-проба
`drift-checks.cjs --root <пустой tmp-каталог>` (note «no Integrator state», exit 0) + в executor-сессии
(b-ветке) `/integrator:docs` при искусственно пустом наборе — ИЛИ грейдить отказ по verify.md-ветке
Step 1, если естественного пустого состояния нет (не вайпать реальное состояние ради фикстуры —
достаточно tmp-каталога для CLI-ноги и текстовой ветки команды).

### A — PATCH_1.3.3 S1-S5 (research gate + scope-guard + PA)

A1 (S2/S3/S5, механика scope-guard): промпт (verbatim):

```text
Проверь гигиену Integrator-зоны проекта по шагам:
1. Создай файл .product/features/FM-SG-TEST.md с одной строкой-заглушкой, покажи
   результат, затем удали его.
2. Прогони /integrator:scan.
3. Сразу после скана снова создай .product/features/FM-SG-TEST.md, покажи stderr
   вызова, повтори ту же запись ещё дважды в течение той же минуты, подожди минуту
   с небольшим и повтори запись ещё раз. Затем удали файл.
4. Прогони /ecosystem:pending-actions без аргументов, затем с --status all, затем
   с --source integrator, затем с --help. Покажи выводы.
По ходу держи меня в курсе ключевых решений и останавливайся там, где регламент
требует моего участия.
```

(Заметка оператору: шаг 1 = Stage-1 no-op-контроль ДО маркера; шаги 3 — тайминг дедупа; PA-записи
после прогона dismissed-ать не нужно — оставить для судьи, состояние ветки.) Прогон A1 — на ветке
`smoke-batch-1-9-0` (создаёт PA-мусор и тестовые файлы).

A2 (S1 research + hard gate): промпт (verbatim):

```text
Прогони /integrator:research "lightweight error-tracking для small SaaS (self-hosted
или free tier)". Доведи до конца процесса.
```

На гейте Phase 5.2: оператор сначала МОЛЧИТ 3+ минуты (критерий silent-ignore — сессия обязана
ждать), затем отвечает `defer`. Затем вторым промптом в той же сессии: `Прогони этот же research
ещё раз и на гейте выбери вариант 1.` — проверка «выбор номера ≠ авто-add» (research из кэша).
S4 (add env-preview): третьим промптом: `Прогони /integrator:add cc-sdd@latest (идемпотентный
ре-ран). На approve-гейте выбери n.` — env-блок (tiers или agnostic) обязан быть в propose ДО гейта.

### B — PHASE_6 S1-S5 (Design Module на UI FM)

Предусловие: UI FM с `has_ui=true` + активные SC (оператор проверяет на VM; если нет — НЕ фабриковать
насильно: взять ближайший честный FM с UI-поверхностью и обогатить его has_ui на ветке — фиксация
deviation в Outcome). Stitch MCP на пилоте не установлен → D.2 обязан авто-фолбэкнуть в HTML
(S3 сливается с S2-прогоном естественным образом). Ветка `smoke-batch-1-9-0`. Промпт (verbatim):

```text
Возьми фичу FM-NNN и проведи её через дизайн-контур: /design:start FM-NNN, дальше
по регламенту до готовности артефактов, затем /design:export FM-NNN. После этого
прогони /design:migrate MK-NNN --to html и /design:migrate MK-NNN --to claude-design
и покажи результаты. По ходу держи меня в курсе ключевых решений и останавливайся
там, где регламент требует моего участия.
```

Оператор на гейтах отвечает по-настоящему (approve brief; strategic gate; migrate approve).
Грейд-точки: brief-файл + 🟡 gate явный · fallback-warning + PA (Stitch недоступен) · MK/DS/NM
frontmatter + V-MK · export = handoff §10 формат · migrate идемпотентность/reject claude-design.

### C — S-LE ре-прогон .1 + .3-exemption (против фикса 0143) — ПОСЛЕДНЯЯ сессия

Ветка `smoke-batch-1-9-0`. Оператор готовит фикстуру: `.product/lessons/LESSON-901-smoke-batch.md`
со `status: open` (минимальный валидный frontmatter). Сессию запускать с
`LESSON_GATE_MODE=strict` в env. Шаги:
1. Свежая сессия → любой промпт → S-LE.4 re-confirm (reminder в контексте, промпт не заблокирован).
2. Промпт: `Создай файл notes/scratch.md с одной строкой.` → PreToolUse deny обязан отклонить
   (S-LE.3 deny re-confirm).
3. Промпт (verbatim): `Разреши открытый урок: /product:lesson --resume LESSON-901` → протокол обязан
   СМОЧЬ создать свой маркер и цели `.product/lessons/**` (target-carve-out 0143) — **это грейд-предмет
   exemption**; довести урок до active/resolved по регламенту.
4. Вернуть урок в open (оператор, git checkout на ветке) → попытка завершить сессию (`/exit` или
   закрытие) → Stop-гейт обязан заблокировать чистое закрытие (S-LE.1; наблюдать exit-код/поле
   `preventedContinuation` в транскрипте на CC текущей версии VM).
5. Клин-ап: урок → resolved или файл убран с ветки; сессию погасить.

## Стоп-правила

- Wipe-protection на update: если update хочет удалить пилот-фичи → СТОП, показать владельцу.
- Крэш/обрыв → верифицировать фактическое состояние (git log, settings, снапшот), не ре-раннить вслепую.
- Usage-limit VM-аккаунта → ждать, продолжать с чекпойнта; журнал прогона в этом файле §Outcome.
- Любая правка канона экосистемы по ходу — запрещена; дефекты письменно.

## Критерии — где лежат

PASS/FAIL-критерии per сценарий НЕ дублируются здесь — они в четырёх планах (SSOT). Судья грейдит
по ним; anti-phantom-inflation: упавший upstream-критерий делает наследников N/A, не FAIL.
Phase-6 S2 «Stitch MCP active» грейдится по фактическому субстрату (Stitch нет) — HTML-путь =
основной, Stitch-специфика = N/A-substrate. S-LE: на все-PASS (.1 и .3-exemption зелёные) — флип
`lesson-presence-gate.js` warn→strict по инструкции плана §«На PASS».

## Outcome (2026-07-11, пост-прогон; журнал DEC-DEV-0177)

**Прогон состоялся полностью: сессии U→D→A→B→C, судья (независимый opus) вынес вердикт по 22 грейд-точкам: 14 PASS / 3 PARTIAL / 5 N/A / 0 FAIL.** **Независимый пересуд 2026-07-14 (судья sonnet ≠ семья opus, DEC-DEV-0204): `12 PASS / 5 PARTIAL / 5 N/A / 0 FAIL`** — 20/22 вердиктов устояли, две строки понижены (PATCH_1.3.3 S1, PHASE_6 S4 — PASS→PARTIAL), см. блок «Независимый пересуд» ниже. Evidence: пилот main `202c882`→`54dd35a`, ветка `smoke-batch-1-9-0` (6 коммитов, запушена), session ids U=33c3b282 / D=388e9deb / A=3fcf061c / B=8b01b9bb / C=9e5dab52; операторские факты + digest — scratchpad прогона; VM-снапшот `smoke-batch-pre-run`.

> ### ⚠ Исправление агрегатов (2026-07-13, DEC-DEV-0197 / D13)
>
> **Было:** `11 PASS / 2 PARTIAL / 6 N/A / 0 FAIL` — сумма **19**, не сходится ни с заявленными 22 грейд-точками, ни с таблицей самого судьи.
> **Стало:** **`14 PASS / 3 PARTIAL / 5 N/A / 0 FAIL`** — сумма **22** ✓.
>
> **Root cause.** Судья (opus) **верно выставил все 22 per-сценарных вердикта** в своих четырёх таблицах, но **ошибся в собственной агрегации** в «Коротком ответе»: (а) перечислил **пять** N/A, назвав их шестью; (б) назвал «2 PARTIAL», перечислив в той же фразе **три** (PHASE_6 S2 · PHASE_7 S4 · S-LE.1); (в) недосчитал PASS'ы, опустив carry-forward-строки **S-LE.2** и **S-LE.6**. Эти ошибочные сводные числа были скопированы verbatim в документы (этот бриф → DEV_JOURNAL 0177 → CHANGELOG 1.9.1 → ROADMAP → память).
>
> **Пересчёт по таблице судьи (программный, 22 строки):** PATCH_1.3.3 = 2 PASS / 3 N/A · PHASE_6 = 3 PASS / 1 PARTIAL / 2 N/A · S_LE = 5 PASS / 1 PARTIAL · PHASE_7 = 4 PASS / 1 PARTIAL. **Итого 14 / 3 / 5 / 0 = 22** ✓.
>
> **Границы правки:** per-сценарные вердикты **НЕ пересуживались и НЕ менялись** — испорчены были только сводные числа и две пропущенные строки. Источник истины — таблица в транскрипте судьи (`.../subagents/agent-aeaaf7579e8f4e8cb.jsonl`, последнее assistant-сообщение).
>
> **Отдельно:** гипотеза K9 («opus-судья мог ЗАВЫСИТЬ вердикты», `dev/context-audit/ws1/run2/RULES.md`) этой правкой **не проверялась и не закрыта** — D13 чинил арифметику агрегации, а не качество суждения. Фактически судья здесь себя **занизил**, а не завысил.

> ### ⚖ Независимый per-сценарный пересуд (2026-07-14, DEC-DEV-0204) — K9 закрыта
>
> **Метод:** судья sonnet (вне семьи opus — авторы плечей и исходный судья были opus-4-8), рубрика зафиксирована в брифе ДО прогона, класс «UNVERIFIABLE-FROM-CORPUS» вместо гаданий. Ключевое отличие корпуса: пересуду был доступен **GitHub пилота** (ветка `smoke-batch-1-9-0`, реальные коммиты `a1d3d9e`/`0e30118`/`54dd35a`/`6ea9298`) — первичка, которой исходный судья не касался; плюс `mockups-*.txt` и `SMOKE_BATCH_CHECKPOINT.md`, которые он не читал.
>
> **Итог: `12 PASS / 5 PARTIAL / 5 N/A / 0 FAIL` (сумма 22 ✓).** 20/22 устояли — для шести строк (S7, S-LE.3, S-LE.5, PH7 S2, 1.3.3 S3, PH7 S4) пересуд нашёл evidence **сильнее** исходной (диффы хэшей, исходный код хуков, полные journal-тексты коммитов) и подтвердил вердикты дословно. Понижены две:
> - **PATCH_1.3.3 S1: PASS → PARTIAL** — критерий per-tier-таблицы research не подтверждён ни диджестом, ни реальным journal-текстом (`DEC-INT-RESEARCH-0005`, pilot `0e30118`); defer/silent-ignore подтверждён железно. Структурное ограничение метода компиляции диджеста («последние 2 текста на сессию» вырезают Phase-5.1-вывод).
> - **PHASE_6 S4: PASS → PARTIAL** — из 4 pass-критериев подтверждён 1 (reject claude-design, дословно); write-путь (`previous_tools[]`, rollback) не упражнён — оператор отклонил на approve-гейте; Setup-precondition (`design_tool: stitch`) не соответствовал субстрату — та же логика, что дала N/A соседним S1/S3.
>
> **Вердикт K9: подтверждена ЧАСТИЧНО** — мягкая локализованная инфляция (2/22 = 9% строк; паттерн «громче формулировка при меньшей проверке»), не системная (литературные потолки — про буквальное self-grading; здесь режим слабее: cross-session same-family). **Ни один N/A не прятал FAIL** (адверсариально перепроверено для 1.3.3 S2/S4/S5 и PHASE_6 S1/S3). Качественные выводы прогона не переворачиваются: 0 FAIL, Phase-7 validated, флип lesson-gate держится на S-LE.3 (самое сильное подтверждение во всём наборе: код `denyJSON()` + реальный diff `a1d3d9e` байт-в-байт). Границы: S-LE.4 — PASS на парафразе оператора без raw-цитаты для сессии C (не опровергнут); сырые executor-JSONL на VM не добирались (VM занята) — пересуд оказался полностью возможен на статичном корпусе + GitHub, ре-прогон не потребовался.

**Per план:**
- **PHASE_7: S1/S2/S3/S5 PASS, S4 PARTIAL** (staleness-нога хука live-сработала в сессии D и молчала в чистой C; drift-ось слепа — DEF-SMK-1). Debug попутно нашёл живой дефект (ложный C-03 на FM-006). План архивирован.
- **S_LE ре-прогон: S-LE.3 полный PASS** (deny + exemption — самодедлок 0143 live-устранён), S-LE.4/.5 re-confirm PASS, **S-LE.2/.6 carry-forward PASS** (строки судьи, опущенные в первой редакции этого §Outcome — именно их пропуск и породил расхождение агрегатов; добавлено D13, DEC-DEV-0197), **S-LE.1 повторно PARTIAL** (feedback-нога работает — гейт-stderr инжектится модели и она реагирует; `preventedContinuation=false` на всех событиях — hard-block недемонстрируем на CC 2.1.205/bypassPermissions; классификация судьи: runtime-ограничение CC, не дефект хука). **Вердикт судьи по флипу PreToolUse warn→strict: обоснован по существу (специфический блокер — exemption — снят), буква «все 6 ✅» не достигнута из-за S-LE.1 → финальное решение за владельцем.**
- **PHASE_6: S5/S7 PASS, S2 PARTIAL, S4 PARTIAL** *(было PASS; понижен пересудом 0204 — 1 из 4 критериев подтверждён, write-путь не упражнён)*, **S1/S3 N/A-substrate** (дизайн FM-003 пред-существовал approved → iterate вместо fresh start; Stitch отсутствует). S7 update-compat — детерминированно чистый (design.yaml/mockups/DS identical, third-party preserved, Phase-7 артефакты доставлены, `ecosystem_version` 1.9.0 re-stamped; пересуд 0204 независимо продиффил 81 файл-хэш — 0 расхождений). Догон S1/S3 — нужна честная UI FM без готового дизайна.
- **PATCH_1.3.3: S1 PARTIAL** *(было PASS; понижен пересудом 0204 — per-tier-таблица research не подтверждена evidence)*, **S3 PASS, S2/S4/S5 N/A** — тест-дизайн-гэп прогона: `/integrator:scan` снимает session-marker на Final-cleanup → запись шага 3 шла БЕЗ маркера (no-op легитимен); S4 ушёл в идемпотентный re-verify без Stage-2 propose. Догон: запись при живом маркере + свежий install с профилем.

**Дефекты/находки (classified, фиксить пост-прогонными PR):**
1. **DEF-SMK-1** [дефект кода экосистемы]: `drift-checks.cjs` ждёт поле `adapter` в active-tools.yaml — в реальной схеме его нет (связь через CNT-*.yaml `transformation.script`) → D1/D2/D3 слепы на реальном пилоте (инжект schema-drift не пойман); staleness-нога работает.
2. **C-03 FM-006** [дефект instance-адаптера]: minor-whitelist отстал от v1.6.0 → ложный non-blocking warning (journal cancelled DEC-INT-0013).
3. **Bootstrap-гэп** [гэп доставки]: тест-фикстура адаптера `FM-FIXTURE-001-handoff.md` не деплоится bootstrap/update — Stage-6/re-verify используют реальный handoff.
4. PA-050/051 без поля `Status` [data-hygiene пилота, minor].
5. node MODULE_NOT_FOUND в B [среда/транзиент, на итог не повлиял]; `bd prime` not found [known third-party drift].

**Deferred-smoke долг: 4 → 2** (PHASE_7 архивирован; S_LE — цель ре-прогона достигнута, судьба файла за решением флипа; PATCH_1.3.3/PHASE_6 остаются с точечным догоном).
