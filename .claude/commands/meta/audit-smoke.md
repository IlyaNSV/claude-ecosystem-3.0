---
description: Audit accumulated session markers against the active phase smoke test plan (D7 conformance auditor).
argument-hint: --phase=<N> | --classify [--since=<duration>] [--target-project=<name>] [--session-id=<uuid>] [--transcript=<path>] [--force] [--dry-run] [--no-plan] [--skip-aggregate]
allowed-tools: Bash(node:*), Read, Glob
---

# /meta:audit-smoke

D7 conformance auditor. Reads Pending session markers from `dev/meta-improvement/audit-index.md`, runs per-session auditor (`claude -p`) against the active phase smoke test plan, computes an aggregate, and writes a phase-level summary.

Lives at this path because D7 mechanisms are **not deployed** to user projects (per CONVENTIONS §2). The command is available only when working in the ecosystem repo itself.

## When to use

After completing one or more smoke-test sessions in a pilot project (e.g., `my-first-test`), come back to the ecosystem repo and run this command to validate the recorded transcripts against the phase smoke plan.

See [`dev/meta-improvement/checklists/audit-smoke-workflow.md`](../../../dev/meta-improvement/checklists/audit-smoke-workflow.md) for the full ritual.

## Process

### Step 1 — Confirm we are in the ecosystem repo

Verify cwd contains `dev/meta-improvement/audit-index.md`. If not — instruct user: «This command must be run from the ecosystem repo root, not from a pilot project.»

### Step 2 — Validate arguments

User must pass `--phase=<N>` OR `--classify` OR `--no-plan` OR `--session-id=<uuid>` OR `--transcript=<path>`. If none of these — surface the help text from `node dev/meta-improvement/scripts/audit-smoke.js --help` and stop.

### Step 3 — Show what will be audited (dry run first if many)

If user did NOT pass `--dry-run` and the index has >3 Pending markers matching the filters — first run with `--dry-run` to surface the list to the user, then ask «Proceed with audit? [Y/N]». If user confirms, drop `--dry-run` and re-invoke.

### Step 4 — Execute the CLI

Invoke via the Bash tool:

```bash
node dev/meta-improvement/scripts/audit-smoke.js <args>
```

Pass through all user arguments verbatim. Stream stdout and stderr to the user in real time. The CLI prints progress lines:

```
Loaded smoke plan: dev/PHASE_4_SMOKE_TEST_PLAN.md (15 scenarios)
Found 3 session(s) to audit.

Auditing 01J… (target=my-first-test)…
  preprocessed: 287 relevant records
  ✓ status=findings → dev/meta-improvement/audit-reports/01J….md
...

Computing aggregate…
Aggregate JSON: dev/meta-improvement/audit-reports/phase-4-aggregate.json
Running aggregator…
Phase summary: dev/meta-improvement/audit-reports/phase-4-summary.md

Done: 3/3 audited; 0 FAIL; 1 PARTIAL
```

### Step 5 — Surface phase summary highlights

After CLI exit:

1. Locate the phase summary at `dev/meta-improvement/audit-reports/phase-<N>-summary.md` (path is printed by CLI).
2. Read the summary file.
3. Show the user (Russian if user has been speaking Russian — per `templates/project/CLAUDE.md.template` Language section):
   - The «Overview» paragraph verbatim
   - The «Coverage matrix» table
   - The «Recommendations» bullets
4. Do NOT echo full per-session reports — they are linked from the summary.

### Step 6 — Suggest next steps

Based on the summary's `status`:

| Status | Suggestion |
|---|---|
| `clean` | «Аудит чистый. Phase {{N}} runtime smoke считай выполненным; занеси `DEC-DEV-NNNN — Phase {{N}} smoke audit results` retroactive entry в DEV_JOURNAL.» |
| `findings` | «Есть findings — посмотри Critical issues в summary; реши: inline fix / queue к Phase N+1 readiness / defer к v1.1.» |
| `partial` | «Часть сценариев PARTIAL — посмотри per-session reports, реши, нужны ли дополнительные сессии smoke.» |
| `fail` | «🔴 Есть FAIL сценарии — Phase {{N}} имеет регрессии; разберись и при необходимости патч/откат, не закрывай Phase {{N}} closure ritual до фикса.» |

## Universal (classify) mode

`--classify` запускает универсальный аудит **продуктовых** сессий без привязки к фазе (Session Audit v2, Инкр.1 DEC-DEV-0056 → re-anchor Инкр.3a DEC-DEV-0059). Для каждой сессии:

1. Детерминированный пре-пасс ([`classify.js`](../../../dev/meta-improvement/scripts/classify.js)) строит профиль (slash-команды, тронутые пути, scope коммитов, флаги) и детектит **зоны** (multi-label, owned-only PMO) + **mode** по реестру [`rubrics/`](../../../dev/meta-improvement/rubrics/). Одна сессия может затронуть несколько зон.
2. `claude -p`-аудитор сверяет сессию с **объединённым** `baseline`/`criteria` всех активных зон (zone-guided catalog mode); `mode` модулирует строгость.
3. Пишется per-session отчёт с `session_zones` / `session_mode` во frontmatter. **Phase-summary НЕ создаётся** (нет фазы — нечего агрегировать).

В Processed-строке `audit-index.md`: `phase = —`, `mode = zones:<z1+z2>|<mode>`. CLI печатает `classified zones: <z1,z2> · mode=<mode>` на каждую сессию.

Типичный вызов: `--classify` (весь Pending) или `--classify --session-id=<uuid> --force` (одна сессия повторно). Переименование `/meta:audit-smoke`→`/meta:audit` отложено (см. `dev/SESSION_AUDIT_V2_DESIGN.md` §8).

**Полу-авто (Инкр.2, DEC-DEV-0057):** держать аудит почти на автомате, пока Claude открыт —
`/loop 45m node dev/meta-improvement/scripts/audit-watch.js` (тонкая обёртка над `--classify --since`,
идемпотентна). В classify-режиме каждой сессии добавляется **effect-probe** (deterministic-замер эффекта на
`.product/` пилота → секция «Effect on product» + `effect_summary` в отчёте). Ритуал:
[`checklists/audit-watch.md`](../../../dev/meta-improvement/checklists/audit-watch.md).

## CLI exit codes

| Exit | Meaning |
|---|---|
| 0 | All sessions audited, no FAIL |
| 1 | Fatal error (repo root not found, plan not found, etc.) |
| 2 | Arguments validation failed |
| 3 | One or more sessions ended `status: fail` |

## Anti-actions

- Do NOT modify per-session reports or summary files yourself — they are auditor output, not editable artifacts
- Do NOT auto-fix findings — the auditor's strict rule is surface-only; honor it at the command layer
- Do NOT commit reports automatically — `audit-reports/*` are reviewed manually before staging
- Do NOT re-run aggregator alone without per-session audits — aggregate JSON is consumed once per phase

## See also

- [`dev/meta-improvement/scripts/audit-smoke.js`](../../../dev/meta-improvement/scripts/audit-smoke.js) — CLI implementation
- [`dev/meta-improvement/prompts/session-audit.md`](../../../dev/meta-improvement/prompts/session-audit.md) — per-session prompt
- [`dev/meta-improvement/prompts/phase-audit-summary.md`](../../../dev/meta-improvement/prompts/phase-audit-summary.md) — aggregator prompt
- [`dev/meta-improvement/audit-index.md`](../../../dev/meta-improvement/audit-index.md) — Pending + Processed journal
- [`dev/meta-improvement/checklists/audit-smoke-workflow.md`](../../../dev/meta-improvement/checklists/audit-smoke-workflow.md) — workflow ritual (added in Commit 3)
- DEC-DEV-0034 — design rationale
