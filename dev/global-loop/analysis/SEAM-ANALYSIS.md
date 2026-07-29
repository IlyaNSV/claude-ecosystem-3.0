# SEAM-ANALYSIS — шов исполнения анализа эффективности Global Loop

status: ACTIVE
role: рабочий шов ОДНОЙ единицы — исполнения `EFFECTIVENESS_ANALYSIS_PLAN.md`. Трековый SSOT — `../SEAM.md` (он про трек целиком); этот файл про **ход анализа** и переживает компактацию контекста.
seam_updated: 2026-07-29 (Фаза 0 закрыта: датасет + санитария + M7)

## 🛑 СТОП-БЛОК — что нельзя потерять

**Мандат:** владелец дал «го» на исполнение плана 2026-07-29 + уточнение **«продолжай автономно до owner class решений»**. Значит: работаю без блокирующих чекпойнтов, чекпойнты отдаю как отчёты; останавливаюсь только на owner-class.

**Owner-class (СТОП и спрашивать):** merge в `main` · **M16** (каузальная A/B-проба — нужна отдельная санкция) · любое НЕ-read-only действие на VM · правки кода пилота или экосистемы · выход за рамки плана.

**Жёсткие рамки (из плана §0):** VM строго read-only · продукт = датасет + отчёты в `dev/global-loop/analysis/` · ledger-ветка `docs/global-loop-assist-ledger` пушится свободно (`dangerouslyDisableSandbox: true`) · самоотчёты — объект проверки, не источник истины · судейство по §9 (судья = Opus 5, фиксирован; judge ≠ author: executor'ы были Fable 5 / Opus 4.8) · пре-регистрация формул ДО подсчёта (`PREREG.md`), любое отклонение — в журнал §7 с `[POST-HOC]`.

**Главный инвариант анализа:** любое число в отчёте несёт формулу из PREREG + провенанс. Claim без верификации помечается `[UNVERIFIED-CLAIM]`.

## Состояние (верифицируемо, не по памяти)

| Что | Проверка | Ожидаемое |
|---|---|---|
| Ветка | `git -C ce3-wt-global-loop branch --show-current` | `docs/global-loop-assist-ledger` |
| Артефакты анализа | `ls dev/global-loop/analysis/` | `PREREG.md` · `M7_RESULT.md` · `SEAM-ANALYSIS.md` · `DATASET/` · `scripts/` |
| Датасет | `ls dev/global-loop/analysis/DATASET/` | `sessions.csv` (203) · `toolcalls.csv` (14 573) · `commits.csv` (610) · `files.csv` (1854) · `ledger_entries.csv` (98) · `ledger_claims_raw.csv` (283) · `claims.csv` (45) · `touchpoints_raw.csv` (193) · `owner_utterances.csv` (1109) · `host_roles.csv` (81) · `SANITY.md` + дампы фактов |
| Рабочие копии (вне репо, НЕ коммитятся) | `ls ~/WebstormProjects/vm-harvests/` | `VM-CORPUS/` (296 MB: 122 основных + 1463 субагентских jsonl) · `PILOT-CLONE/` (597 коммитов, HEAD `61c21f8`) · `PILOT-DOCS/` (`.product`, `.kiro`, `run_ledger.ndjson`) |

## Сделано (с числами — чтобы не пересчитывать)

- **Фаза 0 — датасет:** 203 сессии разобраны (executor пилота + хост-слой + субагенты), 14 573 tool-call'а с dup-индексом для M12.
- **Санитария (4 находки):**
  - **S-1:** harvest-копии на хосте **не содержат субагентов** (1463 файла, 201 MB на VM) — токен-учёт по harvest занижен: доля субагентов 27% (RUN-B) и **67% (RUN-A)**. Все токен-метрики — по VM-CORPUS.
  - **S-2:** окно поиска хост-сессий из плана (mtime 07-17..25) неверно — файлы живут неделями из-за `--resume`; классификация сделана по timestamps и содержанию: 8 `conductor-run`, 12 `conductor-adjacent`, 61 `ecosystem-dev`.
  - **S-3:** `cond-s12 ≡ extra-5736206f` и `cond-s35 ≡ s35-partial` — одна сессия в двух harvest-файлах; «35 executor-сессий» = 32 уникальных транскрипта.
  - **S-4:** транскрипт «погибшей» `cond-s2` **существует** — сессия `c46bb722` (бриф «P6 по 6 фичам»); harvest её не забрал.
  - **A-1:** коллизия двух хост-сессий (RUN-B.44) подтверждена машинно: `2e40ba63` и `5a97a31d` стартовали в одну минуту `2026-07-21T22:28`, обе с ~275 cond-маркерами.
- **M7 (ДО остальных замеров): claim-accuracy = 1.000 (42/42 верифицируемых из 45).** Все 4 типа claim'ов — 1.000. Отдельное число: машинный якорь несут **38.5%** claim'ов ledger (109 из 283) — остальные непроверяемы по построению. Калибровка аудитора потребовала 5 итераций; все первичные «расхождения» оказались дефектами метода — задокументировано в `M7_RESULT.md` (сама по себе находка).

## Очередь (порядок фиксирован)

1. **Фаза I** — экосистема: defect-escape по классам A1–A4, rework ratio, throughput/цена на FM, M14 time-to-feedback, канон-конформность.
2. **Фаза I-b** — мост: **M1 (cost per resolved intent — центральное число)**, M2 churn/дубли, M3 overhead + токен-томография, M4 Goodhart, M5 baseline `pre-conductor`, M6 complexity, M8 fix survival, M9 mutation (StrykerJS на `PILOT-CLONE`, НЕ на VM), M10 D1→исход, M11 spec-drift.
3. **Фаза II** — кондуктор: автономия, оверхед пульта, инциденты, latency, верность I-8, M13 консилиум, M15 K0-экзамен.
4. **Фаза III** — синтез: `REPORT.md`, ответы на 3 вопроса §1, ROI, датчики H0/H1.
5. **DoD:** план → `EXECUTED`, DEV_JOURNAL при системных находках, memory-sync.

## Грабли этой работы (не переоткрывать)

- Клон пилота с **GitHub** зависает (pack timeout) — клонировать **с VM по ssh**: `GIT_SSH_COMMAND="ssh -p 2222 -i ~/.ssh/vm-claude-factory" git clone cc-dev@127.0.0.1:/home/cc-dev/projects/my-first-test`.
- `ssh ... 'команда с кавычками'` из PowerShell ломается — передавать скрипт через stdin: `ssh ... 'bash -s' < script.sh` (Bash-инструмент).
- Токены субагентов лежат в `<session-id>/subagents/**`, workflow-журналы — в `<session-id>/workflows/*.json`; в основном транскрипте их нет.
- `verdict` в run-ledger бывает строкой И объектом; исход процесса P7 лежит в `result`, а не в `readiness`.
- Один и тот же прогон печатается разными формами (`874/874` ↔ `874 passed`) — искать мультиформатно.
- Скрипты запускать **из корня worktree** (пути в них — от `analysis/`), не из `scripts/`.
