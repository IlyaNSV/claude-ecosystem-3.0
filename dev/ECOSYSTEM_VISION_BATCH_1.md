# Ecosystem Vision — Increment 1 · Execution Batch (next-session work-order)

> **Назначение:** самодостаточный execution-brief для **следующей сессии экосистемы**. Берёшь и прогоняешь по порядку. Реализует первый, **независимый от параллельной оркестратор-сессии** инкремент принятого [ECOSYSTEM_VISION.md](ECOSYSTEM_VISION.md): фундамент Epic A + аудит B4 + ядро B1 («с небольшими коннектами», решение владельца 2026-06-23).
> **Статус:** `ready-to-run` (2026-06-23). Vision принят (`accepted`, §7 10/10 решены).
> **Граница:** own-zone (Product/Design + cross-cutting). **Ни один файл `orchestrator/` не трогать.** F1-core вынесен из батча (нужна сверка gate-контракта с оркестратор-сессией) — см. §«Вне батча».
> **Принцип коммитов:** каждый пункт = отдельный коммит на чистом шве → разрыв/прерывание стоит ≤1 пункт (recovery-discipline). Блокирующий `commit-msg` gate (`process-gate.js`) активен — соблюдай §«Process-обязательства».

---

## 0. Goal & scope

**Цель батча:** получить за сессию работающий **Epic A целиком** (профильные персоны + zone-routing) + **аудит loop-readiness (B4)** + **детерминированное ядро Epic B1** (completeness-oracle + bounded-loop скелет). Это фронт пайплайна — рычаг качества входа, независимый от оркестратор-трека и незакрытых фаз ROADMAP.

**Порядок (degrade-gracefully):** Step 0 (kickoff+формализация) → B4 → A1(+A3) → A2 → B1. Committed-target = **Step 0 → A2**; **B1 = stretch** (если не влезает — чистый стоп после A2, B1 переносится).

**НЕ в этом батче:** F1-core (координируемо), минимальный B-пилот на `my-first-test` (отдельный dogfood), C / D / F2 / E (позже по графу §5.1 vision).

---

## Step 0 — Kickoff + формализация (открывает батч)

Старт Epic A = тот самый kickoff, на который мы отложили формализацию (vision §8, вариант I).

- [ ] **DEC-DEV-номер — согласовать ПЕРЕД записью (live-проверка обязательна).** Проверь `git log` своей ветки + `main` + хвост `DEV_JOURNAL.md` (параллельная оркестратор-сессия жжёт номера — на момент написания 2026-06-23 была ~на **0095/PR #44**, P5 T5 в работе; число **устаревает — сверь live**; прецедент двойного 0082). Возьми следующий свободный.
- [ ] **D7 phase-kickoff:** пройди `dev/meta-improvement/checklists/phase-kickoff.md` для «Autonomous Pipeline Vision — Increment 1».
- [ ] **DEC-DEV-запись** в `DEV_JOURNAL.md`: vision принят (эпики A-F); Increment 1 = A+B4+B1-core; rationale + отвергнутые альтернативы (открытый loop / консилиум-как-замена-человека / end-to-end автономия — все отвергнуты по ресёрчу §4 vision).
- [ ] **ROADMAP.md:** новая секция **«Autonomous Pipeline Vision (epics A-F)»** (НЕ Phase-N — cross-module), статусы эпиков, Increment 1 = in-progress.
- [ ] **Memory:** обнови `project_ecosystem_vision_proposal.md` (resume → «Increment 1 started»).

**Acceptance:** kickoff пройден, DEC-DEV с согласованным номером записан, ROADMAP-секция есть.

---

## B4 — Аудит процессов на loop-readiness *(нет зависимостей; чистая аналитика; информирует B1)*

- [ ] Пройти P1 (D1.1-D1.8) / P2 (F.1-F.10) / P2.5 (D.1-D.6) по `docs/pmo/processes.md`.
- [ ] Для каждого шага разметить: **loop-safe? / нужна идемпотентность / нужен гейт** + почему (учесть idempotency-дыру orchestrator §2-bis: крэш между write и commit → перезапуск поверх).
- [ ] Выход: `dev/LOOP_READINESS_AUDIT.md` — таблица «шаг → диспозиция → предохранитель».

**Acceptance:** таблица покрывает все шаги P1/P2/P2.5; явно помечены шаги, требующие идемпотентного дизайна для B1.
**Связь:** результат — вход для стоп-условий и идемпотентности B1.

---

## A1 (+A3) — 3 профильные персоны *(нет зависимостей; авторинг по конвенции DA)*

- [ ] Создать 3 агент-файла по конвенции `agents/product/devils-advocate.md` (frontmatter `name/description/tools/model` + Role «You ARE / You are NOT» + structured-verdict schema + adaptive-depth cosmetic/significant + anti-patterns + heterogeneous prior):
  - `agents/product/architect-advisor.md` — prior: feasibility / структурная декомпозиция / тех-риск (предвестник D2-T01/T02).
  - `agents/product/qa-advisor.md` — prior: тестируемость / acceptance / edge-cases (питает VC/IC, зона D4).
  - `agents/design/ux-advisor.md` — prior: usability / flows / состояния (зона D2-B04). ⚠ директории `agents/design/` ещё нет — создать.
- [ ] **A3:** применить `da-subagent-type-contract` (`dev/meta-improvement/patterns/`) — canonical `subagent_type` всегда, «не найден» = loud error, **никакого silent fallback** на general-purpose.
- [ ] **Гетерогенность обязательна** (§4 vision кластер 2): каждая персона — отличный prior, иначе groupthink.

**Acceptance:** 3 файла валидны по конвенции; type-contract применён; priors различны.
**Process-обязательства:** CHANGELOG `### Added` (consumer-zone); обнови `commands/ecosystem/verify.md` (Step 4 + summary — добавлены агенты, DEC-DEV-0082); проверь обзорные шаблоны (`status.md`, `docs/MAP.md`); прогони `node dev/meta-improvement/scripts/check-counts.js` (зелёный).

---

## A2 — zone→agent routing *(коннект: нужен A1)*

- [ ] **Манифест** `zone → agent(s)` (agent-side, аналог `pmo-mapping.yaml`): какой шаг/зона → какие персоны firing.
- [ ] **Детерминированный роутер** (`.cjs` оракул, не суждение): по затронутой зоне + magnitude (adaptive-depth) возвращает список персон.
- [ ] **Хук** по паттерну `hooks/product/{br,ic}-change-trigger.js`: PostToolUse на `.product/`-зонах → пишет `*-pending.yaml` + stderr-signal «спавни персону X» → процесс/скилл спавнит canonical `subagent_type`.
- [ ] Регистрация в `hooks/<module>/manifest.yaml`; smoke-тест роутера.

**Acceptance:** изменение в зоне → роутер детерминированно выбирает правильную персону; firing **только** при затронутой зоне И magnitude ≥ порога (не жечь панель на тривиальном).
**Process-обязательства:** добавлен хук → `verify.md` update + `manifest.yaml`; CHANGELOG.

---

## B1 — completeness-oracle + bounded-loop скелет *(stretch; коннект: A1/DA + B4)*

- [ ] **`lib/completeness-oracle.cjs`** (детерминир.): покрытие `validation.md` + handoff DoR-checklist → `completeness score` + список gaps/ambiguities. **Граница «достаточности» = score ≥ τ, τ привязан к DoR** (не к «идеалу»).
- [ ] **Bounded-loop скелет** (skill `skills/product/completeness-loop.md` + опц. Workflow): волна = (персоны A1/DA по артефактам) → (gaps: разрешимо-авто vs decision) → (авто-фикс с verify-before-act; decision → эскалация). **Стоп = max-waves cap И (score ≥ τ ИЛИ Δscore < ε ИЛИ info-gain→0).**
- [ ] **`/product:complete <scope>`** — command-stub (вызов loop).
- [ ] Идемпотентность шагов loop — по разметке B4.

**Acceptance:** oracle считает score + gaps детерминированно; loop останавливается по bounded-критерию (никогда не само-оценка генератора как единственный стоп — §4 vision кластер 1); пишет, что осталось недо-разрешённым (no silent truncation).
**Process-обязательства:** если добавлены validation-правила → count-sweep (`check-counts.js`); новая команда → `verify.md` update; CHANGELOG; DEV_JOURNAL (design-выбор стоп-критерия).

---

## Вне батча (зафиксировано, чтобы не потерять)

- **F1-core** (autonomy resolver `lib/autonomy-policy.cjs` + config-схема + L0/L1 + override + audit-trail): строится независимо, **НО** wiring к risk-tier = сверить gate-контракт с оркестратор-сессией (`gate-risk-classifier`/`env-readiness`). → отдельный координируемый пункт, можно подтянуть в батч, если успеешь сверку.
- **Минимальный B-пилот на `my-first-test`**: отдельный dogfood-цикл после B1 (принцип «pilot после инкремента»).
- **C / D / F2 / E**: позже по графу §5.1 vision. E — зона оркестратор-трека (контракт-ограничения уже в vision Epic E).

---

## Process-обязательства батча (чтобы не словить блокирующий gate)

| Триггер в батче | Обязательство (🔒 = enforced commit-msg gate) |
|---|---|
| `feat:` агенты/хуки/команда (consumer-zone) | 🔒 CHANGELOG `[Unreleased] ### Added` |
| добавил агента/хук/команду | `commands/ecosystem/verify.md` (Step 4 + summary) + обзорные шаблоны (DEC-DEV-0082) |
| добавил validation-правило (возможно в B1) | 🔒 count-sweep `check-counts.js` зелёный |
| архитектурный выбор ≥2 вариантов (стоп-критерий B1, priors персон) | DEV_JOURNAL |
| `fix:` если по ходу | 🔒 DEV_JOURNAL + CHANGELOG если consumer-zone |

Установить gate (если ещё нет): `bash dev/meta-improvement/scripts/install-pre-commit.sh`. Обход — только осознанно `[skip-process-gate]`.

---

## Boundary & risks

- **Не трогать `orchestrator/`, `docs/orchestrator-module/`, `skills/orchestrator/`** — зона параллельной сессии.
- **DEC-DEV-номер** — согласовать до записи (Step 0).
- **F1 wiring** — не делать без сверки gate-контракта.
- **Размер:** полный батч (Step0→B1) амбициозен для одной сессии; committed = Step0→A2, B1 = stretch. Останавливайся на чистом шве (коммит per-пункт).

## Resume / recovery

После прерывания: `git status` + `git log` на ветке → определи последний завершённый пункт по коммитам → продолжай со следующего (не переделывай закоммиченное). Чек-боксы выше = карта прогресса.
