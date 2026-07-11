# Continuation-план: трек vibe-coding SDLC adoption (пост-компактационный чекпоинт)

> **Назначение:** полное состояние задачи + оставшиеся шаги с гранулярностью «продолжить без профанации замысла».
> **Дата чекпоинта:** 2026-07-04. **Автор:** сессия 8bebcd01 (Claude Fable 5).
> **Правило возобновления (Recovery-протокол глобального CLAUDE.md):** НЕ доверять этому файлу как живому статусу — сначала верифицировать `git log origin/main`, хвост `DEV_JOURNAL.md`, `gh pr list --state open`. Этот файл = замысел + шов «сделано/осталось» на момент записи.

---

## 0. Замысел задачи (зачем всё это)

Владелец дал 51-стр. Google-статью «The new Software Development Lifecycle with Vibe Coding» (май 2026): изучить целиком **без потери смыслов**, извлечь применимое к Ecosystem 3.0, внедрить очередь рекомендаций **автономно до конца**, с делегированием субагентам + самостоятельной проверкой (синергия). НЕ переписывать существующее, НЕ тащить вендор-стек/риторику; каждая правка — в словаре проекта.

**SSOT анализа:** `dev/VIBE_CODING_ANALYSIS.md` (в репо, канонизирован). Структура: §1 суть статьи · §2 already-covered таблица · §3 adopt (пуст by design) · §4 adapt с priority/effort · §5 defer с триггерами · §6 reject с причинами · §7 риски для пилота · §8 порядок внедрения (7 шагов).
**Решения:** DEV_JOURNAL DEC-DEV-0144 (принятие очереди), 0146 (model-pinning), 0147 (run-ledger), 0148 (graduation-гейт, «очередь закрыта»).

## 1. СДЕЛАНО (все PR merged в main; проверять `git log`, не верить на слово)

| Шаг §8 | Содержимое | PR | DEC-DEV | Ключевые файлы |
|---|---|---|---|---|
| 1 | Doc-якоря VC-014 (спектр vibe→agentic, 00-concepts §1 «Почему столько структуры»), VC-078 (README «Agent = Model + Harness»), VC-097 (00-concepts §5 «Два режима оператора») | #114 | 0144 | `docs/guide/00-concepts.md`, `README.md` |
| 2 | VC-096 D7-паттерн + доукомплектованы индексы каталога (README паттернов, CONVENTIONS-дерево, счётчик 5/6→8 в CLAUDE.md/SPEC.md) | #116 | — (execution 0144) | `dev/meta-improvement/patterns/config-failure-first-triage.md` |
| 3 | VC-118: 56 аддитивных `model:`-пиновок во всех agent()-вызовах 7 процессов (opus=судейство/verify/impl-highR/диагностика; sonnet=механика/relay; haiku не используется; персоны через `agentType:` НЕ дублируются — их model в frontmatter `agents/**/*.md`) + смоук-гейт: каждая `label:`-строка обязана нести `model:`/`agentType:` | #118 | 0146 | `orchestrator/processes/*.mjs` (6), `product/processes/complete-feature.mjs`, `tests/orchestrator/workflow-syntax.smoke.cjs` |
| 4 | VC-044: Section 3b «Static-context budget audit» (инвентаризация always-on окна per kickoff, baseline/дельта, тест «почему static, а не lazy/reference», резка = DEC-DEV) | #119 | — | `dev/meta-improvement/checklists/phase-kickoff.md` |
| 5 | VC-087+134: run-ledger — CLI `start`/`finish`; `runs/<id>/run.json` + идемпотентная по run_id строка `runs/ledger.ndjson`; **таймстемпы = входы `--at <ISO>` от диспетчера** (Workflow-тело не читает wall-clock — determinism/resume); run-id детерминирован `<дата>-<slug>-<base36 epoch-ms>`; `model_map` извлекается статически из label-строк исходника (опора на смоук-гейт шага 3); `finish` без `start` → finished-unstarted | #120 | 0147 | `orchestrator/lib/run-ledger.cjs`, `tests/orchestrator/run-ledger.test.cjs`, `commands/orchestrator/run.md` (секция «Run ledger» + переписан «Run records (FB-003)») |
| 6 | VC-133/134/127: гейт 4 компонентов (CI ✅ / трейсы ✅built·live-pending / scoped-perms ✅ / security 🟡 с критерием закрытия) + «built ≠ validated» (phase-closure **Step 3.5**, строка в live-run-validation) + **CI** `.github/workflows/verify.yml` (ubuntu, node 22, `npm install` — лок-файла НЕТ, `npm run verify`); **первый Linux-прогон = зелёный 39s на самом PR** | #121 | 0148 | `dev/gates/SUBSTRATE_GRADUATION_GATE.md`, `dev/meta-improvement/checklists/phase-closure.md`, `.github/workflows/verify.yml` |

Память синхронизирована: `memory/project_vibe_coding_adoption.md` + строка в MEMORY.md.

## 2. ОСТАЛОСЬ — блок A: пилот-сессия (главный хвост; триггер = владелец готов дать пилот-сессию)

Гейт шага 6 сам подсветил: **deferred-smoke долг = 3 плана > собственного порога «>2»** → прогон приоритетнее любых новых prod-graduation-заявок. Последовательность:

1. **Доставка:** владелец запускает `/ecosystem:update` в пилоте `my-first-test` (доносит 0146/0147/0148 + всё накопленное `[Unreleased]`). Перед этим проверить, не пора ли резать версию: `dev/meta-improvement/checklists/patch-cut.md` (в `[Unreleased]` уже ≥2 крупных Added).
2. **Прогнать 3 smoke-плана** (протокол = `dev/meta-improvement/checklists/live-run-validation.md`: executor/reviewer separation — исполнителю чистая задача, рубрика у ревьюера, грейд post-hoc по транскрипту; класс B механика):
   - `dev/gates/PATCH_1.3.3_SMOKE_TEST_PLAN.md` — S1–S5;
   - `dev/gates/PHASE_6_SMOKE_TEST_PLAN.md` — S1–S7;
   - `dev/gates/S_LE_LESSON_GATE_SMOKE.md` — ре-прогон S-LE.1 + S-LE.3 exemption ПРОТИВ фикса 0143 (target-carve-out). **PASS обоих = разблокирует флип `lesson-presence-gate.js` warn→strict** (обещание DEC-DEV-0062/0143; сам флип — отдельное решение владельца).
3. **Live-валидация run-ledger (built→validated):** в пилоте прогнать любой оркестратор-процесс через `/orchestrator:run` и проверить: диспетчер вызвал `start`/`finish` (wiring в `commands/orchestrator/run.md`); появился `.claude/orchestrator/runs/<RUN_ID>/run.json` (duration_ms ≠ null, model_map заполнен, result_summary верен) + одна строка в `ledger.ndjson`; retry finish не дублирует строку. По результату — пометить компонент 2 гейта ✅ validated (правка `SUBSTRATE_GRADUATION_GATE.md`) + DEV_JOURNAL-запись итогов пилот-сессии.
4. **После прогонов:** обновить статусы планов (прогнанные — архивировать per phase-closure Step 5.2; НЕ архивировать непрогнанное), снять пометку «live pending» где заслужено, обновить память.

## 3. ОСТАЛОСЬ — блок B: deferred шаг 7 (НЕ делать раньше триггеров — это дизайн-решение отчёта §8 п.7)

- **VC-108** (двух-осевой ландшафт autonomy × integration) — вложить в дизайн **Epic F** (autonomy-resolver L0–L3) при его kickoff. Не вводить таксономию раньше — риск расхождения с дизайном эпика.
- **VC-024** (EVAL-измерение в конвенции agent-файла: «как проверяется польза персоны») — при **Epic G** (G3, `dev/ECOSYSTEM_VISION.md` §2.4).
- Low-priority райдеры «по мере касания файлов»: VC-019 (таблица-проекция спектра словарём экосистемы → 06-gates/00-concepts), VC-071 (property/invariant-линза → `agents/product/qa-advisor.md` Lens 3), VC-128 (5-мерный agent-eval scorecard → рубрики грейдера), VC-135 (A2A watch-item → ECOSYSTEM_VISION, триггер = Epic C/D требует peer-messaging).
- Прочие defer с триггерами — §5 отчёта (background-агенты→Epic E; agent-as-product→пилот с deliverable-агентом; TCO→внешние потребители; и т.д.).

## 4. Watch-items (не задачи, но не потерять)

- **CI** теперь гонится на каждый push в main и PR — красный Action = новый сигнал, которого раньше не было; чинить, не игнорировать (unknown-unknowns Linux: case-sensitivity, eslint `^`-диапазон без лок-файла).
- **Компонент 4 гейта (security review)** 🟡: закрывается первым security-проходом на diff класса prod ИЛИ явной пометкой «нет security-поверхности» (критерий — в самом гейте).
- **VC-127-дисциплина:** в статус-доках писать built vs validated раздельно; долг >2 планов = стоп.
- Кандидат в D7-паттерн при втором применении: «разбор длинного документа» (перекрывающиеся чанк-читатели → консолидатор с дедупом → критик полноты ПРОТИВ ОГЛАВЛЕНИЯ → оценка против репо с evidence-путями) — первый инстанс = этот трек (урок 3 записи 0144).

## 5. Операционные контракты исполнения (как продолжать, чтобы не профанировать)

- **Git:** общий checkout занят чужими ветками — работать в worktree `.claude/worktrees/vibe-coding-sdlc-analysis` (оставлен ЧИСТЫМ, detached на `caf8d3b` = origin/main на момент чекпоинта). Цикл: свежая ветка от `origin/main` → правки → verify → conventional commit → push+PR (`dangerouslyDisableSandbox: true` для git/gh-сети) → **merge: мандат «мержу сам» был выдан НА ЭТУ ОЧЕРЕДЬ; для новых единиц — дефолт Autoflow «СТОП перед merge», пока владелец явно не продлит**.
- **Делегирование (MDP):** runtime-код/судейство → opus-субагент; механика с точным брифом → sonnet; бриф всегда содержит: жёсткий скоуп путей (только worktree), «DEV_JOURNAL/CHANGELOG не трогай — пишет ревьюер», запрет побочных изменений, требование grep-верифицировать цитируемые прецеденты. Ревью main-моделью ОБЯЗАТЕЛЬНО: дифф построчно + спот-чек 1-2 непроверенных клеймов.
- **Обязательства коммита:** `feat:` в consumer-zone (`commands/skills/agents/hooks/docs/templates/adapters/orchestrator` + root README/ROADMAP/install) → 🔒 CHANGELOG `[Unreleased] ### Added`; tradeoff ≥2 вариантов → DEV_JOURNAL. **Gotcha process-gate:** сообщение коммита с «DEC-DEV-N» без journal-диффа в том же коммите = блок; для execution-коммитов уже зажурналенных решений номер из сообщения убирать (провенанс в PR-body/файле).
- **Номер журнала:** `npm run next-dec-dev` + скан открытых PR (`gh pr list`); коллизия после аллокации = штатный renumber-on-conflict (yield младшему PR). Следующий свободный на момент чекпоинта: **0149**.
- **Accumulation-конфликт** DEV_JOURNAL/CHANGELOG `[Unreleased]` при merge origin/main = ожидаем: склейка ОБЕИХ сторон (записи последовательно, через `---`), нетривиальное — стоп+спросить.
- **Verify:** `npm run verify` в worktree (deps: `npm install`, лок-файла нет; Chrome для guide-смоуков установлен, на отсутствии — graceful skip). EXIT 0 = условие PR.
- **Память:** статус-несущие коммиты → обновить `memory/project_vibe_coding_adoption.md` + строку MEMORY.md (индекс держать компактным — прецедент компактизации 2026-07-04, архив = `index_archive_2026-07-04.md`).

## 6. Артефакты сессии (для форензики, не для повторного использования)

- Workflow-скрипт анализа: `~/.claude/projects/.../workflows/scripts/vibe-coding-pdf-analysis-wf_de6c5ad9-804.js` (runId `wf_de6c5ad9-804`, journal в transcript-dir) — 5 фаз: Extract(5×sonnet, перекрытие 1 стр.) → Consolidate(opus) → Assess(9×opus, evidence-пути) → Critique(opus, против оглавления) → Synthesize(opus).
- Извлечённый текст PDF: scratchpad `pdf-extract/pages/page-0NN.txt` (51 файл; исходник: `C:\Users\pw201\Downloads\The new Software Development Lifecycle with Vibe Coding.pdf`).
- Копия отчёта в scratchpad = `VIBE_CODING_ANALYSIS.md` (канон — в репо `dev/`).
