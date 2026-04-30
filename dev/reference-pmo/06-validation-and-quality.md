# 06. Validation и quality safeguards

> **Назначение:** функциональные требования к **validation** — каталог правил, severity tiers, override discipline, automated vs process rules.

---

## 06.1 Индустриальный референс

### 06.1.1 Severity tiers (lint/typecheck/test analogies)

Software engineering знает разделение по severity:
- **Lint warnings** — стилистика, suggestions
- **Type errors** — likely bugs, blocking compilation
- **Test failures** — actual bugs, blocking deploy

Tiered linting (ESLint configs «strict» vs «recommended» vs «relaxed»; Ruff strict/standard) — practitioner pattern.

### 06.1.2 Process rules (non-automatable)

Индустрия знает, что некоторые правила не могут быть автоматизированы. Pattern: declare them as **process rules** (mandatory steps), not validation rules. Examples:
- **Code review** as process (not automatable; required step)
- **Threat modeling** as process (Shostack)
- **Architectural review** (ATAM as process)

### 06.1.3 Override discipline

ADR practice (Nygard 2011) — when you override default, document **why**. Linter rule disable comments must include reason (community practice).

### 06.1.4 Bidirectional and forward/backward checks

RTM (Wiegers) defines forward (requirement → test) and backward (test → requirement) traces. Validation runs both directions.

### 06.1.5 Ключевые источники

- ESLint / Ruff documentation — tiered linting practice.
- Shostack, *Threat Modeling* (2014) — STRIDE process rule.
- Bass, Clements, Kazman, *Software Architecture in Practice* — ATAM as process.
- Nygard, ADR pattern (2011).
- Wiegers & Beatty, *Software Requirements* (2013) ch. 30 — RTM bi-directional checks.
- ISO/IEC/IEEE 29148 — requirements engineering verification standard.

---

## 06.2 Перечень функций

| Функция | Industry-canonical | Source | Maturity |
|---|---|---|---|
| Catalog of named validation rules | Linter rules; static analysis catalog | (industry — ESLint, sonarqube) | MATURE |
| Severity tier system (blocking/warning/info) | ESLint severity; PMD priorities | (industry) | MATURE |
| Inline vs deferred validation | Linter --fix vs CI lint vs pre-commit | (industry) | MATURE |
| Tier-aware activation | Tiered linting profiles | ESLint config layers; Ruff | MATURE-ISH |
| Per-rule override discipline | Linter disable comments with reason | (community practice) | MATURE |
| Per-artifact override | (нет канонического PMO; closest: per-file linter override) | (industry) | MATURE-ISH |
| Process rules (non-automatable) | ATAM as process; threat modeling; code review | Bass; Shostack | MATURE |
| Auto-fix where possible | Linter --fix; codemods | (industry) | MATURE |
| Bidirectional ref consistency | RTM bi-directional | Wiegers ch. 30 | MATURE |
| Stale artifact detection | Code dead detection; LSP unused detection | (industry) | MATURE |
| Orphan artifact detection | RTM forward-trace zero hits | Wiegers ch. 30 | MATURE |
| Validation на multiple execution points | Linter at IDE / commit / CI / scheduled | (industry composite) | MATURE |
| Quiet-draft mode (validate but don't surface during draft) | (нет канонического; emerging UX) | (closest: lint deferral until commit) | EMERGING |

---

## 06.3 Чеклист покрытия

| # | Функция | Покрытие | Маркер | Locus | Примечание |
|---|---|---|---|---|---|
| 1 | Catalog of named validation rules | ● 3 | `[C]` | CC | V-01..V-15 (artifact integrity), V-H-01..V-H-10 (handoff structural), V-MK-01..V-MK-08 (UI completeness), P-RULE-01/02 (process rules). 33+2 named rules в `validation.md`. |
| 2 | Severity tier system | ● 3 | `[C]` | CC | 🔴 Blocking / 🟡 Warning / 🔵 Info — explicit per rule. Direct port of linter severity. |
| 3 | Inline vs deferred | ● 3 | `[C]` | CC | 5 execution points: inline (PostToolUse hook), approve gate, handoff generation, on-demand `/product:validate`, periodic (deferred v2). |
| 4 | Tier-aware activation | ● 3 | `[F]` | CC | B1 modification: `validation_tier: pilot \| mvp \| full` — pilot tier inline только 🔴 Blocking, mvp inline 🔴+🟡, full inline all. **Strong fitness extension** of tiered linting practice. |
| 5 | Per-rule override discipline | ● 3 | `[C]` | CC | `.claude/integrator/validation-config.yaml` global_overrides.rules.{V-XX}: severity + rationale + (для disabled) approved_by + approved_at. Direct ADR-style logging. |
| 6 | Per-artifact override | ● 3 | `[C]` | CC | `validation_overrides[]` в frontmatter (permanent severity change для one artifact). Different from `approve_overrides[]` (temporary gate pass). |
| 7 | Process rules (non-automatable) | ● 3 | `[C]` | CC | P-RULE-01 (IC change → DA review with adaptive depth), P-RULE-02 (BR change → DA + impact analysis). Pattern direct from ATAM-as-process tradition. |
| 8 | Auto-fix where possible | ◐ 2 | `[F/C]` | CC | V-11 bi-dir auto-fix works (add reverse ref when target active); other rules detection-only. **Conscious cut:** full BFS auto-fix beyond V-11 deferred v1.1. |
| 9 | Bidirectional ref consistency | ● 3 | `[C]` | CC | V-11 🔴 with auto-fix. Direct port of RTM bi-directional principle. |
| 10 | Stale artifact detection | ● 3 | `[C]` | CC | V-12 (drafts >14 days configurable) → flagged in `/product:status`. Configurable threshold. |
| 11 | Orphan artifact detection | ● 3 | `[C]` | CC | V-15 + `/product:cleanup --dry-run`. Direct RTM forward-trace pattern. |
| 12 | Validation на multiple execution points | ● 3 | `[C]` | CC | 5 points listed в `validation.md` §3. Periodic deferred v2. |
| 13 | Quiet-draft mode | ● 3 | `[F]` | CC | B2 modification: hooks в quiet mode при status:draft; findings queued в `.product/.pending/`. **Frontier UX pattern**; emerging in AI-driven tooling. |

**Итог:** 12 × ● 3, 1 × ◐ 2 (#8 auto-fix), 0 × ◔ 1 / ✗ 0. Strong coverage. Single partial — auto-fix beyond V-11 deferred v1.1.

---

## 06.4 Нарративный анализ соответствия

### 06.4.1 Validation catalog — strong match

**Match.** 33 + 2 named rules — среди наиболее тщательных living-spec validation systems. Direct port of linter discipline applied to product spec.

### 06.4.2 Tier-aware activation — fitness frontier

**Match с extension.** Индустрия имеет tiered linting (ESLint strict/standard); ты расширил это до lifecycle-stage activation (pilot/mvp/full validation_tier). **Stronger** because tier reflects product maturity, not just code style preference.

### 06.4.3 Process rules — proper non-automation handling

**Match.** Industry pattern: when rule can't be automated, declare as process step rather than fake validation. P-RULE-01 (IC → DA) и P-RULE-02 (BR → DA + impact analysis) follow this pattern correctly. Better than systems that fake automation with false positives.

### 06.4.4 Override discipline — mature

**Match.** Three levels of override:
- Project-level (`validation-config.yaml` rules.severity)
- Per-artifact permanent (`validation_overrides[]`)
- Per-artifact temporary gate-pass (`approve_overrides[]`)

This is more granular than typical systems (linter disable comment is the closest analog, но не имеет temporary-pass mechanism).

### 06.4.5 Auto-fix limited — conscious cut

**Conscious gap.** Только V-11 (bi-dir) auto-fixes; full BFS auto-fix deferred v1.1. **Rationale (DEC-DEV-0012):** «Cascade protocol implementation на JS — графовая операция; mitigation: detection-only scope для v1, V-11 auto-fix только.» Reasonable for v1; bring-forward trigger is pattern emergence in cascade-pending.yaml.

### 06.4.6 Quiet-draft mode — fitness frontier

**Match с frontier.** Индустрия имеет «defer until commit» (pre-commit hooks); ты operationalized «defer until status:draft → active». Subtler timing, more contextual. **Frontier UX** — not a standard practice in living spec systems.

### 06.4.7 Что не покрыто (потенциальные additions)

1. **Validation regression suite.** Когда сами validation rules меняются, ловят ли они regressions? **Не explicit.** Индустрия: snapshot tests. Можно добавить: fixture-based tests per rule. Acknowledged в `validation.md` §10.5 «Test coverage» как future work.
2. **Performance budgets для validation.** `<100ms inline` documented (§10.4) but not enforced. Индустрия: linter speed tracking. Track in snapshot if validation slowdowns appear.
3. **Validation cross-rule conflict detection.** Два правила могут оба fire on same artifact с conflicting recommendations. Индустрия: linter rule conflict matrices. Не addressed currently.
4. **Validation telemetry.** False positive rate per rule, fix rate, dismiss rate — needed to drive `/product:meta-feedback`. Implicit but not codified.

---

## 06.5 Анти-паттерны для отслеживания

1. **Validation theater.** Симптомы: rules pass; reality differs. False positives ignored long enough that `/product:meta-feedback` has accumulated proposals to downgrade many rules. **Source:** general validation discipline.
2. **Tier abuse — pilot forever.** Уже в Section 02. Validation tier never upgrades despite product maturing.
3. **Override accumulation.** Симптомы: 10+ rules with overrides в `validation-config.yaml`; trending up. **Source:** ADR — overrides should be exceptions.
4. **Auto-fix over-confidence.** Симптомы: auto-fix invoked on edge cases; user corrects often. **Source:** general automation discipline.
5. **Quiet-draft as escape hatch.** Симптомы: artifacts permanently in draft to avoid validation; never promoted. **Source:** B2 design intent.
6. **Process rule skipped silently.** Симптомы: BR/IC changed; DA findings file absent; artifact в active. **Source:** P-RULE-01/02 design intent.
7. **Cascade pending unresolved for weeks.** Симптомы: `cascade-pending.yaml` accumulating; rate of resolution lags rate of detection. **Source:** Section 07 discipline.
8. **Rules added but never removed.** Симптомы: rule count grows monotonically. No retirement of rules that no longer pull weight. **Source:** linter rule entropy анти-паттерн.

---

## 06.6 Сигналы для сравнения снапшотов

1. **Total rule count.** Stable? Growing? Was anything retired?
2. **Severity distribution per validation namespace** (V-* / V-H-* / V-MK-* / P-RULE-*).
3. **Active validation_tier.** pilot / mvp / full.
4. **Количество overrides в `validation-config.yaml`.** Per rule with rationale.
5. **`validation_overrides[]` per artifact distribution.** Heavy on certain rules?
6. **`approve_overrides[]` rates.** То же.
7. **Auto-fix invocation count.** V-11 stably firing? Other auto-fixes added?
8. **`cascade-pending.yaml` size and resolution rate.**
9. **DA debt** механизм mentioned in earlier docs but **dropped** per DEC-DEV-0012. Confirmed dropped в snapshot? No accumulating `da-debt.yaml`?
10. **Validation regression test fixtures** добавлены? (anticipated future work).
11. **Performance metrics для validation hooks.** Are they tracked?
12. **Предложения `/product:meta-feedback` on validation rules.** Frequency.
13. **NOTE:** §07.3 of consistency-mechanisms был перерендерен в новый формат; old yes/partial format больше не используется.

---

**Конец раздела 06.**
