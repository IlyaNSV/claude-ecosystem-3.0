# Orchestrator Module

> **Роль:** «Тимлид PMO» — runtime-владелец зон D2-Technical + D3 и выше. Берёт PMO-процесс
> и проводит его end-to-end, оркеструя role-агентов и инструменты по регламентам.
> **Спецификация:** [`docs/orchestrator-module/SPEC.md`](../docs/orchestrator-module/SPEC.md).
> **Эмпирика:** [`dev/ORCHESTRATOR_DOGFOOD_RUN_01.md`](../dev/ORCHESTRATOR_DOGFOOD_RUN_01.md) (RUN 01 harvest).
> **Статус:** P3 `batch-features-to-cc-sdd` (S5a, DEC-DEV-0076) + P5 `feature-to-tdd-impl`
> (S5b, DEC-DEV-0077) — гибрид над cc-sdd. Инкремент N+1: P4 `audit-spec-fidelity` (pre-impl
> fidelity-гейт, DEC-DEV-0084) + full P6 `validate-feature-impl` (feature GO-gate, DEC-DEV-0085;
> P5 делегирует feature-гейт в P6 через `workflow()`). §6 capability detect-leg (DEC-DEV-0117) +
> P7 `runtime-smoke-readiness` readiness-leg (DEC-DEV-0120) — «тесты зелёные ≠ приложение
> стартует»; живой boot + полный Epic E (deploy) — substrate-gated (нужен Integrator D3-runtime).
> P2 `decide-architecture-foundation` (DEC-DEV-0129) — консилиум-гейт: жюри ×3 (velocity/
> fidelity/integrity) → scored recommendation + DRAFT DEC владельцу (рекомендация, не авто-решение).

## Принцип: оркеструем, не переписываем (DEC-DEV-0076)

Оркестратор **не дублирует** машинерию инструментов, которые завёл Интегратор. cc-sdd
уже умеет генерить спеки волнами с cross-spec review (`kiro-spec-batch`), вести steering
(`kiro-steering`), делать adversarial-review реализации (`kiro-review`). Оркестратор это
**вызывает** и добавляет лишь то, чего у инструмента нет:

1. **Мост из Product-домена** — `handoff → brief.md + roadmap.md`. Это программная замена
   `kiro-discovery` (тот `disable-model-invocation` + интерактивный → недоступен из
   Workflow). cc-sdd ничего не знает про handoff'ы Product-модуля.
2. **Детерминированные гейты, которых нет у инструмента** — content-fidelity preflight
   (адаптерный C-07) и независимый **coverage-oracle** (код по ground-truth, не self-report).
3. **Durable-скелет** — in-harness Workflow, чьи границы фаз переживают `/compact`
   (сильнейший структурный аргумент за модуль, P0-3 RUN 01).

Layer-1 (скелет процесса) и Layer-3 (гейты) — наши и детерминированы. Layer-2 (суждение:
авторинг спеков, cross-spec review) — делегирован cc-sdd.

## Структура

```
orchestrator/
├── README.md                       # этот файл
├── processes/                      # Workflow-скелеты (.mjs, in-harness)
│   ├── decide-architecture-foundation.mjs  # P2 — консилиум-гейт: жюри ×3 → recommendation владельцу (DEC-DEV-0129)
│   ├── batch-features-to-cc-sdd.mjs   # P3
│   ├── feature-to-tdd-impl.mjs        # P5 (делегирует feature-гейт в P6; §6 detect-leg pre-flight)
│   ├── audit-spec-fidelity.mjs        # P4 — pre-impl fidelity-гейт (spec vs .product)
│   ├── validate-feature-impl.mjs      # P6 — feature GO-gate (suite+build + 3 валидатора)
│   └── runtime-smoke-readiness.mjs    # P7 — «стартует ли dev?» readiness-гейт (boot=substrate-gated)
├── charters/                       # Process Fabric: декларативные statechart'ы линий (JSON)
│   └── feature-production-line.json   # сквозная линия фичи P3→P7 (DEC-DEV-0153)
└── lib/                            # детерминированные хелперы (.cjs, Node stdlib)
    ├── coverage-oracle.cjs            # P1-1 независимый ID-coverage оракул (P3; backbone RA-8)
    ├── fidelity-oracle.cjs            # P4 trace-integrity (spec-refs ⊆ .product ground-truth)
    ├── gate-risk-classifier.cjs       # P0-2 предикат тяжести гейта HIGH/LOW (P5)
    ├── capability-probe.cjs           # §6 detect-leg: disposition external_capabilities (P5; DEC-DEV-0117)
    ├── runtime-readiness.cjs          # P7 readiness-ядро: run-target + §6 boot-caps + env → verdict (DEC-DEV-0120)
    ├── consilium-synth.cjs            # P2 синтез-ядро: matrix + rank + veto-по-blocking → recommendation (DEC-DEV-0129)
    ├── design-coverage-oracle.cjs     # T4 design→tasks coverage гейт (P6; DEC-DEV-0095)
    ├── remediation-guard.cjs          # T5 guardrails починочного раунда (P6; DEC-DEV-0096)
    ├── env-readiness.cjs              # env-probe субстрата (P6/P7; DEC-DEV-0092/0112)
    ├── run-ledger.cjs                 # durable run-журнал: bracket start/finish вокруг каждого прогона (DEC-DEV-0147)
    ├── fabric-engine.cjs              # Process Fabric: event-sourced интерпретатор charter'ов (DEC-DEV-0153)
    └── autonomy-policy.cjs            # F1 autonomy-resolver (floor); потребляется fabric-prescriptions (DEC-DEV-0154)

skills/orchestrator/                # регламент-методология (lazy-loaded)
├── orchestrator-init.md            # P1 — сбор контекста + resume после /compact
├── build-steering.md               # P3 — делегирует kiro-steering
├── build-briefs-from-handoff.md    # P3 — мост handoff→brief.md/roadmap (замена kiro-discovery)
├── coverage-oracle.md              # P3 — детерминированный coverage-гейт
├── gate-risk-classifier.md         # P5 — предикат HIGH/LOW (enforcement, не presence)
├── audit-spec-fidelity.md          # P4 — методология fidelity-аудита (spec vs .product)
├── tdd-impl-loop.md                # P5 — native-контроллер, лифтит kiro-impl prompts/gates
└── architecture-consilium.md       # P2 — prior-методология жюри + ArchVerdict-схема + синтез-граница

commands/orchestrator/
└── run.md                          # /orchestrator:run <process> [--feature ...]

agents/orchestrator/                # пусто — роли делегированы cc-sdd kiro-skills:
                                    # P3 → kiro-spec-batch сам диспатчит субагентов;
                                    # P5 → лифтит kiro-impl/templates/* + kiro-review/debug/verify (через Read/Skill в прогоне)
```

Эти артефакты бутстрапятся в `.claude/` пользователя как и прочие модули. Per-project
state Оркестратора (run-журналы, ledger, реестры, fabric-инстансы) — `.claude/orchestrator/`
в проекте.

## Process Fabric — межпроцессная линия (validated 2026-07-10)

Поверх процессов P1–P7 живёт **Process Fabric** — durable statechart линии фичи между
сессиями (opt-in `--fabric` у `/orchestrator:run`): charter (`charters/*.json`) + движок
`lib/fabric-engine.cjs` (event-sourcing, prescriptions через F1, WIP-backpressure, PA-мост
человеческих гейтов). Движок не вызывает LLM и ничего не запускает сам — актуатор = диспетчер.
Руководство оператора — [`docs/guide/07-fabric.md`](../docs/guide/07-fabric.md); контракт
диспетчера — `commands/orchestrator/run.md` §«Process Fabric»; дизайн-SSOT —
`dev/process-fabric/CONCEPT.md`.

## P3 `batch-features-to-cc-sdd` — поток

```
Init      orchestrator-init: cc-sdd/kiro-spec-batch заведён? зоны покрыты? env-probe   [наш]
Steering  делегирует kiro-steering; пинит стек в tech.md                                [delegate]
Bridge    на каждый handoff: preflight C-07 (адаптер) → brief.md + roadmap-строка       [наш мост+гейт]
Author    вызывает kiro-spec-batch (волны + dispatch + 10-точечный cross-spec + fix)    [cc-sdd движок]
Coverage  на каждую фичу: coverage-oracle (детерминир., независимо от self-report)       [наш гейт]
Commit    selective commit .kiro/specs + steering                                       [наш]
```

cc-sdd's `kiro-spec-batch` Step 4 (10-точечный cross-spec consistency review + 3-раундовый
fix-loop) — **наш cross-spec слой не нужен**, он покрыт инструментом. coverage-oracle —
детерминированное **дополнение** к этому LLM-ревью, не дубль.

## P5 `feature-to-tdd-impl` — поток

`kiro-impl` — зрелый TDD-контроллер, но `disable-model-invocation` → Workflow не может его
вызвать. Поэтому P5 владеет **минимальным dispatch-FSM**, но **лифтит** всю методологию.

```
Plan       orchestrator-init + classify (gate-risk-classifier) + validation-commands + DAG-порядок  [наш план]
§6 detect  pre-flight capability-probe.cjs: enumerate FM external_capabilities + disposition absent  [DEC-DEV-0117]
             (BLOCK/deferred детерминированы из tier+dev_stand_in) → proactive surface в canonical PA;
             BLOCK раскрыт + помечен для OD7 await (живое исполнение — substrate-gated S7-остаток)
Implement  per task (sequential, по _Depends_):                                                       [наш FSM]
             implementer  ← Read kiro-impl/templates/implementer-prompt.md                 [лифт]
             tier=HIGH → reviewer ← reviewer-prompt.md / kiro-review (independent)          [лифт]
             tier=LOW  → inline-verify по профилю (skeleton, без субагента)                 [наш, экономия]
             REJECT≤2 / BLOCKED → debugger-prompt.md / kiro-debug                           [лифт]
             kiro-verify-completion → selective commit (explicit paths) + mark [x]          [лифт + наш]
Validate   kiro-validate-impl → GO / NO-GO (fix findings ≤3) / MANUAL_VERIFY_REQUIRED       [лифт]
```

Net-new vs `kiro-impl`: **gate-risk-classifier** (он всегда гоняет полный reviewer; мы
рационируем HIGH/LOW) + durable Workflow-скелет. Лифт = агент **читает kiro-шаблоны прямо
из пилотного `.claude/skills/kiro-impl/templates/`** в прогоне — kiro в наш репо не копируем
(иначе tri-location sync-долг, DEC-DEV-0040). Шаблоны самодостаточны (встраивают протокол).

## P7 `runtime-smoke-readiness` — поток (DEC-DEV-0120)

P6 отвечает «тесты зелёные + билдится?» — необходимо, но **не достаточно**. RUN 01 загрузил
dev-сервер при 223 зелёных тестах и получил 500: процесс не прочитал `.env` (+5 инфра-пробелов).
Урок P2-1: **«223 теста зелёные ≠ приложение стартует»**. P7 — гейт, закрывающий этот разрыв,
последний перед сегментом «до прода» (Vision Epic E).

```
Assess    env-readiness probe → runtime-readiness.cjs: run-target? §6 boot-caps? env up?       [наш гейт]
            verdict ∈ READY_TO_SMOKE | BLOCKED_ON_CAPABILITY | ENV_NOT_READY | NOT_STARTABLE
            (§6 boot-caps переиспользуют capability-probe — не новая эвристика, DEC-DEV-0117)
Smoke     branch на verdict:                                                                    [наш FSM]
            BLOCKED_ON_CAPABILITY → §6 capability-request в canonical PA (Integrator/Product,
              OD7 await) — НЕ мокаем, НЕ оснащаем; boot не запускаем
            NOT_STARTABLE → tracking-PA, route Product (нет run-target); boot не запускаем
            ENV_NOT_READY → транзиент, поднять env и перезапустить; boot не запускаем
            READY_TO_SMOKE → живой boot + диагностика провала стартапа (capture-don't-fix)       [substrate-gated]
Report    disclose: mock-only boot / non-GO P6 / DEGRADED env — «зелёный boot ≠ доказательство»  [наш]
```

**Две ноги (зеркалит 5A §6-split):** READINESS-нога (`runtime-readiness.cjs` — детерминир.
verdict из run-target + §6 boot-caps + env) построена и юнит-тестирована; EXECUTION-нога
(живой boot+диагностика) **substrate-gated** — реальный грейд требует пилотного dev-env +
GO'нутой фичи, а полный Epic E (deploy/provisioning) ждёт D3-runtime инструментов Интегратора
(их пока нет). Тумблер `A.bootSmoke=false` гоняет только readiness-ногу (assess+disclose, без
boot) — явная ручка для пока-substrate-gated исполнения. Boot — **capture-don't-fix**:
SURFACE провал старта (диагностика по таксономии RUN 01: env-not-loaded 500, missing migration,
port-in-use, missing runtime secret, dependency-down), чинить — на ре-ране P5/P6.

## Sync-обязательства

- **`lib/coverage-oracle.cjs` monotonic section-guard зеркалит** `adapters/handoff-to-ccsdd.js`
  `extractSections` (DEC-DEV-0073). Намеренно продублированы, чтобы развязать runtime install-пути
  (tri-location урок DEC-DEV-0040). Меняешь guard в адаптере — отрази здесь. Оба покрыты тестами.
- **`lib/gate-risk-classifier.cjs` — load-bearing реестр опционален в v1.** Предикат
  работает на маркерах M1–M5 + профилях; реестр лишь уточняет declarative-vs-imperative для
  упомянутых IC/BR. Per-project деривация реестра (скан requirements на M1/M2, design §5.1) —
  **задокументированный follow-up**, не блокер. Регрессия предиката против таблицы RUN 01 §6
  (17/17 с M5) — в тесте.
- **Harness fs-constraint (DEC-DEV-0073 §D.1):** Workflow-скрипты не имеют доступа к FS/Node API
  и `Date.now()`/`Math.random()`. Поэтому каждое чтение файла / запуск хелпера / вызов
  kiro-skill / git-commit — **внутри `agent()`**, не в теле скрипта. Входы — через `args`.

## Smoke

```bash
npm run test:orchestrator     # coverage-oracle + gate-risk-classifier contract tests (fixtures + §6 table)
npm run smoke:orchestrator    # оба Workflow .mjs парсятся в харнесс-диалекте
npm run verify                # всё вместе (+ hooks + adapters)
```

`node --check` к `.mjs` **неприменим**: харнесс-диалект (`export const meta` + top-level
`await`/`return`) — не чистый ESM. Валидатор — `smoke:orchestrator` (см. его шапку).

**Live cc-sdd прогон** требует пилота с заведённым cc-sdd (отдельный осознанный заход;
пилот в билд-сессии не трогаем). Открытые вопросы прогона: (P3) вызывается ли
`kiro-spec-batch` из Workflow-`agent()` — есть fallback; (P5) вызываются ли kiro-гейты
(`kiro-review`/`kiro-verify-completion`/`kiro-validate-impl`) из вложенных субагентов —
шаблоны встраивают протокол как fallback.
