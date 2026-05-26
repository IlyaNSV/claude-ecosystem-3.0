---
phase: 4
aggregated_at: 2026-05-26T10:04:58.905Z
sessions_count: 8
status: partial
coverage_summary:
  total_scenarios: 13
  covered: 2
  partial: 1
  fail: 0
  not_covered: 10
  uncertain: 0
findings_count:
  blocking: 3
  warning: 8
  info: 5
  uncertain: 3
sessions:
  - a2aa99d4-7d0d-46d1-8295-b7ae768249e1
  - 0781ad12-b57e-4cad-808f-429c4fee2b81
  - cc1cb16a-fbe2-4735-a1c2-c68ee8b9f689
  - 0c10a7c0-da21-4676-ada9-08d1ef0468c0
  - 31394d98-ea1a-4b77-bdc3-c243cc819bed
  - fd5cc61e-66c9-4d78-893c-eae967efd1c2
  - e3bfd3a3-7fda-4ed8-be87-d6a713ef4a32
  - 945809f4-bb16-4fe0-97e5-8cdd91155392
---

# Phase 4 smoke audit summary

## Overview

Aggregated 8 audited sessions против `dev/PHASE_4_SMOKE_TEST_PLAN.md` (13 runtime scenarios). Только 2/13 сценариев получили статус COVERED, 1 — PARTIAL, 10 — NOT-COVERED — большинство аудируемых сессий не выполняли smoke-план целиком, а представляли собой ad-hoc продуктовую работу в `my-first-test`, перехваченную D7 SessionEnd-хуком. Top-line takeaway: **систематический drift `subagent_type=general-purpose` вместо канонического `product-devils-advocate`** наблюдается в 3 из 8 сессий — это та же P1-регрессия, что уже фиксировалась в DEC-DEV-0038. Один scenario (S12, critical) имеет FAIL-вердикт в одной из сессий, что должно блокировать ре-верификацию до фикса (см. Conflicts).

## Coverage matrix

| Scenario | Title | Best verdict | Sessions hit | Conflict? |
|---|---|---|---|---|
| S1 | HYP frontmatter canonical | ⚪ NOT-COVERED | — | — |
| S2 | Language discipline | ✅ COVERED | 31394d98 (COVERED), 0c10a7c0 (PARTIAL), a2aa99d4 (UNCERTAIN) | yes — см. Conflicts |
| S3 | Full validation | ⚪ NOT-COVERED | — | — |
| S4 | NFR review (Ask + Define) | ✅ COVERED | 31394d98 | — |
| S5 | Handoff draft | ⚪ NOT-COVERED | — | — |
| S6 | Handoff production | ⚪ NOT-COVERED | — | — |
| S7 | Cross-platform hash | ⚪ NOT-COVERED | — | — |
| S8 | DA review FM | ⚪ NOT-COVERED | — | — |
| S9 | DA review RL | ⚪ NOT-COVERED | — | — |
| S10 | Handoff `--with-da-review` | ⚪ NOT-COVERED | — | — |
| S11 | Cleanup orphan detection | ⚪ NOT-COVERED | — | — |
| S12 | Cleanup `--pending-hygiene` ⚠ CRITICAL (verifies DEC-DEV-0036 fixes) | 🟡 PARTIAL | a2aa99d4 (PARTIAL), 0c10a7c0 (FAIL) | yes — см. Conflicts |
| S13 | NFR tier upgrade | ⚪ NOT-COVERED | — | — |

## Findings synthesis

### Recurring patterns

- **DA `subagent_type` drift (check_id C × 3 сессий)** — наиболее системный паттерн фазы. В [`0781ad12`](./0781ad12-b57e-4cad-808f-429c4fee2b81.md), [`31394d98`](./31394d98-ea1a-4b77-bdc3-c243cc819bed.md) и [`e3bfd3a3`](./e3bfd3a3-7fda-4ed8-be87-d6a713ef4a32.md) DA-обзор спавнится через `subagent_type=general-purpose` вместо канонического `product-devils-advocate`. Это та же P1-регрессия, что зафиксирована DEC-DEV-0038 для S8, и она воспроизводится **за пределами явного `/product:da-review`** — в batch DA вызовах для BR/IC сценариев тоже. Указывает на skill-reinforcement gap (или undocumented contract в `agents/product/devils-advocate.md`).
- **Frontmatter drift на IC-артефактах (check_id A × 2 сессий)** — в [`0781ad12`](./0781ad12-b57e-4cad-808f-429c4fee2b81.md) (IC-022..IC-028) и [`e3bfd3a3`](./e3bfd3a3-7fda-4ed8-be87-d6a713ef4a32.md) (IC-019..IC-021) IC создаются с `type=invariant` вместо канонического `type=invariant-check`, без обязательных `severity`/`entity`/`testable_as`. Класс drift тот же что DEC-DEV-0011 для PS; вероятная причина — отсутствие explicit template в skill для IC аналогично note-promote/problem-discovery (см. DEC-DEV-0012 convention).
- **Post-DA edits без follow-up DA (check_id C × 2 сессий)** — в [`0781ad12`](./0781ad12-b57e-4cad-808f-429c4fee2b81.md) (BR-064/065/070/073/074/076) и [`e3bfd3a3`](./e3bfd3a3-7fda-4ed8-be87-d6a713ef4a32.md) (BR-063 post-DA) активные BR редактируются после initial DA без повторного review — P-RULE-02 нарушение.

### Critical issues

- 🔴 **Blocking — P-RULE-01 violation** ([`0781ad12`](./0781ad12-b57e-4cad-808f-429c4fee2b81.md)): 7 новых IC (`IC-022..IC-028`, status=active) созданы без обязательного `product-devils-advocate` review. Suggested action: откатить статус → `draft` либо провести batch DA и обновить frontmatter.
- 🔴 **Blocking — DA subagent_type=general-purpose** ([`0781ad12`](./0781ad12-b57e-4cad-808f-429c4fee2b81.md), artifact: Agent call L135, batched DA для 13 BR FM-005). Suggested action: codify check в D7 patterns и/или добавить hook-side validation на subagent_type для DA findings file naming.
- 🔴 **Blocking — DA subagent_type=general-purpose** ([`e3bfd3a3`](./e3bfd3a3-7fda-4ed8-be87-d6a713ef4a32.md), artifact: BR-054..BR-062 batched DA). Same root cause как выше; усиливает recurring-pattern сигнал.

### Conflicts

- **S2 (Language discipline)** — verdicts расходятся: COVERED ([`31394d98`](./31394d98-ea1a-4b77-bdc3-c243cc819bed.md)) vs PARTIAL ([`0c10a7c0`](./0c10a7c0-da21-4676-ada9-08d1ef0468c0.md)) vs UNCERTAIN ([`a2aa99d4`](./a2aa99d4-7d0d-46d1-8295-b7ae768249e1.md)). Aggregate выбирает `best_verdict=COVERED` (best-of). PARTIAL-сессия 0c10a7c0 указывает на flaky path — стоит выборочно проверить identifiers preservation в сессиях с активной IC/BR работой.
- **S12 (Cleanup `--pending-hygiene` CRITICAL)** — verdicts: PARTIAL ([`a2aa99d4`](./a2aa99d4-7d0d-46d1-8295-b7ae768249e1.md)) vs FAIL ([`0c10a7c0`](./0c10a7c0-da21-4676-ada9-08d1ef0468c0.md)). Aggregate JSON показывает `best_verdict=PARTIAL`, однако **по правилу пропагации FAIL** (FAIL должен propagate, если нет commit-evidence фикса) для этого critical-сценария resolution должна быть **FAIL до подтверждённого фикса**. 0c10a7c0 имеет `status: fail` против `partial` у a2aa99d4 и относится к DEC-DEV-0036 fixes verification. Рекомендуемая narrative-resolution: считать S12 НЕ закрытым до targeted re-smoke с фикстурами.

## Per-session reports

- [a2aa99d4-7d0d-46d1-8295-b7ae768249e1](./a2aa99d4-7d0d-46d1-8295-b7ae768249e1.md) — status: partial; coverage 0/1/0/11/1.
- [0781ad12-b57e-4cad-808f-429c4fee2b81](./0781ad12-b57e-4cad-808f-429c4fee2b81.md) — status: findings; coverage 0/0/0/13/0.
- [cc1cb16a-fbe2-4735-a1c2-c68ee8b9f689](./cc1cb16a-fbe2-4735-a1c2-c68ee8b9f689.md) — status: clean; coverage 0/0/0/13/0.
- [0c10a7c0-da21-4676-ada9-08d1ef0468c0](./0c10a7c0-da21-4676-ada9-08d1ef0468c0.md) — status: fail; coverage 0/1/1/11/0.
- [31394d98-ea1a-4b77-bdc3-c243cc819bed](./31394d98-ea1a-4b77-bdc3-c243cc819bed.md) — status: findings; coverage 2/0/0/11/0.
- [fd5cc61e-66c9-4d78-893c-eae967efd1c2](./fd5cc61e-66c9-4d78-893c-eae967efd1c2.md) — status: clean; coverage 0/0/0/13/0.
- [e3bfd3a3-7fda-4ed8-be87-d6a713ef4a32](./e3bfd3a3-7fda-4ed8-be87-d6a713ef4a32.md) — status: findings; coverage 0/0/0/13/0.
- [945809f4-bb16-4fe0-97e5-8cdd91155392](./945809f4-bb16-4fe0-97e5-8cdd91155392.md) — status: clean; coverage 0/0/0/13/0.

## Recommendations

- **Codify D7 pattern «DA subagent_type contract»** — добавить pattern в `dev/meta-improvement/patterns/` фиксирующий правило «DA-обзоры обязаны спавниться через `subagent_type: product-devils-advocate`, не `general-purpose`», с rationale (3 recurring instances в Phase 4 sessions) и enforcement: hook-side validation на DA-findings naming convention. Этот fix снимает 2 из 3 blocking-сценариев одним движением.
- **Targeted re-smoke S12** (critical, DEC-DEV-0036 verification) — сессия 0c10a7c0 показала FAIL; до подтверждения через targeted seed+re-run S12 должен считаться открытым в Phase 5 readiness gate (см. `dev/PHASE_5_READINESS.md` Section B). Re-smoke только S12, без полного S1-S13 цикла.
- **Patch IC-skill template** — добавить explicit IC frontmatter template + anti-pattern list (`type=invariant` запрещён; `type=invariant-check` каноничен; `severity/entity/testable_as` обязательны) в skill, ответственный за создание IC. Применить convention DEC-DEV-0012 (ссылка на `problem-discovery.md` / `note-promote.md` как reference impl).
- **P-RULE-01/02 enforcement** — для blocking 0781ad12 (7 ICs без DA) и recurring post-DA edits — рассмотреть pre-commit/PreToolUse hook, который flag-ит активацию (`status: active`) IC/BR артефактов без соответствующего DA-findings record.
- **No further action для NOT-COVERED-only сессий** (`cc1cb16a`, `fd5cc61e`, `945809f4`) — это `status: clean`, ad-hoc сессии без smoke-плана; они не блокируют closure.

## Skipped / out-of-scope

- 10 NOT-COVERED сценариев (S1, S3, S5–S11, S13) **не покрыты ни одной из 8 audited сессий**. Согласно DEC-DEV-0038, Phase 4 переведена в режим «условно закрыта»; полный re-run S1–S13 не требуется, обязательны только S1/S7/S8/S9/S12 (per `dev/PHASE_5_READINESS.md` Section B). Остальные NOT-COVERED-сценарии — out-of-scope для этого aggregate.
- Uncertain findings ([`a2aa99d4`](./a2aa99d4-7d0d-46d1-8295-b7ae768249e1.md): cleanup AskUserQuestion framing; [`e3bfd3a3`](./e3bfd3a3-7fda-4ed8-be87-d6a713ef4a32.md): IC schema local convention; SC↔BR bi-dir refs) оставлены без follow-up — основная блокировка `pre-processed transcript` / `sandbox read access` к `my-first-test`. Эти ограничения относятся к environment audit-смока, не к коду экосистемы.
