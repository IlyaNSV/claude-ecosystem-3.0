# Агрегат №3 — Детерминизм-профиль экосистемы 3.0 (эмпирическая база для Statechart/ESM-решения)

> Источник: 9 зонных ридеров (JSON-выжимки + полные reader-*.md). Всё, что помечено «непроверено» —
> это граница охвата ридеров, а не подтверждённый факт. Цель — дать владельцу эмпирическую опору
> для гипотезы «механические процессы → FSM-контроль, творческие → LLM-судейство».

---

## 0. Главный вывод в одном абзаце

Экосистема **уже де-факто расщеплена ровно по линии гипотезы владельца**, но без объединяющего
формализма: почти каждый «процесс» — это **гибрид** из детерминированного скелета/гейта (Node
`.cjs`/`.js`/`.mjs`: hooks, oracles, synth, verify) и LLM-ядра (procedural- или judgment-llm).
Детерминированный слой уже несёт: (а) валидацию, (б) вычисление вердиктов гейтов (GO/NO-GO,
READY_TO_SMOKE, coverage/fidelity-score), (в) запись сигналов в очереди состояния. LLM-слой несёт
суждение и творчество. **Единственный системный разрыв, повторяющийся во ВСЕХ зонах: переход
«детерминированный хук записал сигнал состояния» → «LLM реально выполнил переход/действие» —
PROMPTED (поведенческий), не enforced.** Исключения, где переход уже enforced: LESSON (Stop-гейт),
completeness-loop / consilium (runner-код), process-gate (commit-msg). Именно этот разрыв — самая
сильная точка приложения statechart/ESM: формализовать **конверт** (lifecycle-состояния,
disposition гейтов, pending→resolved, run-status, escalation-ledger), НЕ трогая **контент**
состояний, помеченных judgment/creative.

---

## 1. Профиль детерминизма по процессам (сводная таблица)

Легенда: **DS** deterministic-scripted · **PL** procedural-llm · **JL** judgment-llm ·
**CL** creative-llm · **HD** human-decision. `гибрид` = детерминированное ядро внутри LLM-оболочки
или наоборот. Статус: impl / partial / spec-only / stub.

### 1.1 Product core (D1/D2-Behavioral) — зоны docs/pmo + commands/product

| Процесс | Профиль | Детерм. компонента | Статус |
|---|---|---|---|
| D1 Discovery (init: PS/MR/CA/SEG/VP/HYP) | PL | approve-гейты + hook-валидация | impl |
| D1.B Planning (MVP/RM/RL/FM-skeleton) | PL | MoSCoW-структура, MUST≤8 | impl |
| D2-B Feature (SC/BR/LC/IC/VC/RPM/NFR) | PL | V-* правила, F.10 guard | impl |
| A1 auto-approve (LC/VC/RPM 🟢) | PL (гибрид) | self-check V-05/06/07/11 → авто-active | impl |
| Cascade consistency | PL + **DS** | cascade-check.js V-11 авто-фикс (DS), остальное очередь | partial |
| BG extraction | PL + **DS** | bg-extractor.js regex-scan (DS), классификация PL | partial |
| NFR review (Ask/Define) | JL | tier-detect, sanity-range | impl |
| Handoff generation | PL + **DS** | SHA-256 hash (hash.js), DoR-блокеры | impl |
| Validation runner (on-demand) | PL + **DS** | V-01..16 катал., V-11 авто-фикс | impl |
| Cleanup (orphan V-15) | PL | V-15 детект | impl |
| Drift-check (C1) | **JL** | — (целиком суждение) | impl |
| Pattern-lint (C4) | **JL** | 11 эвристик | impl |
| Validation-tune (C3) | **JL** | нет автодетектора (prompted) | impl |
| Note capture/promote | PL | атомарный dual-write | impl |
| **Lesson capture** (write-ahead) | PL + **DS-gate** | lesson-gate.js Stop (blocking) | impl |
| Completeness-loop (Epic B) | PL-shell + **DS-oracle** | completeness-oracle.cjs (внешний стоп), gap-classifier.cjs | partial |
| Consilium (Epic D) | **JL-jury** + **DS-synth** | consilium-synth.cjs матрица/veto | impl |
| Batch-enrich (Epic C) | PL + **DS-runner** | checkpoint manifest, prepare-only | impl |
| Product DA review (FM/RL) | **JL** | — (6-lens суждение) | impl |
| DA orchestration (hook→subagent) | **JL** (триггер DS) | br/ic-change-trigger.js | partial* |

\* известная рекуррентная регрессия: LLM подменяет канонический subagent на general-purpose.

### 1.2 Delegation D2T–D6 — Integrator + handoff

| Процесс | Профиль | Детерм. компонента | Статус |
|---|---|---|---|
| research / gaps / debug(spec) | JL | — | impl / impl / spec-only |
| map / status / journal | PL | чтение state-YAML | impl |
| scan (baseline) | PL | классификатор зон | impl |
| add (6-stage) | PL (гибрид) | Stage6 adapter --verify-only --fixture (DS) | impl |
| update (drift D1/D2/D3) | PL (гибрид) | semver/schema/body-diff (DS) | partial |
| remove (5-stage) | PL | idempotent no-op | impl |
| Adapter tri-location + verify | **DS** | --verify-only контракт-тест | impl |
| Contract registry + journal-hook | **DS** | journal-hook.js autolog | impl |
| scope-guard marker | **DS** | PreToolUse regex-классиф. (warn-only) | impl |
| Handoff lifecycle (Product→adapter) | PL (гибрид) | hash-drift (DS, в другой зоне) | partial |
| feedback loop external→.product | HD | **не реализован** | spec-only |
| replace / verify / docs(bulk) | PL/DS/DS | — | spec-only |

### 1.3 Событийная ткань — hooks/ (почти целиком DS)

Все ~19 хуков — **deterministic-scripted** (regex-frontmatter парс, git diff best-effort,
pending-YAML). Явный принцип: «disposition is deterministic; only persona verdict content is
judgment». Блокирует по умолчанию **ровно один** — `lesson-gate.js` (Stop, exit 2). Остальные —
advisory (exit 0 always): artifact-validate, session-state, bg-extractor, cascade-check,
br/ic-change-trigger, handoff-gate, zone-change-trigger, worktree-preflight, completeness-oracle,
gap-classifier, design-artifact-validate, app-map-cascade, integrator journal/scope-guard,
bootstrap-registration.

### 1.4 Orchestrator (runtime над D2T+D3) — judgment-ядро в DS-конверте

| Процесс | Профиль | Детерм. компонента (Layer-3) | Статус |
|---|---|---|---|
| P2 decide-architecture | **JL** (жюри×3) | consilium-synth.cjs (матрица+veto) | impl |
| P3 batch→cc-sdd | PL | coverage-oracle.cjs, C-07 preflight | impl |
| P4 audit-spec-fidelity | **JL** | fidelity-oracle.cjs, design-coverage-oracle.cjs | impl |
| P5 feature-to-tdd-impl | **JL** | gate-risk-classifier / capability-probe / remediation-guard / env-readiness .cjs | impl |
| P6 validate-feature-impl | **JL** (RA×3) | mechanical layer + GO-синтез в коде | impl |
| P7 runtime-smoke-readiness | **JL** | runtime-readiness.cjs verdict-synth | partial |
| run-ledger | **DS** | run.json + ledger.ndjson (wiring prompted) | partial |

Общий паттерн P2-P7: **вердикт из кода, суждение из LLM** — «relay verbatim, do NOT eyeball».
Enforcement самого релея — prompted (нет runtime-проверки, что агент реально запустил CLI).

### 1.5 D7 Meta-improvement (governance над разработкой)

| Процесс | Профиль | Детерм. компонента | Статус |
|---|---|---|---|
| phase-kickoff / closure / patch-cut | PL | check-counts.js, verify-hooks.js | impl |
| live-run-validation (dogfood) | **JL** | executor/reviewer separation | impl(протокол) |
| session-audit-v2 pipeline | **JL** + **DS** | classify.js/effect-probe.js (DS) + LLM-аудитор | impl |
| **process-gate** (commit-msg) | **DS** | **blocking** count/CHANGELOG/DEV_JOURNAL | impl(fragile install) |
| check-counts / rails / next-dec-dev | **DS** | реконсиляторы | impl |
| feedback-intake | **DS** | 3-source dedup (capture-don't-fix) | impl |
| memory-sync | PL | — | impl(manual) |
| pattern-library | JL | — | 7 prov/1 valid |

### 1.6 SPEC/agents/lib/vision/install

| Процесс | Профиль | Примечание | Статус |
|---|---|---|---|
| Deep Discovery (market-researcher/competitor-analyst) | **CL** | субагенты не построены | spec-only |
| Design screen-generator | **CL** | файл отсутствует, inline через skill | spec-only |
| P2.5 Design flow D.1-D.6 | PL | design-artifact-validate.js (DS) | partial |
| **autonomy-policy.cjs** (Epic F1) | **DS** | pure resolver, 70 юнитов, **НЕ wired** | stub |
| CLAUDE.md.template instantiate | DS | устаревшие счётчики 23/33 | partial |
| ecosystem bootstrap/update/verify | PL (гибрид) | namespace-sync, wipe-protection, npm verify (DS) | impl |
| meta-feedback / research | JL | oracle-question, approve-gate | impl/partial |
| information-map-resolver | PL | P3 guard не реализован | partial |
| npm run verify | **DS** | **единственный enforced агрегат-слой** | impl |
| Epic E (до прода) | HD | не начат, зависит от чужих зон | spec-only |

### 1.7 Распределение (по уникальным логическим процессам, ~70)

- **deterministic-scripted:** ~30% — вся hooks-ткань, oracles/synth, verify, process-gate, run-ledger, adapters, autonomy-resolver. **Растущая доля** (Layer-3 паттерн распространяется).
- **procedural-llm:** ~35% — оркестраторы сессий, install-команды, D7-ритуалы, handoff. Механика по шаблону, но с открытыми ветвлениями.
- **judgment-llm:** ~22% — DA review, consilium-жюри, orchestrator P2/P4/P5/P6/P7, drift/pattern-lint, validation-tune, research.
- **creative-llm:** ~3% — Deep Discovery, screen-generation (оба spec-only!).
- **human-decision:** ~10% — делегированные D2T/D3/D4/D5, Epic E, merge-в-main, MDP-выбор.

**Ключ для решения:** DS + PL (механический полюс) ≈ 65% процессов — прямые кандидаты на
FSM-контроль. JL + CL (творческий полюс) ≈ 25% — кандидаты остаться под LLM-судейством. HD ≈ 10% —
жёсткие человеческие гейты (floor). Творческий полюс сейчас **почти целиком spec-only** — то есть
FSM-формализация механического полюса не конфликтует с существующим творческим кодом (его почти нет).

---

## 2. De-facto машины состояний (что уже есть без имени «FSM»)

| # | Машина | Состояния | Хранилище состояния | Кто выполняет переход | Enforced? |
|---|---|---|---|---|---|
| 1 | **Artifact lifecycle** (центральная) | draft→active→deprecated; +requires_review, +blocked | frontmatter `status:` (per-файл, markdown) | draft→active: human approve-гейт + hook-валидация; →requires_review: cascade (hook/LLM); →deprecated: cleanup (LLM+human); →blocked: handoff DoR-гейт | частично (approve-гейт prompted; V-11 fix DS) |
| 2 | **FM status** | planned→in-progress→(shipped) | FM frontmatter | planned→in-progress: F.10 (LLM verify blocking conditions); shipped: внешний; batch-enrich НИКОГДА не двигает (prepare-only) | prompted |
| 3 | **HYP lifecycle** | testing→validated/invalidated | HYP frontmatter | человек (D1.5), H.A.R.M.E.D. | human-gate |
| 4 | **LESSON** (самая FSM-зрелая) | open→(in-progress marker)→active; +withdrawn | frontmatter + in-progress marker-файл (write-ahead) | lesson-capture 6-фаз; терминальный open→active flip | **enforced** (Stop-гейт blocking + PreToolUse/UserPromptSubmit re-surface) |
| 5 | **NFR status** | asked→declined / defined | FM.nfr_status + nfr[] | NFR-review LLM (Ask Y/N/D) | prompted |
| 6 | **Handoff** | ready/partial/blocked; +stale(drift) | handoff frontmatter + artifact_hashes блок | handoff-generator LLM; blocked by DoR; stale detect by handoff-gate.js (hook) | drift-detect DS, регенерация prompted |
| 7 | **DA review** | pending→resolved(act/defer/dismiss) | da-pending.yaml + .da-findings/*.md | hook пишет pending; LLM спавнит subagent; human resolve per-finding | триггер DS, spawn **prompted** |
| 8 | **Cascade dependent** | queued(needs_review/needs_manual_fix)→resolved | cascade-pending.yaml | hook queue; LLM/human via /product:cascade | V-11 fix DS, resolve prompted |
| 9 | **BG candidate** | candidate→accepted/rejected/merged | bg-candidates.yaml + glossary.md + .bg-rejected.yaml | hook queue; human approve | prompted |
| 10 | **Completeness-loop** (явный код-FSM) | SCORE→SURFACE→CLASSIFY→RESOLVE→ESCALATE→RE-SCORE; stop: cap/τ/Δ<ε | in-run (.mjs) + advisor-pending.yaml + pending-actions.md | wave-runner код + deterministic oracle стоп-сигнал | **enforced** (oracle+bound в коде) |
| 11 | **PA (pending-actions)** | open→recommended(consilium)→ratified/closed(owner) | .claude/pending-actions.md PA-NNN (markdown, canonical via git worktree list) | LLM append; consilium update-in-place; **owner ратифицирует (никогда auto)** | запись DS-canon; статус-поле отсутствует; закрытие human |
| 12 | **Orchestrator run** | running→finished(verdict) | runs/<id>/run.json + ledger.ndjson | dispatcher bracket (bash) | **prompted** wiring |
| 13 | **Gate verdicts** | GO/NO-GO/MANUAL_VERIFY; READY_TO_SMOKE/BLOCKED_ON_CAPABILITY/NOT_STARTABLE/ENV_NOT_READY | in-run + PA | детерминированный синтез кода из judgment-входов | **DS-синтез** (инвариант ENV_NOT_READY⇒MANUAL_VERIFY) |
| 14 | **Integrator tool** | absent→profiled→installed/active→deprecated/removed | active-tools.yaml + pmo-mapping.yaml + global profile | add/update/remove (LLM staged + human gate) | staged, human-gate на mutation |
| 15 | **Integrator install stages** | 6-stage add / 5-stage update+remove с rollback | in-run + state-YAML | LLM по промпту, rollback on fail | prompted (rollback описан в промпте) |
| 16 | **Adapter version** | reference vs installed instance (drift D1/D2/D3) | metadata-header (@version/@schema) в instance | update --repair | DS-diff, invoke prompted |
| 17 | **Session continuation** | snapshot-cursor (не настоящие состояния) | .sessions/current.yaml | session-state.js (single writer) | DS-запись; --continue reconcile **judgment-guess** |
| 18 | **Autonomy disposition** | auto/human-gate/block (precedence floor>override>pin>default) | — (in-fn) | autonomy-policy.cjs resolve() | **DS, но НЕ wired** (Epic F1 stub) |

**Наблюдение:** 18 машин де-факто, из них с настоящим enforced-переходом на терминале — только
**#4 LESSON, #10 completeness-loop, #13 gate-verdicts** (и частично #1 через V-11). Остальные держат
переход на prompted-дисциплине LLM. То есть **state-model уже разлит по системе, но transition-guards
почти нигде не формализованы** — классический сигнал «пора вводить statechart».

---

## 3. Где FSM-формализация даст профит vs где повредит

### 3.1 ПРОФИТ (механический полюс, потеря состояния, забытые pending)

1. **Signal→action gap (главный).** Хуки #7/#8/#9 (da-/advisor-/cascade-pending) пишут сигнал, но
   спавн subagent/resolution — prompted. FSM с явным состоянием «pending review», **блокирующим
   переход артефакта draft→active** до resolution, конвертирует prompted→enforced. Это ровно
   генерализация уже работающего LESSON-паттерна (#4) на всю pending-ткань. **Наивысший ROI.**
2. **Artifact lifecycle (#1) как единый ESM.** Сейчас `status:` парсится ~6+ независимыми regex в
   разных хуках (риск дрейфа формата, прецедент DEC-DEV-0023). Одно определение ESM с
   валидируемыми transition-guards убирает разъезд парсеров и даёт единую точку истины перехода.
3. **FM planned→in-progress→shipped (#2).** Условия F.10 сейчас проверяет LLM прозой; FSM-guard
   сделает переход детерминированным и защитит от «case, когда batch-enrich случайно двинет статус».
4. **Cross-session recovery (#17).** «heuristic reconcile» на --continue — judgment-догадка; ESM с
   персистентным current-state делает восстановление после разрыва детерминированным (перекликается
   с глобальным «Recovery after interruption» правилом владельца).
5. **Забытые pending / истёкшие overrides.** Нет watchdog; periodic-мониторинг (§3.5) не построен;
   `approve_overrides.expires_at` никем не сметается; audit-index.md держит незакрытые Pending.
   Statechart-таймауты (`after`/deadline-переходы) закрывают этот класс напрямую.
6. **Orchestrator run/gate (#12/#13).** Вердикты уже детерминированно синтезируются кодом;
   формализация как явных FSM-состояний усиливает observability и решает prompted-wiring run-ledger
   (переход `running→finished` становится частью машины, а не bash-обёрткой по памяти).
7. **Integrator staged install + rollback (#15).** Канонический FSM (стадии + rollback-на-fail) —
   учебный кейс statechart; убирает «rollback описан в промпте, но не гарантирован при прерывании».
8. **PA lifecycle (#11).** Сейчас нет поля состояния — только markdown-блоки; FSM (open→recommended→
   ratified) даёт трекинг и закрывает «PA висит, никто не прочитал».
9. **Autonomy resolver (#18).** Уже pure-deterministic резолвер диспозиций (built, unwired) —
   идеальный guard-слой statechart: определяет, какой переход требует human-gate/block/auto.

### 3.2 ВРЕД / низкая ценность (творческий полюс, судейство, итерации)

1. **Контент judgment-состояний.** DA 6-lens findings, consilium-делиберация жюри, drift-check,
   pattern-lint, NFR-суждение — это **контент**, а не переход. FSM должен обрамлять их
   (запущено ли жюри? ратифицирована ли рекомендация?), но НЕ управлять шагами суждения.
2. **Creative-llm (Deep Discovery, screen-generation).** Открытая генерация; step-level FSM добавит
   церемонию без ценности. (Плюс оба сейчас spec-only — формализовать нечего.)
3. **Итеративный design-refinement (D.3), hypothesis formulation.** Творческие циклы; их достаточно
   **ограничивать** (bounded-wave cap, как completeness-loop), но не разбивать на детерминированные
   переходы.
4. **Judgment-чеклисты kickoff/closure/research.** Procedural, но человеко-судейски-нагруженные;
   сверх-формализация снижает адаптивность.

### 3.3 Архитектурный шов (прямой ответ на гипотезу владельца)

**FSM/statechart управляет КОНВЕРТОМ** (lifecycle-состояния, disposition гейтов, pending→resolved,
run-status, escalation-ledger, staged-install+rollback, autonomy-guard) — детерминированный
механический слой. **LLM-судейство/творчество наполняет КОНТЕНТ** состояний, помеченных JL/CL.
Extended-state (guards на числовых/структурных переменных: score≥τ, coverage=1.0, hash-match,
env-ready, magnitude≥threshold) уже вычисляется детерминированными oracle/synth `.cjs` — они
буквально готовые guard-функции для ESM. Гипотеза владельца **эмпирически подтверждается**: код уже
разделён на deterministic-`.cjs` (вердикт) + judgment-LLM (контент), просто без унифицирующей
машины состояний.

---

## 4. Инвентарь хранилищ состояния как «extended state»

| Хранилище | Формат | Что держит | Писатели | Консистентность как ext-state |
|---|---|---|---|---|
| **frontmatter `status:`** | markdown YAML-FM | первичная переменная состояния артефакта (#1-#6) | approve-гейт, hooks, cleanup, LLM | **средняя**: нет схемы, ~6+ независимых regex-парсеров, дрейф формата уже случался (DEC-DEV-0023) |
| **.pending/*.yaml** (6+: validation-/cascade-/bg-candidates/da-/advisor-/app-map-) | YAML-очереди | сигналы «ожидает действия» | ≥6 хуков ad-hoc | **низкая**: нет общей I/O-либы, копипаст-парсеры, источник прошлых багов, dedup молча перезаписывает без watchdog |
| **.sessions/current.yaml** | YAML-cursor | continuation-снапшот + git HEAD | session-state.js (single writer) | **высокая на запись / низкая на recovery**: reconcile — judgment-guess |
| **pending-actions.md** (PA-NNN) | markdown-блоки | cross-zone escalation ledger | LLM(множ.), consilium, scope-guard | **средняя**: canonical via git worktree list (хорошо), но нет status-поля, парс — markdown-регексом, реакция human-memory |
| **run-ledger** (run.json + ledger.ndjson) | JSON + NDJSON | per-run трейс (duration/model/verdict) | dispatcher bracket | **высокая по содержанию / низкая по покрытию**: детерминированно, но wiring prompted — забудут обернуть, трейса не будет без предупреждения |
| **git** (log/reflog/blob-SHA) | git | абсолютная истина статуса (INFORMATION-MAP authority) | commits | **высшая**: SSOT при конфликте; но не машинно-связан с frontmatter-состояниями |
| **.da-findings/ .advisor-findings/ .decisions/journal.md** | markdown | контент findings + DEC-AUTO/решения | subagents, runners | лог, не state; консистентность schema-verified в runner |
| **validation-config.yaml / product.yaml** | YAML config | severity-overrides, tier, product_class | validation-tune, bootstrap | конфиг-состояние; re-stamp только ecosystem_version |
| **active-tools.yaml / pmo-mapping.yaml** | YAML | Integrator tool-lifecycle (#14) | add/update/remove | согласованный state-набор, но без staleness-check против .product/ |

**Вердикт по «extended state»:** состояние **фрагментировано по ~9 гетерогенным хранилищам в ≥4
форматах** (markdown-frontmatter, YAML-очереди, NDJSON, markdown-ledger, git, JSON) с **нулевой
унифицирующей схемой, без единого reader/writer и без единой транзакционной границы**. Это главный
технический аргумент ЗА введение Extended State Machine: ESM даёт (1) единую типизированную
extended-state-переменную вместо 9 разрозненных, (2) валидируемые guards поверх уже существующих
`.cjs`-oracle, (3) явные transition-точки вместо prompted-дисциплины, (4) таймаут/deadline-переходы
против забытых pending. Против — только там, где текущий формат намеренно человеко-читаем
(markdown-frontmatter, pending-actions.md как ledger для владельца): ESM-слой должен **надстраиваться
над** этими файлами (проецировать в них), а не заменять их, иначе теряется человекочитаемость и git-
дружелюбность, которые владелец ценит.

---

## 5. Риски/оговорки охвата (честная граница)

- «Enforced» у гейтов означает «код-хук выполняется харнесом», НЕ «переход невозможно обойти» — все
  «hard» approve-гейты (add Stage2, research Step7, DA dismissal) — поведенческие; research Step7 уже
  реально нарушался тихой авто-цепочкой (пилот 2026-05-27).
- Ряд машин помечены partial/spec-only самим проектом (P7 boot-leg, autonomy-wiring, feedback-loop,
  Deep Discovery, screen-generator) — FSM их не «спасёт», это отсутствующий субстрат, не отсутствующая
  машина состояний.
- Точный механизм блокировки artifact→active при 🔴 DA-dismissal без rationale не найден построчно
  ридерами — reliability связи #7 не полностью верифицирована.
- process-gate (единственный blocking D7-гейт) enforced только в checkout, где вручную запущен
  install-pre-commit.sh (.git/hooks не версионируется) — сам «enforcement» fragile.

---

## Короткий ответ

Система **уже расщеплена по линии гипотезы владельца**: ~65% процессов — механический полюс (DS+PL) с
детерминированными `.cjs`-oracle/synth/hook, ~25% — творческий полюс (JL+CL, причём CL почти весь
spec-only), ~10% — человеческие floor-гейты. Существует **18 машин состояний де-факто**, но настоящий
enforced-переход есть лишь у 3 (LESSON, completeness-loop, gate-verdicts) — остальные держатся на
prompted-дисциплине. Statechart/ESM даст максимальный профит на **механическом конверте**
(lifecycle-статусы, disposition гейтов, pending→resolved, run-status, staged-install+rollback,
autonomy-guard) — там уже готовые guard-функции и налицо «signal→action» разрыв и фрагментированное
по 9 хранилищам состояние; и повредит, если полезет **внутрь** judgment/creative-контента (DA-жюри,
consilium, drift/pattern-lint, дизайн-итерации). Extended state сегодня несогласован (≥4 формата, нет
единой схемы/writer) — это сильнейший технический аргумент за ESM, но надстраивать её надо НАД
человекочитаемыми markdown/git-файлами, а не вместо них.
