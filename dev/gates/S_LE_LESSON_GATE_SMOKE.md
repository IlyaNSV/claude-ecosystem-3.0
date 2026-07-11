# S-LE — LESSON-* gate runtime contracts (live smoke checklist)

> **Статус (ре-прогон):** 🟢 **ЦЕЛЬ ДОСТИГНУТА 2026-07-11** (smoke-batch, сессия `9e5dab52`, CC 2.1.205, Linux-VM; DEC-DEV-0177): **S-LE.3 = полный PASS** (deny + exemption 0143 live), S-LE.4/.5 re-confirm PASS, S-LE.2/.6 carry-forward PASS; **S-LE.1 повторно PARTIAL** — feedback-нога работает, `preventedContinuation=false` = ограничение CC под bypassPermissions (классификация судьи: не дефект хука). **Вердикт судьи по флипу `lesson-presence-gate.js` warn→strict: обоснован по существу (специфический блокер — exemption — снят); буква «все 6 ✅» не достигнута из-за S-LE.1 → финальное решение за владельцем.** До решения флип НЕ выполнен.
> **Прежний статус:** 🟠 ПРОГНАН 2026-07-04 (армированная пилот-сессия `4fb6e0f2`, CC 2.1.200, Windows) —
> **нашёл блокер и он починен**: marker-exemption самоблокировался (протокол не мог создать
> собственный маркер — deny бил по первой же записи), закрыт target-carve-out'ом
> **DEC-DEV-0143** + 6 закреплённых смоук-кейсов в `smoke-hooks.js`. **warn→strict флип
> ЗАБЛОКИРОВАН до PASS ре-прогона S-LE.1/S-LE.3 против фикса** (после доставки следующего патча
> в пилот). Итоги — в таблице результатов ниже.
> **Введён:** DEC-DEV-0062 (2026-06-06).
> **Тип:** HARD prerequisite — блокирует перевод `hooks/product/lesson-presence-gate.js` (PreToolUse prong) из `warn` в `strict`.
> **Где прогонять:** следующая **продуктовая пилот-сессия на Windows** (напр. `my-first-test/`) с установленным/обновлённым LESSON-* (`/ecosystem:bootstrap` или `/ecosystem:update`). **НЕ** в dev-сессии самой экосистемы.
> **Связано:** [DEV_JOURNAL DEC-DEV-0062](../../DEV_JOURNAL.md), [PHASE_6_SMOKE_TEST_PLAN.md](PHASE_6_SMOKE_TEST_PLAN.md) (указывает сюда).

---

## Зачем этот смоук

Дизайн LESSON-* опирается на три runtime-контракта Claude Code, которые **нельзя верифицировать из исходников** — официальная дока (`code.claude.com/docs/en/hooks`) их подтверждает, но нужен живой прогон на конкретной версии Claude Code / ОС:

1. **Stop-хук реально блокирует** чистое закрытие сессии (`exit 2` → stderr возвращается модели), а не молча игнорируется.
2. **PreToolUse-deny** реально отклоняет мутирующий вызов через `permissionDecision: "deny"` — **и** marker-exemption не приводит к self-deadlock протокола `/product:lesson`.
3. **bootstrap Step 6b** действительно эмитит новые event-ключи (`Stop` / `PreToolUse` / `UserPromptSubmit`) в `settings.json` и идемпотентен при повторном прогоне.

Пока S-LE не пройден, `lesson-presence-gate.js` стоит дефолтом в `warn` (ставится безвредно), а `lesson-gate.js` (Stop) — `strict` «по доке», но финально подтверждается здесь.

## Почему не в dev-сессии экосистемы

В репозитории экосистемы нет `.product/` → оба хука делают no-op (fail-open). Кроме того, блокирующий Stop-gate в dev-сессии = риск self-collapse (CLAUDE.md принцип №3). Механизм деплоится **в продуктовые проекты** — там и проверяется (DEC-DEV-0062 Lesson #4).

## Setup

- [ ] Пилот-проект на Windows с LESSON-* (после `/ecosystem:bootstrap` **или** `/ecosystem:update`).
- [ ] `.product/` существует.
- [ ] `/ecosystem:verify` Step 8.5 (lesson-gate self-check) проходит: оба хука зарегистрированы; `LESSON_GATE_MODE` не «тихо warn» без ведома.
- [ ] Под рукой: `settings.json` проекта (для проверки регистрации), терминал для просмотра stderr хука.

---

## Шаги и критерии прохождения

### S-LE.1 — Stop-block контракт
1. Создать `LESSON-001` со `status: open` (минимальный валидный frontmatter; можно вручную в `.product/lessons/`).
2. Попытаться завершить сессию.
- [ ] `lesson-gate.js` (strict default) **блокирует** чистое закрытие; stderr с инструкцией (`/product:lesson --resume LESSON-001`) виден.
- [ ] Подтверждено, что блок именно через **`exit 2`** (а не no-op / не молчаливое закрытие).
- [ ] `stop_hook_active` присутствует в payload; повторный блок **не зацикливается** (auto-override после 8 блоков — safety valve, при нормальном flow не достигается).

### S-LE.2 — Stop payload
- [ ] Harness **всегда** подаёт JSON в stdin Stop-хука (нет tty-зависания на `fs.readFileSync(0)`).
- [ ] `cwd` присутствует в payload (хук резолвит project root из `cwd` / `CLAUDE_PROJECT_DIR`, не из `file_path`).

### S-LE.3 — PreToolUse deny контракт
Включить `LESSON_GATE_MODE=strict`. При `open`-уроке **без** свежего `lesson-in-progress` маркера спровоцировать мутирующий вызов (Write/Edit/Bash).
- [ ] Вызов **отклоняется** через `{"hookSpecificOutput":{"permissionDecision":"deny","permissionDecisionReason":"..."}}`; причина видна модели.
- [ ] **marker-exemption:** при свежем `.product/.sessions/lesson-in-progress.<id>` (идёт `/product:lesson`) собственные Write/Edit/Bash протокола **НЕ** отклоняются (нет self-deadlock — это критично).

### S-LE.4 — UserPromptSubmit
При `open`-уроке отправить обычный промпт.
- [ ] `additionalContext`-reminder про открытый урок входит в контекст.
- [ ] Промпт **не** блокируется (UserPromptSubmit только напоминает).

### S-LE.5 — Bootstrap Step 6b (регистрация event-ключей)
- [ ] После `/ecosystem:bootstrap` (или `/ecosystem:update`) в `settings.json` присутствуют ключи `Stop`, `PreToolUse`, `UserPromptSubmit` с корректными командами хуков.
- [ ] Повторный `/ecosystem:bootstrap` / `/ecosystem:update` даёт **ровно одну** регистрацию каждого (empty-matcher `""` dedup, без дублей).

### S-LE.6 — Fail-open
- [ ] Битый stdin / отсутствующий `.product/` → хук `exit 0`, никакого блока/ошибки.

---

## Таблица результатов

| Шаг | Контракт | Результат | Заметка |
|---|---|---|---|
| S-LE.1 | Stop блокирует (`exit 2`) | 🟠 PARTIAL — ПОВТОРНО (ре-прогон 2026-07-11, `9e5dab52`, CC 2.1.205) | Картина 1:1 с 2026-07-04: feedback-нога работает (hookErrors несёт «🛑 LESSON GATE…», инжект «Stop hook feedback» доходит модели, она реагирует и урок не бросает), но `preventedContinuation=false` на ВСЕХ 5 stop-событиях. Классификация судьи: **runtime-ограничение CC под bypassPermissions, не дефект хука**. `/exit` — SessionEnd-путь, Stop-гейтом не покрывается by design. |
| S-LE.2 | Stop payload (stdin + cwd) | ✅ PASS | `cwd` в Stop-событии; хук резолвит root и перечисляет уроки за ~82-99 мс без tty-зависания. |
| S-LE.3 | PreToolUse deny + marker-exemption | ✅ **ПОЛНЫЙ PASS (ре-прогон 2026-07-11, `9e5dab52`)** | deny: Write `notes/scratch.md` отклонён strict-гейтом с видимой причиной. **Exemption (фикс 0143) live-подтверждён**: `/product:lesson --resume LESSON-901` создал маркер и писал цели `.product/lessons/**` при активном strict-гейте (target-carve-out `isLessonResolutionTarget`), урок доведён до active штатно, гейт снялся — **самодедлок устранён**. История FAIL 2026-07-04 — в git-истории этого файла. |
| S-LE.4 | UserPromptSubmit reminder, не блок | ✅ PASS | `additionalContext` «⚠️ Open LESSON-*…» инжектится, промпт не блокируется. |
| S-LE.5 | bootstrap Step 6b emit + dedup | ✅ PASS (2026-07-03, детерминир. чек после `/ecosystem:update`) | `Stop`/`PreToolUse`/`UserPromptSubmit` в `settings.json` пилота ровно по одной регистрации каждого. |
| S-LE.6 | fail-open | ✅ PASS (2026-07-03, детерминир.) | Битый stdin → exit 0 (оба хука); вне `.product` → exit 0. |

**Косметика (починено в 0143):** не-числовой id (`LESSON-SLE-SMOKE`) фолбэчил на имя файла с `.md` — теперь фолбэк без расширения. **Наблюдение:** `LESSON_GATE_MODE=strict` работал как эфемерный env консоли (в settings не персистится) — так и задумано для смоука.

---

## На PASS (все 6 ✅) — действия

1. **Перевести PreToolUse prong в strict:** в `hooks/product/lesson-presence-gate.js` дефолт `const mode = (process.env.LESSON_GATE_MODE || 'warn')...` → `|| 'strict'` (Stop prong уже `strict`).
2. **Зафиксировать в журналах:** запись в `DEV_JOURNAL.md` (follow-up к DEC-DEV-0062: S-LE PASS, дата, версия Claude Code/ОС); строка в `CHANGELOG.md` (`### Changed` — PreToolUse gate warn→strict); снять «S-LE pending» из `ROADMAP.md` «Где мы сейчас» (LESSON-entry).
3. **Архивировать** этот файл в `dev/_archive/` и убрать указатель из `PHASE_6_SMOKE_TEST_PLAN.md` + bullet из `CLAUDE.md` readiness-списка.

## На FAIL — remediation по шагам

- **S-LE.1 FAIL (Stop не блокирует / no-op):** откатить дефолт `lesson-gate.js` в `warn`; пересмотреть Prong A. Non-deferrability держится тогда только на Prong B (PreToolUse) — приоритетно довести его до strict.
- **S-LE.2 FAIL (tty-hang):** добавить guard на не-piped stdin (timeout / проверка `process.stdin.isTTY`) до strict-режима.
- **S-LE.3 FAIL (deny не срабатывает):** проверить точную форму ответа (`permissionDecision` vs устаревший `{continue:false}`); сверить с докой. **marker-exemption FAIL = БЛОКЕР** (протокол сам себя дедлочит) — strict не включать, чинить exemption.
- **S-LE.5 FAIL (ключи не эмитятся / дубли):** починить bootstrap Step 6b emission + empty-matcher dedup; без этого механизм не доезжает до existing installs.
- **S-LE.6 FAIL (не fail-open):** критично — хук может ронять рабочий поток; обернуть весь `main()` в try/catch → `exit 0` до любого strict-режима.

---

## Cross-references

- [DEV_JOURNAL.md → DEC-DEV-0062](../../DEV_JOURNAL.md) — дизайн, rationale, Lessons (#1 web-search верификация контракта; #4 self-collapse guard).
- [hooks/product/lesson-gate.js](../../hooks/product/lesson-gate.js) — Prong A (Stop, strict).
- [hooks/product/lesson-presence-gate.js](../../hooks/product/lesson-presence-gate.js) — Prong B (PreToolUse + UserPromptSubmit, warn → strict после PASS).
- [commands/ecosystem/verify.md](../../commands/ecosystem/verify.md) — Step 8.5 self-check (предусловие Setup).
- [PHASE_6_SMOKE_TEST_PLAN.md](PHASE_6_SMOKE_TEST_PLAN.md) — указывает сюда (S-LE вынесен в отдельный файл во избежание дублирования).
