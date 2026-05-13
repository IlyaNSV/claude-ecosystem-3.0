---
description: Manual Product DA review. ID-prefix routing — FM-NNN spawns feature-scope DA; RL-NNN spawns release-scope DA (cross-FM consistency, HYP coverage, rollout deps per DEC-DEV-0026). Findings → .product/.da-findings/<ID>-<timestamp>.md unified schema (DEC-DEV-0030 A.1). Other prefixes (BR/IC/SC/LC/VC/RPM/MK) refused — те реализованы через hooks или approve gates.
argument-hint: "<FM-NNN | RL-NNN>"
allowed-tools: Read, Glob, Grep, Agent, Edit, Write, Bash(date:*)
---

# /product:da-review

User invoked: `/product:da-review $ARGUMENTS`

Ручной запуск Product DA Review через subagent `product-devils-advocate` в `Mode=full`. Per DEC-DEV-0026 — three-tier DA hierarchy с ID-prefix routing.

## Process

### Step 1: Parse + validate ID prefix

Parse `$ARGUMENTS` — expect single positional ID.

| Prefix | Routing | Scope |
|---|---|---|
| `FM-NNN` | ✅ accepted | feature |
| `RL-NNN` | ✅ accepted | release |
| `BR-*`, `IC-*` | ❌ refused | DA already auto-triggered хуками P-RULE-01/02 (per Phase 3) |
| `SC-*`, `LC-*`, `VC-*` | ❌ refused | per-artifact concerns surfaced на approve gate; review через FM-level если cross-rule concern |
| `RPM-*`, `MK-*` | ❌ refused | similar — FM-level review covers |
| anything else | ❌ refused | invalid prefix |

**Refusal message format:**

```
Refused: <ID prefix> not supported for /product:da-review.

Manual DA review accepts только FM-NNN (feature scope) или RL-NNN (release scope).

For per-artifact concerns:
  - BR/IC changes — DA auto-triggered хуками (см. .product/.pending/da-pending.yaml)
  - SC/LC/VC issues — review через /product:da-review FM-<owner-FM>
  - RPM/MK — surface через FM-level review or /product:cascade

Usage:
  /product:da-review FM-001            # feature-level review
  /product:da-review RL-001            # release-level review (cross-FM)
```

Empty `$ARGUMENTS` → show usage без refusal severity.

### Step 2: Check prerequisites per scope

**FM-NNN:**
- `.product/features/FM-<NNN>-*.md` exists (glob)
- FM frontmatter parseable
- FM.status ∈ {`draft`, `in-progress`, `shipped`} (refuse if `deprecated` или missing)

**RL-NNN:**
- `.product/releases/RL-<NNN>-*.md` exists
- RL frontmatter parseable
- `RL.features[]` non-empty
- Все FMs в `RL.features[]` resolved к existing files

Если prereq fails — surface specific error + suggested fix («FM-001 file missing — check `.product/features/`; если deleted, restore from git or use different FM-id»).

### Step 3: Load skill

Load `.claude/skills/product/product-da-review.md` per methodology.

### Step 4: Execute per skill instructions

1. Detect scope от ID prefix (FM → feature; RL → release)
2. Build brief per scope (see skill Step 3 Branch A/B)
3. Spawn `product-devils-advocate` subagent via Agent tool с brief
4. Await findings file written к `.product/.da-findings/<ID>-<YYYY-MM-DD>-<HHMM>.md`
5. Verify canonical frontmatter schema (per DEC-DEV-0030 A.1)
6. Surface summary к user

### Step 5: Per-finding interactive resolution

После summary surface — prompt user per finding (typical for manual invocation; в `--with-da-review` flow handoff caller decides):

```
Finding F1 — 🔴 Critical [Cross-FM consistency]
Statement: BR-022 в FM-002 нарушает IC-003 invariant из FM-001
Affected: FM-001, FM-002, IC-003, BR-022
Suggested drill-down: /product:da-review FM-002

Action? [A]ct | [D]efer | [Dismiss + rationale] | [S]kip
> _
```

**Action handlers:**
- `[A]ct` — surface к user instructions modify related artifact; expects user editing artifact + journal entry; mark finding `resolution: acted` в findings file frontmatter
- `[D]efer` — prompt for deferral target (Out of Scope / Roadmap / specific milestone); mark `resolution: deferred` + `follow_up.revisit_trigger`
- `[Dismiss]` — explicit rationale required (anti-sycophancy). Refuse если empty. Append journal entry. Mark `resolution: dismissed`
- `[S]kip` — leave finding `resolution: pending` для later session

### Step 6: Decision journal entry

После all findings resolved (или explicitly skipped к next session):

Append к `.product/.decisions/journal.md`:

```markdown
## DEC-PLAN-NNN — DA review <ID> findings resolution

**Date:** <ISO>
**Scope:** <feature | release>
**Source:** manual
**Findings file:** `.product/.da-findings/<ID>-<YYYY-MM-DD>-<HHMM>.md`

### Resolution summary

- Acted: <N>
- Deferred: <N>
- Dismissed: <N>
- Skipped: <N>

### Embedded findings (per DEC-DEV-0030 A.1)

- id: F1
  severity: critical
  artifact_ref: BR-022
  statement: «BR-022 нарушает IC-003 invariant из FM-001»
  resolution: acted
  follow_up:
    revisit_trigger: «при изменениях IC-003»

- id: F2
  ...
```

### Step 7: Surface inline summary

```
DA review complete для <ID> (scope: <feature | release>).

Resolution:
  Acted: <N> (artifact modifications logged)
  Deferred: <N>
  Dismissed: <N> (rationales journal'ed)
  Skipped: <N>

Findings file: .product/.da-findings/<ID>-<YYYY-MM-DD>-<HHMM>.md
Journal: .product/.decisions/journal.md (DEC-PLAN-NNN)

Next actions:
  /product:handoff <ID>                # generate handoff с fresh DA context
  /product:handoff <ID> --with-da-review   # re-run DA + handoff one-shot если additional changes
```

При **0 findings**: «✅ DA review clean. No critical/important findings surfaced. Subagent confidence: <high|medium|low>.»

## Anti-patterns

1. **Не accept invalid prefixes silently.** Refusal с structured message — protects against typos (`SC-005` typo вместо `FM-005`) и сохраняет conceptual clarity (DA hierarchy per scope).

2. **Не auto-resolve findings без user input.** Each finding requires explicit user decision (act / defer / dismiss / skip). Auto-dismiss или auto-act = anti-sycophancy violation.

3. **Dismissal без rationale = invalid.** Refuse continue если user dismisses 🔴 / 🟡 без rationale. 🔵 Discussion может dismiss freely (low-value); critical/important MUST rationale.

4. **Не bypass canonical schema verification.** Step 4.5 — verify frontmatter fields. Если subagent drifted (e.g., produced `confidence_rationale` вместо `resolution`) — surface к user; не silently rewrite findings file.

5. **Не invoke без prereq check.** Step 2 critical — spawning subagent для non-existent FM/RL wastes time + produces useless findings. Refuse early.

6. **Не propagate `--source` defaulting incorrectly.** When invoked directly by user, `--source` defaults к `manual`. When invoked from `/product:handoff --with-da-review`, caller passes `--source auto-pre-handoff` explicit. Этот command не parses `--source` от user args (internal); preserves correct provenance в findings file.

## Output writing protocol

- Findings file — written by subagent (Agent tool invocation). Этот command verifies post-write but не writes content.
- Decision journal — append (Edit или Write если missing) после user resolves findings.
- Не emit findings к stdout — user reads `.product/.da-findings/<ID>-*.md` для full content; command surfaces только summary.

## Related

- Skill: `.claude/skills/product/product-da-review.md` (implementation methodology)
- Subagent: `.claude/agents/product/devils-advocate.md` (Mode=full + scope=feature/release)
- Handoff integration: `.claude/commands/product/handoff.md` (`--with-da-review` invokes этот command с `--source auto-pre-handoff`)
- Hook-driven DA (artifact scope): `.claude/hooks/product/br-change-trigger.js`, `ic-change-trigger.js` (Phase 3)
- Findings location: `.product/.da-findings/<ID>-<YYYY-MM-DD>-<HHMM>.md`
- Phase 4 decisions:
  - DEC-DEV-0026 — three-tier DA hierarchy (scope: artifact | feature | release)
  - DEC-DEV-0030 — A.1 canonical schema, Ambiguity 18 ID-prefix routing
- v1.1 deferred (per `dev/v1_1_backlog.md`):
  - Recursive auto drill-down (currently hint-only — user manually invokes per recommendation)
  - Cross-FM structural dependency graph (`FM.depends_on` schema + V-11-DEP rule)
