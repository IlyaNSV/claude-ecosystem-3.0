# Анализ эффективности Global Loop — карта артефактов

Исполнение `../EFFECTIVENESS_ANALYSIS_PLAN.md` (ратифицирован владельцем 2026-07-28), запуск по «го» 2026-07-29.

## С чего начинать

| Файл | Что там |
|---|---|
| **[REPORT.md](REPORT.md)** | **Главный отчёт**: ответы на три вопроса владельца с числами, все фазы, синтез, рекомендация датчиков H0/H1 |
| [SEAM-ANALYSIS.md](SEAM-ANALYSIS.md) | Шов исполнения: состояние, посчитанные числа, очередь, грабли. Точка входа при потере контекста |
| [PREREG.md](PREREG.md) | Пре-регистрация: формулы, источники, пороги интерпретации, модель судьи, журнал отклонений |
| **[M16_PREREG.md](M16_PREREG.md)** | **План каузальной пробы «канон vs голый Claude»** — дизайн, метрики, ослепление, уборка. **Утверждён владельцем 2026-07-29:** точка старта C2 (`679f63a`), состав MVP FM-001 + FM-002 |
| **[M16_RUN_PROMPT.md](M16_RUN_PROMPT.md)** | **Готовый промпт запуска пробы** в новой сессии |
| **[M16_SEAM.md](M16_SEAM.md)** | **Шов исполнения пробы** — интенции владельца дословно, инварианты, порядок шагов, куда вписывать результат, грабли среды, SEAM-ACK. Вход для новой сессии |

## Отдельные замеры

| Файл | Замер |
|---|---|
| [M7_RESULT.md](M7_RESULT.md) | Верификация самоотчётов журнала (выполнена **до** остальных) + калибровка аудитора как самостоятельная находка |
| [M10_D1_QUALITY.md](M10_D1_QUALITY.md) | Полнота спецификаций 7 фич по 5 осям (судья) |
| [M11_DRIFT.md](M11_DRIFT.md) | Расхождение документов с кодом, drift velocity, 15 новых находок |
| [REWORK.md](REWORK.md) | Классификация 35 сессий: что строило новое, что переделывало, цепочки переделок |
| [I8_FIDELITY.md](I8_FIDELITY.md) | Верность трансляции интенций в задания (инвариант I-8) |
| [M13_CONSILIUM.md](M13_CONSILIUM.md) | Окупаемость многоагентного консилиума |
| [M15_K0_EXAM.md](M15_K0_EXAM.md) | Экзамен пульта на знание канона экосистемы |

## Машинные таблицы (`DATASET/`)

**Сводки по фазам:** `SANITY.md` (санитария корпуса) · `METRICS_CORE.md` (токен-томография, loop-ratio, throughput, time-to-feedback) · `PHASE1_DEFECTS.md` (дефекты и выживаемость фиксов) · `PHASE2_CONDUCTOR.md` (автономия, латентность, инциденты) · `M1_RESULT.md` (интенции и cost per resolved intent) · `M5_BASELINE.md` (сравнение эпох).

**Первичные таблицы:**

| Таблица | Строк | Что |
|---|---|---|
| `sessions.csv` | 203 | Все сессии: токены по типам, wall-clock, tool-calls, субагенты, инциденты |
| `toolcalls.csv` | 14 573 | Поток вызовов инструментов с индексом повтора (loop-ratio) |
| `commits.csv` | 610 | Коммиты пилота с разрезом строк по назначению |
| `commit_survival.csv` | 571 | Выживаемость строк каждого коммита до HEAD (self-churn) |
| `files.csv` | 1 854 | Файлы: сколько раз правились, первое/последнее касание |
| `defects.csv` | 162 | Дефект-реестр: кто поймал, какой гейт должен был, чем починено |
| `intents.csv` / `intents_verdicts.csv` | 62 | Интенции владельца дословно + пакеты свидетельств + вердикты судей |
| `owner_utterances.csv` | 1 109 | Все сообщения владельца из транскриптов пульта |
| `claims.csv` | 45 | Выборка утверждений журнала с полным следом проверок (M7) |
| `spec_drift.csv` | 38 | Артефакты: соответствует / устарел / фантом + датировка расхождения |
| `session_rework.csv` | 35 | Классификация сессий по характеру работы |
| `gate_integrity.csv` | 252 | Коммиты с правкой тестов: дельта ассертов, соседство с гейтами |
| `fix_survival.csv` | 74 | Каждая ссылка на фикс: существует ли, жив ли в HEAD |
| `d1_quality.csv` | 7 | Оценки спек по осям |
| `mutation_probe.csv` | 18 | Мутанты: убит / выжил |
| `k0_exam.csv` | — | Экзамен по канону: вопрос, эталон, фактический ответ, вердикт |
| `ledger_entries.csv` / `ledger_claims_raw.csv` / `touchpoints_raw.csv` | 98 / 283 / 193 | Структурированный журнал прогонов |
| `host_roles.csv` | 81 | Хост-сессии, классифицированные по содержанию |
| `complexity_trend.csv` | 6 | Сложность на исторических точках |

**Снимки фактов (не редактировать):** `pilot_git_dump.txt` · `pilot_head_index.txt` · `vm_releases.txt`.

## Воспроизводимость (`scripts/`)

Все таблицы порождаются скриптами; запускать **из корня worktree**:

```
node dev/global-loop/analysis/scripts/parse-sessions.cjs      # sessions.csv + toolcalls.csv
node dev/global-loop/analysis/scripts/scan-host-roles.cjs     # host_roles.csv + owner_prompts.jsonl
node dev/global-loop/analysis/scripts/parse-ledger.cjs        # ledger_*.csv + touchpoints_raw.csv
node dev/global-loop/analysis/scripts/parse-git.cjs           # commits.csv + files.csv
node dev/global-loop/analysis/scripts/verify-claims.cjs       # claims.csv (M7)
node dev/global-loop/analysis/scripts/churn-survival.cjs      # commit_survival.csv (M2)
node dev/global-loop/analysis/scripts/dup-complexity.cjs      # complexity_trend.csv + дубли (M2/M6)
node dev/global-loop/analysis/scripts/gate-integrity.cjs      # gate_integrity.csv (M4)
node dev/global-loop/analysis/scripts/mini-mutation.cjs       # mutation_probe.csv (M9)
node dev/global-loop/analysis/scripts/metrics-core.cjs        # METRICS_CORE.md
node dev/global-loop/analysis/scripts/baseline-m5.cjs         # M5_BASELINE.md
node dev/global-loop/analysis/scripts/defect-metrics.cjs      # PHASE1_DEFECTS.md + fix_survival.csv
node dev/global-loop/analysis/scripts/phase2-conductor.cjs    # PHASE2_CONDUCTOR.md
node dev/global-loop/analysis/scripts/extract-intents.cjs      # owner_utterances.csv (сырьё M1)
node dev/global-loop/analysis/scripts/build-intents.cjs       # intents.csv (M1)
node dev/global-loop/analysis/scripts/make-judge-packets.cjs  # JUDGE/PACKET_*.md
node dev/global-loop/analysis/scripts/finalize-m1.cjs         # M1_RESULT.md + intents_verdicts.csv
node dev/global-loop/analysis/scripts/sanity-report.cjs       # SANITY.md
```

**Внешние рабочие копии** (вне репозитория, не коммитятся): `~/WebstormProjects/vm-harvests/VM-CORPUS/` (полный корпус транскриптов VM, 296 MB), `PILOT-CLONE/` (клон пилота), `PILOT-DOCS/` (`.product`, `.kiro`, `run_ledger.ndjson`).

## Судейство (`JUDGE/`, `RUBRICS/`)

Рубрики зафиксированы **до** прогонов. Судья — Opus 5, не участвовавший в оцениваемых прогонах.
`VERDICTS_1..3.jsonl` — первый проход тремя независимыми судьями; `VERDICTS_RECHECK.jsonl` — слепая
переоценка спорных случаев с расширенным материалом; `pass1_verdicts.json` — снимок первого прохода
для сравнения устойчивости.

## M16 — каузальная A/B-проба (исполнена 2026-07-29)

Единственный каузальный замер плана; остальное в этом каталоге — ретроспектива.

| Файл | Что это | Когда зафиксирован |
|---|---|---|
| `M16_PREREG.md` | Пре-регистрация: дизайн, что уравнено, метрики, ослепление, стоп-правила | до прогонов |
| `M16_SEAM.md` | Шов исполнения: интенции владельца дословно, инварианты, порядок шагов | до прогонов |
| `M16_ACCEPTANCE.md` | **Скрытый приёмочный набор** — 12 сценариев с якорями в `SC/VC/BR/IC` + калибровочный журнал | коммит `8698490`, **до старта плеч** |
| `M16_RUN_SETUP.md` | Конфигурация: точка старта, препарация, изоляция стендов, побайтный текст задания, результаты добора из сети | до старта плеч |
| `M16_JUDGE_RUBRIC.md` | Рубрика слепого судейства: 6 осей, правило реверса порядка | до вердиктов |
| **`M16_RESULT.md`** | **Протокол результата**: числа, судейство, ответ на вопрос замера, ограничения, уборка | после |
| `M16_ERROR_LEDGER.md` | Реестр **моих** ошибок исполнения (7 записей) с классификацией и кандидатами в enforcement | вёлся по ходу |

**Сырьё** (вне репозитория): `~/WebstormProjects/vm-harvests/M16/` — транскрипты обеих сессий с
субагентами, итоговые состояния репозиториев, 4 приёмочных отчёта + 6 калибровочных, протокол
прогонов и адаптации, дампы БД пилота до и после инцидента ERR-06.
