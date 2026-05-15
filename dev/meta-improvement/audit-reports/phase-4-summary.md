---
phase: 4
aggregated_at: 2026-05-15T15:08:03.333Z
sessions_count: 6
status: fail
coverage_summary:
  total_scenarios: 15
  covered: 2
  partial: 5
  fail: 1
  not_covered: 7
  uncertain: 0
findings_count:
  blocking: 1
  warning: 7
  info: 5
  uncertain: 2
sessions:
  - 98cb1b97-d338-435b-b152-182d4aec90d3
  - 5345f116-93ff-455f-92f4-77410fd3a37d
  - 5ba3ee30-592c-4e45-9ef6-08aa22e0ef55
  - fbb32599-4066-435b-a92d-54374b683596
  - 9da2652a-7d70-452a-9e74-fe6cbfcc4b3d
  - 8f10e02f-816c-4b56-a364-cdc925d00f6f
---

# Phase 4 smoke audit summary

## Overview

6 пилотных сессий в `my-first-test` (downstream Phase 4 consumer) суммарно затронули 8 из 15 runtime сценариев плана. Aggregate verdict — **fail**: новая сессия `98cb1b97` подняла первый 🔴 **Blocking** finding (BR-027 semantic edit обнулил DA-pending entry без spawn `product-devils-advocate`), плюс второе подтверждение S12 `cleanup --pending-hygiene` FAIL — теперь два независимых cleanup-флоу нарушают skill anti-pattern №2 (DA-pending wipe-instead-of-flag). Сохраняются три **рекуррентных warning-паттерна** через несколько сессий: `subagent_type=general-purpose` fallback вместо canonical `product-devils-advocate` (×2 сессии), schema drift в `.da-findings/*` (×3 артефакта в 2 сессиях) и DA-pending destructive overwrite в cleanup-flow (×2 сессии). 7 сценариев так и не получили ни одного hit — главный пробел Phase 4 verification surface.

## Coverage matrix

| Scenario | Title | Best verdict | Sessions hit | Conflict? |
|---|---|---|---|---|
| S1 | HYP frontmatter canonical (Phase 4.A / DEC-DEV-0024) | ⚪ NOT-COVERED | — | — |
| S2 | Language discipline (Phase 4.B / DEC-DEV-0029) | ✅ COVERED | fbb32599 (COVERED), 9da2652a (UNCERTAIN) | yes — см. «Conflicts» |
| S3 | Full validation (Phase 4.C / DEC-DEV-0025 C.4) | ⚪ NOT-COVERED | — | — |
| S4 | NFR review F.5a Ask/Define (Phase 4.D / DEC-DEV-0028 D.2) | ⚪ NOT-COVERED | — | — |
| S5 | Handoff mode draft (Phase 4.E / DEC-DEV-0028 D.1) | ✅ COVERED | fbb32599 (COVERED), 9da2652a (PARTIAL) | yes — см. «Conflicts» |
| S6 | Handoff mode production (Phase 4.E) | 🟡 PARTIAL | fbb32599 (PARTIAL) | — |
| S7 | Cross-platform hash invariant (Phase 4.E + 4.F) | ⚪ NOT-COVERED | — | — |
| S8 | DA review FM-NNN (Phase 4.H / DEC-DEV-0026) | 🟡 PARTIAL | fbb32599 (PARTIAL) | — |
| S9 | DA review RL-NNN (Phase 4.H release scope) | ⚪ NOT-COVERED | — | — |
| S10 | Handoff `--with-da-review` (Phase 4.H wiring) | 🟡 PARTIAL | 9da2652a (PARTIAL) | — |
| S11 | Cleanup orphan detection (Phase 4.G / DEC-DEV-0027) | 🟡 PARTIAL | 5345f116 (PARTIAL) | — |
| S12 | Cleanup `--pending-hygiene` (Phase 4.G) | 🔴 FAIL | 98cb1b97 (FAIL), 5345f116 (FAIL) | — |
| S13 | NFR tier upgrade (Phase 4.D) | 🟡 PARTIAL | 8f10e02f (PARTIAL) | — |
| S14 | `verify-hooks.js` smoke runner | ⚪ NOT-COVERED | — | — |
| S15 | Phase 4 closure ritual (Phase 4.K) | ⚪ NOT-COVERED | — | — |

## Findings synthesis

### Recurring patterns

**P1 — `subagent_type=general-purpose` fallback вместо canonical `product-devils-advocate` (2 сессии, F-check warning)**

- `fbb32599` — Agent invocation для FM-002 DA review: «subagent_type=general-purpose used вместо canonical product-devils-advocate» с явным disclaimer «product-devils-advocate subagent type не доступен в текущей сессии» ([fbb32599 finding](fbb32599-4066-435b-a92d-54374b683596.md))
- `9da2652a` — Agent tool invocation `toolu_01JpQvz8Xs8oiuwa45MpC9QG`: «subagent_type=general-purpose instead of product-devils-advocate (skill anti-pattern #5)» ([9da2652a finding](9da2652a-7d70-452a-9e74-fe6cbfcc4b3d.md))

Это не drift одной сессии, а системный gap: канонический subagent type не зарегистрирован в `.claude/agents/` пользовательского проекта (или не подхватывается harness), поэтому ассистенты систематически фолбэчатся на `general-purpose` + briefing-by-instruction. Влияет на S8/S10 — DA review без isolated context контракта. **Класс drift'а — discoverability/registration, не behavioral.**

**P2 — Schema drift в `.product/.da-findings/*` (3 артефакта в 2 сессиях, A-check warning)**

- `fbb32599` — `NOTE-013-fm002-polish-backlog.md`: «missing required `version` field; `related_artifacts` used вместо canonical `related`»
- `fbb32599` — `.product/.da-findings/FM-002-2026-05-15-0030.md`: «per-finding fields rendered как markdown bold-text вместо canonical YAML per-finding frontmatter»
- `9da2652a` — `.product/.da-findings/FM-003-2026-05-15-1149.md`: «uses nested review_metadata + findings[] block instead of flat canonical fields»

Три разных shape varianta на одну spec — это **skill template gap** в `product-da-review.md`: explicit per-finding frontmatter template + anti-pattern list (паттерн `problem-discovery.md` Step 3 / DEC-DEV-0011 lesson) ещё не привинчен. Влияет на DA findings consumability hooks/Integrator.

**P3 — DA-pending wipe-instead-of-flag в cleanup-flow (2 сессии, F-check warning)**

- `98cb1b97` — `.product/.pending/da-pending.yaml`: «Auto-delete of fresh DA-pending entry violates cleanup-detector.md anti-pattern 2» (entry queued at 14:45:03, wiped at 14:47:07 в той же сессии)
- `5345f116` — `skills/product/cleanup-detector.md anti-pattern #2`: «DA-pending wipe was user-authorised but framed as Recommended — borderline» (помечено uncertain confidence: low)

Два независимых cleanup-флоу обошли flag-only контракт; в одном случае — destructive overwrite без user-confirmation, в другом — user-authorised, но `Recommended` formulation в AskUserQuestion подталкивает пользователя к destructive выбору. Корень — отсутствие enforcement (PreToolUse hook на Write к `da-pending.yaml`) и формулировка опций в skill flow. Связан с `S12` FAIL.

### Critical issues

- **🔴 [98cb1b97] BR-027 semantic edit wiped DA-pending entry без spawn `product-devils-advocate` (C-check, blocking, high confidence)** — `br-change-trigger.js` корректно поставил entry для `BR-027` с `trigger: P-RULE-02` после edit `lifecycles: [LC-Job] → [LC-004]` + version 1→2; через ~2 минуты ассистент перезаписал `.product/.pending/da-pending.yaml` к `entries: []` без invocation `product-devils-advocate`. Нарушение P-RULE-02 (Business Rule change → Devil's Advocate). Suggested action: восстановить DA pending entry для BR-027 либо зафиксировать `.product/.da-findings/BR-027-<timestamp>.md` с явным `severity: discussion + resolution: dismissed + rationale`. См. [98cb1b97 finding](98cb1b97-d338-435b-b152-182d4aec90d3.md).

### Conflicts

- **S2 (Language discipline)** — `fbb32599` → COVERED (Russian default + identifiers preserved verbatim в handoff/BR/NOTE bodies); `9da2652a` → UNCERTAIN (нет user-facing prose сообщений в транскрипте, только tool calls). Resolution: `COVERED` остаётся authoritative — UNCERTAIN в `9da2652a` это **отсутствие evidence**, а не contradiction; `fbb32599` имеет positive evidence. Pилот-finding: language discipline визуальный артефакт hard to verify в audit trail если skill output не попадает в transcript prose stream.
- **S5 (Handoff draft)** — `fbb32599` → COVERED (FM-001 handoff written, status: partial, 52 hashes, mode: draft preserved); `9da2652a` → PARTIAL (Task 3 «Generate FM-003 handoff» осталась pending — session ended до фактической generation). Resolution: `COVERED` authoritative (хронологически later сессия `9da2652a` — `2026-05-15T09:30Z` — раньше `fbb32599` 08:00, но обе в один день; positive evidence в `fbb32599` доминирует). PARTIAL в `9da2652a` показывает orthogonal риск: `--with-da-review` flow с TaskCreate-плэном уязвим к session-input-exit между Task 2 и Task 3.

## Per-session reports

- [98cb1b97-d338-435b-b152-182d4aec90d3](98cb1b97-d338-435b-b152-182d4aec90d3.md) — status: fail; coverage 0/0/1/14/0
- [5345f116-93ff-455f-92f4-77410fd3a37d](5345f116-93ff-455f-92f4-77410fd3a37d.md) — status: fail; coverage 0/1/1/13/0
- [5ba3ee30-592c-4e45-9ef6-08aa22e0ef55](5ba3ee30-592c-4e45-9ef6-08aa22e0ef55.md) — status: clean; coverage 0/0/0/15/0
- [fbb32599-4066-435b-a92d-54374b683596](fbb32599-4066-435b-a92d-54374b683596.md) — status: partial; coverage 2/2/0/11/0
- [9da2652a-7d70-452a-9e74-fe6cbfcc4b3d](9da2652a-7d70-452a-9e74-fe6cbfcc4b3d.md) — status: partial; coverage 0/2/0/12/1
- [8f10e02f-816c-4b56-a364-cdc925d00f6f](8f10e02f-816c-4b56-a364-cdc925d00f6f.md) — status: partial; coverage 0/1/0/14/0

## Recommendations

- **Re-run S12 после fix** для cleanup-detector anti-pattern №2 — добавить в `skills/product/cleanup-detector.md` Step 5c фильтр «exclude entries queued during current session window» + AskUserQuestion options reformulation (`Recommended` не должен ставиться на destructive choice). Дополнительно — PreToolUse Write hook (или extension `artifact-validate.js`) reject'ающий overwrite `.product/.pending/da-pending.yaml` к `entries: []` без `cleanup-reset-confirmed` marker. Покрывает [98cb1b97 + 5345f116] failure mode.
- **Codify P1 (subagent_type discovery) как D7 pattern** — добавить `dev/meta-improvement/patterns/subagent-fallback-discipline.md` с двумя branches: (a) verify `product-devils-advocate` registered в `.claude/agents/product/` через bootstrap; (b) если канонический subagent_type не доступен — refuse continue вместо silent fallback. Влияет на S8/S10/S15 verification surface для Phase 5.
- **Patch `skills/product/product-da-review.md`** — добавить explicit per-finding YAML frontmatter template + anti-pattern list (паттерн `problem-discovery.md` Step 3): запретить `review_metadata + findings[]` block, `related_artifacts`, markdown-bold per-finding rendering. Reference implementation: `note-promote.md` Step 3. Покрывает P2 (3 schema drift instances). Source: DEC-DEV-0011 lesson + B.1 convention.
- **Plan dedicated runtime smoke session для S1, S3, S4, S7, S9** — 5 сценариев с нулевыми hits (S1 HYP creation, S3 `/product:validate --deep`, S4 NFR review F.5a, S7 cross-platform hash, S9 RL-NNN release scope) не получили ни одного triggered run за 6 сессий. Без них Phase 4 verification surface остаётся 53% (8/15). Назначить targeted dogfood session с заранее заданным run-list.
- **DEV_JOURNAL retroactive entry** — populate Phase 4 smoke results entry per `PHASE_4_SMOKE_TEST_PLAN.md` §D template: 1 FAIL (S12), 5 PARTIAL, 2 COVERED, 7 NOT-COVERED, 1 Blocking finding (BR-027/P-RULE-02), 3 recurring patterns (P1/P2/P3). Decide: ship Phase 5 unblocked (per memory note) или gate on S12 fix + S1/S3/S4/S7/S9 runtime coverage.

## Skipped / out-of-scope

- **S1, S3, S4, S7, S9, S14, S15** — 7 сценариев без hits. S14 (`verify-hooks.js`) и S15 (closure ritual) уже подтверждены ✅ PASS в smoke plan §A.1 / DEC-DEV-0033 — runtime audit их не expected покрыть (это AI-session checks). Остальные 5 (S1/S3/S4/S7/S9) — реальный verification gap, см. Recommendations.
- **Uncertain findings**: `D-check / 98cb1b97` (Explore subagent timeout 389s — V-15 orphan list never surfaced в transcript) и `F-check / 5345f116` (DA-pending wipe user-authorised — borderline) — оба с low confidence, не повышаются до warning без re-run evidence. Re-run S11/S12 в чистой сессии без long subagent timeout (inline V-15 для проектов <200 артефактов) разрешит обе.
- **Fields drift в pre-existing artifacts** (например, `HYP-002` с `success_threshold` вместо canonical `target_value` в `my-first-test`) — pre-existing, не введённый Phase 4 сессиями; вне scope этого summary. Phase 4.A fix покрывает only future HYP creation — отмечено в [fbb32599 report S1 trace](fbb32599-4066-435b-a92d-54374b683596.md).
