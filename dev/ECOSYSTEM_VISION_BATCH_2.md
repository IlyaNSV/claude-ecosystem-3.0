# Ecosystem Vision — Wave B (full completeness-loop) · Execution Batch (next-session work-order)

> **Назначение:** самодостаточный execution-brief для следующей сессии. Реализует **полную волну Epic B** принятого [ECOSYSTEM_VISION.md](ECOSYSTEM_VISION.md): докрутка bounded completeness-loop из `v1 core/skeleton` (Increment 1) в **рабочий, откалиброванный на пилоте** механизм доведения спеки D1-D2B до handoff-DoR.
> **Статус:** `ready-to-run` (2026-07-01). Kickoff = DEC-DEV-0134. Vision принят (`accepted`).
> **Граница:** own-zone (Product/Design + cross-cutting). Epic D (консилиум-escalation-channel) и F2/C — НЕ здесь (граф §5.1 vision, позже `(C ∥ D)`). **`orchestrator/` не трогать** без сверки с оркестратор-треком.
> **Принцип коммитов:** каждый пункт = отдельный коммит на чистом шве → разрыв стоит ≤1 пункт. Блокирующий `commit-msg` gate активен — соблюдай §Process-обязательства.

---

## 0. Goal & scope

**Цель батча:** превратить completeness-loop из `skeleton` (SCORE→SURFACE→CLASSIFY→RESOLVE→ESCALATE→RE-SCORE описан, но RESOLVE намеренно conservative) в **рабочую полную волну B**: надёжная loop-инфраструктура + детерминированный wave-runner + close-out делегатов + пилот-калибровка того, что безопасно авто-резолвить.

**Рычаг:** фронт пайплайна — полнота/точность спеки D1-D2B, где ошибки компаундируются вниз (METR/error-compounding). Это `rychag #1` vision.

**Что УЖЕ готово (НЕ строить заново):**
- ✅ **Epic A** — 3 персоны `architect/qa/ux-advisor` + `zone-router.cjs` + `zone-routing.yaml` (live-validated, DEC-DEV-0115).
- ✅ **B1-core** — `completeness-oracle.cjs` (детерминир. DoR-scorer B1-B4/B7) + `/product:complete` + `completeness-loop.md` (wave-контракт + stop-contract enforced).
- ✅ **B4 loop-readiness audit** — `dev/LOOP_READINESS_AUDIT.md` статус `complete` (2026-06-24): P1/P2/P2.5 размечены 🟢 loop-body / 🟠 idem-critical / 🔴 gate. **Это ground-truth для того, что RESOLVE вправе авто-фиксить.**

**Порядок (degrade-gracefully):** Step 0 (kickoff — этот файл) → **B-a** (loop-надёжность) → **B-b** (durable runner) → **B-c** (close-out) → **B-d** (пилот-калибровка). Committed-target = **B-a → B-b**; **B-c/B-d = stretch/pilot-gated** (B-d требует живых данных).

**НЕ в этом батче:** Epic D консилиум-escalation-channel (позже); F2/F3; C; полная авто-fix широта без пилот-данных; cross-session durable engine (n8n/cron — см. развилка «б»).

---

## Owner-развилки — зафиксированы на kickoff (DEC-DEV-0134)

| # | Развилка | Решение | Rationale |
|---|---|---|---|
| **а** | Сразу полная волна B или B ∥ F1? | **Сразу B; F1 отложен** | F1 (autonomy L0/L1) не блокирует B — loop идёт в дефолт L1-Supervised (RUN 01: 23/26 без гейта). F1 требует сверки gate-контракта с оркестратор-треком → отдельный координируемый трек. |
| **б** | Durable engine: in-harness Workflow или n8n/cron? | **in-harness Workflow** (`pipeline()`) | Волна B = session-scope (границы фаз — не cross-session). n8n избыточен до реальной cross-session потребности (vision §10). Wave-runner = Workflow-скрипт, детерминированная оркестрация. |
| **в** | Auto-fix: conservative или real-resolve? | **conservative → калибровать на пилоте** | Real-resolve расширяется ТОЛЬКО по B4-разметке (🟢 loop-body безопасно) + живым пилот-данным. verify-before-act + idempotent-keyed — обязательны (rail 4/5). |
| **г** | B4-audit первой задачей? | **снято — B4 уже `complete`** | Факт-чек 2026-07-01: `dev/LOOP_READINESS_AUDIT.md` покрывает P1/P2/P2.5. Первая задача → **B-a** (loop-надёжность), не B4. |

---

## B-a — Loop-надёжность *(committed; нет внешних зависимостей; детерминир. стройка)*

Закрывает дефекты, всплывшие на live-run completeness-loop (V-2 re-run `a2aaf44a`), — без них полная волна ненадёжна в worktree/параллельном контексте.

- [ ] **FB-LR-28 fix — path-anchoring в SURFACE.** Брифы персон строят пути относительно **resolved feature-root/cwd прогона**, не микс worktree-absolute + main-checkout-absolute. Latent-риск: materially-edited файл по main-checkout пути → тихое stale-чтение (нет not-found → нет self-heal). Источник: `skills/product/completeness-loop.md` SURFACE + spawn-механика.
- [ ] **FB-LR-29 fix — ESCALATE пишет canonical PA.** Product-gate ESCALATE-нога переиспользует **PA_CANON**-резолюцию (DEC-DEV-0113), а не worktree-local `pending-actions.md`. Решение open-question FB-LR-29: product-gate PA **шарят единый canonical ledger** (иначе latent PA-id divergence при параллельном orchestrator-ране). Портировать 0113-guard из orchestrator P4/P5/P6 в product completeness-loop ESCALATE.
- [ ] **Advisor-findings persistence — из контракта в реализацию.** Skill описывает `.product/.advisor-findings/<persona>-<ARTIFACT-ID>.md` (keyed, не timestamped) — убедиться, что запись реально происходит + идемпотентна (re-run перезаписывает, не плодит).

**Acceptance:** loop в worktree-контексте — пути консистентны, PA идёт в canonical ledger, findings пишутся keyed. Smoke на изолированном worktree пилота повторяет условия `a2aaf44a` без FB-LR-28/29.
**Process:** `fix:` → 🔒 DEV_JOURNAL (root cause + lesson) на каждый; CHANGELOG если тронута consumer-zone (`skills/`, `hooks/`, `commands/`).

---

## B-b — Durable wave-runner (in-harness Workflow) *(committed; коннект: B-a)*

- [ ] **Wave-runner как Workflow-скрипт** (`pipeline()`/`parallel()`): оборачивает SCORE → SURFACE (fan-out персон по зонам) → CLASSIFY → RESOLVE → ESCALATE → RE-SCORE в детерминированную оркестрацию волн с bounded-loop (cap ∧ (score≥τ ∨ Δ<ε ∨ info-gain→0)). Сейчас wave — harness-driven проза в skill; обернуть в исполняемый скрипт.
- [ ] `/product:complete` вызывает runner (session-scope). Cross-session (n8n) — НЕ строим (развилка «б»).
- [ ] Идемпотентность шагов — по разметке `LOOP_READINESS_AUDIT.md` (🟢 vs 🟠 keyed-update vs 🔴 escalate).

**Acceptance:** `/product:complete <FM>` детерминированно гоняет N≤max_waves волн, останавливается по bounded-контракту, эмитит completion-report (score, blockers, escalated, delegated_unverified). Smoke: фикстура с oracle<1 → волна доводит резолвимое, эскалирует decision, честно стопает un-met.
**Process:** новая/изменённая команда → `commands/ecosystem/verify.md` (Step 4 + summary); CHANGELOG; DEV_JOURNAL (design-выбор runner-топологии).

---

## B-c — Close-out делегатов B5/B6/B8 *(stretch; коннект: B-b)*

- [ ] На stop волны — авто-триггер делегированных валидаторов, что oracle помечает `delegated_unverified`: `/product:bg-review` (B5 BG covers bold terms), `/product:validate` (B6 V-01..V-11 + B8 RPM covers SC.actors). Не «молча посчитать пройденным» (rail 5, no silent truncation).
- [ ] Completion-report показывает статус B5/B6/B8 явно (surface, не скрывать).

**Acceptance:** loop-completion не оставляет delegated-блокеры невидимыми; report явно перечисляет, что проверено делегатом, что осталось.
**Process:** CHANGELOG; DEV_JOURNAL если non-trivial.

---

## B-d — Real-resolve пилот-калибровка *(pilot-gated; коннект: всё выше)*

- [ ] **Dogfood-цикл** на `my-first-test`: `/product:complete` на **под-специфицированной фиче** (реальный oracle `score<1` gap — НЕ срежиссированный флаг; урок FB-LR-26). Триггер = настоящий DoR-дефицит (напр. active SC без VC = B4-gap).
- [ ] По результатам — **откалибровать широту авто-RESOLVE**: какие 🟢 loop-body деривации (missing VC для active SC; unlinked LC state; RPM role из SC.actors) безопасно авто-фиксить с verify-before-act, а какие оставить escalate. Расширять conservative → tuned **только по живым данным** (развилка «в»).
- [ ] Grade post-hoc (executor/reviewer separation, [[feedback_separate_task_from_test]]): sensitivity (нашёл реальные gaps) + specificity (не выдумал VC — verify-before-act держит).

**Acceptance:** RESOLVE-широта обоснована пилот-данными, не догадкой; 0 сфабрикованных артефактов; loop остаётся bounded+honest.
**Process:** DEV_JOURNAL (калибровочные решения + grade); ledger FB-LR если находки.

---

## Design-входы из P2 profiling study (DEC-DEV-0132 — учесть в SURFACE)

FB-LR-31/32 (ledger) — про Epic D консилиум, но применимы к multi-persona SURFACE-фазе B:
- **FB-LR-31 (lossy brief):** персоны должны видеть **сырьё артефакта**, не lossy-lifted summary — иначе роняют load-bearing факты. SURFACE передаёт персоне сырой артефакт + upstream, не пересказ.
- **FB-LR-32 (distributed-veto):** независимая фикс-линзовая оценка + детерминир. сумма может пропустить **распределённый** дефект, который ловит холистический проход. Для B: при агрегации findings персон — не только объединять, но и искать паттерн, видимый только через линзы вместе.

---

## Вне батча (зафиксировано)

- **Epic D** — консилиум как жюри для decision-эскалаций (готовит решение, не решает). `consilium-synth.cjs` уже есть (P2). Идёт `(C ∥ D)` после B.
- **F1-core** — autonomy resolver (`lib/autonomy-policy.cjs` + L0/L1 + override): координируемо, нужна сверка gate-контракта с оркестратор-треком (`gate-risk-classifier`/`env-readiness`).
- **Cross-session durable** (n8n/cron) — по факту потребности (развилка «б»).

---

## Process-обязательства батча

| Триггер | Обязательство (🔒 = enforced commit-msg gate) |
|---|---|
| `fix:` (B-a) | 🔒 DEV_JOURNAL (root cause + lesson) + CHANGELOG если consumer-zone |
| изменил команду/скилл/хук | `commands/ecosystem/verify.md` (Step 4 + summary) + обзорные шаблоны (DEC-DEV-0082) |
| добавил validation-правило | 🔒 count-sweep `node dev/meta-improvement/scripts/check-counts.js` зелёный |
| архитектурный выбор ≥2 вариантов (runner-топология, resolve-широта) | DEV_JOURNAL |
| `feat:` consumer-zone | 🔒 CHANGELOG `[Unreleased] ### Added` |

Обход gate — только осознанно `[skip-process-gate]`.

---

## Boundary & risks

- **Не трогать `orchestrator/`** без сверки с оркестратор-треком (F1/gate-контракт).
- **B-d pilot-gated:** не калибровать real-resolve без живых данных (FB-LR-26 антипаттерн — срежиссированный триггер тестит вхолостую).
- **DEC-DEV-номер** для новых записей — сверить `git fetch origin` live (параллельные сессии жгут номера; на 2026-07-01 next-free после 0134 = 0135, но verify).
- **Worktree для параллельной безопасности:** guide-сессия активна; kickoff-стройку вести в worktree или с branch-guard перед каждым commit ([[env_parallel_sessions_share_checkout]]).

## Resume / recovery

После прерывания: `git status` + `git log` на ветке → последний завершённый пункт по коммитам → продолжай со следующего (чек-боксы = карта прогресса). Верифицируй фактическое состояние, не доверяй памяти о последнем шаге.
