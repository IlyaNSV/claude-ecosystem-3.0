---
description: Manual Product DA review — invokes product-devils-advocate subagent в Mode=full с двумя scope branches (feature FM-NNN; release RL-NNN per DEC-DEV-0026). Constructs scope-specific brief, surfaces findings, writes к unified .product/.da-findings/<id>-<timestamp>.md per DEC-DEV-0030 A.1 canonical schema. Phase 4.H deliverable.
---

# Product DA Review — Phase 4 skill

Loaded by `/product:da-review <ID>` command. Spawns `product-devils-advocate` subagent (Mode=full, scope per ID prefix) with structured brief, awaits findings file, surfaces summary к invoking session.

## Architecture (per DEC-DEV-0026)

Three-tier DA hierarchy:

| Mode | Scope | Trigger | This skill handles |
|---|---|---|---|
| `adaptive` | `artifact` | hook P-RULE-01/02 | ❌ (orchestrated by `feature-session.md` через hook stderr signal) |
| `full` | `feature` | `/product:da-review FM-NNN` | ✅ — FM-level branch |
| `full` | `release` | `/product:da-review RL-NNN` | ✅ — release-level branch |

ID-prefix routing per Ambiguity 18 (DEC-DEV-0030): команда detects prefix → routes к этому skill → skill picks branch.

**Refused prefixes** (early in command, не доходит до skill): `BR-*`, `IC-*`, `SC-*`, `LC-*`, `VC-*`, `RPM-*`, `MK-*`. Эти артефакты — per-artifact scope; их DA автоматически triggered хуками P-RULE-01/02 (hook-driven, adaptive). Manual review всегда на уровне FM (где BR/IC livet) или RL (где FMs grouped).

## Input

- `<ID>` — `FM-NNN` или `RL-NNN`
- Optional `--source <manual | auto-pre-handoff>` — passed-through от caller (defaults to `manual`); `auto-pre-handoff` set'ся когда invocation из `/product:handoff --with-da-review`

## Execution flow

### Step 1: Detect scope от ID prefix

```
FM-NNN → scope: feature, branch: FM-level
RL-NNN → scope: release, branch: RL-level
```

### Step 2: Verify prerequisites per scope

**Для FM-NNN:**
- `.product/features/FM-<NNN>-*.md` exists (glob)
- FM frontmatter parseable
- FM.status ∈ {`draft`, `in-progress`, `shipped`} (не `deprecated`)

**Для RL-NNN:**
- `.product/releases/RL-<NNN>-*.md` exists (glob)
- RL frontmatter parseable
- `RL.features[]` non-empty (release без FMs не подлежит DA)
- Все FMs в `RL.features[]` exist as files (validate refs)

Если prereq fails — refuse early с конкретной ошибкой.

### Step 3: Build brief per scope

#### Branch A — FM-level brief

```
Mode: full
Scope: feature
Artifact(s) under review: FM-<NNN> + linked SC/BR/IC/LC/VC/MK(if has_ui)/RPM/NFR(if nfr_status=active)
Trigger: manual /product:da-review FM-<NNN> | auto-pre-handoff (--with-da-review)
Diff (for adaptive mode): n/a — full mode skips classification
Context files to read:
  - .product/features/FM-<NNN>-*.md (FM body)
  - .product/scenarios/<SC-*>-*.md (per FM.scenarios[])
  - .product/business-rules/<BR-*>-*.md (per FM.rules[])
  - .product/invariants/<IC-*>-*.md (per FM.invariants[])
  - .product/lifecycles/<LC-*>-*.md (per FM.lifecycles[])
  - .product/verification/<VC-*>-*.md (per FM.verification[])
  - .product/mockups/<MK-*>-*.md (если has_ui)
  - .product/rpm/<RPM-*>-*.md (per FM.rpm если applicable)
  - .product/nfr/<NFR-*>-*.md (если FM.nfr_status=active)
  - .product/glossary.md (BG для term consistency)
  - .product/.da-findings/FM-<NNN>-*.md (prior reviews, для pattern detection)
Project context:
  - Tier: <read product.yaml.product_tier; default mvp>
  - Validation tier: <product.yaml.validation_tier>
  - FM status: <FM.frontmatter.status>
  - NFR status: <FM.frontmatter.nfr_status>
  - Prior FM-level DA findings: <list или "none">
Specific concerns from user (optional): <if user passed extra concern via command, else omit>
```

#### Branch B — RL-level brief

```
Mode: full
Scope: release
Artifact(s) under review: RL-<NNN> + all FMs в RL.features[]
Trigger: manual /product:da-review RL-<NNN> | auto-pre-handoff (--with-da-review)
Diff (for adaptive mode): n/a — full mode skips classification
Context files to read:
  - .product/releases/RL-<NNN>-*.md (RL body + frontmatter)
  - .product/features/<FM-*>-*.md (per RL.features[] — full bodies, NOT just frontmatter)
  - .product/hypotheses/<HYP-*>-*.md (per RL.hyp_coverage[] если present)
  - .product/glossary.md (BG для cross-FM term consistency)
  - .product/.decisions/journal.md (filter entries by date range RL.created..now; key для scope creep lens)
  - .product/.da-findings/FM-*-*.md (prior FM-level findings для FMs в release; informs cross-FM analysis)
  - .product/.da-findings/RL-<NNN>-*.md (prior release reviews)
Project context:
  - Tier: <product.yaml.product_tier>
  - Validation tier: <product.yaml.validation_tier>
  - RL status: <RL.frontmatter.status>
  - RL target date: <RL.frontmatter.target_date если present>
  - FMs in scope: <list IDs>
  - Cross-FM dependencies: <best-effort parsed from FM bodies §12; flag low-confidence>
Drill-down hints: <FM-* candidates для recursive review per devils-advocate.md Methodology — release scope>
Specific concerns from user (optional): <if user passed extra concern>
```

**Per DEC-DEV-0030 Ambiguity 2:** cross-FM dependency reconstruction = best-effort text parsing FM body §12. Subagent explicitly flags low-confidence в classification_rationale.

### Step 4: Spawn subagent

Use Agent tool:

```
Agent({
  subagent_type: "product-devils-advocate",
  description: "DA review <scope> for <ID>",
  prompt: <full brief из Step 3>
})
```

Subagent runs в isolated context per `agents/product/devils-advocate.md`. Returns:
- Markdown summary к invoking session
- Writes findings file к `.product/.da-findings/<ID>-<YYYY-MM-DD>-<HHMM>.md` per canonical schema

### Step 5: Verify findings file written

After subagent returns:
- Glob `.product/.da-findings/<ID>-<YYYY-MM-DD>-*.md` (today's date)
- If file missing → subagent failed silently; surface error к user, refuse continue
- If file present → parse frontmatter, verify canonical fields:
  - `id`, `severity`, `artifact_ref`, `source`, `scope` — required
  - `affected_artifacts[]` — required если scope == release AND severity ∈ {critical, important}
  - `suggested_drill_down` — required если scope == release AND severity ∈ {critical, important}

Если frontmatter invalid → surface к user «DA findings file generated с invalid schema. Review .product/.da-findings/<file>.md и corrective re-run если нужно.»

### Step 6: Surface summary к invoking session

```
DA Review complete: <ID> (scope: <feature|release>, source: <manual|auto-pre-handoff>)

Findings:
  🔴 Critical: <N>
  🟡 Important: <M>
  🔵 Discussion: <K>

Critical findings:
  F1 [<lens>]: <one-line statement>
       Affected: <artifact_ref>+<affected_artifacts если scope=release>
       Drill-down: <suggested_drill_down если present>
       Suggested action: <action>

Important findings:
  F2 ...

File: .product/.da-findings/<ID>-<YYYY-MM-DD>-<HHMM>.md

Per-finding next actions (interactive если from /product:da-review; preview if --with-da-review pre-handoff):
  [A]ct — modify related artifact, log decision journal
  [D]efer — add to Out of Scope или Roadmap с rationale
  [Dismiss] — explicit rationale required (anti-sycophancy)
  [S]kip — leave для later

For release scope drill-down recommendations:
  /product:da-review FM-001     # focus FM-001 в context of release-level finding F1
  /product:da-review FM-002     # similar
```

### Step 7: Decision journal entry (caller-side)

После user resolves findings — invoking command (`/product:da-review` или `/product:handoff`) appends journal entry с embedded выжимкой per DEC-DEV-0030 A.1:

```markdown
## DEC-PLAN-NNN | DEC-AUTO-NNN — DA review <ID> findings resolution

**Date:** <ISO>
**Scope:** feature | release

### Findings summary

- 2 critical addressed, 1 deferred к v1.1, 3 important acted
- 0 dismissed

### Embedded findings (выжимка per DEC-DEV-0030 A.1)

- id: F1
  severity: critical
  artifact_ref: BR-022
  statement: «BR-022 нарушает IC-003 invariant»
  resolution: acted
  follow_up:
    revisit_trigger: «при changes в IC-003»
- id: F2
  severity: important
  artifact_ref: HYP-001
  statement: «HYP-001 success metric не fully covered release scope»
  resolution: deferred
  follow_up:
    revisit_trigger: «before RL-001 ship»

### Full findings

See `.product/.da-findings/<ID>-<YYYY-MM-DD>-<HHMM>.md`.
```

## Conditional invocation context

### From `/product:handoff --with-da-review`

`--source auto-pre-handoff` passed. Skill executes Steps 1-6 как обычно. Step 6 surfaces summary к handoff command, который:
- If `🔴 Critical unresolved` → blocks generation, refuses continue (returns control к user)
- If only `🟡 Important` или `🔵 Discussion` → handoff proceeds; warnings logged к handoff frontmatter
- User может interactively address per-finding до handoff generation

Handoff-side wiring: `skills/product/handoff-generator.md` Step 4 invokes этот skill через `SlashCommand` tool («/product:da-review FM-NNN --source auto-pre-handoff») и waits findings file written, parses, decides continue/block per critical count.

### From `/product:da-review <ID>` (default manual)

`--source manual`. Skill executes Steps 1-6. Step 6 returns control к user; user manually invokes follow-up actions per finding.

## Anti-patterns

1. **Не accept invalid ID prefixes.** BR-*, IC-*, SC-*, LC-*, VC-*, RPM-*, MK-* — refused. Их DA already automatic через hooks (BR/IC) или pending (SC/LC/VC через approve gate per process). Manual `/product:da-review` — только FM или RL.

2. **Не skip canonical frontmatter schema validation в Step 5.** Subagent может produce drift в field names (lesson DEC-DEV-0011 + DEC-DEV-0024). Verify все required fields present с canonical names; surface к user если drift detected.

3. **Cross-FM text parsing — always flag confidence.** Per DEC-DEV-0030 Ambiguity 2: FM body §12 «Dependencies on other features» — best-effort source. Если §12 missing/informal — subagent MUST flag в `classification_rationale` («Dependency inference from §1/§5 keywords, low confidence»). Skip flag = silent low-quality finding.

4. **Не auto-fire drill-down recommendations в Phase 4.** Per DEC-DEV-0030 cut decision: recursive auto drill-down = v1.1 aspirational. Phase 4 ships hints surfaced к user; user manually invokes per recommendation. Не trigger nested Agent spawns automatically.

5. **Не reinvent subagent invocation logic.** Use Agent tool с `subagent_type: "product-devils-advocate"` — single invocation path. Не workaround через Bash или other tools.

6. **Не cache prior findings file content без re-read.** Per scope=release: prior FM-level findings (filter `.product/.da-findings/FM-*-*.md` per RL.features[]) inform release analysis. Subagent reads them в isolated context per brief — orchestrator (этот skill) только passes paths в brief, не content.

7. **Не truncate suggested_drill_down list arbitrary.** Release-level finding с 5 affected_artifacts surface всех 5 drill-down recommendations к user. User decides scope; skill не decides «слишком много, show only top-3».

## Related

- Subagent: `.claude/agents/product/devils-advocate.md` (Mode=full + scope=feature/release branches)
- Companion command: `.claude/commands/product/da-review.md` (ID-prefix routing)
- Handoff wiring: `.claude/skills/product/handoff-generator.md` Step 4 (`--with-da-review` invocation)
- Findings location: `.product/.da-findings/<ID>-<YYYY-MM-DD>-<HHMM>.md` (canonical schema per DEC-DEV-0030 A.1)
- Decision journal embed contract: DEC-DEV-0030 A.1 — `id, severity, artifact_ref, statement, resolution, follow_up.revisit_trigger`
- Phase 4 decisions:
  - DEC-DEV-0026 — three-tier DA hierarchy + scope schema fields
  - DEC-DEV-0030 — A.1 schema location + Ambiguity 2 text parsing + Ambiguity 18 ID-prefix routing
- Deferred к v1.1 per DEC-DEV-0030 (см. `dev/v1_1_backlog.md` «D.7 Release-level DA aspirational layer»):
  - Recursive auto drill-down (currently hint-only)
  - Cross-FM structural dependency graph (`FM.depends_on` field + V-11-DEP rule)
