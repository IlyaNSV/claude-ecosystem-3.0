# 05. Process Gates и механика одобрения

> **Назначение:** функциональные требования к **gates** — точкам решения в процессах, через которые артефакты переходят в active. Качество системы определяется тем, как gates работают: формально (rubber stamp) → разрушают доверие; слишком детально → ceremony explosion.

---

## 05.1 Индустриальный референс

### 05.1.1 BDD Three Amigos и approve-by-conversation

**Dan North** (BDD origin) определяет «Three Amigos» — business + dev + QA collaboratively author scenarios. Approve = все трое согласны, что сценарий отражает реальное намерение. **Functional gate** — конверсация, не подпись.

**Adzic** (*Specification by Example*) расширяет: approve at the **smallest reasonable batch** — set of related scenarios for one feature, not individual lines.

### 05.1.2 DoR / DoD (Scrum)

**Definition of Ready** — conditions для story to enter sprint. **Definition of Done** — conditions для increment to be releasable. Industry application: каждая команда определяет свои DoR/DoD; универсального стандарта нет.

DoR/DoD typically include:
- AC clarity, sized, dependencies known (DoR)
- Tested, reviewed, documented, deployed, accepted (DoD)

### 05.1.3 Критика stage-gate у Cagan

**Stage-Gate Cooper'а** (1990s, формальная stage-gate process model) — линейные phases с formal go/no-go gates. **Cagan** (*Empowered* + various blog posts) сильно критикует:
- Gates как бюрократия, не discovery
- Gate criteria становятся checkboxes, теряют смысл
- Discovery и delivery должны быть параллельны, не последовательны

**Предпочитаемое Cagan'ом:** lightweight gates, ориентированные на снижение риска, не feature checklist. Gate спрашивает «которые риски мы de-risked?», не «которые поля заполнены?».

### 05.1.4 Auto-approve patterns

Не каноническая single-source школа. Composite from:
- **Linting auto-fix** (ESLint --fix; ruff --fix) — autonomous correction of low-risk class
- **GitHub auto-merge** at successful checks — process-level auto-approve with criteria
- **Constitutional AI** principles — derived artifacts can be auto-validated against principles

### 05.1.5 Bundle approve

В living spec / tooling — нет canonical pattern. Closest analog:
- **Git interactive staging** — bundle commits with selective hunk inclusion
- **Mass refactoring** в IDE (rename across files) — bundle approve

### 05.1.6 Ключевые источники

- North, «Introducing BDD» — dannorth.net.
- Schwaber & Sutherland, *Scrum Guide* — scrumguides.org.
- Cohn, *User Stories Applied* (2004) — обсуждение DoR/DoD.
- Cooper, «Stage-Gate Idea-to-Launch» — multiple papers; Stage-Gate Inc. methodology.
- Cagan, *Empowered* (2020) — critique of stage-gate.
- Adzic, *Specification by Example* (2011) — three amigos extension.

---

## 05.2 Перечень функций

| Функция | Industry-canonical | Source | Maturity |
|---|---|---|---|
| Explicit named gates with criteria | Stage-Gate; Scrum DoR/DoD | Cooper; Schwaber & Sutherland | MATURE-ISH (Stage-Gate); MATURE (DoR/DoD) |
| Conversation-based approve (Three Amigos) | BDD | North | MATURE |
| Per-artifact approve vs batch | SbE «smallest reasonable batch» | Adzic 2011 | MATURE-ISH |
| Auto-approve для derived artifacts | Linter auto-fix; CI auto-merge | (industry composite) | MATURE-ISH |
| Conditional auto-approve gated на confidence | (нет канонического PMO-источника) | (closest: confidence-gated CI promotion) | EMERGING |
| Approve override discipline (rationale required) | (composite — ADR-style decision logging) | Nygard 2011 | MATURE-ISH |
| Mode-aware DoR (different gates for PoC vs production) | (нет канонического; emerging in tooling) | (closest: feature flag staged rollout) | EMERGING |
| Ceremony minimization (skip-when-not-warranted) | критика stage-gate у Cagan | Cagan *Empowered* | MATURE-ISH |
| Deadlock protection (>5 iterations escalate) | (emerging in AI-driven systems; analog: timeout in workflows) | (нет единого канонического) | EMERGING |
| Bundle approve UX | Git interactive staging; mass refactoring | (industry) | MATURE-ISH для VCS, EMERGING для living spec |
| Discovery Review Checkpoint (batch) | (нет канонического; SbE «smallest reasonable batch» closest) | Adzic 2011 | EMERGING |
| Severity tier of gates | (composite — Critical/Strategic/Standard/Confirmation derived from RACI + Stage-Gate criticality) | (industry composite) | MATURE-ISH |

---

## 05.3 Чеклист покрытия

| # | Функция | Покрытие | Маркер | Locus | Примечание |
|---|---|---|---|---|---|
| 1 | Explicit named gates with criteria | ● 3 | `[C]` | CC | G1 (PS), G4 (SEG), G4a (VP), G5 (HYP) в P1.A; per-artifact approve в P2; mode-aware DoR (B1..B8) для handoff |
| 2 | Conversation-based approve | ● 3 | `[F/C]` | CC | DEC-P13 паттерн «Assistant-led human-approved»; iterations 3-4 раундов до approve. **Adapted Three Amigos:** Solo + AI-assistant + DA subagent (когда применимо) |
| 3 | Per-artifact approve vs batch | ● 3 | `[C]` | CC | Per-artifact для 🟠 Strategic; **Discovery Review Checkpoint** для 🟡 Standard batch (MR + CA после G4). Smallest-reasonable-batch principle (Adzic) explicit. |
| 4 | Auto-approve для derived artifacts | ● 3 | `[F]` | CC | A1 modification: 🟢 Confirmation (LC, VC, RPM, NM) auto при `confidence: high` + clean validation. **Frontier work** — индустрия не имеет этого для living spec. |
| 5 | Conditional auto-approve gated на confidence | ● 3 | `[F]` | CC | То же что #4. Conditions explicit: confidence:high + confidence_notes non-empty + все V-* per tier passed. Disabled per project через `auto_approve_confirmation_artifacts.enabled: false`. |
| 6 | Approve override discipline | ● 3 | `[C]` | CC | D2 modification: `approve_overrides[]` per artifact с rationale + approved_by + approved_at + optional expires_at. Логируется в handoff frontmatter `dor_overrides[]`. |
| 7 | Mode-aware DoR | ● 3 | `[F]` | CC | D1 modification: `--mode draft` (3 blockers) vs `--mode production` (8 blockers); status: ready/partial/blocked/stale. Strong fitness extension. |
| 8 | Ceremony minimization | ● 3 | `[F/C]` | CC | Magnitude-driven DA (cosmetic skip vs significant full); validation_tier (B1); quiet-draft (B2); auto-approve (A1) для derived. См. Section 01 #9. |
| 9 | Deadlock protection | ◐ 2 | `[F]` | CC | Product Module SPEC §1.4 «ceremony escalation после ≥5 idle approves»; processes.md §3.3 D.3 «после 7 iterations — флаг pause for fresh look». **Acknowledged + has prompt-level guidance**, but **не hook-enforced** — relies on AI judgment, not deterministic check. **Отслеживай:** если hook-based deadlock detection добавлен (например, `iteration_counter` в session state с auto-flag) — это maturation. |
| 10 | Bundle approve UX | ◐ 2 | `[F]` | CC | Discovery Review Checkpoint работает (batch MR+CA); cascade bundle approve упомянут (validation.md §6.3) but full UX deferred v1.1. Manually через `/product:cascade --pending`. |
| 11 | Discovery Review Checkpoint | ● 3 | `[F]` | CC | Specifically для batch research artifacts; explicit gate after G4 SEG approve. **Frontier work** — в индустриальной литературе не описана явно. |
| 12 | Severity tier of gates | ● 3 | `[C]` | CC | 🔴 Critical (BR, IC) / 🟠 Strategic (PS, SEG, VP, HYP, MVP, FM, SC, MK) / 🟡 Standard (MR, CA, RL, RM, BG, DS) / 🟢 Confirmation (LC, RPM, VC, NM). Direct port of RACI / Stage-Gate criticality discipline to spec gates. |

**Итог:** 10 × ● 3, 2 × ◐ 2 (#9 deadlock, #10 bundle UX), 0 × ◔ 1 / ✗ 0. Сильное покрытие. Слабые точки — обе в сторону «UX automation could be deeper», not «function missing».

---

## 05.4 Нарративный анализ соответствия

### 05.4.1 Approve gates как core mechanism

**Должно быть:** Точки решения **явно названные**, с criteria **читаемыми** перед gate, не обнаруживаемыми после fail. Индустрия: Scrum DoR/DoD, Cagan empowered teams strategy gates.

**У тебя:** G1, G4, G4a, G5 в Discovery — explicit. Per-artifact в P2 — explicit. DoR в handoff — 8/3 blockers explicit.

**Match с системной полнотой.** Stronger than Scrum DoR/DoD because criteria are codified per gate (validation rules), not «team agreement».

### 05.4.2 Auto-approve для derived artifacts — fitness frontier

**Должно быть:** Производные артефакты (derived from upstream через clear deterministic logic) могут auto-progress без human gate, если confidence высокая. Индустрия: linting auto-fix; CI auto-merge.

**У тебя:** A1 modification — 🟢 Confirmation level (LC, VC, RPM, NM) auto at confidence:high + clean validation. Conditions explicit, configurable per project.

**Frontier work.** Индустрия не имеет этого для living product spec, потому что у них нет AI-author. Тебе нужно было operationalize это, потому что solo + AI-author needs throughput.

**Риск:** auto-approve based on verbalized confidence has known calibration issue (Kadavath et al.). Monitoring this requires golden-set calibration check, который пока не в roadmap.

**Отслеживай:** auto-approve rate per artifact type; ratio of auto-approved → later requires_review (sign of mis-calibration).

### 05.4.3 Mode-aware DoR — pragmatic fitness

**Должно быть:** Different gates for different deployment scenarios — PoC vs production. Индустрия: feature flag staged rollouts; canary deployments — но на infra level, не spec level.

**У тебя:** D1 modification — `--mode draft` (3 blockers, status partial) vs `--mode production` (8 blockers, status ready). Receiver видит mode + warnings.

**Match с explicit operationalization.** Индустрия имеет концепт implicitly; ты сделал его spec-level.

### 05.4.4 Bundle approve — partial gap

**Должно быть:** При cascade-detected impact на 5+ артефактов, человек видит сводку и approves bundle (или per-item) atomically. Индустрия: git interactive staging; mass refactoring approve.

**У тебя:** Discovery Review Checkpoint работает для batch research; cascade bundle UX deferred v1.1 (DEC-DEV-0012). Manual workaround через `/product:cascade --pending`.

**Conscious gap с bring-forward trigger** (5+ manual cascade resolutions of similar pattern → bring forward).

### 05.4.5 Deadlock protection — hook upgrade candidate

**Должно быть:** When iteration loop exceeds reasonable bound, system surfaces it. Индустрия: timeout in workflows.

**У тебя:** Prompt-level guidance в SPEC + skill instructions; не hook-enforced. AI должен детектировать — но AI под давлением «угодить» может пропустить.

**Отслеживай:** появление hook'а (например, `iteration-counter.js`) для automated deadlock detection — это maturation. Снижает зависимость от AI self-awareness для ceremony control.

---

## 05.5 Анти-паттерны для отслеживания

1. **Gates как rubber stamp.** Симптомы: confidence_notes пусты на approve; sequential approves без правок; G5 passed на HYP без явных thresholds. **Источник:** критика stage-gate у Cagan.
2. **Approve overrides accumulating.** Симптомы: `approve_overrides[]` появляются на 3+ артефактах подряд для одного rule; не пересмотр через `validation_overrides` (project-level). **Источник:** ADR practice — overrides should be exception, not norm.
3. **Auto-approve never invoked.** Симптомы: 🟢 Confirmation artifacts всегда проходят manual approve, несмотря на eligibility. Может indicate mistrust в confidence calibration. **Источник:** A1 design intent.
4. **Auto-approve over-firing.** Opposite of #3 — слишком много auto-approves, ведущее к silent acceptance. **Source:** Sharma 2023 — sycophancy at meta-level.
5. **Bundle approve replaced by «yes to all».** Симптомы: human approves bundles без per-item review когда bundle большой или unfamiliar. **Source:** general approval theatre anti-pattern.
6. **Discovery Review Checkpoint skipped.** Симптомы: MR + CA approved per-item rather than batched после G4. Loses context-rich snapshot benefit. **Source:** Adzic — batch approve at point of meaning.
7. **DoR mode misuse.** Симптомы: `--mode draft` used routinely instead of for genuine PoC; production handoffs не делаются при DoR fail (override every time). **Source:** D1 design intent — modes should reflect genuine need, not workaround.
8. **Iteration loop unprotected.** Симптомы: 5+ iterations on same artifact без progress; ceremony escalation prompt не surfaces (AI didn't notice). **Source:** Product Module SPEC §1.4 deadlock guidance.
9. **Severity tier inflation.** Симптомы: artifacts moved to 🔴 Critical to «get attention»; tier loses meaning. **Source:** RACI discipline.

---

## 05.6 Сигналы для сравнения снапшотов

1. **G1-G5 gates fired в P1.A?** Sequence stability per session.
2. **Per-artifact approve count vs Discovery Review Checkpoint usage.** Соотношение.
3. **Auto-approve invocation rate.** Per artifact type. Distribution.
4. **Auto-approve → requires_review conversion rate** (mis-calibration signal).
5. **Количество `approve_overrides[]` across all artifacts.** Trending up = override abuse; trending down = healthy fitness.
6. **`expires_at` dates on overrides.** Set vs absent? When set, do they get reviewed?
7. **DoR mode distribution в handoffs.** draft / production. Should be production-dominant unless pre-pilot stage.
8. **DoR override (`dor_overrides[]`) frequency.** То же что #5 но для handoff.
9. **Bundle approve UX** появилась? Cascade `--pending` команда расширилась?
10. **Hook-based deadlock counter** добавлен? Iteration-counter в session state?
11. **Severity tier shifts** на artifacts. 🟠 → 🔴 (или reverse) — что мотивировало?

---

**Конец раздела 05.**
