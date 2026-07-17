---
description: On-demand validation runner — executes the artifact (V-01..V-18) + handoff (V-H-01..V-H-11) + lesson (V-LE-01..05) catalog; V-MK-*/V-AM-* — acknowledged skips (см. таблицы). Tier-aware (B1 per product.yaml.validation_tier), quiet-mode-aware (B2 — draft artifacts queue findings), supports --rule/--scope/--tier filtering and --deep severity uplift. JSON + markdown report output. Phase 4 hardcode implementation per DEC-DEV-0025 C.4 (V-H-11 added post-review per R5/B1 fix-up).
---

# Validation Runner — Phase 4 skill

Loaded by `/product:validate` command. Executes validation rules across `.product/` artifacts, emits structured report.

## Architecture (per DEC-DEV-0025 C.4)

**Hardcode list approach** (not parser of `validation.md` catalog):
- Markdown catalog `.claude/docs/pmo/validation.md` — human-readable spec, source of truth для rule semantics
- This skill — implementation source of truth для runtime behavior
- Drift между catalog и runner отлавливается детерминированно в dev-репо экосистемы: линтер `check-validation-sync.cjs` в `npm run verify` сравнивает ID-множества (каталог ↔ таблицы ниже + `catalog-sync:acknowledged`-маркеры) — DEC-DEV-0158, G19. В user-проект файлы приезжают уже сверенными

**Rationale:** at ~25 rules в v1, hardcode проще + надёжнее, чем хрупкий markdown parser. Linter добавится когда правил станет 100+ или drift реально проявится (DEC-DEV-0030 lesson #2).

## Input

- `--rule V-NN` — single rule filter (e.g., `--rule V-11`, `--rule V-H-04`)
- `--scope <glob>` — artifact filter (e.g., `--scope "BR-*"`, `--scope "FM-001"`)
- `--tier <blocking|warning|info>` — minimum severity threshold (default: per `validation_tier` в `.claude/product.yaml`)
- `--deep` — severity uplift: все rules treated 🔴 Blocking regardless of catalog default; effective tier = `full`. Используется перед release / handoff.
- `--report-format <json|markdown|both>` — default: both
- No flags → full validation per current tier

## Tier-based activation (per B1 modification, `validation.md` §2.3)

Read `.claude/product.yaml.validation_tier`:

| Tier | Inline (active) | Queued (показываются в /product:status и /product:validate) |
|---|---|---|
| `pilot` (bootstrap default) | 🔴 Blocking | 🟡 Warning, 🔵 Info |
| `mvp` | 🔴 + 🟡 | 🔵 Info |
| `full` | All runner-implemented rules | (none) |

С `--deep` flag override: effective tier = `full` regardless of product.yaml.

## Quiet draft mode (B2)

Per `validation.md §3.1.1` + DEC-DEV-0023 F5:
- Artifact с `status: draft` — findings queued в `.product/.pending/validation-pending.yaml`, не surfaced inline
- При вызове `/product:validate` (или при draft→active transition) — surfaces all queued findings
- **Auto-purge** (per DEC-DEV-0023 F5 pattern): для each existing entry в validation-pending.yaml — re-evaluate rule; если currently passes → purge entry. Sub-phase C runner extends pattern из `artifact-validate.js`, не reinvents.

## Rule catalog (hardcoded)

### V-01..V-18 — Artifact validation

| Rule | Severity | Artifacts | Check method | Description |
|---|---|---|---|---|
| V-01 | 🔴 Blocking | FM | `count(FM.scenarios[] where status=active) ≥ 1` | FM has ≥1 active SC |
| V-02 | 🟡 Warning | SC | `count(SC.rules[] where status=active) ≥ 1` | SC references ≥1 BR (suggestion) |
| V-03 | 🔴 Blocking | SC | `all(SC.rules[] → BR.status = active)` | BR refs в SC are all active |
| V-04 | 🔴 Blocking | SC | `SC.feature → FM.status ∈ {in-progress, shipped}` | SC references active FM |
| V-05 | 🔴 Blocking | LC | BFS from `initial_state` covers all `states[]` | LC states reachable from initial |
| V-06 | 🟡 Warning | LC | `all(transitions has trigger or guard)` | LC transitions have trigger/guard |
| V-07 | 🟡 Warning | SC, VC | count VC per SC.flow_type ≥ 1 per type | VC covers main + alt + error flows |
| V-08 | 🟡 Warning | SC, BR, LC, BG | regex `**term**` extract + BG lookup | Bold terms defined в BG |
| V-09 | 🔴 Blocking | SEG, VP | exactly one VP referenced; чекпойнт — выход D1.4a (`null` легитимен до создания VP, см. validation.md V-09; DEC-DEV-0220-e) | SEG has exactly 1 VP |
| V-10 | 🔴 Blocking | FM | `FM.segment` set + `FM.jtbd[]` non-empty | FM has SEG and JTBD |
| V-11 | 🔴 Blocking (auto-fix) | all | bi-dir refs consistent | Bi-dir references consistent |
| V-12 | 🟡 Warning | all draft | `now - frontmatter.updated > stale_draft_days` | No stale drafts (>14 дней default) |
| V-14a | 🟡 Warning | BR | parameter compare across BR pairs (same category + entity, conflicting numeric/enum) | Parametric BR conflict |
| V-15 | 🟡 Warning | all | graph: no incoming refs from active artifacts | Orphan artifacts detection |
| V-16 | varies | FM, NFR | tier × `nfr_status` × high_risk matrix (см. ниже) | NFR Review status tracking |
| V-18 | 🟡 Warning | IC, BR, SC | per-type frontmatter schema per `docs/pmo/artifacts/<TYPE>.md`: значение `type`, обязательные per-type поля, scalar-enum'ы (on-demand scope IC/BR/SC; inline-check `artifact-validate.js` **дополнительно** покрывает `NFR` с DEC-DEV-0198 — этот on-demand путь NFR пока не enforce-ит; override-aware) | Per-type frontmatter schema conformance (IC/BR/SC) |

V-13 dropped per `validation.md §0` → process rule P-RULE-01 (см. agents/product/devils-advocate.md adaptive-depth). V-17 перемещён в Integrator namespace (V-I-*, future) per `validation.md §0`.

### V-16 NFR severity matrix (special — conditional logic per `validation.md §5.1`)

Per FM, determine severity by tier × nfr_status × risk context:

```
nfr_status = FM.frontmatter.nfr_status      # pending | active | declined
has_decline_rationale = bool(FM.frontmatter.nfr_decline_reason)
high_risk = FM.frontmatter.requires_nfr OR
            FM.body contains keywords: ["payments", "PII", "billing",
                                         "real-time", "public API",
                                         "concurrent editing"]
product_tier = read product.yaml.product_tier (default: mvp)

IF nfr_status == 'active':
    severity = pass  # ✅

ELIF nfr_status == 'declined':
    IF high_risk AND NOT has_decline_rationale:    severity = blocking  # 🔴
    ELIF high_risk:                                 severity = warning   # 🟡
    ELIF product_tier IN {mmp, growth, mature}:    severity = warning   # 🟡
    ELIF has_decline_rationale:                     severity = pass-info # 🔵 (Info note OK)
    ELSE:                                           severity = info      # 🔵 (recommend rationale)

ELIF nfr_status == 'pending':
    IF high_risk:                                   severity = warning   # 🟡
    ELIF product_tier IN {mmp, growth, mature}:    severity = warning   # 🟡
    ELSE:                                           severity = info      # 🔵 (recommend F.5a)
```

On tier upgrade (MVP → MMP) — все FM со `nfr_status: declined | pending` re-evaluated; см. `/product:nfr-upgrade-tier` (Phase 4.D).

### V-H-01..V-H-11 — Handoff validation

| Rule | Severity | Check method | Description |
|---|---|---|---|
| V-H-01 | 🔴 Blocking | parse markdown headings, check 13 mandatory sections | All mandatory sections present |
| V-H-02 | 🔴 Blocking | for each `embedded_artifacts[]` → `artifact_hashes[id]` exists, format `sha256:<hex64>` | Each embedded artifact has hash |
| V-H-03 | 🔴 Blocking | `embedded_artifacts[]` ↔ body sections cross-check | All listed artifacts actually embedded |
| V-H-04 | 🟡 Warn (→ stale) | recompute hash из current `.product/` через `hooks/product/lib/hash.js` (sub-phase E) → compare с frontmatter `artifact_hashes` | Hashes match current `.product/` |
| V-H-05 | 🔴 Blocking | cross-ref check внутри handoff body (e.g., SC-005 ссылается на BR-010 → BR-010 embedded section §6 exists) | Cross-refs valid within handoff |
| V-H-06 | 🔴 Blocking | YAML parse + required fields check (id, type, feature/release, status, version, generated_at, embedded_artifacts, artifact_hashes, validation_rules_passed) | Frontmatter valid YAML |
| V-H-07 | 🟡 Warning | regex bold extract из body + BG excerpt section §3 lookup | BG excerpt covers all bold terms |
| V-H-08 | 🔴 Blocking | if `FM.has_ui=true`, body section 10 non-empty + MK/DS/NM embedded | UI Specification filled если has_ui |
| V-H-09 | 🟡 Warning | parse FM body §12 «Dependencies» → cross-check handoff §12 mentions all | Dependencies section lists prerequisites |
| V-H-10 | 🟡 Warning | body section 13 non-empty (даже «ничего явно не excluded — это тоже info») | Out of Scope section non-empty |
| V-H-11 | varies | `FM.nfr_status` × handoff section 11 content matrix (см. ниже) | NFR section 11 conformity к FM.nfr_status three cases (active / declined / pending) |

### V-H-11 NFR section conformity matrix (special — conditional logic per `handoff-spec.md §6 Раздел 11`)

Per handoff с embedded FM, determine severity by `FM.nfr_status` × section 11 content presence:

```
nfr_status = FM.frontmatter.nfr_status            # active | declined | pending
has_decline_rationale = bool(FM.frontmatter.nfr_decline_reason)
high_risk = FM.frontmatter.requires_nfr OR FM body high-risk keywords (same set as V-16)
section11_has_embedded_nfr = handoff body section 11 содержит full NFR-NNN bodies
section11_has_decline_rationale = handoff body section 11 содержит rationale text
section11_has_warning_text = handoff body section 11 содержит pending warning + receiver guidance

IF nfr_status == 'active':
    IF section11_has_embedded_nfr:                  severity = pass             # ✅
    ELSE:                                            severity = blocking         # 🔴 (inconsistent state)

ELIF nfr_status == 'declined':
    IF high_risk AND NOT has_decline_rationale:     severity = blocking         # 🔴 (V-16 intersection)
    ELIF section11_has_decline_rationale:           severity = pass             # ✅
    ELSE:                                            severity = warning          # 🟡 (rationale missing в handoff body)

ELIF nfr_status == 'pending':
    IF section11_has_warning_text:                  severity = warning          # 🟡 (advisory; warnings[] entry; handoff status: partial)
    ELSE:                                            severity = blocking         # 🔴 (Case C boilerplate отсутствует — receiver не получит guidance)
```

V-H-11 пересекается с V-16 (artifact-level NFR tracking): V-16 проверяет `FM.nfr_status` frontmatter; V-H-11 проверяет handoff body section 11 соответствие тому статусу. При high-risk FM declined без rationale — оба правила блокируют (defense in depth).

### V-MK-* — Skipped в Phase 4 (per DEC-DEV-0028 D.4)

<!-- catalog-sync:acknowledged V-MK-01 V-MK-02 V-MK-03 V-MK-04 V-MK-05 V-MK-06 V-MK-07 V-MK-08 reason="Design module conditional Phase 6; documented skip per DEC-DEV-0028 D.4 — silent skip + graceful note, never fake pass" -->

V-MK-01..V-MK-08 не shipped в Phase 4 — Design module conditional Phase 6.

- **Silent skip** при общей validation (default flow): runner просто mimo, не emits findings, не учитывает в counts.
- **Explicit request** `--rule V-MK-NN` → graceful note:
  ```
  V-MK-NN requires Design Module (Phase 6 conditional).
  Currently not implemented.
  
  To activate: /design:start <FM-id> (Phase 6) → re-run /product:validate.
  ```

### V-AM-* — Inline-only (Design hook), не в on-demand runner

<!-- catalog-sync:acknowledged V-AM-frontmatter V-AM-id V-AM-module-ref V-AM-nm-ref reason="реализованы inline-хуком hooks/design/design-artifact-validate.js на каждом AM save (DEC-DEV-0066); on-demand прогон не shipped — semantics V-MK-класса: silent skip + graceful note" -->

V-AM-frontmatter / V-AM-id / V-AM-module-ref / V-AM-nm-ref (App Map derived-обзор, `validation.md §5.3b`) исполняются **inline-хуком** `hooks/design/design-artifact-validate.js` на каждом сохранении AM (DEC-DEV-0066) — on-demand исполнение в runner не shipped. Semantics как у V-MK-*: **silent skip** в общем прогоне; explicit `--rule V-AM-<slug>` → graceful note («executed inline by design-artifact-validate.js on AM save; on-demand run not implemented»). Никогда не «✅ pass» без реальной проверки.

### V-LE-01..05 — LESSON validation (corrective lessons, DEC-DEV-0062)

LESSON-* — corrective lesson артефакт (см. `validation.md §5.1b`). Вне dependency graph (как NOTE): V-01..V-16, V-MK-*, V-H-*, cascade (V-11), orphan (V-15) **не применяются**. Только V-LE-01..05.

| Rule | Severity | Artifacts | Check method | Description |
|---|---|---|---|---|
| V-LE-01 | 🔴 Blocking | LESSON | frontmatter parse; required `id,type,title,status,confidence,created,updated,version`; `id` matches `LESSON-\d{3}`; `status ∈ {open,active,deprecated}`; `confidence_notes` if `confidence!=high` | Frontmatter & status integrity (block open→active on fail) |
| V-LE-02 | 🔴 Blocking | LESSON | if `status=active`: `fix_ref` non-empty AND each ref path/id exists (existence-only) AND body `## Fix applied` non-empty | Applied-fix invariant (the LESSON↔.pending difference) |
| V-LE-03 | 🔴 Blocking | LESSON | if `status=active`: `guard` non-empty AND `guard_kind` set AND body `## Guard (reusable)` non-empty | Reusable-guard invariant |
| V-LE-04 | 🟡 Warning | LESSON | `applies_to[]` entries resolve (informational; orphans allowed by design) | applies_to references |
| V-LE-05 | 🟡 Warning | LESSON | `status=open` AND `now - created > open_lesson_age_days` (default 7); surfaced on-demand + session-start | Open-lesson age hygiene |

**Gate semantics:** V-LE-01/02/03 Blocking failure keeps the lesson `status: open` (blocks `open→active` and `none→active`). Real-time non-deferrability — это hooks `lesson-gate.js` (Stop) + `lesson-presence-gate.js` (PreToolUse/UPS), не runner; V-LE-05 — hygiene backstop поверх gate.

## Execution flow

1. **Parse args.** Defaults: tier from `product.yaml`, format=both, no filters.
2. **Load `.product/` index.** Glob via `Glob` tool, parse frontmatter с Read (limit ~50 lines per file для frontmatter only), build lookup table:
   - `artifacts_by_id` — id → file path + frontmatter
   - `artifacts_by_type` — type → list of artifacts
   - `cross_refs` — backref graph (for V-11, V-15)
3. **Load pending state.** Read `.product/.pending/validation-pending.yaml` если exists.
4. **Per applicable rule** (filtered by `--rule`, effective tier, `--scope`):
   - Apply check method per table above
   - Record findings: `{rule, severity, artifact, message, suggested_fix, ...}`
5. **Auto-purge stale pending.** Для each entry в validation-pending.yaml:
   - Re-evaluate rule на referenced artifact
   - Если currently passes → mark for purge
   - Write updated pending.yaml (subset of entries that still fail)
6. **V-11 auto-fix.** Inline-apply missing reverse refs (Edit на target artifact frontmatter). Report «Auto-fixed: N V-11 bi-dir refs» в output.
7. **Generate report.** JSON + markdown per `--report-format`. Write к `.product/.reports/validate-<YYYYMMDD-HHMM>.{json,md}`. Markdown also surfaced inline в conversation.

## Output format

### JSON (`.product/.reports/validate-<YYYYMMDD-HHMM>.json`)

```yaml
report_id: "validate-2026-05-12-1430"
generated_at: 2026-05-12T14:30:00Z
project: <project_name>
validation_tier: mvp                  # effective tier (post --deep override)
scope:
  rule_filter: null                   # или "V-11"
  artifact_filter: null               # или "BR-*"
  deep: false

summary:
  rules_evaluated: 25
  findings_total: 17
  findings_blocking: 3
  findings_warning: 12
  findings_info: 2
  v11_auto_fixed: 2
  stale_pending_purged: 5

findings:
  - id: F1
    rule: V-01
    severity: blocking
    artifact: FM-007
    message: "FM-007 has no active SC"
    suggested_fix: "Create SC via /product:feature FM-007"
  - id: F2
    rule: V-05
    severity: blocking
    artifact: LC-003
    message: "State 'abandoned' unreachable from initial via parsed transitions"
    suggested_fix: "Add transition or remove orphan state"
  # ...

auto_fixes_applied:
  - rule: V-11
    artifact: BR-010
    fix: "Added SC-005 to BR-010.scenarios[] reverse-ref"

pending_purged:
  - rule: V-08
    artifact: SC-012
    reason: "Bold term 'Revision batch' now exists в BG"
```

### Markdown (per `validation.md §10.3` шаблон, surfaced inline + saved)

```
=== VALIDATION REPORT ===
Project: <name>
Scope: .product/**
Time: 2026-05-12 14:30
Tier: mvp (effective; --deep: false)

🔴 BLOCKING (3):
  V-01 : FM-007 has no active SC
         → Fix: /product:feature FM-007 (create SC)
  V-05 : LC-003 state "abandoned" unreachable from initial
         → Fix: add transition или remove orphan state
  V-H-02: HANDOFF-FM-009 missing hash for SC-012
         → Fix: /product:handoff FM-009 --regenerate

🟡 WARNING (12):
  V-02 : SC-015 has no BR references (pure navigation? confirm at approve)
  V-07 : VC coverage missing alt-flow для SC-005a
  V-12 : 3 stale drafts (>14 days):
           - MR (updated 2026-05-20)
           - CA (updated 2026-05-22)
           - HYP-004 (updated 2026-05-10)
  V-H-07: HANDOFF-FM-003 BG excerpt missing term "Revision batch"
  ... (8 more)

🔵 INFO (2):
  V-16 : FM-001 nfr_status: pending — рассмотрите F.5a через /product:nfr-review
  V-16 : FM-002 nfr_status: declined (no rationale) — добавьте nfr_decline_reason

SUMMARY: 3 blocking, 12 warnings, 2 info
Auto-fixed: 2 V-11 bi-dir refs
Stale pending purged: 5 entries from validation-pending.yaml

Actionable next:
  /product:validate --rule V-01      # focus single blocking
  /product:validate --deep           # strict pre-release pass
  /product:cleanup --dry-run         # V-15 orphan detection preview (Phase 4.G shipped; default = orphan-only, --pending-hygiene для full sweep)
```

## Anti-patterns

1. **Не парсить `validation.md` программно для ИСПОЛНЕНИЯ правил.** Это — human-readable spec, не runtime source. Catalog updates → manual mirror в этом skill; синхронность ID-множеств держит линтер `check-validation-sync.cjs` в dev-репо (`npm run verify`, DEC-DEV-0158) — новое правило каталога без строки таблицы / `catalog-sync:acknowledged`-маркера здесь роняет verify.

2. **Не дублировать checks в hooks.** `artifact-validate.js` (inline) — single artifact на save; этот skill — full catalog on-demand. Different scopes, не overlap (но обе share auto-purge pattern per DEC-DEV-0023 F5).

3. **Auto-purge bug awareness.** Pattern из DEC-DEV-0023 F5 — when re-running rule на existing pending entry, если currently passes → purge. Не leave stale entries forever.

4. **V-MK-* skip honestly.** Don't stub как «always pass». Silent skip (default flow) или graceful note (explicit `--rule V-MK-NN`) — никогда «✅ pass» без real check.

5. **Report writes к `.product/.reports/`, не корню.** Reports — derived, regeneratable; должны быть gitignored. Не pollute artifact source-of-truth.

6. **Не блокировать workflow при auto-fix.** V-11 auto-fix — single Edit per missing ref, не gate. Если Edit fails (e.g., target file missing) → degrade к blocking error finding, surface к user.

## Related

- Catalog spec: `.claude/docs/pmo/validation.md` (44 rules + 2 process rules)
- Sync linter (dev-репо экосистемы, не деплоится): `dev/meta-improvement/scripts/check-validation-sync.cjs` (G19, DEC-DEV-0158)
- Companion command: `.claude/commands/product/validate.md`
- Inline hook (Phase 2): `.claude/hooks/product/artifact-validate.js`
- Pending state: `.product/.pending/validation-pending.yaml`
- Reports output: `.product/.reports/validate-<YYYYMMDD-HHMM>.{json,md}` (gitignored)
- Phase 4 dependencies:
  - sub-phase E (handoff) consumes V-H-* runner для DoR check (re-uses hash utility `hooks/product/lib/hash.js`)
  - sub-phase G (cleanup) — shipped: `skills/product/cleanup-detector.md` + `commands/product/cleanup.md` (V-15 standalone + `--pending-hygiene` orchestration)
